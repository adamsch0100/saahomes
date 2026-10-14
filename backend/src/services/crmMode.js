/**
 * Which CRM a brokerage runs on (tenants.settings.crm_mode):
 *   'fub' — Follow Up Boss is connected and kept in step (the default).
 *   'own' — the cockpit is the CRM of record. Nothing calls Follow Up Boss:
 *           no lead events, notes, tasks, tags, imports or webhooks.
 * Switching modes changes where new work goes, never what is stored: notes,
 * tasks, tags and a saved Follow Up Boss key all stay put.
 */
import getPool from '../config/database.js';
import { tenantById } from './tenantContext.js';

export const CRM_MODES = ['fub', 'own'];

/** The mode for a tenant row. Pure. */
export function crmModeOf(tenant) {
  return tenant?.settings?.crm_mode === 'own' ? 'own' : 'fub';
}

/** True when this brokerage runs on its own CRM (so Follow Up Boss gets nothing). */
export async function isOwnCrm(tenantId, pool = null) {
  const id = Number(tenantId);
  if (!Number.isInteger(id) || id <= 0) return false;
  try {
    return crmModeOf(await tenantById(id, { pool: pool || getPool() })) === 'own';
  } catch {
    return false;
  }
}
