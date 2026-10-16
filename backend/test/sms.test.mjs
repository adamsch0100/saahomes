/**
 * Texting with consent: nothing sends without Twilio set up, without the
 * person's opt-in, overnight, or after they reply STOP; STOP is kept per
 * brokerage; Twilio's webhook signature is checked; saved-search alerts go
 * only to people who opted in. Twilio is never called for real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-sms';
process.env.CRM_SCHEDULER = 'off';
process.env.HOT_LEAD_ALERTS = 'off';
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_MESSAGING_SERVICE_SID;

const PEAK = 'peak-sms.test';
const SUMMIT = 'summit-sms.test';
const PEAK_SID = `MG${'a'.repeat(32)}`;
const SUMMIT_SID = `MG${'b'.repeat(32)}`;
const TOKEN = 'twilio-test-token';
const NOON_MT = new Date('2026-10-14T18:00:00Z');
const NIGHT_MT = new Date('2026-10-15T05:00:00Z'); // 11pm Mountain
const skip = !hasTestDatabase;

let db;
let server;
let sms;
let peak;
let summit;
let owner;
let agent;
let summitOwner;
let lena;
let otto;
let lenaSummit;
const tok = {};
let twilio = [];

async function call(method, path, { auth, body, host = PEAK } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': host, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* xml */ }
  return { status: res.status, json, text };
}

function sign(url, params, token = TOKEN) {
  const data = Object.keys(params).sort().reduce((a, k) => a + k + params[k], url);
  return crypto.createHmac('sha1', token).update(data).digest('base64');
}

async function inbound(params, { signature, host = PEAK, path = '/sms/inbound' } = {}) {
  const url = `${server.url}/api${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Forwarded-Host': host,
      ...(signature !== null ? { 'X-Twilio-Signature': signature ?? sign(url, params) } : {}),
    },
    body: new URLSearchParams(params).toString(),
  });
  return { status: res.status, text: await res.text() };
}

const q = (sql, p) => db.pool.query(sql, p);
const mkUser = async (tenantId, email, role, extra = {}) => (await q(
  `INSERT INTO users (email, name, role, status, manage_token, tenant_id, phone, assigned_agent_id)
   VALUES ($1, $2, $3, 'active', $4, $5, $6, $7) RETURNING *`,
  [email, extra.name || email, role, crypto.randomBytes(16).toString('hex'), tenantId, extra.phone || null, extra.assigned || null]
)).rows[0];
const optIn = (userId, tenantId) => q(
  `INSERT INTO contact_consents (tenant_id, user_id, channel, status, wording, source) VALUES ($1, $2, 'sms', 'granted', 'Text me', 'save_search')`,
  [tenantId, userId]
);
const setEnv = () => {
  process.env.TWILIO_ACCOUNT_SID = 'ACtest';
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
};

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  sms = await import('../src/services/smsService.js');
  sms.smsTransport.now = () => NOON_MT;
  sms.smsTransport.fetch = async (url, init) => {
    if (String(url).includes('/PhoneNumbers')) {
      return new Response(JSON.stringify({ phone_numbers: [{ phone_number: '+19705550199' }] }), { status: 200 });
    }
    twilio.push({ url, form: Object.fromEntries(new URLSearchParams(init?.body || '')) });
    return new Response(JSON.stringify({ sid: `SM${twilio.length}`, status: 'queued' }), { status: 201 });
  };
  ({ rows: [peak] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peaksms', 'Peak Realty', $1, $2) RETURNING *",
    [PEAK, JSON.stringify({ brand: { phone: '9705550100' }, sms: { messaging_service_sid: PEAK_SID } })]
  ));
  ({ rows: [summit] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('summitsms', 'Summit Homes', $1, $2) RETURNING *",
    [SUMMIT, JSON.stringify({ sms: { messaging_service_sid: SUMMIT_SID, enabled: true } })]
  ));
  // Peak's MLS approved its site, so its text alerts carry live IRES homes.
  await q(`INSERT INTO tenant_feeds (tenant_id, feed_key, status, sold_enabled) VALUES ($1, 'ires', 'approved', TRUE)`, [peak.id]);
  owner = await mkUser(peak.id, 'olive@peak.test', 'admin', { name: 'Olive Owner' });
  agent = await mkUser(peak.id, 'andy@peak.test', 'agent', { name: 'Andy Agent' });
  summitOwner = await mkUser(summit.id, 'sam@summit.test', 'admin', { name: 'Sam Summit' });
  const { generateToken } = await import('../src/middleware/auth.js');
  tok.owner = generateToken({ id: owner.id, email: owner.email, role: 'admin', tenant_id: peak.id });
  tok.agent = generateToken({ id: agent.id, email: agent.email, role: 'agent', tenant_id: peak.id });
  tok.summit = generateToken({ id: summitOwner.id, email: summitOwner.email, role: 'admin', tenant_id: summit.id });
  lena = await mkUser(peak.id, 'lena@buyer.test', 'client', { name: 'Lena Lead', phone: '(970) 555-1111', assigned: agent.id });
  otto = await mkUser(peak.id, 'otto@buyer.test', 'client', { name: 'Otto Optout', phone: '970-555-2222', assigned: agent.id });
  lenaSummit = await mkUser(summit.id, 'lena@buyer.test', 'client', { name: 'Lena at Summit', phone: '9705551111' });
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('phones, quiet hours and signatures', async () => {
  const s = await import('../src/services/smsService.js');
  assert.equal(s.normalizePhone('(970) 555-1111'), '+19705551111');
  assert.equal(s.normalizePhone('1-970-555-1111'), '+19705551111');
  assert.equal(s.normalizePhone('555-1111'), null);
  assert.equal(s.isTextingQuietHours(NOON_MT, 'America/Denver'), false);
  assert.equal(s.isTextingQuietHours(NIGHT_MT, 'America/Denver'), true);
  assert.equal(s.isTextingQuietHours(new Date('2026-10-14T13:59:00Z'), 'America/Denver'), true, '7:59am is too early');
  assert.equal(s.isTextingQuietHours(new Date('2026-10-14T14:00:00Z'), 'America/Denver'), false, '8am is fine');
  assert.equal(s.isTextingQuietHours(new Date('2026-10-15T01:00:00Z'), 'America/New_York'), true, '9pm Eastern');
  // Twilio's documented example signature.
  assert.equal(
    s.twilioSignature('https://mycompany.com/myapp.php?foo=1&bar=2',
      { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' },
      '12345'),
    '0/KCTR6DLpKmkAf8muzZqo1nDgQ='
  );
});

test('without Twilio, texting isn’t set up and nothing sends', { skip }, async () => {
  await optIn(lena.id, peak.id);
  const s = await call('GET', '/admin/settings/sms', { auth: tok.owner });
  assert.equal(s.status, 200, s.text);
  assert.equal(s.json.data.status.ready, false);
  assert.equal(s.json.data.status.message, 'Texting isn’t set up yet.');
  assert.match(s.json.data.kit.opt_in_wording, /from Peak Realty/);
  assert.doesNotMatch(JSON.stringify(s.json.data.kit), /SAA Homes|saahomes/);
  const r = await call('POST', `/agent/crm/leads/${lena.id}/texts`, { auth: tok.agent, body: { body: 'Hi Lena' } });
  assert.equal(r.status, 422);
  assert.equal(r.json.reason, 'not_set_up');
  assert.equal(twilio.length, 0);
  assert.equal((await inbound({ From: '+19705551111', To: '+19705550199', Body: 'STOP', MessagingServiceSid: PEAK_SID })).status, 403, 'no token, no trust');
});

test('a brokerage turns texting on; texts need consent and daytime', { skip }, async () => {
  setEnv();
  const off = await call('GET', '/admin/settings/sms', { auth: tok.owner });
  assert.equal(off.json.data.status.reason, 'off', 'a new brokerage turns it on itself');
  assert.equal((await call('POST', `/agent/crm/leads/${lena.id}/texts`, { auth: tok.agent, body: { body: 'Hi' } })).json.reason, 'off');
  assert.equal((await call('PATCH', '/admin/settings/sms', { auth: tok.owner, body: { messaging_service_sid: 'nope' } })).status, 400);
  assert.equal((await call('PATCH', '/admin/settings/sms', { auth: tok.agent, body: { enabled: true } })).status, 403);
  const on = await call('PATCH', '/admin/settings/sms', { auth: tok.owner, body: { enabled: true } });
  assert.equal(on.status, 200, on.text);
  assert.equal(on.json.data.status.ready, true);
  assert.deepEqual(on.json.data.numbers, ['(970) 555-0199']);

  // No consent: refused, nothing sent.
  const no = await call('POST', `/agent/crm/leads/${otto.id}/texts`, { auth: tok.agent, body: { body: 'Hi Otto' } });
  assert.equal(no.status, 422);
  assert.equal(no.json.reason, 'no_consent');
  assert.match(no.json.error, /hasn’t agreed/);
  assert.equal(twilio.length, 0);

  // Consent: sent from Peak's own messaging service, with the STOP line the first time.
  const ok = await call('POST', `/agent/crm/leads/${lena.id}/texts`, { auth: tok.agent, body: { body: 'Hi Lena, it’s Andy. Free Saturday?' } });
  assert.equal(ok.status, 201, ok.text);
  assert.equal(twilio.length, 1);
  assert.match(twilio[0].url, /\/Accounts\/ACtest\/Messages\.json$/);
  assert.equal(twilio[0].form.To, '+19705551111');
  assert.equal(twilio[0].form.MessagingServiceSid, PEAK_SID);
  assert.match(twilio[0].form.Body, /Reply STOP to opt out\.$/);
  assert.ok((await q('SELECT first_contacted_at FROM users WHERE id = $1', [lena.id])).rows[0].first_contacted_at);
  await call('POST', `/agent/crm/leads/${lena.id}/texts`, { auth: tok.agent, body: { body: 'Second one' } });
  assert.equal(twilio[1].form.Body, 'Second one', 'the STOP line only on the first text');

  // 11pm: refused.
  sms.smsTransport.now = () => NIGHT_MT;
  const night = await call('POST', `/agent/crm/leads/${lena.id}/texts`, { auth: tok.agent, body: { body: 'Late' } });
  assert.equal(night.json.reason, 'quiet_hours');
  assert.equal(twilio.length, 2);
  sms.smsTransport.now = () => NOON_MT;
});

test('STOP is checked, recorded per brokerage, and honored; START and HELP work', { skip }, async () => {
  setEnv();
  // Bad or missing signatures are refused.
  assert.equal((await inbound({ From: '+19705551111', Body: 'STOP', MessagingServiceSid: PEAK_SID }, { signature: 'bm9wZQ==' })).status, 403);
  assert.equal((await inbound({ From: '+19705551111', Body: 'STOP', MessagingServiceSid: PEAK_SID }, { signature: null })).status, 403);
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM sms_opt_outs')).rows[0].n, 0);

  const stop = await inbound({ From: '+19705551111', To: '+19705550199', Body: ' Stop ', MessagingServiceSid: PEAK_SID, MessageSid: 'SMin1' });
  assert.equal(stop.status, 200);
  const { rows: outs } = await q('SELECT tenant_id, phone FROM sms_opt_outs');
  assert.deepEqual(outs.map((r) => [r.tenant_id, r.phone]), [[peak.id, '+19705551111']], 'only Peak, not Summit');
  const { rows: [consent] } = await q(
    "SELECT status, source FROM contact_consents WHERE user_id = $1 AND channel = 'sms' ORDER BY id DESC LIMIT 1", [lena.id]
  );
  assert.deepEqual(consent, { status: 'revoked', source: 'sms_stop' });

  const sentBefore = twilio.length;
  const blocked = await call('POST', `/agent/crm/leads/${lena.id}/texts`, { auth: tok.agent, body: { body: 'Still there?' } });
  assert.equal(blocked.status, 422);
  assert.ok(['opted_out', 'no_consent'].includes(blocked.json.reason));
  assert.equal(twilio.length, sentBefore);

  // The same person at Summit can still hear from Summit.
  await optIn(lenaSummit.id, summit.id);
  const other = await call('POST', `/agent/crm/leads/${lenaSummit.id}/texts`, { auth: tok.summit, host: SUMMIT, body: { body: 'Hi from Summit' } });
  assert.equal(other.status, 201, other.text);
  assert.equal(twilio.at(-1).form.MessagingServiceSid, SUMMIT_SID);

  const help = await inbound({ From: '+19705551111', To: '+19705550199', Body: 'HELP', MessagingServiceSid: PEAK_SID });
  assert.match(help.text, /<Message>Peak Realty: For help, call \(970\) 555-0100\./);
  assert.match(help.text, /Reply STOP to opt out/);

  const start = await inbound({ From: '+19705551111', To: '+19705550199', Body: 'START', MessagingServiceSid: PEAK_SID });
  assert.equal(start.status, 200);
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM sms_opt_outs WHERE tenant_id = $1', [peak.id])).rows[0].n, 0);
  const again = await call('POST', `/agent/crm/leads/${lena.id}/texts`, { auth: tok.agent, body: { body: 'Welcome back' } });
  assert.equal(again.status, 201, again.text);
});

test('replies land in the lead’s thread; texting first counts as consent', { skip }, async () => {
  setEnv();
  const r = await inbound({ From: '+19705552222', To: '+19705550199', Body: 'Is the Elm St house still available?', MessagingServiceSid: PEAK_SID, MessageSid: 'SMin9' });
  assert.equal(r.status, 200);
  const thread = await call('GET', `/agent/crm/leads/${otto.id}/texts`, { auth: tok.agent });
  assert.equal(thread.status, 200);
  assert.deepEqual(thread.json.data.messages.map((m) => [m.direction, m.body]), [['in', 'Is the Elm St house still available?']]);
  assert.equal(thread.json.data.texting.can_text, true);
  const { rows: [c] } = await q("SELECT source FROM contact_consents WHERE user_id = $1 AND channel = 'sms' ORDER BY id DESC LIMIT 1", [otto.id]);
  assert.equal(c.source, 'sms_inbound');
  // Summit's owner can't read Peak's thread.
  assert.equal((await call('GET', `/agent/crm/leads/${otto.id}/texts`, { auth: tok.summit, host: SUMMIT })).status, 404);

  // Delivery receipts update the message.
  const sent = await call('POST', `/agent/crm/leads/${otto.id}/texts`, { auth: tok.agent, body: { body: 'Yes it is!' } });
  const sid = (await q('SELECT provider_id FROM lead_messages WHERE id = $1', [sent.json.data.id])).rows[0].provider_id;
  const st = await inbound({ MessageSid: sid, MessageStatus: 'delivered' }, { path: '/sms/status' });
  assert.equal(st.status, 204);
  assert.equal((await q('SELECT status FROM lead_messages WHERE id = $1', [sent.json.data.id])).rows[0].status, 'delivered');
});

test('saved-search text alerts go to opted-in buyers, in the daytime, once', { skip }, async () => {
  setEnv();
  const buyer = await mkUser(peak.id, 'tia@buyer.test', 'client', { name: 'Tia Texter', phone: '9705553333' });
  const silent = await mkUser(peak.id, 'nia@buyer.test', 'client', { name: 'Nia No', phone: '9705554444' });
  await optIn(buyer.id, peak.id);
  const filters = { city: 'Windsor', beds: 3 };
  for (const u of [buyer, silent]) {
    await q(`INSERT INTO saved_searches (user_id, name, filters, sms_cursor_at) VALUES ($1, 'Windsor 3 bed', $2, NOW() - INTERVAL '1 hour')`, [u.id, JSON.stringify(filters)]);
  }
  await insertListing(db.pool, { city: 'Windsor', beds: 4, list_price: 610000, street_number: '77', street_name: 'Main St' });

  sms.smsTransport.now = () => NIGHT_MT;
  const quiet = await sms.runSmsAlertPass({ now: NIGHT_MT, pool: db.pool });
  assert.equal(quiet.texted, 0);
  assert.equal(quiet.skipped_quiet >= 1, true);

  sms.smsTransport.now = () => NOON_MT;
  const before = twilio.length;
  const pass = await sms.runSmsAlertPass({ now: NOON_MT, pool: db.pool });
  assert.equal(pass.texted, 1, JSON.stringify(pass));
  const text = twilio.at(-1).form;
  assert.equal(text.To, '+19705553333');
  assert.match(text.Body, /^Peak Realty: New match for "Windsor 3 bed": 77 Main St, Windsor, \$610K\. https:\/\/peak-sms\.test\/homes-for-sale\//);
  assert.match(text.Body, /Reply STOP to opt out\.$/);
  assert.equal(twilio.length, before + 1, 'nobody without consent');
  assert.equal((await sms.runSmsAlertPass({ now: NOON_MT, pool: db.pool })).texted, 0, 'not twice');
});

test('tour texts: confirmation from the cockpit, then a reminder', { skip }, async () => {
  setEnv();
  const { rows: [tour] } = await q(
    `INSERT INTO tour_requests (tenant_id, user_id, listing_keys, windows) VALUES ($1, $2, ARRAY['A','B'], '[]'::jsonb) RETURNING id`,
    [peak.id, lena.id]
  );
  const start = new Date(NOON_MT.getTime() + 20 * 3600000); // tomorrow 8am Mountain
  // The cockpit refuses a tour time already in the past, compared against the real
  // wall clock. This file's simulated noon (NOON_MT) is a fixed date, so once the
  // calendar passes it the still-fixed "tomorrow" is rejected. Pin the clock to the
  // same simulated now for the request so the test doesn't rot as the date moves.
  const wallClock = Date.now;
  Date.now = () => NOON_MT.getTime();
  let r;
  try {
    r = await call('POST', `/agent/crm/tours/${tour.id}/confirm`, { auth: tok.agent, body: { start: start.toISOString() } });
  } finally {
    Date.now = wallClock;
  }
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.texted, true);
  assert.match(twilio.at(-1).form.Body, /^Peak Realty: You're all set! Your tour of 2 homes is confirmed for Thu, Oct 15, 8:00 AM with Andy\./);
  assert.equal((await call('POST', `/agent/crm/tours/${tour.id}/confirm`, { auth: tok.summit, host: SUMMIT, body: { start: start.toISOString() } })).status, 404);

  const n = twilio.length;
  await sms.runSmsAlertPass({ now: NOON_MT, pool: db.pool });
  assert.equal(twilio.length, n + 1);
  assert.match(twilio.at(-1).form.Body, /Reminder: your home tour is Thu, Oct 15, 8:00 AM with Andy\./);
  await sms.runSmsAlertPass({ now: NOON_MT, pool: db.pool });
  assert.equal(twilio.length, n + 1, 'one reminder');
});
