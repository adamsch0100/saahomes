/**
 * Team inbox: inbound texts, email replies (Postmark, Resend, SendGrid),
 * website forms and Nadia handoffs land in one shared list per brokerage;
 * each person sees only the conversations their lead visibility allows;
 * claim, assign, done and unread counts work; replies go out by text or
 * email in the brokerage's brand. Twilio and email are mocked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-inbox';
process.env.CRM_SCHEDULER = 'off';
process.env.ACTION_PLAN_SCHEDULER = 'off';
process.env.ACTION_PLAN_KICK = 'off';
process.env.HOT_LEAD_ALERTS = 'off';
delete process.env.TWILIO_MESSAGING_SERVICE_SID;

const PEAK = 'peak-inbox.test';
const SUMMIT = 'summit-inbox.test';
const PEAK_SID = `MG${'c'.repeat(32)}`;
const TOKEN = 'twilio-inbox-token';
const NOON_MT = new Date('2026-10-14T18:00:00Z');
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let summit;
let peakKey;
let summitKey;
const staff = {};
const tok = {};
const lead = {};
let texts = [];
let pushes = [];

async function call(method, path, { auth, body, host = PEAK, headers = {}, raw = null } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': host, ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* xml */ }
  return { status: res.status, json, text };
}

function sign(url, params) {
  const data = Object.keys(params).sort().reduce((a, k) => a + k + params[k], url);
  return crypto.createHmac('sha1', TOKEN).update(data).digest('base64');
}

async function inboundText(params) {
  const url = `${server.url}/api/sms/inbound`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-Host': PEAK, 'X-Twilio-Signature': sign(url, params) },
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
const threadFor = async (leadId) => (await q('SELECT * FROM inbox_threads WHERE lead_id = $1', [leadId])).rows[0];
const waitFor = async (fn) => {
  // Intake finishes after the response goes out; give a busy test run time.
  for (let i = 0; i < 200; i += 1) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
};

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  process.env.TWILIO_ACCOUNT_SID = 'ACinbox';
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  const sms = await import('../src/services/smsService.js');
  sms.smsTransport.now = () => NOON_MT;
  sms.smsTransport.fetch = async (url, init) => {
    texts.push(Object.fromEntries(new URLSearchParams(init?.body || '')));
    return new Response(JSON.stringify({ sid: `SMout${texts.length}`, status: 'queued' }), { status: 201 });
  };
  const hot = await import('../src/services/hotLeads.js');
  hot.hotTransport.push = async (sub, payload) => { pushes.push({ endpoint: sub.endpoint, payload }); };

  ({ rows: [peak] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peakinbox', 'Peak Realty', $1, $2) RETURNING *",
    [PEAK, JSON.stringify({ sms: { messaging_service_sid: PEAK_SID, enabled: true }, inbound: { reply_to: 'team@reply.peak.test' } })]
  ));
  ({ rows: [summit] } = await q("INSERT INTO tenants (slug, name, primary_domain) VALUES ('summitinbox', 'Summit Homes', $1) RETURNING *", [SUMMIT]));
  staff.owner = await mkUser(peak.id, 'olive@peak.test', 'admin', { name: 'Olive Owner' });
  staff.andy = await mkUser(peak.id, 'andy@peak.test', 'agent', { name: 'Andy Agent' });
  staff.bea = await mkUser(peak.id, 'bea@peak.test', 'agent', { name: 'Bea Broker' });
  staff.sam = await mkUser(summit.id, 'sam@summit.test', 'admin', { name: 'Sam Summit' });
  const { generateToken } = await import('../src/middleware/auth.js');
  for (const [k, u] of Object.entries(staff)) tok[k] = generateToken({ id: u.id, email: u.email, role: u.role, tenant_id: u.tenant_id });
  await q("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, tenant_id) VALUES ($1, 'https://push.test/andy', 'k', 'a', $2)", [staff.andy.id, peak.id]);
  lead.lena = await mkUser(peak.id, 'lena@buyer.test', 'client', { name: 'Lena Lead', phone: '9705551111', assigned: staff.andy.id });
  lead.ben = await mkUser(peak.id, 'ben@buyer.test', 'client', { name: 'Ben Buyer', phone: '9705552222', assigned: staff.bea.id });
  lead.pat = await mkUser(peak.id, 'pat@buyer.test', 'client', { name: 'Pat Pool', phone: '9705553333' });
  lead.summit = await mkUser(summit.id, 'lena@buyer.test', 'client', { name: 'Lena at Summit', phone: '9705551111' });
  await q(`INSERT INTO contact_consents (tenant_id, user_id, channel, status, wording, source) VALUES ($1, $2, 'sms', 'granted', 'Text me', 'form')`, [peak.id, lead.lena.id]);
  const { ensureIntakeKey } = await import('../src/services/leadIntake.js');
  peakKey = await ensureIntakeKey(peak.id, db.pool);
  summitKey = await ensureIntakeKey(summit.id, db.pool);
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('an inbound text lands on the lead’s thread, unread, for their agent', { skip }, async () => {
  const r = await inboundText({ From: '+19705551111', To: '+19705550199', Body: 'Can we see the Elm St house Saturday?', MessagingServiceSid: PEAK_SID, MessageSid: 'SMin1' });
  assert.equal(r.status, 200, r.text);
  const t = await threadFor(lead.lena.id);
  assert.ok(t, 'thread created');
  assert.equal(t.tenant_id, peak.id);
  assert.equal(t.assignee_id, staff.andy.id);
  assert.equal(t.last_kind, 'text');
  assert.equal(await threadFor(lead.summit.id), undefined, 'the same number at another brokerage gets nothing');

  const list = await call('GET', '/agent/inbox', { auth: tok.andy });
  assert.equal(list.status, 200, list.text);
  const row = list.json.data.threads.find((x) => x.lead_id === lead.lena.id);
  assert.equal(row.unread, true);
  assert.match(row.preview, /Elm St/);
  assert.equal(list.json.data.counts.unread, 1);

  // A stranger texting in gets their own thread (in the pond).
  await inboundText({ From: '+13035550000', To: '+19705550199', Body: 'Is 12 Oak still for sale?', MessagingServiceSid: PEAK_SID, MessageSid: 'SMin2' });
  const stranger = (await q("SELECT * FROM inbox_threads WHERE tenant_id = $1 AND contact_key = '+13035550000'", [peak.id])).rows[0];
  assert.ok(stranger);
  assert.equal(stranger.lead_id, null);
  const thread = await call('GET', `/agent/inbox/${stranger.id}`, { auth: tok.bea });
  assert.equal(thread.status, 200);
  assert.ok(thread.json.data.messages.some((m) => /12 Oak/.test(m.body)), 'texts from strangers show in their thread');
});

test('email replies come in from Postmark, Resend and SendGrid; bad keys are refused', { skip }, async () => {
  pushes = [];
  // Postmark (JSON), key in the path.
  const pm = await call('POST', `/inbound/email/${peakKey}`, {
    host: 'anything.test',
    body: {
      From: 'Lena Lead <lena@buyer.test>', FromFull: { Email: 'lena@buyer.test', Name: 'Lena Lead' },
      To: 'team@reply.peak.test', Subject: 'Re: Welcome, Lena',
      TextBody: 'Saturday works!\n\nOn Tue, Oct 13, 2026 at 9:00 AM Andy Agent <andy@peak.test> wrote:\n> Welcome',
      StrippedTextReply: 'Saturday works!', MessageID: 'pm-1',
    },
  });
  assert.equal(pm.status, 201, pm.text);
  assert.equal(pm.json.kind, 'reply');
  const { rows: [m] } = await q("SELECT * FROM lead_messages WHERE lead_id = $1 AND channel = 'email' AND direction = 'in'", [lead.lena.id]);
  assert.equal(m.body, 'Saturday works!');
  assert.equal(m.tenant_id, peak.id);
  assert.ok(await waitFor(() => pushes.some((p) => p.endpoint === 'https://push.test/andy' && /emailed you/.test(p.payload.title))), 'Andy hears about it');

  // Resend (JSON, data envelope), key as a header.
  const rs = await call('POST', '/inbound/email', {
    headers: { 'X-Intake-Key': peakKey },
    body: { type: 'email.received', data: { from: 'ben@buyer.test', to: ['team@reply.peak.test'], subject: 'Question', text: 'Is the HOA high?\n> old stuff', email_id: 'rs-1' } },
  });
  assert.equal(rs.status, 201, rs.text);
  const ben = await threadFor(lead.ben.id);
  assert.equal(ben.last_kind, 'email');

  // SendGrid Inbound Parse (multipart), key as basic auth password.
  const boundary = 'xYzBoundary';
  const part = (name, value) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  const raw = `${part('from', 'Pat Pool <pat@buyer.test>')}${part('to', 'team@reply.peak.test')}${part('subject', 'Hello')}${part('text', 'Any new listings in Loveland?')}--${boundary}--\r\n`;
  const sg = await call('POST', '/inbound/email', {
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, Authorization: `Basic ${Buffer.from(`inbound:${peakKey}`).toString('base64')}` },
    raw,
  });
  assert.equal(sg.status, 201, sg.text);
  assert.match((await threadFor(lead.pat.id)).last_preview, /Loveland/);

  // Wrong or another brokerage's key.
  assert.equal((await call('POST', '/inbound/email/t1_00000000000000000000000000000000', { body: { from: 'lena@buyer.test', text: 'x' } })).status, 401);
  assert.equal((await call('POST', '/inbound/email', { body: { from: 'lena@buyer.test', text: 'x' } })).status, 401);
  const crossed = await call('POST', `/inbound/email/${summitKey}`, { body: { from: 'ben@buyer.test', subject: 'x', text: 'to summit' } });
  assert.equal(crossed.status, 201);
  const { rows: [st] } = await q('SELECT * FROM inbox_threads WHERE tenant_id = $1 AND contact_key = $2', [summit.id, 'ben@buyer.test']);
  assert.ok(st, 'a Summit key files under Summit only, as someone Summit doesn’t know');
  assert.equal(st.lead_id, null);
});

test('forms and Nadia handoffs land in the inbox, and become leads', { skip }, async () => {
  const form = await call('POST', '/contact', { body: { name: 'Carla Contact', email: 'carlacontact@gmail.com', phone: '970-555-4444', interest: 'Buying', message: 'Looking near Old Town' } });
  assert.ok([200, 201].includes(form.status), form.text);
  const carla = await waitFor(async () => (await q("SELECT * FROM users WHERE tenant_id = $1 AND email = 'carlacontact@gmail.com'", [peak.id])).rows[0]);
  assert.ok(carla, 'a brokerage’s form makes a lead');
  const t = await waitFor(() => threadFor(carla.id));
  const { rows: items } = await q('SELECT kind, body FROM inbox_items WHERE thread_id = $1', [t.id]);
  assert.ok(items.some((i) => i.kind === 'form' && /Old Town/.test(i.body)));

  await call('POST', '/contact', { body: { name: 'Nate Nadia', email: 'natenadia@gmail.com', interest: 'Chat Conversation Lead', message: 'Lead from Nadia chat: wants a 3 bed under 600k' } });
  const nate = await waitFor(async () => (await q("SELECT * FROM users WHERE tenant_id = $1 AND email = 'natenadia@gmail.com' AND 'Nadia chat' = ANY(tags)", [peak.id])).rows[0]);
  assert.ok(nate, 'tagged with where they came from');
  const nt = await waitFor(async () => { const th = await threadFor(nate.id); return th?.last_kind === 'nadia' ? th : null; });
  assert.ok(nt, 'the Nadia handoff lands in the inbox');
});

test('visibility: agents see their own and the pond; owners see all; other brokerages see nothing', { skip }, async () => {
  const lena = await threadFor(lead.lena.id);
  const ben = await threadFor(lead.ben.id);
  const pat = await threadFor(lead.pat.id);
  const ids = (r) => r.json.data.threads.map((t) => t.id);
  const andy = await call('GET', '/agent/inbox?filter=all', { auth: tok.andy });
  assert.ok(ids(andy).includes(lena.id));
  assert.ok(!ids(andy).includes(ben.id), 'Bea’s lead is hidden from Andy');
  assert.ok(ids(andy).includes(pat.id), 'unassigned leads are in the pond');
  assert.equal((await call('GET', `/agent/inbox/${ben.id}`, { auth: tok.andy })).status, 404);
  assert.equal((await call('POST', `/agent/inbox/${ben.id}/claim`, { auth: tok.andy })).status, 404);
  const owner = await call('GET', '/agent/inbox?filter=all', { auth: tok.owner });
  assert.ok([lena.id, ben.id, pat.id].every((id) => ids(owner).includes(id)));
  // Another brokerage, on its own host or Peak's.
  const sam = await call('GET', '/agent/inbox?filter=all', { auth: tok.sam, host: SUMMIT });
  assert.equal(sam.status, 200);
  assert.ok(!ids(sam).some((id) => [lena.id, ben.id, pat.id].includes(id)));
  assert.equal((await call('GET', `/agent/inbox/${lena.id}`, { auth: tok.sam, host: SUMMIT })).status, 404);
  assert.equal((await call('GET', '/agent/inbox', { auth: tok.sam })).status, 403);
  // "Only their own": the pond goes away.
  await q(`UPDATE tenants SET settings = settings || '{"lead_visibility":"own"}' WHERE id = $1`, [peak.id]);
  (await import('../src/services/tenantContext.js')).clearTenantCache();
  assert.ok(!ids(await call('GET', '/agent/inbox?filter=all', { auth: tok.andy })).includes(pat.id));
  await q(`UPDATE tenants SET settings = settings || '{"lead_visibility":"own_and_unassigned"}' WHERE id = $1`, [peak.id]);
  (await import('../src/services/tenantContext.js')).clearTenantCache();
});

test('claim, assign, done, reopen and unread counts', { skip }, async () => {
  const pat = await threadFor(lead.pat.id);
  let counts = (await call('GET', '/agent/inbox/counts', { auth: tok.bea })).json.data;
  const unreadBefore = counts.unread;
  assert.ok(unreadBefore >= 1);
  await call('GET', `/agent/inbox/${pat.id}`, { auth: tok.bea });
  counts = (await call('GET', '/agent/inbox/counts', { auth: tok.bea })).json.data;
  assert.equal(counts.unread, unreadBefore - 1, 'opening a conversation marks it read for that person only');

  const claim = await call('POST', `/agent/inbox/${pat.id}/claim`, { auth: tok.bea });
  assert.equal(claim.status, 200, claim.text);
  assert.equal(claim.json.data.assignee_name, 'Bea Broker');
  const { rows: [u] } = await q('SELECT assigned_agent_id FROM users WHERE id = $1', [lead.pat.id]);
  assert.equal(u.assigned_agent_id, staff.bea.id, 'claiming assigns the lead');
  // Now it's Bea's: Andy can't see or take it.
  assert.equal((await call('POST', `/agent/inbox/${pat.id}/claim`, { auth: tok.andy })).status, 404);
  // The owner hands it to Andy.
  assert.equal((await call('POST', `/agent/inbox/${pat.id}/assign`, { auth: tok.owner, body: { agent_id: staff.sam.id } })).status, 400, 'not on the team');
  const assign = await call('POST', `/agent/inbox/${pat.id}/assign`, { auth: tok.owner, body: { agent_id: staff.andy.id } });
  assert.equal(assign.json.data.assignee_name, 'Andy Agent');
  assert.equal((await call('GET', '/agent/inbox?filter=mine', { auth: tok.andy })).json.data.threads.some((t) => t.id === pat.id), true);

  const done = await call('POST', `/agent/inbox/${pat.id}/done`, { auth: tok.andy });
  assert.equal(done.json.data.status, 'done');
  assert.ok(!(await call('GET', '/agent/inbox', { auth: tok.andy })).json.data.threads.some((t) => t.id === pat.id));
  assert.ok((await call('GET', '/agent/inbox?filter=done', { auth: tok.andy })).json.data.threads.some((t) => t.id === pat.id));
  // They write again: back to open, unread.
  await call('POST', `/inbound/email/${peakKey}`, { body: { from: 'pat@buyer.test', subject: 'One more', text: 'Also, is there a garage?' } });
  const again = await threadFor(lead.pat.id);
  assert.equal(again.status, 'open');
  const row = (await call('GET', '/agent/inbox', { auth: tok.andy })).json.data.threads.find((t) => t.id === pat.id);
  assert.equal(row.unread, true);
});

test('replies go out by text or email from the thread, in the brokerage’s brand', { skip }, async () => {
  texts = [];
  const lena = await threadFor(lead.lena.id);
  const sms = await call('POST', `/agent/inbox/${lena.id}/reply`, { auth: tok.andy, body: { channel: 'sms', body: 'Saturday at 10 works. See you there!' } });
  assert.equal(sms.status, 201, sms.text);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].To, '+19705551111');
  assert.equal(texts[0].MessagingServiceSid, PEAK_SID);
  assert.ok(sms.json.data.messages.some((m) => m.direction === 'out' && /Saturday at 10/.test(m.body)));

  const em = await call('POST', `/agent/inbox/${lena.id}/reply`, { auth: tok.andy, body: { channel: 'email', subject: 'Re: Welcome, Lena', body: 'Great, see you Saturday.' } });
  assert.equal(em.status, 201, em.text);
  const { rows: [out] } = await q("SELECT * FROM lead_messages WHERE lead_id = $1 AND channel = 'email' AND direction = 'out' ORDER BY id DESC LIMIT 1", [lead.lena.id]);
  assert.equal(out.subject, 'Re: Welcome, Lena');
  const { rows: [queued] } = await q("SELECT html FROM email_outbox WHERE to_email = 'lena@buyer.test' ORDER BY id DESC LIMIT 1");
  assert.ok(queued, 'with no mail server set up the email waits in the outbox');
  assert.match(queued.html, /Great, see you Saturday/);
  assert.doesNotMatch(queued.html, /saahomes|Search Ascend/i);

  // No consent: the reply is refused with a reason (nothing sent).
  const ben = await threadFor(lead.ben.id);
  const no = await call('POST', `/agent/inbox/${ben.id}/reply`, { auth: tok.bea, body: { channel: 'sms', body: 'Hi Ben' } });
  assert.equal(no.status, 422);
  assert.equal(no.json.reason, 'no_consent');
  assert.equal(texts.length, 1);
});

test('a stranger can be added as a lead from their conversation', { skip }, async () => {
  const { rows: [t] } = await q("SELECT * FROM inbox_threads WHERE tenant_id = $1 AND contact_key = '+13035550000'", [peak.id]);
  assert.equal((await call('POST', `/agent/inbox/${t.id}/reply`, { auth: tok.owner, body: { channel: 'sms', body: 'Hi' } })).status, 422);
  const made = await call('POST', `/agent/inbox/${t.id}/lead`, { auth: tok.owner });
  assert.equal(made.status, 201, made.text);
  const { rows: [u] } = await q('SELECT * FROM users WHERE id = $1', [made.json.data.lead_id]);
  assert.equal(u.tenant_id, peak.id);
  assert.equal(u.phone, '+13035550000');
  const view = await call('GET', `/agent/inbox/${made.json.data.thread_id}`, { auth: tok.owner });
  assert.equal(view.json.data.lead_id, u.id);
  assert.ok(view.json.data.messages.some((m) => /12 Oak/.test(m.body)), 'the earlier text moved with them');
  assert.equal(view.json.data.email, null, 'no made-up email is shown');
});
