import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

test('a search query becomes a FUB property search', async () => {
  const { propertySearchFromParams } = await import('../src/services/followUpBossService.js');
  assert.deepEqual(
    propertySearchFromParams('city=Windsor&postal_code=80550&minPrice=400000&beds=3&sort=newest'),
    { city: 'Windsor', zip: '80550', minPrice: 400000, maxPrice: undefined, minBedrooms: 3, minBathrooms: undefined }
  );
  assert.equal(propertySearchFromParams('city=__noco__').city, undefined);
});

let db;
let server;
let fub;
test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
  fub = await import('../src/services/followUpBossService.js');
});
test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

let shopperId;

test('browsing before signup reaches FUB once, as dated history', { skip: !hasTestDatabase }, async () => {
  const home = await insertListing(db.pool, { city: 'Johnstown', list_price: 515000, beds: 4 });
  const b = browser(server.url);
  assert.equal((await b.post('/events', { type: 'search', params: 'city=Johnstown&beds=4', total: 12 })).status, 200);
  assert.equal((await b.post('/alerts/view', { listing_id: home.listing_id })).status, 200);
  assert.equal((await b.post('/alerts/view', { listing_id: home.listing_id })).status, 200); // deduped
  const r = await b.post('/alerts', { email: 'history.shopper@comcast.net', contact_name: 'Hana Shopper', city: 'Johnstown' });
  assert.equal(r.status, 201, r.text);
  shopperId = (await db.pool.query("SELECT id FROM users WHERE email = 'history.shopper@comcast.net'")).rows[0].id;

  const posted = [];
  const post = async (e) => { posted.push(e); return { id: posted.length }; };
  const first = await fub.syncVisitorHistoryToFollowUpBoss(shopperId, { pool: db.pool, post });
  assert.equal(first.sent, 2);
  const view = posted.find((e) => e.type === 'Viewed Property');
  assert.equal(view.property.mlsNumber, home.listing_id);
  assert.equal(view.property.price, 515000);
  assert.equal(view.person.firstName, 'Hana');
  assert.ok(Date.parse(view.occurredAt));
  const search = posted.find((e) => e.type === 'Property Search');
  assert.equal(search.propertySearch.city, 'Johnstown');
  assert.equal(search.propertySearch.minBedrooms, 4);

  const again = await fub.syncVisitorHistoryToFollowUpBoss(shopperId, { pool: db.pool, post });
  assert.equal(again.sent, 0);
});

test('the funnel counts each person once per step', { skip: !hasTestDatabase }, async () => {
  const { getFunnel } = await import('../src/services/funnel.js');
  const f = await getFunnel({ days: 30 }, db.pool);
  const by = Object.fromEntries(f.steps.map((s) => [s.key, s.people]));
  assert.deepEqual(by, { visited: 1, searched: 1, viewed: 1, saved_home: 0, identified: 1, engaged: 0, showing: 0 });
  assert.equal(f.steps[4].pct_of_visitors, 100);
  assert.deepEqual(f.signups_by_form, [{ via: 'save_search', n: 1 }]);
});

test('the lead score is mirrored to a FUB custom field only when it changes', { skip: !hasTestDatabase }, async () => {
  await db.pool.query('UPDATE users SET fub_person_id = 77, lead_score = 20 WHERE id = $1', [shopperId]);
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 200 }; };
  const opts = { pool: db.pool, fetchImpl, apiKey: 'test-key', field: 'customSAAScore' };
  assert.equal((await fub.syncLeadScoreToFollowUpBoss(shopperId, opts)).ok, true);
  assert.equal(calls[0].url, 'https://api.followupboss.com/v1/people/77');
  assert.equal(calls[0].opts.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].opts.body), { customSAAScore: 20 });
  assert.equal((await fub.syncLeadScoreToFollowUpBoss(shopperId, opts)).skipped, 'unchanged');
  assert.equal((await fub.syncLeadScoreToFollowUpBoss(shopperId, { ...opts, field: 'name' })).skipped, 'not_configured');
  assert.equal(calls.length, 1);
});

test('a market report for someone else’s email does not rename them', { skip: !hasTestDatabase }, async () => {
  const stranger = browser(server.url);
  const r = await stranger.post('/market-report', {
    firstName: 'Not', lastName: 'Hana', email: 'history.shopper@comcast.net', phone: '9705550000',
    address_line: '12 Elm St', city: 'Johnstown', postal_code: '80534',
  });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.signInRequired, true);
  const { rows: [u] } = await db.pool.query('SELECT name, phone FROM users WHERE id = $1', [shopperId]);
  assert.equal(u.name, 'Hana Shopper');
  assert.equal(u.phone, null);
  assert.ok(!stranger.jar.has('saa_user_token'));
});
