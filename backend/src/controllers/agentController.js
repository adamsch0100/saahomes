/**
 * Multi-agent seats (P-1) — agent login, team-pooled cockpit, assign.
 * Reuses agentCockpit service for the same lead shape as /api/admin/cockpit.
 * Visibility: agents see ALL client users (team pool). No admin settings here.
 */
import bcrypt from 'bcrypt';
import getPool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shared cockpit list — same shape as admin getCockpitLeads, plus assignment.
 * Clients only (role client / null); agents+admins are excluded from the pool.
 */
async function listCockpitLeads(req, res) {
  try {
    const { q = '', stage = '', due = '', limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 200);
    const like = `%${String(q).trim()}%`;
    const pool = getPool();

    const users = await pool.query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.status, u.intent,
              u.lead_score, u.lead_score_updated_at, u.seller_heat, u.seller_heat_at,
              u.lifecycle_stage, u.lifecycle_stage_manual, u.next_touch_at, u.last_touched_at,
              u.fub_person_id, u.source, u.created_at, u.last_active_at,
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
    logger.error('Error fetching agent cockpit leads', error);
    return res.status(500).json({ error: 'Failed to fetch cockpit leads' });
  }
}

/**
 * POST /api/agent/login — email + password for users with role agent|admin.
 * Clients rejected with 403. JWT: { id, email, role }.
 */
export const agentLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(emailStr) || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const pool = getPool();
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = $1 AND status = 'active'",
      [emailStr]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const role = String(user.role || '').toLowerCase();
    if (role !== 'agent' && role !== 'admin') {
      return res.status(403).json({ error: 'Agent or admin access required' });
    }

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: role === 'admin' ? 'admin' : 'agent',
      name: user.name || null,
    });

    logger.info('Agent login successful', { email: user.email, role, id: user.id });
    return res.json({
      success: true,
      token,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: role === 'admin' ? 'admin' : 'agent',
      },
    });
  } catch (error) {
    logger.error('agentLogin error', error);
    return res.status(500).json({ error: 'Could not log in' });
  }
};

/** GET /api/agent/cockpit?q=&stage=&due=today&limit= */
export const getAgentCockpit = listCockpitLeads;

/**
 * PATCH /api/agent/cockpit/:id
 * Same fields as admin patch (stage / next_touch / mark_touched) — no admin-only extras.
 */
export const patchAgentCockpitLead = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid lead id' });
    }
    const body = req.body || {};
    const pool = getPool();
    const existing = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND COALESCE(role, 'client') = 'client'`,
      [id]
    );
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
      updates.push('lifecycle_stage_manual = TRUE');
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

    const refreshed = await pool.query(
      `SELECT u.*, a.name AS assigned_agent_name, a.email AS assigned_agent_email
       FROM users u
       LEFT JOIN users a ON a.id = u.assigned_agent_id
       WHERE u.id = $1`,
      [id]
    );
    const { enrichLeadForCockpit } = await import('../services/agentCockpit.js');
    const lead = await enrichLeadForCockpit(refreshed.rows[0], { persist: false }, pool);
    return res.json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error patching agent cockpit lead', error);
    return res.status(500).json({ error: 'Failed to update lead' });
  }
};

/**
 * POST /api/agent/assign  { user_id, assigned_agent_id }
 * Claim / reassign a contact. assigned_agent_id null = unassign to team pool.
 * Agent may assign to self or any active agent/admin teammate; admin same.
 * Records user_events agent_assign timeline row.
 */
export const assignLead = async (req, res) => {
  try {
    const body = req.body || {};
    const userId = Number(body.user_id);
    const assignRaw = body.assigned_agent_id;
    const assignedAgentId =
      assignRaw === null || assignRaw === '' || assignRaw === undefined
        ? null
        : Number(assignRaw);

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    if (assignedAgentId != null && (!Number.isFinite(assignedAgentId) || assignedAgentId <= 0)) {
      return res.status(400).json({ error: 'assigned_agent_id must be a positive id or null' });
    }

    const pool = getPool();
    const leadRes = await pool.query(
      `SELECT * FROM users WHERE id = $1 AND COALESCE(role, 'client') = 'client'`,
      [userId]
    );
    if (!leadRes.rows[0]) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    let agentRow = null;
    if (assignedAgentId != null) {
      const agentRes = await pool.query(
        `SELECT id, email, name, role, status FROM users
         WHERE id = $1 AND role IN ('agent', 'admin') AND status = 'active'`,
        [assignedAgentId]
      );
      if (!agentRes.rows[0]) {
        return res.status(400).json({ error: 'assigned_agent_id must be an active agent or admin' });
      }
      agentRow = agentRes.rows[0];
    }

    const previous = leadRes.rows[0].assigned_agent_id;
    await pool.query(
      `UPDATE users SET assigned_agent_id = $1 WHERE id = $2`,
      [assignedAgentId, userId]
    );

    // Timeline (It 17 pattern) — real event only
    try {
      await pool.query(
        `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'agent_assign', $2::jsonb)`,
        [
          userId,
          JSON.stringify({
            assigned_agent_id: assignedAgentId,
            previous_assigned_agent_id: previous != null ? Number(previous) : null,
            by_user_id: req.user?.id ?? null,
            by_email: req.user?.email || null,
            by_role: req.user?.role || null,
          }),
        ]
      );
    } catch (e) {
      logger.warn('assignLead user_events insert failed', { message: e.message });
    }

    const refreshed = await pool.query(
      `SELECT u.*, a.name AS assigned_agent_name, a.email AS assigned_agent_email
       FROM users u
       LEFT JOIN users a ON a.id = u.assigned_agent_id
       WHERE u.id = $1`,
      [userId]
    );
    const { enrichLeadForCockpit } = await import('../services/agentCockpit.js');
    const lead = await enrichLeadForCockpit(refreshed.rows[0], { persist: false }, pool);

    logger.info('Lead assigned', {
      userId,
      assignedAgentId,
      by: req.user?.email,
    });

    return res.json({
      success: true,
      data: lead,
      meta: {
        assigned_agent: agentRow
          ? { id: agentRow.id, name: agentRow.name, email: agentRow.email }
          : null,
      },
    });
  } catch (error) {
    logger.error('assignLead error', error);
    return res.status(500).json({ error: 'Failed to assign lead' });
  }
};

/**
 * GET /api/agent/teammates — active agents/admins for assign dropdowns.
 * Agents need this list to reassign; not admin-only.
 */
export const listTeammates = async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, email, name, phone, role, status, last_active_at
       FROM users
       WHERE role IN ('agent', 'admin') AND status = 'active'
       ORDER BY name NULLS LAST, email`
    );
    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        phone: r.phone || null,
        role: r.role,
        last_active_at: r.last_active_at || null,
      })),
    });
  } catch (error) {
    logger.error('listTeammates error', error);
    return res.status(500).json({ error: 'Failed to list teammates' });
  }
};

/**
 * GET /api/agent/me — authenticated agent + resolved brand config (P-2).
 * Agent/admin only; clients never see this. Read-only — brand edits are admin.
 * Includes marketKey / marketName from the P-4 content pack registry.
 */
export const getAgentMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, email, name, phone, role, status, created_at, last_active_at,
              brand_name, brokerage_name, brand_phone, voice_style, market_key
       FROM users
       WHERE id = $1 AND role IN ('agent', 'admin') AND status = 'active'`,
      [userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const { publicAgentPayload } = await import('../services/tenantBrand.js');
    return res.json({ success: true, data: publicAgentPayload(result.rows[0]) });
  } catch (error) {
    logger.error('getAgentMe error', error);
    return res.status(500).json({ error: 'Failed to load agent profile' });
  }
};

/**
 * GET /api/agent/market — agent's market pack key + display name (P-4).
 * Minimal read-only label for the agent console. agentOrAdmin only.
 */
export const getAgentMarket = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const pool = getPool();
    const result = await pool.query(
      `SELECT market_key FROM users
       WHERE id = $1 AND role IN ('agent', 'admin') AND status = 'active'`,
      [userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const { getMarketPack, resolveMarketKey } = await import('../config/marketPacks.js');
    const marketKey = resolveMarketKey(result.rows[0].market_key);
    const pack = getMarketPack(marketKey);
    return res.json({
      success: true,
      data: {
        marketKey,
        marketName: pack.market?.name || 'Northern Colorado',
      },
    });
  } catch (error) {
    logger.error('getAgentMarket error', error);
    return res.status(500).json({ error: 'Failed to load market' });
  }
};

// ── Connect CRM (P-3a) — per-agent Follow Up Boss key + contact import ─────

/**
 * Build masked FUB status payload for an agent row. Never includes raw key.
 */
async function buildAgentFubStatus(userId, pool = getPool()) {
  const { maskFubApiKey } = await import('../services/followUpBossService.js');
  const row = await pool.query(
    `SELECT fub_api_key, fub_last_import_at
     FROM users
     WHERE id = $1 AND role IN ('agent', 'admin')`,
    [userId]
  );
  const agent = row.rows[0];
  if (!agent) return null;

  const connected = !!(agent.fub_api_key && String(agent.fub_api_key).trim());
  let importedCount = 0;
  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users
       WHERE source = 'fub-import'
         AND COALESCE(role, 'client') = 'client'
         AND assigned_agent_id = $1`,
      [userId]
    );
    importedCount = countRes.rows[0]?.n || 0;
  } catch {
    importedCount = 0;
  }

  return {
    connected,
    maskedKey: connected ? maskFubApiKey(agent.fub_api_key) : null,
    lastImportAt: agent.fub_last_import_at
      ? new Date(agent.fub_last_import_at).toISOString()
      : null,
    importedCount,
  };
}

/**
 * POST /api/agent/fub/connect  { apiKey }
 * Verify key with read-only FUB call; only store when valid. Never log raw key.
 */
export const connectAgentFub = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const apiKey = String(req.body?.apiKey || '').trim();
    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }
    if (apiKey.length < 8) {
      return res.status(400).json({ error: 'API key looks too short — paste your full Follow Up Boss key' });
    }

    const { verifyFollowUpBossApiKey } = await import('../services/followUpBossService.js');
    const verified = await verifyFollowUpBossApiKey(apiKey);
    if (!verified.success) {
      return res.status(400).json({
        error: verified.error || 'Invalid Follow Up Boss API key',
      });
    }

    const pool = getPool();
    const updated = await pool.query(
      `UPDATE users SET fub_api_key = $1
       WHERE id = $2 AND role IN ('agent', 'admin') AND status = 'active'
       RETURNING id`,
      [apiKey, userId]
    );
    if (!updated.rows[0]) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    logger.info('Agent FUB key connected', { userId, peopleTotal: verified.total ?? null });
    const status = await buildAgentFubStatus(userId, pool);
    return res.json({ success: true, data: status });
  } catch (error) {
    logger.error('connectAgentFub error', error);
    return res.status(500).json({ error: 'Could not connect Follow Up Boss' });
  }
};

/**
 * GET /api/agent/fub/status
 * { connected, maskedKey?, lastImportAt?, importedCount? }
 */
export const getAgentFubStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const status = await buildAgentFubStatus(userId);
    if (!status) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    return res.json({ success: true, data: status });
  } catch (error) {
    logger.error('getAgentFubStatus error', error);
    return res.status(500).json({ error: 'Failed to load CRM status' });
  }
};

/**
 * POST /api/agent/fub/disconnect — null out the per-agent key (env key untouched).
 */
export const disconnectAgentFub = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const pool = getPool();
    const updated = await pool.query(
      `UPDATE users SET fub_api_key = NULL
       WHERE id = $1 AND role IN ('agent', 'admin')
       RETURNING id`,
      [userId]
    );
    if (!updated.rows[0]) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    logger.info('Agent FUB key disconnected', { userId });
    // Keep lastImportAt / importedCount honest — disconnect only clears the key
    const status = await buildAgentFubStatus(userId, pool);
    return res.json({
      success: true,
      data: status || {
        connected: false,
        maskedKey: null,
        lastImportAt: null,
        importedCount: 0,
      },
    });
  } catch (error) {
    logger.error('disconnectAgentFub error', error);
    return res.status(500).json({ error: 'Could not disconnect Follow Up Boss' });
  }
};

/**
 * POST /api/agent/fub/import
 * Pull paginated people from agent's FUB key; dedupe into users; return counts.
 */
export const importAgentFubContacts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const pool = getPool();
    const row = await pool.query(
      `SELECT id, fub_api_key FROM users
       WHERE id = $1 AND role IN ('agent', 'admin') AND status = 'active'`,
      [userId]
    );
    const agent = row.rows[0];
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (!agent.fub_api_key || !String(agent.fub_api_key).trim()) {
      return res.status(400).json({
        error: 'Connect Follow Up Boss first — no API key on file',
      });
    }

    const { importFollowUpBossContacts } = await import('../services/followUpBossService.js');
    const result = await importFollowUpBossContacts({
      apiKey: agent.fub_api_key,
      agentUserId: userId,
      pool,
      maxPages: 25,
      pageSize: 100,
    });

    // Hard fail only when nothing ran and key/list failed on page 0
    if (result.error && result.pagesFetched === 0 && result.imported === 0 && result.duplicates === 0) {
      return res.status(400).json({
        error: result.error,
        data: {
          imported: 0,
          duplicates: 0,
          failed: 0,
          total: result.total,
        },
      });
    }

    const status = await buildAgentFubStatus(userId, pool);
    return res.json({
      success: true,
      data: {
        imported: result.imported,
        duplicates: result.duplicates,
        failed: result.failed,
        total: result.total,
        truncated: !!result.truncated,
        partial: !!result.partial,
        ...(result.error ? { warning: result.error } : {}),
        status,
      },
    });
  } catch (error) {
    logger.error('importAgentFubContacts error', error);
    return res.status(500).json({ error: 'Contact import failed' });
  }
};

// ── Website forms (P-3b) — public capture slug + stats ─────────────────────

/**
 * URL-safe slug base from brand_name or email local-part.
 * Letters/digits/hyphens only; max 48 chars before uniqueness suffix.
 */
function slugifyBase(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || 'agent';
}

/**
 * Ensure agent has a unique webform_slug. Generates from brand_name → name → email.
 * Collision-safe loop with numeric suffix. Never fabricates; only persists real unique value.
 */
export async function ensureAgentWebformSlug(userId, pool = getPool()) {
  const row = await pool.query(
    `SELECT id, email, name, brand_name, webform_slug
     FROM users
     WHERE id = $1 AND role IN ('agent', 'admin')`,
    [userId]
  );
  const agent = row.rows[0];
  if (!agent) return null;
  if (agent.webform_slug) return agent.webform_slug;

  const emailLocal = String(agent.email || '').split('@')[0] || '';
  const base = slugifyBase(agent.brand_name || agent.name || emailLocal || `agent-${agent.id}`);

  for (let n = 0; n < 40; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    try {
      const updated = await pool.query(
        `UPDATE users SET webform_slug = $1
         WHERE id = $2
           AND role IN ('agent', 'admin')
           AND (webform_slug IS NULL OR webform_slug = '')
         RETURNING webform_slug`,
        [candidate, userId]
      );
      if (updated.rows[0]?.webform_slug) return updated.rows[0].webform_slug;
      // Another request may have set it concurrently
      const again = await pool.query(
        `SELECT webform_slug FROM users WHERE id = $1`,
        [userId]
      );
      if (again.rows[0]?.webform_slug) return again.rows[0].webform_slug;
    } catch (err) {
      // Unique violation → try next suffix
      if (err.code === '23505') continue;
      throw err;
    }
  }
  // Last resort: id-based unique token
  const fallback = `agent-${agent.id}-${Date.now().toString(36)}`;
  const forced = await pool.query(
    `UPDATE users SET webform_slug = $1 WHERE id = $2 RETURNING webform_slug`,
    [fallback, userId]
  );
  return forced.rows[0]?.webform_slug || null;
}

/**
 * GET /api/agent/webform/slug
 * Ensures slug exists; returns { slug, endpoint, captureUrl }.
 */
export const getAgentWebformSlug = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const pool = getPool();
    const slug = await ensureAgentWebformSlug(userId, pool);
    if (!slug) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const endpoint = 'https://saahomes.com/api/webform/lead';
    return res.json({
      success: true,
      data: {
        slug,
        endpoint,
        captureUrl: `${endpoint}?slug=${encodeURIComponent(slug)}`,
      },
    });
  } catch (error) {
    logger.error('getAgentWebformSlug error', error);
    return res.status(500).json({ error: 'Failed to load webform link' });
  }
};

/**
 * POST /api/agent/webform/slug/regenerate
 * Issue a new unique slug (old link stops working).
 */
export const regenerateAgentWebformSlug = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const pool = getPool();
    const row = await pool.query(
      `SELECT id, email, name, brand_name FROM users
       WHERE id = $1 AND role IN ('agent', 'admin') AND status = 'active'`,
      [userId]
    );
    if (!row.rows[0]) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = row.rows[0];
    const emailLocal = String(agent.email || '').split('@')[0] || '';
    const base = slugifyBase(agent.brand_name || agent.name || emailLocal || `agent-${agent.id}`);

    let newSlug = null;
    for (let n = 0; n < 40; n++) {
      const candidate = n === 0
        ? `${base}-${Date.now().toString(36).slice(-4)}`
        : `${base}-${Date.now().toString(36).slice(-4)}-${n}`;
      try {
        const updated = await pool.query(
          `UPDATE users SET webform_slug = $1
           WHERE id = $2 AND role IN ('agent', 'admin')
           RETURNING webform_slug`,
          [candidate, userId]
        );
        newSlug = updated.rows[0]?.webform_slug || null;
        if (newSlug) break;
      } catch (err) {
        if (err.code === '23505') continue;
        throw err;
      }
    }
    if (!newSlug) {
      return res.status(500).json({ error: 'Could not generate a unique slug' });
    }
    logger.info('Agent webform slug regenerated', { userId, slug: newSlug });
    const endpoint = 'https://saahomes.com/api/webform/lead';
    return res.json({
      success: true,
      data: {
        slug: newSlug,
        endpoint,
        captureUrl: `${endpoint}?slug=${encodeURIComponent(newSlug)}`,
      },
    });
  } catch (error) {
    logger.error('regenerateAgentWebformSlug error', error);
    return res.status(500).json({ error: 'Failed to regenerate webform link' });
  }
};

/**
 * GET /api/agent/webform/stats
 * Real counts only: total webform leads assigned to this agent + last 7 days.
 */
export const getAgentWebformStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const pool = getPool();

    // Ensure slug exists so the console always has a link
    const slug = await ensureAgentWebformSlug(userId, pool);

    const totals = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7_days,
         MAX(created_at) AS last_lead_at
       FROM users
       WHERE assigned_agent_id = $1
         AND COALESCE(role, 'client') = 'client'
         AND source = 'webform'`,
      [userId]
    );
    const row = totals.rows[0] || {};
    return res.json({
      success: true,
      data: {
        slug,
        endpoint: 'https://saahomes.com/api/webform/lead',
        total: row.total || 0,
        last7Days: row.last_7_days || 0,
        lastLeadAt: row.last_lead_at
          ? new Date(row.last_lead_at).toISOString()
          : null,
      },
    });
  } catch (error) {
    logger.error('getAgentWebformStats error', error);
    return res.status(500).json({ error: 'Failed to load webform stats' });
  }
};

