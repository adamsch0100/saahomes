/**
 * Another brokerage's site is its own: page shell, app manifest and icon,
 * Nadia, and where its leads go in Follow Up Boss. SAA stays exactly as it was.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-branded-site';
// Read by the Follow Up Boss service when it loads (imported below).
process.env.FOLLOW_UP_BOSS_API_KEY = 'saa-env-key';
delete process.env.FOLLOW_UP_BOSS_WEBHOOK_URL;
process.env.SAA_SERVER_NO_START = '1';

const SAA_WORDS = /SAA Homes|saahomes\.com|Schwartz|Adam|Mandi|Northern Colorado|970\) 999|CFB36E|G-CB5GL0P3EZ/i;
// sha256 of Nadia's SAA system prompt, taken before brands existed.
const SAA_PROMPT_SHA256 = '8b395f19eb67485a9fc9e0543f499e0cee4f66b858db836e122ae0c13b328920';

// A trimmed copy of the built index.html: SAA's real head tags and
// prerendered homepage body.
const FAKE_INDEX = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#000000" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="SAA Homes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <meta name="robots" content="index, follow" />
    <title>Adam Schwartz, Realtor | Schwartz and Associates</title>
    <meta name="description" content="Adam Schwartz, Realtor at Schwartz and Associates, Coldwell Banker Realty — serving Fort Collins, Loveland, Windsor, Greeley and all of Northern Colorado." />
      <link rel="canonical" href="https://saahomes.com/" />
    <!-- Preconnect to external domains for performance -->
    <link rel="preconnect" href="https://www.googletagmanager.com" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
    <!-- Google tag (gtag.js) — saahomes.com web stream -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-CB5GL0P3EZ"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-CB5GL0P3EZ');
    </script>
    <style>
      .prerendered-blog-meta strong { color: #CFB36E; font-weight: 600; }
    </style>
    <script type="module" crossorigin src="/assets/index-0d8a8f0e.js"></script>
    <link rel="stylesheet" href="/assets/index-91c57105.css">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"RealEstateAgent","name":"Schwartz and Associates","alternateName":["SAA Homes"],"url":"https://saahomes.com","telephone":"(970) 999-1407"}</script>
    <meta name="author" content="Schwartz and Associates" />
    <meta name="geo.region" content="US-CO" />
    <meta name="geo.placename" content="Fort Collins, Colorado" />
    <meta property="og:site_name" content="Schwartz and Associates" />
    <meta property="og:title" content="Schwartz and Associates | Northern Colorado Real Estate" />
    <meta property="og:image" content="https://saahomes.com/images/White-Logo-AUTOx110.fit.png" />
    <meta property="og:url" content="https://saahomes.com/" />
    <meta name="twitter:site" content="@saahomes" />
    <meta name="twitter:title" content="Schwartz and Associates | Northern Colorado Real Estate" />
  </head>
  <body class="bg-white text-gray-900">
    <div id="root">
    <div class="prerendered-money-content">
      <h1>Adam Schwartz, Realtor | Schwartz and Associates</h1>
      <p>Schwartz and Associates (SAA Homes) is a trusted Northern Colorado real estate team.</p>
    </div>
    </div>
    <nav><a href="https://saahomes.com/contact/">Contact SAA Homes</a> <a href="tel:9709991407">(970) 999-1407</a></nav>
  </body>
</html>`;

let db;
let server;
let srv; // server.js exports
let chat;
let fub;
let brand;
let tenantCtx;
let peak; // tenant with its own FUB key
let ridge; // tenant without one; an agent connected their own
let mesa; // tenant with neither
let ridgeAgent;
let ridgeLead;

const PEAK_HOST = 'peak-realty.test';

test.before(async () => {
  if (hasTestDatabase) {
    db = await createTestDatabase();
    const q = (sql, p) => db.pool.query(sql, p);
    ({ rows: [peak] } = await q(
      `INSERT INTO tenants (slug, name, primary_domain, settings)
       VALUES ('peak', 'Peak Realty', $1, $2) RETURNING *`,
      [PEAK_HOST, JSON.stringify({ fub_api_key: 'peak-key', brand: { primary_color: '#0b5394', tagline: 'Find your summit home.' } })]
    ));
    ({ rows: [ridge] } = await q(
      "INSERT INTO tenants (slug, name, primary_domain) VALUES ('ridge', 'Ridge Homes', 'ridge-homes.test') RETURNING *"
    ));
    ({ rows: [mesa] } = await q(
      "INSERT INTO tenants (slug, name, primary_domain) VALUES ('mesa', 'Mesa Realty', 'mesa-realty.test') RETURNING *"
    ));
    const user = async (cols) => {
      const keys = Object.keys(cols);
      const { rows } = await q(
        `INSERT INTO users (${keys.join(', ')}, manage_token, status) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}, $${keys.length + 1}, 'active') RETURNING *`,
        [...Object.values(cols), crypto.randomBytes(24).toString('hex')]
      );
      return rows[0];
    };
    ridgeAgent = await user({ email: 'agent@ridge-homes.test', name: 'Rae Ridge', role: 'agent', tenant_id: ridge.id, fub_api_key: 'ridge-agent-key' });
    ridgeLead = await user({ email: 'buyer@example.com', name: 'Bo Buyer', tenant_id: ridge.id, assigned_agent_id: ridgeAgent.id });
    // An agent of another brokerage with a key, assigned to a Mesa lead by
    // mistake: Mesa's lead must not go to that key.
    const peakAgent = await user({ email: 'agent@peak-realty.test', name: 'Pat Peak', role: 'agent', tenant_id: peak.id, fub_api_key: 'peak-agent-key' });
    await user({ email: 'buyer@example.com', name: 'Mo Buyer', tenant_id: mesa.id, assigned_agent_id: peakAgent.id });
    server = await startTestServer();
  }
  srv = await import('../src/server.js');
  chat = await import('../src/controllers/chatController.js');
  fub = await import('../src/services/followUpBossService.js');
  brand = await import('../src/services/brand.js');
  tenantCtx = await import('../src/services/tenantContext.js');
});

test.after(async () => {
  await server?.close();
  await db?.drop();
});

const peakBrand = () => brand.brandFor({
  id: 2, slug: 'peak', name: 'Peak Realty', primary_domain: PEAK_HOST,
  settings: { brand: { primary_color: '#0b5394', tagline: 'Find your summit home.' } },
});

// (a) the page shell
test("a brokerage's page shell carries its brand and nothing of SAA's", () => {
  const html = srv.renderBrokerageShell(FAKE_INDEX, peakBrand(), '/');
  assert.match(html, /<title>Peak Realty<\/title>/);
  assert.match(html, /<meta name="description" content="Find your summit home\." \/>/);
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  assert.match(html, /<meta name="theme-color" content="#0b5394" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Peak Realty" \/>/);
  assert.match(html, /<link rel="icon" href="\/brand-icon\.svg" \/>/);
  // The app still loads.
  assert.match(html, /<script type="module" crossorigin src="\/assets\/index-0d8a8f0e\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/index-91c57105\.css">/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /fonts\.googleapis\.com\/css2/);
  // None of SAA's.
  assert.doesNotMatch(html, SAA_WORDS);
  assert.doesNotMatch(html, /canonical|og:|twitter:|ld\+json|googletagmanager|\/icons\//);
  assert.equal((html.match(/<title>/g) || []).length, 1);

  const props = srv.renderBrokerageShell(FAKE_INDEX, peakBrand(), '/properties/');
  assert.match(props, /<title>Peak Realty — Homes for Sale<\/title>/);

  // No tagline, no market: a neutral line, and names are escaped.
  const plain = brand.brandFor({ id: 3, name: 'Ridge & Co <Homes>', settings: {} });
  const out = srv.renderBrokerageShell(FAKE_INDEX, plain, '/about-us/');
  assert.match(out, /<title>Ridge &amp; Co &lt;Homes&gt;<\/title>/);
  assert.match(out, /content="Search homes for sale with Ridge &amp; Co &lt;Homes&gt;\."/);
  assert.doesNotMatch(out, SAA_WORDS);
});

// (b) manifest and icon
test("a brokerage's app manifest and icon are its own", () => {
  const m = srv.buildBrokerageManifest(peakBrand());
  assert.equal(m.name, 'Peak Realty');
  assert.equal(m.short_name, 'Peak Realty');
  assert.equal(m.theme_color, '#0b5394');
  assert.equal(m.description, 'Find your summit home.');
  assert.deepEqual(m.icons, [{ src: '/brand-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]);
  assert.doesNotMatch(JSON.stringify(m), SAA_WORDS);
  assert.doesNotMatch(JSON.stringify(m), /\/icons\//);

  const own = brand.brandFor({ id: 2, name: 'Summit Collective Realty', settings: { brand: { icon_url: 'https://peak-realty.test/api/tenant/asset/icon?v=1' } } });
  const m2 = srv.buildBrokerageManifest(own);
  assert.equal(m2.short_name, 'Summit');
  assert.equal(m2.icons[0].src, 'https://peak-realty.test/api/tenant/asset/icon?v=1');
  assert.equal(m2.icons.at(-1).src, '/brand-icon.svg');

  const svg = srv.renderBrandIconSvg(peakBrand());
  assert.match(svg, /^<svg /);
  assert.match(svg, /fill="#0b5394"/);
  assert.match(svg, />PR<\/text>/);
});

test('on a brokerage host: robots disallow all, no sitemap, its own manifest and icon', { skip: !hasTestDatabase }, async () => {
  const get = (path, host) => fetch(`${server.url}${path}`, { headers: host ? { 'X-Forwarded-Host': host } : {} });

  const robots = await get('/robots.txt', PEAK_HOST);
  assert.equal(robots.status, 200);
  assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n');

  assert.equal((await get('/sitemap.xml', PEAK_HOST)).status, 404);
  assert.equal((await get('/sitemap-listings.xml', PEAK_HOST)).status, 404);
  assert.equal((await get('/sitemap-index.xml', PEAK_HOST)).status, 404);

  const man = await get('/manifest.webmanifest', PEAK_HOST);
  assert.equal(man.status, 200);
  assert.match(man.headers.get('content-type'), /application\/manifest\+json/);
  const body = await man.json();
  assert.equal(body.name, 'Peak Realty');
  assert.equal(body.theme_color, '#0b5394');
  assert.doesNotMatch(JSON.stringify(body), SAA_WORDS);

  const icon = await get('/brand-icon.svg', PEAK_HOST);
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await icon.text(), />PR<\/text>/);

  // SAA's own and unknown hosts are untouched: the sitemap index still lists SAA.
  for (const host of [null, 'saahomes.com', 'unknown-host.test']) {
    const idx = await get('/sitemap-index.xml', host);
    assert.equal(idx.status, 200);
    assert.match(await idx.text(), /sitemap-listings\.xml/);
    assert.notEqual(await (await get('/robots.txt', host)).text(), 'User-agent: *\nDisallow: /\n');
  }
});

// (c) Nadia
test("Nadia's SAA prompt is unchanged; another brokerage's is its own", () => {
  const saa = chat.buildNadiaSystemPrompt(brand.brandFor({ id: 1, slug: 'saa', name: 'SAA Homes', settings: {} }));
  assert.equal(crypto.createHash('sha256').update(saa).digest('hex'), SAA_PROMPT_SHA256);
  assert.equal(chat.buildNadiaSystemPrompt(brand.brandFor(null)), saa);

  const p = chat.buildNadiaSystemPrompt(peakBrand());
  assert.match(p, /You are Nadia, a friendly and helpful member of the Peak Realty team\./);
  assert.match(p, /Website: https:\/\/peak-realty\.test/);
  assert.match(p, /\[\[HANDOFF\]\]/);
  assert.match(p, /\[\[SAVE_SEARCH\]\]/);
  assert.doesNotMatch(p, /Phone:/, 'no phone set, none given');
  assert.doesNotMatch(p, SAA_WORDS);
  assert.doesNotMatch(p, /CHFA|Fort Collins|Greeley|Larimer|Weld/);

  // With a phone, a market and the agent of an agent's own domain.
  const withAgent = chat.buildNadiaSystemPrompt(brand.brandFor(
    { id: 2, name: 'Peak Realty', primary_domain: PEAK_HOST, settings: { brand: { phone: '3035551234', market_name: 'Denver Metro' } } },
    { agent: { name: 'Pat Peak', phone: null } }
  ));
  assert.match(withAgent, /Phone: \(303\) 555-1234/);
  assert.match(withAgent, /Peak Realty team in Denver Metro/);
  assert.match(withAgent, /connect you with Pat Peak/);
  assert.doesNotMatch(withAgent, SAA_WORDS);

  // A brokerage with no domain of its own never gets SAA's address.
  const noDomain = chat.buildNadiaSystemPrompt(brand.brandFor({ id: 4, name: 'Mesa Realty', settings: {} }));
  assert.doesNotMatch(noDomain, SAA_WORDS);
  assert.doesNotMatch(noDomain, /Website:/);
});

// (d) Follow Up Boss
test('Follow Up Boss key per brokerage: SAA env, own key, agent key, or nothing', { skip: !hasTestDatabase }, async () => {
  const pool = db.pool;
  assert.deepEqual(await fub.fubRouteFor({ tenantId: 1 }, { pool }), { via: 'env', key: 'saa-env-key' });
  assert.deepEqual(await fub.fubRouteFor({ tenantId: peak.id, email: 'x@example.com' }, { pool }), { via: 'tenant', key: 'peak-key' });
  assert.deepEqual(await fub.fubRouteFor({ tenantId: ridge.id, email: 'buyer@example.com' }, { pool }), { via: 'agent', key: 'ridge-agent-key' });
  assert.deepEqual(await fub.fubRouteFor({ tenantId: ridge.id, agentUserId: ridgeAgent.id }, { pool }), { via: 'agent', key: 'ridge-agent-key' });
  assert.equal(await fub.fubRouteFor({ tenantId: ridge.id, email: 'nobody@example.com' }, { pool }), null);
  // Mesa's lead is assigned to Peak's agent: that key is never used.
  assert.equal(await fub.fubRouteFor({ tenantId: mesa.id, email: 'buyer@example.com' }, { pool }), null);
  assert.equal(await fub.fubRouteFor({ tenantId: mesa.id, agentUserId: ridgeAgent.id }, { pool }), null);
});

test("a brokerage's lead goes to its own key under its own name", { skip: !hasTestDatabase }, async (t) => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input?.url || input);
    if (!url.startsWith('https://api.followupboss.com/')) return realFetch(input, init);
    calls.push({ url, auth: init.headers?.Authorization, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 9001 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = realFetch; });
  const basic = (k) => `Basic ${Buffer.from(`${k}:`).toString('base64')}`;
  const tenantRow = (row) => ({ ...row, id: Number(row.id) });

  // Peak: its own key, its own names.
  const r1 = await tenantCtx.runWithTenant(tenantRow(peak), () => fub.forwardContactToFollowUpBoss({ name: 'Ann Lead', email: 'ann@example.com', phone: '3035550100' }));
  assert.equal(r1.success, true);
  assert.equal(calls.at(-1).auth, basic('peak-key'));
  assert.equal(calls.at(-1).body.system, 'Peak Realty Website');
  assert.doesNotMatch(JSON.stringify(calls.at(-1).body), SAA_WORDS);

  // Ridge: no brokerage key, the lead's agent's key; nurture source is the brand.
  const r2 = await fub.pushNurtureSignalToFollowUpBoss({ tenantId: ridge.id, signal: 'shared_home', email: ridgeLead.email, name: ridgeLead.name });
  assert.equal(r2.success, true);
  const ev = calls.at(-1);
  assert.equal(ev.auth, basic('ridge-agent-key'));
  assert.equal(ev.body.source, 'Ridge Homes');
  assert.equal(ev.body.message, 'Their agent shared a home with them on ridge-homes.test');
  assert.doesNotMatch(JSON.stringify(ev.body), SAA_WORDS);

  // Mesa: nothing configured, nothing sent.
  const before = calls.length;
  const r3 = await fub.pushNurtureSignalToFollowUpBoss({ tenantId: mesa.id, signal: 'saved_home', email: 'buyer@example.com' });
  assert.equal(r3.reason, 'not_configured');
  const r4 = await tenantCtx.runWithTenant(tenantRow(mesa), () => fub.forwardChfaLeadToFollowUpBoss({ first_name: 'A', last_name: 'B', email: 'buyer@example.com' }));
  assert.equal(r4.reason, 'not_configured');
  assert.equal(calls.length, before);

  // SAA: the env key and SAA's own strings, as before.
  const r5 = await fub.pushNurtureSignalToFollowUpBoss({ tenantId: 1, signal: 'saved_home', email: 'saa-buyer@example.com' });
  assert.equal(r5.success, true);
  assert.equal(calls.at(-1).auth, basic('saa-env-key'));
  assert.equal(calls.at(-1).body.system, 'SAA Homes Website');
  assert.equal(calls.at(-1).body.source, 'saahomes.com');
  assert.equal(calls.at(-1).body.message, 'Saved a home (heart) on saahomes.com');
});

test("SAA's Follow Up Boss events pass through unchanged", () => {
  const ev = { source: 'saahomes.com', system: 'SAA Homes Website', message: 'See https://saahomes.com/x/', person: { tags: ['saahomes.com'] } };
  assert.equal(fub.rebrandFubEvent(ev, null), ev);
  const out = fub.rebrandFubEvent(ev, { name: 'Peak Realty', system: 'Peak Realty Website', site: null, siteLabel: 'Peak Realty' });
  assert.equal(out.message, 'See /x/');
  assert.deepEqual(out.person.tags, ['Peak Realty']);
  assert.equal(out.source, 'Peak Realty');
});
