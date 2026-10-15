/**
 * A brokerage that has no web address yet (no domain, no free subdomain)
 * runs its console on the platform's own site: /admin?brokerage=<slug>.
 * The slug is remembered on this device and sent as X-Brokerage on staff API
 * calls only (/api/admin, /api/account, /api/agent). The server still checks
 * that the signed-in token belongs to that brokerage.
 *
 * Never used on a brokerage's own domain.
 */
import { isCustomDomain } from './tenant.js';

const KEY = 'consoleBrokerage';
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const STAFF_API = /^\/api\/(admin|account|agent)(\/|$|\?)/;

function read() {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

/** The brokerage this platform-site console is for, or null. */
export function consoleBrokerage() {
  if (typeof window === 'undefined' || isCustomDomain()) return null;
  try {
    const consolePage = /^\/(admin|agent|reset-password)\/?$/.test(window.location.pathname);
    const fromUrl = consolePage ? new URLSearchParams(window.location.search).get('brokerage') : null;
    if (fromUrl && SLUG_RE.test(fromUrl)) {
      localStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
  } catch {
    /* storage off: fall through */
  }
  const saved = read();
  return saved && SLUG_RE.test(saved) ? saved : null;
}

export function clearConsoleBrokerage() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('brokerage')) {
      params.delete('brokerage');
      const q = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash);
    }
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

let installed = false;

/**
 * Add X-Brokerage to this site's own staff API calls (every console screen,
 * whichever way it calls the API) while a brokerage console is open here.
 * A no-op everywhere else.
 */
export function installConsoleFetch() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input?.url || String(input), window.location.href);
    } catch {
      return original(input, init);
    }
    if (url.origin !== window.location.origin || !STAFF_API.test(url.pathname)) return original(input, init);
    const slug = consoleBrokerage();
    if (!slug) return original(input, init);
    const headers = new Headers((init && init.headers) || (typeof input !== 'string' && input?.headers) || undefined);
    headers.set('X-Brokerage', slug);
    return original(input, { ...(init || {}), headers });
  };
}

/**
 * The one-time code signup hands to a console on another host (/admin#h=<code>):
 * take it out of the address bar at once and return it, or null. The code is
 * traded for a sign-in with POST /api/signup/handoff and works once; the
 * sign-in itself never rides in a URL.
 */
export function takeHandoffCode() {
  if (typeof window === 'undefined') return null;
  const m = /(?:^#|&)h=([A-Za-z0-9._-]+)/.exec(window.location.hash || '');
  if (!m) return null;
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
  return m[1];
}
