import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-briefs';

// 6:57am Mountain (daylight time) on Oct 13, 2026.
const BRIEF_TICK = new Date('2026-10-13T12:57:00Z');

test('a lead\'s day becomes plain reasons, ranked, with one opener', async () => {
  const { summarizeLead } = await import('../src/services/morningBrief.js');
  const homes = new Map([['L1', { street_number: '12', street_name: 'Elm St', city: 'Windsor', list_price: 512000 }]]);
  const ev = (type, extra = {}) => ({ type, listing_id: null, meta: {}, occurred_at: BRIEF_TICK, ...extra });

  const s = summarizeLead({ id: 1, name: 'Taylor Buyer', lead_score: 40 }, [
    ev('listing_view', { listing_id: 'L1' }),
    ev('listing_view', { listing_id: 'L1' }),
    ev('home_reaction', { listing_id: 'L1', meta: { reaction: 'love' } }),
    ev('search', { meta: { asked: '3 beds under 550k' } }),
    ev('tour_request', { meta: { homes: 3 } }),
  ], homes);
  assert.deepEqual(s.reasons, ['Asked for a tour of 3 homes', 'Loved 12 Elm St, Windsor ($512K)', 'Opened 12 Elm St, Windsor 2 times']);
  assert.equal(s.opener, 'Confirm a time for the tour they asked for.');

  const quiet = summarizeLead({ id: 2, name: 'Quiet' }, [ev('listing_view', { listing_id: 'L1' })], homes);
  assert.equal(quiet, null, 'one look at one home is not a reason to call');

  const due = summarizeLead({ id: 3, name: 'Due' }, [], homes, { dueToday: true });
  assert.deepEqual(due.reasons, ['Follow-up due today']);

  const seller = summarizeLead({ id: 4, name: 'Owner' }, [ev('comps_adjusted')], homes);
  assert.match(seller.opener, /what their home would sell for/);
});

test('the brief only goes out on the 6am Mountain tick', async () => {
  const { denverHour, runMorningBriefs } = await import('../src/services/morningBrief.js');
  assert.equal(denverHour(BRIEF_TICK), 6);
  assert.equal(denverHour(new Date('2026-12-13T13:57:00Z')), 6, 'standard time shifts the UTC hour');
  const r = await runMorningBriefs({ now: new Date('2026-10-13T15:57:00Z'), pool: { query: () => { throw new Error('no db needed'); } } });
  assert.equal(r.skipped, 'not_brief_hour');
});

// ------------------------------------------------------------ end to end
let db;
let server;
test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
});
test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

test('each agent gets their own leads once a day, and admins cover the unassigned', { skip: !hasTestDatabase }, async () => {
  const q = (sql, p) => db.pool.query(sql, p);
  const { rows: [agent] } = await q("INSERT INTO users (email, name, role, status, manage_token) VALUES ('kim@saahomes.com', 'Kim Agent', 'agent', 'active', md5(random()::text) || md5(random()::text)) RETURNING *");
  const { rows: [admin] } = await q("INSERT INTO users (email, name, role, status, manage_token) VALUES ('adam@saahomes.com', 'Adam Admin', 'admin', 'active', md5(random()::text) || md5(random()::text)) RETURNING *");
  const { rows: [mine] } = await q("INSERT INTO users (email, name, phone, status, assigned_agent_id, manage_token) VALUES ('buyer1@comcast.net', 'Pat Buyer', '9705550101', 'active', $1, md5(random()::text) || md5(random()::text)) RETURNING *", [agent.id]);
  const { rows: [pool] } = await q("INSERT INTO users (email, name, status, manage_token) VALUES ('buyer2@comcast.net', 'Sam Seller', 'active', md5(random()::text) || md5(random()::text)) RETURNING *");
  const { rows: [stale] } = await q("INSERT INTO users (email, name, status, assigned_agent_id, manage_token) VALUES ('old@comcast.net', 'Old Lead', 'active', $1, md5(random()::text) || md5(random()::text)) RETURNING *", [agent.id]);
  const home = await insertListing(db.pool, { city: 'Windsor', street_number: '40', street_name: 'Oak Ct' });

  const at = (h) => new Date(BRIEF_TICK.getTime() - h * 3600 * 1000);
  const ev = (userId, type, extra = {}) => q(
    'INSERT INTO events (user_id, type, listing_id, meta, occurred_at) VALUES ($1, $2, $3, $4, $5)',
    [userId, type, extra.listing_id || null, JSON.stringify(extra.meta || {}), extra.at || at(2)]
  );
  await ev(mine.id, 'home_reaction', { listing_id: home.listing_id, meta: { reaction: 'love' } });
  await ev(mine.id, 'home_saved', { listing_id: home.listing_id });
  await ev(pool.id, 'comps_adjusted', { meta: { home_id: 1 } });
  await ev(stale.id, 'tour_request', { meta: { homes: 2 }, at: at(30) }); // before yesterday morning

  const sent = [];
  const send = async (to, subject, html) => sent.push({ to, subject, html });
  const { runMorningBriefs } = await import('../src/services/morningBrief.js');
  let r = await runMorningBriefs({ now: BRIEF_TICK, send, pool: db.pool });
  assert.equal(r.sent, 2);
  const kim = sent.find((m) => m.to === 'kim@saahomes.com');
  assert.equal(kim.subject, '1 person to call today, starting with Pat');
  assert.match(kim.html, /Loved 40 Oak Ct, Windsor/);
  assert.match(kim.html, /tel:9705550101/);
  assert.doesNotMatch(kim.html, /Old Lead|Sam Seller/);
  const adam = sent.find((m) => m.to === 'adam@saahomes.com');
  assert.match(adam.html, /Sam Seller/);
  assert.doesNotMatch(adam.html, /Pat Buyer/, 'assigned leads stay with their agent');

  // Another brokerage's admin never covers SAA's unassigned leads.
  const { rows: [peak] } = await q("INSERT INTO tenants (slug, name) VALUES ('peak','Peak Realty') RETURNING id");
  const { rows: [peakAdmin] } = await q("INSERT INTO users (email, name, role, status, tenant_id, manage_token) VALUES ('boss@peakrealty.com', 'Peak Boss', 'admin', 'active', $1, md5(random()::text) || md5(random()::text)) RETURNING *", [peak.id]);
  const { buildBrief } = await import('../src/services/morningBrief.js');
  assert.deepEqual((await buildBrief(peakAdmin, { now: BRIEF_TICK, pool: db.pool })).items.map((i) => i.name), [], 'tenant 1 unassigned lead stays in tenant 1');

  r = await runMorningBriefs({ now: new Date(BRIEF_TICK.getTime() + 60_000), send, pool: db.pool });
  assert.equal(r.sent, 0, 'once a day');

  // The cockpit shows the same brief live, and the email can be turned off.
  const { generateToken } = await import('../src/middleware/auth.js');
  const auth = { Authorization: `Bearer ${generateToken({ id: agent.id, email: agent.email, role: 'agent' })}` };
  let res = await fetch(`${server.url}/api/agent/brief`, { headers: auth });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.email_on, true);
  res = await fetch(`${server.url}/api/agent/brief`, { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: false }) });
  assert.equal(res.status, 200);
  await q('DELETE FROM morning_briefs');
  sent.length = 0;
  await runMorningBriefs({ now: BRIEF_TICK, send, pool: db.pool });
  assert.deepEqual(sent.map((m) => m.to), ['adam@saahomes.com']);
  assert.equal((await fetch(`${server.url}/api/agent/brief`)).status, 401);

  // The admin console's login has no user row; it still sees the unassigned leads.
  await ev(pool.id, 'comps_adjusted', { at: new Date(Date.now() - 60_000) });
  const envAdmin = { Authorization: `Bearer ${generateToken({ email: 'owner@example.com', role: 'admin' })}` };
  const live = await (await fetch(`${server.url}/api/agent/brief`, { headers: envAdmin })).json();
  assert.equal(live.data.email_on, null);
  assert.deepEqual(live.data.items.map((i) => i.name), ['Sam Seller']);
});
