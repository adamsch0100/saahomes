/**
 * Custom-domain tenant lookup (P-2b).
 *
 * saahomes.com / localhost never fetch — SAA brand stays byte-identical.
 * On any other host, GET /api/tenant once per session. Network failure
 * returns null so chrome keeps rendering today's SAA brand.
 */

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
  const host = (hostname != null ? String(hostname) : currentHostname())
    .split(':')[0]
    .trim()
    .toLowerCase();
  if (!host) return false;
  return !OWN_HOSTS.has(host);
}

async function fetchTenant() {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
    const res = await fetch('/api/tenant', {
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
  if (!isCustomDomain()) return null;
  if (sessionCache !== undefined) return sessionCache;
  if (inflight) return inflight;
  inflight = fetchTenant()
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
