/**
 * Seller dashboard: a client who is thinking of selling gets a plan their
 * agent runs with them. Only that client and the brokerage's staff who can
 * see the client read it; offers never reach any other client; showings come
 * without the buyers' details. A buyer becomes a seller in one click, keeping
 * their history. Tours booked from a listing reach the agent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-seller';

const PEAK = 'peak-sell.test';
const SAA = 'saahomes.com';
const SAA_STRINGS = /saahomes|SAA Homes|999-1407|Schwartz|CFB36E/i;
const skip = !hasTestDatabase;

let db;
let server;
let peak;
const people = {};
const tokens = {};

async function call(method, path, { auth, body, host = PEAK, cookie } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(cookie ? { Cookie: `saa_user_token=${cookie}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}
const as = (person) => ({ cookie: person.manage_token });

const soon = (days) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date(Date.now() + days * 86400000));

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  const q = (sql, p) => db.pool.query(sql, p);
  ({ rows: [peak] } = await q(
    `INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peaksell', 'Peak Realty', $1, $2) RETURNING *`,
    [PEAK, JSON.stringify({ brand: { name: 'Peak Realty', phone: '303-555-0100' }, lead_visibility: 'own' })]
  ));
  const mk = async (key, email, name, role, tenantId, assigned = null) => {
    const { rows: [u] } = await q(
      `INSERT INTO users (email, name, role, status, manage_token, tenant_id, assigned_agent_id, phone, intent)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, '3035550199', $7) RETURNING *`,
      [email, name, role, crypto.randomBytes(24).toString('hex'), tenantId, assigned, role === 'client' ? 'buying' : null]
    );
    people[key] = u;
    return u;
  };
  await mk('owner', 'olive@peak-sell.test', 'Olive Owner', 'admin', peak.id);
  await mk('agent', 'andy@peak-sell.test', 'Andy Agent', 'agent', peak.id);
  await mk('agent2', 'bea@peak-sell.test', 'Bea Broker', 'agent', peak.id);
  await mk('seller', 'sally@example.com', 'Sally Seller', 'client', peak.id, people.agent.id);
  await mk('neighbor', 'ned@example.com', 'Ned Neighbor', 'client', peak.id, people.agent.id);
  await mk('buyer', 'bo@example.com', 'Bo Buyer', 'client', peak.id, people.agent.id);
  await mk('saaAgent', 'sam@saahomes.test', 'Sam SAA', 'agent', 1);
  await mk('saaSeller', 'sally@example.com', 'Sally at SAA', 'client', 1, people.saaAgent.id);
  const { generateToken } = await import('../src/middleware/auth.js');
  tokens.owner = generateToken({ id: people.owner.id, email: people.owner.email, role: 'admin', tenant_id: peak.id });
  tokens.agent = generateToken({ id: people.agent.id, email: people.agent.email, role: 'agent', tenant_id: peak.id });
  tokens.agent2 = generateToken({ id: people.agent2.id, email: people.agent2.email, role: 'agent', tenant_id: peak.id });
  tokens.saa = generateToken({ id: people.saaAgent.id, email: people.saaAgent.email, role: 'agent', tenant_id: 1 });
  await q(
    `INSERT INTO home_profiles (user_id, address_line, city, postal_code, living_area) VALUES ($1, '7 Aspen Ct', 'Loveland', '80538', 2100)`,
    [people.seller.id]
  );
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

let planId;

test('“I’m thinking of selling” starts a plan from their home and tells their agent', { skip }, async () => {
  assert.equal((await call('GET', '/seller')).status, 401);
  assert.equal((await call('GET', '/seller', as(people.seller))).json.data, null);
  const r = await call('POST', '/seller/start', as(people.seller));
  assert.equal(r.status, 201, r.text);
  const plan = r.json.data;
  planId = plan.id;
  assert.equal(plan.address_line, '7 Aspen Ct');
  assert.equal(plan.status, 'preparing');
  assert.ok(plan.checklist.some((i) => i.decision === 'skip'), 'the prep list says what to skip too');
  assert.ok(plan.timeline.find((s) => s.key === 'list'));
  assert.equal((await call('POST', '/seller/start', as(people.seller))).status, 200, 'starting again keeps the same plan');

  const { rows: [u] } = await db.pool.query('SELECT intent, next_touch_at FROM users WHERE id = $1', [people.seller.id]);
  assert.equal(u.intent, 'both', 'a buyer who sells keeps their buyer side');
  assert.ok(u.next_touch_at, 'due for a call');
  await new Promise((resolve) => setTimeout(resolve, 150));
  const { rows: mail } = await db.pool.query("SELECT to_email, subject, html, tenant_id FROM email_outbox WHERE subject LIKE '%thinking of selling%'");
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to_email, 'andy@peak-sell.test');
  assert.equal(mail[0].tenant_id, peak.id);
  assert.match(mail[0].html, /PEAK REALTY/);
  assert.doesNotMatch(mail[0].html, SAA_STRINGS);
});

test('asking for a market analysis reaches the agent once', { skip }, async () => {
  const r = await call('POST', '/seller/cma', { ...as(people.seller), body: { note: 'We redid the kitchen in 2022' } });
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.data.cma.requested_at);
  assert.equal((await call('POST', '/seller/cma', as(people.seller))).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const { rows } = await db.pool.query("SELECT html FROM email_outbox WHERE subject = 'Sally Seller asked for a market analysis'");
  assert.equal(rows.length, 1, 'a second tap the same day does not resend');
  assert.match(rows[0].html, /We redid the kitchen in 2022/);
  const { rows: ev } = await db.pool.query("SELECT tenant_id FROM events WHERE type = 'cma_request' AND user_id = $1", [people.seller.id]);
  assert.deepEqual(ev.map((e) => e.tenant_id), [peak.id]);
});

test('only the client’s own agent and the owner can run the plan', { skip }, async () => {
  const mine = await call('GET', '/agent/sellers', { auth: tokens.agent });
  assert.equal(mine.status, 200, mine.text);
  assert.equal(mine.json.data[0].cma_waiting, true);
  assert.equal((await call('GET', '/agent/sellers', { auth: tokens.agent2 })).json.data.length, 0);
  assert.equal((await call('GET', '/agent/sellers', { auth: tokens.owner })).json.data.length, 1);
  assert.equal((await call('GET', '/agent/sellers', { auth: tokens.saa, host: SAA })).json.data.length, 0);
  assert.equal((await call('GET', `/agent/sellers/${planId}`, { auth: tokens.agent2 })).status, 404);
  assert.equal((await call('GET', `/agent/sellers/${planId}`, { auth: tokens.saa, host: SAA })).status, 404);
  assert.equal((await call('PATCH', `/agent/sellers/${planId}`, { auth: tokens.agent2, body: { status: 'listed' } })).status, 404);
  assert.equal((await call('POST', `/agent/sellers/${planId}/offers`, { auth: tokens.saa, body: { price: 1 } })).status, 403);
});

test('the agent edits the prep list and sets the dates; the client sees them and ticks items off', { skip }, async () => {
  const { json: { data: plan } } = await call('GET', `/agent/sellers/${planId}`, { auth: tokens.agent });
  const checklist = plan.checklist.map((i) => (i.id === 'floors' ? { ...i, decision: 'skip', note: 'Buyers here expect to choose their own' } : i));
  checklist.push({ title: 'Fix the fence gate latch', decision: 'fix' });
  const timeline = plan.timeline.map((s) => (s.key === 'list' ? { ...s, date: '2026-11-06' } : s));
  const r = await call('PATCH', `/agent/sellers/${planId}`, {
    auth: tokens.agent, body: { checklist, timeline, cma_ready: true, cma_summary: 'List at $649,000 to $665,000.' },
  });
  assert.equal(r.status, 200, r.text);

  const seen = (await call('GET', '/seller', as(people.seller))).json.data;
  assert.equal(seen.checklist.find((i) => i.id === 'floors').decision, 'skip');
  assert.ok(seen.checklist.find((i) => i.title === 'Fix the fence gate latch'));
  assert.equal(seen.timeline.find((s) => s.key === 'list').date, '2026-11-06');
  assert.equal(seen.cma.summary, 'List at $649,000 to $665,000.');
  const tick = await call('PATCH', '/seller/checklist/paint', { ...as(people.seller), body: { done: true } });
  assert.equal(tick.json.data.checklist.find((i) => i.id === 'paint').done, true);
  assert.equal((await call('PATCH', '/seller/checklist/paint', { ...as(people.neighbor), body: { done: true } })).status, 404);
  const { rows: n } = await db.pool.query("SELECT title FROM notifications WHERE user_id = $1 AND type = 'seller_plan'", [people.seller.id]);
  assert.ok(n.some((x) => x.title === 'Your market analysis is ready'));
});

test('once listed: showings without buyer details, feedback, and offers side by side for this client only', { skip }, async () => {
  const listing = await insertListing(db.pool, { city: 'Loveland', postal_code: '80538', list_price: 655000 });
  await call('PATCH', `/agent/sellers/${planId}`, { auth: tokens.agent, body: { status: 'listed', listing_key: listing.listing_id, list_price: 655000 } });
  await db.pool.query(
    `INSERT INTO showing_requests (name, email, phone, showing_date, showing_time, listing_slug, listing_address, tenant_id)
     VALUES ('Private Buyer', 'private.buyer@example.com', '9705550000', $1, '2:00 PM', $2, '7 Aspen Ct', $3),
            ('Other Brokerage Buyer', 'x@example.com', '1', $1, '3:00 PM', $2, 'x', 1)`,
    [soon(2), listing.slug, peak.id]
  );
  await call('POST', `/agent/sellers/${planId}/feedback`, { auth: tokens.agent, body: { shown_on: soon(2), interest: 'high', feedback: 'Loved the yard, worried about the roof age.' } });
  const a = await call('POST', `/agent/sellers/${planId}/offers`, {
    auth: tokens.agent, body: { price: '$650,000', financing: 'Conventional', down_payment_pct: 20, earnest_money: 10000, close_date: '2026-12-15', contingencies: 'Inspection, appraisal' },
  });
  assert.equal(a.status, 201, a.text);
  await call('POST', `/agent/sellers/${planId}/offers`, { auth: tokens.agent, body: { price: 662000, financing: 'Cash', seller_credit: 5000 } });
  assert.equal((await call('POST', `/agent/sellers/${planId}/offers`, { auth: tokens.agent, body: { financing: 'FHA' } })).status, 400);

  const res = await call('GET', '/seller', as(people.seller));
  const view = res.json.data;
  assert.equal(view.status, 'listed');
  assert.equal(view.showings.length, 1, 'only this brokerage’s showing');
  assert.equal(view.showings[0].date, soon(2));
  assert.doesNotMatch(res.text, /Private Buyer|private\.buyer@example\.com|9705550000/, 'no buyer details');
  assert.equal(view.feedback[0].interest, 'high');
  assert.deepEqual(view.offers.map((o) => [o.label, o.price]), [['Offer B', 662000], ['Offer A', 650000]]);

  // Nobody else ever sees the offers.
  assert.equal((await call('GET', '/seller', as(people.neighbor))).json.data, null);
  assert.equal((await call('GET', `/seller?token=${people.seller.manage_token}`, { host: SAA })).status, 401);
  assert.equal((await call('GET', '/seller', { ...as(people.saaSeller), host: SAA })).json.data, null, 'same email at another brokerage');
  const buyerSees = await call('GET', '/seller', as(people.buyer));
  assert.doesNotMatch(buyerSees.text, /662000|Offer B/);
  const { rows: offers } = await db.pool.query('SELECT DISTINCT tenant_id FROM seller_offers');
  assert.deepEqual(offers.map((o) => o.tenant_id), [peak.id]);

  // Accepting an offer puts the home under contract.
  const offerB = view.offers[0].id;
  const acc = await call('PATCH', `/agent/sellers/${planId}/offers/${offerB}`, { auth: tokens.agent, body: { status: 'accepted' } });
  assert.equal(acc.status, 200, acc.text);
  assert.equal(acc.json.data.status, 'under_contract');
  assert.equal(acc.json.data.offers.find((o) => o.id === offerB).price, 662000, 'other fields kept');
  assert.ok(acc.json.data.closing_checklist.length > 0);
});

test('a buyer becomes a seller in one click from their agent, keeping their history', { skip }, async () => {
  await db.pool.query("INSERT INTO saved_searches (user_id, name) VALUES ($1, 'Windsor 3 bed')", [people.buyer.id]);
  assert.equal((await call('POST', `/agent/clients/${people.buyer.id}/seller`, { auth: tokens.agent2 })).status, 404);
  const r = await call('POST', `/agent/clients/${people.buyer.id}/seller`, {
    auth: tokens.agent, body: { address: { address_line: '55 Birch Ln', city: 'Windsor', postal_code: '80550' } },
  });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.data.origin, 'agent');
  assert.equal(r.json.data.address_line, '55 Birch Ln');
  const { rows: [u] } = await db.pool.query('SELECT intent FROM users WHERE id = $1', [people.buyer.id]);
  assert.equal(u.intent, 'both');
  const { rows: searches } = await db.pool.query('SELECT name FROM saved_searches WHERE user_id = $1', [people.buyer.id]);
  assert.deepEqual(searches.map((s) => s.name), ['Windsor 3 bed']);
  const mine = (await call('GET', '/seller', as(people.buyer))).json.data;
  assert.equal(mine.status, 'preparing');
  assert.equal(mine.offers.length, 0, 'their own plan, no one else’s offers');
});

test('a tour booked from a listing lands in the tour flow with a co-buyer and tells the agent', { skip }, async () => {
  const home = await insertListing(db.pool, { city: 'Loveland', postal_code: '80538' });
  const body = { listing_keys: [home.listing_id], windows: [{ date: soon(4), part: 'morning' }, { date: soon(5), part: 'evening' }], note: 'Can we see the garage?' };
  assert.equal((await call('POST', '/tours', { ...as(people.neighbor), body: { ...body, co_buyer: { name: 'Pat', email: 'not-an-email' } } })).status, 400);
  const r = await call('POST', '/tours', { ...as(people.neighbor), body: { ...body, co_buyer: { name: 'Pat Partner', email: 'pat@example.com' } } });
  assert.equal(r.status, 201, r.text);
  const { rows: [tour] } = await db.pool.query('SELECT co_buyer, tenant_id FROM tour_requests WHERE id = $1', [r.json.data.id]);
  assert.deepEqual(tour.co_buyer, { name: 'Pat Partner', email: 'pat@example.com' });
  assert.equal(tour.tenant_id, peak.id);
  const { rows: [showing] } = await db.pool.query('SELECT message, tenant_id FROM showing_requests ORDER BY id DESC LIMIT 1');
  assert.match(showing.message, /Coming along: Pat Partner, pat@example.com/);
  assert.equal(showing.tenant_id, peak.id);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const { rows: mail } = await db.pool.query("SELECT to_email, html FROM email_outbox WHERE subject = 'Ned Neighbor asked for a tour'");
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to_email, 'andy@peak-sell.test');
  assert.match(mail[0].html, /Can we see the garage\?/);
  assert.doesNotMatch(mail[0].html, SAA_STRINGS);
  const { cleanCoBuyer } = await import('../src/controllers/tourController.js');
  assert.equal(cleanCoBuyer(null), null);
  assert.equal(cleanCoBuyer({ name: '', email: '' }), null);
});

test('texting is a quiet no-op until it is set up', async () => {
  const { sendTextIfAllowed } = await import('../src/services/textHook.js');
  assert.deepEqual(await sendTextIfAllowed({ tenantId: 1, userId: 1, body: 'hi', kind: 'tour_request' }), { sent: false, reason: 'texting not set up' });
});
