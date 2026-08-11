import bcrypt from 'bcrypt';
import crypto from 'crypto';
import getPool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'adam@saahomes.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Simple check against environment variables
  // In production, you'd want to hash the password and store it securely
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = generateToken({ email, role: 'admin' });
    logger.info('Admin login successful', { email });
    return res.json({ success: true, token });
  }

  logger.warn('Failed admin login attempt', { email });
  return res.status(401).json({ error: 'Invalid credentials' });
};

export const getSubmissions = async (req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100
    const offsetNum = parseInt(offset) || 0;

    let query, countQuery;
    
    if (type === 'market-report') {
      query = `
        SELECT * FROM market_report_submissions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = 'SELECT COUNT(*) FROM market_report_submissions';
    } else if (type === 'contact') {
      query = `
        SELECT * FROM contact_submissions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = 'SELECT COUNT(*) FROM contact_submissions';
    } else {
      // Get both types
      query = `
        SELECT 
          'contact' as type,
          id,
          name as first_name,
          '' as last_name,
          email,
          phone,
          interest,
          message,
          area,
          created_at
        FROM contact_submissions
        UNION ALL
        SELECT 
          'market-report' as type,
          id,
          first_name,
          last_name,
          email,
          phone,
          NULL as interest,
          NULL as message,
          area,
          created_at
        FROM market_report_submissions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `
        SELECT 
          (SELECT COUNT(*) FROM contact_submissions) +
          (SELECT COUNT(*) FROM market_report_submissions) as count
      `;
    }

    const pool = getPool();
    const [results, countResult] = await Promise.all([
      pool.query(query, [limitNum, offsetNum]),
      pool.query(countQuery),
    ]);

    const total = parseInt(countResult.rows[0].count || countResult.rows[0]?.count || 0);

    res.json({
      success: true,
      data: results.rows,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching submissions', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

export const getSubmission = async (req, res) => {
  try {
    const { id, type } = req.params;

    let query;
    if (type === 'market-report') {
      query = 'SELECT * FROM market_report_submissions WHERE id = $1';
    } else {
      query = 'SELECT * FROM contact_submissions WHERE id = $1';
    }

    const result = await getPool().query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching submission', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
};

export const getStats = async (req, res) => {
  try {
    const pool = getPool();
    const [contactCount, marketReportCount, recentContacts, recentMarketReports] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM contact_submissions'),
      pool.query('SELECT COUNT(*) FROM market_report_submissions'),
      pool.query(`
        SELECT COUNT(*) FROM contact_submissions 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      pool.query(`
        SELECT COUNT(*) FROM market_report_submissions 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
    ]);

    res.json({
      success: true,
      data: {
        totalContacts: parseInt(contactCount.rows[0].count),
        totalMarketReports: parseInt(marketReportCount.rows[0].count),
        contactsLast7Days: parseInt(recentContacts.rows[0].count),
        marketReportsLast7Days: parseInt(recentMarketReports.rows[0].count),
      },
    });
  } catch (error) {
    logger.error('Error fetching stats', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};


// ---------------------------------------------------------------------------
// Client saved-search CRM (agent side) — see/edit every client's searches
// ---------------------------------------------------------------------------

/** GET /api/admin/searches?q=&limit= — all clients + their saved searches */
export const getClientSearches = async (req, res) => {
  try {
    const { q = '', limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const like = `%${q.trim()}%`;
    const users = await getPool().query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.status, u.created_at, u.last_active_at,
              u.lead_score, u.lifecycle_stage, u.next_touch_at, u.fub_person_id, u.seller_heat,
              (SELECT COUNT(*) FROM saved_searches s WHERE s.user_id = u.id) AS search_count,
              (SELECT COUNT(*) FROM saved_searches s WHERE s.user_id = u.id AND s.is_active) AS active_count
       FROM users u
       WHERE ($1 = '%%' OR u.email ILIKE $1 OR u.name ILIKE $1 OR u.phone ILIKE $1)
       ORDER BY COALESCE(u.lead_score, 0) DESC, u.created_at DESC LIMIT $2`,
      [like, limitNum]
    );
    const ids = users.rows.map((u) => u.id);
    let searches = [];
    if (ids.length) {
      const s = await getPool().query(
        `SELECT id, user_id, name, filters, is_active, frequency, send_time, send_day,
                created_at, last_run_at, last_email_at
         FROM saved_searches WHERE user_id = ANY($1) ORDER BY created_at DESC`,
        [ids]
      );
      searches = s.rows;
    }
    const byUser = {};
    for (const row of users.rows) byUser[row.id] = { ...row, searches: [] };
    for (const row of searches) byUser[row.user_id]?.searches.push(row);
    return res.json({ success: true, data: Object.values(byUser) });
  } catch (error) {
    logger.error('Error fetching client searches', error);
    res.status(500).json({ error: 'Failed to fetch client searches' });
  }
};

/** POST /api/admin/searches — create a saved search FOR a client */
export const createClientSearch = async (req, res) => {
  try {
    const { client_email, client_name, client_phone, name, filters, frequency, send_time, send_day } = req.body || {};
    const email = String(client_email || '').trim().toLowerCase();
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'A valid client email is required' });
    }
    const filterObj = filters && typeof filters === 'object' ? filters : {};
    if (Object.keys(filterObj).length === 0) {
      return res.status(400).json({ error: 'Add at least one search criterion (city, price, beds…)' });
    }

    // Upsert client (no password — they sign in via magic link or set one later)
    let user = await getPool().query('SELECT * FROM users WHERE email = $1', [email]);
    let userId;
    if (user.rows.length) {
      userId = user.rows[0].id;
      await getPool().query(
        `UPDATE users SET status = 'active', name = COALESCE(NULLIF($1, ''), name),
           phone = COALESCE(NULLIF($2, ''), phone), last_active_at = NOW() WHERE id = $3`,
        [String(client_name || '').trim(), String(client_phone || '').replace(/\D/g, ''), userId]
      );
    } else {
      const token = crypto.randomBytes(24).toString('hex');
      const created = await getPool().query(
        `INSERT INTO users (email, name, phone, manage_token) VALUES ($1, $2, $3, $4) RETURNING id`,
        [email, String(client_name || '').trim() || null, String(client_phone || '').replace(/\D/g, '') || null, token]
      );
      userId = created.rows[0].id;
    }

    const inserted = await getPool().query(
      `INSERT INTO saved_searches (user_id, name, filters, is_active, frequency, send_time, send_day)
       VALUES ($1, $2, $3, TRUE, $4, $5, $6) RETURNING id`,
      [userId, String(name || '').trim().slice(0, 255) || 'My Search', JSON.stringify(filterObj),
       frequency === 'weekly' || frequency === 'immediate' ? frequency : 'daily',
       /^\d{2}:\d{2}$/.test(send_time || '') ? send_time : '06:00',
       ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(send_day) ? send_day : 'Monday']
    );

    // FUB lead for the new client search (fire-and-forget)
    const userRow = await getPool().query('SELECT * FROM users WHERE id = $1', [userId]);
    const searchRow = await getPool().query('SELECT * FROM saved_searches WHERE id = $1', [inserted.rows[0].id]);
    try {
      const { forwardAlertSignupToFollowUpBoss } = await import('../services/followUpBossService.js');
      forwardAlertSignupToFollowUpBoss(userRow.rows[0], searchRow.rows[0]).catch(() => {});
    } catch { /* noop */ }

    return res.status(201).json({ success: true, data: { searchId: inserted.rows[0].id, userId } });
  } catch (error) {
    logger.error('Error creating client search', error);
    res.status(500).json({ error: 'Failed to create client search' });
  }
};

/** PATCH /api/admin/searches/:id — edit any client's search */
export const updateClientSearch = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, filters, is_active, frequency, send_time, send_day } = req.body || {};
    const updates = [];
    const params = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); params.push(String(name).slice(0, 255)); }
    if (filters && typeof filters === 'object' && Object.keys(filters).length) {
      updates.push(`filters = $${i++}`); params.push(JSON.stringify(filters));
    }
    if (typeof is_active === 'boolean') { updates.push(`is_active = $${i++}`); params.push(is_active); }
    if (['immediate','daily','weekly'].includes(frequency)) { updates.push(`frequency = $${i++}`); params.push(frequency); }
    if (/^\d{2}:\d{2}$/.test(send_time || '')) { updates.push(`send_time = $${i++}`); params.push(send_time); }
    if (['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(send_day)) {
      updates.push(`send_day = $${i++}`); params.push(send_day);
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    updates.push('updated_at = NOW()');
    params.push(id);
    await getPool().query(`UPDATE saved_searches SET ${updates.join(', ')} WHERE id = $${i}`, params);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error updating client search', error);
    res.status(500).json({ error: 'Failed to update client search' });
  }
};

/** DELETE /api/admin/searches/:id — remove any client's search */
export const deleteClientSearch = async (req, res) => {
  try {
    await getPool().query('DELETE FROM saved_searches WHERE id = $1', [Number(req.params.id)]);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting client search', error);
    res.status(500).json({ error: 'Failed to delete client search' });
  }
};

/** GET /api/admin/search-stats — CRM overview counts */
export const searchStats = async (req, res) => {
  try {
    const r = await getPool().query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM saved_searches) AS total_searches,
        (SELECT COUNT(*) FROM saved_searches WHERE is_active) AS active_searches,
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') AS users_7d,
        (SELECT COUNT(*) FROM saved_searches WHERE last_email_at > NOW() - INTERVAL '7 days') AS emailed_7d,
        (SELECT COUNT(*) FROM showing_requests) AS total_showings,
        (SELECT COUNT(*) FROM showing_requests WHERE created_at > NOW() - INTERVAL '7 days') AS showings_7d
    `);
    return res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    logger.error('Error fetching search stats', error);
    res.status(500).json({ error: 'Failed to fetch search stats' });
  }
};

// ---------------------------------------------------------------------------
// Agent cockpit (It 12) — score, heat, lifecycle, next-touch, due-today queue
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/cockpit?q=&stage=&due=today&limit=
 * Lead list with score, heat 🔥, lifecycle stage, next-touch due date.
 * Derived from real events only.
 */
export const getCockpitLeads = async (req, res) => {
  try {
    const { q = '', stage = '', due = '', limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 200);
    const like = `%${String(q).trim()}%`;
    const pool = getPool();

    // Base user list — client pool only (exclude agent/admin seats), with assignment
    const users = await pool.query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.status, u.intent,
              u.lead_score, u.lead_score_updated_at, u.seller_heat, u.seller_heat_at,
              u.lifecycle_stage, u.lifecycle_stage_manual, u.next_touch_at, u.last_touched_at,
              u.fub_person_id, u.created_at, u.last_active_at,
              u.assigned_agent_id,
              a.name AS assigned_agent_name,
              a.email AS assigned_agent_email,
              (SELECT COUNT(*)::int FROM saved_searches s WHERE s.user_id = u.id) AS search_count,
              (SELECT COUNT(*)::int FROM home_profiles hp WHERE hp.user_id = u.id) AS home_count
       FROM users u
       LEFT JOIN users a ON a.id = u.assigned_agent_id
       WHERE u.status IS DISTINCT FROM 'unsubscribed'
         AND COALESCE(u.role, 'client') = 'client'
         AND ($1 = '%%' OR u.email ILIKE $1 OR u.name ILIKE $1 OR u.phone ILIKE $1)
       ORDER BY COALESCE(u.lead_score, 0) DESC, u.last_active_at DESC NULLS LAST, u.created_at DESC
       LIMIT $2`,
      [like, limitNum]
    );

    const { enrichLeadForCockpit } = await import('../services/agentCockpit.js');
    const enriched = [];
    for (const row of users.rows) {
      const lead = await enrichLeadForCockpit(row, { persist: true }, pool);
      lead.search_count = Number(row.search_count) || 0;
      lead.home_count = Number(row.home_count) || 0;
      enriched.push(lead);
    }

    let filtered = enriched;
    if (stage && stage !== 'all') {
      filtered = filtered.filter((l) => l.lifecycle_stage === stage);
    }
    if (due === 'today') {
      filtered = filtered.filter((l) => l.is_due_today);
      // Due today: sort by score/heat desc
      filtered.sort((a, b) => {
        if (a.is_hot !== b.is_hot) return a.is_hot ? -1 : 1;
        return (b.lead_score || 0) - (a.lead_score || 0);
      });
    }

    const dueTodayCount = enriched.filter((l) => l.is_due_today).length;
    const hotCount = enriched.filter((l) => l.is_hot).length;

    return res.json({
      success: true,
      data: filtered,
      meta: {
        total: filtered.length,
        due_today: dueTodayCount,
        hot: hotCount,
        fub_configured: !!(process.env.FOLLOW_UP_BOSS_API_KEY || process.env.FOLLOW_UP_BOSS_WEBHOOK_URL),
      },
    });
  } catch (error) {
    logger.error('Error fetching cockpit leads', error);
    res.status(500).json({ error: 'Failed to fetch cockpit leads' });
  }
};

/**
 * GET /api/admin/cockpit/due-today
 * Follow-up queue: who needs contact today, sorted by heat then score.
 */
export const getDueTodayQueue = async (req, res) => {
  try {
    // Reuse cockpit with due=today filter
    req.query = { ...req.query, due: 'today', limit: req.query.limit || '50' };
    return getCockpitLeads(req, res);
  } catch (error) {
    logger.error('Error fetching due-today queue', error);
    res.status(500).json({ error: 'Failed to fetch due-today queue' });
  }
};

/**
 * PATCH /api/admin/cockpit/:id
 * Manually set lifecycle_stage and/or next_touch_at / last_touched_at.
 * Body: { lifecycle_stage?, next_touch_at?, mark_touched?: true }
 */
export const patchCockpitLead = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid lead id' });
    }
    const body = req.body || {};
    const pool = getPool();
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updates = [];
    const params = [];
    let i = 1;

    if (body.lifecycle_stage != null) {
      const stage = String(body.lifecycle_stage).toLowerCase().trim();
      const { LIFECYCLE_STAGES } = await import('../services/agentCockpit.js');
      if (!LIFECYCLE_STAGES.includes(stage)) {
        return res.status(400).json({
          error: `lifecycle_stage must be one of: ${LIFECYCLE_STAGES.join(', ')}`,
        });
      }
      updates.push(`lifecycle_stage = $${i++}`);
      params.push(stage);
      updates.push(`lifecycle_stage_manual = TRUE`);
    }

    if (body.next_touch_at !== undefined) {
      if (body.next_touch_at === null || body.next_touch_at === '') {
        updates.push('next_touch_at = NULL');
      } else {
        const d = new Date(body.next_touch_at);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: 'Invalid next_touch_at date' });
        }
        updates.push(`next_touch_at = $${i++}`);
        params.push(d);
      }
    }

    if (body.mark_touched === true) {
      updates.push('last_touched_at = NOW()');
      // Default next touch from stage cadence if not explicitly set
      if (body.next_touch_at === undefined) {
        const { deriveNextTouchAt } = await import('../services/agentCockpit.js');
        const stage = body.lifecycle_stage
          || existing.rows[0].lifecycle_stage
          || 'nurturing';
        const next = deriveNextTouchAt(stage, {
          lastTouchedAt: new Date(),
          createdAt: existing.rows[0].created_at,
          lastActiveAt: existing.rows[0].last_active_at,
        });
        if (next) {
          updates.push(`next_touch_at = $${i++}`);
          params.push(next);
        } else {
          updates.push('next_touch_at = NULL');
        }
      }
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    params.push(id);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
      params
    );

    const refreshed = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const { enrichLeadForCockpit } = await import('../services/agentCockpit.js');
    const lead = await enrichLeadForCockpit(refreshed.rows[0], { persist: false }, pool);
    return res.json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error patching cockpit lead', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

// ---------------------------------------------------------------------------
// Agent share-home (It 16 / P5) — share a listing + note → FUB + timeline + inbox
// ---------------------------------------------------------------------------

/**
 * Resolve agent-supplied listing input (MLS#, slug, serial id, or full URL)
 * to a key we can look up in the live listings feed.
 */
function extractListingKeyOrSlug(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 500) return null;
  try {
    if (raw.includes('://') || raw.startsWith('/')) {
      const u = raw.includes('://')
        ? new URL(raw)
        : new URL(raw, 'https://saahomes.com');
      const parts = u.pathname.split('/').filter(Boolean);
      const hfs = parts.indexOf('homes-for-sale');
      if (hfs >= 0 && parts[hfs + 1]) return decodeURIComponent(parts[hfs + 1]);
      const prop = parts.indexOf('properties');
      if (prop >= 0 && parts[prop + 1]) return decodeURIComponent(parts[prop + 1]);
      if (parts.length) return decodeURIComponent(parts[parts.length - 1]);
    }
  } catch {
    /* fall through to raw */
  }
  return raw;
}

function formatListingAddress(row) {
  if (!row) return null;
  const street = [row.street_number, row.street_name, row.unit ? `#${row.unit}` : null]
    .filter(Boolean)
    .join(' ');
  const cityLine = [row.city, row.state].filter(Boolean).join(', ');
  if (street && cityLine) return `${street}, ${cityLine}`;
  return street || cityLine || null;
}

function isListingOnMarket(listing) {
  if (!listing) return false;
  if (listing.is_active === false) return false;
  const status = String(listing.status || '').toLowerCase();
  if (['sold', 'withdrawn', 'expired', 'canceled', 'cancelled', 'closed'].includes(status)) {
    return false;
  }
  return true;
}

/**
 * POST /api/admin/share-home
 * Body: { email, name?, phone?, listingKeyOrSlug, note? }
 *
 * Agent shares a live-feed listing + optional note with a client:
 *   1. Resolve listing from DB (404 if missing — never fabricate)
 *   2. FUB nurture event (signal: shared_home, source saahomes.com)
 *   3. user_events row for cockpit timeline (when recipient has a users row)
 *   4. In-app notification (only when recipient has an account)
 *
 * Do NOT bump lead score here — lead score tracks CLIENT engagement signals;
 * an agent-initiated share is agent activity (recorded in user_events / FUB only).
 */
export const shareHome = async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const name = body.name != null ? String(body.name).trim() : '';
    const phone = body.phone != null ? String(body.phone).trim() : '';
    const note = body.note != null ? String(body.note).trim().slice(0, 2000) : '';
    const listingInput =
      body.listingKeyOrSlug ||
      body.listing_key ||
      body.listingKey ||
      body.listing_id ||
      body.slug ||
      '';

    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'A valid recipient email is required.',
      });
    }

    const key = extractListingKeyOrSlug(listingInput);
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'listingKeyOrSlug is required (MLS#, slug, or listing URL).',
      });
    }

    const pool = getPool();

    // Live feed only — never fabricate a home
    let listing = null;
    {
      let r = await pool.query(
        `SELECT id, listing_id, slug, status, is_active, list_price,
                street_number, street_name, unit, city, state, postal_code
         FROM listings WHERE listing_id = $1 LIMIT 1`,
        [key]
      );
      if (r.rows.length) listing = r.rows[0];
      if (!listing) {
        r = await pool.query(
          `SELECT id, listing_id, slug, status, is_active, list_price,
                  street_number, street_name, unit, city, state, postal_code
           FROM listings WHERE slug = $1 LIMIT 1`,
          [key]
        );
        if (r.rows.length) listing = r.rows[0];
      }
      if (!listing && /^\d+$/.test(key)) {
        r = await pool.query(
          `SELECT id, listing_id, slug, status, is_active, list_price,
                  street_number, street_name, unit, city, state, postal_code
           FROM listings WHERE id = $1 LIMIT 1`,
          [Number(key)]
        );
        if (r.rows.length) listing = r.rows[0];
      }
    }

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found in the live feed. Check the MLS# or URL and try again.',
      });
    }

    const address = formatListingAddress(listing);
    const price =
      listing.list_price != null && Number.isFinite(Number(listing.list_price))
        ? Math.round(Number(listing.list_price))
        : null;
    const priceLabel =
      price != null ? `$${price.toLocaleString('en-US')}` : null;
    const onMarket = isListingOnMarket(listing);
    const listingKey = String(listing.listing_id);
    const slug = listing.slug || null;
    // Live route for listing detail (not fabricated path)
    const listingLink = slug ? `/homes-for-sale/${slug}/` : '/properties/';
    const photoUrl = listing.id ? `/api/photo/${listing.id}/0` : null;

    const messageParts = [
      address || null,
      priceLabel,
      listingKey ? `MLS ${listingKey}` : null,
      onMarket ? null : 'off market',
      note || null,
    ].filter(Boolean);
    const fubMessage = messageParts.join(' · ');

    // 1) FUB — await so response reports real status (no fake success when unconfigured)
    let fubStatus = { success: false, reason: 'not_attempted' };
    try {
      const { pushNurtureSignalToFollowUpBoss } = await import(
        '../services/followUpBossService.js'
      );
      fubStatus = await pushNurtureSignalToFollowUpBoss({
        signal: 'shared_home',
        email,
        name: name || undefined,
        phone: phone || undefined,
        message: fubMessage,
        property: {
          street: address || undefined,
          mlsNumber: listingKey || undefined,
          price: price != null ? price : undefined,
        },
      });
    } catch (e) {
      logger.error('shareHome FUB push failed', { message: e.message });
      fubStatus = { success: false, error: e.message };
    }

    // Resolve recipient account (optional — FUB still fires without it)
    const userRes = await pool.query(
      `SELECT id, email, name FROM users
       WHERE LOWER(email) = $1 AND status IS DISTINCT FROM 'unsubscribed'
       LIMIT 1`,
      [email]
    );
    const recipient = userRes.rows[0] || null;

    // 2) user_events for cockpit timeline — only when recipient is a known lead/user.
    // Do NOT bump lead score (agent activity ≠ client engagement).
    let eventStatus = 'skipped_no_account';
    if (recipient) {
      try {
        await pool.query(
          `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'shared_home', $2::jsonb)`,
          [
            recipient.id,
            JSON.stringify({
              listing_key: listingKey,
              slug,
              property_address: address,
              list_price: price,
              note: note || null,
              recipient_email: email,
              off_market: !onMarket,
            }),
          ]
        );
        eventStatus = 'recorded';
      } catch (e) {
        logger.warn('shareHome user_events insert failed', { message: e.message });
        eventStatus = 'failed';
      }
    }

    // 3) In-app notification — only if users row matches email; skip silently otherwise
    let notificationStatus = 'skipped_no_account';
    if (recipient) {
      try {
        const { createNotification } = await import('../services/notificationService.js');
        const bodyText = note
          ? `${address || 'A home'} — ${note}`
          : [address, priceLabel].filter(Boolean).join(' — ') || 'A home was shared with you';
        const created = await createNotification({
          userId: recipient.id,
          type: 'shared_home',
          title: 'Adam shared a home with you',
          body: bodyText,
          link: listingLink,
          imageUrl: photoUrl,
          pool,
        });
        notificationStatus = created ? 'delivered' : 'failed';
      } catch (e) {
        logger.warn('shareHome notification failed', { message: e.message });
        notificationStatus = 'failed';
      }
    }

    logger.info('Agent share-home completed', {
      email,
      listing_key: listingKey,
      fub: fubStatus?.success,
      fub_reason: fubStatus?.reason || null,
      eventStatus,
      notificationStatus,
    });

    return res.json({
      success: true,
      fubStatus,
      notificationStatus,
      eventStatus,
      listing: {
        listing_key: listingKey,
        property_address: address,
        list_price: price,
        slug,
        off_market: !onMarket,
        link: listingLink,
      },
    });
  } catch (error) {
    logger.error('Error in shareHome', error);
    res.status(500).json({ success: false, error: 'Failed to share home' });
  }
};

/**
 * POST /api/admin/sync-fub-lifecycle
 * Body: { leadId } or { email }
 *
 * Pull FUB person tags → map to lifecycle_stage (It 17 / P6).
 * Never overwrites lifecycle_stage_manual (that flag exists so Adam's manual
 * stage in the cockpit wins over FUB tag sync).
 * Honest before/after; no lead-score bump; clean-skip when FUB unconfigured.
 */
export const syncFubLifecycle = async (req, res) => {
  try {
    const body = req.body || {};
    const leadIdRaw = body.leadId ?? body.lead_id ?? body.id ?? null;
    const emailRaw = body.email != null ? String(body.email).trim().toLowerCase() : '';

    if (leadIdRaw == null && !emailRaw.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'leadId or a valid email is required.',
      });
    }

    const pool = getPool();
    let lead = null;

    if (leadIdRaw != null && String(leadIdRaw).trim() !== '') {
      const idNum = Number(leadIdRaw);
      if (!Number.isFinite(idNum)) {
        return res.status(400).json({ success: false, error: 'leadId must be a number.' });
      }
      const r = await pool.query(
        `SELECT id, email, name, lifecycle_stage, lifecycle_stage_manual, fub_person_id
         FROM users WHERE id = $1 LIMIT 1`,
        [idNum]
      );
      lead = r.rows[0] || null;
    } else {
      const r = await pool.query(
        `SELECT id, email, name, lifecycle_stage, lifecycle_stage_manual, fub_person_id
         FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [emailRaw]
      );
      lead = r.rows[0] || null;
    }

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found.' });
    }

    const currentStage = lead.lifecycle_stage || 'new';
    const isManual = !!lead.lifecycle_stage_manual;

    const {
      pullFollowUpBossPerson,
      mapFubTagsToLifecycle,
    } = await import('../services/followUpBossService.js');

    const pulled = await pullFollowUpBossPerson({
      email: lead.email,
      fubPersonId: lead.fub_person_id,
    });

    // Clean-skip when FUB key is missing — not an error
    if (!pulled.configured || pulled.reason === 'not_configured') {
      return res.json({
        success: true,
        synced: false,
        reason: 'fub_not_configured',
        from: currentStage,
        to: currentStage,
        tags: [],
        fubPersonId: lead.fub_person_id || null,
      });
    }

    if (pulled.error && !pulled.found) {
      return res.json({
        success: true,
        synced: false,
        reason: 'fub_error',
        error: pulled.error,
        from: currentStage,
        to: currentStage,
        tags: [],
        fubPersonId: lead.fub_person_id || null,
      });
    }

    if (!pulled.found) {
      return res.json({
        success: true,
        synced: false,
        reason: 'person_not_found',
        from: currentStage,
        to: currentStage,
        tags: [],
        fubPersonId: lead.fub_person_id || null,
      });
    }

    const tags = Array.isArray(pulled.tags) ? pulled.tags : [];
    const fubPersonId = pulled.personId || lead.fub_person_id || null;
    const { stage: mappedStage, mappedTags, unmappedTags } = mapFubTagsToLifecycle(tags);

    // Manual stage must never be overwritten by FUB sync — that is the point of the flag.
    if (isManual) {
      return res.json({
        success: true,
        synced: false,
        reason: 'manual_stage',
        currentStage,
        from: currentStage,
        to: currentStage,
        tags,
        mappedTags,
        unmappedTags,
        fubPersonId,
      });
    }

    // Store fub_person_id if we discovered one and lead didn't have it
    if (fubPersonId && !lead.fub_person_id) {
      try {
        await pool.query(
          `UPDATE users SET fub_person_id = $1 WHERE id = $2 AND fub_person_id IS NULL`,
          [String(fubPersonId), lead.id]
        );
      } catch (e) {
        logger.warn('syncFubLifecycle fub_person_id store failed', { message: e.message });
      }
    }

    if (!mappedStage) {
      // Tags present (or empty) but none map to a lifecycle stage — no stage change
      return res.json({
        success: true,
        synced: false,
        reason: tags.length ? 'no_mapped_tags' : 'no_tags',
        from: currentStage,
        to: currentStage,
        tags,
        mappedTags,
        unmappedTags,
        fubPersonId,
      });
    }

    if (mappedStage === currentStage) {
      return res.json({
        success: true,
        synced: false,
        reason: 'already_current',
        from: currentStage,
        to: currentStage,
        tags,
        mappedTags,
        unmappedTags,
        fubPersonId,
      });
    }

    // Update stage only — leave lifecycle_stage_manual FALSE; do not bump lead score
    await pool.query(
      `UPDATE users SET lifecycle_stage = $1 WHERE id = $2`,
      [mappedStage, lead.id]
    );

    // Timeline event (non-blocking for response honesty if insert fails)
    try {
      await pool.query(
        `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'fub_sync', $2::jsonb)`,
        [
          lead.id,
          JSON.stringify({
            fub_person_id: fubPersonId,
            tags,
            mappedTags,
            unmappedTags,
            from: currentStage,
            to: mappedStage,
          }),
        ]
      );
    } catch (e) {
      logger.warn('syncFubLifecycle user_events insert failed', { message: e.message });
    }

    logger.info('FUB lifecycle sync applied', {
      leadId: lead.id,
      from: currentStage,
      to: mappedStage,
      fub_person_id: fubPersonId,
      tags,
    });

    return res.json({
      success: true,
      synced: true,
      from: currentStage,
      to: mappedStage,
      tags,
      mappedTags,
      unmappedTags,
      fubPersonId,
    });
  } catch (error) {
    logger.error('Error in syncFubLifecycle', error);
    res.status(500).json({ success: false, error: 'Failed to sync lifecycle from FUB' });
  }
};

/**
 * GET /api/admin/fub/status — configured flag + optional live people count (read-only).
 * Never creates a test person.
 */
export const getFubStatus = async (req, res) => {
  try {
    const { isFollowUpBossConfigured, getFollowUpBossPeopleCount } = await import(
      '../services/followUpBossService.js'
    );
    const configured = isFollowUpBossConfigured();
    if (!configured) {
      return res.json({
        success: true,
        data: { configured: false, message: 'FOLLOW_UP_BOSS_API_KEY not set — FUB writes skipped cleanly.' },
      });
    }
    const count = await getFollowUpBossPeopleCount();
    return res.json({ success: true, data: { configured: true, ...count } });
  } catch (error) {
    logger.error('Error checking FUB status', error);
    res.status(500).json({ error: 'Failed to check FUB status' });
  }
};

/**
 * GET /api/admin/lead-quality-stats — deliverability / enrich-layer health (last 30d).
 * Used for monitoring disposable blocks + submission volume. No frontend page yet.
 */
export const getLeadQualityStats = async (req, res) => {
  try {
    const pool = getPool();

    const [totals, blocked, topDomains, byPathBlocked, byPathSubmitted] = await Promise.all([
      pool.query(`
        SELECT
          (
            (SELECT COUNT(*)::int FROM contact_submissions WHERE created_at >= NOW() - INTERVAL '30 days') +
            (SELECT COUNT(*)::int FROM market_report_submissions WHERE created_at >= NOW() - INTERVAL '30 days') +
            (SELECT COUNT(*)::int FROM chfa_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days') +
            (SELECT COUNT(*)::int FROM champions_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days') +
            (SELECT COUNT(*)::int FROM chfa_dpa_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days') +
            (SELECT COUNT(*)::int FROM ghope_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days') +
            (SELECT COUNT(*)::int FROM showing_requests WHERE created_at >= NOW() - INTERVAL '30 days')
          ) AS total_submissions,
          (
            SELECT COUNT(DISTINCT LOWER(email))::int FROM (
              SELECT email FROM contact_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
              UNION
              SELECT email FROM market_report_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
              UNION
              SELECT email FROM chfa_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
              UNION
              SELECT email FROM champions_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
              UNION
              SELECT email FROM chfa_dpa_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
              UNION
              SELECT email FROM ghope_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
              UNION
              SELECT email FROM showing_requests WHERE created_at >= NOW() - INTERVAL '30 days'
            ) all_emails
          ) AS unique_emails
      `).catch(() => ({ rows: [{ total_submissions: 0, unique_emails: 0 }] })),
      pool.query(`
        SELECT COUNT(*)::int AS blocked_disposable
        FROM blocked_email_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `).catch(() => ({ rows: [{ blocked_disposable: 0 }] })),
      pool.query(`
        SELECT domain, COUNT(*)::int AS count
        FROM blocked_email_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND domain IS NOT NULL
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT COALESCE(path, 'unknown') AS path, COUNT(*)::int AS blocked
        FROM blocked_email_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY COALESCE(path, 'unknown')
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT path, COUNT(*)::int AS submitted FROM (
          SELECT 'contact' AS path FROM contact_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT 'market-report' FROM market_report_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT 'chfa' FROM chfa_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT 'champions' FROM champions_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT 'chfa-dpa' FROM chfa_dpa_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT 'ghope' FROM ghope_lead_submissions WHERE created_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT 'showing' FROM showing_requests WHERE created_at >= NOW() - INTERVAL '30 days'
        ) s
        GROUP BY path
      `).catch(() => ({ rows: [] })),
    ]);

    const total_submissions = Number(totals.rows[0]?.total_submissions || 0);
    const unique_emails = Number(totals.rows[0]?.unique_emails || 0);
    const blocked_disposable = Number(blocked.rows[0]?.blocked_disposable || 0);

    const blockedByPath = Object.fromEntries(
      (byPathBlocked.rows || []).map((r) => [r.path, Number(r.blocked || 0)])
    );
    const submittedByPath = Object.fromEntries(
      (byPathSubmitted.rows || []).map((r) => [r.path, Number(r.submitted || 0)])
    );
    const allPaths = new Set([
      ...Object.keys(blockedByPath),
      ...Object.keys(submittedByPath),
    ]);
    const by_path = [...allPaths]
      .map((path) => ({
        path,
        blocked: blockedByPath[path] || 0,
        submitted: submittedByPath[path] || 0,
      }))
      .sort((a, b) => (b.submitted + b.blocked) - (a.submitted + a.blocked));

    res.json({
      last30d: {
        total_submissions,
        unique_emails,
        blocked_disposable,
      },
      top_blocked_domains: (topDomains.rows || []).map((r) => ({
        domain: r.domain,
        count: Number(r.count || 0),
      })),
      by_path,
    });
  } catch (error) {
    logger.error('Error fetching lead quality stats', error);
    res.status(500).json({ error: 'Failed to fetch lead quality stats' });
  }
};

/**
 * A/B subject-line open rates (Phase D / It 19a).
 * Groups email_log by (type, subject_variant) — raw SQL only, no fabricated numbers.
 */
export const getEmailAbStats = async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        COALESCE(type, 'unknown') AS type,
        COALESCE(subject_variant, '(none)') AS variant,
        COUNT(*)::int AS sent,
        COUNT(*) FILTER (WHERE COALESCE(open_count, 0) > 0)::int AS opened
      FROM email_log
      WHERE subject_variant IS NOT NULL
         OR open_token IS NOT NULL
         OR type IN ('digest', 'home_value_digest')
      GROUP BY COALESCE(type, 'unknown'), COALESCE(subject_variant, '(none)')
      ORDER BY type, variant
    `).catch(() => ({ rows: [] }));

    const variants = (result.rows || []).map((r) => {
      const sent = Number(r.sent || 0);
      const opened = Number(r.opened || 0);
      return {
        type: r.type,
        variant: r.variant,
        sent,
        opened,
        open_rate: sent > 0 ? opened / sent : 0,
      };
    });

    const totals = variants.reduce(
      (acc, v) => {
        acc.sent += v.sent;
        acc.opened += v.opened;
        return acc;
      },
      { sent: 0, opened: 0 }
    );
    totals.open_rate = totals.sent > 0 ? totals.opened / totals.sent : 0;

    res.json({ variants, totals });
  } catch (error) {
    logger.error('Error fetching email A/B stats', error);
    res.status(500).json({ error: 'Failed to fetch email A/B stats' });
  }
};

// ---------------------------------------------------------------------------
// Multi-agent seats (P-1) — admin creates / lists / activates agents
// ---------------------------------------------------------------------------

const AGENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/agents
 * Create a teammate account with role=agent.
 * Body: { name, email, phone?, password, brand_name?, brokerage_name?, brand_phone?, voice_style? }
 */
export const createAgent = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    const nameStr = String(name || '').trim().slice(0, 255);
    const passStr = String(password || '');

    if (!AGENT_EMAIL_RE.test(emailStr)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!nameStr) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (passStr.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const phoneDigits = String(phone || '').replace(/\D/g, '');
    const phoneVal =
      phoneDigits.length >= 7 && phoneDigits.length <= 15 ? phoneDigits : null;

    const { parseBrandFields, publicAgentPayload } = await import('../services/tenantBrand.js');
    const brandParsed = parseBrandFields(req.body || {});
    if (brandParsed.error) {
      return res.status(400).json({ error: brandParsed.error });
    }
    const brand = brandParsed.fields || {};
    // brand_name defaults to agent name when omitted (brief P-2)
    const brandName =
      brand.brand_name !== undefined ? brand.brand_name : nameStr.slice(0, 120);
    const brokerageName = brand.brokerage_name !== undefined ? brand.brokerage_name : null;
    const brandPhone = brand.brand_phone !== undefined ? brand.brand_phone : null;
    const voiceStyle = brand.voice_style !== undefined ? brand.voice_style : 'warm';

    const pool = getPool();
    const existing = await pool.query('SELECT id, role, password_hash FROM users WHERE LOWER(email) = $1', [
      emailStr,
    ]);

    if (existing.rows.length) {
      const row = existing.rows[0];
      const role = String(row.role || '').toLowerCase();
      // Upgrade existing client → agent if Adam wants this email as an agent seat
      if (role === 'agent' || role === 'admin') {
        return res.status(409).json({ error: 'An agent/admin account with that email already exists' });
      }
      const hash = await bcrypt.hash(passStr, 10);
      const token = crypto.randomBytes(24).toString('hex');
      const updated = await pool.query(
        `UPDATE users SET
           password_hash = $1,
           name = $2,
           phone = COALESCE($3, phone),
           role = 'agent',
           status = 'active',
           manage_token = COALESCE(manage_token, $4),
           brand_name = $5,
           brokerage_name = $6,
           brand_phone = $7,
           voice_style = $8,
           last_active_at = NOW()
         WHERE id = $9
         RETURNING id, email, name, phone, role, status, created_at, last_active_at,
                   brand_name, brokerage_name, brand_phone, voice_style`,
        [hash, nameStr, phoneVal, token, brandName, brokerageName, brandPhone, voiceStyle, row.id]
      );
      logger.info('Existing user upgraded to agent', { email: emailStr, id: row.id });
      return res.status(200).json({
        success: true,
        data: publicAgentPayload(updated.rows[0]),
        upgraded: true,
      });
    }

    const hash = await bcrypt.hash(passStr, 10);
    const manageToken = crypto.randomBytes(24).toString('hex');
    const created = await pool.query(
      `INSERT INTO users (
         email, name, phone, manage_token, password_hash, role, status, last_active_at,
         brand_name, brokerage_name, brand_phone, voice_style
       )
       VALUES ($1, $2, $3, $4, $5, 'agent', 'active', NOW(), $6, $7, $8, $9)
       RETURNING id, email, name, phone, role, status, created_at, last_active_at,
                 brand_name, brokerage_name, brand_phone, voice_style`,
      [emailStr, nameStr, phoneVal, manageToken, hash, brandName, brokerageName, brandPhone, voiceStyle]
    );

    logger.info('Agent account created', { email: emailStr, id: created.rows[0].id });
    return res.status(201).json({ success: true, data: publicAgentPayload(created.rows[0]) });
  } catch (error) {
    logger.error('createAgent error', error);
    return res.status(500).json({ error: 'Failed to create agent' });
  }
};

/**
 * GET /api/admin/agents — list agent (+ admin) seats (includes brand config).
 */
export const listAgents = async (req, res) => {
  try {
    const { publicAgentPayload } = await import('../services/tenantBrand.js');
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, email, name, phone, role, status, created_at, last_active_at,
              brand_name, brokerage_name, brand_phone, voice_style,
              (SELECT COUNT(*)::int FROM users c
               WHERE c.assigned_agent_id = users.id
                 AND COALESCE(c.role, 'client') = 'client') AS assigned_lead_count
       FROM users
       WHERE role IN ('agent', 'admin')
       ORDER BY
         CASE status WHEN 'active' THEN 0 ELSE 1 END,
         name NULLS LAST,
         email`
    );
    const data = result.rows.map((row) => ({
      ...publicAgentPayload(row),
      assigned_lead_count: row.assigned_lead_count,
    }));
    return res.json({ success: true, data });
  } catch (error) {
    logger.error('listAgents error', error);
    return res.status(500).json({ error: 'Failed to list agents' });
  }
};

/**
 * PATCH /api/admin/agents/:id
 * Activate / deactivate (status) or update name/phone/password/brand fields.
 * Body: { status?, name?, phone?, password?, brand_name?, brokerage_name?, brand_phone?, voice_style? }
 */
export const patchAgent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid agent id' });
    }
    const body = req.body || {};
    const pool = getPool();
    const existing = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND role IN ('agent', 'admin')`,
      [id]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { parseBrandFields, publicAgentPayload } = await import('../services/tenantBrand.js');
    const brandParsed = parseBrandFields(body);
    if (brandParsed.error) {
      return res.status(400).json({ error: brandParsed.error });
    }

    const updates = [];
    const params = [];
    let i = 1;

    if (body.status != null) {
      const status = String(body.status).toLowerCase().trim();
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: "status must be 'active' or 'inactive'" });
      }
      updates.push(`status = $${i++}`);
      params.push(status);
    }

    if (body.name != null) {
      const nameStr = String(body.name).trim().slice(0, 255);
      if (!nameStr) return res.status(400).json({ error: 'Name cannot be empty' });
      updates.push(`name = $${i++}`);
      params.push(nameStr);
    }

    if (body.phone !== undefined) {
      const phoneDigits = String(body.phone || '').replace(/\D/g, '');
      if (!phoneDigits) {
        updates.push('phone = NULL');
      } else if (phoneDigits.length >= 7 && phoneDigits.length <= 15) {
        updates.push(`phone = $${i++}`);
        params.push(phoneDigits);
      } else {
        return res.status(400).json({ error: 'Invalid phone' });
      }
    }

    if (body.password != null && String(body.password).length > 0) {
      const passStr = String(body.password);
      if (passStr.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const hash = await bcrypt.hash(passStr, 10);
      updates.push(`password_hash = $${i++}`);
      params.push(hash);
    }

    const brand = brandParsed.fields || {};
    if (Object.prototype.hasOwnProperty.call(brand, 'brand_name')) {
      if (brand.brand_name == null) {
        updates.push('brand_name = NULL');
      } else {
        updates.push(`brand_name = $${i++}`);
        params.push(brand.brand_name);
      }
    }
    if (Object.prototype.hasOwnProperty.call(brand, 'brokerage_name')) {
      if (brand.brokerage_name == null) {
        updates.push('brokerage_name = NULL');
      } else {
        updates.push(`brokerage_name = $${i++}`);
        params.push(brand.brokerage_name);
      }
    }
    if (Object.prototype.hasOwnProperty.call(brand, 'brand_phone')) {
      if (brand.brand_phone == null) {
        updates.push('brand_phone = NULL');
      } else {
        updates.push(`brand_phone = $${i++}`);
        params.push(brand.brand_phone);
      }
    }
    if (Object.prototype.hasOwnProperty.call(brand, 'voice_style')) {
      updates.push(`voice_style = $${i++}`);
      params.push(brand.voice_style);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    params.push(id);
    const updated = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}
       RETURNING id, email, name, phone, role, status, created_at, last_active_at,
                 brand_name, brokerage_name, brand_phone, voice_style`,
      params
    );

    logger.info('Agent patched', { id, by: req.user?.email, fields: Object.keys(body) });
    return res.json({ success: true, data: publicAgentPayload(updated.rows[0]) });
  } catch (error) {
    logger.error('patchAgent error', error);
    return res.status(500).json({ error: 'Failed to update agent' });
  }
};
