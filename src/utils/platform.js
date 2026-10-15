/**
 * The platform's own identity: the product brokerages sign up for (its name,
 * domains, support address, logo and colors), as distinct from any one
 * brokerage. Signup, the console chrome on the platform's own site and the
 * platform owner's settings read it from here.
 *
 * Platform pages carry it in the page itself (<script id="platform-identity">,
 * written by the server), so they render with the right name at once; other
 * pages ask GET /api/platform once per session.
 */
import { useEffect, useState } from 'react';

let sessionCache;
let inflight = null;

/** The identity the server wrote into this page, or null. */
export function embeddedPlatform() {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('platform-identity');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || 'null');
  } catch {
    return null;
  }
}

/** True on the platform's own marketing domain (the server marks its pages). */
export function isPlatformSite() {
  return embeddedPlatform()?.is_platform_host === true;
}

export async function getPlatform() {
  const embedded = embeddedPlatform();
  if (embedded) return embedded;
  if (sessionCache !== undefined) return sessionCache;
  if (inflight) return inflight;
  inflight = fetch('/api/platform', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      sessionCache = body?.data || null;
      return sessionCache;
    })
    .catch(() => {
      sessionCache = null;
      return null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * The platform's identity, or null until it has loaded (show nothing branded
 * meanwhile, never SAA's name). enabled=false skips the request.
 */
export function usePlatform(enabled = true) {
  const [platform, setPlatform] = useState(() => embeddedPlatform() || sessionCache || null);
  useEffect(() => {
    if (!enabled || platform) return undefined;
    let cancelled = false;
    getPlatform().then((p) => {
      if (!cancelled) setPlatform(p);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, platform]);
  return enabled ? platform : null;
}

export default { getPlatform, usePlatform, isPlatformSite, embeddedPlatform };
