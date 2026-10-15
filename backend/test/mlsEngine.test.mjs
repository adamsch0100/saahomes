/**
 * The generic MLS sync engine end to end against the test database and a
 * fake MLS: first import, incremental replication by ModificationTimestamp,
 * sales, removals, roster names, the per-feed lock, health, switching a
 * waiting brokerage live, the scheduler, and that IRES rows are never
 * touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-mls-engine';
delete process.env.IRES_ACCESS_TOKEN;
delete process.env.MLSGRID_ACCESS_TOKEN;

const skip = !hasTestDatabase;
let db;
let engine;
let tenant;
const q = (sql, p) => db.pool.query(sql, p);
const noSleep = async () => {};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const home = (key, extra = {}) => ({
  ListingKey: key,
  ListingId: key.replace(/^TG/, ''),
  StandardStatus: 'Active',
  PropertyType: 'Residential',
  PropertySubType: 'Single Family Residence',
  StreetNumber: String(100 + Number(key.replace(/\D/g, ''))),
  StreetName: 'Aspen',
  StreetSuffix: 'Way',
  City: 'Springfield',
  StateOrProvince: 'MO',
  PostalCode: '65801',
  ListPrice: 350000,
  BedroomsTotal: 3,
  BathroomsTotalInteger: 2,
  LivingArea: 1750,
  ListOfficeMlsId: 'OFF1',
  ListAgentMlsId: 'AG1',
  MlgCanView: true,
  ModificationTimestamp: '2026-10-01T10:00:00.000Z',
  Media: [{ MediaURL: `https://media.mlsgrid.com/${key}/1.jpg`, Order: 1 }],
  ...extra,
});

/** A fake MLS Grid: state the test changes between runs. */
function fakeGrid(state) {
  const fn = async (input) => {
    const url = new URL(String(input));
    state.calls.push(url);
    const filter = url.searchParams.get('$filter') || '';
    if (url.pathname.endsWith('/Office')) return json({ value: [{ OfficeMlsId: 'OFF1', OfficeName: 'Ozark Homes Realty', ModificationTimestamp: '2026-09-01T00:00:00Z' }] });
    if (url.pathname.endsWith('/Member')) return json({ value: [{ MemberMlsId: 'AG1', MemberFullName: 'Olive Ozark', ModificationTimestamp: '2026-09-01T00:00:00Z' }] });
    if (filter.includes("StandardStatus eq 'Closed'")) return json({ value: state.sold || [] });
    if (filter.includes('ModificationTimestamp gt')) return json({ value: state.changes || [] });
    // First import: two pages joined by nextLink.
    if (url.searchParams.get('page') === '2') return json({ value: state.active.slice(2) });
    return json({ value: state.active.slice(0, 2), '@odata.nextLink': 'https://api.mlsgrid.com/v2/Property?page=2' });
  };
  return fn;
}

async function addConnection(key, { platform = 'mlsgrid', config = { originating_system: 'testgrid' }, sold = true, state = 'live' } = {}) {
  const { encryptSecret } = await import('../src/services/mls/secrets.js');
  await q(
    `INSERT INTO mls_feeds (key, name, vendor, disclaimer, sold_data_allowed, courtesy_required, states)
     VALUES ($1, 'Test Grid', 'Test Grid via MLS Grid', 'Data from Test Grid, shown by {brokerage}. Updated {updated}.', $2, TRUE, '{MO}')`,
    [key, sold]
  );
  await q(
    `INSERT INTO mls_connections (feed_key, platform, config, credentials_enc, state)
     VALUES ($1, $2, $3, $4, $5)`,
    [key, platform, JSON.stringify(config), encryptSecret({ access_token: 'fake-token-123456' }), state]
  );
}

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  engine = await import('../src/services/mls/engine.js');
  ({ rows: [tenant] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain) VALUES ('ozark', 'Ozark Realty', 'ozark.test') RETURNING *"
  ));
});

test.after(async () => {
  if (skip) return;
  await db?.drop();
});

test('first import, incremental changes, sales, removals and roster names', { skip }, async () => {
  await addConnection('testgrid');
  // An IRES home whose MLS number matches one of the new feed's.
  const ires = await insertListing(db.pool, { listing_id: '1', city: 'Fort Collins', list_price: 999000 });
  // A brokerage waiting to go live on this feed.
  await q(
    `INSERT INTO tenant_feeds (tenant_id, feed_key, status, stage, go_live_requested_at, go_live_auto, display_confirmed_at)
     VALUES ($1, 'testgrid', 'pending', 'connected', NOW(), TRUE, NOW())`,
    [tenant.id]
  );

  const state = { calls: [], active: [home('TG1'), home('TG2'), home('TG3', { ModificationTimestamp: '2026-10-02T08:00:00.000Z' })] };
  const first = await engine.syncFeed('testgrid', { pool: db.pool, fetchImpl: fakeGrid(state), sleep: noSleep, minIntervalMs: 0 });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.mode, 'full');
  assert.equal(first.listings, 3);
  assert.deepEqual(first.promoted, [tenant.id], 'the waiting brokerage switched to live listings');

  const { rows } = await q("SELECT * FROM listings WHERE feed = 'testgrid' ORDER BY listing_id");
  assert.deepEqual(rows.map((r) => r.listing_id), ['testgrid-1', 'testgrid-2', 'testgrid-3']);
  assert.ok(rows.every((r) => r.is_active && r.state === 'MO' && r.photos.length === 1));
  assert.ok(rows.every((r) => r.list_office_name === 'Ozark Homes Realty'), 'office names from the roster');
  assert.ok(rows.every((r) => r.list_agent_name === 'Olive Ozark'));

  // Every MLS Grid request names the one MLS; the first import asks for MlgCanView eq true.
  const propertyCalls = state.calls.filter((u) => u.pathname.endsWith('/Property'));
  assert.ok(propertyCalls.every((u) => (u.searchParams.get('$filter') || "OriginatingSystemName eq 'testgrid'").includes("OriginatingSystemName eq 'testgrid'")));
  assert.match(propertyCalls[0].searchParams.get('$filter'), /MlgCanView eq true/);

  const { rows: [conn] } = await q("SELECT * FROM mls_connections WHERE feed_key = 'testgrid'");
  assert.equal(conn.watermark, '2026-10-02T08:00:00.000Z');
  assert.ok(conn.full_import_at && conn.last_success_at && conn.next_run_at && conn.sold_backfill_at);
  assert.equal(conn.listing_count, 3);
  assert.equal(conn.last_error, null);
  assert.equal(conn.running_since, null);

  const { rows: [tf] } = await q("SELECT * FROM tenant_feeds WHERE tenant_id = $1 AND feed_key = 'testgrid'", [tenant.id]);
  assert.equal(tf.status, 'approved');
  assert.equal(tf.stage, 'live');

  // IRES's home with the same MLS number is untouched.
  const { rows: [iresAfter] } = await q('SELECT * FROM listings WHERE id = $1', [ires.id]);
  assert.equal(iresAfter.feed, 'ires');
  assert.equal(Number(iresAfter.list_price), 999000);

  // Incremental: a price change, a sale, and a home the MLS withdrew from display.
  state.calls = [];
  state.changes = [
    home('TG1', { ListPrice: 340000, ModificationTimestamp: '2026-10-03T09:00:00.000Z' }),
    home('TG2', { StandardStatus: 'Closed', ClosePrice: 355000, CloseDate: new Date().toISOString().slice(0, 10), ModificationTimestamp: '2026-10-03T10:00:00.000Z' }),
    home('TG3', { MlgCanView: false, ModificationTimestamp: '2026-10-03T11:00:00.000Z' }),
  ];
  const second = await engine.syncFeed('testgrid', { pool: db.pool, fetchImpl: fakeGrid(state), sleep: noSleep, minIntervalMs: 0, mode: 'incremental' });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.mode, 'incremental');
  const inc = state.calls.find((u) => u.pathname.endsWith('/Property'));
  assert.equal(inc.searchParams.get('$filter'), "OriginatingSystemName eq 'testgrid' and ModificationTimestamp gt 2026-10-02T08:00:00.000Z");

  const after = Object.fromEntries((await q("SELECT listing_id, status, is_active, list_price FROM listings WHERE feed = 'testgrid'")).rows.map((r) => [r.listing_id, r]));
  assert.equal(Number(after['testgrid-1'].list_price), 340000);
  assert.equal(after['testgrid-2'].is_active, false);
  assert.equal(after['testgrid-2'].status, 'Sold');
  assert.equal(after['testgrid-3'].is_active, false, 'MlgCanView false takes it down');
  const { rows: sold } = await q("SELECT * FROM sold_listings WHERE feed = 'testgrid'");
  assert.equal(sold.length, 1);
  assert.equal(sold[0].listing_id, 'testgrid-2');
  assert.equal(Number(sold[0].sold_price), 355000);
  assert.equal(sold[0].list_office_name, 'Ozark Homes Realty');
  assert.equal((await q("SELECT watermark FROM mls_connections WHERE feed_key = 'testgrid'")).rows[0].watermark, '2026-10-03T11:00:00.000Z');
});

test('a feed already syncing elsewhere is skipped (advisory lock)', { skip }, async () => {
  const client = await db.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1, hashtext($2))', [engine.MLS_LOCK_NS, 'testgrid']);
    const r = await engine.syncFeed('testgrid', { pool: db.pool, fetchImpl: async () => { throw new Error('must not call the MLS'); }, sleep: noSleep, minIntervalMs: 0 });
    assert.equal(r.skipped, 'locked');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1, hashtext($2))', [engine.MLS_LOCK_NS, 'testgrid']);
    client.release();
  }
});

test('errors are recorded in plain words and retried later', { skip }, async () => {
  const r = await engine.syncFeed('testgrid', {
    pool: db.pool, fetchImpl: async () => json({ error: 'no' }, 401), sleep: noSleep, minIntervalMs: 0, mode: 'incremental',
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /didn’t accept these credentials/);
  const { rows: [c] } = await q("SELECT last_error, last_error_at, next_run_at, running_since FROM mls_connections WHERE feed_key = 'testgrid'");
  assert.match(c.last_error, /credentials/);
  assert.ok(new Date(c.next_run_at) > new Date(Date.now() + 30 * 60 * 1000), 'a refused feed waits an hour');
  assert.equal(c.running_since, null);
});

test('platforms without removal flags reconcile active keys once a day', { skip }, async () => {
  await addConnection('testreso', { platform: 'reso', config: { base_url: 'https://mls.example.com/odata' }, sold: false });
  const records = [home('TG11'), home('TG12'), home('TG13')].map((r) => ({ ...r, MlgCanView: undefined }));
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/Office') || url.pathname.endsWith('/Member')) return json({ value: [] });
    if (url.searchParams.get('$select') === 'ListingKey,ListingId') return json({ value: [{ ListingKey: 'TG11' }, { ListingKey: 'TG13' }] });
    if ((url.searchParams.get('$filter') || '').includes('ModificationTimestamp gt')) return json({ value: [] });
    return json({ value: records });
  };
  const first = await engine.syncFeed('testreso', { pool: db.pool, fetchImpl, sleep: noSleep, minIntervalMs: 0 });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.listings, 3);
  await q("UPDATE mls_connections SET reconciled_at = NOW() - INTERVAL '2 days' WHERE feed_key = 'testreso'");
  const second = await engine.syncFeed('testreso', { pool: db.pool, fetchImpl, sleep: noSleep, minIntervalMs: 0 });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.reconciled, true);
  const { rows } = await q("SELECT listing_id, is_active FROM listings WHERE feed = 'testreso' ORDER BY listing_id");
  assert.deepEqual(rows.map((r) => [r.listing_id, r.is_active]), [['testreso-11', true], ['testreso-12', false], ['testreso-13', true]]);
  assert.equal((await q("SELECT COUNT(*)::int AS n FROM sold_listings WHERE feed = 'testreso'")).rows[0].n, 0, 'no sold data when the MLS doesn’t allow it');
});

test('the scheduler runs due live feeds and leaves the rest', { skip }, async () => {
  const { runDueFeeds } = await import('../src/jobs/mlsScheduler.js');
  await q("UPDATE mls_connections SET next_run_at = NOW() - INTERVAL '1 minute' WHERE feed_key = 'testreso'");
  await q("UPDATE mls_connections SET next_run_at = NOW() + INTERVAL '1 hour' WHERE feed_key = 'testgrid'");
  await addConnection('testpaused', { platform: 'reso', config: { base_url: 'https://mls.example.com/odata' }, state: 'paused' });
  const seen = [];
  const fetchImpl = async (input) => {
    seen.push(String(input));
    return json({ value: [] });
  };
  const r = await runDueFeeds({ pool: db.pool, fetchImpl, sleep: noSleep, minIntervalMs: 0 });
  assert.deepEqual(r.ran.map((x) => x.key), ['testreso']);
  assert.ok(seen.every((u) => u.startsWith('https://mls.example.com/')));
});
