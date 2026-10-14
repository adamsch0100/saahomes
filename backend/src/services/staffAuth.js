/**
 * Staff sign-in with optional two-step verification.
 *
 * A staff account is a users row (brokerage admins and agents) or the
 * platform owner (the env admin login, which has no row; its second factor
 * lives in app_settings). After the password checks out, finishLogin either
 * hands back the session token or, when two-step is on, a short-lived
 * challenge that /api/account/2fa/verify trades for the token.
 *
 * Challenges are signed with a key derived from JWT_SECRET but different
 * from it, so a challenge can never pass as a session token.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import getPool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { tenantById } from './tenantContext.js';

const PLATFORM_KEY = 'platform_owner_2fa';
const CHALLENGE_TTL = '5m';

function challengeSecret() {
  return crypto.createHash('sha256').update(`2fa-challenge:${process.env.JWT_SECRET || ''}`).digest('hex');
}

/** Which account a token or login belongs to: { platform: true } or { id, tenant_id }. */
export function accountOf(user) {
  if (user?.platform === true) return { platform: true };
  return { id: Number(user.id), tenant_id: Number(user.tenant_id) || 1 };
}

const EMPTY = { secret_enc: null, pending_enc: null, enabled_at: null, last_step: null, recovery_hashes: [] };

/** The two-step factor for an account (always an object). */
export async function loadFactor(account, pool = getPool()) {
  if (account.platform) {
    const r = await pool.query('SELECT value FROM app_settings WHERE key = $1', [PLATFORM_KEY]);
    return { ...EMPTY, ...(r.rows[0]?.value || {}) };
  }
  const r = await pool.query(
    `SELECT totp_secret_enc AS secret_enc, totp_pending_enc AS pending_enc, totp_enabled_at AS enabled_at,
            totp_last_step AS last_step, totp_recovery_hashes AS recovery_hashes
     FROM users WHERE id = $1 AND tenant_id = $2`,
    [account.id, account.tenant_id]
  );
  if (!r.rows[0]) return null;
  return { ...EMPTY, ...r.rows[0], recovery_hashes: r.rows[0].recovery_hashes || [] };
}

/** Write a whole factor back (fields as loadFactor returns them). */
export async function saveFactor(account, f, pool = getPool()) {
  if (account.platform) {
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [PLATFORM_KEY, JSON.stringify(f)]
    );
    return;
  }
  await pool.query(
    `UPDATE users SET totp_secret_enc = $1, totp_pending_enc = $2, totp_enabled_at = $3,
            totp_last_step = $4, totp_recovery_hashes = $5
     WHERE id = $6 AND tenant_id = $7`,
    [f.secret_enc, f.pending_enc, f.enabled_at, f.last_step, f.recovery_hashes, account.id, account.tenant_id]
  );
}

export const factorEnabled = (f) => !!(f && f.enabled_at && f.secret_enc);

/**
 * Finish a password login: the session token, or a two-step challenge.
 * payload is what the session token will carry; body is the rest of the
 * login response (e.g. { success: true, data }).
 */
export async function finishLogin(res, { payload, body, pool = getPool() }) {
  const account = accountOf(payload);
  const factor = await loadFactor(account, pool);
  if (factorEnabled(factor)) {
    const challenge = jwt.sign({ kind: '2fa', a: account, p: payload, b: body }, challengeSecret(), {
      expiresIn: CHALLENGE_TTL,
    });
    return res.json({ success: true, needs_2fa: true, challenge });
  }
  // A brokerage that requires two-step sign-in: this session can only set it up.
  if (!account.platform) {
    const tenant = await tenantById(account.tenant_id, { pool });
    if (tenant?.settings?.require_2fa === true) {
      return res.json({ ...body, token: generateToken({ ...payload, setup_2fa: true }), setup_2fa_required: true });
    }
  }
  return res.json({ ...body, token: generateToken(payload) });
}

/** Decode a challenge, or null when it is invalid or expired. */
export function readChallenge(challenge) {
  try {
    const c = jwt.verify(String(challenge || ''), challengeSecret());
    return c?.kind === '2fa' && c.a && c.p ? c : null;
  } catch {
    return null;
  }
}
