/**
 * Another brokerage's site never shows SAA. Its page shells and the API
 * answers a buyer's browser reads carry its own name and phone and nothing
 * of SAA's; its buyers stay signed in on plain http; the tour email's phone
 * is tappable. SAA's own site is untouched.
 *
 * The app itself renders in the browser, so the words inside the React
 * pages are checked by hand on a brokerage host; this guards the server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-brand-leaks';
process.env.SAA_SERVER_NO_START = '1';

const HOST = 'peak.test';
const SAA_WORDS = /999-1407|Schwartz|SAA Homes|Adam &(amp;)? Mandi/;
const PAGES = ['/', '/alerts/manage', '/notifications', '/my-home', '/properties'];
const APIS = ['/api/tenant', '/api/listings?limit=3'];
// The built SPA shell, when the site has been built (npm run build at the repo root).
const INDEX = join(dirname(fileURLToPath(import.meta.url)), '../../dist/index.html');

let db;
let server;
let peak;

test.before(async () => {
  if (!hasTestDatabase) return;
  db = await createTestDatabase();
  server = await startTestServer();
  ({ rows: [peak] } = await db.pool.query(
    `INSERT INTO tenants (slug, name, primary_domain, settings)
     VALUES ('peak', 'Peak Realty', $1, '{"brand": {"name": "Peak Realty", "phone": "3035550123", "market_name": "Denver Metro"}}'::jsonb)
     RETURNING *`,
    [HOST]
  ));
});

test.after(async () => {
  if (server) await server.close();
  if (db) await db.drop();
});

const get = (path, headers = {}) => fetch(`${server.url}${path}`, { headers: { 'X-Forwarded-Host': HOST, ...headers } });

test("a brokerage's pages and buyer APIs carry its brand, never SAA's", { skip: !hasTestDatabase }, async () => {
  for (const path of [...PAGES, ...APIS]) {
    const res = await get(path);
    const body = await res.text();
    assert.ok(res.status < 500, `${path}: ${res.status} ${body.slice(0, 200)}`);
    assert.doesNotMatch(body, SAA_WORDS, `${path} shows SAA`);
  }
  const tenant = (await (await get('/api/tenant')).json()).tenant;
  assert.equal(tenant.isBrokerage, true);
  assert.equal(tenant.brand.brandName, 'Peak Realty');
  assert.equal(tenant.brand.phone, '(303) 555-0123');
  assert.equal(tenant.marketName, 'Denver Metro');
  const listings = await (await get('/api/listings?limit=3')).json();
  assert.ok(Array.isArray(listings.data), 'sample homes until the MLS approves the site');
});

test('the built page shell for each of its pages names the brokerage only', { skip: !hasTestDatabase || !existsSync(INDEX) }, async () => {
  const srv = await import('../src/server.js');
  const { brandFor } = await import('../src/services/brand.js');
  const index = readFileSync(INDEX, 'utf8');
  for (const path of PAGES) {
    const html = srv.renderBrokerageShell(index, brandFor(peak), path);
    assert.doesNotMatch(html, SAA_WORDS, `${path} shell shows SAA`);
    assert.match(html, /<title>Peak Realty/);
  }
});

test('the session cookie is Secure only when the request came in over https', { skip: !hasTestDatabase }, async () => {
  const signup = async (email, headers = {}) => {
    const res = await fetch(`${server.url}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': HOST, ...headers },
      body: JSON.stringify({ email, contact_name: 'Casey Buyer', city: 'Denver' }),
    });
    assert.equal(res.status, 201, await res.text());
    const cookie = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith('saa_user_token='));
    assert.ok(cookie, 'signed in on this device');
    return cookie;
  };
  assert.doesNotMatch(await signup('casey.http@comcast.net'), /;\s*Secure/i, 'plain http keeps the cookie');
  assert.match(await signup('casey.https@comcast.net', { 'X-Forwarded-Proto': 'https' }), /;\s*Secure/i);
});

test("the agent's tour email links the phone number", async () => {
  const { agentNoticeEmail } = await import('../src/services/stayEmails.js');
  const html = agentNoticeEmail({
    brand: { name: 'Peak Realty', primary_color: '#0b5394' },
    site: 'https://peak.test',
    title: 'Casey Buyer asked for a tour',
    lines: ['12 Elm St', { label: 'Phone', text: '(303) 555-0199', href: 'tel:+13035550199' }],
    link: 'https://peak.test/agent/',
  });
  assert.match(html, /Phone: <a href="tel:\+13035550199"[^>]*>\(303\) 555-0199<\/a>/);
  assert.doesNotMatch(html, SAA_WORDS);
});
