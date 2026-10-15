/**
 * MLS credentials at rest: AES-256-GCM.
 *
 * The key comes from CREDENTIALS_KEY (any string; 64 hex characters or 32
 * base64 bytes are used as-is, anything else is hashed to 32 bytes). Without
 * it the key is derived from JWT_SECRET and a warning is logged once, so a
 * fresh install still works but the owner is told to set a separate key.
 *
 * Stored form: "v1:<iv>:<tag>:<ciphertext>" (base64). Secrets never leave the
 * server: the browser only ever sees hints like "saved, ending in 4f2a".
 */
import crypto from 'node:crypto';
import logger from '../../utils/logger.js';
import { secretKey } from '../secretBox.js';

const VERSION = 'v1';

/** The 32-byte key for credentials (the same key as secretBox.js). */
export function credentialsKey() {
  const key = secretKey();
  if (!key) throw new Error('CREDENTIALS_KEY (or JWT_SECRET) must be set to store MLS credentials');
  return key;
}

/** Called at startup so the missing-key warning shows in the boot log. */
export function checkCredentialsKey() {
  try {
    credentialsKey();
    return { ok: true, dedicated: !!process.env.CREDENTIALS_KEY };
  } catch (e) {
    logger.warn(e.message);
    return { ok: false, dedicated: false };
  }
}

/** Encrypt a JSON-able value. */
export function encryptSecret(value, key = credentialsKey()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(value ?? null), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Decrypt what encryptSecret wrote. Throws when the key is wrong or the data was changed. */
export function decryptSecret(stored, key = credentialsKey()) {
  if (!stored) return null;
  const [v, iv, tag, ct] = String(stored).split(':');
  if (v !== VERSION || !iv || !tag || ct === undefined) throw new Error('Unreadable credentials');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const out = Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]);
  return JSON.parse(out.toString('utf8'));
}

/**
 * What the browser may see of a credentials object: for each field, that it
 * is saved and its last four characters (fewer for short values).
 */
export function credentialHints(creds) {
  const out = {};
  for (const [k, v] of Object.entries(creds || {})) {
    const s = String(v ?? '');
    if (!s) continue;
    const tail = s.length >= 12 ? s.slice(-4) : s.length >= 8 ? s.slice(-2) : '';
    out[k] = { saved: true, ending: tail || null };
  }
  return out;
}
