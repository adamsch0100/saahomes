/**
 * Browsing must never use up the budget for signing up. Every tracking call
 * (listing views, hearts, notification reads) used to share one 5-per-15-
 * minute limiter with the lead forms, so a visitor who opened five homes got
 * "Too many submissions" when they tried to save a search.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

test('viewing homes does not block saving a search', { skip: !hasTestDatabase }, async (t) => {
  const db = await createTestDatabase();
  t.after(db.drop);
  const server = await startTestServer();
  t.after(server.close);

  const post = (path, body) => fetch(`${server.url}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  for (let n = 0; n < 12; n += 1) {
    const r = await post('/alerts/view', { listing_id: `IR10${n}` });
    assert.notEqual(r.status, 429, `view ${n + 1} was rate limited`);
  }
  for (let n = 0; n < 6; n += 1) {
    const r = await post('/events', { type: 'search', params: `city=Loveland&beds=${n}` });
    assert.notEqual(r.status, 429, `search event ${n + 1} was rate limited`);
  }

  const save = await post('/alerts', {
    email: 'sam.shopper@comcast.net',
    phone: '9705550101',
    name: 'Loveland 3 bed',
    city: 'Loveland',
    beds: '3',
  });
  assert.equal(save.status, 201, await save.text());
});
