import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

const home = (features = {}, extra = {}) => ({
  list_price: 500000, city: 'Windsor', state: 'CO', postal_code: '80550',
  street_number: '12', street_name: 'Elm St', features, ...extra,
});

test('taxes are compared with the rest of the town, and surprises are called out', async () => {
  const { buildLocalFacts } = await import('../src/services/localFacts.js');

  const typical = buildLocalFacts(home({ tax_annual: 3000, tax_year: 2025 }), { townRate: 0.0058 });
  assert.equal(typical.taxes.monthly, 250);
  assert.equal(typical.taxes.rate, 0.006);
  assert.equal(typical.taxes.flag, undefined);
  assert.deepEqual(typical.notes, []);
  assert.equal(typical.monthly_fixed, 250);

  const metro = buildLocalFacts(home({ tax_annual: 6000 }), { townRate: 0.0058 });
  assert.equal(metro.taxes.flag, 'high');
  assert.match(metro.notes[0].text, /metro district/);

  const lot = buildLocalFacts(home({ tax_annual: 400, new_construction: true }), { townRate: 0.0058 });
  assert.equal(lot.taxes.flag, 'lot_only');
  assert.match(lot.notes[0].text, /only the lot/);

  const mentioned = buildLocalFacts(home({ tax_annual: 3000 }, { description: 'Low Windsor Highlands Metro District mill levy!' }), { townRate: 0.0058 });
  assert.equal(mentioned.metro_district, true);
  assert.match(mentioned.notes[0].text, /mentions a metro district/);

  const noTown = buildLocalFacts(home({ tax_annual: 9000 }), { townRate: null });
  assert.equal(noTown.taxes.flag, undefined, 'no comparison without enough homes in town');
});

test('HOA, water and flood facts come straight from the listing', async () => {
  const { buildLocalFacts, monthlyHoa } = await import('../src/services/localFacts.js');
  assert.equal(monthlyHoa(600, 'Semi-Annually'), 100);
  assert.equal(monthlyHoa(600, 'Annually'), 50);
  assert.equal(monthlyHoa(300, 'Quarterly'), 100);

  const f = buildLocalFacts(home(
    { tax_annual: 2400, assoc_fee_freq: 'Quarterly', association_includes: 'Trash, Snow Removal', water_source: 'Well', sewer: 'Septic', irrigation_rights: true },
    { hoa_fee: 270 }
  ));
  assert.deepEqual(f.hoa, { monthly: 90, name: null, includes: ['Trash', 'Snow Removal'] });
  assert.equal(f.monthly_fixed, 290);
  assert.deepEqual(f.water, ['Well water', 'Septic system', 'Comes with irrigation water rights']);
  assert.ok(f.notes.some((n) => n.topic === 'water'));
  assert.equal(f.flood_map_url, 'https://msc.fema.gov/portal/search?AddressQuery=12%20Elm%20St%2C%20Windsor%2C%20CO%2C%2080550');

  assert.equal(buildLocalFacts({ list_price: 1, features: {} }), null, 'nothing to say, no card');
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

test('a home page carries its local facts', { skip: !hasTestDatabase }, async () => {
  for (let i = 0; i < 10; i++) {
    await insertListing(db.pool, { city: 'Windsor', list_price: 500000, features: { tax_annual: 2900 + i * 20 } });
  }
  // New builds and land never set the town's typical rate.
  await insertListing(db.pool, { city: 'Windsor', list_price: 500000, features: { tax_annual: 300, new_construction: true } });
  const target = await insertListing(db.pool, { city: 'Windsor', list_price: 600000, features: { tax_annual: 6100 } });

  const r = await browser(server.url).get(`/listings/${target.slug}`);
  assert.equal(r.status, 200, r.text);
  const facts = r.json.data.local_facts;
  assert.equal(facts.taxes.town_rate, 0.006, 'median of the 11 resale homes, this one included');
  assert.equal(facts.taxes.flag, 'high');
});
