/**
 * POST /api/fub/webhook/:tenantId/:token — Follow Up Boss peopleCreated
 * deliveries for one brokerage (registered by services/fubAutomation.js).
 *
 * Mounted with express.raw: FUB-Signature is checked on the exact bytes.
 * The path names the brokerage and carries a per-brokerage secret; the
 * signature proves the call came from Follow Up Boss. We answer right away
 * (FUB wants a 2xx within 10 seconds) and do the work after.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { DEFAULT_TENANT_ID } from '../services/tenantContext.js';
import { verifyFubSignature, handlePeopleCreated, fubSystem } from '../services/fubAutomation.js';

const sameToken = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Handlers still running (tests wait on these). */
export const pendingFubWork = new Set();

export const fubPeopleCreatedWebhook = async (req, res) => {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isInteger(tenantId) || tenantId <= 0 || tenantId === DEFAULT_TENANT_ID) return res.status(404).end();
  if (!fubSystem()) return res.status(503).json({ error: 'Not set up' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!verifyFubSignature(raw, req.get('fub-signature'))) {
    logger.warn('FUB webhook signature rejected', { tenant_id: tenantId });
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const pool = getPool();
  let payload;
  try {
    const r = await pool.query("SELECT status, settings->'fub_webhook'->>'token' AS token FROM tenants WHERE id = $1", [tenantId]);
    if (!r.rows[0] || !sameToken(r.rows[0].token, req.params.token)) return res.status(404).end();
    if (r.rows[0].status !== 'active') return res.status(200).json({ ignored: 'paused' });
    payload = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid payload' });
    logger.error('FUB webhook error', { message: error.message });
    return res.status(500).end();
  }
  const work = handlePeopleCreated(tenantId, payload, { pool })
    .catch((e) => logger.error('FUB peopleCreated handling failed', { tenant_id: tenantId, message: e.message }))
    .finally(() => pendingFubWork.delete(work));
  pendingFubWork.add(work);
  return res.status(200).json({ received: true });
};
