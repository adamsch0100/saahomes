import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

const NOON_MT = new Date('2026-10-10T18:00:00Z');
const NIGHT_MT = new Date('2026-10-11T05:00:00Z'); // 11pm Mountain

const fakeSub = (n) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/test-device-${n}`,
  keys: { p256dh: `BPtest${n}${'x'.repeat(60)}`, auth: `auth${n}xxxxxxxxxxxx` },
});

test('only real browser push services are accepted as endpoints', async () => {
  const { isPushEndpoint } = await import('../src/services/pushService.js');
  assert.equal(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(isPushEndpoint('https://web.push.apple.com/QABC'), true);
  assert.equal(isPushEndpoint('https://wns2-by3p.notify.windows.com/w/?token=1'), true);
  assert.equal(isPushEndpoint('http://fcm.googleapis.com/fcm/send/abc'), false);
  assert.equal(isPushEndpoint('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(isPushEndpoint('https://fcm.googleapis.com.evil.example/x'), false);
  assert.equal(isPushEndpoint('https://fcm.googleapis.com:8443/x'), false);
});

test('several updates bundle into one push', async () => {
  const { bundlePayload } = await import('../src/services/pushService.js');
  const p = bundlePayload([
    { id: 1, type: 'new_match', title: 'New match: 1 A St, Windsor', link: '/homes-for-sale/a/' },
    { id: 2, type: 'new_match', title: 'New match: 2 B St, Windsor', link: '/homes-for-sale/b/' },
    { id: 3, type: 'price_drop', title: 'Price drop: 3 C St, Windsor', link: '/homes-for-sale/c/', image_url: '/api/photo/3/0' },
  ]);
  assert.equal(p.title, '2 new matches, 1 price drop');
  assert.equal(p.url, 'https://saahomes.com/notifications/?src=push');
  assert.equal(p.image, 'https://saahomes.com/api/photo/3/0');
});

let db;
let server;
let push;
test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
  push = await import('../src/services/pushService.js');
});
test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

async function signedInClient(email, filters) {
  const b = browser(server.url);
  const r = await b.post('/alerts', { email, ...filters });
  assert.equal(r.status, 201, r.text);
  const { rows } = await db.pool.query('SELECT id FROM users WHERE email = $1', [email]);
  return { b, userId: rows[0].id };
}

test('the VAPID key is generated once and kept', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  const one = await b.get('/push/key');
  const two = await b.get('/push/key');
  assert.equal(one.json.enabled, true);
  assert.ok(one.json.publicKey.length > 60);
  assert.equal(one.json.publicKey, two.json.publicKey);
  const { rows } = await db.pool.query("SELECT value FROM app_settings WHERE key = 'vapid_keys'");
  assert.equal(rows[0].value.publicKey, one.json.publicKey);
});

test('turning on push needs a session and a real subscription, and logs consent', { skip: !hasTestDatabase }, async () => {
  const anon = browser(server.url);
  assert.equal((await anon.post('/push/subscribe', { subscription: fakeSub(0) })).status, 401);

  const { b, userId } = await signedInClient('pusher@comcast.net', { city: 'Severance' });
  assert.equal((await b.post('/push/subscribe', { subscription: { endpoint: 'https://example.com/x', keys: { p256dh: 'a', auth: 'b' } } })).status, 400);
  assert.equal((await b.post('/push/subscribe', { subscription: fakeSub(1) })).status, 201);
  assert.equal((await b.get('/push/status')).json.devices, 1);
  const c = await db.pool.query(
    "SELECT status, wording FROM contact_consents WHERE user_id = $1 AND channel = 'push' ORDER BY id", [userId]
  );
  assert.deepEqual(c.rows.map((r) => r.status), ['granted']);
  assert.equal(c.rows[0].wording, push.PUSH_CONSENT_WORDING);

  assert.equal((await b.post('/push/unsubscribe', { endpoint: fakeSub(1).endpoint })).status, 200);
  assert.equal((await b.get('/push/status')).json.devices, 0);
  const c2 = await db.pool.query(
    "SELECT status FROM contact_consents WHERE user_id = $1 AND channel = 'push' ORDER BY id", [userId]
  );
  assert.deepEqual(c2.rows.map((r) => r.status), ['granted', 'revoked']);
});

test('a new listing reaches the phone once, never overnight', { skip: !hasTestDatabase }, async () => {
  const { b, userId } = await signedInClient('instant@comcast.net', { city: 'Eaton' });
  await b.post('/push/subscribe', { subscription: fakeSub(2) });
  const sent = [];
  const send = async (sub, payload) => { sent.push({ sub, payload }); };

  // First pass only starts the watch.
  let r = await push.runPushPass({ now: NOON_MT, send });
  assert.equal(r.pushed, 0);

  const home = await insertListing(db.pool, { city: 'Eaton', days_on_market: 0, list_price: 425000 });
  // Overnight: queued in the notification center, but no push yet.
  r = await push.runPushPass({ now: NIGHT_MT, send });
  assert.equal(r.quiet, true);
  assert.equal(sent.length, 0);
  const n = await db.pool.query("SELECT pushed_at FROM notifications WHERE user_id = $1 AND type = 'new_match'", [userId]);
  assert.equal(n.rows.length, 1);
  assert.equal(n.rows[0].pushed_at, null);

  // Morning: it goes out, once.
  r = await push.runPushPass({ now: NOON_MT, send });
  assert.equal(r.pushed, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sub.endpoint, fakeSub(2).endpoint);
  assert.match(sent[0].payload.title, new RegExp(`New match: ${home.street_number} Test St, Eaton`));
  assert.match(sent[0].payload.url, new RegExp(`/homes-for-sale/${home.slug}/\\?src=push$`));
  r = await push.runPushPass({ now: NOON_MT, send });
  assert.equal(sent.length, 1);
});

test('pushes stop at the daily cap, and dead devices are dropped', { skip: !hasTestDatabase }, async () => {
  const { b, userId } = await signedInClient('capped@comcast.net', { city: 'Mead' });
  await b.post('/push/subscribe', { subscription: fakeSub(3) });
  for (let i = 0; i < push.DAILY_PUSH_CAP; i += 1) {
    await db.pool.query('INSERT INTO push_log (user_id, delivered) VALUES ($1, 1)', [userId]);
  }
  await db.pool.query(
    "INSERT INTO notifications (user_id, type, title, link) VALUES ($1, 'price_drop', 'Price drop: 9 Z St', '/homes-for-sale/z/')",
    [userId]
  );
  const sent = [];
  let r = await push.runPushPass({ now: NOON_MT, send: async (s, p) => sent.push(p), scanSavedHomes: false });
  assert.equal(sent.length, 0);
  assert.equal(r.capped, 1);

  await db.pool.query('DELETE FROM push_log WHERE user_id = $1', [userId]);
  await db.pool.query(
    "INSERT INTO notifications (user_id, type, title, link) VALUES ($1, 'price_drop', 'Price drop: 8 Y St', '/homes-for-sale/y/')",
    [userId]
  );
  const gone = Object.assign(new Error('Gone'), { statusCode: 410 });
  r = await push.runPushPass({ now: NOON_MT, send: async () => { throw gone; }, scanSavedHomes: false });
  assert.equal(r.disabled, 1);
  assert.equal((await b.get('/push/status')).json.devices, 0);
});
