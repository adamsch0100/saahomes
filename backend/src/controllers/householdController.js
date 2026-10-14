/**
 * Household boards: shop for a home together.
 *   GET    /api/household                  — you, your co-buyers and pending invites
 *   POST   /api/household/invite           — { email, name? } emails a join link
 *   POST   /api/household/join             — { token } from that link; signs the invitee in
 *   POST   /api/household/leave            — leave the shared board
 *   DELETE /api/household/invites/:id      — cancel a pending invite
 *   GET    /api/board                      — every member's saved homes, reactions and comments
 *   POST   /api/board/:listing_key/comments — { body }
 *
 * The join link works like a sign-in link: it only goes to the invitee's own
 * inbox, its token is stored hashed, single use, and expires in 14 days.
 * Private notes on homes are never shown to anyone else.
 */
import crypto from 'crypto';
import getPool from '../config/database.js';
import { recordEvent as recordStreamEvent, onIdentified } from '../services/events.js';
import {
  sendEmail, smtpConfigured, emailBrandForUser, emailSiteUrl, contactLine,
} from '../services/emailer.js';
import { isHomeTenant } from '../services/brand.js';
import { createNotification } from '../services/notificationService.js';
import { hasOwnSession, isStaffAccount, setAuthCookie, SIGN_IN_REQUIRED_MESSAGE, emailSignInLink } from './alertController.js';
import { findListing, resolveUser } from './savedHomesController.js';
import { listingScope } from '../services/feeds.js';
import { tenantIdOf, currentTenantId } from '../services/tenantContext.js';

const SITE = (process.env.SITE_URL || 'https://saahomes.com').replace(/\/$/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_DAYS = 14;
const MAX_PENDING_INVITES = 5;
const MAX_MEMBERS = 6;
const MAX_COMMENT = 1000;

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const firstName = (u) => (u?.name || '').trim().split(/\s+/)[0] || (u?.email || '').split('@')[0] || 'Someone';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const unauthorized = (res) => res.status(401).json({ success: false, error: 'Sign in to shop together.' });

async function sendOrQueue(to, subject, html, fromName, opts) {
  const queueIt = () => getPool().query(
    'INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)', [to, subject, html, currentTenantId()]
  );
  try {
    if (smtpConfigured()) await (opts ? sendEmail(to, subject, html, fromName, opts) : sendEmail(to, subject, html, fromName));
    else await queueIt();
  } catch (e) {
    console.error('household email send failed, queuing:', e.message);
    await queueIt();
  }
}

async function membersOf(pool, householdId) {
  if (!householdId) return [];
  const { rows } = await pool.query(
    `SELECT id, name, email FROM users WHERE household_id = $1 AND status = 'active' ORDER BY id`,
    [householdId]
  );
  return rows;
}

function memberView(m, me) {
  return { id: m.id, name: m.name || null, first_name: firstName(m), email: m.email, you: m.id === me.id };
}

/** GET /api/household */
export const getHousehold = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const pool = getPool();
    if (!user.household_id) return res.json({ success: true, data: { household: null, members: [memberView(user, user)], invites: [] } });
    const [hh, members, invites] = await Promise.all([
      pool.query('SELECT id, name FROM households WHERE id = $1', [user.household_id]),
      membersOf(pool, user.household_id),
      pool.query(
        `SELECT id, email, name, created_at, expires_at FROM household_invites
         WHERE household_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [user.household_id]
      ),
    ]);
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      success: true,
      data: { household: hh.rows[0] || null, members: members.map((m) => memberView(m, user)), invites: invites.rows },
    });
  } catch (error) {
    console.error('getHousehold error:', error);
    return res.status(500).json({ success: false, error: 'Could not load your household.' });
  }
};

/** POST /api/household/invite — { email, name? } */
export const inviteToHousehold = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim().slice(0, 120) || null;
    if (!EMAIL_RE.test(email) || email.length > 255) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email.' });
    }
    if (email === String(user.email).toLowerCase()) {
      return res.status(400).json({ success: false, error: 'That is your own email. Invite the person you are shopping with.' });
    }
    const pool = getPool();

    let householdId = user.household_id;
    if (!householdId) {
      const { rows: [hh] } = await pool.query(
        'INSERT INTO households (tenant_id, name) VALUES ($1, $2) RETURNING id',
        [user.tenant_id || 1, `${firstName(user)}'s home search`]
      );
      householdId = hh.id;
      await pool.query('UPDATE users SET household_id = $1 WHERE id = $2', [householdId, user.id]);
    }

    const members = await membersOf(pool, householdId);
    if (members.some((m) => String(m.email).toLowerCase() === email)) {
      return res.status(409).json({ success: false, error: 'They are already on your board.' });
    }
    if (members.length >= MAX_MEMBERS) {
      return res.status(400).json({ success: false, error: `A board can have up to ${MAX_MEMBERS} people.` });
    }
    // A fresh invite replaces any earlier one for the same person.
    await pool.query(
      `UPDATE household_invites SET revoked_at = NOW()
       WHERE household_id = $1 AND lower(email) = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [householdId, email]
    );
    const { rows: [{ n: pending }] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM household_invites
       WHERE household_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`,
      [householdId]
    );
    if (pending >= MAX_PENDING_INVITES) {
      return res.status(429).json({ success: false, error: 'You have several invites waiting. Cancel one or wait for them to join.' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const { rows: [invite] } = await pool.query(
      `INSERT INTO household_invites (tenant_id, household_id, invited_by, email, name, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + make_interval(days => $7))
       RETURNING id, email, name, created_at, expires_at`,
      [user.tenant_id || 1, householdId, user.id, email, name, hashToken(token), INVITE_DAYS]
    );

    const from = user.name || user.email;
    // The inviter's brokerage: its name, colors and site (SAA's unchanged).
    const { tenant, brand } = await emailBrandForUser({ ...user, tenant_id: user.tenant_id || 1 }, { pool });
    const home = isHomeTenant(tenant);
    const site = emailSiteUrl(tenant, SITE);
    const joinUrl = `${site}/board/?join=${token}`;
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111">
        <tr><td align="center" style="padding:24px 16px"><div style="color:${esc(brand.accent_color)};font-size:20px;font-weight:800">${esc(brand.name.toUpperCase())}</div></td></tr>
      </table>
      <div style="max-width:520px;margin:0 auto;padding:24px 16px">
        <h1 style="font-size:19px;color:#111">${esc(from)} wants to shop for a home with you</h1>
        <p style="color:#4b5563;font-size:14px;line-height:1.6">Join their board to see the homes they've saved, react to each one, and talk it over in one place. Your private notes stay private.</p>
        <a href="${joinUrl}" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">Join the board</a>
        <p style="color:#6b7280;font-size:12px;margin-top:16px">This link signs you in, so don't forward it. It works once and expires in ${INVITE_DAYS} days.</p>
        <p style="color:#9ca3af;font-size:11px;margin-top:20px">${esc(home ? contactLine(brand, 'https://saahomes.com') : contactLine(brand, site))}</p>
      </div></body></html>`;
    const subject = `${firstName(user)} invited you to shop for a home together`;
    if (home) await sendOrQueue(email, subject, html, 'SAA Homes');
    else await sendOrQueue(email, subject, html, brand.from_name || brand.name, { tenantId: tenant.id, replyTo: brand.reply_to || brand.email || null });

    recordStreamEvent({ type: 'household_invite', userId: user.id, meta: { invite_id: invite.id } });
    return res.status(201).json({ success: true, data: { invite } });
  } catch (error) {
    console.error('inviteToHousehold error:', error);
    return res.status(500).json({ success: false, error: 'Could not send the invite.' });
  }
};

/** POST /api/household/join — { token } */
export const joinHousehold = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return res.status(400).json({ success: false, error: 'That invite link is not valid.' });
    }
    const pool = getPool();
    const { rows: [invite] } = await pool.query(
      'SELECT * FROM household_invites WHERE token_hash = $1 AND tenant_id = $2', [hashToken(token), tenantIdOf(req)]
    );
    if (!invite || invite.revoked_at || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'This invite has expired or was already used. Ask for a new one.' });
    }

    let isNew = false;
    let { rows: [member] } = await pool.query(
      'SELECT * FROM users WHERE lower(email) = $1 AND tenant_id = $2', [invite.email.toLowerCase(), invite.tenant_id]
    );
    if (!member) {
      isNew = true;
      ({ rows: [member] } = await pool.query(
        'INSERT INTO users (email, name, manage_token, tenant_id, assigned_agent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [invite.email, invite.name, crypto.randomBytes(24).toString('hex'), invite.tenant_id, req.tenant?.agent?.id || null]
      ));
    }
    // Staff seats never sign in from an emailed link; they sign in as usual.
    if (isStaffAccount(member) && !hasOwnSession(req, member)) {
      await emailSignInLink(member).catch(() => {});
      return res.status(403).json({ success: false, signInRequired: true, error: SIGN_IN_REQUIRED_MESSAGE });
    }

    await pool.query(
      `UPDATE users SET household_id = $1, status = 'active', last_active_at = NOW() WHERE id = $2`,
      [invite.household_id, member.id]
    );
    await pool.query(
      'UPDATE household_invites SET accepted_at = NOW(), accepted_user_id = $1 WHERE id = $2',
      [member.id, invite.id]
    );
    setAuthCookie(res, member.manage_token);
    onIdentified(req, member.id, { isNew, via: 'household_invite' }, pool).catch(() => {});
    recordStreamEvent({ type: 'household_joined', userId: member.id, meta: { household_id: invite.household_id, invited_by: invite.invited_by } });

    if (invite.invited_by) {
      createNotification({
        userId: invite.invited_by,
        type: 'board',
        title: `${firstName(member)} joined your home search`,
        body: 'You can now see each other\'s saved homes and comment on them together.',
        link: '/board/',
        pool,
      }).catch(() => {});
      const { rows: [inviter] } = await pool.query('SELECT name, email FROM users WHERE id = $1', [invite.invited_by]);
      import('../services/followUpBossService.js')
        .then(({ pushNurtureSignalToFollowUpBoss }) => pushNurtureSignalToFollowUpBoss({
          signal: 'co_buyer_joined',
          email: member.email,
          name: member.name,
          phone: member.phone,
          message: inviter ? `Shopping with ${inviter.name || inviter.email} (${inviter.email})` : null,
        }))
        .catch(() => {});
    }

    return res.json({ success: true, data: { household_id: invite.household_id, new_account: isNew } });
  } catch (error) {
    console.error('joinHousehold error:', error);
    return res.status(500).json({ success: false, error: 'Could not join the board.' });
  }
};

/** POST /api/household/leave */
export const leaveHousehold = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    await getPool().query('UPDATE users SET household_id = NULL WHERE id = $1', [user.id]);
    return res.json({ success: true });
  } catch (error) {
    console.error('leaveHousehold error:', error);
    return res.status(500).json({ success: false, error: 'Could not leave the board.' });
  }
};

/** DELETE /api/household/invites/:id */
export const cancelInvite = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    if (!user.household_id) return res.status(404).json({ success: false, error: 'Invite not found.' });
    const r = await getPool().query(
      `UPDATE household_invites SET revoked_at = NOW()
       WHERE id = $1 AND household_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id`,
      [Number(req.params.id) || 0, user.household_id]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Invite not found.' });
    return res.json({ success: true });
  } catch (error) {
    console.error('cancelInvite error:', error);
    return res.status(500).json({ success: false, error: 'Could not cancel the invite.' });
  }
};

/**
 * The shared board for one buyer: every member's saved homes, each person's
 * reaction, and the household's comments. Exported for the agent cockpit.
 */
export async function buildBoard(user, pool = getPool()) {
  const members = user.household_id ? await membersOf(pool, user.household_id) : [user];
  const ids = members.map((m) => m.id);
  const [saved, reactions, comments] = await Promise.all([
    pool.query(
      `SELECT user_id, listing_key, property_address, photo_url, list_price, slug, saved_at
       FROM saved_homes WHERE user_id = ANY($1::int[])`,
      [ids]
    ),
    pool.query(
      `SELECT user_id, listing_key, reaction, updated_at FROM home_reactions
       WHERE user_id = ANY($1::int[]) AND reaction IS NOT NULL`,
      [ids]
    ),
    user.household_id
      ? pool.query(
        `SELECT id, listing_key, user_id, body, created_at FROM home_comments
         WHERE household_id = $1 ORDER BY created_at, id`,
        [user.household_id]
      )
      : { rows: [] },
  ]);

  const keys = [...new Set([...saved.rows.map((r) => r.listing_key), ...comments.rows.map((r) => r.listing_key)])];
  const { feeds } = await listingScope(user.tenant_id ?? null, { pool });
  const { rows: listings } = keys.length
    ? await pool.query(
      `SELECT id, listing_id, slug, status, is_active, list_price, street_number, street_name, unit, city,
              beds, baths, living_area, feed
       FROM listings WHERE listing_id = ANY($1::text[]) AND feed = ANY($2::text[])`,
      [keys, feeds]
    )
    : { rows: [] };
  const byKey = new Map(listings.map((l) => [String(l.listing_id), l]));
  const nameOf = new Map(members.map((m) => [m.id, firstName(m)]));

  const homes = keys.map((key) => {
    const l = byKey.get(key);
    const snaps = saved.rows.filter((r) => r.listing_key === key);
    const snap = snaps[0] || {};
    const people = members.map((m) => ({
      user_id: m.id,
      first_name: nameOf.get(m.id),
      you: m.id === user.id,
      saved: snaps.some((s) => s.user_id === m.id),
      reaction: reactions.rows.find((r) => r.user_id === m.id && r.listing_key === key)?.reaction || null,
    }));
    const thread = comments.rows.filter((c) => c.listing_key === key).map((c) => ({
      id: c.id,
      author: c.user_id ? nameOf.get(c.user_id) || 'A former member' : 'A former member',
      mine: c.user_id === user.id,
      body: c.body,
      created_at: c.created_at,
    }));
    const times = [
      ...snaps.map((s) => new Date(s.saved_at).getTime()),
      ...thread.map((c) => new Date(c.created_at).getTime()),
      ...reactions.rows.filter((r) => r.listing_key === key).map((r) => new Date(r.updated_at).getTime()),
    ].filter(Number.isFinite);
    const street = l ? [l.street_number, l.street_name, l.unit ? `#${l.unit}` : null].filter(Boolean).join(' ') : null;
    const offMarket = l ? l.is_active === false || !['Active', 'Active Under Contract'].includes(l.status) : true;
    const keen = people.filter((p) => p.reaction === 'love' || (p.saved && !p.reaction));
    return {
      listing_key: key,
      slug: l?.slug || snap.slug || null,
      address: street ? `${street}${l.city ? `, ${l.city}` : ''}` : snap.property_address || null,
      list_price: l?.list_price != null ? Number(l.list_price) : snap.list_price ?? null,
      photo_url: l?.id ? `/api/photo/${l.id}/0` : snap.photo_url || null,
      status: l?.status || 'Off market',
      off_market: offMarket,
      beds: l?.beds != null ? Number(l.beds) : null,
      baths: l?.baths != null ? Number(l.baths) : null,
      living_area: l?.living_area != null ? Number(l.living_area) : null,
      sample: l?.feed === 'demo',
      people,
      everyone_loves: members.length > 1 && keen.length === members.length,
      comments: thread,
      last_activity: times.length ? new Date(Math.max(...times)).toISOString() : null,
    };
  }).sort((a, b) => String(b.last_activity || '').localeCompare(String(a.last_activity || '')));

  return { shared: members.length > 1, members: members.map((m) => memberView(m, user)), homes };
}

/** GET /api/board */
export const getBoard = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: await buildBoard(user) });
  } catch (error) {
    console.error('getBoard error:', error);
    return res.status(500).json({ success: false, error: 'Could not load your board.' });
  }
};

/** POST /api/board/:listing_key/comments — { body } */
export const addBoardComment = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    if (!user.household_id) {
      return res.status(400).json({ success: false, error: 'Invite the person you are shopping with to comment together.' });
    }
    const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, MAX_COMMENT) : '';
    if (!body) return res.status(400).json({ success: false, error: 'Write a comment first.' });

    const pool = getPool();
    const listing = await findListing(pool, decodeURIComponent(String(req.params.listing_key || '')));
    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found.' });
    const key = String(listing.listing_id);

    const { rows: [comment] } = await pool.query(
      `INSERT INTO home_comments (tenant_id, household_id, listing_key, user_id, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, listing_key, body, created_at`,
      [user.tenant_id || 1, user.household_id, key, user.id, body]
    );
    recordStreamEvent({ type: 'board_comment', userId: user.id, listingId: key, meta: { comment_id: comment.id } });

    const address = [listing.street_number, listing.street_name].filter(Boolean).join(' ') || 'a home';
    const others = (await membersOf(pool, user.household_id)).filter((m) => m.id !== user.id);
    const snippet = body.length > 140 ? `${body.slice(0, 137)}…` : body;
    for (const m of others) {
      createNotification({
        userId: m.id,
        type: 'board',
        title: `${firstName(user)} commented on ${address}`,
        body: snippet,
        link: `/board/#home-${encodeURIComponent(key)}`,
        imageUrl: `/api/photo/${listing.id}/0`,
        pool,
      }).catch(() => {});
    }
    // The agent reads it on the commenter's Follow Up Boss timeline.
    import('../services/followUpBossService.js')
      .then(({ addFollowUpBossNote }) => addFollowUpBossNote(user.id, {
        subject: `Comment on ${address}${listing.city ? `, ${listing.city}` : ''} (MLS ${key})`,
        body: `${user.name || user.email} wrote on their shared board: "${body}"`,
      }, { pool }))
      .catch(() => {});

    return res.status(201).json({
      success: true,
      data: { ...comment, author: firstName(user), mine: true },
    });
  } catch (error) {
    console.error('addBoardComment error:', error);
    return res.status(500).json({ success: false, error: 'Could not post your comment.' });
  }
};
