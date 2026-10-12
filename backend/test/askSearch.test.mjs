import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

test('plain words become only the filters the buyer said', async () => {
  const { parseSearchIntent, unsupportedAsks } = await import('../src/services/searchIntentParser.js');
  const p = (t) => parseSearchIntent(t, { lenient: true })?.filters;

  assert.deepEqual(p('3 beds under $550K with a big yard'), { maxPrice: '550000', beds: '3' });
  assert.deepEqual(unsupportedAsks('3 beds under $550K with a big yard').map((u) => u.topic), ['yard']);

  assert.deepEqual(p('between 3 and 4 bedrooms in Windsor'), { city: 'Windsor', beds: '3' }, 'bedroom counts are not prices');
  assert.deepEqual(p('homes in 80525 under 600k'), { postal_code: '80525', maxPrice: '600000' });
  assert.deepEqual(p('4 bed 3 bath 2500 sqft 500-650k'),
    { minPrice: '500000', maxPrice: '650000', beds: '4', baths: '3', minSqft: '2500' });
  assert.deepEqual(p('ranch with a 2-3 car garage and a walkout basement'), { basement: 'walkout', garage: '2', q: 'ranch' });
  assert.deepEqual(p('newer home on half an acre, built after 2015'), { minYear: '2015', minLotAcres: '0.5' });
  assert.equal(p('5 acres with a barn').type, undefined, 'acreage is not vacant land');
  assert.equal(p('land for sale in Wellington').type, 'land');

  assert.deepEqual(unsupportedAsks('quiet street near a good elementary, easy commute').map((u) => u.topic),
    ['schools', 'commute', 'neighborhood']);

  // The chat assistant's stricter gate still ignores small talk.
  assert.equal(parseSearchIntent('what is a walkout basement?'), null);
});

test('chips read like a person wrote them', async () => {
  const { chipsFor } = await import('../src/controllers/askSearchController.js');
  assert.deepEqual(
    chipsFor({ city: 'Windsor', minPrice: '450000', maxPrice: '1200000', beds: '3', garage: '3', maxHoa: '0' }).map((c) => c.label),
    ['Windsor', '$450K–$1.2M', '3+ beds', '3+ car garage', 'No HOA']
  );
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

test('a town page search stays in that town and counts real homes', { skip: !hasTestDatabase }, async () => {
  await insertListing(db.pool, { city: 'Windsor', beds: 3, list_price: 480000, garage_spaces: 3 });
  await insertListing(db.pool, { city: 'Windsor', beds: 4, list_price: 525000, garage_spaces: 2 });
  await insertListing(db.pool, { city: 'Windsor', beds: 2, list_price: 400000 });
  await insertListing(db.pool, { city: 'Windsor', beds: 3, list_price: 700000 });
  await insertListing(db.pool, { city: 'Greeley', beds: 3, list_price: 350000 });
  await insertListing(db.pool, { city: 'Windsor', beds: 5, list_price: 450000, status: 'Closed', is_active: false });

  const b = browser(server.url);
  let r = await b.post('/search/understand', { text: '3 beds under 550k near a good elementary', city: 'Windsor' });
  assert.equal(r.status, 200, r.text);
  const d = r.json.data;
  assert.deepEqual(d.filters, { city: 'Windsor', maxPrice: '550000', beds: '3' });
  assert.equal(d.count, 2);
  assert.equal(d.path, '/properties/?city=Windsor&maxPrice=550000&beds=3');
  assert.deepEqual(d.chips.map((c) => c.label), ['Windsor', 'Under $550K', '3+ beds']);
  assert.deepEqual(d.unsupported.map((u) => u.topic), ['schools']);

  r = await b.post('/search/understand', { text: '3 car garage in Greeley', city: 'Windsor' });
  assert.equal(r.json.data.filters.city, 'Greeley', 'a town the buyer names wins over the page');

  // Removing a chip re-counts.
  r = await b.post('/search/understand', { filters: { city: 'Windsor', beds: '3' } });
  assert.equal(r.json.data.count, 3);
  assert.deepEqual(r.json.data.unsupported, []);

  r = await b.post('/search/understand', { filters: { city: "Windsor'; DROP TABLE listings;--", beds: 'lots' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.data.filters, {}, 'junk never reaches the query');

  assert.equal((await b.post('/search/understand', {})).status, 400);
});

test('a signed-in buyer\'s words land on their timeline', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  assert.equal((await b.post('/alerts', { email: 'asker@comcast.net', city: 'Windsor' })).status, 201);
  assert.equal((await b.post('/search/understand', { text: 'walkout basement under 600k', city: 'Windsor' })).status, 200);
  const { rows } = await db.pool.query(
    "SELECT e.meta FROM events e JOIN users u ON u.id = e.user_id WHERE u.email = 'asker@comcast.net' AND e.type = 'search'"
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].meta.asked, 'walkout basement under 600k');
  assert.equal(rows[0].meta.via, 'ask');
});

test('a buyer\'s own words reach Follow Up Boss once a day as a Property Search', { skip: !hasTestDatabase }, async () => {
  const { pushAskedSearchToFollowUpBoss } = await import('../src/services/followUpBossService.js');
  const { recordEvent } = await import('../src/services/events.js');
  const { rows: [u] } = await db.pool.query(
    "INSERT INTO users (email, name, phone, status, manage_token) VALUES ('words@comcast.net', 'Robin Words', '9705550199', 'active', md5(random()::text) || md5(random()::text)) RETURNING id"
  );
  const posted = [];
  const post = async (body) => posted.push(body);
  const meta = { asked: 'Ranch with a walkout under 600k', filters: { city: 'Windsor', basement: 'walkout', maxPrice: '600000' }, via: 'ask' };

  const first = await recordEvent({ type: 'search', userId: u.id, meta }, db.pool);
  assert.deepEqual(await pushAskedSearchToFollowUpBoss(first, { pool: db.pool, post }), { sent: 1 });
  assert.equal(posted[0].type, 'Property Search');
  assert.match(posted[0].message, /their own words: “Ranch with a walkout under 600k”/);
  assert.match(posted[0].message, /saahomes\.com\/properties\/\?city=Windsor&maxPrice=600000&basement=walkout/);
  assert.equal(posted[0].propertySearch.maxPrice, 600000);
  assert.equal(posted[0].person.emails[0].value, 'words@comcast.net');

  const again = await recordEvent({ type: 'search', userId: u.id, meta: { ...meta, asked: 'ranch with a walkout UNDER 600k' } }, db.pool);
  assert.equal((await pushAskedSearchToFollowUpBoss(again, { pool: db.pool, post })).reason, 'duplicate');
  assert.equal(posted.length, 1);

  // Signup history never re-sends what already went live.
  const { syncVisitorHistoryToFollowUpBoss } = await import('../src/services/followUpBossService.js');
  await syncVisitorHistoryToFollowUpBoss(u.id, { pool: db.pool, post });
  assert.equal(posted.length, 1);
});
