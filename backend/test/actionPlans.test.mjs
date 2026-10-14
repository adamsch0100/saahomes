/**
 * Action plans: emails, texts, tasks and waits on a fake clock. Texts keep to
 * consent, STOP and quiet hours; a reply or a tour request pauses the plan;
 * unsubscribing stops it; triggers (new lead, tag, closed) start the right
 * plans; plans and runs stay inside one brokerage. Twilio and email are mocked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-plans';
process.env.CRM_SCHEDULER = 'off';
process.env.ACTION_PLAN_SCHEDULER = 'off';
process.env.ACTION_PLAN_KICK = 'off';
process.env.HOT_LEAD_ALERTS = 'off';
delete process.env.TWILIO_MESSAGING_SERVICE_SID;

const PEAK = 'peak-plans.test';
const SUMMIT = 'summit-plans.test';
const NOON_MT = new Date('2026-10-14T18:00:00Z');
const NIGHT_MT = new Date('2026-10-15T04:30:00Z'); // 10:30pm Mountain
const DAY = 24 * 3600 * 1000;
const skip = !hasTestDatabase;

let db;
let server;
let plans;
let peak;
let summit;
const staff = {};
const tok = {};
let emails = [];
let texts = [];
let clock = NOON_MT;

async function call(method, path, { auth, body, host = PEAK } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': host, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
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
const run = (now = clock) => plans.runDuePlans({ now, pool: db.pool });
const runOf = async (planId, leadId) => (await q(
  'SELECT * FROM action_plan_runs WHERE plan_id = $1 AND lead_id = $2 ORDER BY id DESC LIMIT 1', [planId, leadId]
)).rows[0];

const STEPS = [
  { type: 'email', subject: 'Welcome, {first_name}', body: 'Hi {first_name}, I’m {agent_first_name} at {brokerage}.\n\nSearch here: {search_url}' },
  { type: 'text', body: 'Hi {first_name}, {agent_first_name} here. Any homes you like?' },
  { type: 'task', title: 'Call {first_name}', task_kind: 'call' },
  { type: 'wait', days: 2 },
  { type: 'email', subject: 'Checking in', body: 'Still looking, {first_name}?' },
];

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  plans = await import('../src/services/actionPlans.js');
  const sms = await import('../src/services/smsService.js');
  process.env.TWILIO_ACCOUNT_SID = 'ACtest';
  process.env.TWILIO_AUTH_TOKEN = 'twilio-test-token';
  sms.smsTransport.now = () => clock;
  sms.smsTransport.fetch = async (url, init) => {
    texts.push(Object.fromEntries(new URLSearchParams(init?.body || '')));
    return new Response(JSON.stringify({ sid: `SM${texts.length}`, status: 'queued' }), { status: 201 });
  };
  plans.planTransport.now = () => clock;
  plans.planTransport.sendEmail = async (to, subject, html, fromName, opts) => { emails.push({ to, subject, html, fromName, opts }); };
  const hot = await import('../src/services/hotLeads.js');
  hot.hotTransport.push = async () => {};

  ({ rows: [peak] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peakplans', 'Peak Realty', $1, $2) RETURNING *",
    [PEAK, JSON.stringify({ brand: { phone: '9705550100' }, sms: { messaging_service_sid: `MG${'a'.repeat(32)}`, enabled: true }, crm_mode: 'own' })]
  ));
  ({ rows: [summit] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain) VALUES ('summitplans', 'Summit Homes', $1) RETURNING *", [SUMMIT]
  ));
  staff.owner = await mkUser(peak.id, 'olive@peak.test', 'admin', { name: 'Olive Owner' });
  staff.andy = await mkUser(peak.id, 'andy@peak.test', 'agent', { name: 'Andy Agent', phone: '9705550001' });
  staff.bea = await mkUser(peak.id, 'bea@peak.test', 'agent', { name: 'Bea Broker' });
  staff.sam = await mkUser(summit.id, 'sam@summit.test', 'admin', { name: 'Sam Summit' });
  const { generateToken } = await import('../src/middleware/auth.js');
  for (const [k, u] of Object.entries(staff)) tok[k] = generateToken({ id: u.id, email: u.email, role: u.role, tenant_id: u.tenant_id });
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('starter plans: four per brokerage, off until switched on, never shown to another brokerage', { skip }, async () => {
  const r = await call('GET', '/agent/plans', { auth: tok.andy });
  assert.equal(r.status, 200, r.text);
  const keys = r.json.data.plans.map((p) => p.name);
  assert.equal(r.json.data.plans.length, 4);
  assert.ok(keys.includes('New online buyer (14 days)'));
  assert.ok(r.json.data.plans.every((p) => p.shared && !p.auto_start && p.starter));
  assert.ok(r.json.data.plans.every((p) => !p.can_edit), 'agents cannot change team plans');
  assert.equal(r.json.data.plans.find((p) => p.name.startsWith('New online')).days, 14);
  // Listing twice doesn't add them twice.
  assert.equal((await call('GET', '/agent/plans', { auth: tok.owner })).json.data.plans.length, 4);
  const other = await call('GET', '/agent/plans', { auth: tok.sam, host: SUMMIT });
  assert.equal(other.status, 200);
  assert.ok(other.json.data.plans.every((p) => p.id && !r.json.data.plans.some((x) => x.id === p.id)), 'Summit has its own copies');
  // Peak's plans are invisible from Summit.
  const peakPlan = r.json.data.plans[0].id;
  assert.equal((await call('PATCH', `/agent/plans/${peakPlan}`, { auth: tok.sam, host: SUMMIT, body: { name: 'mine' } })).status, 404);
});

test('building plans: owners share with the team, agents keep their own, bad steps are refused', { skip }, async () => {
  const bad = await call('POST', '/agent/plans', { auth: tok.owner, body: { name: 'x', steps: [{ type: 'wait', days: 0 }] } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Step 1/);
  assert.equal((await call('POST', '/agent/plans', { auth: tok.owner, body: { name: 'x', steps: [{ type: 'email', subject: 'Hi' }] } })).status, 400);

  const team = await call('POST', '/agent/plans', { auth: tok.owner, body: { name: 'Team buyer plan', trigger: { type: 'manual' }, steps: STEPS } });
  assert.equal(team.status, 201, team.text);
  assert.equal(team.json.data.shared, true);
  assert.equal(team.json.data.days, 2);

  const mine = await call('POST', '/agent/plans', { auth: tok.andy, body: { name: 'Andy only', shared: true, steps: [{ type: 'task', title: 'Call' }] } });
  assert.equal(mine.status, 201);
  assert.equal(mine.json.data.shared, false, 'an agent cannot share a plan');
  assert.equal(mine.json.data.can_edit, true);
  // Bea doesn't see Andy's private plan; Andy can't edit the team plan but can copy it.
  assert.ok(!(await call('GET', '/agent/plans', { auth: tok.bea })).json.data.plans.some((p) => p.id === mine.json.data.id));
  assert.equal((await call('PATCH', `/agent/plans/${team.json.data.id}`, { auth: tok.andy, body: { name: 'hijack' } })).status, 403);
  const copy = await call('POST', `/agent/plans/${team.json.data.id}/copy`, { auth: tok.andy });
  assert.equal(copy.status, 201);
  assert.equal(copy.json.data.shared, false);
  assert.equal(copy.json.data.steps.length, STEPS.length);
  // The owner shares a plan across the team.
  const share = await call('PATCH', `/agent/plans/${mine.json.data.id}`, { auth: tok.owner, body: { shared: true } });
  assert.equal(share.status, 200);
  assert.ok((await call('GET', '/agent/plans', { auth: tok.bea })).json.data.plans.some((p) => p.id === mine.json.data.id));
});

test('a plan sends its email, text and task, waits, then finishes, in the brokerage’s brand', { skip }, async () => {
  clock = NOON_MT;
  emails = []; texts = [];
  const lena = await mkUser(peak.id, 'lena@buyer.test', 'client', { name: 'Lena Lead', phone: '9705551111', assigned: staff.andy.id });
  await optIn(lena.id, peak.id);
  const { rows: [plan] } = await q("SELECT id FROM action_plans WHERE tenant_id = $1 AND name = 'Team buyer plan'", [peak.id]);

  // Another agent can't add someone else's lead; Andy can, once.
  assert.equal((await call('POST', `/agent/crm/leads/${lena.id}/plans`, { auth: tok.bea, body: { plan_id: plan.id } })).status, 404);
  const add = await call('POST', `/agent/crm/leads/${lena.id}/plans`, { auth: tok.andy, body: { plan_id: plan.id } });
  assert.equal(add.status, 201, add.text);
  assert.equal((await call('POST', `/agent/crm/leads/${lena.id}/plans`, { auth: tok.andy, body: { plan_id: plan.id } })).status, 409);

  const first = await run();
  assert.equal(first.runs, 1);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'lena@buyer.test');
  assert.equal(emails[0].subject, 'Welcome, Lena');
  assert.match(emails[0].html, /Andy at Peak Realty/);
  assert.match(emails[0].html, /api\/plans\/unsubscribe\?token=/);
  assert.match(emails[0].html, /Unsubscribe from these emails/);
  assert.doesNotMatch(emails[0].html, /Search Ascend|saahomes|Adam/i, 'never SAA');
  assert.equal(emails[0].fromName, 'Andy Agent, Peak Realty');
  assert.equal(texts.length, 1);
  assert.equal(texts[0].To, '+19705551111');
  assert.match(texts[0].Body, /^Peak Realty: Hi Lena, Andy here/);
  assert.match(texts[0].Body, /Reply STOP to opt out\.$/);
  const { rows: tasks } = await q('SELECT title, kind, assignee_id FROM lead_tasks WHERE lead_id = $1', [lena.id]);
  assert.deepEqual(tasks.map((t) => [t.title, t.kind, t.assignee_id]), [['Call Lena', 'call', staff.andy.id]]);
  let r = await runOf(plan.id, lena.id);
  assert.equal(r.status, 'active');
  assert.equal(r.step_index, 4);
  assert.equal(new Date(r.next_at).getTime(), NOON_MT.getTime() + 2 * DAY);

  // A day later: nothing due.
  clock = new Date(NOON_MT.getTime() + DAY);
  assert.equal((await run()).runs, 0);
  clock = new Date(NOON_MT.getTime() + 2 * DAY);
  await run();
  assert.equal(emails.length, 2);
  assert.equal(emails[1].subject, 'Checking in');
  r = await runOf(plan.id, lena.id);
  assert.equal(r.status, 'done');

  const view = await call('GET', `/agent/crm/leads/${lena.id}/plans`, { auth: tok.andy });
  assert.equal(view.status, 200);
  assert.equal(view.json.data.runs[0].status, 'done');
  assert.ok(view.json.data.runs[0].log.some((l) => /Task: Call Lena/.test(l.detail)));
  const { rows: msgs } = await q("SELECT channel, kind FROM lead_messages WHERE lead_id = $1 ORDER BY id", [lena.id]);
  assert.deepEqual(msgs.map((m) => `${m.channel}:${m.kind}`), ['email:plan', 'sms:plan', 'email:plan']);
});

test('texts wait for consent and for the morning; STOP skips them', { skip }, async () => {
  clock = NIGHT_MT;
  emails = []; texts = [];
  const { rows: [plan] } = await q(
    `INSERT INTO action_plans (tenant_id, owner_id, name, shared, steps) VALUES ($1, $2, 'Text only', TRUE, $3::jsonb) RETURNING id`,
    [peak.id, staff.owner.id, JSON.stringify([{ type: 'text', body: 'Hi {first_name}' }, { type: 'task', title: 'After the text' }])]
  );
  const noel = await mkUser(peak.id, 'noel@buyer.test', 'client', { name: 'Noel Noconsent', phone: '9705552222' });
  const nina = await mkUser(peak.id, 'nina@buyer.test', 'client', { name: 'Nina Night', phone: '9705553333' });
  await optIn(nina.id, peak.id);
  await plans.enrollLead({ tenantId: peak.id, planId: plan.id, leadId: noel.id, now: clock }, db.pool);
  await plans.enrollLead({ tenantId: peak.id, planId: plan.id, leadId: nina.id, now: clock }, db.pool);
  await run();
  assert.equal(texts.length, 0, 'nothing at 10:30pm');
  // No consent: skipped (logged), the plan carries on.
  const noelRun = await runOf(plan.id, noel.id);
  assert.equal(noelRun.status, 'done');
  const { rows: [skipLog] } = await q("SELECT outcome, detail FROM action_plan_log WHERE run_id = $1 AND step_type = 'text'", [noelRun.id]);
  assert.equal(skipLog.outcome, 'skipped');
  assert.match(skipLog.detail, /haven’t agreed to texts/);
  // Consent but quiet hours: waits for 8am Mountain.
  const ninaRun = await runOf(plan.id, nina.id);
  assert.equal(ninaRun.status, 'active');
  assert.equal(ninaRun.step_index, 0);
  assert.equal(new Date(ninaRun.next_at).toISOString(), '2026-10-15T14:01:00.000Z');
  clock = new Date('2026-10-15T14:01:00Z');
  await run();
  assert.equal(texts.length, 1);
  assert.equal(texts[0].To, '+19705553333');
  assert.equal((await runOf(plan.id, nina.id)).status, 'done');

  // After STOP: skipped.
  const otto = await mkUser(peak.id, 'otto@buyer.test', 'client', { name: 'Otto', phone: '9705554444' });
  await optIn(otto.id, peak.id);
  await q("INSERT INTO sms_opt_outs (tenant_id, phone, source) VALUES ($1, '+19705554444', 'stop')", [peak.id]);
  await plans.enrollLead({ tenantId: peak.id, planId: plan.id, leadId: otto.id, now: clock }, db.pool);
  await run();
  assert.equal(texts.length, 1);
  const { rows: [stopLog] } = await q(
    "SELECT detail FROM action_plan_log l JOIN action_plan_runs r ON r.id = l.run_id WHERE r.lead_id = $1 AND l.step_type = 'text'", [otto.id]
  );
  assert.match(stopLog.detail, /replied STOP/);
});

test('a reply or a tour request pauses the plan; resume and stop from the lead', { skip }, async () => {
  clock = NOON_MT;
  emails = [];
  const { rows: [plan] } = await q(
    `INSERT INTO action_plans (tenant_id, owner_id, name, shared, steps) VALUES ($1, $2, 'Drip', TRUE, $3::jsonb) RETURNING id`,
    [peak.id, staff.owner.id, JSON.stringify([{ type: 'email', subject: 'One', body: 'a' }, { type: 'wait', days: 1 }, { type: 'email', subject: 'Two', body: 'b' }])]
  );
  const rae = await mkUser(peak.id, 'rae@buyer.test', 'client', { name: 'Rae Replier', phone: '9705555555', assigned: staff.andy.id });
  await plans.enrollLead({ tenantId: peak.id, planId: plan.id, leadId: rae.id, now: clock }, db.pool);
  await run();
  assert.equal(emails.length, 1);

  const inbox = await import('../src/services/teamInbox.js');
  await inbox.recordInbound({ tenantId: peak.id, leadId: rae.id, kind: 'email', subject: 'Re: One', body: 'Yes, let’s talk' }, db.pool);
  let r = await runOf(plan.id, rae.id);
  assert.equal(r.status, 'paused');
  assert.equal(r.pause_reason, 'replied');
  clock = new Date(NOON_MT.getTime() + 3 * DAY);
  await run();
  assert.equal(emails.length, 1, 'a paused plan sends nothing');

  const view = await call('GET', `/agent/crm/leads/${rae.id}/plans`, { auth: tok.andy });
  assert.match(view.json.data.runs[0].pause_text, /replied/i);
  // Bea can't touch Andy's lead's plan.
  assert.equal((await call('POST', `/agent/plans/runs/${r.id}/resume`, { auth: tok.bea })).status, 404);
  assert.equal((await call('POST', `/agent/plans/runs/${r.id}/resume`, { auth: tok.andy })).status, 200);
  await run();
  assert.equal(emails.length, 2);
  assert.equal((await runOf(plan.id, rae.id)).status, 'done');

  // Tour request pauses; stop ends it.
  const tia = await mkUser(peak.id, 'tia@buyer.test', 'client', { name: 'Tia Tour', assigned: staff.andy.id });
  await plans.enrollLead({ tenantId: peak.id, planId: plan.id, leadId: tia.id, now: clock }, db.pool);
  await run();
  const { recordEvent } = await import('../src/services/events.js');
  await recordEvent({ type: 'tour_request', userId: tia.id, tenantId: peak.id, meta: {} }, db.pool);
  for (let i = 0; i < 20 && (await runOf(plan.id, tia.id)).status !== 'paused'; i += 1) await new Promise((res) => setTimeout(res, 25));
  r = await runOf(plan.id, tia.id);
  assert.equal(r.status, 'paused');
  assert.equal(r.pause_reason, 'tour');
  assert.equal((await call('POST', `/agent/plans/runs/${r.id}/stop`, { auth: tok.owner })).status, 200);
  assert.equal((await runOf(plan.id, tia.id)).status, 'stopped');
  assert.equal((await call('POST', `/agent/plans/runs/${r.id}/stop`, { auth: tok.owner })).status, 409);
});

test('unsubscribe from a plan email turns email off and stops every plan', { skip }, async () => {
  clock = NOON_MT;
  emails = [];
  const { rows: [plan] } = await q(
    `INSERT INTO action_plans (tenant_id, owner_id, name, shared, steps) VALUES ($1, $2, 'Two emails', TRUE, $3::jsonb) RETURNING id`,
    [peak.id, staff.owner.id, JSON.stringify([{ type: 'email', subject: 'One', body: 'a' }, { type: 'wait', days: 1 }, { type: 'email', subject: 'Two', body: 'b' }])]
  );
  const uma = await mkUser(peak.id, 'uma@buyer.test', 'client', { name: 'Uma Unsub' });
  await plans.enrollLead({ tenantId: peak.id, planId: plan.id, leadId: uma.id, now: clock }, db.pool);
  await run();
  const link = emails[0].html.match(/href="[^"]*(\/api\/plans\/unsubscribe\?token=[a-f0-9]+)"/)[1];
  // Opening the link only asks (mail scanners open links too).
  const page = await fetch(`${server.url}${link}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Stop these emails\?/);
  assert.match(html, /Peak Realty/);
  assert.equal((await runOf(plan.id, uma.id)).status, 'active');
  const done = await fetch(`${server.url}${link}`, { method: 'POST' });
  assert.equal(done.status, 200);
  assert.match(await done.text(), /unsubscribed/);
  assert.equal((await runOf(plan.id, uma.id)).status, 'stopped');
  const { rows: [c] } = await q("SELECT status FROM contact_consents WHERE user_id = $1 AND channel = 'email' ORDER BY id DESC LIMIT 1", [uma.id]);
  assert.equal(c.status, 'revoked');
  // Added again by hand: emails are skipped.
  const again = await plans.enrollLead({ tenantId: peak.id, planId: plan.id, leadId: uma.id, now: clock }, db.pool);
  assert.ok(again.created);
  await run();
  assert.equal(emails.length, 1);
  assert.equal((await fetch(`${server.url}/api/plans/unsubscribe?token=${'0'.repeat(32)}`)).status, 404);
});

test('triggers: new lead by source, a tag, and closing start the plans switched on for them', { skip }, async () => {
  clock = NOON_MT;
  const all = (await call('GET', '/agent/plans', { auth: tok.owner })).json.data.plans;
  const buyer = all.find((p) => p.name.startsWith('New online buyer'));
  const seller = all.find((p) => p.name === 'New seller lead');
  const past = all.find((p) => p.name === 'Past client after closing');
  for (const p of [buyer, seller, past]) {
    assert.equal((await call('PATCH', `/agent/plans/${p.id}`, { auth: tok.owner, body: { auto_start: true } })).status, 200);
  }
  const { ingestLead } = await import('../src/services/leadIntake.js');
  const { tenantById } = await import('../src/services/tenantContext.js');
  const tenant = await tenantById(peak.id, { pool: db.pool });
  const z = await ingestLead(tenant, { name: 'Zed Zillow', email: 'zed@buyer.test', phone: '9705556666' }, 'zillow', { pool: db.pool, now: clock });
  assert.ok(z.created);
  assert.equal((await runOf(buyer.id, z.lead_id))?.status, 'active');
  // A source the plan isn't set for starts nothing.
  const w = await ingestLead(tenant, { name: 'Wes Webhook', email: 'wes@buyer.test' }, 'webhook', { pool: db.pool, now: clock });
  assert.equal(await runOf(buyer.id, w.lead_id), undefined);

  const tag = await call('PUT', `/agent/crm/leads/${w.lead_id}/tags`, { auth: tok.owner, body: { tags: ['seller', 'Zapier'] } });
  assert.equal(tag.status, 200, tag.text);
  assert.equal((await runOf(seller.id, w.lead_id))?.status, 'active', 'tags match without regard to case');

  // Closing: buyer plans stop, the past-client plan starts.
  const close = await call('PATCH', `/agent/cockpit/${z.lead_id}`, { auth: tok.owner, body: { lifecycle_stage: 'closed' } });
  assert.equal(close.status, 200, close.text);
  assert.equal((await runOf(buyer.id, z.lead_id)).status, 'stopped');
  assert.equal((await runOf(buyer.id, z.lead_id)).end_reason, 'stage_changed');
  assert.equal((await runOf(past.id, z.lead_id))?.status, 'active');

  // Turned-off plans never start; a lead already on a plan isn't added twice.
  const again = await ingestLead(tenant, { name: 'Zed Zillow', email: 'zed@buyer.test' }, 'zillow', { pool: db.pool, now: clock });
  assert.equal(again.created, false);
  const { rows: [{ n }] } = await q('SELECT COUNT(*)::int AS n FROM action_plan_runs WHERE plan_id = $1 AND lead_id = $2', [buyer.id, z.lead_id]);
  assert.equal(n, 1);
  // Deleting a plan stops it for everyone on it.
  const del = await call('DELETE', `/agent/plans/${past.id}`, { auth: tok.owner });
  assert.equal(del.status, 200);
  assert.equal(del.json.data.stopped, 1);
  assert.equal((await runOf(past.id, z.lead_id)).end_reason, 'plan_removed');
});

test('starter plans stay switched off until an owner turns them on', { skip }, async () => {
  const { rows } = await q('SELECT auto_start FROM action_plans WHERE tenant_id = $1', [summit.id]);
  assert.ok(rows.length >= 4);
  assert.ok(rows.every((r) => r.auto_start === false));
});
