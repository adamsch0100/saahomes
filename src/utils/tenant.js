/**
 * Custom-domain tenant lookup (P-2b).
 *
 * saahomes.com / localhost never fetch — SAA brand stays byte-identical.
 * On any other host, GET /api/tenant once per session. Network failure
 * returns null so chrome keeps rendering today's SAA brand.
 *
 * The platform's own marketing domain counts as the platform's host, not a
 * brokerage's. There, and on saahomes.com, a brokerage console opened with
 * ?brokerage=<slug> (a brokerage with no address yet) wears that brokerage's
 * brand: GET /api/tenant?brokerage=<slug>.
 */
import { isPlatformSite } from './platform.js';
import { consoleBrokerage } from './consoleBrokerage.js';

const OWN_HOSTS = new Set([
  'saahomes.com',
  'www.saahomes.com',
  'localhost',
  '127.0.0.1',
  '::1',
]);

let sessionCache;
let inflight = null;

function currentHostname() {
  if (typeof window === 'undefined') return '';
  return String(window.location.hostname || '').split(':')[0].trim().toLowerCase();
}

export function isCustomDomain(hostname) {
  if (hostname == null && isPlatformSite()) return false;
  const host = (hostname != null ? String(hostname) : currentHostname())
    .split(':')[0]
    .trim()
    .toLowerCase();
  if (!host) return false;
  return !OWN_HOSTS.has(host);
}

const CONSOLE_PAGE = /^\/(admin|agent|reset-password)\/?$/;

/** On the platform's own host, the brokerage a console page is for, or null. */
export function consoleTenantSlug() {
  if (typeof window === 'undefined' || isCustomDomain()) return null;
  if (!CONSOLE_PAGE.test(window.location.pathname)) return null;
  return consoleBrokerage();
}

async function fetchTenant(slug = null) {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
    const res = await fetch(slug ? `/api/tenant?brokerage=${encodeURIComponent(slug)}` : '/api/tenant', {
      credentials: 'same-origin',
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.tenant || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the current host to a tenant brand payload.
 * @returns {Promise<object|null>}
 */
export async function getTenant() {
  const slug = consoleTenantSlug();
  if (!isCustomDomain() && !slug) return null;
  if (sessionCache !== undefined) return sessionCache;
  if (inflight) return inflight;
  inflight = fetchTenant(slug)
    .then((tenant) => {
      sessionCache = tenant;
      return tenant;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export default { getTenant, isCustomDomain };
