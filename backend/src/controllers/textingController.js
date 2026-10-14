/**
 * Texting for a brokerage, and the owner's reports:
 *   GET   /api/admin/settings/sms      status, sender, 10DLC registration kit, numbers
 *   PATCH /api/admin/settings/sms      { enabled?, messaging_service_sid?, from_number?, time_zone?, hot_leads_unassigned? }
 *   GET   /api/admin/reports/agents    ?days=7|30|90&format=csv
 *   POST  /api/sms/inbound             Twilio inbound webhook (signature checked)
 *   POST  /api/sms/status              Twilio delivery status (signature checked)
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { tenantIdOf, clearTenantCache } from '../services/tenantContext.js';
import {
  smsConfigFor, SMS_REASON_TEXT, registrationKit, normalizePhone, twilioCredentials, smsTransport,
  verifyTwilioRequest, handleInboundText, handleStatusCallback, timeZoneFor,
} from '../services/smsService.js';
import { smsAlertConsentWording } from './alertController.js';
import { agentReport, reportCsv } from '../services/crmReports.js';
import { formatPhone } from '../services/brand.js';

const SID_RE = /^MG[0-9a-f]{32}$/i;

async function senderNumbers(cfg) {
  const creds = twilioCredentials();
  if (!creds || !cfg.sender?.messagingServiceSid) return cfg.sender?.from ? [cfg.sender.from] : [];
  try {
    const res = await smsTransport.fetch(
      `https://messaging.twilio.com/v1/Services/${encodeURIComponent(cfg.sender.messagingServiceSid)}/PhoneNumbers?PageSize=20`,
      {
        headers: { Authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString('base64')}` },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.phone_numbers || []).map((n) => n.phone_number).filter(Boolean);
  } catch {
    return null;
  }
}

async function payload(tenant, pool) {
  const cfg = smsConfigFor(tenant);
  const s = tenant.settings?.sms || {};
  const [{ rows: [optOuts] }, { rows: [sent] }] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS n FROM sms_opt_outs WHERE tenant_id = $1', [tenant.id]),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE direction = 'out' AND status IN ('sent', 'delivered'))::int AS out,
              COUNT(*) FILTER (WHERE direction = 'in')::int AS inbound
       FROM lead_messages WHERE tenant_id = $1 AND channel = 'sms' AND created_at > NOW() - INTERVAL '30 days'`,
      [tenant.id]
    ),
  ]);
  const numbers = cfg.reason === 'not_set_up' ? [] : await senderNumbers(cfg);
  return {
    status: {
      ready: cfg.ready,
      reason: cfg.reason,
      message: cfg.reason ? SMS_REASON_TEXT[cfg.reason] : null,
      enabled: cfg.enabled,
      shared: cfg.shared,
      platform_set_up: !!twilioCredentials(),
    },
    settings: {
      messaging_service_sid: s.messaging_service_sid || null,
      from_number: s.from_number ? formatPhone(s.from_number) : null,
      time_zone: timeZoneFor(tenant),
    },
    numbers: numbers === null ? null : numbers.map((n) => formatPhone(n.replace(/^\+1/, '')) || n),
    hot_leads: { unassigned: tenant.settings?.hot_leads?.unassigned === 'round_robin' ? 'round_robin' : 'owners' },
    stats: { opt_outs: optOuts.n, sent_30d: sent.out, received_30d: sent.inbound },
    kit: registrationKit(tenant, { consentWording: smsAlertConsentWording(tenant) }),
  };
}

async function loadTenant(req, pool) {
  const { rows: [t] } = await pool.query('SELECT id, slug, name, primary_domain, market_key, status, settings FROM tenants WHERE id = $1', [tenantIdOf(req)]);
  return t ? { ...t, id: Number(t.id), settings: t.settings || {}, agent: null, site_host: req.tenant?.site_host || null } : null;
}

/** GET /api/admin/settings/sms */
export const getSmsSettings = async (req, res) => {
  try {
    const pool = getPool();
    const tenant = await loadTenant(req, pool);
    if (!tenant) return res.status(404).json({ error: 'Brokerage not found' });
    return res.json({ success: true, data: await payload(tenant, pool) });
  } catch (error) {
    logger.error('getSmsSettings error', error);
    return res.status(500).json({ error: 'Could not load texting settings' });
  }
};

/** PATCH /api/admin/settings/sms */
export const patchSmsSettings = async (req, res) => {
  try {
    const pool = getPool();
    const tenant = await loadTenant(req, pool);
    if (!tenant) return res.status(404).json({ error: 'Brokerage not found' });
    const b = req.body || {};
    const sms = { ...(tenant.settings.sms || {}) };
    if (b.messaging_service_sid !== undefined) {
      const v = String(b.messaging_service_sid || '').trim();
      if (v && !SID_RE.test(v)) return res.status(400).json({ error: 'A messaging service ID starts with MG and has 34 characters' });
      if (v) sms.messaging_service_sid = v;
      else delete sms.messaging_service_sid;
    }
    if (b.from_number !== undefined) {
      const raw = String(b.from_number || '').trim();
      const v = normalizePhone(raw);
      if (raw && !v) return res.status(400).json({ error: 'That number doesn’t look right. Use a 10-digit US number.' });
      if (v) sms.from_number = v;
      else delete sms.from_number;
    }
    if (b.time_zone !== undefined) {
      const tz = String(b.time_zone || '').trim();
      if (tz) {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
        } catch {
          return res.status(400).json({ error: 'Pick a time zone from the list' });
        }
        sms.time_zone = tz;
      } else delete sms.time_zone;
    }
    if (b.enabled !== undefined) {
      sms.enabled = b.enabled === true;
      if (sms.enabled) sms.registered_at = sms.registered_at || new Date().toISOString();
    }
    const patch = { sms };
    if (b.hot_leads_unassigned !== undefined) {
      if (!['owners', 'round_robin'].includes(b.hot_leads_unassigned)) return res.status(400).json({ error: 'Pick owners or round-robin' });
      patch.hot_leads = { ...(tenant.settings.hot_leads || {}), unassigned: b.hot_leads_unassigned };
    }
    await pool.query('UPDATE tenants SET settings = settings || $1::jsonb WHERE id = $2', [JSON.stringify(patch), tenant.id]);
    clearTenantCache();
    logger.info('texting settings updated', { tenant_id: tenant.id, fields: Object.keys(b), by: req.user?.email });
    const fresh = await loadTenant(req, pool);
    return res.json({ success: true, data: await payload(fresh, pool) });
  } catch (error) {
    logger.error('patchSmsSettings error', error);
    return res.status(500).json({ error: 'Could not save texting settings' });
  }
};

/** GET /api/admin/reports/agents?days=&format=csv */
export const getAgentReports = async (req, res) => {
  try {
    const report = await agentReport({ tenantId: tenantIdOf(req), days: req.query.days }, getPool());
    if (req.query.format === 'csv') {
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="agent-report-${report.days}-days.csv"`);
      return res.send(reportCsv(report));
    }
    return res.json({ success: true, data: report });
  } catch (error) {
    logger.error('getAgentReports error', error);
    return res.status(500).json({ error: 'Could not build the report' });
  }
};

const xml = (res, body) => res.status(200).type('text/xml').send(body);

/** POST /api/sms/inbound — Twilio calls this for every text to our numbers. */
export const inboundSms = async (req, res) => {
  if (!verifyTwilioRequest(req)) {
    logger.warn('sms inbound: bad or missing signature', { host: req.hostname });
    return res.status(403).send('Forbidden');
  }
  try {
    return xml(res, await handleInboundText(req));
  } catch (error) {
    logger.error('inboundSms error', error);
    return xml(res, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
};

/** POST /api/sms/status — delivery receipts. */
export const smsStatus = async (req, res) => {
  if (!verifyTwilioRequest(req)) return res.status(403).send('Forbidden');
  try {
    await handleStatusCallback(req.body || {});
  } catch (error) {
    logger.error('smsStatus error', error);
  }
  return res.status(204).end();
};
