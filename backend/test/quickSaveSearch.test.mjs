import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';

// The save-search modal asks for an email only, then offers name, phone and
// cadence on a second step. One database and server per file.
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

test('an email and the filters are enough to save a search', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  const saved = await b.post('/alerts', { email: 'riley.quick@comcast.net', city: 'Loveland', beds: '3' });
  assert.equal(saved.status, 201, saved.text);
  assert.ok(saved.json.data.id);
  assert.equal(saved.json.data.name, 'My Search');
  assert.ok(b.jar.get('saa_user_token'), 'the save did not sign the visitor in');

  const user = (await db.pool.query("SELECT name, phone FROM users WHERE email = 'riley.quick@comcast.net'")).rows[0];
  assert.equal(user.name, null);
  assert.equal(user.phone, null);
  const search = (await db.pool.query('SELECT frequency, send_time, send_day FROM saved_searches WHERE id = $1', [saved.json.data.id])).rows[0];
  assert.deepEqual(search, { frequency: 'daily', send_time: '06:00', send_day: 'Monday' });
});

test('the follow-up step adds name, phone, texting and cadence to that save', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  const saved = await b.post('/alerts', { email: 'morgan.quick@comcast.net', city: 'Windsor' });
  assert.equal(saved.status, 201, saved.text);

  const me = await b.patch('/alerts/me', { contact_name: 'Morgan Lee', phone: '(970) 555-0144', sms_opt_in: true });
  assert.equal(me.status, 200, me.text);
  assert.deepEqual(me.json.data, { name: 'Morgan Lee', phone: '9705550144', sms_opt_in: true });

  const user = (await db.pool.query("SELECT id, name, phone FROM users WHERE email = 'morgan.quick@comcast.net'")).rows[0];
  assert.equal(user.name, 'Morgan Lee');
  assert.equal(user.phone, '9705550144');
  const consents = await db.pool.query('SELECT channel, status FROM contact_consents WHERE user_id = $1 ORDER BY channel', [user.id]);
  assert.deepEqual(consents.rows, [{ channel: 'email', status: 'granted' }, { channel: 'sms', status: 'granted' }]);

  const cadence = await b.patch(`/alerts/${saved.json.data.id}`, { frequency: 'weekly' });
  assert.equal(cadence.status, 200, cadence.text);
  assert.equal(cadence.json.data.frequency, 'weekly');
});

test('the follow-up step refuses bad phones and strangers', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  assert.equal((await b.post('/alerts', { email: 'sky.quick@comcast.net', city: 'Greeley' })).status, 201);

  const bad = await b.patch('/alerts/me', { phone: '12' });
  assert.equal(bad.status, 400);
  const textsNeedPhone = await b.patch('/alerts/me', { sms_opt_in: true });
  assert.equal(textsNeedPhone.status, 400);
  const nothing = await b.patch('/alerts/me', {});
  assert.equal(nothing.status, 400);

  const stranger = browser(server.url);
  const r = await stranger.patch('/alerts/me', { contact_name: 'Someone Else', phone: '9705550100' });
  assert.equal(r.status, 401);
  const user = (await db.pool.query("SELECT name, phone FROM users WHERE email = 'sky.quick@comcast.net'")).rows[0];
  assert.deepEqual(user, { name: null, phone: null });
});
