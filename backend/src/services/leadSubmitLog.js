/**
 * Per-submit lead log — one row per website form submit recording whether each
 * delivery leg actually fired: server-side GA4 Measurement Protocol, Follow Up
 * Boss forwarding, and the email notification (with timestamps).
 *
 * Every function here is observability only: it never throws and never blocks
 * or changes the lead flow. A missing log row is not a lost lead.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { currentTenantId } from './tenantContext.js';

/** Open a log row for a submit. Returns the row id, or null on failure. */
export async function createLeadSubmitLog(
  { leadType, submissionId = null, email = null, sourcePage = null } = {},
  pool = null
) {
  try {
    const db = pool || getPool();
    const { rows } = await db.query(
      `INSERT INTO lead_submit_log (lead_type, submission_id, email, source_page, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [leadType, submissionId, email, sourcePage, currentTenantId()]
    );
    return rows[0]?.id || null;
  } catch (err) {
    logger.warn('lead_submit_log insert failed (non-blocking)', {
      message: err.message,
      leadType,
    });
    return null;
  }
}

/** Record the GA4 Measurement Protocol leg. */
export async function recordGa4Leg(logId, { fired = false, status = null, error = null } = {}, pool = null) {
  if (!logId) return;
  try {
    await (pool || getPool()).query(
      `UPDATE lead_submit_log
          SET ga4_fired = $2, ga4_status = $3, ga4_error = $4, ga4_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [logId, !!fired, Number.isFinite(status) ? status : null, error]
    );
  } catch (err) {
    logger.warn('lead_submit_log GA4 leg update failed (non-blocking)', { message: err.message, logId });
  }
}

/** Record the Follow Up Boss forward leg. */
export async function recordFubLeg(logId, { success = false, personId = null, error = null } = {}, pool = null) {
  if (!logId) return;
  try {
    await (pool || getPool()).query(
      `UPDATE lead_submit_log
          SET fub_result = $2, fub_person_id = $3, fub_error = $4, fub_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [logId, success ? 'success' : 'failed', Number.isFinite(personId) ? personId : null, error]
    );
  } catch (err) {
    logger.warn('lead_submit_log FUB leg update failed (non-blocking)', { message: err.message, logId });
  }
}

/** Record the email notification leg. */
export async function recordNotifyLeg(logId, { success = false, messageId = null, error = null } = {}, pool = null) {
  if (!logId) return;
  try {
    await (pool || getPool()).query(
      `UPDATE lead_submit_log
          SET notify_result = $2, notify_message_id = $3, notify_error = $4, notify_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [logId, success ? 'sent' : 'failed', messageId, error]
    );
  } catch (err) {
    logger.warn('lead_submit_log notify leg update failed (non-blocking)', { message: err.message, logId });
  }
}
