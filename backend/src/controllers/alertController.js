/**
 * Saved-search / follow-up alert API (RealScout-style lead capture):
 *   POST   /api/alerts              — save a search (email + filters) → lead → FUB
 *   GET    /api/alerts/manage?token= — list user's searches
 *   GET    /api/alerts/me           — session cookie → searches + lead score
 *   POST   /api/alerts/view         — record property view (session)
 *   POST   /api/alerts/event        — record activity (chat_opened)
 *   PATCH  /api/alerts/:id?token=   — pause/resume/edit a search
 *   DELETE /api/alerts/:id?token=   — delete a search
 *   POST   /api/alerts/unsubscribe  — {token} → unsubscribe all
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import getPool from '../config/database.js';
import { forwardAlertSignupToFollowUpBoss } from '../services/followUpBossService.js';
import {
  recordEvent as recordStreamEvent,
  onIdentified,
  ensureVisitorId,
  PUBLIC_EVENT_TYPES,
} from '../services/events.js';
import { recordConsent } from '../services/consent.js';
import { sendEmail, smtpConfigured } from '../services/emailer.js';
import {
  computeAndStoreLeadScore,
  getSearchMatchMeta,
  recordPropertyView,
  recordUserEvent,
  filtersToSearchPath,
} from '../services/leadScore.js';
import { rejectIfDisposableEmail } from '../utils/emailQuality.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FILTER_KEYS = ['city', 'minPrice', 'maxPrice', 'beds', 'baths', 'type', 'sort', 'q',
  'minSqft', 'minYear', 'maxHoa', 'garage', 'basement', 'fireplace', 'pool',
  'newConstruction', 'waterfront', 'newDays', 'assumable'];
const TYPE_VALUES = ['detached', 'attached', 'land', 'commercial', 'other', ''];
const FREQUENCIES = ['immediate', 'daily', 'weekly'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function cleanPhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) return digits;
  return null;
}

function cleanSchedule(body) {
  const out = {};
  const freq = body.frequency;
  if (freq && FREQUENCIES.includes(String(freq))) out.frequency = String(freq);
  const time = String(body.send_time || '');
  if (/^\d{2}:\d{2}$/.test(time)) out.send_time = time;
  const day = String(body.send_day || '');
  if (DAYS.includes(day)) out.send_day = day;
  return out;
}

function cleanFilters(body) {
  const f = {};
  const numKeys = ['minPrice', 'maxPrice', 'beds', 'baths', 'minSqft', 'minYear', 'maxHoa', 'newDays'];
  const boolKeys = ['garage', 'basement', 'fireplace', 'pool', 'newConstruction', 'waterfront', 'assumable'];
  for (const key of FILTER_KEYS) {
    const v = body[key];
    if (v === undefined || v === null || v === '') continue;
    if (numKeys.includes(key)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n < 1e9) f[key] = String(Math.round(n));
    } else if (boolKeys.includes(key)) {
      if (v === true || v === 'true' || v === 1 || v === '1') f[key] = 'true';
    } else if (key === 'type') {
      if (TYPE_VALUES.includes(String(v))) f[key] = String(v);
    } else if (key === 'city' || key === 'q') {
      const s = String(v).trim();
      if (s.length <= 100) f[key] = s;
    } else if (key === 'sort') {
      f[key] = String(v).slice(0, 20);
    }
  }
  return f;
}

const COOKIE_NAME = 'saa_user_token';
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/** Agent/admin seats must never be touched by the public client-signup paths. */
export function isStaffAccount(userRow) {
  const role = String(userRow?.role || '').toLowerCase();
  return role === 'agent' || role === 'admin';
}

/**
 * True when this request already carries the session cookie of `userRow`.
 * Public signup endpoints upsert by email, so knowing an email must never be
 * enough to sign in as (or set the password of) an existing account.
 */
export function hasOwnSession(req, userRow) {
  const token = req.cookies?.[COOKIE_NAME];
  return !!(token && userRow?.manage_token && token === userRow.manage_token);
}

export const SIGN_IN_REQUIRED_MESSAGE =
  'You already have an account with this email. We just emailed you a sign-in link.';

export const createAlert = async (req, res) => {
  try {
    const { email, name, phone, password, ...filterBody } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(emailStr)) {
      return res.status(400).json({ success: false, error: 'A valid email is required to save a search.' });
    }
    if (rejectIfDisposableEmail(emailStr, res, 'alert')) return;
    const phoneDigits = cleanPhone(phone);
    if (!phoneDigits) {
      return res.status(400).json({ success: false, error: 'Please add your phone number so we can reach you about new listings.' });
    }
    const filters = cleanFilters(filterBody);
    if (Object.keys(filters).length === 0) {
      return res.status(400).json({ success: false, error: 'Add at least one search criteria (city, price, beds…).' });
    }

    const pool = getPool();
    // Upsert user by email (keep existing phone if none provided).
    // An existing account is only updated/signed in when the request already
    // holds that account's session; otherwise the search is still saved (lead
    // capture) but the visitor must use the emailed sign-in link.
    let user = await pool.query('SELECT * FROM users WHERE email = $1', [emailStr]);
    let isOwner = true;
    const isNewUser = !user.rows.length;
    if (user.rows.length && isStaffAccount(user.rows[0])) {
      return res.status(409).json({ success: false, error: 'This email belongs to a team account. Please sign in instead.' });
    }
    if (user.rows.length && !hasOwnSession(req, user.rows[0])) {
      isOwner = false;
    } else if (!user.rows.length) {
      const token = crypto.randomBytes(24).toString('hex');
      const created = await pool.query(
        'INSERT INTO users (email, name, manage_token, phone) VALUES ($1, $2, $3, $4) RETURNING *',
        [emailStr, String(name || '').trim().slice(0, 255) || null, token, phoneDigits]
      );
      user = created;
    } else {
      user = await pool.query(
        `UPDATE users SET status = 'active', last_active_at = NOW(),
           phone = COALESCE(NULLIF($1, ''), phone)
         WHERE id = $2 RETURNING *`,
        [phoneDigits, user.rows[0].id]
      );
    }
    const userRow = user.rows[0];

    // Signup intent: buying | selling | both → routes nurture track
    const intentRaw = String(req.body?.intent || '').trim().toLowerCase();
    const intent = ['buying', 'selling', 'both'].includes(intentRaw) ? intentRaw : null;
    if (intent) {
      await pool.query(
        `UPDATE users SET intent = CASE
           WHEN intent IS NULL OR intent = $1 THEN $1
           WHEN intent = 'buying' AND $1 = 'selling' THEN 'both'
           WHEN intent = 'selling' AND $1 = 'buying' THEN 'both'
           ELSE intent
         END
         WHERE id = $2`,
        [intent, userRow.id]
      );
      userRow.intent = intent;
    }

    // Optional: create a password so the client can log in with email+password
    // (upgrades a magic-link-only account; 8+ chars required)
    const passStr = String(password || '');
    if (isOwner && passStr.length >= 8) {
      const hash = await bcrypt.hash(passStr, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userRow.id]);
    }

    const searchName = String(name || '').trim().slice(0, 255) || 'My Search';
    const schedule = cleanSchedule(req.body || {});
    const inserted = await pool.query(
      `INSERT INTO saved_searches (user_id, name, filters, is_active, frequency, send_time, send_day)
       VALUES ($1, $2, $3, TRUE, $4, $5, $6) RETURNING *`,
      [userRow.id, searchName, JSON.stringify(filters),
       schedule.frequency || 'daily', schedule.send_time || '06:00', schedule.send_day || 'Monday']
    );
    const searchRow = inserted.rows[0];

    await recordStreamEvent({
      type: 'search_saved',
      userId: userRow.id,
      searchId: searchRow.id,
      meta: { filters, frequency: searchRow.frequency, verified: isOwner },
    });
    if (isOwner) {
      await recordConsent({
        userId: userRow.id,
        channel: 'email',
        granted: true,
        wording: 'Email me new listings and price changes that match this search.',
        source: 'save_search',
        req,
      }).catch((e) => console.error('consent record failed:', e.message));
    }

    // Lead → Follow Up Boss (fire-and-forget, never block the user)
    // Captures fub_person_id from the Person response on our users row.
    forwardAlertSignupToFollowUpBoss(userRow, searchRow).catch(() => {});

    // Compute + store lead score from real signals (save-search just landed)
    let leadScore = 0;
    try {
      const scored = await computeAndStoreLeadScore(userRow.id, pool);
      leadScore = scored.score;
    } catch (e) {
      console.error('lead score on save failed:', e.message);
    }

    // Lifecycle refresh for agent cockpit (stage + next-touch)
    try {
      const { refreshLeadLifecycle } = await import('../services/agentCockpit.js');
      refreshLeadLifecycle(userRow.id, pool).catch(() => {});
    } catch { /* noop */ }

    if (!isOwner) {
      emailSignInLink(userRow).catch((e) => console.error('sign-in link failed:', e.message));
      return res.status(201).json({
        success: true,
        signInRequired: true,
        message: SIGN_IN_REQUIRED_MESSAGE,
        data: {
          id: searchRow.id,
          name: searchRow.name,
          filters: searchRow.filters,
        },
      });
    }

    // Auto-login: the manage token becomes a long-lived httpOnly cookie so the
    // user is signed in on this device without ever entering a password.
    setAuthCookie(res, userRow.manage_token);
    await onIdentified(req, userRow.id, { isNew: isNewUser, via: 'save_search' });

    return res.status(201).json({
      success: true,
      data: {
        id: searchRow.id,
        name: searchRow.name,
        filters: searchRow.filters,
        manageToken: userRow.manage_token,
        lead_score: leadScore,
      },
    });
  } catch (error) {
    console.error('createAlert error:', error);
    return res.status(500).json({ success: false, error: 'Could not save your search. Please try again.' });
  }
};

const findUserByToken = async (token) => {
  if (!token || token.length < 16 || token.length > 80) return null;
  const r = await getPool().query('SELECT * FROM users WHERE manage_token = $1 AND status = \'active\'', [String(token)]);
  return r.rows[0] || null;
};

/** Resolve user from query token OR session cookie. */
async function resolveUser(req) {
  const qToken = req.query?.token;
  if (qToken) {
    const u = await findUserByToken(qToken);
    if (u) return u;
  }
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return findUserByToken(cookieToken);
  // Body token used by some POSTs
  const bodyToken = req.body?.token;
  if (bodyToken) return findUserByToken(bodyToken);
  return null;
}

/** Attach live match_count + preview listing to each saved search. */
async function enrichSearches(rows, pool = getPool()) {
  const out = [];
  for (const s of rows) {
    const filters = typeof s.filters === 'string' ? JSON.parse(s.filters) : (s.filters || {});
    const meta = await getSearchMatchMeta(filters, pool);
    out.push({
      ...s,
      filters,
      match_count: meta.match_count,
      preview: meta.preview,
      edit_path: filtersToSearchPath(filters),
    });
  }
  return out;
}

async function buildDashboardPayload(user) {
  const pool = getPool();
  const searches = await pool.query(
    `SELECT id, name, filters, is_active, frequency, send_time, send_day, created_at, last_email_at, last_run_at
     FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id]
  );
  const enriched = await enrichSearches(searches.rows, pool);
  // Refresh score from live signals (cheap; writes once)
  let leadScore = user.lead_score ?? 0;
  let breakdown = null;
  try {
    const scored = await computeAndStoreLeadScore(user.id, pool);
    leadScore = scored.score;
    breakdown = scored.breakdown;
  } catch (e) {
    console.error('lead score refresh failed:', e.message);
  }
  // Seller home profiles (if any) — light summary for account hub
  let homes = [];
  try {
    const hr = await pool.query(
      `SELECT id, address_line, city, state, postal_code, our_estimate_mid, our_estimate_low,
              our_estimate_high, market_estimate_mid, value_updates_enabled, seller_heat, updated_at
       FROM home_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10`,
      [user.id]
    );
    homes = hr.rows;
  } catch {
    homes = [];
  }

  return {
    email: user.email,
    name: user.name,
    phone: user.phone,
    intent: user.intent || null,
    seller_heat: !!user.seller_heat,
    lead_score: leadScore,
    lead_score_breakdown: breakdown,
    lead_score_label: 'Your activity score — helps us match you faster.',
    searches: enriched,
    homes,
  };
}

export const listAlerts = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid or expired manage link.' });
    if (req.query.token) setAuthCookie(res, user.manage_token);
    const data = await buildDashboardPayload(user);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('listAlerts error:', error);
    return res.status(500).json({ success: false, error: 'Could not load your searches.' });
  }
};

/** GET /api/alerts/me — the auth cookie IS the session (no password needed). */
export const getMe = async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, error: 'Not signed in.' });
    const user = await findUserByToken(token);
    if (!user) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ success: false, error: 'Session expired.' });
    }
    const data = await buildDashboardPayload(user);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ success: false, error: 'Could not load your account.' });
  }
};

/** POST /api/alerts/view — { listing_id } record property view for lead score + digest. */
export const recordView = async (req, res) => {
  try {
    const user = await resolveUser(req);
    const listingId = req.body?.listing_id || req.body?.listingId || req.body?.id;
    if (!listingId) return res.status(400).json({ success: false, error: 'listing_id is required.' });
    const visitorId = ensureVisitorId(req, res);
    // Same person + listing within 30 minutes is one view, matching property_views.
    await recordStreamEvent({
      type: 'listing_view',
      userId: user?.id || null,
      visitorId,
      listingId: String(listingId),
      dedupeMinutes: 30,
    });
    // Anonymous views are kept in the event stream and join the contact's
    // history at signup; lead scoring still needs a signed-in contact.
    if (!user) return res.json({ success: true, data: { anonymous: true } });
    const result = await recordPropertyView(user.id, listingId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('recordView error:', error);
    return res.status(500).json({ success: false, error: 'Could not record view.' });
  }
};

/** POST /api/alerts/event — { type: 'chat_opened' } activity signal for lead score. */
export const recordEvent = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });
    const type = String(req.body?.type || req.body?.event_type || '').trim();
    if (!type) return res.status(400).json({ success: false, error: 'event type is required.' });
    // Only allow known intent signals
    const allowed = ['chat_opened'];
    if (!allowed.includes(type)) {
      return res.status(400).json({ success: false, error: 'Unknown event type.' });
    }
    const result = await recordUserEvent(user.id, type, req.body?.meta || null);
    await recordStreamEvent({ type, userId: user.id, visitorId: ensureVisitorId(req, res), dedupeMinutes: 24 * 60 });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('recordEvent error:', error);
    return res.status(500).json({ success: false, error: 'Could not record event.' });
  }
};

/**
 * POST /api/events — browser-sent activity for anyone, signed in or not.
 * Only low-risk types (search, page_view) are accepted here; everything that
 * changes state is recorded server-side by the endpoint that does the work.
 */
const SEARCH_PARAM_MAX = 1500;
export const trackPublicEvent = async (req, res) => {
  try {
    const type = String(req.body?.type || '').trim();
    if (!PUBLIC_EVENT_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: 'Unknown event type.' });
    }
    const user = await resolveUser(req);
    const visitorId = ensureVisitorId(req, res);
    const meta = {};
    if (type === 'search') {
      const params = String(req.body?.params || '').slice(0, SEARCH_PARAM_MAX);
      if (!params) return res.status(400).json({ success: false, error: 'params is required.' });
      meta.params = params;
      const total = Number(req.body?.total);
      if (Number.isFinite(total) && total >= 0) meta.total = Math.round(total);
    } else {
      const path = String(req.body?.path || '').slice(0, 300);
      if (!path.startsWith('/')) return res.status(400).json({ success: false, error: 'path is required.' });
      meta.path = path;
    }
    await recordStreamEvent({
      type,
      userId: user?.id || null,
      visitorId,
      meta,
      // The same search or page from the same person within 10 minutes is one event.
      dedupeMinutes: 10,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('trackPublicEvent error:', error);
    return res.status(500).json({ success: false, error: 'Could not record event.' });
  }
};

/**
 * Email a sign-in (magic) link for an existing account. Sends inline when
 * SMTP is configured on this runtime, otherwise queues it in email_outbox.
 */
export async function emailSignInLink(userRow) {
  const manageUrl = `https://saahomes.com/my-saved-searches/?token=${userRow.manage_token}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111">
      <tr><td align="center" style="padding:24px 16px">
        <div style="color:#CFB36E;font-size:20px;font-weight:800">SAA HOMES</div>
      </td></tr>
    </table>
    <div style="max-width:520px;margin:0 auto;padding:24px 16px">
      <h1 style="font-size:19px;color:#111">Here's your saved searches</h1>
      <p style="color:#4b5563;font-size:14px;line-height:1.6">Click the button to view and manage your saved searches, alerts, and saved homes.</p>
      <a href="${manageUrl}" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">Sign in to my saved searches</a>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">Or copy this link:<br/><span style="color:#111">${manageUrl}</span></p>
      <p style="color:#9ca3af;font-size:11px;margin-top:20px">Schwartz and Associates · (970) 999-1407 · saahomes.com</p>
    </div></body></html>`;
  // Send instantly when SMTP is configured on this runtime; otherwise
  // queue it — the outbox cron drains the queue as a fallback.
  const queueIt = async () => {
    await getPool().query(
      `INSERT INTO email_outbox (to_email, subject, html) VALUES ($1, $2, $3)`,
      [userRow.email, 'Your saved searches — SAA Homes', html]
    );
  };
  try {
    if (smtpConfigured()) {
      await sendEmail(userRow.email, 'Your saved searches — SAA Homes', html, 'Adam Schwartz, SAA Homes');
    } else {
      await queueIt();
    }
  } catch (e) {
    console.error('magic link inline send failed, queuing:', e.message);
    await queueIt();
  }
}

/** POST /api/alerts/magic-link — email the user their sign-in link again. */
export const sendMagicLink = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email.' });
    }
    const user = await getPool().query('SELECT * FROM users WHERE email = $1 AND status = \'active\'', [email]);
    if (user.rows.length) {
      await emailSignInLink(user.rows[0]);
    }
    // Never reveal whether the email exists; always the same friendly reply.
    return res.json({ success: true, message: 'If we have a saved search for that email, your sign-in link is on its way.' });
  } catch (error) {
    console.error('sendMagicLink error:', error);
    return res.status(500).json({ success: false, error: 'Could not send the link. Please try again.' });
  }
};

/** POST /api/alerts/signout — clear the auth cookie. */
export const signOut = async (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
};

export const updateAlert = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid or expired manage link.' });
    const id = Number(req.params.id);
    const pool = getPool();
    const existing = await pool.query('SELECT * FROM saved_searches WHERE id = $1 AND user_id = $2', [id, user.id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, error: 'Search not found.' });

    const { is_active, name, ...filterBody } = req.body || {};
    const updates = [];
    const params = [];
    let i = 1;
    if (typeof is_active === 'boolean') { updates.push(`is_active = $${i++}`); params.push(is_active); }
    if (name !== undefined) { updates.push(`name = $${i++}`); params.push(String(name).trim().slice(0, 255) || 'My Search'); }
    const schedule = cleanSchedule(req.body || {});
    if (schedule.frequency) { updates.push(`frequency = $${i++}`); params.push(schedule.frequency); }
    if (schedule.send_time) { updates.push(`send_time = $${i++}`); params.push(schedule.send_time); }
    if (schedule.send_day) { updates.push(`send_day = $${i++}`); params.push(schedule.send_day); }
    if (filterBody && Object.keys(filterBody).length) {
      // Accept either nested filters or top-level filter keys
      const raw = filterBody.filters && typeof filterBody.filters === 'object'
        ? filterBody.filters
        : filterBody;
      const filters = cleanFilters(raw);
      if (Object.keys(filters).length) { updates.push(`filters = $${i++}`); params.push(JSON.stringify(filters)); }
    }
    if (!updates.length) return res.status(400).json({ success: false, error: 'Nothing to update.' });
    updates.push('updated_at = NOW()');
    params.push(id);
    const updated = await pool.query(
      `UPDATE saved_searches SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, filters, is_active, frequency, send_time, send_day`,
      params
    );
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);
    computeAndStoreLeadScore(user.id, pool).catch(() => {});
    return res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error('updateAlert error:', error);
    return res.status(500).json({ success: false, error: 'Could not update your search.' });
  }
};

export const deleteAlert = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid or expired manage link.' });
    const id = Number(req.params.id);
    const deleted = await getPool().query(
      'DELETE FROM saved_searches WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id]
    );
    if (!deleted.rows.length) return res.status(404).json({ success: false, error: 'Search not found.' });
    computeAndStoreLeadScore(user.id).catch(() => {});
    return res.json({ success: true });
  } catch (error) {
    console.error('deleteAlert error:', error);
    return res.status(500).json({ success: false, error: 'Could not delete your search.' });
  }
};

export const unsubscribeAll = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid or expired link.' });
    await getPool().query(
      "UPDATE users SET status = 'unsubscribed' WHERE id = $1",
      [user.id]
    );
    await getPool().query(
      'UPDATE saved_searches SET is_active = FALSE WHERE user_id = $1',
      [user.id]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('unsubscribeAll error:', error);
    return res.status(500).json({ success: false, error: 'Could not unsubscribe.' });
  }
};
