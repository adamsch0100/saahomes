/**
 * MLS and IDX compliance: a brokerage shows only the listing feeds its MLS
 * approved, sample homes until then, and SAA's IRES feed never reaches
 * another brokerage's site. Every home carries its attribution.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-mls-feeds';
for (const k of ['OUTREACH_SMTP_HOST', 'OUTREACH_SMTP_USER', 'OUTREACH_SMTP_PASSWORD', 'RESEND_API_KEY']) delete process.env[k];

const PEAK = 'peak-realty.test';
const SAA = 'saahomes.com';
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let peakBuyer;
let saaBuyer;
let ires = [];
let as = {};

const q = (sql, p) => db.pool.query(sql, p);

async function call(method, path, { host = PEAK, auth, cookie, body } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(cookie ? { Cookie: `saa_user_token=${cookie}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function user(email, tenantId, role = 'client') {
  const { rows: [u] } = await q(
    `INSERT INTO users (email, name, role, status, manage_token, tenant_id)
     VALUES ($1, 'Pat Buyer', $2, 'active', $3, $4) RETURNING *`,
    [email, role, crypto.randomBytes(24).toString('hex'), tenantId]
  );
  return u;
}

async function clearCaches() {
  const { clearFeedCache } = await import('../src/services/feeds.js');
  const { clearTenantCache } = await import('../src/services/tenantContext.js');
  clearFeedCache();
  clearTenantCache();
}

async function setFeed(key, body) {
  const r = await call('PUT', `/platform/tenants/${peak.id}/feeds/${key}`, { auth: as.platform, body });
  assert.equal(r.status, 200, r.text);
  return r.json.data;
}

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  ({ rows: [peak] } = await q(
    "INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peak', 'Peak Realty', $1, $2) RETURNING *",
    [PEAK, JSON.stringify({ brand: { name: 'Peak Realty' } })]
  ));
  ires = [
    await insertListing(db.pool, { city: 'Fort Collins', list_office_name: 'Summit Brokers', list_office_mls_id: 'SUM1', list_agent_name: 'Sue Summit', list_agent_mls_id: 'A77' }),
    await insertListing(db.pool, { city: 'Loveland', postal_code: '80538', list_office_name: 'Valley Homes' }),
    await insertListing(db.pool, { city: 'Fort Collins', street_number: '42', street_name: 'Shared Way' }),
  ];
  peakBuyer = await user('pat@comcast.net', peak.id);
  saaBuyer = await user('sam@comcast.net', 1);
  const owner = await user('olive@peak-realty.test', peak.id, 'admin');
  const { generateToken } = await import('../src/middleware/auth.js');
  as = {
    platform: generateToken({ email: 'owner@platform.test', role: 'admin', platform: true }),
    owner: generateToken({ id: owner.id, email: owner.email, role: 'admin', tenant_id: peak.id }),
  };
  await clearCaches();
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('a brokerage waiting on its MLS sees only sample homes, clearly labeled', { skip }, async () => {
  const tenant = await call('GET', '/tenant');
  assert.equal(tenant.json.tenant.listings.mode, 'demo');

  const r = await call('GET', '/listings?limit=100');
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.meta.total >= 30, `sample homes for sale: ${r.json.meta.total}`);
  assert.ok(r.json.data.every((l) => l.feed === 'demo' && l.sample === true && l.courtesy === null));
  const ids = new Set(r.json.data.map((l) => l.listing_id));
  for (const l of ires) assert.ok(!ids.has(l.listing_id), 'no IRES home on another brokerage');

  // A real IRES listing doesn't exist here, by slug, MLS number or photo.
  assert.equal((await call('GET', `/listings/${ires[0].slug}`)).status, 404);
  assert.equal((await call('GET', `/listings/${ires[0].listing_id}`)).status, 404);
  assert.equal((await call('GET', `/photo/${ires[0].id}/0`)).status, 404);
  const loc = await call('GET', '/listings/locations?q=fort');
  assert.ok(loc.json.data.cities.every((c) => c.count < 10), 'counts are sample homes only');

  const sample = r.json.data[0];
  const d = await call('GET', `/listings/${sample.slug}`);
  assert.equal(d.status, 200);
  assert.equal(d.json.data.sample, true);
  assert.equal(d.json.data.attribution.sample, true);
  assert.match(d.json.data.attribution.disclaimer, /Peak Realty/);
  assert.match(d.json.data.attribution.disclaimer, /not for sale/);
  assert.doesNotMatch(d.json.data.attribution.disclaimer, /SAA|IRES/);

  const photo = await call('GET', `/photo/${sample.id}/0`);
  assert.equal(photo.status, 200);
  assert.match(photo.headers.get('content-type'), /svg/);
  assert.match(photo.text, /Sample listing/);
});

test('SAA never sees sample homes', { skip }, async () => {
  const r = await call('GET', '/listings?limit=100&city=__all__', { host: SAA });
  assert.equal(r.status, 200);
  assert.equal(r.json.meta.total, ires.length);
  assert.ok(r.json.data.every((l) => l.feed === 'ires' && l.sample === false));
  const withOffice = r.json.data.find((l) => l.listing_id === ires[0].listing_id);
  assert.equal(withOffice.courtesy, 'Listing courtesy of Summit Brokers');

  assert.equal((await call('GET', '/listings/DEMO-1001', { host: SAA })).status, 404);
  const { rows: [demo] } = await q("SELECT id FROM listings WHERE listing_id = 'DEMO-1001'");
  assert.equal((await call('GET', `/photo/${demo.id}/0`, { host: SAA })).status, 404);
  const stats = await call('GET', '/listings/stats', { host: SAA });
  assert.equal(stats.json.data.total, ires.length);

  const d = await call('GET', `/listings/${ires[0].slug}`, { host: SAA });
  assert.equal(d.status, 200);
  assert.equal(d.json.data.attribution.courtesy, 'Listing courtesy of Summit Brokers');
  assert.equal(d.json.data.list_agent_name, 'Sue Summit');
  assert.match(d.json.data.attribution.disclaimer, /IRES/);
});

test('saved homes and alerts stay inside the brokerage\'s feeds', { skip }, async () => {
  const cookie = peakBuyer.manage_token;
  assert.equal((await call('POST', '/saved-homes', { cookie, body: { listing_key: ires[0].listing_id } })).status, 404);
  const saved = await call('POST', '/saved-homes', { cookie, body: { listing_key: 'DEMO-1002' } });
  assert.equal(saved.status, 201, saved.text);
  assert.equal(saved.json.data.sample, true);
  const list = await call('GET', '/saved-homes', { cookie });
  assert.deepEqual(list.json.data.homes.map((h) => [h.listing_key, h.sample, h.off_market]), [['DEMO-1002', true, false]]);

  const { runSearch } = await import('../src/services/alertDigest.js');
  const { rows: [search] } = await q(
    `INSERT INTO saved_searches (user_id, name, filters, tenant_id) VALUES ($1, 'Everything', '{}', $2) RETURNING *`,
    [peakBuyer.id, peak.id]
  );
  const sent = [];
  const r = await runSearch({ ...search, manage_token: peakBuyer.manage_token }, {
    send: async (to, subject, html) => { sent.push({ to, subject, html }); },
  });
  assert.equal(r.sent, true);
  const html = sent[0].html;
  assert.match(html, /Sample listing/);
  assert.match(html, /These are sample homes so you can try Peak Realty/);
  for (const l of ires) assert.ok(!html.includes(l.slug), 'no IRES home in a demo brokerage\'s alert');
  assert.doesNotMatch(html, /Listing data provided by IRES/);
});

test('approving IRES switches the brokerage to live IRES listings, with attribution', { skip }, async () => {
  const data = await setFeed('ires', { status: 'approved', office_mls_id: 'PK1', sold_enabled: false });
  assert.equal(data.mode, 'live');
  assert.equal(data.headline, 'Live: IRES');
  assert.equal(data.log[0].changed_by, 'owner@platform.test');
  assert.deepEqual(data.log[0].changes.status, { from: null, to: 'approved' });

  const r = await call('GET', '/listings?limit=100&city=__all__');
  assert.equal(r.json.meta.total, ires.length);
  assert.ok(r.json.data.every((l) => l.feed === 'ires'));
  const d = await call('GET', `/listings/${ires[0].slug}`);
  assert.equal(d.status, 200);
  assert.equal(d.json.data.attribution.courtesy, 'Listing courtesy of Summit Brokers');
  assert.equal(d.json.data.attribution.agent, 'Sue Summit');
  assert.equal(d.json.data.list_office_mls_id, 'SUM1');
  assert.match(d.json.data.attribution.disclaimer, /displayed by Peak Realty/);
  assert.equal((await call('GET', '/listings/DEMO-1001')).status, 404, 'sample homes gone once live');

  // The sample home saved earlier is no longer available here.
  const list = await call('GET', '/saved-homes', { cookie: peakBuyer.manage_token });
  assert.equal(list.json.data.homes[0].off_market, true);

  const settings = await call('GET', '/admin/settings', { auth: as.owner });
  assert.equal(settings.json.data.listings.mode, 'live');
  assert.equal(settings.json.data.listings.headline, 'Live: IRES');
  const tenant = await call('GET', '/tenant');
  assert.equal(tenant.json.tenant.listings.mode, 'live');

  // SAA's own feed can't be switched off from the console.
  const bad = await call('PUT', '/platform/tenants/1/feeds/ires', { auth: as.platform, body: { status: 'suspended' } });
  assert.equal(bad.status, 400);
  // And the owner can't approve their own feed.
  assert.equal((await call('PUT', `/platform/tenants/${peak.id}/feeds/ires`, { auth: as.owner, body: { status: 'approved' } })).status, 403);
});

test('sold data shows only when sold is on for that feed', { skip }, async () => {
  for (let i = 0; i < 5; i += 1) {
    await q(
      `INSERT INTO sold_listings (listing_id, city, postal_code, street_number, street_name, beds, baths, living_area,
         sold_price, closed_date, list_office_name)
       VALUES ($1, 'Fort Collins', '80521', $2, 'Sold St', 3, 2, $3, $4, CURRENT_DATE - 30, 'Summit Brokers')`,
      [`SOLD${i}`, String(10 + i), 1900 + i * 40, 470000 + i * 8000]
    );
  }
  await insertListing(db.pool, { status: 'Sold', is_active: false, city: 'Fort Collins' });
  const { rows: [home] } = await q(
    `INSERT INTO home_profiles (user_id, address_line, city, postal_code, beds, baths, living_area, tenant_id)
     VALUES ($1, '5 Home Ct', 'Fort Collins', '80521', 3, 2, 2000, $2) RETURNING id`,
    [peakBuyer.id, peak.id]
  );
  const cookie = peakBuyer.manage_token;

  // Sold off for Peak: no sales, no sold history, no comps.
  assert.equal((await call('GET', '/sold-listings?zip=80521')).json.count, 0);
  assert.equal((await call('GET', '/listings?status=Sold&city=__all__')).json.meta.total, 0);
  let comps = await call('GET', `/home/${home.id}/comps`, { cookie });
  assert.equal(comps.status, 200, comps.text);
  assert.equal(comps.json.data.comps.length, 0);
  // SAA keeps its sold data.
  assert.equal((await call('GET', '/sold-listings?zip=80521', { host: SAA })).json.count, 5);

  await setFeed('ires', { sold_enabled: true });
  assert.equal((await call('GET', '/sold-listings?zip=80521')).json.count, 5);
  assert.equal((await call('GET', '/listings?status=Sold&city=__all__')).json.meta.total, 1);
  comps = await call('GET', `/home/${home.id}/comps`, { cookie });
  assert.equal(comps.json.data.comps.length, 5);
});

test('service areas set the default search; other towns are still a search away', { skip }, async () => {
  const r = await call('PATCH', '/admin/settings', { auth: as.owner, body: { service_areas: ['Loveland', '<script>'] } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.data.listings.service_areas, ['Loveland']);
  await clearCaches();
  const def = await call('GET', '/listings?city=__noco__');
  assert.deepEqual(def.json.data.map((l) => l.city), ['Loveland']);
  const fc = await call('GET', '/listings?city=Fort%20Collins');
  assert.ok(fc.json.meta.total >= 2);
  // Counties work too.
  await call('PUT', `/platform/tenants/${peak.id}/service-areas`, { auth: as.platform, body: { service_areas: ['Larimer County'] } });
  await q("UPDATE listings SET county = 'Larimer' WHERE feed = 'ires'");
  await clearCaches();
  assert.equal((await call('GET', '/listings?city=__noco__')).json.meta.total, ires.length);
  await call('PUT', `/platform/tenants/${peak.id}/service-areas`, { auth: as.platform, body: { service_areas: [] } });
  await clearCaches();
});

test('a home two feeds carry shows once, from the brokerage\'s first feed', { skip }, async () => {
  await q(`INSERT INTO mls_feeds (key, name, vendor, disclaimer, courtesy_required)
           VALUES ('front', 'Front Range MLS', 'Test', 'Front Range data for {brokerage}.', TRUE)`);
  await clearCaches();
  await setFeed('front', { status: 'approved' });
  const dupe = await insertListing(db.pool, {
    feed: 'front', street_number: '42', street_name: 'Shared Way', city: 'Fort Collins', list_office_name: 'Front Office',
  });
  const own = await insertListing(db.pool, { feed: 'front', street_number: '7', street_name: 'Only Here Rd', city: 'Fort Collins' });
  await clearCaches();
  const r = await call('GET', '/listings?limit=100&city=__all__');
  const ids = r.json.data.map((l) => l.listing_id);
  assert.ok(ids.includes(ires[2].listing_id), 'IRES copy (first feed) shown');
  assert.ok(!ids.includes(dupe.listing_id), 'second feed\'s copy hidden');
  assert.ok(ids.includes(own.listing_id), 'homes only the second feed has still show');
  // SAA is not approved on that feed.
  const saa = await call('GET', '/listings?limit=100&city=__all__', { host: SAA });
  assert.ok(!saa.json.data.some((l) => l.feed === 'front'));
});

test('suspending a feed hides its listings straight away', { skip }, async () => {
  await setFeed('front', { status: 'suspended' });
  const data = await setFeed('ires', { status: 'suspended' });
  assert.equal(data.mode, 'demo');
  assert.deepEqual(data.suspended.sort(), ['Front Range MLS', 'IRES']);
  assert.equal((await call('GET', `/listings/${ires[0].slug}`)).status, 404);
  const r = await call('GET', '/listings?limit=100&city=__all__');
  assert.ok(r.json.data.every((l) => l.feed === 'demo'));
  const sold = await call('GET', '/sold-listings?zip=80521');
  assert.ok(sold.json.listings.every((l) => l.listing_id.startsWith('DEMO-')), 'back to sample sales only');
});

test('the sync asks for office and agent fields and carries on without them if refused', async () => {
  const { OFFICE_FIELDS, rejectsOfficeFields } = await import('../src/services/iresSync.js');
  assert.deepEqual(OFFICE_FIELDS, ['ListOfficeName', 'ListOfficeMlsId', 'ListAgentFullName', 'ListAgentMlsId']);
  assert.equal(rejectsOfficeFields(400, 'Invalid $select field: ListAgentMlsId'), true);
  assert.equal(rejectsOfficeFields(400, 'Invalid filter'), false);
  assert.equal(rejectsOfficeFields(500, 'ListOfficeName'), false);
});
