/**
 * Lead sources without Follow Up Boss: Zillow, Realtor.com and Homes.com
 * lead emails, forwarded lead emails, Zapier / web form JSON and Facebook
 * lead ads come in on a per-brokerage key; each is parsed, matched to an
 * existing contact (email, then phone, inside the brokerage only), tagged
 * with its source and assigned by rules or round robin. Bad keys and bad
 * signatures are refused. Facebook's Graph API is mocked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { ZILLOW, REALTOR, HOMES, FORWARDED, FORWARDED_ZILLOW } from './fixtures/leadEmails.mjs';
import {
  parseLeadEmail, detectLeadSource, parseWebhookLead, parseFacebookLead, verifyFacebookSignature,
} from '../src/services/leadIntake.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-intake';
process.env.CRM_SCHEDULER = 'off';
process.env.ACTION_PLAN_SCHEDULER = 'off';
process.env.ACTION_PLAN_KICK = 'off';
process.env.HOT_LEAD_ALERTS = 'off';
delete process.env.FACEBOOK_APP_SECRET;

const PEAK = 'peak-intake.test';
const SUMMIT = 'summit-intake.test';
const FB_SECRET = 'fb-app-secret-for-tests';
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let summit;
let key;
let summitKey;
const staff = {};
const tok = {};
let graphCalls = [];

async function call(method, path, { auth, body, host = PEAK, headers = {}, raw = null } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': host, ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* text */ }
  return { status: res.status, json, text };
}

const q = (sql, p) => db.pool.query(sql, p);
const mkUser = async (tenantId, email, role, extra = {}) => (await q(
  `INSERT INTO users (email, name, role, status, manage_token, tenant_id, phone)
   VALUES ($1, $2, $3, 'active', $4, $5, $6) RETURNING *`,
  [email, extra.name || email, role, crypto.randomBytes(16).toString('hex'), tenantId, extra.phone || null]
)).rows[0];
const userById = async (id) => (await q('SELECT * FROM users WHERE id = $1', [id])).rows[0];
/** A Postmark-style inbound email post. */
const asPostmark = (mail) => ({ From: mail.from, Subject: mail.subject, TextBody: mail.text, To: 'leads@inbound.peak.test' });

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  const hot = await import('../src/services/hotLeads.js');
  hot.hotTransport.push = async () => {};
  const intake = await import('../src/services/leadIntake.js');
  intake.intakeTransport.fetch = async (url) => {
    graphCalls.push(String(url));
    if (/\/444555\?/.test(url)) {
      return new Response(JSON.stringify({
        id: '444555',
        created_time: '2026-10-14T17:00:00+0000',
        field_data: [
          { name: 'full_name', values: ['Casey Fox'] },
          { name: 'email', values: ['casey.fox@example.com'] },
          { name: 'phone_number', values: ['+19705550188'] },
          { name: 'city', values: ['Loveland'] },
          { name: 'when_are_you_looking_to_buy?', values: ['In 3 months'] },
        ],
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { message: 'Unsupported get request' } }), { status: 400 });
  };
  ({ rows: [peak] } = await q("INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peakintake', 'Peak Realty', $1, '{\"crm_mode\":\"own\"}') RETURNING *", [PEAK]));
  ({ rows: [summit] } = await q("INSERT INTO tenants (slug, name, primary_domain) VALUES ('summitintake', 'Summit Homes', $1) RETURNING *", [SUMMIT]));
  staff.owner = await mkUser(peak.id, 'olive@peak.test', 'admin', { name: 'Olive Owner' });
  staff.andy = await mkUser(peak.id, 'andy@peak.test', 'agent', { name: 'Andy Agent' });
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

test('lead emails: each portal’s layout is read', () => {
  assert.equal(detectLeadSource({ fromEmail: 'premieragent-noreply@zillow.com', text: ZILLOW.text, subject: ZILLOW.subject }), 'zillow');
  assert.deepEqual(parseLeadEmail({ subject: ZILLOW.subject, text: ZILLOW.text, fromEmail: 'premieragent-noreply@zillow.com' }), {
    name: 'Jamie Rivera',
    email: 'jamie.rivera@example.net',
    phone: '9705550142',
    message: "Hi, I'd like to schedule a tour of this home this weekend. Is it still available?",
    property_url: 'https://www.zillow.com/homedetails/1234-Maple-Ave-Fort-Collins-CO-80525/12345678_zpid/',
    property_address: '1234 Maple Ave, Fort Collins, CO 80525',
    city: 'Fort Collins',
    price: 549000,
  });

  assert.equal(detectLeadSource({ fromEmail: 'leads@notifications.realtor.com', text: REALTOR.text }), 'realtor');
  const r = parseLeadEmail({ subject: REALTOR.subject, text: REALTOR.text, fromEmail: 'leads@notifications.realtor.com' });
  assert.equal(r.name, 'Morgan Lee');
  assert.equal(r.email, 'morgan.lee@example.org');
  assert.equal(r.phone, '7205550199', 'the toll-free support number is ignored');
  assert.match(r.message, /interested in 88 Pine Ct/);
  assert.equal(r.city, 'Loveland');
  assert.equal(r.price, 475000);
  assert.match(r.property_url, /realtor\.com\/realestateandhomes-detail/);

  assert.equal(detectLeadSource({ fromEmail: 'leads@homes.com', text: HOMES.text }), 'homes');
  const h = parseLeadEmail({ subject: HOMES.subject, text: HOMES.text, fromEmail: 'leads@homes.com' });
  assert.deepEqual([h.name, h.email, h.phone, h.city, h.price], ['Taylor Brooks', 'taylor.brooks@example.com', '3035550177', 'Windsor', 1250000]);
  assert.match(h.property_url, /homes\.com\/property/);

  // Forwarded: the forward's own headers are not the lead.
  assert.equal(detectLeadSource({ fromEmail: 'andy@peak.test', text: FORWARDED.text }), null);
  const f = parseLeadEmail({ subject: FORWARDED.subject, text: FORWARDED.text, fromEmail: 'andy@peak.test' });
  assert.deepEqual([f.name, f.email, f.phone, f.message], ['Riley Chen', 'riley.chen@example.com', '9705550123', 'Looking for a lot near Horsetooth.']);
  assert.equal(detectLeadSource({ fromEmail: 'bea@peak.test', text: FORWARDED_ZILLOW.text }), 'zillow', 'a forwarded Zillow lead is still Zillow');
  const fz = parseLeadEmail({ subject: FORWARDED_ZILLOW.subject, text: FORWARDED_ZILLOW.text, fromEmail: 'bea@peak.test' });
  assert.deepEqual([fz.name, fz.email, fz.phone], ['Sky Patel', 'sky.patel@example.net', '9705550166']);
});

test('web forms, Zapier and Facebook payloads are read', () => {
  assert.deepEqual(parseWebhookLead({
    first_name: 'Drew', last_name: 'Park', email: 'DREW@Example.com', phone_number: '(970) 555-0111',
    comments: 'Moving in spring', property_url: 'https://peak.test/homes-for-sale/123', city: 'Fort Collins', price: '$650,000', source: 'Open house', tags: 'Buyer, Spring',
  }), {
    name: 'Drew Park', email: 'drew@example.com', phone: '(970) 555-0111', message: 'Moving in spring',
    property_url: 'https://peak.test/homes-for-sale/123', property_address: null, city: 'Fort Collins', price: 650000,
    source_name: 'Open house', tags: ['Buyer', 'Spring'],
  });
  const fb = parseFacebookLead({ id: '9', field_data: [{ name: 'first_name', values: ['Ana'] }, { name: 'last_name', values: ['Ruiz'] }, { name: 'email', values: ['ana@example.com'] }, { name: 'budget', values: ['500k'] }] });
  assert.equal(fb.name, 'Ana Ruiz');
  assert.equal(fb.email, 'ana@example.com');
  assert.equal(fb.message, 'budget: 500k');
  const body = Buffer.from('{"object":"page"}');
  const sig = `sha256=${crypto.createHmac('sha256', 's3cret').update(body).digest('hex')}`;
  assert.equal(verifyFacebookSignature(body, sig, 's3cret'), true);
  assert.equal(verifyFacebookSignature(body, sig, 'other'), false);
  assert.equal(verifyFacebookSignature(Buffer.from('{"object":"page","x":1}'), sig, 's3cret'), false);
  assert.equal(verifyFacebookSignature(body, null, 's3cret'), false);
});

test('owners see their lead address and links; agents and other brokerages don’t', { skip }, async () => {
  const r = await call('GET', '/admin/intake', { auth: tok.owner });
  assert.equal(r.status, 200, r.text);
  key = r.json.data.key;
  assert.match(key, new RegExp(`^t${peak.id}_[a-f0-9]{32}$`));
  assert.equal(r.json.data.endpoints.zillow, `https://${PEAK}/api/intake/${key}/zillow`);
  assert.equal(r.json.data.routing.mode, 'round_robin');
  assert.equal(r.json.data.facebook.app_secret_set, false);
  assert.equal((await call('GET', '/admin/intake', { auth: tok.andy })).status, 403);
  const s = await call('GET', '/admin/intake', { auth: tok.sam, host: SUMMIT });
  summitKey = s.json.data.key;
  assert.notEqual(summitKey, key);
  assert.equal((await call('GET', '/admin/intake', { auth: tok.sam })).status, 403, 'not on Peak’s site');
});

test('round robin across the agents, then rules by source, city and price', { skip }, async () => {
  const got = [];
  for (const [i, who] of ['Ann One', 'Bo Two', 'Cy Three'].entries()) {
    const r = await call('POST', `/intake/${key}/zapier`, { host: 'hooks.zapier.test', body: { name: who, email: `rr${i}@example.com`, phone: `970555020${i}` } });
    assert.equal(r.status, 201, r.text);
    got.push((await userById(r.json.lead_id)).assigned_agent_id);
  }
  assert.deepEqual(got, [staff.andy.id, staff.bea.id, staff.andy.id]);
  const first = await userById((await q("SELECT id FROM users WHERE email = 'rr0@example.com'")).rows[0].id);
  assert.equal(first.tenant_id, peak.id);
  assert.equal(first.source, 'zapier');
  assert.deepEqual(first.tags, ['Zapier']);
  assert.equal(first.lifecycle_stage, 'new');

  // Rules (someone from another brokerage can't be named).
  const bad = await call('PATCH', '/admin/intake', { auth: tok.owner, body: { routing: { rules: [{ source: 'zillow', agent_id: staff.sam.id }] } } });
  assert.equal(bad.status, 400);
  const set = await call('PATCH', '/admin/intake', {
    auth: tok.owner,
    body: { routing: { mode: 'round_robin', rules: [
      { source: 'zillow', agent_id: staff.bea.id },
      { city: 'Loveland', agent_id: staff.andy.id },
      { min_price: 1000000, agent_id: staff.owner.id },
    ] } },
  });
  assert.equal(set.status, 200, set.text);
  assert.equal(set.json.data.routing.rules.length, 3);

  const z = await call('POST', `/intake/${key}/zillow`, { body: asPostmark(ZILLOW) });
  assert.equal(z.status, 201, z.text);
  const zl = await userById(z.json.lead_id);
  assert.deepEqual([zl.name, zl.email, zl.phone, zl.assigned_agent_id, zl.source], ['Jamie Rivera', 'jamie.rivera@example.net', '+19705550142', staff.bea.id, 'zillow']);
  assert.ok(zl.tags.includes('Zillow'));
  const { rows: [note] } = await q('SELECT body FROM lead_notes WHERE lead_id = $1', [zl.id]);
  assert.match(note.body, /New lead from Zillow/);
  assert.match(note.body, /zillow\.com\/homedetails/);
  const { rows: [item] } = await q('SELECT i.kind FROM inbox_items i JOIN inbox_threads t ON t.id = i.thread_id WHERE t.lead_id = $1', [zl.id]);
  assert.equal(item.kind, 'lead', 'it shows in the team inbox');

  const re = await call('POST', `/intake/${key}/realtor`, { body: { from: REALTOR.from, subject: REALTOR.subject, text: REALTOR.text } });
  assert.equal((await userById(re.json.lead_id)).assigned_agent_id, staff.andy.id, 'Loveland goes to Andy');
  const ho = await call('POST', `/intake/${key}/homes`, { body: asPostmark(HOMES) });
  const hl = await userById(ho.json.lead_id);
  assert.equal(hl.assigned_agent_id, staff.owner.id, 'over a million goes to the owner');
  assert.ok(hl.tags.includes('Homes.com'));

  // Forwarded lead emails: the generic address works out the source.
  const fw = await call('POST', `/intake/${key}/email`, { body: asPostmark(FORWARDED) });
  const fl = await userById(fw.json.lead_id);
  assert.deepEqual([fl.name, fl.source], ['Riley Chen', 'email']);
  const fz = await call('POST', `/intake/${key}/email`, { body: asPostmark(FORWARDED_ZILLOW) });
  assert.equal((await userById(fz.json.lead_id)).source, 'zillow');
  // The inbound email address also takes portal leads.
  const inbound = await call('POST', `/inbound/email/${key}`, { body: { from: 'leads@homes.com', subject: 'Lead', text: 'Name: Quinn Vale\nEmail: quinn@example.com\nPhone: 970-555-0155' } });
  assert.equal(inbound.status, 201, inbound.text);
  assert.equal(inbound.json.kind, 'lead');
  assert.equal(inbound.json.source, 'homes');

  // Pool mode: rules still apply, the rest stay unassigned.
  await call('PATCH', '/admin/intake', { auth: tok.owner, body: { routing: { mode: 'pool', rules: [{ source: 'zillow', agent_id: staff.bea.id }] } } });
  const pooled = await call('POST', `/intake/${key}/webhook`, { body: { name: 'Pia Pool', email: 'pia@example.com' } });
  assert.equal((await userById(pooled.json.lead_id)).assigned_agent_id, null);
});

test('duplicates: the same person is updated, never added twice; other brokerages are separate', { skip }, async () => {
  const again = await call('POST', `/intake/${key}/zillow`, { body: asPostmark(ZILLOW) });
  assert.equal(again.status, 200, again.text);
  assert.equal(again.json.duplicate, true);
  const { rows } = await q("SELECT id FROM users WHERE tenant_id = $1 AND email = 'jamie.rivera@example.net'", [peak.id]);
  assert.equal(rows.length, 1);
  const { rows: notes } = await q('SELECT body FROM lead_notes WHERE lead_id = $1 ORDER BY id', [rows[0].id]);
  assert.match(notes[1].body, /Came back from Zillow/);

  // Phone only, then the same phone with an email: one person, with the real email.
  const p1 = await call('POST', `/intake/${key}/webhook`, { body: { name: 'Phil Phone', phone: '970-555-0177' } });
  assert.equal(p1.status, 201);
  assert.match((await userById(p1.json.lead_id)).email, /\.invalid$/);
  const p2 = await call('POST', `/intake/${key}/webhook`, { body: { name: 'Phil Phone', phone: '+1 (970) 555-0177', email: 'phil@example.com', source: 'Open house' } });
  assert.equal(p2.json.lead_id, p1.json.lead_id);
  const phil = await userById(p1.json.lead_id);
  assert.equal(phil.email, 'phil@example.com');
  assert.ok(phil.tags.includes('Open house'));

  // A staff email is never made a lead.
  assert.equal((await call('POST', `/intake/${key}/webhook`, { body: { name: 'Andy', email: 'andy@peak.test' } })).status, 422);

  // Summit gets its own Jamie.
  const s = await call('POST', `/intake/${summitKey}/zillow`, { body: asPostmark(ZILLOW) });
  assert.equal(s.status, 201);
  assert.notEqual(s.json.lead_id, rows[0].id);
  assert.equal((await userById(s.json.lead_id)).tenant_id, summit.id);
});

test('bad keys, unknown sources and empty leads are refused', { skip }, async () => {
  const lead = { name: 'X', email: 'x@example.com' };
  // Flip the last character to one it isn't, so the key really is wrong.
  const flipped = key.slice(0, -1) + (key.endsWith('0') ? '1' : '0');
  assert.equal((await call('POST', `/intake/${flipped}/webhook`, { body: lead })).status, 401);
  assert.equal((await call('POST', `/intake/t${peak.id}_${'a'.repeat(32)}/webhook`, { body: lead })).status, 401);
  assert.equal((await call('POST', `/intake/${summitKey.replace(/^t\d+/, `t${peak.id}`)}/webhook`, { body: lead })).status, 401, 'another brokerage’s secret doesn’t open this one');
  assert.equal((await call('POST', '/intake/nonsense/webhook', { body: lead })).status, 401);
  assert.equal((await call('POST', `/intake/${key}/myspace`, { body: lead })).status, 404);
  const empty = await call('POST', `/intake/${key}/webhook`, { body: { name: 'Nobody' } });
  assert.equal(empty.status, 422);
  const { rows: [log] } = await q("SELECT outcome, error FROM lead_intake_log WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1", [peak.id]);
  assert.equal(log.outcome, 'rejected');

  // A new key retires the old one.
  const old = key;
  const r = await call('POST', '/admin/intake/key', { auth: tok.owner });
  key = r.json.data.key;
  assert.notEqual(key, old);
  assert.equal((await call('POST', `/intake/${old}/webhook`, { body: lead })).status, 401);
  assert.equal((await call('POST', `/intake/${key}/webhook`, { body: lead })).status, 201);
});

test('Facebook lead ads: verified subscription, signed webhook, lead read from the Graph API', { skip }, async () => {
  const entry = { object: 'page', entry: [{ id: '1001', time: 1760461200, changes: [{ field: 'leadgen', value: { leadgen_id: '444555', page_id: '1001', form_id: '77', created_time: 1760461200 } }] }] };
  const raw = JSON.stringify(entry);
  const sign = (body, secret = FB_SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  // Not set up yet.
  assert.equal((await call('POST', `/intake/${key}/facebook`, { raw, headers: { 'X-Hub-Signature-256': sign(raw) } })).status, 403);

  const set = await call('PATCH', '/admin/intake', { auth: tok.owner, body: { facebook: { app_secret: FB_SECRET, page_token: 'page-token-1' } } });
  assert.equal(set.status, 200, set.text);
  assert.equal(set.json.data.facebook.app_secret_set, true);
  assert.equal(JSON.stringify(set.json.data).includes(FB_SECRET), false, 'the secret is never sent back');
  const verifyToken = set.json.data.facebook.verify_token;

  // Facebook's subscription check.
  const ok = await fetch(`${server.url}/api/intake/${key}/facebook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=12345`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), '12345');
  assert.equal((await fetch(`${server.url}/api/intake/${key}/facebook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`)).status, 403);

  // Signatures.
  assert.equal((await call('POST', `/intake/${key}/facebook`, { raw })).status, 403);
  assert.equal((await call('POST', `/intake/${key}/facebook`, { raw, headers: { 'X-Hub-Signature-256': sign(raw, 'wrong') } })).status, 403);
  assert.equal((await call('POST', `/intake/${key}/facebook`, { raw: raw.replace('444555', '444556'), headers: { 'X-Hub-Signature-256': sign(raw) } })).status, 403, 'a changed body fails');

  // A plan set to start for Facebook leads.
  await q(
    `INSERT INTO action_plans (tenant_id, owner_id, name, shared, auto_start, trigger, steps) VALUES ($1, $2, 'FB follow-up', TRUE, TRUE, $3::jsonb, $4::jsonb)`,
    [peak.id, staff.owner.id, JSON.stringify({ type: 'new_lead', sources: ['facebook'] }), JSON.stringify([{ type: 'task', title: 'Call {first_name}' }])]
  );
  graphCalls = [];
  const good = await call('POST', `/intake/${key}/facebook`, { raw, headers: { 'X-Hub-Signature-256': sign(raw) } });
  assert.equal(good.status, 200, good.text);
  assert.equal(graphCalls.length, 1);
  assert.match(graphCalls[0], /^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/444555\?access_token=page-token-1$/);
  const leadId = good.json.results[0].lead_id;
  const casey = await userById(leadId);
  assert.deepEqual([casey.name, casey.email, casey.phone, casey.source, casey.tenant_id], ['Casey Fox', 'casey.fox@example.com', '+19705550188', 'facebook', peak.id]);
  assert.ok(casey.tags.includes('Facebook'));
  const { rows: [note] } = await q('SELECT body FROM lead_notes WHERE lead_id = $1', [leadId]);
  assert.match(note.body, /when are you looking to buy: In 3 months/);
  const { rows: [run] } = await q("SELECT r.status FROM action_plan_runs r JOIN action_plans p ON p.id = r.plan_id WHERE p.name = 'FB follow-up' AND r.lead_id = $1", [leadId]);
  assert.equal(run.status, 'active', 'the Facebook plan started');
});

test('owners can try a lead email before pointing a portal at it', { skip }, async () => {
  const r = await call('POST', '/admin/intake/test', { auth: tok.owner, body: { from: 'leads@homes.com', subject: HOMES.subject, text: HOMES.text } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.source, 'homes');
  assert.equal(r.json.data.lead.name, 'Taylor Brooks');
  const { rows: [{ n }] } = await q("SELECT COUNT(*)::int AS n FROM users WHERE email = 'taylor.brooks@example.com' AND tenant_id = $1", [peak.id]);
  assert.equal(n, 1, 'trying it saves nothing new');
  const log = await call('GET', '/admin/intake', { auth: tok.owner });
  assert.ok(log.json.data.recent.length > 5);
  assert.ok(log.json.data.recent.every((l) => l.summary === null || !/summit/i.test(l.summary)));
});
