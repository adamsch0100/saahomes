import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

const row = (listing_id, list_price, days_on_market = 30) => ({ listing_id, list_price, days_on_market });

test('first run is a baseline: only homes listed this week are news', async () => {
  const { diffSearchResults } = await import('../src/services/alertDigest.js');
  const d = diffSearchResults(null, [row('A', 500000, 40), row('B', 450000, 2), row('C', 400000, null)]);
  assert.equal(d.baseline, true);
  assert.deepEqual(d.newListings.map((r) => r.listing_id), ['B']);
  assert.deepEqual(d.newMatches, []);
  assert.deepEqual(d.priceDrops, []);
  assert.deepEqual(d.snapshot.prices, { A: 500000, B: 450000, C: 400000 });
});

test('a price drop means the price fell since the last run, and fires once', async () => {
  const { diffSearchResults } = await import('../src/services/alertDigest.js');
  const prev = { ids: ['A', 'B'], prices: { A: 500000, B: 450000 } };
  const d = diffSearchResults(prev, [row('A', 480000), row('B', 460000)]);
  assert.deepEqual(d.priceDrops.map((r) => [r.listing_id, r.prev_price]), [['A', 500000]]);
  const again = diffSearchResults(d.snapshot, [row('A', 480000), row('B', 460000)]);
  assert.deepEqual(again.priceDrops, []);
  assert.equal(again.changed, false);
});

test('homes joining a search are new listings or new matches by days on market', async () => {
  const { diffSearchResults } = await import('../src/services/alertDigest.js');
  const prev = { ids: ['A'], prices: { A: 500000 } };
  const d = diffSearchResults(prev, [row('A', 500000), row('N', 400000, 1), row('M', 410000, 90)]);
  assert.deepEqual(d.newListings.map((r) => r.listing_id), ['N']);
  assert.deepEqual(d.newMatches.map((r) => r.listing_id), ['M']);
  assert.deepEqual(d.left, []);
});

test('a legacy snapshot without prices is a baseline that still knows its ids', async () => {
  const { diffSearchResults } = await import('../src/services/alertDigest.js');
  const d = diffSearchResults({ ids: ['A', 'Z'], prices: null }, [row('A', 400000, 1), row('B', 450000, 1), row('C', 1, 60)]);
  assert.equal(d.baseline, true);
  assert.deepEqual(d.newListings.map((r) => r.listing_id), ['B']);
  assert.deepEqual(d.newMatches, []);
  assert.deepEqual(d.left, ['Z']);
  assert.equal(d.changed, true);
});

// ------------------------------------------------------------ end to end
let db;
let server;
let digest;
const sent = [];
const send = async (to, subject, html) => { sent.push({ to, subject, html }); };

test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
  digest = await import('../src/services/alertDigest.js');
});
test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

async function makeSearch(email, filters) {
  const u = await db.pool.query(
    `INSERT INTO users (email, name, manage_token) VALUES ($1, 'Pat Buyer', $2) RETURNING id, manage_token`,
    [email, `tok${Math.random().toString(36).slice(2)}${Date.now()}`]
  );
  const s = await db.pool.query(
    `INSERT INTO saved_searches (user_id, name, filters) VALUES ($1, 'Test search', $2) RETURNING *`,
    [u.rows[0].id, JSON.stringify(filters)]
  );
  return { ...s.rows[0], manage_token: u.rows[0].manage_token };
}

const run = (search) => digest.runSearch(search, { send });
const eventsOf = async (searchId, type) => (await db.pool.query(
  'SELECT listing_id, detail FROM alert_events WHERE search_id = $1 AND type = $2 ORDER BY id', [searchId, type]
)).rows;

test('alerts tell the truth across runs', { skip: !hasTestDatabase }, async () => {
  const old = await insertListing(db.pool, { city: 'Wellington', list_price: 500000, original_list_price: 520000, days_on_market: 40 });
  const fresh = await insertListing(db.pool, { city: 'Wellington', list_price: 450000, days_on_market: 2 });
  const moving = await insertListing(db.pool, { city: 'Wellington', list_price: 600000, days_on_market: 50 });
  const search = await makeSearch('truth@comcast.net', { city: 'Wellington', maxPrice: '700000' });

  // Run 1: baseline. Only the 2-day-old home is new; the old one's
  // below-original price is not a "drop".
  let r = await run(search);
  assert.equal(r.sent, true);
  assert.equal(r.baseline, true);
  assert.deepEqual(r.counts, { new: 1, drops: 0, joined: 0, offMarket: 0 });
  assert.match(sent.at(-1).html, new RegExp(fresh.street_number));

  // Run 2: nothing changed → no email, no new snapshot.
  const snapsBefore = (await db.pool.query('SELECT COUNT(*)::int AS n FROM search_snapshots WHERE search_id = $1', [search.id])).rows[0].n;
  r = await run(search);
  assert.equal(r.sent, false);
  const snapsAfter = (await db.pool.query('SELECT COUNT(*)::int AS n FROM search_snapshots WHERE search_id = $1', [search.id])).rows[0].n;
  assert.equal(snapsAfter, snapsBefore);

  // Run 3: a real drop is reported once with its real old price.
  await db.pool.query('UPDATE listings SET list_price = 480000 WHERE id = $1', [old.id]);
  r = await run(search);
  assert.deepEqual(r.counts, { new: 0, drops: 1, joined: 0, offMarket: 0 });
  const drops = await eventsOf(search.id, 'price_drop');
  assert.equal(drops.length, 1);
  assert.equal(Number(drops[0].detail.old_price), 500000);
  assert.match(sent.at(-1).html, /line-through[^>]*>\$500,000/);
  r = await run(search);
  assert.equal(r.sent, false, 'the same drop must not repeat');

  // Run 4: priced out of the search while still Active → not "off market",
  // and no email for it.
  await db.pool.query('UPDATE listings SET list_price = 800000 WHERE id = $1', [moving.id]);
  r = await run(search);
  assert.equal(r.sent, false);

  // Run 5: a home going pending is a real status change.
  await db.pool.query("UPDATE listings SET status = 'Pending' WHERE id = $1", [fresh.id]);
  r = await run(search);
  assert.deepEqual(r.counts, { new: 0, drops: 0, joined: 0, offMarket: 1 });
  assert.equal((await eventsOf(search.id, 'off_market')).length, 1);

  // Only the latest few snapshots are kept.
  const kept = (await db.pool.query('SELECT COUNT(*)::int AS n FROM search_snapshots WHERE search_id = $1', [search.id])).rows[0].n;
  assert.ok(kept <= 3, `kept ${kept} snapshots`);
});

test('snapshots hold every match, not the 60 most recent', { skip: !hasTestDatabase }, async () => {
  for (let i = 0; i < 75; i += 1) {
    await insertListing(db.pool, { city: 'Timnath', list_price: 400000 + i * 1000, days_on_market: 30 });
  }
  const search = await makeSearch('many@comcast.net', { city: 'Timnath' });
  await run(search);
  const snap = await db.pool.query(
    'SELECT result_ids, result_prices FROM search_snapshots WHERE search_id = $1 ORDER BY id DESC LIMIT 1', [search.id]
  );
  assert.equal(snap.rows[0].result_ids.length, 75);
  assert.equal(Object.keys(snap.rows[0].result_prices).length, 75);

  // 20 new listings at once: the email caps its cards but counts them all.
  for (let i = 0; i < 20; i += 1) {
    await insertListing(db.pool, { city: 'Timnath', list_price: 300000 + i * 1000, days_on_market: 1 });
  }
  const r = await run(search);
  assert.equal(r.counts.new, 20);
  assert.match(sent.at(-1).html, /20 new homes hit the market/);
  const cards = (sent.at(-1).html.match(/Schedule a tour/g) || []).length;
  assert.ok(cards <= 12, `${cards} cards`);
});

test('saving a search keeps the person’s name apart from the search name', { skip: !hasTestDatabase }, async () => {
  await insertListing(db.pool, { city: 'Berthoud' });
  const b = browser(server.url);
  const r = await b.post('/alerts', {
    email: 'jamie.lee@comcast.net', contact_name: 'Jamie Lee', search_name: 'Berthoud starter homes', city: 'Berthoud',
  });
  assert.equal(r.status, 201, r.text);
  const u = await db.pool.query(
    `SELECT u.name, u.phone, s.name AS search_name FROM users u JOIN saved_searches s ON s.user_id = u.id
     WHERE u.email = 'jamie.lee@comcast.net'`
  );
  assert.deepEqual(u.rows[0], { name: 'Jamie Lee', phone: null, search_name: 'Berthoud starter homes' });
});

test('older clients that send only `name` name the search, not the person', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  const r = await b.post('/alerts', { email: 'legacy.client@comcast.net', phone: '9705550199', name: 'Berthoud 3-bed', city: 'Berthoud' });
  assert.equal(r.status, 201, r.text);
  const u = await db.pool.query(
    `SELECT u.name, s.name AS search_name FROM users u JOIN saved_searches s ON s.user_id = u.id
     WHERE u.email = 'legacy.client@comcast.net'`
  );
  assert.deepEqual(u.rows[0], { name: null, search_name: 'Berthoud 3-bed' });

  // A phone without the text opt-in is kept, but grants no SMS consent.
  const c = await db.pool.query(
    `SELECT c.channel FROM contact_consents c JOIN users u ON u.id = c.user_id WHERE u.email = 'legacy.client@comcast.net'`
  );
  assert.deepEqual(c.rows.map((x) => x.channel), ['email']);
});

test('texts need a ticked opt-in and a phone, and the opt-in is logged', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  let r = await b.post('/alerts', { email: 'texter@comcast.net', sms_opt_in: true, city: 'Berthoud' });
  assert.equal(r.status, 400);
  r = await b.post('/alerts', { email: 'texter@comcast.net', phone: '12', city: 'Berthoud' });
  assert.equal(r.status, 400);

  r = await b.post('/alerts', { email: 'texter@comcast.net', phone: '(970) 555-0142', sms_opt_in: true, city: 'Berthoud' });
  assert.equal(r.status, 201, r.text);
  const { SMS_ALERT_CONSENT_WORDING } = await import('../src/controllers/alertController.js');
  const c = await db.pool.query(
    `SELECT c.channel, c.status, c.wording FROM contact_consents c JOIN users u ON u.id = c.user_id
     WHERE u.email = 'texter@comcast.net' ORDER BY c.channel`
  );
  assert.deepEqual(c.rows.map((x) => x.channel), ['email', 'sms']);
  assert.equal(c.rows[1].status, 'granted');
  assert.equal(c.rows[1].wording, SMS_ALERT_CONSENT_WORDING);
});
