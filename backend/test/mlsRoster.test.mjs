/**
 * "Listing courtesy of": IRES gives the office's MLS id but not its name, so
 * the name comes from the MLS's office roster and lands on every listing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

const skip = !hasTestDatabase;
let db;

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
});
test.after(async () => {
  if (skip) return;
  await db?.drop();
});

test('the roster names listings by office and agent MLS id, page by page', { skip }, async () => {
  process.env.IRES_API_URL = 'https://mls.example/v2';
  process.env.IRES_ACCESS_TOKEN = 'test-token';
  const home = await insertListing(db.pool, { city: 'Loveland' });
  await db.pool.query(
    "UPDATE listings SET list_office_mls_id = 'OF1', list_agent_mls_id = 'AG1', list_office_name = NULL WHERE listing_id = $1",
    [home.listing_id]
  );

  const calls = [];
  const page = (value, next) => new Response(JSON.stringify({ value, ...(next ? { '@odata.nextLink': next } : {}) }), { status: 200 });
  const fakeFetch = async (url, init) => {
    calls.push({ url: String(url), auth: init.headers.Authorization });
    const u = String(url);
    if (u.startsWith('https://mls.example/v2/Office') && !u.includes('page2')) {
      return page([{ OfficeMlsId: 'OF0', OfficeName: 'Hidden Office', MlgCanView: false, ModificationTimestamp: '2026-10-01T00:00:00Z' }], 'https://mls.example/v2/Office?page2');
    }
    if (u.includes('Office?page2')) return page([{ OfficeMlsId: 'OF1', OfficeName: 'Front Range Realty', MlgCanView: true, ModificationTimestamp: '2026-10-02T00:00:00Z' }]);
    if (u.startsWith('https://mls.example/v2/Member')) return page([{ MemberMlsId: 'AG1', MemberFullName: 'Jordan Lee', MlgCanView: true, ModificationTimestamp: '2026-10-02T00:00:00Z' }]);
    return new Response('nope', { status: 404 });
  };

  const { refreshMlsRoster } = await import('../src/services/mlsRoster.js');
  const r = await refreshMlsRoster({ pool: db.pool, fetchImpl: fakeFetch });
  assert.equal(r.office.saved, 2);
  assert.equal(r.member.saved, 1);
  assert.ok(calls.every((c) => c.auth === 'Bearer test-token'));
  assert.match(decodeURIComponent(calls[0].url), /\$select=OfficeMlsId,OfficeName,ModificationTimestamp,MlgCanView/);

  const { rows: [l] } = await db.pool.query('SELECT list_office_name, list_agent_name FROM listings WHERE listing_id = $1', [home.listing_id]);
  assert.equal(l.list_office_name, 'Front Range Realty');
  assert.equal(l.list_agent_name, 'Jordan Lee');
  const { rows: [hidden] } = await db.pool.query("SELECT name FROM mls_offices WHERE office_mls_id = 'OF0'");
  assert.equal(hidden.name, null, 'a record the MLS withdrew keeps no name');

  // The next refresh only asks for what changed since the newest row.
  calls.length = 0;
  await refreshMlsRoster({ pool: db.pool, fetchImpl: fakeFetch });
  assert.match(decodeURIComponent(calls[0].url), /ModificationTimestamp[+ ]gt[+ ]2026-10-02T00:00:00.000Z/);
});

test('a first pull cut short starts over instead of skipping what it missed', { skip }, async () => {
  const { refreshMlsRoster, rosterNeedsFill } = await import('../src/services/mlsRoster.js');
  await db.pool.query("DELETE FROM mls_roster_fills; DELETE FROM mls_offices; DELETE FROM mls_members");
  assert.equal(await rosterNeedsFill({ pool: db.pool }), true);
  // A restart killed the first pull after one late page of offices.
  await db.pool.query("INSERT INTO mls_offices (feed, office_mls_id, name, modified_at) VALUES ('ires', 'LATE', 'Late Office', '2026-10-09T00:00:00Z')");

  const urls = [];
  const fakeFetch = async (url) => {
    urls.push(decodeURIComponent(String(url)));
    const value = String(url).includes('/Office')
      ? [{ OfficeMlsId: 'EARLY', OfficeName: 'Early Office', ModificationTimestamp: '2020-01-01T00:00:00Z' },
        { OfficeMlsId: 'EARLY', OfficeName: 'Early Office', ModificationTimestamp: '2020-01-01T00:00:00Z' }]
      : [];
    return new Response(JSON.stringify({ value }), { status: 200 });
  };
  const r = await refreshMlsRoster({ pool: db.pool, fetchImpl: fakeFetch });
  assert.ok(!urls[0].includes('$filter'), 'no completed pull yet, so no "changed since" filter');
  assert.equal(r.office.saved, 1, 'a record repeated on a page is saved once');
  assert.equal((await db.pool.query("SELECT name FROM mls_offices WHERE office_mls_id = 'EARLY'")).rows[0].name, 'Early Office');
  assert.equal(await rosterNeedsFill({ pool: db.pool }), false);
});

test('a roster the MLS refuses never breaks anything', { skip }, async () => {
  const { refreshMlsRoster } = await import('../src/services/mlsRoster.js');
  const r = await refreshMlsRoster({ pool: db.pool, fetchImpl: async () => new Response('forbidden', { status: 403 }) });
  assert.match(r.office.error, /403/);
  assert.match(r.member.error, /403/);
  assert.ok(r.applied.listings);
});
