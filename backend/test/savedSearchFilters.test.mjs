import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSavedFilters, savedSearchPath } from '../src/services/listingFilters.js';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

const SQUARE = '-105.10,40.57;-105.06,40.57;-105.06,40.60;-105.10,40.60';

test('saved filters keep everything the search page sends', () => {
  const f = sanitizeSavedFilters({
    postal_code: '80521, 80525', polygon: SQUARE, types: 'house,townhome', keywords: 'mountain view',
    minLotAcres: '0.5', maxSqft: '3000', stories: '1', basement: 'walkout', interior: 'office,solar',
    garage: '2+', listingStatus: 'price-drop', status: 'Active', baths: '2.5', hasTour: 'true',
  });
  assert.deepEqual(f, {
    postal_code: '80521,80525',
    polygon: '-105.1,40.57;-105.06,40.57;-105.06,40.6;-105.1,40.6',
    types: 'house,townhome',
    interior: 'office,solar',
    status: 'Active',
    keywords: 'mountain view',
    garage: '2+',
    baths: '2.5',
    maxSqft: '3000',
    minLotAcres: '0.5',
    hasTour: 'true',
    basement: 'walkout',
    stories: '1',
    listingStatus: 'price-drop',
  });
});

test('saved filters drop junk and unknown keys', () => {
  const f = sanitizeSavedFilters({
    postal_code: 'abc,123', polygon: '1,2;3,4', minPrice: '-5', beds: 'lots', city: 'Denver; DROP TABLE',
    email: 'x@y.z', sort: 'x'.repeat(80), garage: 'yes',
  });
  assert.deepEqual(f, {});
});

test('the alert link reopens the same search', () => {
  const path = savedSearchPath({ city: 'Windsor', postal_code: '80550', types: 'house', minLotAcres: '1' });
  assert.equal(path, '/properties/?city=Windsor&postal_code=80550&types=house&minLotAcres=1');
});

let db;
let server;
test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
  await insertListing(db.pool, { postal_code: '80521', latitude: 40.585, longitude: -105.08 });
  await insertListing(db.pool, { postal_code: '80521', latitude: 40.70, longitude: -105.20 });
  await insertListing(db.pool, { postal_code: '80525', latitude: 40.53, longitude: -105.05 });
  await insertListing(db.pool, { city: 'Loveland', postal_code: '80537', latitude: 40.40, longitude: -105.07 });
});
test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

async function saveAndCount(email, filters) {
  const b = browser(server.url);
  const r = await b.post('/alerts', { email, phone: '9705550123', name: 'test', ...filters });
  assert.equal(r.status, 201, r.text);
  const { rows } = await db.pool.query(
    'SELECT s.filters FROM saved_searches s JOIN users u ON u.id = s.user_id WHERE u.email = $1', [email]
  );
  const { getSearchMatchMeta } = await import('../src/services/leadScore.js');
  const { buildWhere } = await import('../src/services/alertDigest.js');
  const meta = await getSearchMatchMeta(rows[0].filters, db.pool);
  const { whereSql, params } = buildWhere(rows[0].filters);
  const digest = await db.pool.query(`SELECT listing_id FROM listings WHERE ${whereSql}`, params);
  return { filters: rows[0].filters, count: meta.match_count, digestCount: digest.rows.length };
}

test('a ZIP-only saved search alerts on that ZIP, not the whole state', { skip: !hasTestDatabase }, async () => {
  const r = await saveAndCount('zip.saver@comcast.net', { postal_code: '80521' });
  assert.equal(r.filters.postal_code, '80521');
  assert.equal(r.count, 2);
  assert.equal(r.digestCount, 2);
});

test('a drawn-area saved search alerts only inside the area', { skip: !hasTestDatabase }, async () => {
  const r = await saveAndCount('area.saver@comcast.net', { polygon: SQUARE });
  assert.ok(r.filters.polygon);
  assert.equal(r.count, 1);
  assert.equal(r.digestCount, 1);
});
