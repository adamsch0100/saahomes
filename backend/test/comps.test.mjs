import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';

const subject = { living_area: 2000, beds: 3, baths: 2 };

test('each sale is adjusted toward the owner\'s home by stated rules', async () => {
  const { adjustComp } = await import('../src/services/compsService.js');
  assert.deepEqual(adjustComp(subject, { sold_price: 450000, living_area: 1800, beds: 3, baths: 2 }),
    { adjusted: 475000, notes: ['+200 sq ft'] });
  assert.deepEqual(adjustComp(subject, { sold_price: 500000, living_area: 2000, beds: 4, baths: 2.5 }),
    { adjusted: 486250, notes: ['−1 bed', '−0.5 bath'] });
  assert.equal(adjustComp(subject, { sold_price: null }), null);
});

test('condition and upgrades move the owner\'s number, within limits', async () => {
  const { compEstimate } = await import('../src/services/compsService.js');
  const comps = [500000, 480000, 475000].map((p) => ({ sold_price: p, living_area: 2000, beds: 3, baths: 2, similarity: 1 }));
  const plain = compEstimate(subject, comps);
  assert.equal(plain.base, 480000);
  assert.equal(plain.mid, 480000);
  const better = compEstimate(subject, comps, { condition: 'updated', upgrades: ['kitchen', 'kitchen'] });
  assert.equal(better.mid, 504000);
  assert.deepEqual([better.low, better.high], [484000, 524000]);
  const all = compEstimate(subject, comps, { condition: 'average', upgrades: ['kitchen', 'baths', 'basement', 'roof', 'solar'] });
  assert.equal(all.upgrades_pct, 0.08);
  assert.equal(compEstimate(subject, []), null);
});

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

test('owners pick their comps and their number is kept and reaches the agent', { skip: !hasTestDatabase }, async () => {
  for (let i = 0; i < 8; i += 1) {
    await db.pool.query(
      `INSERT INTO sold_listings (listing_id, city, postal_code, street_number, street_name, beds, baths, living_area, sold_price, closed_date)
       VALUES ($1, 'Windsor', '80550', $2, 'Sold St', 3, 2, $3, $4, CURRENT_DATE - $5::int)`,
      [`S${i}`, String(10 + i), 1900 + i * 40, 470000 + i * 8000, 20 + i * 15]
    );
  }
  // Too old, and the wrong size: never offered.
  await db.pool.query(
    `INSERT INTO sold_listings (listing_id, city, postal_code, street_name, beds, living_area, sold_price, closed_date)
     VALUES ('OLD', 'Windsor', '80550', 'Old St', 3, 2000, 300000, CURRENT_DATE - 500),
            ('HUGE', 'Windsor', '80550', 'Big St', 6, 6000, 1900000, CURRENT_DATE - 10)`
  );

  const b = browser(server.url);
  assert.equal((await b.post('/alerts', { email: 'owner@comcast.net', contact_name: 'Olive Owner', city: 'Windsor' })).status, 201);
  const { rows: [me] } = await db.pool.query("SELECT id FROM users WHERE email = 'owner@comcast.net'");
  const { rows: [home] } = await db.pool.query(
    `INSERT INTO home_profiles (user_id, address_line, city, postal_code, beds, baths, living_area)
     VALUES ($1, '5 Home Ct', 'Windsor', '80550', 3, 2, 2000) RETURNING id`, [me.id]
  );

  let r = await b.get(`/home/${home.id}/comps`);
  assert.equal(r.status, 200, r.text);
  const ids = r.json.data.comps.map((c) => c.id);
  assert.ok(!ids.includes('OLD') && !ids.includes('HUGE'));
  assert.equal(ids.length, 8);
  assert.equal(r.json.data.comps.filter((c) => c.included).length, 6);
  assert.ok(r.json.data.estimate.mid > 400000);
  assert.equal(r.json.data.condition, 'average');

  const stranger = browser(server.url);
  assert.equal((await stranger.post('/alerts', { email: 'other.owner@comcast.net', city: 'Windsor' })).status, 201);
  assert.equal((await stranger.get(`/home/${home.id}/comps`)).status, 404);

  assert.equal((await b.put(`/home/${home.id}/comps`, { included: ['S0'], condition: 'mint' })).status, 400);
  r = await b.put(`/home/${home.id}/comps`, { included: ['S0', 'S1', 'NOT-A-SALE'], condition: 'remodeled', upgrades: ['kitchen'] });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.estimate.used, 2);
  assert.equal(r.json.data.estimate.condition_pct, 0.06);

  r = await b.get(`/home/${home.id}/comps`);
  assert.deepEqual(r.json.data.comps.filter((c) => c.included).map((c) => c.id).sort(), ['S0', 'S1']);
  assert.deepEqual(r.json.data.upgrades, ['kitchen']);
  assert.equal(r.json.data.condition, 'remodeled');

  const { rows: [u] } = await db.pool.query('SELECT seller_heat FROM users WHERE id = $1', [me.id]);
  assert.equal(u.seller_heat, true);
  const ev = await db.pool.query("SELECT meta FROM events WHERE user_id = $1 AND type = 'comps_adjusted'", [me.id]);
  assert.equal(ev.rows.length, 1);
});
