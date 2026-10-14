/**
 * A brokerage with the cockpit as its CRM ("own" mode): nothing calls Follow
 * Up Boss, whatever keys were saved before; the same actions in Follow Up
 * Boss mode do call it (so the count means something). Switching modes keeps
 * every contact, note and task. Owners export every contact to CSV and
 * import a Follow Up Boss export (columns mapped, duplicates merged), and a
 * CSV export imports back into an empty brokerage unchanged. All network
 * calls are stubbed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { parseCsv, toCsv, mapStage, guessMapping } from '../src/services/crmCsv.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-own-crm';
process.env.CRM_SCHEDULER = 'off';
process.env.ACTION_PLAN_SCHEDULER = 'off';
process.env.ACTION_PLAN_KICK = 'off';
process.env.HOT_LEAD_ALERTS = 'off';
delete process.env.FOLLOW_UP_BOSS_API_KEY;
delete process.env.FOLLOW_UP_BOSS_WEBHOOK_URL;

const OWN = 'own-crm.test';
const FUB = 'fub-crm.test';
const FRESH = 'fresh-crm.test';
const skip = !hasTestDatabase;

let db;
let server;
const t = {};
const staff = {};
const tok = {};
const lead = {};
let fubCalls = [];
const realFetch = globalThis.fetch;

async function call(method, path, { auth, body, host = OWN, headers = {}, raw = null } = {}) {
  const res = await realFetch(`${server.url}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': host, ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* csv */ }
  return { status: res.status, json, text, headers: res.headers };
}

const q = (sql, p) => db.pool.query(sql, p);
const mkUser = async (tenantId, email, role, extra = {}) => (await q(
  `INSERT INTO users (email, name, role, status, manage_token, tenant_id, phone, assigned_agent_id, fub_api_key, webform_slug, fub_person_id)
   VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
  [email, extra.name || email, role, crypto.randomBytes(16).toString('hex'), tenantId, extra.phone || null, extra.assigned || null,
    extra.fubKey || null, extra.slug || null, extra.fubPersonId || null]
)).rows[0];
const settle = () => new Promise((r) => setTimeout(r, 300));

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  // Every outgoing call in this process passes through here; Follow Up Boss calls are counted and answered.
  globalThis.fetch = async (url, init) => {
    const u = String(url?.url || url);
    if (/followupboss\.com/i.test(u)) {
      fubCalls.push({ url: u, method: init?.method || 'GET' });
      return new Response(JSON.stringify({ id: 9000 + fubCalls.length, people: [], _metadata: { total: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.startsWith(server.url)) return realFetch(url, init);
    return new Response('{}', { status: 503 });
  };
  const hot = await import('../src/services/hotLeads.js');
  hot.hotTransport.push = async () => {};
  const settings = (mode) => JSON.stringify({ crm_mode: mode, fub_api_key: 'fub-key-saved-earlier' });
  ({ rows: [t.own] } = await q("INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('owncrm', 'Own Realty', $1, $2) RETURNING *", [OWN, settings('own')]));
  ({ rows: [t.fub] } = await q("INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('fubcrm', 'Boss Realty', $1, $2) RETURNING *", [FUB, settings('fub')]));
  ({ rows: [t.fresh] } = await q("INSERT INTO tenants (slug, name, primary_domain) VALUES ('freshcrm', 'Fresh Start Homes', $1) RETURNING *", [FRESH]));
  for (const k of ['own', 'fub']) {
    staff[`${k}Owner`] = await mkUser(t[k].id, `owner@${k}.test`, 'admin', { name: `${k} Owner` });
    staff[`${k}Agent`] = await mkUser(t[k].id, `agent@${k}.test`, 'agent', { name: 'Avery Agent', fubKey: 'agent-own-fub-key', slug: `${k}-avery` });
    lead[k] = await mkUser(t[k].id, `lena@${k}buyer.test`, 'client', { name: 'Lena Lead', phone: '9705551111', assigned: staff[`${k}Agent`].id, fubPersonId: 4242 });
  }
  staff.freshOwner = await mkUser(t.fresh.id, 'owner@fresh.test', 'admin', { name: 'Fran Fresh' });
  staff.freshAgent = await mkUser(t.fresh.id, 'avery@fresh.test', 'agent', { name: 'Avery Agent' });
  const { generateToken } = await import('../src/middleware/auth.js');
  for (const [k, u] of Object.entries(staff)) tok[k] = generateToken({ id: u.id, email: u.email, role: u.role, tenant_id: u.tenant_id });
});

test.after(async () => {
  globalThis.fetch = realFetch;
  if (skip) return;
  await server?.close();
  await db?.drop();
});

/** The same day of work at a brokerage: a web form lead, a contact form, a note, a task, a stage change, an intake lead. */
async function dayOfWork(k, host) {
  const owner = tok[`${k}Owner`];
  const agent = tok[`${k}Agent`];
  const r1 = await call('POST', '/webform/lead', { host, body: { slug: `${k}-avery`, name: 'Wen Webform', email: `wen@${k}buyer.test`, phone: '9705552222' } });
  assert.ok([200, 201].includes(r1.status), r1.text);
  const r2 = await call('POST', '/contact', { host, body: { name: 'Cora Contact', email: `cora${k}@gmail.com`, phone: '9705553333', message: 'Call me' } });
  assert.ok([200, 201].includes(r2.status), r2.text);
  assert.equal((await call('POST', `/agent/crm/leads/${lead[k].id}/notes`, { host, auth: agent, body: { body: 'Pre-approved at 600k' } })).status, 201);
  assert.equal((await call('POST', `/agent/crm/leads/${lead[k].id}/tasks`, { host, auth: agent, body: { title: 'Send comps', due_at: '2026-10-20T16:00:00Z' } })).status, 201);
  assert.equal((await call('PATCH', `/agent/cockpit/${lead[k].id}`, { host, auth: owner, body: { lifecycle_stage: 'showing' } })).status, 200);
  const intake = await call('GET', '/admin/intake', { host, auth: owner });
  const lead2 = await call('POST', `/intake/${intake.json.data.key}/webhook`, { host, body: { name: 'Ike Intake', email: `ike@${k}buyer.test` } });
  assert.equal(lead2.status, 201, lead2.text);
  await settle();
}

test('own mode: a full day of work makes zero Follow Up Boss calls; the same day in Follow Up Boss mode does call it', { skip }, async () => {
  fubCalls = [];
  await dayOfWork('own', OWN);
  assert.deepEqual(fubCalls, [], 'nothing reached Follow Up Boss');

  // Control: the same actions with Follow Up Boss on.
  await dayOfWork('fub', FUB);
  assert.ok(fubCalls.length > 0, 'the stub sees Follow Up Boss calls when the mode allows them');
  assert.ok(fubCalls.every((c) => /^https:\/\/api\.followupboss\.com\/v1\//.test(c.url)), 'only the public API');
});

test('own mode: Follow Up Boss connections and imports are turned away, saved keys are kept', { skip }, async () => {
  fubCalls = [];
  const connect = await call('POST', '/agent/fub/connect', { auth: tok.ownAgent, body: { apiKey: 'new-key-123456789' } });
  assert.equal(connect.status, 409, connect.text);
  assert.equal((await call('POST', '/agent/fub/import', { auth: tok.ownAgent })).status, 409);
  const key = await call('PATCH', '/admin/settings', { auth: tok.ownOwner, body: { fub_api_key: 'another-key-123456' } });
  assert.equal(key.status, 409, key.text);
  const status = await call('GET', '/agent/fub/status', { auth: tok.ownAgent });
  assert.equal(status.json.data?.crm_mode ?? status.json.crm_mode, 'own');
  const { rows: [kept] } = await q("SELECT settings->>'fub_api_key' AS key FROM tenants WHERE id = $1", [t.own.id]);
  assert.equal(kept.key, 'fub-key-saved-earlier');
  // A Follow Up Boss webhook for this brokerage is ignored.
  const { handlePeopleCreated } = await import('../src/services/fubAutomation.js');
  const r = await handlePeopleCreated(t.own.id, { event: 'peopleCreated', eventId: 'evt-own-1', resourceIds: [1, 2] });
  assert.equal(r.ignored, 'own_crm');
  assert.deepEqual(fubCalls, []);
});

test('the cockpit is the CRM: tags, stage and assignment live here; console knows the mode', { skip }, async () => {
  const detail = await call('GET', `/agent/crm/leads/${lead.own.id}`, { auth: tok.ownAgent });
  assert.equal(detail.json.data.crm_mode, 'own');
  assert.equal(detail.json.data.lead.lifecycle_stage, 'showing');
  const tags = await call('PUT', `/agent/crm/leads/${lead.own.id}/tags`, { auth: tok.ownAgent, body: { tags: ['Buyer', 'buyer', 'Pre-approved'] } });
  assert.deepEqual(tags.json.data.tags, ['Buyer', 'Pre-approved']);
  const cockpit = await call('GET', '/agent/cockpit?q=pre-approved', { auth: tok.ownAgent });
  assert.equal(cockpit.status, 200, cockpit.text);
  assert.equal(cockpit.json.meta?.crm_mode ?? cockpit.json.data?.meta?.crm_mode, 'own');
  const rows = cockpit.json.data?.leads || cockpit.json.data || cockpit.json.leads;
  assert.ok(JSON.stringify(rows).includes('Lena Lead'), 'search finds a lead by tag');
  assert.equal((await call('GET', '/agent/crm/mode', { auth: tok.ownAgent })).json.data.mode, 'own');
  const s = await call('GET', '/admin/crm/settings', { auth: tok.ownOwner });
  assert.equal(s.json.data.mode, 'own');
  assert.ok(s.json.data.counts.contacts >= 4);
  assert.equal((await call('GET', '/admin/crm/settings', { auth: tok.ownAgent })).status, 403);
});

test('switching modes never loses anything', { skip }, async () => {
  const before = (await call('GET', '/admin/crm/settings', { auth: tok.ownOwner })).json.data.counts;
  assert.equal((await call('PUT', '/admin/crm/mode', { auth: tok.ownOwner, body: { mode: 'nonsense' } })).status, 400);
  assert.equal((await call('PUT', '/admin/crm/mode', { auth: tok.ownOwner, body: { mode: 'fub' } })).status, 200);
  const mid = (await call('GET', '/admin/crm/settings', { auth: tok.ownOwner })).json.data;
  assert.equal(mid.mode, 'fub');
  assert.deepEqual(mid.counts, before);
  assert.equal((await call('PUT', '/admin/crm/mode', { auth: tok.ownOwner, body: { mode: 'own' } })).status, 200);
  const after = (await call('GET', '/admin/crm/settings', { auth: tok.ownOwner })).json.data;
  assert.equal(after.mode, 'own');
  assert.deepEqual(after.counts, before);
  const { rows: [kept] } = await q("SELECT settings->>'fub_api_key' AS key FROM tenants WHERE id = $1", [t.own.id]);
  assert.equal(kept.key, 'fub-key-saved-earlier');
  await settle();
});

test('CSV helpers: quoting, formulas, stage names and column guesses', () => {
  const csv = toCsv([['Name', 'Notes'], ['Ann "A" Lee', 'line 1\nline 2, with comma'], ['=HYPERLINK("x")', '+1 call']]);
  const back = parseCsv(csv);
  assert.deepEqual(back[1], ['Ann "A" Lee', 'line 1\nline 2, with comma']);
  assert.deepEqual(back[2], ["'=HYPERLINK(\"x\")", "'+1 call"], 'spreadsheet formulas are defused');
  assert.equal(mapStage('Past Client'), 'closed');
  assert.equal(mapStage('Trash'), 'lost');
  assert.equal(mapStage('Hot Prospect'), 'active');
  assert.equal(mapStage('Nurture'), 'nurturing');
  assert.equal(mapStage('Lead'), 'new');
  assert.equal(mapStage('whatever'), null);
  const m = guessMapping(['First Name', 'Last Name', 'Stage', 'Source', 'Assigned To', 'Email 1', 'Phone 1', 'Tags', 'Background']);
  assert.deepEqual(m, { first_name: 0, last_name: 1, stage: 2, source: 3, assigned: 4, email: 5, phone: 6, tags: 7, notes: 8 });
});

test('export every contact with notes, tasks and tags; it imports back into an empty brokerage unchanged', { skip }, async () => {
  assert.equal((await call('GET', '/admin/crm/export', { auth: tok.ownAgent })).status, 403);
  const exp = await call('GET', '/admin/crm/export', { auth: tok.ownOwner });
  assert.equal(exp.status, 200);
  assert.match(exp.headers.get('content-type'), /text\/csv/);
  assert.match(exp.headers.get('content-disposition'), /attachment; filename="owncrm-contacts-/);
  const rows = parseCsv(exp.text.replace(/^﻿/, ''));
  assert.equal(rows[0][0], 'Name');
  const lena = rows.find((r) => r[3] === 'lena@ownbuyer.test');
  assert.ok(lena);
  assert.equal(lena[5], 'showing');
  assert.equal(lena[7], 'Buyer, Pre-approved');
  assert.equal(lena[8], 'Avery Agent');
  assert.match(lena[12], /Avery Agent: Pre-approved at 600k/);
  assert.match(lena[13], /Send comps \(due 2026-10-20\)/);
  assert.ok(!exp.text.includes('fubcrm') && !exp.text.includes('@fubbuyer.test'), 'only this brokerage');

  // Into an empty brokerage.
  const preview = await call('POST', '/admin/crm/import/preview', { host: FRESH, auth: tok.freshOwner, raw: exp.text, headers: { 'Content-Type': 'text/csv' } });
  assert.equal(preview.status, 200, preview.text);
  const { mapping } = preview.json.data;
  assert.equal(preview.json.data.rows, rows.length - 1);
  const imp = await call('POST', `/admin/crm/import?mapping=${encodeURIComponent(JSON.stringify(mapping))}`, { host: FRESH, auth: tok.freshOwner, raw: exp.text, headers: { 'Content-Type': 'text/csv' } });
  assert.equal(imp.status, 200, imp.text);
  assert.equal(imp.json.data.created, rows.length - 1);
  assert.equal(imp.json.data.skipped, 0);

  const again = await call('GET', '/admin/crm/export', { host: FRESH, auth: tok.freshOwner });
  const rows2 = parseCsv(again.text.replace(/^﻿/, ''));
  const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
  const pick = (r) => [r[0], r[3], digits(r[4]), r[5], r[7], r[8], r[12], r[13]];
  const byEmail = (list) => Object.fromEntries(list.slice(1).map((r) => [r[3] || digits(r[4]), pick(r)]));
  assert.deepEqual(byEmail(rows2), byEmail(rows), 'names, emails, phones, stages, tags, agents, notes and open tasks come back the same');

  // Importing the same file again adds nobody and no duplicate notes.
  const twice = await call('POST', '/admin/crm/import', { host: FRESH, auth: tok.freshOwner, body: { csv: exp.text, mapping } });
  assert.equal(twice.json.data.created, 0);
  assert.equal(twice.json.data.updated, rows.length - 1);
  assert.equal(twice.json.data.notes, 0);
});

test('import a Follow Up Boss export: columns mapped, stages translated, duplicates merged', { skip }, async () => {
  const fubCsv = [
    'First Name,Last Name,Stage,Source,Assigned To,Email 1,Phone 1,Tags,Background',
    'Lena,Lead,Hot Prospect,Zillow,Avery Agent,lena@ownbuyer.test,(970) 555-1111,"Zillow, VIP",Wants a yard',
    'Paul,Past,Past Client,Referral,,paul@example.com,,Sphere,Bought in 2024',
    'Ned,Nophone,Lead,,,,,,',
    'Olive,Owner,Lead,,,owner@own.test,,,',
    "'=cmd,Formula,Lead,,,formula@example.com,,,",
  ].join('\n');
  const preview = await call('POST', '/admin/crm/import/preview', { auth: tok.ownOwner, body: { csv: fubCsv } });
  assert.equal(preview.status, 200, preview.text);
  const imp = await call('POST', '/admin/crm/import', { auth: tok.ownOwner, body: { csv: fubCsv, mapping: preview.json.data.mapping } });
  assert.equal(imp.status, 200, imp.text);
  assert.equal(imp.json.data.created, 2);
  assert.equal(imp.json.data.updated, 1);
  assert.equal(imp.json.data.skipped, 2);
  assert.deepEqual(imp.json.data.errors.map((e) => e.reason), ['No email or phone', 'That email belongs to someone on your team']);
  const { rows: [lena] } = await q('SELECT tags, lifecycle_stage FROM users WHERE id = $1', [lead.own.id]);
  assert.ok(lena.tags.includes('VIP') && lena.tags.includes('Buyer'), 'tags are added, not replaced');
  assert.equal(lena.lifecycle_stage, 'showing', 'a stage set in the cockpit is kept');
  const { rows: [paul] } = await q("SELECT * FROM users WHERE tenant_id = $1 AND email = 'paul@example.com'", [t.own.id]);
  assert.equal(paul.lifecycle_stage, 'closed');
  assert.equal(paul.source, 'Referral');
  const { rows: [note] } = await q('SELECT body FROM lead_notes WHERE lead_id = $1', [paul.id]);
  assert.equal(note.body, 'Bought in 2024');
  const { rows: [f] } = await q("SELECT name FROM users WHERE tenant_id = $1 AND email = 'formula@example.com'", [t.own.id]);
  assert.equal(f.name, '=cmd Formula', 'the leading quote added by exports is removed');
  // Wrong mapping and empty files.
  assert.equal((await call('POST', '/admin/crm/import', { auth: tok.ownOwner, body: { csv: fubCsv, mapping: { name: 0 } } })).status, 400);
  assert.equal((await call('POST', '/admin/crm/import', { auth: tok.ownOwner, body: { csv: '' } })).status, 400);
});
