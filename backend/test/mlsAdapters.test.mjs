/**
 * MLS platform adapters against fake APIs (no network, no database):
 * how each platform signs in, pages, filters, drops a refused field and
 * backs off; credential encryption; the catalog; and that the shared RESO
 * mapping still gives IRES exactly what it always did.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-mls-adapters';
delete process.env.MLS_PACE_MS;
delete process.env.IRES_ACCESS_TOKEN;
delete process.env.MLSGRID_ACCESS_TOKEN;

const { createAdapter, fieldsNamedIn, explainError, resetPacing } = await import('../src/services/mls/adapters.js');
const { encryptSecret, decryptSecret, credentialHints, credentialsKey } = await import('../src/services/mls/secrets.js');
const { searchCatalog, catalogEntry, CATALOG } = await import('../src/services/mls/catalog.js');
const { PLATFORMS } = await import('../src/services/mls/platforms.js');
const { normalizeResoListing } = await import('../src/services/mls/resoMapping.js');

const noSleep = async () => {};

function json(body, { status = 200, headers = {} } = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** A fake fetch: handler(url, init) → Response. Records every call. */
function fakeFetch(handler) {
  const calls = [];
  const fn = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init, auth: init.headers?.Authorization || null });
    return handler(url, init, calls.length);
  };
  fn.calls = calls;
  return fn;
}

const rec = (key, extra = {}) => ({
  ListingKey: key, ListingId: key, StandardStatus: 'Active', ListPrice: 400000, City: 'Springfield',
  StreetNumber: '1', StreetName: 'Main St', ModificationTimestamp: '2026-10-01T00:00:00Z', ...extra,
});

test('MLS Grid: bearer token, one OriginatingSystemName per request, MlgCanView on the first import, nextLink paging', async () => {
  resetPacing();
  const f = fakeFetch((url, init, n) => {
    if (n === 1) return json({ value: [rec('NST1'), rec('NST2')], '@odata.nextLink': 'https://api.mlsgrid.com/v2/Property?$skiptoken=abc' });
    return json({ value: [rec('NST3')] });
  });
  const a = createAdapter({ platform: 'mlsgrid', config: { originating_system: 'northstar' }, credentials: { access_token: 'grid-token-1' } }, { fetchImpl: f, sleep: noSleep, minIntervalMs: 0 });
  const keys = [];
  for await (const page of a.propertyPages({ initial: true })) keys.push(...page.records.map((r) => r.ListingKey));
  assert.deepEqual(keys, ['NST1', 'NST2', 'NST3']);
  assert.equal(f.calls.length, 2);
  const first = f.calls[0].url;
  assert.equal(first.origin + first.pathname, 'https://api.mlsgrid.com/v2/Property');
  assert.match(first.searchParams.get('$filter'), /^OriginatingSystemName eq 'northstar' and \(StandardStatus eq 'Active'/);
  assert.match(first.searchParams.get('$filter'), /MlgCanView eq true/);
  assert.equal(first.searchParams.get('$expand'), 'Media');
  assert.ok(Number(first.searchParams.get('$top')) <= 1000, 'MLS Grid caps $top at 1000 with $expand');
  assert.equal(first.searchParams.get('$orderby'), null, 'MLS Grid orders by ModificationTimestamp itself');
  assert.equal(f.calls[0].auth, 'Bearer grid-token-1');
  assert.equal(f.calls[1].url.searchParams.get('$skiptoken'), 'abc', 'follows @odata.nextLink as given');

  // Replication: changes since the watermark, without MlgCanView (so removals arrive).
  const g = fakeFetch(() => json({ value: [] }));
  const b = createAdapter({ platform: 'mlsgrid', config: { originating_system: 'northstar' }, credentials: { access_token: 't' } }, { fetchImpl: g, sleep: noSleep, minIntervalMs: 0 });
  for await (const _ of b.propertyPages({ since: '2026-10-01T00:00:00.000Z' })) { /* drain */ }
  const filter = g.calls[0].url.searchParams.get('$filter');
  assert.equal(filter, "OriginatingSystemName eq 'northstar' and ModificationTimestamp gt 2026-10-01T00:00:00.000Z");
  assert.equal(b.reconciles, false, 'MLS Grid reports removals with MlgCanView');
});

test('MLS Grid falls back to the platform token and needs the MLS code', async () => {
  assert.throws(() => createAdapter({ platform: 'mlsgrid', config: {}, credentials: { access_token: 'x' } }), /MLS code/);
  assert.throws(() => createAdapter({ platform: 'mlsgrid', config: { originating_system: 'mred' }, credentials: {} }), /access token/);
  process.env.MLSGRID_ACCESS_TOKEN = 'platform-grid-token';
  try {
    const f = fakeFetch(() => json({ value: [] }));
    const a = createAdapter({ platform: 'mlsgrid', config: { originating_system: 'mred' } }, { fetchImpl: f, minIntervalMs: 0 });
    await a.preview(1);
    assert.equal(f.calls[0].auth, 'Bearer platform-grid-token');
  } finally {
    delete process.env.MLSGRID_ACCESS_TOKEN;
  }
});

test('Bridge: dataset in the path, $top 200, Media on the record, $skip paging when there is no nextLink', async () => {
  resetPacing();
  const page = (from, n) => Array.from({ length: n }, (_, i) => rec(`B${from + i}`));
  const f = fakeFetch((url) => {
    const skip = Number(url.searchParams.get('$skip') || 0);
    return json({ value: skip === 0 ? page(0, 200) : page(200, 3) });
  });
  const a = createAdapter({ platform: 'bridge', config: { dataset_id: 'testmls' }, credentials: { access_token: 'server-token' } }, { fetchImpl: f, sleep: noSleep, minIntervalMs: 0 });
  let total = 0;
  for await (const p of a.propertyPages({ initial: true })) total += p.records.length;
  assert.equal(total, 203);
  assert.equal(f.calls.length, 2);
  const u = f.calls[0].url;
  assert.equal(u.origin + u.pathname, 'https://api.bridgedataoutput.com/api/v2/OData/testmls/Property');
  assert.equal(u.searchParams.get('$top'), '200');
  assert.equal(u.searchParams.get('$expand'), null, 'Bridge returns Media on the Property record');
  assert.equal(f.calls[1].url.searchParams.get('$skip'), '200');
  assert.equal(f.calls[0].auth, 'Bearer server-token');
  assert.throws(() => createAdapter({ platform: 'bridge', config: {}, credentials: { access_token: 'x' } }), /dataset ID/);
});

test('Trestle: OAuth2 client credentials, cached token, refreshed once on 401', async () => {
  resetPacing();
  let tokens = 0;
  let propertyCalls = 0;
  const f = fakeFetch((url, init) => {
    if (url.pathname.endsWith('/oidc/connect/token')) {
      tokens += 1;
      const body = new URLSearchParams(init.body);
      assert.equal(body.get('grant_type'), 'client_credentials');
      assert.equal(body.get('scope'), 'api');
      assert.equal(body.get('client_id'), 'trestle-user');
      assert.equal(body.get('client_secret'), 'trestle-pass');
      return json({ access_token: `tok${tokens}`, expires_in: 28800, token_type: 'Bearer' });
    }
    propertyCalls += 1;
    if (propertyCalls === 1) return json({ value: [rec('T1')], '@odata.nextLink': `${url.origin}/trestle/odata/Property?next=2` });
    if (propertyCalls === 2) return json({ error: 'expired' }, { status: 401 });
    return json({ value: [rec('T2')] });
  });
  const a = createAdapter({ platform: 'trestle', credentials: { client_id: 'trestle-user', client_secret: 'trestle-pass' } }, { fetchImpl: f, sleep: noSleep, minIntervalMs: 0 });
  const keys = [];
  for await (const p of a.propertyPages({ since: '2026-10-01T00:00:00Z' })) keys.push(...p.records.map((r) => r.ListingKey));
  assert.deepEqual(keys, ['T1', 'T2']);
  assert.equal(tokens, 2, 'one token, refreshed once after the 401');
  const prop = f.calls.find((c) => c.url.pathname.endsWith('/Property'));
  assert.equal(prop.url.origin, 'https://api.cotality.com');
  assert.equal(prop.url.pathname, '/trestle/odata/Property');
  assert.equal(prop.url.searchParams.get('$orderby'), 'ModificationTimestamp asc');
  assert.equal(prop.url.searchParams.get('$expand'), 'Media');
  assert.equal(prop.auth, 'Bearer tok1');
  assert.equal(f.calls.at(-1).auth, 'Bearer tok2');
  assert.throws(() => createAdapter({ platform: 'trestle', credentials: { client_id: 'only-id' } }), /client ID and the client secret|access token/);

  // A refused token is a credentials problem, in plain words.
  const bad = fakeFetch(() => json({ error: 'invalid_client' }, { status: 400 }));
  const b = createAdapter({ platform: 'trestle', credentials: { client_id: 'u', client_secret: 'p' } }, { fetchImpl: bad, sleep: noSleep, minIntervalMs: 0 });
  await assert.rejects(b.preview(), (e) => /didn’t accept these credentials/.test(explainError(e)));
});

test('Spark: bearer access token, replication host allows 1,000 a page', async () => {
  resetPacing();
  const f = fakeFetch(() => json({ value: [rec('S1')] }));
  const a = createAdapter({ platform: 'spark', credentials: { access_token: 'spark-tok' } }, { fetchImpl: f, sleep: noSleep, minIntervalMs: 0 });
  await a.preview(3);
  assert.equal(f.calls[0].url.origin + f.calls[0].url.pathname, 'https://sparkapi.com/Reso/OData/Property');
  assert.equal(f.calls[0].auth, 'Bearer spark-tok');
  const g = fakeFetch(() => json({ value: [] }));
  const b = createAdapter({ platform: 'spark', config: { base_url: 'https://replication.sparkapi.com/Reso/OData' }, credentials: { access_token: 'x' } }, { fetchImpl: g, sleep: noSleep, minIntervalMs: 0 });
  for await (const _ of b.propertyPages({ initial: true })) { /* drain */ }
  assert.equal(g.calls[0].url.searchParams.get('$top'), '1000');
  assert.equal(g.calls[0].url.host, 'replication.sparkapi.com');
});

test('Generic RESO: token or client credentials, https only', async () => {
  assert.throws(() => createAdapter({ platform: 'reso', config: {}, credentials: { access_token: 'x' } }), /API address/);
  assert.throws(() => createAdapter({ platform: 'reso', config: { base_url: 'http://mls.example.com/odata' }, credentials: { access_token: 'x' } }), /https/);
  assert.throws(() => createAdapter({ platform: 'reso', config: { base_url: 'https://mls.example.com/odata' }, credentials: { client_id: 'a', client_secret: 'b' } }), /token address/);
  resetPacing();
  const f = fakeFetch((url) => (url.pathname.endsWith('/token')
    ? json({ access_token: 'cc-token', expires_in: 3600 })
    : json({ value: [rec('R1')] })));
  const a = createAdapter({
    platform: 'reso',
    config: { base_url: 'https://mls.example.com/odata/', token_url: 'https://mls.example.com/token', scope: 'odata' },
    credentials: { client_id: 'a', client_secret: 'b' },
  }, { fetchImpl: f, sleep: noSleep, minIntervalMs: 0 });
  const rows = await a.preview(1);
  assert.equal(rows[0].ListingKey, 'R1');
  assert.equal(new URLSearchParams(f.calls[0].init.body).get('scope'), 'odata');
  assert.equal(f.calls[1].url.pathname, '/odata/Property');
  assert.equal(f.calls[1].auth, 'Bearer cc-token');
});

test('a 400 naming a field drops just that field and retries; required fields are never dropped', async () => {
  resetPacing();
  const f = fakeFetch((url) => {
    const select = url.searchParams.get('$select').split(',');
    if (select.includes('ListOfficeName')) return json("The query specified in the URI is not valid. Could not find a property named 'ListOfficeName' on type 'Property'.", { status: 400 });
    if (select.includes('GreenBuildingVerificationType')) return json({ error: { message: "field 'GreenBuildingVerificationType' is not allowed in $select" } }, { status: 400 });
    return json({ value: [rec('F1')] });
  });
  const a = createAdapter({ platform: 'reso', config: { base_url: 'https://mls.example.com/odata' }, credentials: { access_token: 't' } }, { fetchImpl: f, sleep: noSleep, minIntervalMs: 0 });
  const rows = await a.preview(1);
  assert.equal(rows.length, 1);
  assert.deepEqual(a.droppedFields.sort(), ['GreenBuildingVerificationType', 'ListOfficeName']);
  assert.equal(f.calls.length, 3);
  const last = f.calls.at(-1).url.searchParams.get('$select').split(',');
  assert.ok(last.includes('ListOfficeMlsId'), 'a field merely sharing a prefix is kept');

  // A 400 that names nothing we asked for is a real error.
  const g = fakeFetch(() => json('Syntax error at position 12', { status: 400 }));
  const b = createAdapter({ platform: 'reso', config: { base_url: 'https://mls.example.com/odata' }, credentials: { access_token: 't' } }, { fetchImpl: g, sleep: noSleep, minIntervalMs: 0 });
  await assert.rejects(b.preview(1), /MLS 400/);
  assert.equal(g.calls.length, 1);

  // Refusing $expand=Media switches to the Media resource.
  const h = fakeFetch((url) => {
    if (url.pathname.endsWith('/Media')) return json({ value: [{ ResourceRecordKey: 'M1', MediaURL: 'https://cdn.example.com/a', Order: 1 }] });
    if (url.searchParams.get('$expand')) return json('Navigation property Media not expandable', { status: 400 });
    return json({ value: [rec('M1')] });
  });
  const c = createAdapter({ platform: 'reso', config: { base_url: 'https://mls.example.com/odata' }, credentials: { access_token: 't' } }, { fetchImpl: h, sleep: noSleep, minIntervalMs: 0 });
  await c.preview(1);
  assert.equal(c.expandsMedia, false);
  const media = await c.mediaFor(['M1']);
  assert.equal(media.get('M1')[0].MediaURL, 'https://cdn.example.com/a');
  assert.match(h.calls.at(-1).url.searchParams.get('$filter'), /ResourceRecordKey eq 'M1'/);

  assert.deepEqual(fieldsNamedIn("Could not find a property named 'City'", ['City', 'CityRegion']), ['City']);
});

test('429 and 5xx back off (Retry-After when given), then succeed', async () => {
  resetPacing();
  const waits = [];
  let n = 0;
  const f = fakeFetch(() => {
    n += 1;
    if (n === 1) return json({ error: 'slow down' }, { status: 429, headers: { 'Retry-After': '7' } });
    if (n === 2) return json({ error: 'oops' }, { status: 503 });
    return json({ value: [rec('X1')] });
  });
  const a = createAdapter({ platform: 'spark', credentials: { access_token: 't' } }, { fetchImpl: f, sleep: async (ms) => { waits.push(ms); }, minIntervalMs: 0 });
  const rows = await a.preview(1);
  assert.equal(rows[0].ListingKey, 'X1');
  assert.deepEqual(waits, [7000, 15000]);
});

test('calls are paced per platform and credential, across adapters', async () => {
  resetPacing();
  const waits = [];
  const f = fakeFetch(() => json({ value: [] }));
  const mk = () => createAdapter({ platform: 'mlsgrid', config: { originating_system: 'mred' }, credentials: { access_token: 'shared' } }, { fetchImpl: f, sleep: async (ms) => { waits.push(ms); } });
  await mk().preview(1);
  await mk().preview(1);
  assert.equal(waits.length, 1, 'the second adapter on the same token waits');
  assert.ok(waits[0] > 500 && waits[0] <= PLATFORMS.mlsgrid.rate.min_interval_ms);
  assert.ok(PLATFORMS.mlsgrid.rate.min_interval_ms >= 500, 'MLS Grid: at most 2 requests a second');
});

test('credentials: AES-256-GCM round trip, tamper detection, hints that never show the secret', async () => {
  const creds = { access_token: 'abcd-1234-SECRET-tail9876', client_id: 'peak-client' };
  const stored = encryptSecret(creds);
  assert.match(stored, /^v1:/);
  assert.ok(!stored.includes('SECRET') && !stored.includes('tail9876'));
  assert.deepEqual(decryptSecret(stored), creds);
  assert.notEqual(encryptSecret(creds), stored, 'a fresh IV every time');
  const parts = stored.split(':');
  const flipped = Buffer.from(parts[3], 'base64');
  flipped[0] ^= 1;
  assert.throws(() => decryptSecret([parts[0], parts[1], parts[2], flipped.toString('base64')].join(':')));
  const otherKey = Buffer.alloc(32, 7);
  assert.throws(() => decryptSecret(stored, otherKey));
  const hints = credentialHints(creds);
  assert.deepEqual(hints.access_token, { saved: true, ending: '9876' });
  assert.ok(!JSON.stringify(hints).includes('SECRET'));
  assert.deepEqual(credentialHints({ short: 'abc' }).short, { saved: true, ending: null });

  // CREDENTIALS_KEY wins over the JWT_SECRET fallback.
  const fallback = credentialsKey();
  process.env.CREDENTIALS_KEY = 'a'.repeat(64);
  try {
    assert.deepEqual(credentialsKey(), Buffer.from('a'.repeat(64), 'hex'));
    assert.notDeepEqual(credentialsKey(), fallback);
  } finally {
    delete process.env.CREDENTIALS_KEY;
  }
});

test('catalog: searchable, sourced, and every entry names a known platform', () => {
  assert.ok(CATALOG.length >= 40);
  for (const e of CATALOG) {
    assert.ok(e.id.length <= 16, `${e.id} fits a feed key`);
    assert.ok(e.sources.length > 0, `${e.id} has a source`);
    assert.ok(e.platforms.length > 0 && e.platforms.every((p) => PLATFORMS[p.platform]), `${e.id} platforms`);
    assert.match(e.display.disclaimer, /\{brokerage\}/);
    assert.match(e.display.disclaimer, /\{updated\}/);
    for (const p of e.platforms.filter((x) => x.platform === 'mlsgrid')) assert.match(p.originating_system, /^[a-z0-9]+$/);
  }
  assert.equal(searchCatalog('mred')[0].id, 'mred');
  assert.equal(searchCatalog('Stellar')[0].id, 'mfrmls');
  assert.ok(searchCatalog('tx').some((e) => e.id === 'actris'));
  assert.ok(searchCatalog('unlock').some((e) => e.id === 'actris'));
  assert.equal(catalogEntry('ires').platforms[0].originating_system, 'ires');
  assert.equal(catalogEntry('recolorado').platforms[0].platform, 'bridge');
  assert.equal(catalogEntry('nope'), null);
});

test('the shared RESO mapping gives IRES exactly what it always did', () => {
  const raw = {
    ListingKey: 'IRE1001', ListingId: 'IRE1001', StandardStatus: 'Active Under Contract', PropertyType: 'Residential',
    PropertySubType: 'Townhouse', StreetNumber: '12', StreetName: 'Elm', StreetSuffix: 'St', City: 'Fort Collins',
    ListPrice: 450000, LivingArea: 1500, BedroomsTotal: 3, BathroomsTotalInteger: 2, Latitude: 40.5, Longitude: -105.1,
    PublicRemarks: 'Assumable loan!', MlgCanView: true,
    Media: [
      { MediaURL: 'https://media.mlsgrid.com/b.jpg?x=1', Order: 2 },
      { MediaURL: 'https://media.mlsgrid.com/a.jpeg', Order: 1 },
      { MediaURL: 'https://media.mlsgrid.com/doc.pdf', Order: 0 },
    ],
  };
  const l = normalizeResoListing(raw);
  assert.equal(l.listing_id, 'IRE1001');
  assert.equal(l.state, 'CO');
  assert.equal(l.mls_source, 'IRES');
  assert.equal(l.status, 'Active Under Contract');
  assert.equal(l.is_active, true);
  assert.equal(l.home_type, 'attached');
  assert.equal(l.street_name, 'Elm St');
  assert.equal(l.assumable, true);
  assert.equal(l.price_per_sqft, 300);
  assert.deepEqual(l.photos, ['https://media.mlsgrid.com/a.jpeg', 'https://media.mlsgrid.com/b.jpg?x=1']);
  assert.equal(l.slug, '12-elm-fort-collins-co-450000-RE1001');
  assert.equal(normalizeResoListing({ ...raw, MlgCanView: false }).is_active, false);

  // Another feed: prefixed id, its own state and source, extension-less photos.
  const { isPhotoMedia } = { isPhotoMedia: (m) => /^https:/.test(m.MediaURL) };
  const o = normalizeResoListing({ ...raw, Media: [{ MediaURL: 'https://api.example.com/media/1', Order: 1 }] }, {
    idPrefix: 'hicentral-', defaultState: 'HI', defaultSource: 'HiCentral', isPhoto: isPhotoMedia,
  });
  assert.equal(o.listing_id, 'hicentral-IRE1001');
  assert.equal(o.state, 'HI');
  assert.deepEqual(o.photos, ['https://api.example.com/media/1']);
  assert.match(o.slug, /-hicentral-/);
});
