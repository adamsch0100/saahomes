/**
 * Every email carries its brokerage's brand: another brokerage's buyers and
 * staff never see SAA's name, phone, domain or colors, and SAA's emails keep
 * saying SAA Homes on saahomes.com.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-branded-emails';
for (const k of ['OUTREACH_SMTP_HOST', 'OUTREACH_SMTP_USER', 'OUTREACH_SMTP_PASSWORD', 'RESEND_API_KEY']) delete process.env[k];

const PEAK = 'peak-realty.test';
const SAA = 'saahomes.com';
const SAA_MARKS = /saahomes|SAA Homes|999-1407|Schwartz|CFB36E|\bAdam\b|Northern Colorado/i;
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let peakAdmin;
let peakAgent;
let peakBuyer;
let saaBuyer;
let peakSearch;
let saaSearch;

const q = (sql, p) => db.pool.query(sql, p);

function assertPeak(html, what) {
  assert.match(html, /peak-realty\.test/, `${what}: links on Peak's domain`);
  assert.match(html, /Peak Realty|PEAK REALTY/, `${what}: Peak's name`);
  const leak = String(html).match(SAA_MARKS);
  assert.equal(leak, null, `${what}: no SAA brand (found "${leak?.[0]}")`);
}

function assertSaa(html, what) {
  assert.match(html, /saahomes\.com/, `${what}: SAA links`);
  assert.match(html, /SAA Homes|SAA HOMES/, `${what}: SAA's name`);
}

async function user(email, { tenantId = 1, role = 'client', name = 'Pat Buyer', agentId = null } = {}) {
  const { rows: [u] } = await q(
    `INSERT INTO users (email, name, role, status, manage_token, tenant_id, assigned_agent_id)
     VALUES ($1, $2, $3, 'active', $4, $5, $6) RETURNING *`,
    [email, name, role, crypto.randomBytes(24).toString('hex'), tenantId, agentId]
  );
  return u;
}

async function search(u) {
  const { rows: [s] } = await q(
    `INSERT INTO saved_searches (user_id, name, filters, tenant_id) VALUES ($1, 'Wellington homes', $2, $3) RETURNING *`,
    [u.id, JSON.stringify({ city: 'Wellington' }), u.tenant_id]
  );
  return { ...s, manage_token: u.manage_token };
}

async function lastEmailTo(to) {
  const { rows: [m] } = await q('SELECT * FROM email_outbox WHERE to_email = $1 ORDER BY id DESC LIMIT 1', [to]);
  return m || null;
}

async function call(method, path, { host = SAA, body, cookie } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...(cookie ? { Cookie: `saa_user_token=${cookie}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  ({ rows: [peak] } = await q(
    `INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peak', 'Peak Realty', $1, $2) RETURNING *`,
    [PEAK, JSON.stringify({
      brand: { name: 'Peak Realty', phone: '3035550142', email: 'hello@peak-realty.test', accent_color: '#0f766e' },
    })]
  ));
  peakAdmin = await user('owner@peak-realty.test', { tenantId: peak.id, role: 'admin', name: 'Olive Owner' });
  peakAgent = await user('kim@peak-realty.test', { tenantId: peak.id, role: 'agent', name: 'Kim Peak' });
  peakBuyer = await user('pat@comcast.net', { tenantId: peak.id, agentId: peakAgent.id });
  saaBuyer = await user('sam@comcast.net', { name: 'Sam Buyer' });
  for (let i = 0; i < 3; i += 1) await insertListing(db.pool, { city: 'Wellington', days_on_market: 2, list_price: 400000 + i * 1000 });
  for (let i = 0; i < 6; i += 1) {
    await insertListing(db.pool, { city: 'Wellington', postal_code: '80549', days_on_market: 90, list_price: 450000, price_per_sqft: 250 + i });
  }
  peakSearch = await search(peakBuyer);
  saaSearch = await search(saaBuyer);
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('sign-in (magic) links go out under each brokerage\'s own brand', { skip }, async () => {
  assert.equal((await call('POST', '/alerts/magic-link', { host: PEAK, body: { email: peakBuyer.email } })).status, 200);
  const peakMail = await lastEmailTo(peakBuyer.email);
  assert.equal(peakMail.subject, 'Your saved searches — Peak Realty');
  assert.equal(peakMail.tenant_id, peak.id);
  assert.match(peakMail.html, /https:\/\/peak-realty\.test\/my-saved-searches\/\?token=/);
  assert.match(peakMail.html, /color:#0f766e/);
  assert.match(peakMail.html, /\(303\) 555-0142/);
  assertPeak(peakMail.html, 'Peak magic link');

  assert.equal((await call('POST', '/alerts/magic-link', { host: SAA, body: { email: saaBuyer.email } })).status, 200);
  const saaMail = await lastEmailTo(saaBuyer.email);
  assert.equal(saaMail.subject, 'Your saved searches — SAA Homes');
  assert.match(saaMail.html, /https:\/\/saahomes\.com\/my-saved-searches\/\?token=/);
  assert.match(saaMail.html, /Schwartz and Associates · \(970\) 999-1407 · saahomes\.com/);
  assertSaa(saaMail.html, 'SAA magic link');
});

test('saved-search digests use the brokerage\'s brand, links and sender', { skip }, async () => {
  const { runSearch } = await import('../src/services/alertDigest.js');
  const sent = [];
  const send = async (to, subject, html, fromName, opts) => { sent.push({ to, subject, html, fromName, opts }); };

  const r = await runSearch(peakSearch, { send });
  assert.equal(r.sent, true);
  const m = sent.at(-1);
  assert.equal(m.to, peakBuyer.email);
  assert.equal(m.fromName, 'Kim Peak — Peak Realty', 'from the assigned agent at Peak');
  assert.deepEqual(m.opts, { tenantId: peak.id, replyTo: peakAgent.email });
  assert.match(m.html, /https:\/\/peak-realty\.test\/homes-for-sale\//);
  assert.match(m.html, /https:\/\/peak-realty\.test\/api\/alerts\/unsubscribe\?token=/);
  assert.match(m.html, /https:\/\/peak-realty\.test\/api\/email\/open\//, 'open pixel on Peak');
  assert.match(m.html, /background:#0f766e;color:#ffffff/, 'Peak accent with readable text');
  assertPeak(m.html, 'Peak digest');
  assert.doesNotMatch(m.subject, SAA_MARKS);

  await runSearch(saaSearch, { send });
  const s = sent.at(-1);
  assert.equal(s.to, saaBuyer.email);
  assert.equal(s.fromName, 'Adam Schwartz, SAA Homes');
  assert.equal(s.opts, undefined);
  assertSaa(s.html, 'SAA digest');
  assert.match(s.html, /#CFB36E/);
});

test('home value digests use the brokerage\'s brand and queue when SMTP is off', { skip }, async () => {
  const { runHomeValueDigest } = await import('../src/services/homeValueDigest.js');
  for (const u of [peakBuyer, saaBuyer]) {
    await q(
      `INSERT INTO home_profiles (user_id, address_line, city, postal_code, living_area, value_updates_enabled, tenant_id)
       VALUES ($1, '12 Elm St', 'Wellington', '80549', 1800, TRUE, $2)`,
      [u.id, u.tenant_id]
    );
  }
  const r = await runHomeValueDigest({ force: true });
  assert.equal(r.sent, 2);

  const peakMail = await lastEmailTo(peakBuyer.email);
  assert.equal(peakMail.tenant_id, peak.id);
  assert.match(peakMail.html, /https:\/\/peak-realty\.test\/my-home\/\?token=/);
  assert.match(peakMail.html, /Talk to Kim Peak/);
  assertPeak(peakMail.html, 'Peak home value digest');
  assert.doesNotMatch(peakMail.subject, SAA_MARKS);

  const saaMail = await lastEmailTo(saaBuyer.email);
  assertSaa(saaMail.html, 'SAA home value digest');
  assert.match(saaMail.html, /Talk to Adam &amp; Mandi/);
});

test('household invites carry the inviter\'s brokerage', { skip }, async () => {
  const r = await call('POST', '/household/invite', { host: PEAK, cookie: peakBuyer.manage_token, body: { email: 'jamie@comcast.net', name: 'Jamie' } });
  assert.equal(r.status, 201, r.text);
  const m = await lastEmailTo('jamie@comcast.net');
  assert.equal(m.tenant_id, peak.id);
  assert.match(m.html, /https:\/\/peak-realty\.test\/board\/\?join=[a-f0-9]{48}/);
  assertPeak(m.html, 'Peak household invite');

  const s = await call('POST', '/household/invite', { host: SAA, cookie: saaBuyer.manage_token, body: { email: 'casey@comcast.net' } });
  assert.equal(s.status, 201, s.text);
  const sm = await lastEmailTo('casey@comcast.net');
  assert.match(sm.html, /color:#CFB36E;font-size:20px;font-weight:800">SAA HOMES/);
  assert.match(sm.html, /Schwartz and Associates · \(970\) 999-1407 · saahomes\.com/);
});

test('staff invites name the brokerage', { skip }, async () => {
  const { issueAccountLink } = await import('../src/services/accountLinks.js');
  const { tenantById } = await import('../src/services/tenantContext.js');
  const newbie = await user('newbie@peak-realty.test', { tenantId: peak.id, role: 'agent', name: 'Nia New' });
  await issueAccountLink({ user: newbie, purpose: 'invite', tenant: await tenantById(peak.id) });
  const m = await lastEmailTo(newbie.email);
  assert.equal(m.subject, 'You\'re invited to Peak Realty');
  assertPeak(m.html, 'Peak staff invite');
});

test('lead notifications go to the brokerage\'s own people, never SAA\'s inbox', { skip }, async () => {
  const { sendContactNotification, sendMarketReportNotification } = await import('../src/services/emailService.js');
  const before = (await q("SELECT COUNT(*)::int AS n FROM email_outbox WHERE to_email ILIKE '%saahomes.com'")).rows[0].n;

  // A new lead with no agent: the brokerage's active admins hear about it.
  const r = await sendContactNotification({ tenant_id: peak.id, name: 'Lee Lead', email: 'lee@comcast.net', message: 'Call me' });
  assert.equal(r.success, true);
  const toAdmin = await lastEmailTo(peakAdmin.email);
  assert.equal(toAdmin.subject, 'New Contact Form Submission - Lee Lead');
  assert.equal(toAdmin.tenant_id, peak.id);
  assert.equal(await lastEmailTo(peakAgent.email), null, 'not to an agent the lead isn\'t assigned to');

  // A lead already assigned to an agent: that agent hears about it.
  await sendMarketReportNotification({ tenant_id: peak.id, firstName: 'Pat', lastName: 'Buyer', email: peakBuyer.email });
  const toAgent = await lastEmailTo(peakAgent.email);
  assert.equal(toAgent.subject, 'New Market Report Request - Pat Buyer');

  const after = (await q("SELECT COUNT(*)::int AS n FROM email_outbox WHERE to_email ILIKE '%saahomes.com'")).rows[0].n;
  assert.equal(after, before, 'nothing went to an SAA address');
});

test('the morning brief links agents to their own brokerage', { skip }, async () => {
  const { runMorningBriefs } = await import('../src/services/morningBrief.js');
  await q('UPDATE users SET next_touch_at = NOW() WHERE id = $1', [peakBuyer.id]);
  const sent = [];
  await runMorningBriefs({ force: true, pool: db.pool, send: async (to, subject, html, fromName) => sent.push({ to, html, fromName }) });
  const m = sent.find((x) => x.to === peakAgent.email);
  assert.ok(m, 'Peak agent got a brief');
  assert.equal(m.fromName, 'Peak Realty');
  assert.match(m.html, /https:\/\/peak-realty\.test\/agent\//);
  assert.doesNotMatch(m.html, SAA_MARKS);
});

test('a verified sending domain sends through Resend from the brokerage\'s domain', { skip }, async () => {
  const emailer = await import('../src/services/emailer.js');
  const { clearTenantCache } = await import('../src/services/tenantContext.js');
  const realFetch = globalThis.fetch;
  const calls = [];
  process.env.RESEND_API_KEY = 're_test_key';
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const body = String(url).endsWith('/domains')
      ? {
        id: 'dom_1', name: 'peak-realty.test', status: 'not_started',
        records: [{ record: 'SPF', name: 'send', type: 'TXT', ttl: 'Auto', status: 'not_started', value: 'v=spf1 include:amazonses.com ~all' }],
      }
      : { id: 'msg_1' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    assert.equal(emailer.ownDomainSendingAvailable(), true);
    const d = await emailer.createSendingDomain('peak-realty.test');
    assert.deepEqual(d, {
      id: 'dom_1', domain: 'peak-realty.test', status: 'not_started',
      records: [{ type: 'TXT', name: 'send', value: 'v=spf1 include:amazonses.com ~all', status: 'not_started' }],
    });
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test_key');

    await q(
      `UPDATE tenants SET settings = settings || $2::jsonb WHERE id = $1`,
      [peak.id, JSON.stringify({ email: { sending_domain: { id: 'dom_1', domain: 'peak-realty.test', status: 'verified' } } })]
    );
    clearTenantCache();
    await emailer.sendEmail('pat@comcast.net', 'Hello', '<p>Hi</p>', 'Peak Realty', { tenantId: peak.id });
    const sendCall = calls.at(-1);
    assert.equal(sendCall.url, 'https://api.resend.com/emails');
    const payload = JSON.parse(sendCall.init.body);
    assert.equal(payload.from, 'Peak Realty <notify@peak-realty.test>');
    assert.equal(payload.reply_to, 'hello@peak-realty.test');
    assert.deepEqual(payload.to, ['pat@comcast.net']);

    // SAA has no verified domain: no Resend call, and without SMTP it throws
    // so callers queue it.
    const n = calls.length;
    await assert.rejects(emailer.sendEmail('sam@comcast.net', 'Hi', '<p>Hi</p>', 'SAA Homes', { tenantId: 1 }), /OUTREACH_SMTP/);
    assert.equal(calls.length, n);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  }
});
