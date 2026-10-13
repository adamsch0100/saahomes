/**
 * Tell the OttoBot board a site lead arrived, so its leads_week number counts
 * real form submissions. Fire-and-forget: never blocks or fails the lead.
 * Sends only the form name (no name, email, phone or message).
 *
 * OTTOBOT_INTAKE_URL overrides the endpoint; set it to "off" to disable.
 */
import logger from '../utils/logger.js';

const DEFAULT_INTAKE_URL = 'https://ottobot-production.up.railway.app/api/intake/saa-homes';

export function reportLeadToBoard(form) {
  const url = String(process.env.OTTOBOT_INTAKE_URL || DEFAULT_INTAKE_URL).trim();
  if (!url || url === 'off' || process.env.NODE_ENV === 'test') return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'lead', form: String(form || 'site form').slice(0, 80) }),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok) logger.warn('board lead count not recorded', { status: res.status, form });
    })
    .catch((err) => logger.warn('board lead count not sent', { message: err.message, form }));
}
