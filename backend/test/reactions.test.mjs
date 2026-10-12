import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

const home = (o) => ({ list_price: 500000, beds: 4, living_area: 2400, city: 'Windsor', home_type: 'detached',
  year_built: 2018, garage_spaces: 3, lot_size_acres: 0.2, ...o });

test('a few views are not enough to claim we know someone', async () => {
  const { profileFromSignals, scoreListing } = await import('../src/services/tasteProfile.js');
  const p = profileFromSignals([{ ...home(), views: 1 }]);
  assert.equal(p.ready, false);
  assert.equal(scoreListing(home(), p), null);
});

test('saved homes explain a match in plain terms', async () => {
  const { profileFromSignals, scoreListing } = await import('../src/services/tasteProfile.js');
  const p = profileFromSignals([
    { ...home({ list_price: 480000 }), saved: true, views: 2 },
    { ...home({ list_price: 520000 }), reaction: 'love', saved: true },
    { ...home({ list_price: 505000, beds: 3 }), saved: true },
    { ...home({ city: 'Greeley', list_price: 300000 }), reaction: 'pass' },
  ]);
  assert.equal(p.ready, true);
  assert.equal(p.basis, 'saved');
  assert.equal(p.counts.passed, 1);

  const fit = scoreListing(home({ list_price: 510000, garage_spaces: 3 }), p);
  assert.ok(fit.score >= 90, `score ${fit.score}`);
  assert.deepEqual(fit.reasons, [
    "In Windsor, where you've saved 3 homes",
    'In your price range ($442K–$562K)',
    "3-car garage, like most homes you've saved",
  ]);

  const miss = scoreListing(home({ city: 'Greeley', list_price: 900000, beds: 2, living_area: 1100, garage_spaces: 1, year_built: 1975 }), p);
  assert.ok(miss.score < 30, `score ${miss.score}`);
  assert.deepEqual(miss.reasons, []);
});

test('a profile built only from views says so', async () => {
  const { profileFromSignals, scoreListing } = await import('../src/services/tasteProfile.js');
  const p = profileFromSignals([1, 2, 3, 4].map((n) => ({ ...home({ beds: 3 }), listing_key: `V${n}`, views: 2 })));
  assert.equal(p.basis, 'viewed');
  assert.ok(scoreListing(home({ beds: 3 }), p).reasons.some((r) => r.includes("you've looked at")));
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

async function signedIn(email) {
  const b = browser(server.url);
  const r = await b.post('/alerts', { email, city: 'Windsor' });
  assert.equal(r.status, 201, r.text);
  const { rows } = await db.pool.query('SELECT id FROM users WHERE email = $1', [email]);
  return { b, userId: rows[0].id };
}

const savedKeys = async (userId) =>
  (await db.pool.query('SELECT listing_key FROM saved_homes WHERE user_id = $1 ORDER BY listing_key', [userId]))
    .rows.map((r) => r.listing_key);

test('reactions need a session and a real reaction', { skip: !hasTestDatabase }, async () => {
  const l = await insertListing(db.pool, home());
  assert.equal((await browser(server.url).put(`/reactions/${l.listing_id}`, { reaction: 'love' })).status, 401);
  const { b } = await signedIn('reactor@comcast.net');
  assert.equal((await b.put(`/reactions/${l.listing_id}`, { reaction: 'adore' })).status, 400);
  assert.equal((await b.put('/reactions/NOPE999', { reaction: 'love' })).status, 404);
});

test('Love saves, Not for me unsaves and hides, and the heart stays in step', { skip: !hasTestDatabase }, async () => {
  const { b, userId } = await signedIn('lovebuyer@comcast.net');
  const a = await insertListing(db.pool, home({ city: 'Eaton' }));
  const c = await insertListing(db.pool, home({ city: 'Eaton' }));

  let r = await b.put(`/reactions/${a.slug}`, { reaction: 'love', note: 'Great kitchen' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.listing_key, a.listing_id);
  assert.equal(r.json.data.saved, true);
  assert.deepEqual(await savedKeys(userId), [a.listing_id]);

  // A note-only edit keeps the reaction.
  r = await b.put(`/reactions/${a.listing_id}`, { reaction: 'love', note: '  Great kitchen, small yard ' });
  assert.equal(r.json.data.note, 'Great kitchen, small yard');

  // Not for me: off the saved list and out of search results.
  r = await b.put(`/reactions/${c.listing_id}`, { reaction: 'maybe' });
  assert.deepEqual(await savedKeys(userId), [a.listing_id, c.listing_id].sort());
  r = await b.put(`/reactions/${c.listing_id}`, { reaction: 'pass' });
  assert.equal(r.json.data.saved, false);
  assert.deepEqual(await savedKeys(userId), [a.listing_id]);

  let s = await b.get('/listings?city=Eaton');
  assert.deepEqual(s.json.data.map((x) => x.listing_id), [a.listing_id]);
  assert.equal(s.json.meta.taste.hidden, 1);
  s = await b.get('/listings?city=Eaton&show_hidden=1');
  assert.equal(s.json.data.length, 2);
  // Someone else still sees it.
  s = await browser(server.url).get('/listings?city=Eaton');
  assert.equal(s.json.data.length, 2);
  assert.equal(s.json.meta.taste, null);

  // Hearting a hidden home brings it back.
  assert.equal((await b.post('/saved-homes', { listing_key: c.listing_id })).status, 201);
  assert.equal((await b.get(`/reactions/${c.listing_id}`)).json.data.reaction, null);
  assert.equal((await b.get('/listings?city=Eaton')).json.data.length, 2);

  // Un-hearting a Love takes the Love back but keeps the note.
  assert.equal((await b.del(`/saved-homes/${a.listing_id}`)).status, 200);
  const one = (await b.get(`/reactions/${a.listing_id}`)).json.data;
  assert.equal(one.reaction, null);
  assert.equal(one.note, 'Great kitchen, small yard');
  assert.equal(one.saved, false);

  const list = (await b.get('/reactions')).json.data.homes;
  assert.deepEqual(list.map((h) => h.listing_key).sort(), [a.listing_id].sort());

  const ev = await db.pool.query(
    "SELECT meta->>'reaction' AS reaction FROM events WHERE user_id = $1 AND type = 'home_reaction' ORDER BY id",
    [userId]
  );
  assert.deepEqual(ev.rows.map((e) => e.reaction), ['love', 'maybe', 'pass']);
});

test('"Best for you" ranks by taste and says why', { skip: !hasTestDatabase }, async () => {
  const { b } = await signedIn('tastebuyer@comcast.net');
  const loved = [];
  for (const price of [480000, 500000, 520000]) {
    loved.push(await insertListing(db.pool, home({ city: 'Severance', list_price: price })));
  }
  for (const l of loved) await b.put(`/reactions/${l.listing_id}`, { reaction: 'love' });
  const far = await insertListing(db.pool, home({ city: 'Severance', list_price: 1400000, beds: 6, living_area: 5200, garage_spaces: 2 }));
  const close = await insertListing(db.pool, home({ city: 'Severance', list_price: 505000 }));
  // The far one is the freshest, so plain "recommended" would put it first.
  await db.pool.query("UPDATE listings SET updated_at = NOW() + INTERVAL '1 hour' WHERE id = $1", [far.id]);

  const taste = (await b.get('/taste')).json.data;
  assert.equal(taste.ready, true);
  assert.deepEqual(taste.cities, ['Severance']);

  const s = await b.get('/listings?city=Severance&sort=best&show_hidden=1');
  assert.equal(s.json.meta.sort, 'best');
  const ids = s.json.data.map((x) => x.listing_id);
  assert.ok(ids.indexOf(close.listing_id) < ids.indexOf(far.listing_id));
  assert.equal(ids.at(-1), far.listing_id);
  const top = s.json.data.find((x) => x.listing_id === close.listing_id);
  assert.ok(top.match.reasons.includes("In Severance, where you've saved 3 homes"), top.match.reasons.join(' | '));

  const why = (await b.get(`/reactions/${close.slug}`)).json.data;
  assert.equal(why.taste_ready, true);
  assert.ok(why.match.score >= 80);

  // Without a profile, "best" quietly falls back.
  const anon = await browser(server.url).get('/listings?city=Severance&sort=best');
  assert.equal(anon.json.meta.sort, 'recommended');
  assert.ok(anon.json.data.every((x) => x.match === undefined));
});

test('Not for me keeps a home out of alert emails', { skip: !hasTestDatabase }, async () => {
  const digest = await import('../src/services/alertDigest.js');
  const { b, userId } = await signedIn('alertpass@comcast.net');
  const keep = await insertListing(db.pool, home({ city: 'Ault', days_on_market: 1 }));
  const nope = await insertListing(db.pool, home({ city: 'Ault', days_on_market: 1 }));
  await b.put(`/reactions/${nope.listing_id}`, { reaction: 'pass' });
  const { rows: [search] } = await db.pool.query(
    `INSERT INTO saved_searches (user_id, name, filters) VALUES ($1, 'Ault', '{"city":"Ault"}') RETURNING *`,
    [userId]
  );
  const sent = [];
  const r = await digest.runSearch(search, { send: async (to, subject, html) => sent.push(html) });
  assert.deepEqual(r.counts, { new: 1, drops: 0, joined: 0, offMarket: 0 });
  assert.match(sent[0], new RegExp(`${keep.street_number} Test St`));
  assert.doesNotMatch(sent[0], new RegExp(`${nope.street_number} Test St`));
});
