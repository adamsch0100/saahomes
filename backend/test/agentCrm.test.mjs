/**
 * The cockpit's light CRM: notes, tasks and the lead timeline stay inside
 * one brokerage and follow its lead visibility; hot-lead alerts dedupe and
 * respect each agent's settings; reply drafts never send on their own; and
 * owner reports only count their own brokerage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-crm';
process.env.CRM_SCHEDULER = 'off';
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_MESSAGING_SERVICE_SID;
delete process.env.OPENCODE_GO_API_KEY;

const PEAK = 'peak-crm.test';
const SUMMIT = 'summit-crm.test';
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let summit;
const staff = {};
const tok = {};
const lead = {};
let outbound = [];

async function call(method, path, { auth, body, host = PEAK } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': host, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* csv */ }
  return { status: res.status, json, text, headers: res.headers };
}

const q = (sql, p) => db.pool.query(sql, p);
const mkUser = async (tenantId, email, role, extra = {}) => (await q(
  `INSERT INTO users (email, name, role, status, manage_token, tenant_id, phone, assigned_agent_id, created_at)
   VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, COALESCE($8, NOW())) RETURNING *`,
  [email, extra.name || email.split('@')[0], role, crypto.randomBytes(16).toString('hex'), tenantId,
    extra.phone || null, extra.assigned || null, extra.created_at || null]
)).rows[0];
const addEvent = async (userId, type, { listingId = null, meta = {}, at = null } = {}) => (await q(
  `INSERT INTO events (tenant_id, user_id, type, listing_id, meta, occurred_at)
   VALUES ((SELECT tenant_id FROM users WHERE id = $1), $1, $2, $3, $4::jsonb, COALESCE($5, NOW())) RETURNING *`,
  [userId, type, listingId, JSON.stringify(meta), at]
)).rows[0];

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  ({ rows: [peak] } = await q("INSERT INTO tenants (slug, name, primary_domain) VALUES ('peakcrm', 'Peak Realty', $1) RETURNING *", [PEAK]));
  ({ rows: [summit] } = await q("INSERT INTO tenants (slug, name, primary_domain) VALUES ('summitcrm', 'Summit Homes', $1) RETURNING *", [SUMMIT]));
  staff.owner = await mkUser(peak.id, 'olive@peak.test', 'admin', { name: 'Olive Owner' });
  staff.andy = await mkUser(peak.id, 'andy@peak.test', 'agent', { name: 'Andy Agent', phone: '9705550001' });
  staff.bea = await mkUser(peak.id, 'bea@peak.test', 'agent', { name: 'Bea Broker' });
  staff.sam = await mkUser(summit.id, 'sam@summit.test', 'admin', { name: 'Sam Summit' });
  const { generateToken } = await import('../src/middleware/auth.js');
  for (const [k, u] of Object.entries(staff)) {
    tok[k] = generateToken({ id: u.id, email: u.email, role: u.role, tenant_id: u.tenant_id });
  }
  lead.andy = await mkUser(peak.id, 'lena@buyer.test', 'client', { name: 'Lena Lead', phone: '9705551111', assigned: staff.andy.id });
  lead.bea = await mkUser(peak.id, 'ben@buyer.test', 'client', { name: 'Ben Buyer', assigned: staff.bea.id });
  lead.pool = await mkUser(peak.id, 'pat@buyer.test', 'client', { name: 'Pat Pool' });
  lead.summit = await mkUser(summit.id, 'lena@buyer.test', 'client', { name: 'Lena Elsewhere' });

  const hot = await import('../src/services/hotLeads.js');
  hot.hotTransport.push = async (sub, payload) => { outbound.push({ sub: sub.endpoint, payload }); };
  hot.hotTransport.text = async () => ({ ok: false, reason: 'not_set_up' });
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('notes: add, pin, edit, delete, only on leads the agent can see', { skip }, async () => {
  const add = await call('POST', `/agent/crm/leads/${lead.andy.id}/notes`, { auth: tok.andy, body: { body: 'Wants a big yard for the dog', pinned: true } });
  assert.equal(add.status, 201, add.text);
  assert.equal(add.json.data.author_name, 'Andy Agent');
  assert.equal(add.json.data.pinned, true);
  const noteId = add.json.data.id;

  // Another agent's lead is out of sight (own_and_unassigned), across brokerages too.
  assert.equal((await call('POST', `/agent/crm/leads/${lead.bea.id}/notes`, { auth: tok.andy, body: { body: 'x' } })).status, 404);
  assert.equal((await call('POST', `/agent/crm/leads/${lead.andy.id}/notes`, { auth: tok.sam, host: SUMMIT, body: { body: 'x' } })).status, 404);
  assert.equal((await call('POST', `/agent/crm/leads/${lead.andy.id}/notes`, { auth: tok.sam, body: { body: 'x' } })).status, 403);
  assert.equal((await call('PATCH', `/agent/crm/notes/${noteId}`, { auth: tok.bea, body: { body: 'hijack' } })).status, 404);
  assert.equal((await call('GET', `/agent/crm/leads/${lead.andy.id}`, { auth: tok.sam, host: SUMMIT })).status, 404);

  // Unassigned leads are in the shared pond.
  assert.equal((await call('POST', `/agent/crm/leads/${lead.pool.id}/notes`, { auth: tok.bea, body: { body: 'Left a voicemail', kind: 'call' } })).status, 201);
  const { rows: [touched] } = await q('SELECT first_contacted_at FROM users WHERE id = $1', [lead.pool.id]);
  assert.ok(touched.first_contacted_at, 'a logged call counts as first contact');

  const edit = await call('PATCH', `/agent/crm/notes/${noteId}`, { auth: tok.owner, body: { body: 'Wants a big yard for two dogs' } });
  assert.equal(edit.status, 200, edit.text);
  assert.equal(edit.json.data.edited_by_name, 'Olive Owner');
  assert.ok(edit.json.data.updated_at);

  // "Only own" visibility: Bea loses the pond.
  await q(`UPDATE tenants SET settings = settings || '{"lead_visibility":"own"}' WHERE id = $1`, [peak.id]);
  (await import('../src/services/tenantContext.js')).clearTenantCache();
  assert.equal((await call('GET', `/agent/crm/leads/${lead.pool.id}`, { auth: tok.bea })).status, 404);
  assert.equal((await call('GET', `/agent/crm/leads/${lead.pool.id}`, { auth: tok.owner })).status, 200, 'owners see every lead');
  await q(`UPDATE tenants SET settings = settings || '{"lead_visibility":"own_and_unassigned"}' WHERE id = $1`, [peak.id]);
  (await import('../src/services/tenantContext.js')).clearTenantCache();

  const del = await call('DELETE', `/agent/crm/notes/${noteId}`, { auth: tok.andy });
  assert.equal(del.status, 200);
  const detail = await call('GET', `/agent/crm/leads/${lead.andy.id}`, { auth: tok.andy });
  assert.equal(detail.json.data.notes.length, 0);
});

test('tasks: due today shows for the assignee and in their morning brief', { skip }, async () => {
  const due = new Date(Date.now() + 60 * 1000).toISOString();
  const t = await call('POST', `/agent/crm/leads/${lead.andy.id}/tasks`, { auth: tok.andy, body: { title: 'Call about the yard', kind: 'call', due_at: due } });
  assert.equal(t.status, 201, t.text);
  assert.equal(t.json.data.assignee_id, staff.andy.id);
  const overdue = await call('POST', `/agent/crm/leads/${lead.andy.id}/tasks`, { auth: tok.andy, body: { title: 'Send comps', due_at: new Date(Date.now() - 3 * 86400000).toISOString() } });
  assert.equal(overdue.status, 201);
  assert.equal((await call('POST', `/agent/crm/leads/${lead.andy.id}/tasks`, { auth: tok.andy, body: { title: 'x', assignee_id: staff.sam.id } })).status, 400, 'no assigning to another brokerage');

  const mine = await call('GET', '/agent/crm/tasks?scope=today', { auth: tok.andy });
  assert.deepEqual(mine.json.data.map((x) => x.title).sort(), ['Call about the yard', 'Send comps']);
  assert.equal(mine.json.data.find((x) => x.title === 'Send comps').overdue, true);
  assert.deepEqual((await call('GET', '/agent/crm/tasks?scope=today', { auth: tok.bea })).json.data, []);
  assert.deepEqual((await call('GET', '/agent/crm/tasks?scope=today', { auth: tok.sam, host: SUMMIT })).json.data, []);

  const { buildBrief } = await import('../src/services/morningBrief.js');
  const brief = await buildBrief({ ...staff.andy }, { pool: db.pool });
  assert.equal(brief.tasks.length, 2);

  const done = await call('PATCH', `/agent/crm/tasks/${t.json.data.id}`, { auth: tok.andy, body: { done: true } });
  assert.ok(done.json.data.done_at);
  assert.equal((await call('PATCH', `/agent/crm/tasks/${t.json.data.id}`, { auth: tok.bea, body: { done: false } })).status, 404);
  assert.equal((await call('GET', '/agent/crm/tasks?scope=today', { auth: tok.andy })).json.data.length, 1);
});

test('the timeline gathers everything about one lead and nothing else', { skip }, async () => {
  await q(`INSERT INTO listings (listing_id, status, is_active, city, state, street_number, street_name, list_price, slug, updated_at)
           VALUES ('CRM1', 'Active', TRUE, 'Fort Collins', 'CO', '12', 'Elm St', 525000, '12-elm-st-crm1', NOW())`);
  await addEvent(lead.andy.id, 'listing_view', { listingId: 'CRM1' });
  await addEvent(lead.andy.id, 'home_saved', { listingId: 'CRM1', meta: { list_price: 525000 } });
  await addEvent(lead.andy.id, 'home_reaction', { listingId: 'CRM1', meta: { reaction: 'love' } });
  await q(`INSERT INTO email_log (user_id, type, subject, to_email, open_count, first_open_at) VALUES ($1, 'digest', '3 new homes', 'lena@buyer.test', 2, NOW())`, [lead.andy.id]);
  await q(`INSERT INTO lead_messages (tenant_id, lead_id, channel, direction, body, status) VALUES ($1, $2, 'sms', 'in', 'Can we see Elm St?', 'received')`, [peak.id, lead.andy.id]);
  // The same person at another brokerage, and another lead here.
  await addEvent(lead.summit.id, 'listing_view', { listingId: 'CRM1' });
  await addEvent(lead.bea.id, 'home_saved', { listingId: 'CRM1' });
  await q(`INSERT INTO lead_notes (tenant_id, lead_id, author_name, body) VALUES ($1, $2, 'Sam', 'summit secret')`, [summit.id, lead.summit.id]);

  const r = await call('GET', `/agent/crm/leads/${lead.andy.id}`, { auth: tok.andy });
  assert.equal(r.status, 200, r.text);
  const titles = r.json.data.timeline.map((t) => t.title);
  assert.ok(titles.includes('Viewed 12 Elm St, Fort Collins'), titles.join(' | '));
  assert.ok(titles.includes('Saved 12 Elm St, Fort Collins ($525K)'));
  assert.ok(titles.includes('Loved 12 Elm St, Fort Collins'));
  assert.ok(titles.some((t) => t.startsWith('Opened “3 new homes”')));
  assert.ok(titles.includes('Text from lead'));
  assert.ok(titles.some((t) => t.startsWith('Task: Send comps')));
  assert.equal(r.json.data.timeline.filter((t) => t.kind === 'view').length, 1, 'other people’s views stay out');
  assert.doesNotMatch(JSON.stringify(r.json.data), /summit secret|Lena Elsewhere/);
  assert.equal(r.json.data.texting.can_text, false);
  assert.equal(r.json.data.texting.message, 'Texting isn’t set up yet.');
});

test('smart filters and note search on the cockpit list', { skip }, async () => {
  const old = new Date(Date.now() - 40 * 86400000);
  const quiet = await mkUser(peak.id, 'quinn@buyer.test', 'client', { name: 'Quinn Quiet', created_at: old, assigned: staff.andy.id });
  await addEvent(quiet.id, 'listing_view', { listingId: 'CRM1', at: new Date(Date.now() - 20 * 86400000) });
  const owner = await mkUser(peak.id, 'hana@buyer.test', 'client', { name: 'Hana Home', created_at: old, assigned: staff.andy.id });
  await q(`INSERT INTO home_profiles (user_id, address_line) VALUES ($1, '1 Oak Ct')`, [owner.id]).catch(async () => {
    await q('UPDATE users SET seller_heat = TRUE WHERE id = $1', [owner.id]);
  });
  await addEvent(owner.id, 'sign_in');
  await q(`INSERT INTO tour_requests (tenant_id, user_id, listing_keys, windows) VALUES ($1, $2, ARRAY['CRM1'], '[]'::jsonb)`, [peak.id, lead.andy.id]);
  await q(`INSERT INTO lead_notes (tenant_id, lead_id, author_name, body) VALUES ($1, $2, 'Andy', 'relocating from Denver')`, [peak.id, quiet.id]);

  const names = async (qs, who = tok.andy, prefix = '/agent') => (await call('GET', `${prefix}/cockpit?${qs}`, { auth: who })).json.data.map((l) => l.name).sort();
  assert.deepEqual(await names('smart=quiet'), ['Quinn Quiet']);
  assert.deepEqual(await names('smart=homeowners'), ['Hana Home']);
  assert.deepEqual(await names('smart=tour'), ['Lena Lead']);
  assert.ok((await names('smart=new')).includes('Lena Lead'));
  assert.ok(!(await names('smart=new')).includes('Quinn Quiet'));
  assert.deepEqual(await names('q=relocating'), ['Quinn Quiet']);
  assert.deepEqual(await names('smart=quiet', tok.owner, '/admin'), ['Quinn Quiet'], 'owner console filters too');
});

test('hot-lead alerts: right agent, once, and only on channels they want', { skip }, async () => {
  const { onLeadEvent } = await import('../src/services/hotLeads.js');
  const sub = async (userId, n) => q(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'p', 'a')`,
    [userId, `https://fcm.googleapis.com/fcm/send/crm-${n}`]
  );
  await sub(staff.andy.id, 'andy');
  await sub(staff.bea.id, 'bea');
  await sub(staff.owner.id, 'owner');
  outbound = [];

  const tour = await addEvent(lead.andy.id, 'tour_request', { meta: {} });
  const first = await onLeadEvent(tour, db.pool);
  assert.deepEqual(first.sent, [{ agent_id: staff.andy.id, channels: ['push'] }]);
  assert.equal(outbound.length, 1);
  assert.match(outbound[0].payload.title, /Lena Lead/);
  assert.equal(outbound[0].payload.url, `/agent/?lead=${lead.andy.id}`);

  // Same reason again within a day: nothing.
  const again = await onLeadEvent(await addEvent(lead.andy.id, 'tour_request', { meta: {} }), db.pool);
  assert.equal(again.skipped, 'dedupe');
  // Three views of one home right after: inside the half-hour lead window.
  let views;
  for (let i = 0; i < 3; i += 1) views = await addEvent(lead.andy.id, 'listing_view', { listingId: 'CRM1' });
  assert.equal((await onLeadEvent(views, db.pool)).skipped, 'dedupe');
  assert.equal(outbound.length, 1);

  // Bea turned push off: the alert is logged, nothing is pushed.
  await q(`UPDATE users SET notify_prefs = '{"hot_lead_push": false}' WHERE id = $1`, [staff.bea.id]);
  const off = await onLeadEvent(await addEvent(lead.bea.id, 'nadia_question', { meta: { topic: 'offer', asked: 'how much should I offer' } }), db.pool);
  assert.deepEqual(off.sent, [{ agent_id: staff.bea.id, channels: [] }]);
  assert.equal(outbound.length, 1);

  // Unassigned: the owners hear about it.
  const pooled = await onLeadEvent(await addEvent(lead.pool.id, 'home_value_view'), db.pool);
  assert.deepEqual(pooled.sent.map((s) => s.agent_id), [staff.owner.id]);
  assert.equal(outbound.at(-1).sub, 'https://fcm.googleapis.com/fcm/send/crm-owner');

  // Round-robin: the next agent gets it, and the lead.
  await q(`UPDATE tenants SET settings = settings || '{"hot_leads":{"unassigned":"round_robin"}}' WHERE id = $1`, [peak.id]);
  (await import('../src/services/tenantContext.js')).clearTenantCache();
  const rr1 = await mkUser(peak.id, 'rr1@buyer.test', 'client', { name: 'Robin One' });
  const rr2 = await mkUser(peak.id, 'rr2@buyer.test', 'client', { name: 'Robin Two' });
  const a1 = await onLeadEvent(await addEvent(rr1.id, 'showing_request'), db.pool);
  const a2 = await onLeadEvent(await addEvent(rr2.id, 'showing_request'), db.pool);
  const picked = [a1.sent[0].agent_id, a2.sent[0].agent_id];
  assert.deepEqual(picked.sort(), [staff.andy.id, staff.bea.id].sort(), 'turns go around');
  const { rows } = await q('SELECT assigned_agent_id FROM users WHERE id = ANY($1) ORDER BY id', [[rr1.id, rr2.id]]);
  assert.deepEqual(rows.map((r) => r.assigned_agent_id), [a1.sent[0].agent_id, a2.sent[0].agent_id]);

  // Coming back after 14+ days away.
  const back = await mkUser(peak.id, 'back@buyer.test', 'client', { name: 'Bo Back', assigned: staff.andy.id, created_at: new Date(Date.now() - 60 * 86400000) });
  await addEvent(back.id, 'listing_view', { listingId: 'CRM1', at: new Date(Date.now() - 30 * 86400000) });
  const ret = await onLeadEvent(await addEvent(back.id, 'sign_in'), db.pool);
  assert.equal(ret.sent[0].agent_id, staff.andy.id);
  const { rows: [why] } = await q('SELECT reason FROM hot_lead_alerts WHERE lead_id = $1', [back.id]);
  assert.equal(why.reason, 'back_after_quiet');

  // Three saves in a day.
  const saver = await mkUser(peak.id, 'saver@buyer.test', 'client', { name: 'Sy Saver', assigned: staff.andy.id });
  let s;
  for (const id of ['A1', 'A2', 'A3']) s = await addEvent(saver.id, 'home_saved', { listingId: id });
  assert.equal((await onLeadEvent(s, db.pool)).sent.length, 1);

  // An ordinary page view is not hot.
  assert.equal(await onLeadEvent(await addEvent(saver.id, 'page_view', { meta: { path: '/' } }), db.pool), null);
});

test('reply drafts are only drafts until the agent presses Send', { skip }, async () => {
  const drafts = await import('../src/services/replyDrafts.js');
  const sms = await import('../src/services/smsService.js');
  const sent = [];
  sms.smsTransport.fetch = async (url, init) => { sent.push({ url, body: init.body }); return new Response(JSON.stringify({ sid: 'SM1', status: 'queued' }), { status: 201 }); };
  const before = (await q('SELECT COUNT(*)::int AS n FROM lead_messages WHERE lead_id = $1 AND direction = $2', [lead.andy.id, 'out'])).rows[0].n;

  // No model key: a plain starting point.
  const t = await call('POST', `/agent/crm/leads/${lead.andy.id}/drafts`, { auth: tok.andy, body: { channel: 'sms' } });
  assert.equal(t.status, 201, t.text);
  assert.equal(t.json.data.source, 'template');
  assert.match(t.json.data.body, /^Hi Lena, it's Andy with Peak Realty\./);

  // With the model: its words, still only a draft.
  let prompt = null;
  drafts.draftTransport.complete = async (messages) => { prompt = messages; return 'Hi Lena! Want to see Elm St on Saturday morning?'; };
  const d = await call('POST', `/agent/crm/leads/${lead.andy.id}/drafts`, { auth: tok.andy, body: { channel: 'sms' } });
  assert.equal(d.json.data.source, 'nadia');
  assert.equal(d.json.data.body, 'Hi Lena! Want to see Elm St on Saturday morning?');
  assert.match(prompt[0].content, /Peak Realty/);
  assert.doesNotMatch(prompt.map((m) => m.content).join(' '), /SAA Homes/);
  const email = await call('POST', `/agent/crm/leads/${lead.andy.id}/drafts`, { auth: tok.andy, body: { channel: 'email' } });
  assert.equal(email.status, 201);

  const after = (await q('SELECT COUNT(*)::int AS n FROM lead_messages WHERE lead_id = $1 AND direction = $2', [lead.andy.id, 'out'])).rows[0].n;
  assert.equal(after, before, 'drafting sends nothing');
  assert.equal(sent.length, 0);
  const { rows: [{ n: outbox }] } = await q("SELECT COUNT(*)::int AS n FROM email_outbox WHERE to_email = 'lena@buyer.test'");
  assert.equal(outbox, 0);

  // Another agent can't send Andy's lead a draft.
  assert.equal((await call('POST', `/agent/crm/drafts/${d.json.data.id}/send`, { auth: tok.bea, body: { body: 'hi' } })).status, 404);

  // Pressing Send on the email draft: one email, with the agent's edits.
  const send = await call('POST', `/agent/crm/drafts/${email.json.data.id}/send`, { auth: tok.andy, body: { subject: 'Elm St', body: 'Hi Lena,\n\nSaturday at 10?\n\nAndy' } });
  assert.equal(send.status, 201, send.text);
  const { rows: [box] } = await q("SELECT subject, html FROM email_outbox WHERE to_email = 'lena@buyer.test'");
  assert.equal(box.subject, 'Elm St');
  assert.match(box.html, /Saturday at 10\?/);
  assert.equal((await call('POST', `/agent/crm/drafts/${email.json.data.id}/send`, { auth: tok.andy, body: {} })).status, 409, 'once only');

  // Text drafts still go through the consent check (no texting set up here).
  const smsSend = await call('POST', `/agent/crm/drafts/${d.json.data.id}/send`, { auth: tok.andy, body: { body: 'Hi Lena' } });
  assert.equal(smsSend.status, 422);
  assert.equal(smsSend.json.reason, 'not_set_up');
  assert.equal(sent.length, 0);
  sms.smsTransport.fetch = (...a) => globalThis.fetch(...a);
});

test('reports count only this brokerage', { skip }, async () => {
  await q(`INSERT INTO lead_messages (tenant_id, lead_id, agent_id, channel, direction, body, status, created_at) VALUES
           ($1, $2, $3, 'sms', 'out', 'hi', 'sent', NOW()), ($1, $2, NULL, 'sms', 'in', 'hey', 'received', NOW() + INTERVAL '1 minute')`, [peak.id, lead.andy.id, staff.andy.id]);
  const summitLead = await mkUser(summit.id, 'zed@buyer.test', 'client', { name: 'Zed', assigned: staff.sam.id });
  await q(`INSERT INTO lead_messages (tenant_id, lead_id, agent_id, channel, direction, body, status) VALUES ($1, $2, $3, 'sms', 'out', 'yo', 'sent')`, [summit.id, summitLead.id, staff.sam.id]);
  await q(`INSERT INTO hot_lead_alerts (tenant_id, lead_id, agent_id, reason) VALUES ($1, $2, $3, 'tour')`, [summit.id, summitLead.id, staff.sam.id]);
  await q(`INSERT INTO tour_requests (tenant_id, user_id, listing_keys, windows) VALUES ($1, $2, ARRAY['X'], '[]'::jsonb)`, [summit.id, summitLead.id]);

  const r = await call('GET', '/admin/reports/agents?days=30', { auth: tok.owner });
  assert.equal(r.status, 200, r.text);
  const ids = r.json.data.agents.map((a) => a.id).sort();
  assert.deepEqual(ids, [staff.owner.id, staff.andy.id, staff.bea.id].sort());
  const andy = r.json.data.agents.find((a) => a.id === staff.andy.id);
  assert.equal(andy.texts_sent, 1);
  assert.equal(andy.response_rate, 1);
  assert.ok(andy.leads_assigned >= 1);
  assert.ok(andy.tours >= 1);
  assert.ok(andy.hot_leads >= 1);
  assert.equal(r.json.data.sources.reduce((n, s) => n + s.total, 0) > 0, true);
  assert.doesNotMatch(r.text, /Sam Summit|zed@buyer/);

  const s = await call('GET', '/admin/reports/agents?days=30', { auth: tok.sam, host: SUMMIT });
  const sam = s.json.data.agents.find((a) => a.id === staff.sam.id);
  assert.deepEqual(s.json.data.agents.map((a) => a.id), [staff.sam.id]);
  assert.equal(sam.texts_sent, 1);
  assert.equal(sam.tours, 1);
  assert.equal(sam.hot_leads, 1);

  const csv = await call('GET', '/admin/reports/agents?days=7&format=csv', { auth: tok.owner });
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.text, /^Agent,Email,Role,Leads assigned/);
  assert.match(csv.text, /Andy Agent/);
  assert.doesNotMatch(csv.text, /Sam Summit/);
  assert.equal((await call('GET', '/admin/reports/agents', { auth: tok.andy })).status, 403, 'agents don’t see the owner report');
});
