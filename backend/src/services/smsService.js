/**
 * Texting with consent, through Twilio's REST API.
 *
 *   - Credentials come from TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN. Each
 *     brokerage sends from its own messaging service or number
 *     (tenants.settings.sms), else the platform's TWILIO_MESSAGING_SERVICE_SID.
 *     Without them texting "isn't set up yet" and nothing is sent.
 *   - Every text to a lead checks, in order: a phone number, the lead's
 *     latest sms consent is 'granted', the number is not on the brokerage's
 *     opt-out list, and it is between 8am and 9pm in the brokerage's time
 *     zone. Anything else is refused with a plain reason.
 *   - Replies come in on POST /api/sms/inbound (signature checked). STOP and
 *     friends add the number to that brokerage's opt-out list and revoke the
 *     consent; START lifts it; HELP gets a help reply.
 *   - runSmsAlertPass() texts opted-in buyers new matches and price drops on
 *     their saved searches, and reminds buyers of confirmed tours.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { brandFor, isHomeTenant, formatPhone } from './brand.js';
import { siteUrlFor, tenantById, DEFAULT_TENANT_ID } from './tenantContext.js';
import { hasConsent, recordConsent } from './consent.js';
import { buildSavedSearchWhere, savedSearchPath } from './listingFilters.js';
import { listingScope } from './feeds.js';

export const DEFAULT_TIME_ZONE = 'America/Denver';
export const TEXT_START_HOUR = 8; // 8am
export const TEXT_END_HOUR = 21; // 9pm
export const DAILY_ALERT_TEXT_CAP = 3;
const MAX_BODY = 640;
const NEW_LISTING_DAYS = 7;
const SID_RE = /^MG[0-9a-f]{32}$/i;

/** Swappable in tests: the HTTP call to Twilio and the clock. */
export const smsTransport = {
  fetch: (...args) => globalThis.fetch(...args),
  now: () => new Date(),
};

export const STOP_WORDS = new Set(['STOP', 'STOPALL', 'STOP ALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'OPT OUT', 'REVOKE']);
export const START_WORDS = new Set(['START', 'UNSTOP', 'YES', 'SUBSCRIBE']);
export const HELP_WORDS = new Set(['HELP', 'INFO']);

/** "(970) 555-0101" / "9705550101" / "+19705550101" → "+19705550101"; null when it isn't a phone. */
export function normalizePhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (s.startsWith('+') && d.length >= 11 && d.length <= 15) return `+${d}`;
  return null;
}

const last10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function timeZoneFor(tenant) {
  const s = tenant?.settings || {};
  const tz = String(s.sms?.time_zone || s.time_zone || '').trim();
  return tz && validTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

export function localHour(now, tz) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now)) % 24;
}

/** Texts only go out between 8am and 9pm where the brokerage is. */
export function isTextingQuietHours(now = smsTransport.now(), tz = DEFAULT_TIME_ZONE) {
  const h = localHour(now, tz);
  return h < TEXT_START_HOUR || h >= TEXT_END_HOUR;
}

export function twilioCredentials() {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  return sid && token ? { sid, token } : null;
}

/**
 * How a brokerage texts: { ready, reason, sender, shared, enabled, time_zone }.
 * reason: 'not_set_up' (no Twilio account on the platform), 'no_number'
 * (no messaging service or number for this brokerage), 'off' (the owner
 * hasn't turned texting on yet), or null when ready.
 */
export function smsConfigFor(tenant) {
  const creds = twilioCredentials();
  const s = tenant?.settings?.sms || {};
  const ownService = SID_RE.test(String(s.messaging_service_sid || '')) ? s.messaging_service_sid : null;
  const ownFrom = normalizePhone(s.from_number);
  const platformService = SID_RE.test(String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim())
    ? String(process.env.TWILIO_MESSAGING_SERVICE_SID).trim()
    : null;
  let sender = null;
  if (ownService) sender = { messagingServiceSid: ownService };
  else if (ownFrom) sender = { from: ownFrom };
  else if (platformService) sender = { messagingServiceSid: platformService, shared: true };
  // The home brokerage texts as soon as the platform is set up; any other
  // brokerage turns it on itself once its brand and campaign are registered.
  const enabled = s.enabled === undefined ? isHomeTenant(tenant) : s.enabled === true;
  let reason = null;
  if (!creds) reason = 'not_set_up';
  else if (!sender) reason = 'no_number';
  else if (!enabled) reason = 'off';
  return {
    ready: !reason,
    reason,
    sender,
    shared: !!sender?.shared,
    enabled,
    time_zone: timeZoneFor(tenant),
  };
}

export const SMS_REASON_TEXT = {
  not_set_up: 'Texting isn’t set up yet.',
  no_number: 'Texting isn’t set up yet: this brokerage has no texting number.',
  off: 'Texting is turned off for this brokerage. The owner can turn it on in Settings → Texting.',
  no_phone: 'There’s no mobile number on file for this person.',
  no_consent: 'This person hasn’t agreed to get texts yet. They can opt in when they save a search, or by texting you first.',
  opted_out: 'This person replied STOP, so they can’t be texted until they reply START.',
  quiet_hours: 'Texts only go out between 8am and 9pm. Try again in the morning.',
  empty: 'Write a message first.',
  not_found: 'Lead not found.',
  failed: 'The text didn’t go through. Try again in a moment.',
};

export async function isOptedOut(tenantId, phone, pool = getPool()) {
  const p = normalizePhone(phone);
  if (!p) return false;
  const r = await pool.query('SELECT 1 FROM sms_opt_outs WHERE tenant_id = $1 AND phone = $2', [tenantId, p]);
  return !!r.rows[0];
}

/** Clients of a brokerage with this number. */
export async function leadsByPhone(tenantId, phone, pool = getPool()) {
  const d = last10(phone);
  if (d.length !== 10) return [];
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, assigned_agent_id, tenant_id FROM users
     WHERE tenant_id = $1 AND COALESCE(role, 'client') = 'client'
       AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $2
     ORDER BY last_active_at DESC NULLS LAST, id DESC`,
    [tenantId, d]
  );
  return rows;
}

export async function recordOptOut(tenantId, phone, { source = 'stop' } = {}, pool = getPool()) {
  const p = normalizePhone(phone);
  if (!p) return;
  await pool.query(
    `INSERT INTO sms_opt_outs (tenant_id, phone, source) VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, phone) DO UPDATE SET source = EXCLUDED.source, opted_out_at = NOW()`,
    [tenantId, p, source]
  );
  for (const lead of await leadsByPhone(tenantId, p, pool)) {
    await recordConsent({ userId: lead.id, channel: 'sms', granted: false, wording: 'Replied STOP by text.', source: `sms_${source}`, tenantId }, pool)
      .catch((e) => logger.warn('sms opt-out consent record failed', { message: e.message }));
  }
}

export async function clearOptOut(tenantId, phone, pool = getPool()) {
  const p = normalizePhone(phone);
  if (!p) return;
  const r = await pool.query('DELETE FROM sms_opt_outs WHERE tenant_id = $1 AND phone = $2', [tenantId, p]);
  for (const lead of await leadsByPhone(tenantId, p, pool)) {
    // Replying START is the person asking for texts again, in their own words.
    if (r.rowCount || !(await hasConsent(lead.id, 'sms', pool))) {
      await recordConsent({ userId: lead.id, channel: 'sms', granted: true, wording: 'Replied START by text.', source: 'sms_start', tenantId }, pool)
        .catch((e) => logger.warn('sms start consent record failed', { message: e.message }));
    }
  }
}

/**
 * May this lead get a text right now? { ok, reason, phone }.
 * kind 'conversation' is an agent's own text; everything is checked the same.
 */
export async function textCheck({ tenant, lead, now = smsTransport.now() }, pool = getPool()) {
  const cfg = smsConfigFor(tenant);
  if (!cfg.ready) return { ok: false, reason: cfg.reason };
  if (!lead) return { ok: false, reason: 'not_found' };
  const phone = normalizePhone(lead.phone);
  if (!phone) return { ok: false, reason: 'no_phone' };
  if (!(await hasConsent(lead.id, 'sms', pool))) return { ok: false, reason: 'no_consent', phone };
  if (await isOptedOut(tenant.id, phone, pool)) return { ok: false, reason: 'opted_out', phone };
  if (isTextingQuietHours(now, cfg.time_zone)) return { ok: false, reason: 'quiet_hours', phone };
  return { ok: true, reason: null, phone, cfg };
}

/** Twilio's request body for one message. */
function messageForm(cfg, to, body, statusCallback) {
  const form = new URLSearchParams();
  form.set('To', to);
  form.set('Body', body);
  if (cfg.sender.messagingServiceSid) form.set('MessagingServiceSid', cfg.sender.messagingServiceSid);
  else form.set('From', cfg.sender.from);
  if (statusCallback) form.set('StatusCallback', statusCallback);
  return form;
}

/** POST to Twilio's Messages resource. Returns { sid, status } or throws with .code. */
export async function twilioSend(cfg, to, body, { statusCallback = null } = {}) {
  const creds = twilioCredentials();
  if (!creds) throw Object.assign(new Error('Texting isn’t set up yet'), { code: 'not_set_up' });
  const res = await smsTransport.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: messageForm(cfg, to, body, statusCallback).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || `Twilio error ${res.status}`), { code: data?.code || res.status });
  }
  return { sid: data.sid || null, status: data.status || 'queued' };
}

function statusCallbackFor(tenant) {
  const site = siteUrlFor(tenant);
  return /^https:\/\//.test(site) ? `${site}/api/sms/status` : null;
}

/** "Peak Realty: " in front of automated texts, so every text says who it's from. */
export function brandPrefix(tenant) {
  const name = brandFor(tenant).name || 'Your agent';
  return `${name}: `;
}

const STOP_FOOTER = ' Reply STOP to opt out.';

async function sentBefore(tenantId, phone, pool) {
  const r = await pool.query(
    `SELECT 1 FROM lead_messages WHERE tenant_id = $1 AND channel = 'sms' AND direction = 'out'
       AND to_addr = $2 AND status IN ('queued', 'sent', 'delivered') LIMIT 1`,
    [tenantId, phone]
  );
  return !!r.rows[0];
}

/**
 * Text a lead. Refuses (and sends nothing) without consent, after STOP,
 * during quiet hours or when texting isn't set up. Logs every attempt that
 * passes the checks in lead_messages.
 * @returns {Promise<{ ok, reason?, message? }>}
 */
export async function sendText({
  tenant, leadId, body, agentId = null, kind = 'conversation', draftId = null, now = smsTransport.now(),
} = {}, pool = getPool()) {
  const text = String(body || '').replace(/\s+\n/g, '\n').trim();
  if (!text) return { ok: false, reason: 'empty' };
  const { rows: [lead] } = await pool.query(
    "SELECT id, name, phone, tenant_id FROM users WHERE id = $1 AND tenant_id = $2 AND COALESCE(role, 'client') = 'client'",
    [leadId, tenant.id]
  );
  const check = await textCheck({ tenant, lead, now }, pool);
  if (!check.ok) return { ok: false, reason: check.reason };

  let final = kind === 'conversation' ? text : `${brandPrefix(tenant)}${text}`;
  // The first text to a number, and every automated alert, says how to stop.
  if (kind !== 'conversation' || !(await sentBefore(tenant.id, check.phone, pool))) {
    if (!/reply stop/i.test(final)) final = `${final}${STOP_FOOTER}`;
  }
  final = final.slice(0, MAX_BODY);

  const sender = check.cfg.sender.from || check.cfg.sender.messagingServiceSid;
  const { rows: [msg] } = await pool.query(
    `INSERT INTO lead_messages (tenant_id, lead_id, agent_id, channel, direction, kind, to_addr, from_addr, body, status, draft_id)
     VALUES ($1, $2, $3, 'sms', 'out', $4, $5, $6, $7, 'queued', $8) RETURNING *`,
    [tenant.id, lead.id, agentId, kind, check.phone, sender, final, draftId]
  );
  try {
    const sent = await twilioSend(check.cfg, check.phone, final, { statusCallback: statusCallbackFor(tenant) });
    const { rows: [done] } = await pool.query(
      "UPDATE lead_messages SET status = 'sent', provider_id = $2 WHERE id = $1 RETURNING *",
      [msg.id, sent.sid]
    );
    if (agentId && kind === 'conversation') {
      await pool.query('UPDATE users SET first_contacted_at = NOW() WHERE id = $1 AND first_contacted_at IS NULL', [lead.id]);
    }
    return { ok: true, message: done };
  } catch (e) {
    await pool.query("UPDATE lead_messages SET status = 'failed', error = $2 WHERE id = $1", [msg.id, String(e.message || e).slice(0, 300)]);
    // 21610: the number had already replied STOP to this sender.
    if (String(e.code) === '21610') await recordOptOut(tenant.id, check.phone, { source: 'carrier' }, pool);
    logger.warn('text send failed', { tenant_id: tenant.id, code: e.code, message: e.message });
    return { ok: false, reason: 'failed', error: e.message };
  }
}

/**
 * A text to one of the brokerage's own agents (hot-lead alerts). The agent
 * turned it on in their profile; it still respects quiet hours and STOP.
 */
export async function sendStaffText({ tenant, agent, body, now = smsTransport.now() } = {}, pool = getPool()) {
  const cfg = smsConfigFor(tenant);
  if (!cfg.ready) return { ok: false, reason: cfg.reason };
  const phone = normalizePhone(agent?.phone);
  if (!phone) return { ok: false, reason: 'no_phone' };
  if (await isOptedOut(tenant.id, phone, pool)) return { ok: false, reason: 'opted_out' };
  if (isTextingQuietHours(now, cfg.time_zone)) return { ok: false, reason: 'quiet_hours' };
  try {
    await twilioSend(cfg, phone, `${brandPrefix(tenant)}${String(body || '').trim()}`.slice(0, MAX_BODY));
    return { ok: true };
  } catch (e) {
    logger.warn('staff text failed', { tenant_id: tenant.id, message: e.message });
    return { ok: false, reason: 'failed' };
  }
}

// ------------------------------------------------------------ webhooks

/** Twilio's request signature: base64 HMAC-SHA1 of the URL plus sorted params. */
export function twilioSignature(url, params, authToken) {
  const data = Object.keys(params || {}).sort().reduce((acc, k) => {
    const v = params[k];
    return acc + (Array.isArray(v) ? v.map((x) => `${k}${x}`).join('') : `${k}${v ?? ''}`);
  }, String(url));
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
}

/** The URLs Twilio may have signed for this request. */
function signedUrlCandidates(req) {
  const path = req.originalUrl || req.url || '';
  const out = new Set();
  const base = String(process.env.TWILIO_WEBHOOK_BASE_URL || '').trim().replace(/\/$/, '');
  if (base) out.add(`${base}${path}`);
  const host = req.get?.('host');
  if (host) out.add(`${req.protocol}://${host}${path}`);
  if (req.hostname) {
    out.add(`https://${req.hostname}${path}`);
    if (host && host.includes(':')) out.add(`https://${host}${path}`);
  }
  return [...out];
}

export function verifyTwilioRequest(req) {
  const creds = twilioCredentials();
  if (!creds) return false;
  const given = String(req.get?.('x-twilio-signature') || req.headers?.['x-twilio-signature'] || '');
  if (!given) return false;
  const a = Buffer.from(given);
  for (const url of signedUrlCandidates(req)) {
    const b = Buffer.from(twilioSignature(url, req.body || {}, creds.token));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

const twiml = (message) => (message
  ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${String(message).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))}</Message></Response>`
  : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

export function helpReply(tenant) {
  const b = brandFor(tenant);
  const reach = [b.phone ? `call ${b.phone}` : null, b.email ? `email ${b.email}` : null].filter(Boolean).join(' or ');
  return `${b.name}: ${reach ? `For help, ${reach}.` : 'For help, reply with your question and your agent will get back to you.'} Msg & data rates may apply. Reply STOP to opt out.`;
}

/**
 * Which brokerages an inbound text belongs to: the one whose own messaging
 * service or number it came in on; else the brokerage whose domain the
 * webhook is on; else, on the platform's shared sender, every brokerage that
 * has texted this number (a STOP there stops them all).
 */
async function tenantsForInbound(req, params, pool) {
  const to = normalizePhone(params.To);
  const msid = String(params.MessagingServiceSid || '');
  const own = await pool.query(
    `SELECT id FROM tenants
     WHERE ($1 <> '' AND settings->'sms'->>'messaging_service_sid' = $1)
        OR ($2::text IS NOT NULL AND settings->'sms'->>'from_number' IS NOT NULL
            AND RIGHT(REGEXP_REPLACE(settings->'sms'->>'from_number', '\\D', '', 'g'), 10) = RIGHT($2, 10))
     ORDER BY id`,
    [msid, to ? to.replace(/\D/g, '') : null]
  );
  if (own.rows.length) return own.rows.map((r) => Number(r.id));
  const hostTenant = req.tenant?.id;
  if (hostTenant && hostTenant !== DEFAULT_TENANT_ID) return [hostTenant];
  const from = normalizePhone(params.From);
  const texted = await pool.query(
    `SELECT tenant_id, MAX(created_at) AS last FROM lead_messages
     WHERE channel = 'sms' AND direction = 'out' AND to_addr = $1
     GROUP BY tenant_id ORDER BY last DESC`,
    [from]
  );
  const ids = texted.rows.map((r) => Number(r.tenant_id));
  return ids.length ? ids : [DEFAULT_TENANT_ID];
}

/**
 * Handle one inbound text (already signature-checked). Returns the TwiML to
 * answer with. Keywords act per brokerage; anything else is a reply in the
 * lead's thread and pings their agent.
 */
export async function handleInboundText(req, { pool = getPool(), notify = null } = {}) {
  const params = req.body || {};
  const from = normalizePhone(params.From);
  const body = String(params.Body || '').trim();
  if (!from) return twiml();
  const word = body.toUpperCase().replace(/[^A-Z ]/g, '').trim();
  const tenantIds = await tenantsForInbound(req, params, pool);

  if (STOP_WORDS.has(word)) {
    for (const id of tenantIds) {
      await recordOptOut(id, from, { source: 'stop' }, pool);
      await logInbound(id, from, body, 'keyword', params, pool);
    }
    return twiml(); // the carrier/Twilio sends the standard opt-out confirmation
  }
  if (START_WORDS.has(word)) {
    for (const id of tenantIds) {
      await clearOptOut(id, from, pool);
      await logInbound(id, from, body, 'keyword', params, pool);
    }
    return twiml();
  }
  const tenant = await tenantById(tenantIds[0], { pool });
  if (HELP_WORDS.has(word)) {
    await logInbound(tenant.id, from, body, 'keyword', params, pool);
    return twiml(helpReply(tenant));
  }

  const lead = await logInbound(tenant.id, from, body, 'conversation', params, pool);
  if (lead) {
    // Texting first counts as asking to talk by text (unless they said STOP).
    if (!(await isOptedOut(tenant.id, from, pool)) && !(await hasConsent(lead.id, 'sms', pool))) {
      await recordConsent({
        userId: lead.id, channel: 'sms', granted: true, wording: `Texted ${brandFor(tenant).name} first.`, source: 'sms_inbound', tenantId: tenant.id,
      }, pool).catch(() => {});
    }
    const ping = notify || (await import('./hotLeads.js')).notifyLeadReplied;
    Promise.resolve(ping({ tenant, lead, body }, pool)).catch((e) => logger.warn('reply ping failed', { message: e.message }));
  }
  return twiml();
}

async function logInbound(tenantId, from, body, kind, params, pool) {
  const [lead] = await leadsByPhone(tenantId, from, pool);
  await pool.query(
    `INSERT INTO lead_messages (tenant_id, lead_id, agent_id, channel, direction, kind, to_addr, from_addr, body, status, provider_id)
     VALUES ($1, $2, $3, 'sms', 'in', $4, $5, $6, $7, 'received', $8)`,
    [tenantId, lead?.id || null, lead?.assigned_agent_id || null, kind, normalizePhone(params.To) || params.MessagingServiceSid || null,
      from, String(body || '').slice(0, 1600), String(params.MessageSid || params.SmsSid || '').slice(0, 64) || null]
  );
  return lead || null;
}

/** Delivery status from Twilio's status callback. */
export async function handleStatusCallback(params, pool = getPool()) {
  const sid = String(params.MessageSid || params.SmsSid || '');
  const status = String(params.MessageStatus || params.SmsStatus || '').toLowerCase();
  if (!sid || !status) return;
  const mapped = ['delivered', 'sent', 'failed', 'undelivered'].includes(status) ? (status === 'undelivered' ? 'failed' : status) : null;
  if (!mapped) return;
  const { rows: [m] } = await pool.query(
    `UPDATE lead_messages SET status = $2, error = COALESCE($3, error)
     WHERE provider_id = $1 AND direction = 'out' RETURNING tenant_id, to_addr`,
    [sid, mapped, params.ErrorCode ? `Error ${String(params.ErrorCode).slice(0, 10)}` : null]
  );
  if (m && String(params.ErrorCode) === '21610') await recordOptOut(m.tenant_id, m.to_addr, { source: 'carrier' }, pool);
}

// ------------------------------------------------------------ alerts + tours

const shortPrice = (p) => {
  const n = Number(p);
  if (!n) return null;
  return n >= 1e6 ? `$${(Math.round(n / 1e4) / 100).toString()}M` : `$${Math.round(n / 1000)}K`;
};
const street = (l) => [l.street_number, l.street_name, l.unit ? `#${l.unit}` : null].filter(Boolean).join(' ');
const place = (l) => [street(l), l.city].filter(Boolean).join(', ');

/** The text for a saved search's new matches and price drops. Pure. */
export function alertTextFor({ searchName, site, filters, fresh = [], drops = [] }) {
  const name = String(searchName || 'your search').slice(0, 40);
  const link = (l) => `${site}/homes-for-sale/${l.slug}/`;
  if (fresh.length === 1 && !drops.length) {
    const l = fresh[0];
    return `New match for "${name}": ${place(l)}${shortPrice(l.list_price) ? `, ${shortPrice(l.list_price)}` : ''}. ${link(l)}`;
  }
  if (drops.length === 1 && !fresh.length) {
    const l = drops[0];
    const was = shortPrice(l.original_list_price);
    return `Price drop on ${place(l)}: now ${shortPrice(l.list_price)}${was ? ` (was ${was})` : ''}. ${link(l)}`;
  }
  const bits = [];
  if (fresh.length) bits.push(`${fresh.length} new home${fresh.length === 1 ? '' : 's'}`);
  if (drops.length) bits.push(`${drops.length} price drop${drops.length === 1 ? '' : 's'}`);
  return `${bits.join(' and ')} for "${name}". See them: ${site}${savedSearchPath(filters || {})}`;
}

export function tourWhen(date, tz) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

/** "We got your tour request" to a buyer who agreed to texts. */
export async function textTourAck(tourId, pool = getPool()) {
  const { rows: [t] } = await pool.query(
    `SELECT t.id, t.tenant_id, t.user_id, t.listing_keys, t.ack_texted_at, u.name, a.name AS agent_name
     FROM tour_requests t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = u.assigned_agent_id
     WHERE t.id = $1`,
    [tourId]
  );
  if (!t || t.ack_texted_at) return { ok: false, reason: 'done' };
  const tenant = await tenantById(t.tenant_id, { pool });
  const n = (t.listing_keys || []).length;
  const who = t.agent_name ? firstName(t.agent_name) : 'We';
  const body = `Thanks${firstName(t.name) ? `, ${firstName(t.name)}` : ''}. We got your tour request for ${n} home${n === 1 ? '' : 's'}. ${who} will confirm a time shortly.`;
  const r = await sendText({ tenant, leadId: t.user_id, body, kind: 'tour' }, pool);
  if (r.ok) await pool.query('UPDATE tour_requests SET ack_texted_at = NOW() WHERE id = $1', [t.id]);
  return r;
}

/** Text new matches and price drops to buyers who opted in, and tour reminders. */
export async function runSmsAlertPass({ now = smsTransport.now(), pool = getPool() } = {}) {
  const result = { tenants: 0, texted: 0, skipped_quiet: 0, reminders: 0 };
  if (!twilioCredentials()) return { ...result, skipped: 'not_set_up' };
  const { rows: tenants } = await pool.query("SELECT id FROM tenants WHERE status = 'active' ORDER BY id");
  for (const { id } of tenants) {
    const tenant = await tenantById(id, { pool });
    const cfg = smsConfigFor(tenant);
    if (!cfg.ready) continue;
    result.tenants += 1;
    // Overnight nothing moves: cursors stay put, so the morning pass sends.
    if (isTextingQuietHours(now, cfg.time_zone)) {
      result.skipped_quiet += 1;
      continue;
    }
    try {
      result.texted += await textSavedSearchAlerts(tenant, now, pool);
      result.reminders += await textTourReminders(tenant, cfg, now, pool);
    } catch (e) {
      logger.error('sms alert pass failed for tenant', { tenant_id: id, message: e.message });
    }
  }
  return result;
}

async function textSavedSearchAlerts(tenant, now, pool) {
  const { rows: searches } = await pool.query(
    `SELECT s.id, s.user_id, s.name, s.filters, s.sms_cursor_at
     FROM saved_searches s JOIN users u ON u.id = s.user_id
     WHERE u.tenant_id = $1 AND s.is_active = TRUE AND u.status = 'active' AND u.phone IS NOT NULL
       AND (SELECT c.status FROM contact_consents c WHERE c.user_id = u.id AND c.channel = 'sms'
            ORDER BY c.created_at DESC, c.id DESC LIMIT 1) = 'granted'`,
    [tenant.id]
  );
  const site = siteUrlFor(tenant);
  const { feeds } = await listingScope(tenant, { pool });
  let texted = 0;
  for (const s of searches) {
    const { rows: [{ ts }] } = await pool.query('SELECT NOW()::timestamp AS ts');
    if (!s.sms_cursor_at) {
      await pool.query('UPDATE saved_searches SET sms_cursor_at = $1 WHERE id = $2', [ts, s.id]);
      continue;
    }
    const { whereSql, params } = buildSavedSearchWhere(s.filters || {});
    const n = params.length;
    const { rows: fresh } = await pool.query(
      `SELECT listing_id, slug, street_number, street_name, unit, city, list_price, original_list_price
       FROM listings WHERE ${whereSql} AND created_at > $${n + 1} AND created_at <= $${n + 2}
         AND feed = ANY($${n + 3}::text[])
         AND (days_on_market IS NULL OR days_on_market <= ${NEW_LISTING_DAYS})
       ORDER BY created_at DESC LIMIT 10`,
      [...params, s.sms_cursor_at, ts, feeds]
    );
    const { rows: drops } = await pool.query(
      `SELECT listing_id, slug, street_number, street_name, unit, city, list_price, original_list_price
       FROM listings WHERE ${whereSql} AND price_change_timestamp > $${n + 1} AND price_change_timestamp <= $${n + 2}
         AND original_list_price IS NOT NULL AND list_price < original_list_price
         AND created_at <= $${n + 1} AND feed = ANY($${n + 3}::text[])
       ORDER BY price_change_timestamp DESC LIMIT 10`,
      [...params, s.sms_cursor_at, ts, feeds]
    );
    await pool.query('UPDATE saved_searches SET sms_cursor_at = $1 WHERE id = $2', [ts, s.id]);
    const passed = new Set((await pool.query(
      "SELECT listing_key FROM home_reactions WHERE user_id = $1 AND reaction = 'pass'", [s.user_id]
    )).rows.map((r) => String(r.listing_key)));
    const keep = (l) => !passed.has(String(l.listing_id));
    const f = fresh.filter(keep);
    const d = drops.filter(keep);
    if (!f.length && !d.length) continue;
    const { rows: [{ n: today }] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM lead_messages
       WHERE lead_id = $1 AND direction = 'out' AND kind = 'alert' AND created_at > NOW() - INTERVAL '24 hours'`,
      [s.user_id]
    );
    if (today >= DAILY_ALERT_TEXT_CAP) continue;
    const body = alertTextFor({ searchName: s.name, site, filters: s.filters, fresh: f, drops: d });
    const r = await sendText({ tenant, leadId: s.user_id, body, kind: 'alert', now }, pool);
    if (r.ok) texted += 1;
  }
  return texted;
}

async function textTourReminders(tenant, cfg, now, pool) {
  const { rows } = await pool.query(
    `SELECT t.id, t.user_id, t.confirmed_start, t.listing_keys, a.name AS agent_name
     FROM tour_requests t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.confirmed_by
     WHERE t.tenant_id = $1 AND t.status = 'confirmed' AND t.reminder_texted_at IS NULL
       AND t.confirmed_start > $2::timestamptz + INTERVAL '30 minutes'
       AND t.confirmed_start <= $2::timestamptz + INTERVAL '24 hours'`,
    [tenant.id, now]
  );
  let sent = 0;
  for (const t of rows) {
    const who = t.agent_name ? ` with ${firstName(t.agent_name)}` : '';
    const body = `Reminder: your home tour is ${tourWhen(new Date(t.confirmed_start), cfg.time_zone)}${who}. Reply here with any questions.`;
    const r = await sendText({ tenant, leadId: t.user_id, body, kind: 'tour', now }, pool);
    // Mark it either way: a reminder that can't go now shouldn't go late.
    await pool.query('UPDATE tour_requests SET reminder_texted_at = NOW() WHERE id = $1', [t.id]);
    if (r.ok) sent += 1;
  }
  return sent;
}

/** Sample texts and opt-in words for the owner's 10DLC registration. Pure. */
export function registrationKit(tenant, { consentWording, agentName = 'Andy' } = {}) {
  const b = brandFor(tenant);
  const site = siteUrlFor(tenant);
  const prefix = `${b.name}: `;
  return {
    brand_name: b.name,
    legal_name: b.legal_name || b.name,
    website: site,
    use_case: 'Mixed (account notifications and customer care)',
    campaign_description: `${b.name} texts home buyers and sellers who opt in on ${site.replace(/^https?:\/\//, '')}: new homes and price drops on searches they saved, home tour confirmations and reminders, and one-to-one replies from their real estate agent.`,
    opt_in_wording: consentWording,
    opt_in_where: `On the "Save this search" form on ${site}/properties/, next to an unchecked box the person ticks themselves. People who text us first are also opted in for replies.`,
    samples: [
      `${prefix}New match for "3 bed in Fort Collins": 1234 Elm St, Fort Collins, $525K. ${site}/homes-for-sale/1234-elm-st/${STOP_FOOTER}`,
      `${prefix}Price drop on 1234 Elm St, Fort Collins: now $499K (was $525K). ${site}/homes-for-sale/1234-elm-st/${STOP_FOOTER}`,
      `${prefix}Thanks, Sam. We got your tour request for 3 homes. ${agentName} will confirm a time shortly.${STOP_FOOTER}`,
      `${prefix}Reminder: your home tour is Sat, Oct 18, 10:00 AM with ${agentName}. Reply here with any questions.${STOP_FOOTER}`,
      `Hi Sam, it's ${agentName} with ${b.name}. Want to see 1234 Elm St this weekend?${STOP_FOOTER}`,
    ],
    help_reply: helpReply(tenant),
    stop_reply: `You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.`,
    keywords: { opt_out: [...STOP_WORDS], opt_in: [...START_WORDS], help: [...HELP_WORDS] },
    privacy_line: 'No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.',
    message_frequency: 'Message frequency varies.',
    webhook_url: `${site}/api/sms/inbound`,
    status_url: `${site}/api/sms/status`,
  };
}

export const displayPhone = formatPhone;
