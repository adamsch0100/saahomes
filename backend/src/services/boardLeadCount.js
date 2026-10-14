/**
 * Tell the OttoBot board a site lead arrived, so its leads_week number counts
 * real form submissions. Fire-and-forget: never blocks or fails the lead.
 * Sends only the form name (no name, email, phone or message).
 *
 * OTTOBOT_INTAKE_URL overrides the endpoint; set it to "off" to disable.
 *
 * The hook is the primary human notice in the lead loop: it needs no key and a
 * delivered event lands in the operator chat. It returns a readable result so
 * the per-submit log can record the leg instead of dropping it silently.
 */
import logger from '../utils/logger.js';

const DEFAULT_INTAKE_URL = 'https://ottobot-production.up.railway.app/api/intake/saa-homes';

/** The resolved intake URL (may be '' or 'off'). */
export function boardIntakeUrl() {
  return String(process.env.OTTOBOT_INTAKE_URL || DEFAULT_INTAKE_URL).trim();
}

/** True when the board hook is switched on. */
export function boardNotifyEnabled() {
  const url = boardIntakeUrl();
  return !!url && url !== 'off';
}

export function reportLeadToBoard(form) {
  const url = boardIntakeUrl();
  if (!url || url === 'off') {
    return Promise.resolve({ success: false, status: null, reason: 'disabled' });
  }
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve({ success: false, status: null, reason: 'test_env' });
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'lead', form: String(form || 'site form').slice(0, 80) }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok) {
        logger.warn('board lead count not recorded', { status: res.status, form });
        return { success: false, status: res.status, reason: `http_${res.status}` };
      }
      return { success: true, status: res.status };
    })
    .catch((err) => {
      logger.warn('board lead count not sent', { message: err.message, form });
      return { success: false, status: null, reason: err.message };
    });
}
