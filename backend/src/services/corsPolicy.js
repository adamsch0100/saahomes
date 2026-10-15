/**
 * Which origins a browser may call the API from, with cookies.
 *
 * A page on one of our own hosts may call the API with credentials:
 *   - the host the request came in on (the site calling its own API)
 *   - any brokerage's known hosts: its custom domain and its platform
 *     subdomain (resolved the same way the tenant middleware resolves a Host
 *     header, and cached with it), and a verified agent domain
 *   - the platform's marketing domain and its base domain
 *   - the home site's fixed addresses (FRONTEND_URL, the Railway domain; the
 *     Vite dev server in development)
 * Anything else gets no Access-Control-Allow-Origin header at all.
 *
 * The widgets other sites paste in (/embed.js, /embed/*) and the view beacon
 * they send answer any origin, without credentials. Webhooks (Stripe, Twilio,
 * Follow Up Boss) come from servers, not browsers: no Origin, no CORS.
 */
import { resolveTenantForHost, platformBaseDomain } from './tenantContext.js';
import { refreshPlatformIdentity, isPlatformHost } from './platform.js';

// Widgets other sites load, and the beacon they send: any origin, no cookies.
export const OPEN_CORS_PATHS = /^\/(embed\.js$|embed\/|api\/embed\/)/;

// Fixed addresses of the home site, as before brokerages had their own hosts.
const FIXED_ORIGINS = new Set(process.env.NODE_ENV === 'production'
  ? [
      'https://saahomes.com',
      'https://www.saahomes.com',
      process.env.FRONTEND_URL,
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
    ].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']);

const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/\.+$/, '').replace(/^www\./, '');

/** True when the origin is a page on one of our own hosts. */
export async function originAllowed(req, origin) {
  if (FIXED_ORIGINS.has(origin)) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  // Our hosts are https; a plain http origin only counts where the request
  // itself is plain http (development, tests).
  if (url.protocol !== 'https:' && url.protocol !== `${req.protocol}:`) return false;
  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (host === String(req.hostname || '').toLowerCase().replace(/\.+$/, '')) return true;
  try {
    await refreshPlatformIdentity();
    if (isPlatformHost(host)) return true;
    const base = platformBaseDomain();
    if (base && bareHost(host) === base) return true;
    // site_host is set only when the host matched a tenant's own domain or
    // subdomain; an unknown host falls back to the home tenant without it.
    const tenant = await resolveTenantForHost(host);
    return !!tenant?.site_host;
  } catch {
    // No database: only the fixed addresses and the request's own host.
    return false;
  }
}

/** Options for the cors middleware, per request. */
export async function corsOptionsFor(req) {
  if (OPEN_CORS_PATHS.test(req.path)) return { origin: '*', credentials: false };
  const origin = req.get('origin');
  if (!origin) return { origin: false };
  return (await originAllowed(req, origin))
    ? { origin, credentials: true }
    : { origin: false };
}
