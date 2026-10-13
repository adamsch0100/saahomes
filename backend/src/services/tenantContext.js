/**
 * Which brokerage a request belongs to, and the walls between brokerages.
 *
 * Every request is resolved to one tenant from its host:
 *   1. tenants.primary_domain (with or without www.)
 *   2. <slug>.<PLATFORM_DOMAIN> when PLATFORM_DOMAIN is set
 *   3. a verified agent custom domain (users.custom_domain), which belongs to
 *      that agent's tenant and attributes signups to the agent
 *   4. otherwise the default tenant (SAA Homes, id 1), so saahomes.com,
 *      localhost and the Railway domain keep working unchanged
 *
 * Controllers read req.tenant; deeper services can call currentTenantId(),
 * which reads the same value from AsyncLocalStorage. Background jobs have no
 * request, so they pass a tenant id explicitly.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';

export const DEFAULT_TENANT_ID = 1;
const CACHE_MS = 60 * 1000;
const LEAD_VISIBILITY = ['own', 'own_and_unassigned', 'all'];

const als = new AsyncLocalStorage();
const cache = new Map(); // hostname → { at, tenant }

export function clearTenantCache() {
  cache.clear();
}

/** The tenant of the request being served, or null outside a request. */
export function currentTenant() {
  return als.getStore()?.tenant || null;
}

/** Tenant id for a request (or the current async context), default SAA. */
export function tenantIdOf(req) {
  const id = req?.tenant?.id ?? currentTenant()?.id;
  return Number.isInteger(id) ? id : DEFAULT_TENANT_ID;
}

export function currentTenantId() {
  return tenantIdOf(null);
}

/**
 * Switch the rest of this async call chain to another tenant: a public POST
 * that names its brokerage itself (an agent's webform on the agent's own site).
 */
export function enterTenant(tenantId) {
  const tenant = currentTenant();
  als.enterWith({ tenant: { ...(tenant || {}), id: Number(tenantId), agent: null } });
}

/** Run fn with tenant as the current tenant (jobs, tests). */
export function runWithTenant(tenant, fn) {
  return als.run({ tenant }, fn);
}

/**
 * Which leads an agent sees: 'own', 'own_and_unassigned' (default, a shared
 * pond) or 'all'. Owners and admins always see every lead in their tenant.
 */
export function leadVisibility(tenant) {
  const v = String(tenant?.settings?.lead_visibility || '').trim();
  return LEAD_VISIBILITY.includes(v) ? v : 'own_and_unassigned';
}

function normalizeHost(host) {
  return String(host || '').split(':')[0].trim().toLowerCase().replace(/\.+$/, '');
}

function shape(row, agent = null) {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    primary_domain: row.primary_domain || null,
    market_key: row.market_key || 'noco',
    status: row.status || 'active',
    settings: row.settings || {},
    agent, // { id, name } when the host is one agent's own domain
  };
}

const TENANT_COLS = 'id, slug, name, primary_domain, market_key, status, settings';

async function lookup(pool, hostname) {
  const bare = hostname.replace(/^www\./, '');
  if (bare) {
    const byDomain = await pool.query(
      `SELECT ${TENANT_COLS} FROM tenants
       WHERE status = 'active' AND LOWER(REGEXP_REPLACE(primary_domain, '^www\\.', '')) = $1
       ORDER BY id LIMIT 1`,
      [bare]
    );
    if (byDomain.rows[0]) return shape(byDomain.rows[0]);
  }

  const platform = normalizeHost(process.env.PLATFORM_DOMAIN);
  if (platform && hostname.endsWith(`.${platform}`)) {
    const slug = hostname.slice(0, -(platform.length + 1));
    if (/^[a-z0-9-]{1,64}$/.test(slug)) {
      const bySlug = await pool.query(
        `SELECT ${TENANT_COLS} FROM tenants WHERE status = 'active' AND slug = $1 LIMIT 1`,
        [slug]
      );
      if (bySlug.rows[0]) return shape(bySlug.rows[0]);
    }
  }

  if (bare) {
    const byAgent = await pool.query(
      `SELECT t.id, t.slug, t.name, t.primary_domain, t.market_key, t.status, t.settings,
              u.id AS agent_id, u.name AS agent_name
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.custom_domain IN ($1, $2) AND u.domain_verified_at IS NOT NULL
         AND u.status = 'active' AND u.role IN ('agent', 'admin') AND t.status = 'active'
       ORDER BY u.id LIMIT 1`,
      [bare, `www.${bare}`]
    );
    const r = byAgent.rows[0];
    if (r) return shape(r, { id: Number(r.agent_id), name: r.agent_name || null });
  }

  const fallback = await pool.query(`SELECT ${TENANT_COLS} FROM tenants WHERE id = $1`, [DEFAULT_TENANT_ID]);
  return fallback.rows[0]
    ? shape(fallback.rows[0])
    : shape({ id: DEFAULT_TENANT_ID, slug: 'saa', name: 'SAA Homes' });
}

/** Resolve a host to its tenant, cached for a minute. */
export async function resolveTenantForHost(host, { pool = getPool() } = {}) {
  const hostname = normalizeHost(host);
  const hit = cache.get(hostname);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.tenant;
  const tenant = await lookup(pool, hostname);
  cache.set(hostname, { at: Date.now(), tenant });
  return tenant;
}

/** Express middleware: sets req.tenant and the async tenant context. */
export function tenantMiddleware(req, res, next) {
  resolveTenantForHost(req.hostname)
    .catch((err) => {
      logger.error('tenant resolution failed', { host: req.hostname, message: err.message });
      return shape({ id: DEFAULT_TENANT_ID, slug: 'saa', name: 'SAA Homes' });
    })
    .then((tenant) => {
      req.tenant = tenant;
      als.run({ tenant }, () => next());
    });
}

/**
 * The tenant a staff token belongs to. Tokens issued before tenants existed
 * carry no tenant_id and belong to SAA. Platform tokens (the env admin login)
 * may act in any tenant.
 */
export function tokenTenantId(user) {
  const id = Number(user?.tenant_id);
  return Number.isInteger(id) && id > 0 ? id : DEFAULT_TENANT_ID;
}

export function tokenMatchesTenant(user, tenant) {
  if (!user) return false;
  if (user.platform === true) return true;
  return tokenTenantId(user) === (tenant?.id ?? DEFAULT_TENANT_ID);
}
