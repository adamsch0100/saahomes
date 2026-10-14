import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

const NOON = new Date('2026-10-12T18:00:00Z');

test('homes are toured in the shortest driving order', async () => {
  const { planRoute, MINUTES_PER_SHOWING } = await import('../src/services/tourPlanner.js');
  const plan = planRoute([
    { listing_key: 'A', address: 'A', lat: 40.40, lng: -104.9 },
    { listing_key: 'C', address: 'C', lat: 40.60, lng: -104.9 },
    { listing_key: 'X', address: 'No map pin', lat: NaN, lng: NaN },
    { listing_key: 'B', address: 'B', lat: 40.45, lng: -104.9 },
  ]);
  const order = plan.stops.map((s) => s.listing_key);
  assert.equal(order[1], 'B');
  assert.ok(['A,B,C,X', 'C,B,A,X'].includes(order.join(',')), order.join(','));
  assert.equal(plan.stops[0].leg, null);
  assert.equal(plan.stops[3].leg, null);
  assert.ok(plan.stops[2].leg.minutes > plan.stops[1].leg.minutes);
  assert.equal(plan.total_minutes, plan.drive_minutes + 4 * MINUTES_PER_SHOWING);
});

test('tour times must be real, upcoming and few', async () => {
  const { cleanWindows, denverToday } = await import('../src/controllers/tourController.js');
  assert.equal(denverToday(new Date('2026-10-13T03:00:00Z')), '2026-10-12', 'still the 12th in Denver');
  assert.deepEqual(cleanWindows([{ date: '2026-10-17', part: 'morning' }, { date: '2026-10-17', part: 'morning' }], NOON),
    [{ date: '2026-10-17', part: 'morning' }]);
  assert.equal(cleanWindows([{ date: '2026-10-11', part: 'morning' }], NOON), null);
  assert.equal(cleanWindows([{ date: '2027-02-01', part: 'morning' }], NOON), null);
  assert.equal(cleanWindows([{ date: '2026-10-17', part: 'midnight' }], NOON), null);
  assert.equal(cleanWindows([1, 2, 3, 4].map((d) => ({ date: `2026-10-1${d + 3}`, part: 'evening' })), NOON), null);
  assert.equal(cleanWindows([], NOON), null);
});

test('the calendar file is a tentative hold in Mountain time', async () => {
  const { tourCalendar, planRoute } = await import('../src/services/tourPlanner.js');
  const plan = planRoute([{ listing_key: 'A', address: '1 Elm St, Windsor', lat: 40.4, lng: -104.9, list_price: 500000 }]);
  const ics = tourCalendar({ id: 7, plan, window: { date: '2026-10-17', part: 'afternoon' }, now: NOON });
  assert.match(ics, /DTSTART;TZID=America\/Denver:20261017T120000\r\n/);
  assert.match(ics, /DTEND;TZID=America\/Denver:20261017T160000\r\n/);
  assert.match(ics, /STATUS:TENTATIVE/);
  assert.match(ics, /LOCATION:1 Elm St\\, Windsor/);
  assert.match(ics, /Requested\\, not confirmed yet/);
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

const soon = (days) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' })
  .format(new Date(Date.now() + days * 86400000));

test('a tour becomes one showing request with the route, and a calendar hold', { skip: !hasTestDatabase }, async () => {
  const homes = [];
  for (const lat of [40.48, 40.52, 40.50]) homes.push(await insertListing(db.pool, { city: 'Windsor', latitude: lat, longitude: -104.9 }));
  const keys = homes.map((h) => h.listing_id);
  assert.equal((await browser(server.url).post('/tours/plan', { listing_keys: keys })).status, 401);

  const b = browser(server.url);
  assert.equal((await b.post('/alerts', { email: 'tourer@comcast.net', contact_name: 'Taylor Tourer', city: 'Windsor' })).status, 201);
  const { rows: [me] } = await db.pool.query("SELECT * FROM users WHERE email = 'tourer@comcast.net'");

  const preview = await b.post('/tours/plan', { listing_keys: keys });
  assert.equal(preview.status, 200, preview.text);
  assert.equal(preview.json.data.stops[1].listing_key, homes[2].listing_id, 'the middle home is visited in the middle');
  assert.equal(preview.json.data.stops[0].lat, undefined, 'coordinates stay server-side');

  const windows = [{ date: soon(5), part: 'afternoon' }, { date: soon(6), part: 'morning' }];
  let r = await b.post('/tours', { listing_keys: keys, windows });
  assert.equal(r.status, 400, 'a phone is needed to confirm');
  r = await b.post('/tours', { listing_keys: keys, windows, phone: '(970) 555-0123', note: 'Kids in tow' });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.data.plan.stops.length, 3);

  const { rows: [showing] } = await db.pool.query('SELECT * FROM showing_requests ORDER BY id DESC LIMIT 1');
  assert.equal(showing.email, 'tourer@comcast.net');
  assert.equal(showing.showing_time, 'afternoon');
  assert.match(showing.listing_address, /^Tour of 3 homes: /);
  assert.match(showing.message, /in driving order:\n1\. .*\n2\. .*\n3\. /);
  assert.match(showing.message, /Note from the buyer: Kids in tow/);
  assert.equal((await db.pool.query('SELECT phone FROM users WHERE id = $1', [me.id])).rows[0].phone, '9705550123');

  const cal = await b.get(r.json.data.calendar_url.replace('/api', ''));
  assert.equal(cal.status, 200);
  assert.match(cal.text, /BEGIN:VCALENDAR/);
  assert.match(cal.text, /SUMMARY:Home tour\\, 3 homes \(requested\)/);

  const stranger = browser(server.url);
  assert.equal((await stranger.post('/alerts', { email: 'nosy@comcast.net', city: 'Windsor' })).status, 201);
  assert.equal((await stranger.get(r.json.data.calendar_url.replace('/api', ''))).status, 404);
});

test('co-buyers hear about the tour request', { skip: !hasTestDatabase }, async () => {
  const { rows: [hh] } = await db.pool.query("INSERT INTO households (name) VALUES ('Test') RETURNING id");
  await db.pool.query(
    "UPDATE users SET household_id = $1 WHERE email IN ('tourer@comcast.net', 'nosy@comcast.net')", [hh.id]
  );
  const b = browser(server.url);
  // Sign in as the tourer again via a fresh session (existing account → own cookie needed).
  const { rows: [me] } = await db.pool.query("SELECT manage_token FROM users WHERE email = 'tourer@comcast.net'");
  b.jar.set('saa_user_token', me.manage_token);
  const home = await insertListing(db.pool, { city: 'Windsor' });
  const r = await b.post('/tours', { listing_keys: [home.listing_id], windows: [{ date: soon(3), part: 'evening' }] });
  assert.equal(r.status, 201, r.text);
  const n = await db.pool.query(
    "SELECT n.title FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = 'nosy@comcast.net' AND n.type = 'board'"
  );
  assert.deepEqual(n.rows.map((x) => x.title), ['Taylor asked for a tour of 1 home']);
});
