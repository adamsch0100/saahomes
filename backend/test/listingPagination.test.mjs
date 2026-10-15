import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { browser } from './helpers/browser.mjs';
import { insertListing } from './helpers/fixtures.mjs';

let db;
let server;
test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
  for (let n = 0; n < 5; n += 1) await insertListing(db.pool, { postal_code: '80521' });
});
test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

test('page size is clamped to a sane range', { skip: !hasTestDatabase }, async () => {
  const b = browser(server.url);
  const huge = await b.get('/listings?limit=100000');
  assert.equal(huge.status, 200, huge.text);
  assert.equal(huge.json.meta.limit, 100);

  const junk = await b.get('/listings?limit=abc&page=-3');
  assert.equal(junk.status, 200, junk.text);
  assert.equal(junk.json.meta.limit, 24);
  assert.equal(junk.json.meta.page, 1);

  const two = await b.get('/listings?limit=2.9&page=2');
  assert.equal(two.status, 200, two.text);
  assert.equal(two.json.meta.limit, 2);
  assert.equal(two.json.meta.page, 2);
  assert.equal(two.json.data.length, 2);
  assert.equal(two.json.meta.pages, 3);
});
