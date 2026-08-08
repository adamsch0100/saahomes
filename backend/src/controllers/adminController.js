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

    // Base user list — prefer scored / recently active
    const users = await pool.query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.status, u.intent,
              u.lead_score, u.lead_score_updated_at, u.seller_heat, u.seller_heat_at,
              u.lifecycle_stage, u.lifecycle_stage_manual, u.next_touch_at, u.last_touched_at,
              u.fub_person_id, u.created_at, u.last_active_at,
              (SELECT COUNT(*)::int FROM saved_searches s WHERE s.user_id = u.id) AS search_count,
              (SELECT COUNT(*)::int FROM home_profiles hp WHERE hp.user_id = u.id) AS home_count
       FROM users u
       WHERE u.status IS DISTINCT FROM 'unsubscribed'
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
