/**
 * "Connect your MLS" through the API: a brokerage owner finds an MLS, works
 * through Applied → Approved → Connected → Live, enters credentials that are
 * stored encrypted and never sent back, tests the connection, confirms the
 * display rules and goes live; another brokerage can't touch that feed; the
 * platform console sees health and brokerages; and SAA's IRES scoping stays
 * exactly as it was.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-mls-connect';
process.env.MLS_PACE_MS = '0';
process.env.MLS_SYNC_ON_GO_LIVE = 'off';
process.env.MLS_TEST_RATE_LIMIT = '1000';
delete process.env.IRES_ACCESS_TOKEN;
delete process.env.MLSGRID_ACCESS_TOKEN;
for (const k of ['OUTREACH_SMTP_HOST', 'OUTREACH_SMTP_USER', 'OUTREACH_SMTP_PASSWORD', 'RESEND_API_KEY']) delete process.env[k];

const PEAK = 'peak-realty.test';
const SUMMIT = 'summit-homes.test';
const SAA = 'saahomes.com';
const SECRET = 'peak-secret-token-ABCDEF-987654';
const TRESTLE_SECRET = 'trestle-client-secret-XYZ-112233';
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let summit;
let ires;
let as = {};
const mlsCalls = [];
const realFetch = globalThis.fetch;

const q = (sql, p) => db.pool.query(sql, p);

const listing = (n, extra = {}) => ({
  ListingKey: `PV${n}`, ListingId: `${n}`, StandardStatus: 'Active', PropertyType: 'Residential',
  StreetNumber: `${n}0`, StreetName: 'Pine', StreetSuffix: 'Ct', City: 'Valleyview', StateOrProvince: 'CO',
  PostalCode: '80999', ListPrice: 500000 + n, BedroomsTotal: 3, BathroomsTotalInteger: 2, LivingArea: 2000,
  ListOfficeName: 'Valley Brokers', ListOfficeMlsId: 'VB1', ModificationTimestamp: `2026-10-0${n}T00:00:00Z`,
  Media: [{ MediaURL: `https://cdn.mls.test/${n}.jpg`, Order: 1 }],
  ...extra,
});

/** The fake MLS servers live inside this process: intercept their hosts. */
function installFakeMls() {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    if (url.host === 'mls.test') {
      mlsCalls.push({ url, auth: init.headers?.Authorization });
      if (init.headers?.Authorization !== `Bearer ${SECRET}`) return new Response('{"error":"unauthorized"}', { status: 401 });
      if (url.pathname.endsWith('/Office') || url.pathname.endsWith('/Member')) return Response.json({ value: [] });
      if ((url.searchParams.get('$filter') || '').includes('ModificationTimestamp gt')) return Response.json({ value: [] });
      const top = Number(url.searchParams.get('$top')) || 100;
      return Response.json({ value: [listing(1), listing(2), listing(3)].slice(0, top) });
    }
    if (url.host === 'api.cotality.com') {
      mlsCalls.push({ url, auth: init.headers?.Authorization });
      if (url.pathname.endsWith('/token')) return Response.json({ access_token: 'trestle-bearer', expires_in: 28800 });
      return Response.json({ value: [listing(4)] });
    }
    return realFetch(input, init);
  };
}

async function call(method, path, { host = PEAK, auth, body } = {}) {
  const res = await realFetch(`${server.url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

async function user(email, tenantId, role) {
  const { rows: [u] } = await q(
    `INSERT INTO users (email, name, role, status, manage_token, tenant_id, license_number)
     VALUES ($1, 'Olive Owner', $2, 'active', $3, $4, 'ER.100200') RETURNING *`,
    [email, role, crypto.randomBytes(24).toString('hex'), tenantId]
  );
  return u;
}

const noSecrets = (r) => {
  assert.ok(!r.text.includes(SECRET), 'the token never comes back');
  assert.ok(!r.text.includes(TRESTLE_SECRET), 'the client secret never comes back');
  assert.ok(!r.text.includes('credentials_enc'), 'nor the encrypted blob');
};

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  installFakeMls();
  ({ rows: [peak] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peak', 'Peak Realty', $1, $2) RETURNING *",
    [PEAK, JSON.stringify({ brand: { name: 'Peak Realty', legal_name: 'Peak Realty, LLC', phone: '5555550100' } })]
  ));
  ({ rows: [summit] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain) VALUES ('summit', 'Summit Homes', $1) RETURNING *",
    [SUMMIT]
  ));
  ires = await insertListing(db.pool, { city: 'Fort Collins', list_office_name: 'Summit Brokers' });
  const peakOwner = await user('olive@peak-realty.test', peak.id, 'admin');
  const summitOwner = await user('sam@summit-homes.test', summit.id, 'admin');
  const peakAgent = await user('andy@peak-realty.test', peak.id, 'agent');
  const { generateToken } = await import('../src/middleware/auth.js');
  as = {
    platform: generateToken({ email: 'owner@platform.test', role: 'admin', platform: true }),
    peak: generateToken({ id: peakOwner.id, email: peakOwner.email, role: 'admin', tenant_id: peak.id }),
    summit: generateToken({ id: summitOwner.id, email: summitOwner.email, role: 'admin', tenant_id: summit.id }),
    agent: generateToken({ id: peakAgent.id, email: peakAgent.email, role: 'agent', tenant_id: peak.id }),
  };
});

test.after(async () => {
  if (skip) return;
  globalThis.fetch = realFetch;
  await server?.close();
  await db?.drop();
});

let customKey;

test('find your MLS: search the catalog, with a way out when it isn’t listed', { skip }, async () => {
  const r = await call('GET', '/admin/mls/catalog?q=northstar', { auth: as.peak });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.results[0].id, 'northstar');
  assert.equal(r.json.data.results[0].platforms[0].originating_system, 'northstar');
  assert.ok(r.json.data.platforms.some((p) => p.id === 'reso'), 'the platforms for “My MLS isn’t listed”');
  assert.equal((await call('GET', '/admin/mls/catalog', { auth: as.agent })).status, 403, 'owners only');
  assert.equal((await call('GET', '/admin/mls/catalog')).status, 401);
});

test('owner walks a custom MLS from Not started to Connected', { skip }, async () => {
  let r = await call('GET', '/admin/mls/connect', { auth: as.peak });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.mode, 'demo');
  assert.deepEqual(r.json.data.feeds, []);

  r = await call('POST', '/admin/mls/connect', { auth: as.peak, body: { custom: { name: 'Pine Valley MLS', platform: 'reso', states: 'co' } } });
  assert.equal(r.status, 201, r.text);
  customKey = r.json.key;
  assert.match(customKey, /^x-pinevalle-[0-9a-f]{4}$/);
  let feed = r.json.data.feeds.find((f) => f.key === customKey);
  assert.equal(feed.stage, 'started');
  assert.equal(feed.platform.id, 'reso');
  assert.ok(feed.checklist.length >= 3);
  assert.match(feed.checklist[0].title, /Pine Valley MLS/);
  // The vendor sheet is filled from the brokerage's settings.
  const sheet = Object.fromEntries(feed.vendor_sheet.rows.map((x) => [x.label, x.value]));
  assert.equal(sheet.Brokerage, 'Peak Realty, LLC');
  assert.equal(sheet['Endorsing (managing) broker'], 'Olive Owner');
  assert.equal(sheet['Broker license number'], 'ER.100200');
  assert.equal(sheet['Website where listings will show'], `https://${PEAK}`);
  assert.match(feed.vendor_sheet.text, /Technology provider/);

  for (const stage of ['applied', 'approved']) {
    r = await call('PATCH', `/admin/mls/connect/${customKey}`, { auth: as.peak, body: { stage } });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.data.feeds[0].stage, stage);
  }
  assert.equal((await call('PATCH', `/admin/mls/connect/${customKey}`, { auth: as.peak, body: { stage: 'live' } })).status, 400, 'an owner can’t mark itself live');

  // Credentials: checked, stored encrypted, shown only as a hint.
  r = await call('PUT', `/admin/mls/connect/${customKey}/credentials`, { auth: as.peak, body: { config: { base_url: 'http://mls.test/odata' }, credentials: { access_token: SECRET } } });
  assert.equal(r.status, 400, 'https only');
  r = await call('PUT', `/admin/mls/connect/${customKey}/credentials`, { auth: as.peak, body: { config: { base_url: 'https://mls.test/odata' }, credentials: { access_token: SECRET } } });
  assert.equal(r.status, 200, r.text);
  noSecrets(r);
  feed = r.json.data.feeds[0];
  assert.deepEqual(feed.connection.credentials_hint.access_token, { saved: true, ending: '7654' });
  assert.equal(feed.connection.mine, true);
  const { rows: [conn] } = await q('SELECT credentials_enc FROM mls_connections WHERE feed_key = $1', [customKey]);
  assert.ok(conn.credentials_enc.startsWith('v1:') && !conn.credentials_enc.includes(SECRET));
  const { decryptSecret } = await import('../src/services/mls/secrets.js');
  assert.equal(decryptSecret(conn.credentials_enc).access_token, SECRET);

  // Test connection: a preview with the courtesy line and this brokerage's notice.
  r = await call('POST', `/admin/mls/connect/${customKey}/test`, { auth: as.peak });
  assert.equal(r.status, 200, r.text);
  noSecrets(r);
  assert.equal(r.json.listings.length, 3);
  assert.equal(r.json.listings[0].courtesy, 'Listing courtesy of Valley Brokers');
  assert.equal(r.json.listings[0].mls_number, '1');
  assert.match(r.json.disclaimer, /Peak Realty/);
  assert.equal(r.json.data.feeds[0].stage, 'connected');
  assert.ok(mlsCalls.every((c) => c.auth === `Bearer ${SECRET}` || c.url.host !== 'mls.test'));
  const top = mlsCalls.filter((c) => c.url.host === 'mls.test').at(-1).url.searchParams.get('$top');
  assert.equal(top, '5', 'the test pulls a handful, not the feed');

  // Bad credentials say so plainly.
  await call('PUT', `/admin/mls/connect/${customKey}/credentials`, { auth: as.peak, body: { credentials: { access_token: 'wrong-token-000000' } } });
  r = await call('POST', `/admin/mls/connect/${customKey}/test`, { auth: as.peak });
  assert.equal(r.status, 422);
  assert.match(r.json.error, /didn’t accept these credentials/);
  r = await call('PUT', `/admin/mls/connect/${customKey}/credentials`, { auth: as.peak, body: { credentials: { access_token: SECRET } } });
  assert.equal(r.status, 200);
  r = await call('POST', `/admin/mls/connect/${customKey}/test`, { auth: as.peak });
  assert.equal(r.status, 200, r.text);
});

test('another brokerage can’t see or touch that feed', { skip }, async () => {
  for (const [method, path, body] of [
    ['PATCH', `/admin/mls/connect/${customKey}`, { stage: 'approved' }],
    ['PUT', `/admin/mls/connect/${customKey}/credentials`, { credentials: { access_token: 'hijack-000000000' } }],
    ['POST', `/admin/mls/connect/${customKey}/test`, {}],
    ['POST', `/admin/mls/connect/${customKey}/go-live`, { attest: true }],
    ['DELETE', `/admin/mls/connect/${customKey}`, undefined],
  ]) {
    const r = await call(method, path, { auth: as.summit, host: SUMMIT, body });
    assert.equal(r.status, 404, `${method} ${path}: ${r.text}`);
  }
  // Summit's token doesn't work on Peak's site either.
  assert.equal((await call('GET', '/admin/mls/connect', { auth: as.summit, host: PEAK })).status, 403);
  const mine = await call('GET', '/admin/mls/connect', { auth: as.summit, host: SUMMIT });
  assert.deepEqual(mine.json.data.feeds, []);
  const { rows: [c] } = await q('SELECT credentials_enc FROM mls_connections WHERE feed_key = $1', [customKey]);
  const { decryptSecret } = await import('../src/services/mls/secrets.js');
  assert.equal(decryptSecret(c.credentials_enc).access_token, SECRET, 'credentials unchanged');
  // Owners can't reach the platform console.
  assert.equal((await call('GET', '/platform/mls/connections', { auth: as.peak })).status, 403);
});

test('go live: display rules first, then the site switches from sample homes', { skip }, async () => {
  let r = await call('POST', `/admin/mls/connect/${customKey}/go-live`, { auth: as.peak, body: { attest: true } });
  assert.equal(r.status, 400);
  assert.equal(r.json.step, 'display');
  r = await call('PATCH', `/admin/mls/connect/${customKey}`, { auth: as.peak, body: { confirm_display: true, office_mls_id: 'PEAK1' } });
  assert.equal(r.status, 200, r.text);
  assert.equal((await call('PATCH', `/admin/mls/connect/${customKey}`, { auth: as.peak, body: { sold_enabled: true } })).status, 400, 'sold data is off until the MLS allows it');
  assert.equal((await call('POST', `/admin/mls/connect/${customKey}/go-live`, { auth: as.peak, body: {} })).status, 400, 'needs the attestation');
  r = await call('POST', `/admin/mls/connect/${customKey}/go-live`, { auth: as.peak, body: { attest: true } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.waiting_for, 'first_import');
  assert.equal(r.json.data.feeds[0].stage, 'going_live');
  assert.equal((await call('GET', '/listings?limit=50', { host: PEAK })).json.data.every((l) => l.feed === 'demo'), true, 'sample homes until the import lands');

  // The first import (the scheduler's job; run here directly).
  const { syncFeed } = await import('../src/services/mls/engine.js');
  const result = await syncFeed(customKey, { pool: db.pool, minIntervalMs: 0 });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.promoted, [peak.id]);
  const { clearFeedCache } = await import('../src/services/feeds.js');
  clearFeedCache();

  r = await call('GET', '/listings?limit=50', { host: PEAK });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.meta.total, 3);
  assert.ok(r.json.data.every((l) => l.feed === customKey && l.sample === false));
  assert.ok(r.json.data.every((l) => l.courtesy === 'Listing courtesy of Valley Brokers'));
  assert.deepEqual(r.json.data.map((l) => l.mls_number).sort(), ['1', '2', '3']);
  const d = await call('GET', `/listings/${r.json.data[0].slug}`, { host: PEAK });
  assert.equal(d.status, 200, d.text);
  assert.match(d.json.data.attribution.disclaimer, /Peak Realty/);
  assert.match(d.json.data.attribution.disclaimer, /Pine Valley MLS/);
  assert.ok(!/\{(brokerage|updated|mls)\}/.test(d.json.data.attribution.disclaimer));

  r = await call('GET', '/admin/mls/connect', { auth: as.peak });
  assert.equal(r.json.data.mode, 'live');
  assert.equal(r.json.data.feeds[0].stage, 'live');
  noSecrets(r);
});

test('scoping: SAA still shows IRES only; other brokerages never see this feed', { skip }, async () => {
  const saa = await call('GET', '/listings?limit=100&city=__all__', { host: SAA });
  assert.equal(saa.status, 200);
  assert.deepEqual(saa.json.data.map((l) => l.listing_id), [ires.listing_id]);
  assert.ok(saa.json.data.every((l) => l.feed === 'ires' && l.mls_number === ires.listing_id));
  const other = await call('GET', '/listings?limit=100', { host: SUMMIT });
  assert.ok(other.json.data.every((l) => l.feed === 'demo'));
  const peakHome = (await call('GET', '/listings?limit=1', { host: PEAK })).json.data[0];
  assert.equal((await call('GET', `/listings/${peakHome.slug}`, { host: SUMMIT })).status, 404);
  assert.equal((await call('GET', `/listings/${peakHome.slug}`, { host: SAA })).status, 404);
  assert.equal((await call('GET', `/listings/${ires.slug}`, { host: PEAK })).status, 404);
});

test('a shared connection: the second brokerage asks, the platform approves', { skip }, async () => {
  // Peak connects HiCentral (Trestle) with its own client credentials.
  let r = await call('POST', '/admin/mls/connect', { auth: as.peak, body: { catalog_id: 'hicentral' } });
  assert.equal(r.status, 201, r.text);
  r = await call('PUT', '/admin/mls/connect/hicentral/credentials', { auth: as.peak, body: { credentials: { client_id: 'peak-client', client_secret: TRESTLE_SECRET } } });
  assert.equal(r.status, 200, r.text);
  noSecrets(r);
  r = await call('POST', '/admin/mls/connect/hicentral/test', { auth: as.peak });
  assert.equal(r.status, 200, r.text);
  assert.ok(mlsCalls.some((c) => c.url.host === 'api.cotality.com' && c.url.pathname === '/trestle/oidc/connect/token'));

  // Summit joins the same MLS: it can't overwrite Peak's credentials.
  r = await call('POST', '/admin/mls/connect', { auth: as.summit, host: SUMMIT, body: { catalog_id: 'hicentral' } });
  assert.equal(r.status, 201, r.text);
  noSecrets(r);
  const feed = r.json.data.feeds[0];
  assert.equal(feed.connection.mine, false);
  assert.equal(feed.connection.entered_by_other, true);
  assert.equal(feed.can_enter_credentials, false);
  r = await call('PUT', '/admin/mls/connect/hicentral/credentials', { auth: as.summit, host: SUMMIT, body: { credentials: { client_id: 'x', client_secret: 'y-000000000000' } } });
  assert.equal(r.status, 403);
  await call('PATCH', '/admin/mls/connect/hicentral', { auth: as.summit, host: SUMMIT, body: { confirm_display: true } });
  r = await call('POST', '/admin/mls/connect/hicentral/go-live', { auth: as.summit, host: SUMMIT, body: { attest: true } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.waiting_for, 'platform', 'someone else’s connection: the platform confirms the MLS approval');

  // The platform console: every MLS, health, brokerages, who's waiting. No secrets.
  r = await call('GET', '/platform/mls/connections', { auth: as.platform });
  assert.equal(r.status, 200, r.text);
  noSecrets(r);
  const custom = r.json.data.feeds.find((f) => f.key === customKey);
  assert.equal(custom.connection.listing_count, 3);
  assert.ok(custom.connection.last_success_at);
  assert.deepEqual(custom.brokerages.map((b) => b.tenant_name), ['Peak Realty']);
  assert.ok(r.json.data.feeds.some((f) => f.key === 'ires' && f.connection.builtin));
  assert.deepEqual(r.json.data.waiting.map((w) => [w.feed_key, w.tenant_name]), [['hicentral', 'Summit Homes']]);

  // Approve Summit (the existing per-brokerage switch), edit rules, sync now.
  r = await call('PUT', `/platform/tenants/${summit.id}/feeds/hicentral`, { auth: as.platform, body: { status: 'approved' } });
  assert.equal(r.status, 200, r.text);
  r = await call('PATCH', '/platform/mls/connections/hicentral', { auth: as.platform, body: { sold_data_allowed: true, logo_required: true, cadence_minutes: 5 } });
  assert.equal(r.status, 400, 'cadence respects the platform minimum');
  r = await call('PATCH', '/platform/mls/connections/hicentral', { auth: as.platform, body: { sold_data_allowed: true, logo_required: true, disclaimer: 'HiCentral data shown by {brokerage}. Updated {updated}.', display_verified: true, state: 'live', cadence_minutes: 60 } });
  assert.equal(r.status, 200, r.text);
  const hi = r.json.data.feeds.find((f) => f.key === 'hicentral');
  assert.equal(hi.logo_required, true);
  assert.equal(hi.connection.state, 'live');
  assert.equal(hi.brokerages.find((b) => b.tenant_name === 'Summit Homes').stage, 'live');
  r = await call('PATCH', '/platform/mls/connections/hicentral', { auth: as.platform, body: { disclaimer: 'No brokerage here' } });
  assert.equal(r.status, 400);
  r = await call('POST', '/platform/mls/connections/hicentral/sync', { auth: as.platform, body: { wait: true } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.ok, true, r.json.result.error);
  noSecrets(r);
  // Suspending a brokerage takes it back to sample homes.
  r = await call('PUT', `/platform/tenants/${summit.id}/feeds/hicentral`, { auth: as.platform, body: { status: 'suspended' } });
  assert.equal(r.status, 200);
  const { clearFeedCache } = await import('../src/services/feeds.js');
  clearFeedCache();
  assert.ok((await call('GET', '/listings?limit=10', { host: SUMMIT })).json.data.every((l) => l.feed === 'demo'));
});

test('platform credentials: saved encrypted, replaced field by field, never returned', { skip }, async () => {
  let r = await call('PUT', '/platform/mls/connections/hicentral/credentials', { auth: as.platform, body: { credentials: { client_secret: 'rotated-secret-0000-1111' } } });
  assert.equal(r.status, 200, r.text);
  assert.ok(!r.text.includes('rotated-secret'));
  const hi = r.json.data.feeds.find((f) => f.key === 'hicentral');
  assert.deepEqual(hi.connection.credentials_hint.client_secret, { saved: true, ending: '1111' });
  assert.equal(hi.connection.credentials_hint.client_id.saved, true, 'the client ID was kept');
  const { rows: [c] } = await q("SELECT credentials_enc, credentials_tenant_id FROM mls_connections WHERE feed_key = 'hicentral'");
  assert.equal(Number(c.credentials_tenant_id), peak.id, 'still Peak’s connection');
  r = await call('PUT', '/platform/mls/connections/hicentral/credentials', { auth: as.platform, body: { config: { base_url: 'ftp://nope' } } });
  assert.equal(r.status, 400);
});

test('a brokerage can stop setting up an MLS that isn’t live', { skip }, async () => {
  let r = await call('POST', '/admin/mls/connect', { auth: as.summit, host: SUMMIT, body: { catalog_id: 'mred' } });
  assert.equal(r.status, 201, r.text);
  const mred = r.json.data.feeds.find((f) => f.key === 'mred');
  assert.equal(mred.platform.id, 'mlsgrid');
  assert.equal(mred.connection.config.originating_system, 'mred');
  assert.match(mred.checklist[1].body, /MLS Grid emails/);
  r = await call('DELETE', '/admin/mls/connect/mred', { auth: as.summit, host: SUMMIT });
  assert.equal(r.status, 200, r.text);
  assert.ok(!r.json.data.feeds.some((f) => f.key === 'mred'));
  assert.equal((await call('DELETE', `/admin/mls/connect/${customKey}`, { auth: as.peak })).status, 400, 'a live MLS stays until the platform turns it off');
});
