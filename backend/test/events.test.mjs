import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';

// One database and server per file: the app's pool is a process-wide singleton.
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

test('anonymous browsing joins the contact at signup', { skip: !hasTestDatabase }, async () => {

  const b = browser(server.url);
  assert.equal((await b.post('/alerts/view', { listing_id: 'IR1001' })).status, 200);
  assert.ok(b.jar.get('saa_vid'), 'visitor cookie was not set');
  await b.post('/alerts/view', { listing_id: 'IR1001' }); // repeat within 30 min: one event
  await b.post('/alerts/view', { listing_id: 'IR1002' });
  assert.equal((await b.post('/events', { type: 'search', params: 'city=Windsor&beds=3', total: 41 })).status, 200);

  const vid = b.jar.get('saa_vid');
  let anon = await db.pool.query('SELECT type, listing_id FROM events WHERE visitor_id = $1 AND user_id IS NULL ORDER BY id', [vid]);
  assert.deepEqual(anon.rows.map((r) => r.type), ['listing_view', 'listing_view', 'search']);

  const saved = await b.post('/alerts', {
    email: 'casey.buyer@comcast.net', phone: '9705550199', name: 'Windsor 3 bed', city: 'Windsor', beds: '3',
  });
  assert.equal(saved.status, 201, saved.text);

  const user = (await db.pool.query("SELECT id, tenant_id FROM users WHERE email = 'casey.buyer@comcast.net'")).rows[0];
  assert.equal(user.tenant_id, 1);
  anon = await db.pool.query('SELECT count(*)::int AS n FROM events WHERE visitor_id = $1 AND user_id IS NULL', [vid]);
  assert.equal(anon.rows[0].n, 0, 'anonymous events were not stitched');

  const timeline = await db.pool.query('SELECT type FROM events WHERE user_id = $1 ORDER BY id', [user.id]);
  assert.deepEqual(timeline.rows.map((r) => r.type), [
    'listing_view', 'listing_view', 'search', 'search_saved', 'consent_changed', 'signup',
  ]);

  const consent = await db.pool.query('SELECT channel, status, wording FROM contact_consents WHERE user_id = $1', [user.id]);
  assert.equal(consent.rows.length, 1);
  assert.equal(consent.rows[0].channel, 'email');
  assert.equal(consent.rows[0].status, 'granted');
  assert.match(consent.rows[0].wording, /Email me new listings/);
});

test('typing someone else\'s email never attaches your browsing to them', { skip: !hasTestDatabase }, async () => {

  const owner = browser(server.url);
  assert.equal((await owner.post('/alerts', {
    email: 'jordan.owner@comcast.net', phone: '9705550111', name: 'Greeley', city: 'Greeley',
  })).status, 201);

  const stranger = browser(server.url);
  await stranger.post('/alerts/view', { listing_id: 'IR2001' });
  const r = await stranger.post('/alerts', {
    email: 'jordan.owner@comcast.net', phone: '9705550111', name: 'Evans', city: 'Evans',
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.signInRequired, true);

  const orphan = await db.pool.query("SELECT count(*)::int AS n FROM events WHERE user_id IS NULL AND listing_id = 'IR2001'");
  assert.equal(orphan.rows[0].n, 1, 'stranger browsing was attached to the account');
  const consents = await db.pool.query(
    "SELECT count(*)::int AS n FROM contact_consents c JOIN users u ON u.id = c.user_id WHERE u.email = 'jordan.owner@comcast.net'"
  );
  assert.equal(consents.rows[0].n, 1, 'stranger request recorded consent for the owner');
});

test('the events endpoint only accepts browser-safe types', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  assert.equal((await b.post('/events', { type: 'signup' })).status, 400);
  assert.equal((await b.post('/events', { type: 'search' })).status, 400);
  assert.equal((await b.post('/events', { type: 'page_view', path: '/properties/' })).status, 200);
});
