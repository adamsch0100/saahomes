/**
 * Consent per contact and channel, kept as an append-only log: every grant or
 * revoke is a row with the exact wording shown, where it happened and when.
 * The current state of a channel is its latest row. Texting and push may only
 * go to contacts whose latest row for that channel is 'granted'.
 */
import getPool from '../config/database.js';
import { recordEvent, DEFAULT_TENANT_ID } from './events.js';

export const CHANNELS = ['email', 'sms', 'push', 'call'];

export async function recordConsent({
  userId,
  channel,
  granted,
  wording = null,
  source = null,
  req = null,
  tenantId = DEFAULT_TENANT_ID,
} = {}, pool = getPool()) {
  if (!userId || !CHANNELS.includes(channel)) return null;
  const status = granted ? 'granted' : 'revoked';
  const ip = req ? String(req.ip || '').slice(0, 64) || null : null;
  const ua = req ? String(req.get?.('user-agent') || '').slice(0, 500) || null : null;
  const { rows } = await pool.query(
    `INSERT INTO contact_consents (tenant_id, user_id, channel, status, wording, source, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [tenantId, userId, channel, status, wording, source ? String(source).slice(0, 128) : null, ip, ua]
  );
  await recordEvent({ type: 'consent_changed', userId, meta: { channel, status, source } }, pool);
  return rows[0];
}

/** Latest consent row per channel for a contact: { email: 'granted', sms: 'revoked', ... } */
export async function getConsents(userId, pool = getPool()) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (channel) channel, status, wording, source, created_at
       FROM contact_consents
      WHERE user_id = $1
      ORDER BY channel, created_at DESC, id DESC`,
    [userId]
  );
  const out = {};
  for (const r of rows) out[r.channel] = r;
  return out;
}

export async function hasConsent(userId, channel, pool = getPool()) {
  const all = await getConsents(userId, pool);
  return all[channel]?.status === 'granted';
}

/** One opt-out stops every channel. */
export async function revokeAll(userId, { source = 'opt_out', req = null } = {}, pool = getPool()) {
  const current = await getConsents(userId, pool);
  for (const channel of CHANNELS) {
    if (current[channel]?.status === 'granted') {
      await recordConsent({ userId, channel, granted: false, source, req }, pool);
    }
  }
}
