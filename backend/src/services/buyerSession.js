/**
 * The signed-in buyer for a request: one lookup, always inside the request's
 * brokerage. A manage token or session cookie from one brokerage never finds
 * anyone at another.
 */
import getPool from '../config/database.js';
import { tenantIdOf } from './tenantContext.js';

export const COOKIE_NAME = 'saa_user_token';

/**
 * A Secure cookie never reaches an http host, so a site tried on plain http
 * (a brokerage's test domain, a local build) could sign up but never stay
 * signed in. Secure only when this request really came in over https
 * (directly, or via the proxy; trust proxy is set in server.js).
 */
export function cookieSecure(req) {
  if (!req) return false;
  if (req.secure) return true;
  const proto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

/** Active user with this manage token in this tenant, or null. */
export async function findUserByToken(token, tenantId, pool = getPool()) {
  if (!token || typeof token !== 'string' || token.length < 16 || token.length > 80) return null;
  const r = await pool.query(
    "SELECT * FROM users WHERE manage_token = $1 AND tenant_id = $2 AND status = 'active'",
    [token, tenantId]
  );
  return r.rows[0] || null;
}

/** Resolve the buyer from ?token=, the session cookie, or a body token. */
export async function resolveUser(req, pool = getPool()) {
  const tenantId = tenantIdOf(req);
  const qToken = req.query?.token;
  if (qToken) {
    const u = await findUserByToken(String(qToken), tenantId, pool);
    if (u) return u;
  }
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return findUserByToken(String(cookieToken), tenantId, pool);
  const bodyToken = req.body?.token;
  if (bodyToken) return findUserByToken(String(bodyToken), tenantId, pool);
  return null;
}

/** The session cookie's user only (no ?token=), or null. */
export async function sessionUser(req, pool = getPool()) {
  const token = req?.cookies?.[COOKIE_NAME];
  return token ? findUserByToken(String(token), tenantIdOf(req), pool) : null;
}
