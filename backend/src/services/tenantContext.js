/**
 * Which brokerage a request belongs to, and the walls between brokerages.
 *
 * Every request is resolved to one tenant from its host:
 *   1. tenants.primary_domain (with or without www.)
 *   2. <slug>.<PLATFORM_BASE_DOMAIN> (or PLATFORM_DOMAIN) when set: the free
 *      address every brokerage gets at signup
 *   3. a verified agent custom domain (users.custom_domain), which belongs to
 *      that agent's tenant and attributes signups to the agent
 *   4. otherwise the default tenant (SAA Homes, id 1), so saahomes.com,
 *      localhost and the Railway domain keep working unchanged
 * A suspended brokerage still resolves (so its domains never fall through to
 * SAA), and the middleware answers 503 for it. One paused for an unpaid bill
 * still lets its owner sign in and pay (BILLING_OPEN_PATHS).
 *
 * A brokerage with no address yet (no domain, no platform base domain) runs
 * its console on the platform's own host: staff API calls there name it in an
 * X-Brokerage header (CONSOLE_PATHS only; the staff token must still belong
 * to it).
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
const byId = new Map(); // tenant id → { at, tenant }

export function clearTenantCache() {
  cache.clear();
  byId.clear();
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

/** The base domain brokerages get free subdomains on, or '' when not set up. */
export function platformBaseDomain() {
  return normalizeHost(process.env.PLATFORM_BASE_DOMAIN || process.env.PLATFORM_DOMAIN);
}

function shape(row, agent = null, siteHost = null) {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    primary_domain: row.primary_domain || null,
    market_key: row.market_key || 'noco',
    status: row.status || 'active',
    settings: row.settings || {},
    agent, // { id, name } when the host is one agent's own domain
    // The host this request matched, when it is a known domain of this
    // tenant. Links in emails use it, never a raw Host header.
    site_host: siteHost,
  };
}

const TENANT_COLS = 'id, slug, name, primary_domain, market_key, status, settings';

async function lookup(pool, hostname) {
  const bare = hostname.replace(/^www\./, '');
  if (bare) {
    const byDomain = await pool.query(
      `SELECT ${TENANT_COLS} FROM tenants
       WHERE LOWER(REGEXP_REPLACE(primary_domain, '^www\\.', '')) = $1
       ORDER BY id LIMIT 1`,
      [bare]
    );
    if (byDomain.rows[0]) return shape(byDomain.rows[0], null, hostname);
  }

  const platform = platformBaseDomain();
  if (platform && hostname.endsWith(`.${platform}`)) {
    const slug = hostname.slice(0, -(platform.length + 1));
    if (/^[a-z0-9-]{1,64}$/.test(slug)) {
      const bySlug = await pool.query(
        `SELECT ${TENANT_COLS} FROM tenants WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      if (bySlug.rows[0]) return shape(bySlug.rows[0], null, hostname);
    }
  }

  if (bare) {
    const byAgent = await pool.query(
      `SELECT t.id, t.slug, t.name, t.primary_domain, t.market_key, t.status, t.settings,
              u.id AS agent_id, u.name AS agent_name
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.custom_domain IN ($1, $2) AND u.domain_verified_at IS NOT NULL
         AND u.status = 'active' AND u.role IN ('agent', 'admin')
       ORDER BY u.id LIMIT 1`,
      [bare, `www.${bare}`]
    );
    const r = byAgent.rows[0];
    if (r) return shape(r, { id: Number(r.agent_id), name: r.agent_name || null }, hostname);
  }

  const fallback = await pool.query(`SELECT ${TENANT_COLS} FROM tenants WHERE id = $1`, [DEFAULT_TENANT_ID]);
  return fallback.rows[0]
    ? shape(fallback.rows[0])
    : shape({ id: DEFAULT_TENANT_ID, slug: 'saa', name: 'SAA Homes' });
}

/**
 * The site address for links in emails: the domain this request came in on
 * when it is one of the tenant's own, else the tenant's primary domain. An
 * unknown Host header never ends up in a link (no reset-link poisoning).
 */
export function siteUrlFor(tenant) {
  if (tenant?.site_host) return `https://${tenant.site_host}`;
  if (tenant?.primary_domain) return `https://${tenant.primary_domain}`;
  const platform = platformBaseDomain();
  if (platform && tenant?.slug && tenant.id !== DEFAULT_TENANT_ID) return `https://${tenant.slug}.${platform}`;
  return (process.env.SITE_URL || 'https://saahomes.com').replace(/\/$/, '');
}

/** True when a brokerage has an address of its own (a domain or a platform subdomain). */
export function hasOwnAddress(tenant) {
  if (!tenant || tenant.id === DEFAULT_TENANT_ID) return true;
  return !!(tenant.site_host || tenant.primary_domain || platformBaseDomain());
}

/**
 * A link into a brokerage's staff pages (/admin, /agent, /reset-password):
 * on its own site, or, before it has an address, on the platform's host with
 * ?brokerage=<slug> so the console knows whose it is.
 */
export function consoleUrlFor(tenant, path = '/admin') {
  const base = siteUrlFor(tenant);
  if (hasOwnAddress(tenant)) return `${base}${path}`;
  const sep = path.includes('?') ? '&' : '?';
  const [p, hash] = path.split('#');
  return `${base}${p}${sep}brokerage=${encodeURIComponent(tenant.slug)}${hash ? `#${hash}` : ''}`;
}

/**
 * A tenant by id, cached for a minute: for jobs and emails that start from a
 * row (a user, a saved search) rather than a request.
 */
export async function tenantById(id, { pool = getPool() } = {}) {
  const key = Number(id) || DEFAULT_TENANT_ID;
  const hit = byId.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.tenant;
  const r = await pool.query(`SELECT ${TENANT_COLS} FROM tenants WHERE id = $1`, [key]);
  const tenant = r.rows[0]
    ? shape(r.rows[0])
    : shape({ id: DEFAULT_TENANT_ID, slug: 'saa', name: 'SAA Homes', primary_domain: 'saahomes.com' });
  byId.set(key, { at: Date.now(), tenant });
  return tenant;
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

// Staff APIs a brokerage without an address reaches on the platform's host.
const CONSOLE_PATHS = /^\/api\/(admin|account|agent)(\/|$)/;

// What still answers for a brokerage paused for an unpaid bill: its brand,
// sign-in, and billing, so the owner can pay and bring the site back.
const BILLING_OPEN_PATHS = [
  /^\/api\/tenant(\/asset\/[^/]+)?$/,
  /^\/api\/admin\/login$/,
  /^\/api\/account\//,
  /^\/api\/admin\/billing(\/|$)/,
  /^\/api\/admin\/setup$/,
];

/** True when a brokerage was paused by billing (not by the platform owner). */
export function pausedForBilling(tenant) {
  return tenant?.status === 'suspended' && tenant?.settings?.billing?.suspended === true
    && (tenant?.id ?? DEFAULT_TENANT_ID) !== DEFAULT_TENANT_ID;
}

export function billingOpenPath(path) {
  return BILLING_OPEN_PATHS.some((re) => re.test(String(path || '').split('?')[0]));
}

/** The brokerage named by X-Brokerage on the platform host, or null. */
const CONSOLE_ASSET_PATH = /^\/api\/tenant\/asset\/[^/?]+(\?|$)/;

async function consoleTenant(req, hostTenant, pool = getPool()) {
  // Its logo and icon (public anyway) by ?brokerage=, so they show there too.
  const asset = req.method === 'GET' && CONSOLE_ASSET_PATH.test(String(req.originalUrl || ''));
  const slug = String((asset ? req.query?.brokerage : req.get?.('x-brokerage')) || '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  if ((hostTenant?.id ?? DEFAULT_TENANT_ID) !== DEFAULT_TENANT_ID || hostTenant?.agent) return null;
  if (!asset && !CONSOLE_PATHS.test(String(req.originalUrl || ''))) return null;
  const r = await pool.query(`SELECT ${TENANT_COLS} FROM tenants WHERE slug = $1 AND id <> $2 LIMIT 1`, [slug, DEFAULT_TENANT_ID]);
  return r.rows[0] ? shape(r.rows[0]) : null;
}

/** Express middleware: sets req.tenant and the async tenant context. */
export function tenantMiddleware(req, res, next) {
  return resolveTenantForHost(req.hostname)
    .then(async (tenant) => (await consoleTenant(req, tenant)) || tenant)
    .catch((err) => {
      logger.error('tenant resolution failed', { host: req.hostname, message: err.message });
      return shape({ id: DEFAULT_TENANT_ID, slug: 'saa', name: 'SAA Homes' });
    })
    .then((tenant) => {
      req.tenant = tenant;
      // A paused brokerage's domains answer, but serve nothing. (They don't
      // fall through to the home brokerage, where signups would land in the
      // wrong place.)
      if (tenant.status !== 'active' && !(pausedForBilling(tenant) && billingOpenPath(req.originalUrl))) {
        return res.status(503).json({ error: 'This site is paused. Please contact the brokerage.' });
      }
      return als.run({ tenant }, () => next());
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
