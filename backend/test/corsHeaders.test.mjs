/**
 * Browsers on our own hosts may call the API with cookies; a page on any
 * other site gets no allow header. The widgets other sites paste in keep
 * answering any origin, without cookies, and may be iframed; everything
 * else carries the security headers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-cors-headers';
process.env.PLATFORM_BASE_DOMAIN = 'homes.test';
process.env.PLATFORM_MARKETING_DOMAIN = 'brokerages.test';
process.env.SAA_SERVER_NO_START = '1';

const SAA = 'saahomes.com';
const PEAK = 'peak-realty.test';
const skip = !hasTestDatabase;

let db;
let server;

async function call(path, { method = 'GET', host = SAA, origin, headers = {} } = {}) {
  const res = await fetch(`${server.url}${path}`, {
    method,
    headers: {
      'X-Forwarded-Host': host,
      ...(origin ? { Origin: origin } : {}),
      ...headers,
    },
  });
  await res.text();
  return res;
}

const allowOrigin = (res) => res.headers.get('access-control-allow-origin');
const allowCredentials = (res) => res.headers.get('access-control-allow-credentials');

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  await db.pool.query(
    `INSERT INTO tenants (slug, name, primary_domain) VALUES ('peak', 'Peak Realty', $1)`,
    [PEAK]
  );
  server = await startTestServer();
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('a tenant\'s own origin gets the allow header, with credentials', { skip }, async () => {
  const res = await call('/api/listings?limit=1', { host: PEAK, origin: `http://${PEAK}` });
  assert.equal(res.status, 200);
  assert.equal(allowOrigin(res), `http://${PEAK}`);
  assert.equal(allowCredentials(res), 'true');
  assert.match(res.headers.get('vary') || '', /Origin/);

  // Its www. address and its platform subdomain are its own hosts too.
  const www = await call('/api/listings?limit=1', { host: PEAK, origin: `http://www.${PEAK}` });
  assert.equal(allowOrigin(www), `http://www.${PEAK}`);
  const sub = await call('/api/listings?limit=1', { host: 'peak.homes.test', origin: 'http://peak.homes.test' });
  assert.equal(allowOrigin(sub), 'http://peak.homes.test');

  // A brokerage's known host is allowed on the home site's API as well.
  const cross = await call('/api/listings?limit=1', { host: SAA, origin: `http://${PEAK}` });
  assert.equal(allowOrigin(cross), `http://${PEAK}`);
  assert.equal(allowCredentials(cross), 'true');

  // The home site, the platform's marketing domain, and a preflight.
  const home = await call('/api/listings?limit=1', { host: SAA, origin: `http://${SAA}` });
  assert.equal(allowOrigin(home), `http://${SAA}`);
  const platform = await call('/api/listings?limit=1', { host: SAA, origin: 'http://brokerages.test' });
  assert.equal(allowOrigin(platform), 'http://brokerages.test');
  const preflight = await call('/api/listings', {
    method: 'OPTIONS',
    host: PEAK,
    origin: `http://${PEAK}`,
    headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(allowOrigin(preflight), `http://${PEAK}`);
  assert.equal(allowCredentials(preflight), 'true');
  assert.match(preflight.headers.get('access-control-allow-methods') || '', /POST/);
});

test('an unknown origin gets no allow header', { skip }, async () => {
  const res = await call('/api/listings?limit=1', { host: PEAK, origin: 'https://evil.test' });
  assert.equal(res.status, 200);
  assert.equal(allowOrigin(res), null);
  assert.equal(allowCredentials(res), null);
  assert.match(res.headers.get('vary') || '', /Origin/);

  // Not a subdomain of a known host, nor a lookalike.
  const look = await call('/api/listings?limit=1', { host: PEAK, origin: `https://${PEAK}.evil.test` });
  assert.equal(allowOrigin(look), null);
  const preflight = await call('/api/listings', {
    method: 'OPTIONS',
    host: PEAK,
    origin: 'https://evil.test',
    headers: { 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(allowOrigin(preflight), null);
  assert.equal(allowCredentials(preflight), null);

  // No Origin at all (same-origin navigation, curl): nothing to allow.
  const plain = await call('/api/listings?limit=1', { host: PEAK });
  assert.equal(plain.status, 200);
  assert.equal(allowOrigin(plain), null);
});

test('the embed routes still answer any origin, without credentials', { skip }, async () => {
  for (const path of ['/embed/search', '/embed/listings', '/embed.js']) {
    const res = await call(path, { host: PEAK, origin: 'https://some-brokerage-site.test' });
    assert.equal(res.status, 200, path);
    assert.equal(allowOrigin(res), '*', path);
    assert.equal(allowCredentials(res), null, path);
  }
  const beacon = await call('/api/embed/view', {
    method: 'POST',
    host: PEAK,
    origin: 'https://some-brokerage-site.test',
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(allowOrigin(beacon), '*');
  assert.equal(allowCredentials(beacon), null);
});

test('security headers are on, except framing for the widgets', { skip }, async () => {
  const api = await call('/api/listings?limit=1', { host: PEAK });
  assert.equal(api.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(api.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(api.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal(api.headers.get('cross-origin-embedder-policy'), null);
  assert.equal(api.headers.get('content-security-policy'), null);
  assert.equal(api.headers.get('strict-transport-security'), 'max-age=31536000');
  assert.equal(api.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(api.headers.get('x-powered-by'), null);

  const widget = await call('/embed/search', { host: PEAK });
  assert.equal(widget.headers.get('x-frame-options'), null);
  assert.equal(widget.headers.get('content-security-policy'), 'frame-ancestors *');
  assert.equal(widget.headers.get('x-content-type-options'), 'nosniff');
  const loader = await call('/embed.js', { host: PEAK });
  assert.equal(loader.headers.get('x-frame-options'), null);
});
