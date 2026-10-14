/**
 * A brokerage owner sets up their brand, domain, routing and security without
 * code, and none of it leaks into SAA or another brokerage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-settings';
// The record brokerages point their domain at: the platform's own.
process.env.PLATFORM_CNAME_TARGET = 'domains.platform.test';

const PEAK = 'peak-realty.test';
const SAA = 'saahomes.com';
const SAA_STRINGS = /saahomes|SAA Homes|999-1407|Schwartz|CFB36E/i;
const skip = !hasTestDatabase;
// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let db;
let server;
let peak;
let owner;
let agent;
let as = {};

async function call(method, path, { auth, body, host = PEAK } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, buf, headers: res.headers };
}

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  const q = (sql, p) => db.pool.query(sql, p);
  ({ rows: [peak] } = await q("INSERT INTO tenants (slug, name, primary_domain) VALUES ('peak', 'Peak Realty', $1) RETURNING *", [PEAK]));
  const hash = await bcrypt.hash('peak-pass-123', 4);
  const mk = async (email, role) => (await q(
    `INSERT INTO users (email, name, role, status, manage_token, password_hash, tenant_id)
     VALUES ($1, $2, $3, 'active', $4, $5, $6) RETURNING *`,
    [email, role === 'admin' ? 'Olive Owner' : 'Andy Agent', role, crypto.randomBytes(24).toString('hex'), hash, peak.id]
  )).rows[0];
  owner = await mk('olive@peak-realty.test', 'admin');
  agent = await mk('andy@peak-realty.test', 'agent');
  const { generateToken } = await import('../src/middleware/auth.js');
  as = {
    owner: generateToken({ id: owner.id, email: owner.email, role: 'admin', tenant_id: peak.id }),
    agent: generateToken({ id: agent.id, email: agent.email, role: 'agent', tenant_id: peak.id }),
    platform: generateToken({ email: 'owner@platform.test', role: 'admin', platform: true }),
  };
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

test('a new brokerage starts with its own name and nothing of SAA’s', { skip }, async () => {
  const s = await call('GET', '/admin/settings', { auth: as.owner });
  assert.equal(s.status, 200, s.text);
  assert.equal(s.json.data.resolved.brandName, 'Peak Realty');
  assert.equal(s.json.data.resolved.phone, null);
  assert.equal(s.json.data.lead_visibility, 'own_and_unassigned');
  assert.doesNotMatch(JSON.stringify(s.json.data.resolved), SAA_STRINGS);

  const pub = await call('GET', '/tenant');
  assert.equal(pub.json.tenant.isBrokerage, true);
  assert.equal(pub.json.tenant.brand.brandName, 'Peak Realty');
  assert.doesNotMatch(pub.text, SAA_STRINGS);
  assert.equal((await call('GET', '/tenant', { host: SAA })).json.tenant, null, 'SAA’s site is unchanged');
});

test('the owner sets brand, routing and Follow Up Boss; agents can’t', { skip }, async () => {
  assert.equal((await call('PATCH', '/admin/settings', { auth: as.agent, body: { brand: { name: 'Hijack' } } })).status, 403);
  assert.equal((await call('PATCH', '/admin/settings', { auth: as.owner, body: { brand: { accent_color: 'gold' } } })).status, 400);

  const r = await call('PATCH', '/admin/settings', {
    auth: as.owner,
    body: {
      brand: { name: 'Peak Realty Group', phone: '3035550142', email: 'hello@peak-realty.test', accent_color: '#0f766e', tagline: 'Front Range homes' },
      lead_visibility: 'own',
    },
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.resolved.brandName, 'Peak Realty Group');
  assert.equal(r.json.data.resolved.phone, '(303) 555-0142');
  assert.equal(r.json.data.lead_visibility, 'own');

  const pub = await call('GET', '/tenant');
  assert.equal(pub.json.tenant.brand.accentColor, '#0f766e');
  assert.equal(pub.json.tenant.brand.tel, 'tel:+13035550142');

  // Clearing a field drops it.
  const cleared = await call('PATCH', '/admin/settings', { auth: as.owner, body: { brand: { tagline: '' } } });
  assert.equal(cleared.json.data.brand.tagline, null);

  // SAA's own settings are untouched by any of it.
  const { rows: [saa] } = await db.pool.query('SELECT settings FROM tenants WHERE id = 1');
  assert.equal(saa.settings.brand, undefined);

  // SAA's Follow Up Boss key lives on the server.
  const saaOwner = (await import('../src/middleware/auth.js')).generateToken({ email: 'owner@platform.test', role: 'admin', platform: true });
  assert.equal((await call('PATCH', '/admin/settings', { auth: saaOwner, host: SAA, body: { fub_api_key: 'abcdefgh1234' } })).status, 400);
});

test('logos upload, serve only on their own brokerage and can’t carry script', { skip }, async () => {
  const up = await call('POST', '/admin/settings/asset/logo', { auth: as.owner, body: { data_url: PNG } });
  assert.equal(up.status, 200, up.text);
  assert.match(up.json.url, /^https:\/\/peak-realty\.test\/api\/tenant\/asset\/logo\?v=/);

  const img = await call('GET', '/tenant/asset/logo');
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.match(img.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await call('GET', '/tenant/asset/logo', { host: SAA })).status, 404, 'SAA doesn’t serve Peak’s logo');

  const evil = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;
  assert.equal((await call('POST', '/admin/settings/asset/icon', { auth: as.owner, body: { data_url: evil } })).status, 400);
  assert.equal((await call('POST', '/admin/settings/asset/logo', { auth: as.owner, body: { data_url: 'data:text/html;base64,PGgxPg==' } })).status, 400);

  const pub = await call('GET', '/tenant');
  assert.match(pub.json.tenant.brand.logoUrl, /asset\/logo/);
});

test('agents fill in their own profile and show on the brokerage’s site', { skip }, async () => {
  const p = await call('PATCH', '/agent/profile', {
    auth: as.agent,
    body: { title: 'Buyer specialist', bio: 'Ten years on the Front Range.', phone: '303-555-0199', notify: { morning_brief: false } },
  });
  assert.equal(p.status, 200, p.text);
  assert.equal(p.json.data.title, 'Buyer specialist');
  assert.equal(p.json.data.notify.morning_brief, false);
  assert.equal(p.json.data.notify.hot_lead_push, true);

  const photo = await call('POST', '/agent/profile/photo', { auth: as.agent, body: { data_url: PNG } });
  assert.equal(photo.status, 200, photo.text);

  const list = await call('GET', '/tenant/agents');
  const andy = list.json.data.find((a) => a.id === agent.id);
  assert.equal(andy.title, 'Buyer specialist');
  assert.match(andy.photo_url, /asset\/agent-/);
  assert.deepEqual((await call('GET', '/tenant/agents', { host: SAA })).json.data, []);
});

test('a brokerage can require two-step sign-in', { skip }, async () => {
  await call('PATCH', '/admin/settings', { auth: as.owner, body: { require_2fa: true } });
  const login = await call('POST', '/agent/login', { body: { email: agent.email, password: 'peak-pass-123' } });
  assert.equal(login.status, 200, login.text);
  assert.equal(login.json.setup_2fa_required, true);
  const limited = login.json.token;

  const blocked = await call('GET', '/agent/cockpit', { auth: limited });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.code, '2fa_setup_required');

  const setup = await call('POST', '/account/2fa/setup', { auth: limited });
  assert.equal(setup.status, 200, setup.text);
  const totp = await import('../src/services/totp.js');
  const enable = await call('POST', '/account/2fa/enable', { auth: limited, body: { code: totp.codeAt(setup.json.secret, totp.stepAt()) } });
  assert.equal(enable.status, 200, enable.text);
  assert.ok(enable.json.token, 'a full session comes back');
  assert.equal((await call('GET', '/agent/cockpit', { auth: enable.json.token })).status, 200);

  await call('PATCH', '/admin/settings', { auth: as.owner, body: { require_2fa: false } });
});

test('the brokerage connects its own domain', { skip }, async () => {
  assert.equal((await call('POST', '/admin/settings/domain', { auth: as.owner, body: { domain: 'saahomes.com' } })).status, 409);
  assert.equal((await call('POST', '/admin/settings/domain', { auth: as.owner, body: { domain: 'not a domain' } })).status, 400);

  const set = await call('POST', '/admin/settings/domain', { auth: as.owner, body: { domain: 'https://www.PeakHomesCO.test/' } });
  assert.equal(set.status, 200, set.text);
  assert.equal(set.json.data.primary_domain, 'peakhomesco.test');
  assert.equal(set.json.data.dns[0].type, 'CNAME');
  assert.equal(set.json.data.dns[0].value, 'domains.platform.test');
  assert.doesNotMatch(JSON.stringify(set.json.data), SAA_STRINGS);

  // The new domain now serves Peak, and so do links in Peak's emails.
  const pub = await call('GET', '/tenant', { host: 'peakhomesco.test' });
  assert.equal(pub.json.tenant.slug, 'peak');

  // Put it back for the other tests.
  await db.pool.query('UPDATE tenants SET primary_domain = $1 WHERE id = $2', [PEAK, peak.id]);
  (await import('../src/services/tenantContext.js')).clearTenantCache();
});

test('a test email goes out in the brokerage’s brand', { skip }, async () => {
  const r = await call('POST', '/admin/settings/test-email', { auth: as.owner });
  assert.equal(r.status, 200, r.text);
  const { rows: [m] } = await db.pool.query('SELECT subject, html, tenant_id FROM email_outbox WHERE to_email = $1 ORDER BY id DESC LIMIT 1', [owner.email]);
  assert.match(m.subject, /Peak Realty Group/);
  assert.equal(m.tenant_id, peak.id);
  assert.doesNotMatch(m.html, SAA_STRINGS);
  assert.match(m.html, /peak-realty\.test/);
});
