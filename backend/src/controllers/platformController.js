/**
 * /api/platform — the platform owner's console: every brokerage on the
 * platform, adding a new one with its owner, and pausing one. Only the
 * platform owner (the env admin login) can reach it.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { DEFAULT_TENANT_ID, clearTenantCache } from '../services/tenantContext.js';
import { issueAccountLink } from '../services/accountLinks.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_SLUGS = new Set(['www', 'api', 'app', 'admin', 'agent', 'platform', 'mail', 'static', 'cdn', 'saa']);

export const requirePlatform = (req, res, next) => {
  if (req.user?.platform !== true) return res.status(403).json({ error: 'Platform owner only' });
  return next();
};

function normalizeDomain(raw) {
  const d = String(raw || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.+$/, '').replace(/^www\./, '');
  return d;
}

const TENANT_LIST_SQL = `
  SELECT t.id, t.slug, t.name, t.primary_domain, t.market_key, t.status, t.created_at,
         (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id AND u.role IN ('agent', 'admin') AND u.status = 'active') AS agent_count,
         (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id AND COALESCE(u.role, 'client') = 'client') AS lead_count,
         (SELECT u.email FROM users u WHERE u.tenant_id = t.id AND u.role = 'admin' ORDER BY u.id LIMIT 1) AS owner_email
  FROM tenants t`;

/** GET /tenants */
export const listTenants = async (req, res) => {
  try {
    const r = await getPool().query(`${TENANT_LIST_SQL} ORDER BY t.id`);
    // Each brokerage's billing state (trial, active, grace, paused), for the console.
    const billing = await getPool().query("SELECT id, settings->'billing' AS billing FROM tenants");
    const byId = new Map(billing.rows.map((b) => [Number(b.id), b.billing || null]));
    for (const row of r.rows) {
      const b = Number(row.id) === DEFAULT_TENANT_ID ? null : byId.get(Number(row.id));
      row.billing = b ? {
        status: b.status || null, suspended: b.suspended === true, trial_ends_at: b.trial_ends_at || null,
        grace_ends_at: b.grace_ends_at || null, current_period_end: b.current_period_end || null,
        seats_billed: b.seats_billed ?? null, has_subscription: !!b.subscription,
      } : null;
    }
    return res.json({ success: true, data: r.rows });
  } catch (error) {
    logger.error('listTenants error', error);
    return res.status(500).json({ error: 'Could not list brokerages' });
  }
};

async function domainTaken(pool, domain, exceptId = null) {
  const r = await pool.query(
    `SELECT 1 FROM tenants WHERE LOWER(REGEXP_REPLACE(primary_domain, '^www\\.', '')) = $1 AND id IS DISTINCT FROM $2
     UNION ALL
     SELECT 1 FROM users WHERE custom_domain IN ($1, 'www.' || $1) AND domain_verified_at IS NOT NULL
     LIMIT 1`,
    [domain, exceptId]
  );
  return r.rows.length > 0;
}

/** POST /tenants { name, slug, primary_domain?, owner_name, owner_email } */
export const createTenant = async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 255);
  const slug = String(b.slug || '').trim().toLowerCase();
  const domain = normalizeDomain(b.primary_domain);
  const ownerName = String(b.owner_name || '').trim().slice(0, 255);
  const ownerEmail = String(b.owner_email || '').trim().toLowerCase();

  if (!name) return res.status(400).json({ error: 'Brokerage name is required' });
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
    return res.status(400).json({ error: 'Short name must be lowercase letters, numbers and dashes' });
  }
  if (domain && !DOMAIN_RE.test(domain)) return res.status(400).json({ error: 'That domain doesn’t look right' });
  if (!domain && !process.env.PLATFORM_BASE_DOMAIN && !process.env.PLATFORM_DOMAIN) {
    return res.status(400).json({ error: 'Give the brokerage a domain so its invite link has somewhere to go' });
  }
  if (!ownerName) return res.status(400).json({ error: 'Owner name is required' });
  if (!EMAIL_RE.test(ownerEmail)) return res.status(400).json({ error: 'Owner email is required' });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const dupSlug = await client.query('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
    if (dupSlug.rows[0]) return res.status(409).json({ error: 'That short name is taken' });
    if (domain && (await domainTaken(client, domain))) {
      return res.status(409).json({ error: 'That domain already belongs to a brokerage or agent' });
    }

    await client.query('BEGIN');
    const t = await client.query(
      `INSERT INTO tenants (slug, name, primary_domain, market_key)
       VALUES ($1, $2, $3, COALESCE($4, 'noco'))
       RETURNING id, slug, name, primary_domain, market_key, status, settings, created_at`,
      [slug, name, domain || null, b.market_key ? String(b.market_key).slice(0, 32) : null]
    );
    const tenant = t.rows[0];
    const owner = await client.query(
      `INSERT INTO users (email, name, role, status, manage_token, tenant_id, last_active_at)
       VALUES ($1, $2, 'admin', 'active', $3, $4, NOW())
       RETURNING id, email, name, role, tenant_id`,
      [ownerEmail, ownerName, crypto.randomBytes(24).toString('hex'), tenant.id]
    );
    await client.query('COMMIT');
    clearTenantCache();

    await issueAccountLink({ user: owner.rows[0], purpose: 'invite', tenant, pool });
    logger.info('brokerage created', { tenant_id: tenant.id, slug, by: req.user?.email });
    const { settings, ...data } = tenant;
    return res.status(201).json({ success: true, data: { ...data, owner_email: ownerEmail }, invited: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('createTenant error', error);
    return res.status(500).json({ error: 'Could not create the brokerage' });
  } finally {
    client.release();
  }
};

/** PATCH /tenants/:id { name?, primary_domain?, status? } */
export const patchTenant = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid brokerage' });
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const add = (sql, v) => { vals.push(v); sets.push(`${sql} = $${vals.length}`); };

  if (b.name !== undefined) {
    const name = String(b.name).trim().slice(0, 255);
    if (!name) return res.status(400).json({ error: 'Brokerage name is required' });
    add('name', name);
  }
  if (b.status !== undefined) {
    if (!['active', 'suspended'].includes(b.status)) return res.status(400).json({ error: 'Status must be active or suspended' });
    if (id === DEFAULT_TENANT_ID && b.status !== 'active') {
      return res.status(400).json({ error: 'The home brokerage can’t be suspended' });
    }
    add('status', b.status);
  }
  try {
    const pool = getPool();
    if (b.primary_domain !== undefined) {
      const domain = normalizeDomain(b.primary_domain);
      if (domain && !DOMAIN_RE.test(domain)) return res.status(400).json({ error: 'That domain doesn’t look right' });
      if (domain && (await domainTaken(pool, domain, id))) {
        return res.status(409).json({ error: 'That domain already belongs to a brokerage or agent' });
      }
      add('primary_domain', domain || null);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to change' });
    vals.push(id);
    const r = await pool.query(
      `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, slug, name, primary_domain, market_key, status, created_at`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Brokerage not found' });
    clearTenantCache();
    logger.info('brokerage updated', { tenant_id: id, fields: Object.keys(b), by: req.user?.email });
    return res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    logger.error('patchTenant error', error);
    return res.status(500).json({ error: 'Could not update the brokerage' });
  }
};
