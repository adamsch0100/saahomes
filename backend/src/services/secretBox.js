/**
 * Secrets at rest: AES-256-GCM, for credentials the app stores in its own
 * database (the Stripe webhook signing secret it created for itself).
 *
 *   seal('whsec_…')  → 'v1:<base64 iv | tag | ciphertext>'
 *   open(sealed)     → 'whsec_…' (null when it can't be opened)
 *
 * The key is CREDENTIALS_KEY (64 hex characters, 32 bytes of base64, or any
 * passphrase, hashed to 32 bytes). Without it the key is derived from
 * JWT_SECRET and a warning is logged once: rotating JWT_SECRET then means
 * stored secrets can't be opened, and the app sets them up again.
 */
import crypto from 'node:crypto';
import logger from '../utils/logger.js';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
let warned = false;

function keyFrom(raw) {
  const s = String(raw).trim();
  if (/^[0-9a-f]{64}$/i.test(s)) return Buffer.from(s, 'hex');
  const b64 = /^[A-Za-z0-9+/_-]{43}=?$/.test(s) ? Buffer.from(s, 'base64') : null;
  if (b64 && b64.length === 32) return b64;
  return crypto.createHash('sha256').update(s, 'utf8').digest();
}

/** The 32-byte key, or null when neither CREDENTIALS_KEY nor JWT_SECRET is set. */
export function secretKey() {
  const explicit = String(process.env.CREDENTIALS_KEY || '').trim();
  if (explicit) return keyFrom(explicit);
  const jwt = String(process.env.JWT_SECRET || '').trim();
  if (!jwt) return null;
  if (!warned) {
    warned = true;
    logger.warn('CREDENTIALS_KEY is not set: stored credentials are encrypted with a key derived from JWT_SECRET');
  }
  return crypto.createHash('sha256').update(`credentials:${jwt}`, 'utf8').digest();
}

export const canSeal = () => !!secretKey();

/** Encrypt a string. Throws when there is no key to encrypt with. */
export function seal(text) {
  const key = secretKey();
  if (!key) throw new Error('Set CREDENTIALS_KEY to store credentials');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}

/** Decrypt what seal() made; null for anything tampered with, foreign or unreadable. */
export function open(sealed) {
  const key = secretKey();
  const s = String(sealed || '');
  if (!key || !s.startsWith(`${VERSION}:`)) return null;
  try {
    const buf = Buffer.from(s.slice(VERSION.length + 1), 'base64');
    if (buf.length < IV_BYTES + TAG_BYTES) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, IV_BYTES));
    decipher.setAuthTag(buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(buf.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
