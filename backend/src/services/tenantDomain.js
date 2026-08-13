/**
 * Custom-domain resolution + DNS TXT verification (P-2b).
 *
 * Verification is REAL DNS only — no bypass, no test-mode success flag.
 * A domain is "live" only when domain_verified_at is set after a TXT
 * record `saa-verify=<token>` is found on the hostname.
 */
import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';

const DNS_TIMEOUT_MS = 5000;
const TXT_PREFIX = 'saa-verify=';

/** Hostname: labels of letters/digits/hyphens, dots between. No wildcards. */
const HOSTNAME_RE =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const RESERVED_HOSTS = new Set(['saahomes.com', 'www.saahomes.com']);

export const DOMAIN_SELECT_COLS =
  'custom_domain, domain_verified_at, domain_verify_token';

/**
 * Normalize a user-supplied domain to a bare hostname.
 * Strips scheme, path, port, credentials, trailing dots. Lowercases.
 * @param {unknown} input
 * @returns {string|null}
 */
export function normalizeDomain(input) {
  if (input == null) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');

  const cut = s.search(/[/?#]/);
  if (cut !== -1) s = s.slice(0, cut);

  const at = s.lastIndexOf('@');
  if (at !== -1) s = s.slice(at + 1);

  s = s.replace(/:\d+$/, '').replace(/\.+$/, '').trim();
  if (!s || s.includes('*') || /\s/.test(s)) return null;
  if (!HOSTNAME_RE.test(s)) return null;
  return s;
}

export function isReservedHost(hostname) {
  const h = String(hostname || '').trim().toLowerCase().split(':')[0];
  return RESERVED_HOSTS.has(h);
}

export function generateVerifyToken() {
  return randomBytes(16).toString('hex');
}

export function txtRecordValue(token) {
  return `${TXT_PREFIX}${token}`;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('DNS timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Real DNS TXT lookup. True only when a record equals `saa-verify=<token>`.
 * NXDOMAIN, timeout, and any resolver error → false. Never throws.
 * @param {string} domain
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function verifyDomainTxt(domain, token) {
  const host = normalizeDomain(domain);
  const tok = String(token || '').trim();
  if (!host || !tok) return false;
  const expected = txtRecordValue(tok);
  try {
    const records = await withTimeout(resolveTxt(host), DNS_TIMEOUT_MS);
    const values = (records || []).map((chunks) =>
      (Array.isArray(chunks) ? chunks.join('') : String(chunks || ''))
        .trim()
        .replace(/^"+|"+$/g, '')
    );
    return values.includes(expected);
  } catch {
    return false;
  }
}

/**
 * Resolve a request Host to a verified, active agent/admin row.
 * Strips port. Exact-match on users.custom_domain.
 * @param {import('pg').Pool|import('pg').PoolClient} pool
 * @param {string} host
 * @returns {Promise<object|null>}
 */
export async function resolveTenantByHost(pool, host) {
  if (!pool) return null;
  const hostname = String(host || '').split(':')[0].trim().toLowerCase();
  if (!hostname || isReservedHost(hostname)) return null;

  const result = await pool.query(
    `SELECT id, email, name, phone, role, status, created_at, last_active_at,
            brand_name, brokerage_name, brand_phone, voice_style, market_key,
            custom_domain, domain_verified_at
     FROM users
     WHERE custom_domain = $1
       AND domain_verified_at IS NOT NULL
       AND status = 'active'
       AND role IN ('agent', 'admin')
     LIMIT 1`,
    [hostname]
  );
  return result.rows[0] || null;
}

export default {
  normalizeDomain,
  isReservedHost,
  generateVerifyToken,
  txtRecordValue,
  verifyDomainTxt,
  resolveTenantByHost,
  DOMAIN_SELECT_COLS,
};
