/**
 * Two-step sign-in with an authenticator app (RFC 6238 TOTP, 30-second
 * steps, 6 digits, HMAC-SHA1: what Google Authenticator, 1Password and
 * Authy all expect). Secrets are encrypted at rest; recovery codes are
 * stored only as hashes.
 */
import crypto from 'node:crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function stepAt(ms = Date.now()) {
  return Math.floor(ms / 1000 / STEP_SECONDS);
}

export function codeAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0xf;
  const num = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(num).padStart(DIGITS, '0');
}

/**
 * The time step a code matches (allowing one step of clock drift either
 * way), or null. A step at or before lastStep was already used: refused, so
 * a code seen over someone's shoulder can't be replayed.
 */
export function verifyCode(secret, code, { lastStep = null, now = Date.now() } = {}) {
  const c = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c) || !secret) return null;
  const current = stepAt(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep != null && step <= Number(lastStep)) continue;
    const expected = codeAt(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUrl(secret, account, issuer) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// ── secrets at rest ──
function key() {
  const base = process.env.TOTP_ENC_KEY || `totp:${process.env.JWT_SECRET || ''}`;
  return crypto.createHash('sha256').update(base).digest();
}

export function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(blob) {
  if (!blob) return null;
  try {
    const [v, iv, tag, enc] = String(blob).split(':');
    if (v !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── recovery codes ──
const hashRecovery = (code) =>
  crypto.createHash('sha256').update(String(code).toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');

export function generateRecoveryCodes(n = 10) {
  const codes = [];
  for (let i = 0; i < n; i += 1) {
    const raw = base32Encode(crypto.randomBytes(5)).toLowerCase().slice(0, 8);
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return { codes, hashes: codes.map(hashRecovery) };
}

/** Index of the matching recovery hash, or -1. */
export function matchRecoveryCode(hashes, code) {
  const c = String(code || '').trim();
  if (!c || /^\d{6}$/.test(c.replace(/\s+/g, '')) || !Array.isArray(hashes)) return -1;
  return hashes.indexOf(hashRecovery(c));
}
