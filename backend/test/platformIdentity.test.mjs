/**
 * The platform is its own product, apart from SAA: its identity comes from
 * env and the platform console, its marketing site answers on its own domain
 * only, its mail and DNS guidance carry its own name and addresses, and a
 * brokerage's pages never carry SAA's. SAA's own site is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-platform-identity';
process.env.PLATFORM_NAME = 'Brokerkit';
process.env.PLATFORM_MARKETING_DOMAIN = 'brokerkit.test';
process.env.PLATFORM_SUPPORT_EMAIL = 'help@brokerkit.test';
process.env.PLATFORM_FROM_EMAIL = 'hello@brokerkit.test';
process.env.PLATFORM_CNAME_TARGET = 'edge.brokerkit.test';
process.env.PLATFORM_LEGAL_NAME = 'Brokerkit, Inc.';
process.env.SIGNUP_RATE_LIMIT = '100';
// Railway names the service after SAA; it must never reach a brokerage.
process.env.RAILWAY_PUBLIC_DOMAIN = 'saahomes-production.up.railway.app';
for (const k of ['OUTREACH_SMTP_HOST', 'OUTREACH_SMTP_USER', 'OUTREACH_SMTP_PASSWORD', 'RESEND_API_KEY', 'PLATFORM_BASE_DOMAIN', 'PLATFORM_DOMAIN', 'PRODUCT_NAME']) {
  delete process.env[k];
}

const SAA_STRINGS = /saahomes|SAA Homes|\bSAA\b|999-1407|Schwartz|CFB36E|Northern Colorado|Fort Collins|\bAdam\b|\bMandi\b/i;
const MARKETING = 'brokerkit.test';
const SAA = 'saahomes.com';
const PEAK = 'peak-realty.test';
const skip = !hasTestDatabase;

// SAA's built shell, trimmed: everything a brokerage's head must drop.
const SAA_INDEX = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Schwartz and Associates | Northern Colorado Real Estate</title>
    <meta name="description" content="SAA Homes helps buyers in Fort Collins. Call (970) 999-1407." />
    <link rel="canonical" href="https://saahomes.com/" />
    <link rel="icon" href="/icons/icon-192.png" />
    <meta property="og:site_name" content="Schwartz and Associates" />
    <script type="application/ld+json">{"@type":"RealEstateAgent","name":"Schwartz and Associates"}</script>
    <script>gtag('config','G-SAA')</script>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="stylesheet" href="/assets/index-abc.css" />
  </head>
  <body><div id="root"><h1>Adam Schwartz, Realtor</h1></div></body>
</html>`;

let db;
let server;
let srv;
let platform;
let peak;
let lone; // a brokerage with no address of its own
let tokens = {};

async function call(method, path, { host = SAA, body, auth } = {}) {
  const res = await fetch(`${server.url}${path}`, {
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
  return { status: res.status, json, text, type: res.headers.get('content-type') || '' };
}

/** Run fn with some env vars changed, then put them back. */
async function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test.before(async () => {
  platform = await import('../src/services/platform.js');
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  ({ rows: [peak] } = await db.pool.query(
    `INSERT INTO tenants (slug, name, primary_domain, settings) VALUES ('peak', 'Peak Realty', $1, $2) RETURNING *`,
    [PEAK, JSON.stringify({ brand: { primary_color: '#0b5394', market_name: 'Boise' } })]
  ));
  ({ rows: [lone] } = await db.pool.query(
    "INSERT INTO tenants (slug, name, settings) VALUES ('lone-pine', 'Lone Pine Realty', $1) RETURNING *",
    [JSON.stringify({ brand: { name: 'Lone Pine Realty', primary_color: '#14532d' } })]
  ));
  const { rows: [owner] } = await db.pool.query(
    `INSERT INTO users (email, name, role, status, manage_token, tenant_id)
     VALUES ('olive@peak-realty.test', 'Olive Owner', 'admin', 'active', $1, $2) RETURNING *`,
    [crypto.randomBytes(24).toString('hex'), peak.id]
  );
  server = await startTestServer();
  srv = await import('../src/server.js');
  const { generateToken } = await import('../src/middleware/auth.js');
  tokens = {
    platform: generateToken({ email: 'owner@platform.test', role: 'admin', platform: true }),
    owner: generateToken({ id: owner.id, email: owner.email, role: 'admin', tenant_id: peak.id }),
  };
});

test.after(async () => {
  await server?.close();
  await db?.drop();
});

// ─────────────────────────────────────────────────────── identity

test('the identity comes from env, with defaults that keep SAA as it is', async () => {
  const id = platform.platformIdentity();
  assert.equal(id.name, 'Brokerkit');
  assert.equal(id.short_name, 'Brokerkit');
  assert.equal(id.legal_name, 'Brokerkit, Inc.');
  assert.equal(id.marketing_domain, MARKETING);
  assert.equal(id.marketing_url, 'https://brokerkit.test');
  assert.equal(id.support_email, 'help@brokerkit.test');
  assert.equal(id.from_email, 'hello@brokerkit.test');
  assert.equal(id.cname_target, 'edge.brokerkit.test');

  // Nothing set: the product keeps today's name, and has no domains of its own.
  const blank = Object.fromEntries([
    'PLATFORM_NAME', 'PLATFORM_MARKETING_DOMAIN', 'PLATFORM_SUPPORT_EMAIL', 'PLATFORM_FROM_EMAIL',
    'PLATFORM_CNAME_TARGET', 'PLATFORM_LEGAL_NAME',
  ].map((k) => [k, undefined]));
  await withEnv(blank, () => {
    const d = platform.platformIdentity();
    assert.equal(d.name, 'SAA Homes for Brokerages');
    assert.equal(d.short_name, 'SAA Homes');
    assert.equal(d.marketing_domain, null);
    assert.equal(d.support_email, null);
    assert.equal(d.from_email, null);
    assert.equal(d.cname_target, null, 'never the Railway hostname named after SAA');
    assert.equal(platform.isPlatformHost(SAA), false);
  });
  // PRODUCT_NAME still renames it, and saahomes.com can never be the marketing site.
  await withEnv({ PLATFORM_NAME: undefined, PRODUCT_NAME: 'Old Name', PLATFORM_MARKETING_DOMAIN: 'www.saahomes.com' }, () => {
    assert.equal(platform.platformIdentity().name, 'Old Name');
    assert.equal(platform.platformIdentity().marketing_domain, null);
  });
});

test('GET /api/platform answers on any host, without the sending address', { skip }, async () => {
  const r = await call('GET', '/api/platform', { host: MARKETING });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.name, 'Brokerkit');
  assert.equal(r.json.data.support_email, 'help@brokerkit.test');
  assert.equal(r.json.data.start_path, '/start');
  assert.equal(r.json.data.is_platform_host, true);
  assert.equal('from_email' in r.json.data, false);
  assert.equal((await call('GET', '/api/platform', { host: `www.${MARKETING}` })).json.data.is_platform_host, true);
  assert.equal((await call('GET', '/api/platform', { host: SAA })).json.data.is_platform_host, false);
  assert.equal((await call('GET', '/api/platform', { host: PEAK })).json.data.is_platform_host, false);
});

test('the platform owner renames the product in the console; nobody else can', { skip }, async () => {
  assert.equal((await call('GET', '/api/platform/settings', { auth: tokens.owner, host: PEAK })).status, 403);
  assert.equal((await call('PUT', '/api/platform/settings', { auth: tokens.owner, host: PEAK, body: { name: 'Hijack' } })).status, 403);

  const view = await call('GET', '/api/platform/settings', { auth: tokens.platform });
  assert.equal(view.status, 200, view.text);
  const nameField = view.json.data.fields.find((f) => f.key === 'name');
  assert.deepEqual([nameField.value, nameField.source, nameField.env], ['Brokerkit', 'env', 'PLATFORM_NAME']);

  assert.equal((await call('PUT', '/api/platform/settings', { auth: tokens.platform, body: { marketing_domain: 'saahomes.com' } })).status, 400);
  assert.equal((await call('PUT', '/api/platform/settings', { auth: tokens.platform, body: { accent_color: 'blue' } })).status, 400);
  assert.equal((await call('PUT', '/api/platform/settings', { auth: tokens.platform, body: { support_email: 'nope' } })).status, 400);

  const put = await call('PUT', '/api/platform/settings', {
    auth: tokens.platform, body: { name: 'Hearth Pro', accent_color: '#0f766e' },
  });
  assert.equal(put.status, 200, put.text);
  assert.equal(put.json.data.identity.name, 'Hearth Pro');
  assert.equal((await call('GET', '/api/platform', { host: MARKETING })).json.data.name, 'Hearth Pro');
  assert.equal((await call('GET', '/api/signup/info', { host: MARKETING })).json.product_name, 'Hearth Pro');

  // Saved in the database, not just this process.
  platform.resetPlatformIdentityCache();
  assert.equal(platform.platformIdentity().name, 'Brokerkit');
  await platform.refreshPlatformIdentity({ force: true });
  assert.equal(platform.platformIdentity().name, 'Hearth Pro');
  assert.equal(platform.platformIdentity().accent_color, '#0f766e');

  // Clearing goes back to env.
  const cleared = await call('PUT', '/api/platform/settings', { auth: tokens.platform, body: { name: '', accent_color: null } });
  assert.equal(cleared.json.data.identity.name, 'Brokerkit');
  assert.equal(cleared.json.data.fields.find((f) => f.key === 'name').source, 'env');
});

// ─────────────────────────────────────────────────── marketing site

test('the marketing page answers on the marketing domain only', { skip }, async () => {
  for (const host of [MARKETING, `www.${MARKETING}`]) {
    const r = await call('GET', '/', { host });
    assert.equal(r.status, 200, `${host}: ${r.text.slice(0, 200)}`);
    assert.match(r.type, /html/);
    assert.match(r.text, /<title>Brokerkit: home search, CRM and AI follow-up for brokerages<\/title>/);
    assert.match(r.text, /href="\/start"[^>]*>Start free trial/);
    assert.match(r.text, /id="features"/);
    assert.match(r.text, /id="compare"/);
    assert.match(r.text, /id="pricing"/);
    assert.match(r.text, /14-day free trial on every plan/);
    assert.match(r.text, /href="\/start\?plan=team"/);
    assert.match(r.text, /<link rel="canonical" href="https:\/\/brokerkit\.test\/">/);
    assert.match(r.text, /help@brokerkit\.test/);
    assert.match(r.text, /Brokerkit, Inc\./);
    const leak = r.text.match(SAA_STRINGS);
    assert.equal(leak, null, `no SAA on the marketing page (found "${leak?.[0]}")`);
  }

  // Its own files, and nothing of SAA's site.
  const robots = await call('GET', '/robots.txt', { host: MARKETING });
  assert.match(robots.text, /Sitemap: https:\/\/brokerkit\.test\/sitemap\.xml/);
  assert.match(robots.text, /Disallow: \/admin/);
  assert.match((await call('GET', '/sitemap.xml', { host: MARKETING })).text, /<loc>https:\/\/brokerkit\.test\/start\/<\/loc>/);
  const manifest = await call('GET', '/manifest.webmanifest', { host: MARKETING });
  assert.equal(manifest.json.name, 'Brokerkit');
  assert.match((await call('GET', '/favicon.svg', { host: MARKETING })).text, />B</);
  for (const path of ['/blog/', '/northern-colorado-areas/fort-collins/', '/properties/', '/embed/search', '/embed.js', '/sitemap-listings.xml']) {
    const r = await call('GET', path, { host: MARKETING });
    assert.equal(r.status, 404, `${path} is not on the marketing site`);
    assert.doesNotMatch(r.text, SAA_STRINGS, `${path}: the platform's own 404`);
  }

  // SAA's domain and a brokerage's domain never get it.
  for (const host of [SAA, `www.${SAA}`, PEAK]) {
    const r = await call('GET', '/', { host });
    assert.doesNotMatch(r.text, /Start free trial|Brokerkit/, `${host} keeps its own home page`);
    assert.doesNotMatch((await call('GET', '/robots.txt', { host })).text, /brokerkit/i);
  }
});

test('the marketing page stands alone: the plans when they load, the trial offer otherwise, nothing to wait for', async () => {
  const { renderPlatformHome } = await import('../src/services/platformSite.js');
  const { loadPlanCatalog, publicCatalog } = await import('../src/services/plans.js');
  const html = renderPlatformHome(platform.platformIdentity(), { trialDays: 21 });
  assert.match(html, /Start free for 21 days/);
  assert.match(html, /21 days free\. No card to start\./);
  const priced = renderPlatformHome(platform.platformIdentity(), { trialDays: 21, catalog: publicCatalog(await loadPlanCatalog()) });
  assert.match(priced, /\$699<small> \/ month<\/small>/);
  assert.match(priced, /25 agents included, then \$15 per agent/);
  assert.match(priced, /href="\/start\?plan=brokerage"/);
  assert.match(priced, /Pay yearly and get 2 months free/);
  assert.doesNotMatch(priced, /<script(?! type="application\/ld\+json")/, 'no script needed for prices');
  // Fast: one request, no web fonts or framework.
  assert.doesNotMatch(html, /fonts\.googleapis|<script[^>]+src=/);
  assert.ok(html.length < 40000, `small page (${html.length} bytes)`);
  assert.match(html, /<a class="skip" href="#main">/);
  assert.match(html, /<html lang="en">/);
});

// ─────────────────────────────────────────── brokerage pages, no SAA

test("a brokerage's pages carry its head on every path, never SAA's", async () => {
  srv = srv || await import('../src/server.js');
  const { brandFor } = await import('../src/services/brand.js');
  const brand = brandFor({
    id: 2, slug: 'peak', name: 'Peak Realty', primary_domain: PEAK,
    settings: { brand: { primary_color: '#0b5394', market_name: 'Boise' } },
  });
  const paths = ['/', '/contact/', '/properties/', '/homes-for-sale/123-main-st/', '/alerts/manage/', '/my-saved-searches/',
    '/my-home/', '/notifications/', '/board/', '/mortgage-calculator/', '/admin/', '/agent/', '/reset-password/',
    '/embed/search', '/embed/listing/123-main-st', '/blog/', '/northern-colorado-areas/fort-collins/'];
  for (const path of paths) {
    const html = srv.renderBrokerageShell(SAA_INDEX, brand, path);
    assert.match(html, /<title>Peak Realty/, path);
    assert.match(html, /<meta name="theme-color" content="#0b5394" \/>/, path);
    assert.match(html, /\/assets\/index-abc\.js/, `${path}: the app still loads`);
    const leak = html.match(SAA_STRINGS) || html.match(/og:|canonical|ld\+json|G-SAA|\/icons\/icon-192/);
    assert.equal(leak, null, `${path}: no SAA head (found "${leak?.[0]}")`);
  }
  // The manifest and icon are Peak's.
  assert.doesNotMatch(JSON.stringify(srv.buildBrokerageManifest(brand)), SAA_STRINGS);
});

test("platform pages (/start, a console) wear the platform's identity", async () => {
  srv = srv || await import('../src/server.js');
  const { platformShellBrand } = await import('../src/services/platformSite.js');
  const html = srv.renderBrokerageShell(SAA_INDEX, platformShellBrand(), '/start', { platformHost: MARKETING, robots: 'index, follow' });
  assert.match(html, /<title>Brokerkit<\/title>/);
  assert.match(html, /<meta name="robots" content="index, follow" \/>/);
  const json = JSON.parse(html.match(/<script id="platform-identity" type="application\/json">([^<]+)<\/script>/)[1]);
  assert.equal(json.name, 'Brokerkit');
  assert.equal(json.is_platform_host, true);
  assert.equal('from_email' in json, false);
  assert.doesNotMatch(html, SAA_STRINGS);
  // A brokerage's own page never carries the platform's identity.
  assert.doesNotMatch(srv.renderBrokerageShell(SAA_INDEX, { name: 'Peak Realty' }, '/'), /platform-identity/);
});

test('a brokerage with no address yet gets links on the platform site, never saahomes.com', async () => {
  const ctx = await import('../src/services/tenantContext.js');
  const t = { id: 9, slug: 'lone-pine', name: 'Lone Pine Realty', settings: {} };
  assert.equal(ctx.siteUrlFor(t), 'https://brokerkit.test');
  assert.equal(ctx.consoleUrlFor(t, '/admin'), 'https://brokerkit.test/admin?brokerage=lone-pine');
  // SAA's own links are as before.
  assert.equal(ctx.siteUrlFor({ id: 1, slug: 'saa', name: 'SAA Homes' }), 'https://saahomes.com');
  // With a subdomain base, the brokerage's free address wins.
  await withEnv({ PLATFORM_BASE_DOMAIN: 'sites.brokerkit.test' }, () => {
    assert.equal(ctx.siteUrlFor(t), 'https://lone-pine.sites.brokerkit.test');
  });
});

test("a console on the platform site wears its brokerage's brand (?brokerage=)", { skip }, async () => {
  const r = await call('GET', '/api/tenant?brokerage=lone-pine', { host: MARKETING });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.tenant.slug, 'lone-pine');
  assert.equal(r.json.tenant.brand.brandName, 'Lone Pine Realty');
  // Only on the platform's host: a brokerage's own domain stays its own.
  assert.equal((await call('GET', '/api/tenant?brokerage=lone-pine', { host: PEAK })).json.tenant.slug, 'peak');
  // SAA's host without it is unchanged.
  assert.equal((await call('GET', '/api/tenant', { host: SAA })).json.tenant, null);
  assert.equal((await call('GET', '/api/tenant?brokerage=saa', { host: SAA })).json.tenant, null);
});

// ─────────────────────────────────────────────────────── DNS target

test('the CNAME target is the platform’s own, from env, with a sensible fallback', async () => {
  const rd = await import('../src/services/railwayDomains.js');
  assert.equal(rd.cnameTarget(), 'edge.brokerkit.test');
  await withEnv({ PLATFORM_CNAME_TARGET: undefined, PLATFORM_BASE_DOMAIN: 'sites.brokerkit.test' }, () => {
    assert.equal(rd.cnameTarget(), 'cname.sites.brokerkit.test');
  });
  await withEnv({ PLATFORM_CNAME_TARGET: undefined }, () => {
    assert.equal(rd.cnameTarget(), null, 'no target rather than the SAA-named Railway host');
    assert.deepEqual(rd.displayDnsRecords({ records: [{ type: 'CNAME', name: 'www', value: 'saahomes-production.up.railway.app' }] }), []);
  });

  // Saved before the platform had its own target: shown with today's.
  const stale = rd.displayDnsRecords({ records: [{ type: 'CNAME', name: 'www', value: 'saahomes-production.up.railway.app', status: 'unknown' }] });
  assert.deepEqual(stale, [{ type: 'CNAME', name: 'www', value: 'edge.brokerkit.test', status: 'unknown' }]);

  // Railway's own answer: its hostname swapped for the platform's target.
  const records = rd.recordsFor('www.peak.test', {
    certificateStatus: 'CERTIFICATE_STATUS_TYPE_ISSUED',
    verificationToken: 'tok',
    dnsRecords: [{ hostlabel: 'www', requiredValue: 'abc123.up.railway.app', currentValue: 'edge.brokerkit.test.', status: 'DNS_RECORD_STATUS_PROPAGATED' }],
  });
  assert.equal(records[0].value, 'edge.brokerkit.test');
  assert.equal(records[0].status, 'valid');
  assert.doesNotMatch(JSON.stringify(records), /railway\.app|saahomes/);
});

test("a brokerage's domain settings show the platform's target", { skip }, async () => {
  const set = await call('POST', '/api/admin/settings/domain', { host: PEAK, auth: tokens.owner, body: { domain: 'peakhomes-own.test' } });
  assert.equal(set.status, 200, set.text);
  assert.deepEqual(set.json.data.dns.map((r) => r.value), ['edge.brokerkit.test']);
  assert.doesNotMatch(set.text, /saahomes|railway/i);
  await db.pool.query('UPDATE tenants SET primary_domain = $1 WHERE id = $2', [PEAK, peak.id]);
  (await import('../src/services/tenantContext.js')).clearTenantCache();
});

// ───────────────────────────────────────────────────── platform mail

test('platform mail comes from the platform: its name, sender and support', { skip }, async () => {
  const emailer = await import('../src/services/emailer.js');
  assert.deepEqual(emailer.platformFrom(), { from: '"Brokerkit" <hello@brokerkit.test>', replyTo: 'help@brokerkit.test' });
  // A brokerage without its own sending domain sends from the platform's address, not SAA's.
  assert.equal(emailer.sharedFromAddress(), 'hello@brokerkit.test');
  // Without one set, the shared sender as before.
  await withEnv({ PLATFORM_FROM_EMAIL: undefined }, () => {
    assert.notEqual(emailer.sharedFromAddress(), 'hello@brokerkit.test');
    assert.match(emailer.platformFrom().from, /^"Brokerkit" </);
  });

  // A brokerage signs up on the marketing site: the confirm email is the platform's.
  const body = {
    brokerage_name: 'Cedar Creek Homes', name: 'Casey Cedar', email: 'casey@cedar.test', phone: '2085550100',
    password: 'cedar-creek-pass', city: 'Boise, ID', website: '', elapsed_ms: 5000,
  };
  const r = await call('POST', '/api/signup', { host: MARKETING, body });
  assert.equal(r.status, 201, r.text);
  // No subdomain base: the console lives on the platform's site.
  assert.equal(r.json.data.console_url, 'https://brokerkit.test/admin?brokerage=cedar-creek-homes');
  const { rows: [mail] } = await db.pool.query("SELECT * FROM email_outbox WHERE to_email = 'casey@cedar.test' ORDER BY id DESC LIMIT 1");
  assert.equal(mail.platform, true);
  assert.match(mail.subject, /Confirm your email for Cedar Creek Homes/);
  assert.match(mail.html, /Welcome to Brokerkit\. Cedar Creek Homes is set up\./);
  assert.match(mail.html, /https:\/\/brokerkit\.test\/admin\?confirm=[A-Za-z0-9_-]+&amp;brokerage=cedar-creek-homes/);
  assert.match(mail.html, /help@brokerkit\.test/);
  const leak = mail.html.match(SAA_STRINGS);
  assert.equal(leak, null, `no SAA in platform mail (found "${leak?.[0]}")`);

  // Agents' invites still come from the brokerage, in its name.
  const { issueAccountLink } = await import('../src/services/accountLinks.js');
  const { rows: [agent] } = await db.pool.query(
    `INSERT INTO users (email, name, role, status, manage_token, tenant_id) VALUES ('ava@peak-realty.test', 'Ava Agent', 'agent', 'active', $1, $2) RETURNING *`,
    [crypto.randomBytes(24).toString('hex'), peak.id]
  );
  await issueAccountLink({ user: agent, purpose: 'invite', tenant: { ...peak, id: Number(peak.id) }, pool: db.pool });
  const { rows: [invite] } = await db.pool.query("SELECT * FROM email_outbox WHERE to_email = 'ava@peak-realty.test' ORDER BY id DESC LIMIT 1");
  assert.equal(invite.platform, false);
  assert.match(invite.subject, /You're invited to Peak Realty/);
  assert.doesNotMatch(invite.html, /Brokerkit/);
});

// ─────────────────────────────────────────────── SAA stays as it is

test("SAA's site, mail and signup info are unchanged", { skip }, async () => {
  const { brandFor, SAA_BRAND } = await import('../src/services/brand.js');
  const saa = brandFor({ id: 1, slug: 'saa', name: 'SAA Homes' });
  for (const k of ['name', 'legal_name', 'phone', 'email', 'primary_color', 'accent_color']) assert.equal(saa[k], SAA_BRAND[k]);
  assert.equal(saa.site_url, 'https://saahomes.com');

  // No marketing page, platform icon or 404 of the platform's on SAA's domain.
  const home = await call('GET', '/', { host: SAA });
  assert.doesNotMatch(home.text, /Brokerkit/);
  const blog = await call('GET', '/blog/', { host: SAA });
  assert.doesNotMatch(blog.text, /Brokerkit/);

  // SAA's agents keep their DNS check wording; another brokerage's agents get a neutral one.
  const { txtRecordValue } = await import('../src/services/tenantDomain.js');
  assert.equal(txtRecordValue('abc'), 'saa-verify=abc');
  assert.equal(txtRecordValue('abc', { home: false }), 'site-verify=abc');

  // SAA's 10DLC kit keeps its samples; another brokerage's sit in its own market.
  const { registrationKit } = await import('../src/services/smsService.js');
  assert.match(registrationKit({ id: 1, slug: 'saa', name: 'SAA Homes' }, { consentWording: 'ok' }).samples[0], /Fort Collins/);
  const peakKit = JSON.stringify(registrationKit({ ...peak, id: Number(peak.id) }, { consentWording: 'ok' }));
  assert.match(peakKit, /Boise/);
  assert.doesNotMatch(peakKit, SAA_STRINGS);
});
