/**
 * /api/account — password reset and invite links, and two-step sign-in for
 * staff. Everything here stays inside the request's brokerage.
 */
import bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { generateToken } from '../middleware/auth.js';
import { tenantIdOf, tokenMatchesTenant } from '../services/tenantContext.js';
import { issueAccountLink, findOpenLink, retireLinks } from '../services/accountLinks.js';
import {
  accountOf, loadFactor, saveFactor, factorEnabled, readChallenge,
} from '../services/staffAuth.js';
import {
  generateSecret, verifyCode, otpauthUrl, encryptSecret, decryptSecret,
  generateRecoveryCodes, matchRecoveryCode,
} from '../services/totp.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

// ── password reset ──

/** POST /password-reset/request { email } — always the same answer. */
export const requestPasswordReset = async (req, res) => {
  const emailStr = String(req.body?.email || '').trim().toLowerCase();
  const ok = () => res.json({ success: true });
  if (!EMAIL_RE.test(emailStr) || emailStr.length > 255) return ok();
  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT id, email, name, role, tenant_id FROM users
       WHERE tenant_id = $1 AND LOWER(email) = $2 AND status = 'active'
         AND (role IN ('agent', 'admin') OR password_hash IS NOT NULL)
       ORDER BY id LIMIT 1`,
      [tenantIdOf(req), emailStr]
    );
    if (r.rows[0]) await issueAccountLink({ user: r.rows[0], purpose: 'reset', tenant: req.tenant, pool });
  } catch (error) {
    logger.error('requestPasswordReset error', error);
  }
  return ok();
};

/** GET /password-reset/check?token= — who the link is for, so the page can greet them. */
export const checkPasswordReset = async (req, res) => {
  try {
    const link = await findOpenLink(String(req.query?.token || ''), tenantIdOf(req));
    if (!link) return res.status(400).json({ error: 'This link has expired or was already used.' });
    return res.json({
      success: true,
      purpose: link.purpose,
      email: link.email,
      name: link.name || null,
      brokerage: req.tenant?.name || null,
    });
  } catch (error) {
    logger.error('checkPasswordReset error', error);
    return res.status(500).json({ error: 'Could not check this link' });
  }
};

/** POST /password-reset/confirm { token, password } */
export const confirmPasswordReset = async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  }
  if (password.length > MAX_PASSWORD) {
    return res.status(400).json({ error: 'Password is too long' });
  }
  try {
    const pool = getPool();
    const link = await findOpenLink(String(req.body?.token || ''), tenantIdOf(req), pool);
    if (!link) return res.status(400).json({ error: 'This link has expired or was already used.' });
    // Claim the link first so two submits can't both use it.
    const claimed = await pool.query(
      'UPDATE password_resets SET used_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id',
      [link.id]
    );
    if (!claimed.rows[0]) return res.status(400).json({ error: 'This link has expired or was already used.' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 AND tenant_id = $3', [hash, link.user_id, link.tenant_id]);
    await retireLinks(link.user_id, pool);
    logger.info('password set from link', { user_id: link.user_id, purpose: link.purpose });
    const role = ['agent', 'admin'].includes(String(link.role)) ? link.role : 'client';
    return res.json({ success: true, role, email: link.email });
  } catch (error) {
    logger.error('confirmPasswordReset error', error);
    return res.status(500).json({ error: 'Could not set the password' });
  }
};

// ── who am I ──

/** GET /me (staff token) */
export const getAccountMe = (req, res) => {
  const u = req.user || {};
  return res.json({
    success: true,
    email: u.email || null,
    name: u.name || null,
    role: u.role,
    platform: u.platform === true,
    tenant: { id: req.tenant?.id ?? 1, name: req.tenant?.name || null },
  });
};

// ── two-step sign-in ──

function codeOrRecovery(factor, code) {
  const secret = decryptSecret(factor.secret_enc);
  const step = verifyCode(secret, code, { lastStep: factor.last_step });
  if (step != null) return { ok: true, patch: { last_step: step } };
  const idx = matchRecoveryCode(factor.recovery_hashes, code);
  if (idx >= 0) {
    const hashes = [...factor.recovery_hashes];
    hashes.splice(idx, 1);
    return { ok: true, patch: { recovery_hashes: hashes }, recovery: true };
  }
  return { ok: false };
}

/** POST /2fa/verify { challenge, code } — finish a login that needs a code. */
export const verifyTwoStep = async (req, res) => {
  const c = readChallenge(req.body?.challenge);
  if (!c) return res.status(401).json({ error: 'That sign-in expired. Please start again.' });
  if (!tokenMatchesTenant(c.p, req.tenant)) {
    return res.status(403).json({ error: 'This account belongs to a different brokerage' });
  }
  try {
    const pool = getPool();
    if (!c.a.platform) {
      const still = await pool.query(
        "SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND role IN ('agent', 'admin')",
        [c.a.id, c.a.tenant_id]
      );
      if (!still.rows[0]) return res.status(401).json({ error: 'That sign-in expired. Please start again.' });
    }
    const factor = await loadFactor(c.a, pool);
    if (!factorEnabled(factor)) return res.status(401).json({ error: 'That sign-in expired. Please start again.' });
    const result = codeOrRecovery(factor, req.body?.code);
    if (!result.ok) return res.status(401).json({ error: "That code didn't work. Try the newest code." });
    await saveFactor(c.a, { ...factor, ...result.patch }, pool);
    if (result.recovery) logger.info('recovery code used', { account: c.a });
    return res.json({ ...(c.b || { success: true }), token: generateToken(c.p) });
  } catch (error) {
    logger.error('verifyTwoStep error', error);
    return res.status(500).json({ error: 'Could not sign in' });
  }
};

/** GET /2fa */
export const getTwoStep = async (req, res) => {
  try {
    const factor = await loadFactor(accountOf(req.user));
    if (!factor) return res.status(404).json({ error: 'Account not found' });
    return res.json({
      success: true,
      enabled: factorEnabled(factor),
      enabled_at: factorEnabled(factor) ? factor.enabled_at : null,
      recovery_codes_left: factorEnabled(factor) ? factor.recovery_hashes.length : null,
    });
  } catch (error) {
    logger.error('getTwoStep error', error);
    return res.status(500).json({ error: 'Could not load two-step sign-in' });
  }
};

/** POST /2fa/setup — a new secret, pending until a code confirms it. */
export const setupTwoStep = async (req, res) => {
  try {
    const account = accountOf(req.user);
    const factor = await loadFactor(account);
    if (!factor) return res.status(404).json({ error: 'Account not found' });
    if (factorEnabled(factor)) return res.status(409).json({ error: 'Two-step sign-in is already on' });
    const secret = generateSecret();
    await saveFactor(account, { ...factor, pending_enc: encryptSecret(secret) });
    const url = otpauthUrl(secret, req.user.email || 'account', req.tenant?.name || 'SAA Homes');
    let qr = null;
    try {
      qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    } catch {
      qr = null;
    }
    return res.json({ success: true, secret, otpauth_url: url, qr_data_url: qr });
  } catch (error) {
    logger.error('setupTwoStep error', error);
    return res.status(500).json({ error: 'Could not start two-step setup' });
  }
};

/** POST /2fa/enable { code } — confirm the pending secret; returns recovery codes once. */
export const enableTwoStep = async (req, res) => {
  try {
    const account = accountOf(req.user);
    const factor = await loadFactor(account);
    if (!factor) return res.status(404).json({ error: 'Account not found' });
    if (factorEnabled(factor)) return res.status(409).json({ error: 'Two-step sign-in is already on' });
    const secret = decryptSecret(factor.pending_enc);
    if (!secret) return res.status(400).json({ error: 'Start setup first' });
    const step = verifyCode(secret, req.body?.code);
    if (step == null) return res.status(400).json({ error: "That code didn't match. Check the time on your phone and try the newest code." });
    const { codes, hashes } = generateRecoveryCodes();
    await saveFactor(account, {
      secret_enc: encryptSecret(secret),
      pending_enc: null,
      enabled_at: new Date().toISOString(),
      last_step: step,
      recovery_hashes: hashes,
    });
    logger.info('two-step sign-in enabled', { account });
    return res.json({ success: true, recovery_codes: codes });
  } catch (error) {
    logger.error('enableTwoStep error', error);
    return res.status(500).json({ error: 'Could not turn on two-step sign-in' });
  }
};

/** POST /2fa/disable { code } — needs a current code or a recovery code. */
export const disableTwoStep = async (req, res) => {
  try {
    const account = accountOf(req.user);
    const factor = await loadFactor(account);
    if (!factor) return res.status(404).json({ error: 'Account not found' });
    if (!factorEnabled(factor)) return res.json({ success: true });
    const result = codeOrRecovery(factor, req.body?.code);
    if (!result.ok) return res.status(400).json({ error: "That code didn't work" });
    await saveFactor(account, { secret_enc: null, pending_enc: null, enabled_at: null, last_step: null, recovery_hashes: [] });
    logger.info('two-step sign-in disabled', { account });
    return res.json({ success: true });
  } catch (error) {
    logger.error('disableTwoStep error', error);
    return res.status(500).json({ error: 'Could not turn off two-step sign-in' });
  }
};
