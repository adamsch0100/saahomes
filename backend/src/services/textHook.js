/**
 * One place client-life features ask to send a text message. It goes through
 * the SMS service, so consent, quiet hours, STOP and the brokerage's sending
 * number all apply. A text to one of the brokerage's own agents goes out only
 * when that agent turned on texts in their profile. Without texting set up,
 * nothing is sent and callers carry on.
 *
 * @param {{ tenantId: number, userId: number, body: string, kind: string }} msg
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
import getPool from '../config/database.js';
import { tenantById } from './tenantContext.js';
import { sendText, sendStaffText } from './smsService.js';

export async function sendTextIfAllowed({ tenantId, userId, body, kind } = {}, pool = getPool()) {
  if (!tenantId || !userId || !String(body || '').trim()) return { sent: false, reason: 'empty' };
  const tenant = await tenantById(Number(tenantId), { pool });
  if (!tenant) return { sent: false, reason: 'no_tenant' };
  const { rows: [user] } = await pool.query(
    "SELECT id, name, phone, role, notify_prefs FROM users WHERE id = $1 AND tenant_id = $2 AND status = 'active'",
    [userId, tenant.id]
  );
  if (!user) return { sent: false, reason: 'no_user' };
  if (['agent', 'admin'].includes(user.role)) {
    if (user.notify_prefs?.hot_lead_text !== true) return { sent: false, reason: 'agent_texts_off' };
    const r = await sendStaffText({ tenant, agent: user, body }, pool);
    return { sent: r.ok === true, reason: r.reason };
  }
  const r = await sendText({ tenant, leadId: user.id, body, kind: kind || 'notice' }, pool);
  return { sent: r.ok === true, reason: r.reason };
}

export default sendTextIfAllowed;
