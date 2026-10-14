/**
 * Staff accounts: password reset links, agent invites, two-step sign-in and
 * the platform owner's brokerage console.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-accounts';
process.env.ADMIN_EMAIL = 'owner@platform.test';
process.env.ADMIN_PASSWORD = 'platform-owner-pass';

const PEAK = 'peak-realty.test';
const SAA = 'saahomes.com';
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let totp;

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  totp = await import('../src/services/totp.js');
  ({ rows: [peak] } = await db.pool.query(
    "INSERT INTO tenants (slug, name, primary_domain) VALUES ('peak', 'Peak Realty', $1) RETURNING *",
    [PEAK]
  ));
});

test.after(async () => {
  if (skip) return;
  await server?.close();
  await db?.drop();
});

async function call(method, path, { auth, body, host = SAA } = {}) {
  const res = await fetch(`${server.url}/api${path}`, {
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

async function staff(email, { role = 'agent', tenantId = 1, password = 'old-password-1' } = {}) {
  const hash = password ? await bcrypt.hash(password, 4) : null;
  const { rows: [u] } = await db.pool.query(
    `INSERT INTO users (email, name, role, status, manage_token, password_hash, tenant_id)
     VALUES ($1, 'Pat Staff', $2, 'active', $3, $4, $5) RETURNING *`,
    [email, role, crypto.randomBytes(24).toString('hex'), hash, tenantId]
  );
  return u;
}

/** The newest emailed link to this address: { url, token, subject }. */
async function lastLink(to) {
  const { rows: [m] } = await db.pool.query(
    'SELECT subject, html, tenant_id FROM email_outbox WHERE to_email = $1 ORDER BY id DESC LIMIT 1',
    [to]
  );
  if (!m) return null;
  const url = m.html.match(/href="([^"]+reset-password\?token=[^"]+)"/)?.[1];
  return { url, token: url && new URL(url).searchParams.get('token'), subject: m.subject, tenant_id: m.tenant_id };
}

const outboxCount = async (to) =>
  (await db.pool.query('SELECT COUNT(*)::int AS n FROM email_outbox WHERE to_email = $1', [to])).rows[0].n;

test('a password reset link resets the password once, on the brokerage’s own site', { skip }, async () => {
  const agent = await staff('reset-me@saahomes.test');

  // Unknown emails get the same answer and no email.
  const none = await call('POST', '/account/password-reset/request', { body: { email: 'nobody@saahomes.test' } });
  assert.equal(none.status, 200);
  assert.equal(await outboxCount('nobody@saahomes.test'), 0);

  // A forged Host header never ends up in the link.
  const r = await call('POST', '/account/password-reset/request', { body: { email: 'Reset-Me@saahomes.test' }, host: 'evil.example' });
  assert.equal(r.status, 200);
  const link = await lastLink(agent.email);
  assert.ok(link?.token, 'reset email was queued');
  assert.equal(new URL(link.url).host, SAA);

  const check = await call('GET', `/account/password-reset/check?token=${link.token}`);
  assert.equal(check.status, 200, check.text);
  assert.equal(check.json.purpose, 'reset');
  assert.equal(check.json.email, agent.email);

  // The link belongs to SAA: Peak's site doesn't know it.
  assert.equal((await call('GET', `/account/password-reset/check?token=${link.token}`, { host: PEAK })).status, 400);

  assert.equal((await call('POST', '/account/password-reset/confirm', { body: { token: link.token, password: 'short' } })).status, 400);
  const ok = await call('POST', '/account/password-reset/confirm', { body: { token: link.token, password: 'brand-new-pass' } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.role, 'agent');

  const again = await call('POST', '/account/password-reset/confirm', { body: { token: link.token, password: 'another-pass-1' } });
  assert.equal(again.status, 400, 'a link works once');

  assert.equal((await call('POST', '/agent/login', { body: { email: agent.email, password: 'old-password-1' } })).status, 401);
  const login = await call('POST', '/agent/login', { body: { email: agent.email, password: 'brand-new-pass' } });
  assert.equal(login.status, 200, login.text);
  assert.ok(login.json.token);
});

test('agents added without a password get an invite on their brokerage’s domain', { skip }, async () => {
  const owner = await staff('owner@peak-realty.test', { role: 'admin', tenantId: peak.id });
  const { generateToken } = await import('../src/middleware/auth.js');
  const auth = generateToken({ id: owner.id, email: owner.email, role: 'admin', tenant_id: peak.id });

  const created = await call('POST', '/admin/agents', { auth, host: PEAK, body: { name: 'Ivy Invite', email: 'ivy@peak-realty.test' } });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.json.invited, true);

  const link = await lastLink('ivy@peak-realty.test');
  assert.equal(new URL(link.url).host, PEAK);
  assert.equal(link.tenant_id, peak.id);
  assert.match(link.subject, /Peak Realty/);

  // No password yet, so no way in until the invite is used.
  assert.equal((await call('POST', '/agent/login', { host: PEAK, body: { email: 'ivy@peak-realty.test', password: 'anything-at-all' } })).status, 401);

  const pending = (await call('GET', '/admin/agents', { auth, host: PEAK })).json.data.find((a) => a.email === 'ivy@peak-realty.test');
  assert.equal(pending.invite_pending, true);

  const check = await call('GET', `/account/password-reset/check?token=${link.token}`, { host: PEAK });
  assert.equal(check.json.purpose, 'invite');
  assert.equal(check.json.brokerage, 'Peak Realty');
  const set = await call('POST', '/account/password-reset/confirm', { host: PEAK, body: { token: link.token, password: 'ivy-picked-this' } });
  assert.equal(set.status, 200, set.text);
  const login = await call('POST', '/agent/login', { host: PEAK, body: { email: 'ivy@peak-realty.test', password: 'ivy-picked-this' } });
  assert.equal(login.status, 200, login.text);
  const joined = (await call('GET', '/admin/agents', { auth, host: PEAK })).json.data.find((a) => a.email === 'ivy@peak-realty.test');
  assert.equal(joined.invite_pending, false);

  // Resending works for this brokerage's agents only.
  const ivyId = created.json.data.id;
  assert.equal((await call('POST', `/admin/agents/${ivyId}/invite`, { auth, host: PEAK })).status, 200);
  const saaAgent = await staff('not-yours@saahomes.test');
  assert.equal((await call('POST', `/admin/agents/${saaAgent.id}/invite`, { auth, host: PEAK })).status, 404);
  assert.equal(await outboxCount('not-yours@saahomes.test'), 0);
});

test('two-step sign-in: codes, replays, recovery codes and turning it off', { skip }, async () => {
  const agent = await staff('two-step@saahomes.test', { password: 'agent-pass-123' });
  const login = () => call('POST', '/agent/login', { body: { email: agent.email, password: 'agent-pass-123' } });

  const first = await login();
  const auth = first.json.token;
  assert.ok(auth);

  const off = await call('GET', '/account/2fa', { auth });
  assert.equal(off.json.enabled, false);

  const setup = await call('POST', '/account/2fa/setup', { auth });
  assert.equal(setup.status, 200, setup.text);
  assert.match(setup.json.otpauth_url, /^otpauth:\/\/totp\//);
  assert.match(setup.json.qr_data_url || '', /^data:image\/png;base64,/);
  const secret = setup.json.secret;

  assert.equal((await call('POST', '/account/2fa/enable', { auth, body: { code: '000000' } })).status, 400);
  const step = totp.stepAt();
  const enable = await call('POST', '/account/2fa/enable', { auth, body: { code: totp.codeAt(secret, step) } });
  assert.equal(enable.status, 200, enable.text);
  assert.equal(enable.json.recovery_codes.length, 10);
  const { rows: [stored] } = await db.pool.query('SELECT totp_secret_enc FROM users WHERE id = $1', [agent.id]);
  assert.ok(!stored.totp_secret_enc.includes(secret), 'secret is encrypted at rest');

  // Now the password alone gets a challenge, not a session.
  const second = await login();
  assert.equal(second.status, 200);
  assert.equal(second.json.needs_2fa, true);
  assert.equal(second.json.token, undefined);
  const { challenge } = second.json;
  assert.equal((await call('GET', '/agent/me', { auth: challenge })).status, 403, 'a challenge is not a session');

  assert.equal((await call('POST', '/account/2fa/verify', { body: { challenge, code: '123456' } })).status, 401);
  // The code used to turn it on can't be used again.
  assert.equal((await call('POST', '/account/2fa/verify', { body: { challenge, code: totp.codeAt(secret, step) } })).status, 401);
  const next = await call('POST', '/account/2fa/verify', { body: { challenge, code: totp.codeAt(secret, step + 1) } });
  assert.equal(next.status, 200, next.text);
  assert.ok(next.json.token);
  assert.equal(next.json.data.email, agent.email);
  assert.equal((await call('GET', '/agent/me', { auth: next.json.token })).status, 200);

  // The challenge can't be finished at another brokerage.
  const third = await login();
  const atPeak = await call('POST', '/account/2fa/verify', { host: PEAK, body: { challenge: third.json.challenge, code: enable.json.recovery_codes[0] } });
  assert.equal(atPeak.status, 403);

  // A recovery code works once.
  const rec = enable.json.recovery_codes[0];
  assert.equal((await call('POST', '/account/2fa/verify', { body: { challenge: third.json.challenge, code: rec } })).status, 200);
  const fourth = await login();
  assert.equal((await call('POST', '/account/2fa/verify', { body: { challenge: fourth.json.challenge, code: rec } })).status, 401);

  const status = await call('GET', '/account/2fa', { auth });
  assert.equal(status.json.enabled, true);
  assert.equal(status.json.recovery_codes_left, 9);

  assert.equal((await call('POST', '/account/2fa/disable', { auth, body: { code: '000000' } })).status, 400);
  assert.equal((await call('POST', '/account/2fa/disable', { auth, body: { code: enable.json.recovery_codes[1] } })).status, 200);
  const fifth = await login();
  assert.ok(fifth.json.token, 'password alone works again');
});

test('the platform owner adds and pauses brokerages; nobody else can', { skip }, async () => {
  const ownerLogin = await call('POST', '/admin/login', { body: { email: 'owner@platform.test', password: 'platform-owner-pass' } });
  assert.equal(ownerLogin.status, 200, ownerLogin.text);
  const auth = ownerLogin.json.token;

  const me = await call('GET', '/account/me', { auth });
  assert.equal(me.json.platform, true);

  const created = await call('POST', '/platform/tenants', {
    auth,
    body: { name: 'Summit Homes', slug: 'summit', primary_domain: 'https://www.Summit-Homes.test/', owner_name: 'Sam Summit', owner_email: 'sam@summit-homes.test' },
  });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.json.data.primary_domain, 'summit-homes.test');
  const summitId = created.json.data.id;

  assert.equal((await call('POST', '/platform/tenants', {
    auth, body: { name: 'Copy', slug: 'summit', primary_domain: 'other.test', owner_name: 'X', owner_email: 'x@other.test' },
  })).status, 409);
  assert.equal((await call('POST', '/platform/tenants', {
    auth, body: { name: 'Copy', slug: 'copycat', primary_domain: PEAK, owner_name: 'X', owner_email: 'x@other.test' },
  })).status, 409, 'a domain belongs to one brokerage');

  const list = await call('GET', '/platform/tenants', { auth });
  const summit = list.json.data.find((t) => t.id === summitId);
  assert.equal(summit.owner_email, 'sam@summit-homes.test');

  // The owner's invite lands on Summit's domain and makes a Summit admin.
  const link = await lastLink('sam@summit-homes.test');
  assert.equal(new URL(link.url).host, 'summit-homes.test');
  const set = await call('POST', '/account/password-reset/confirm', { host: 'summit-homes.test', body: { token: link.token, password: 'summit-owner-pass' } });
  assert.equal(set.status, 200, set.text);
  assert.equal(set.json.role, 'admin');
  const samLogin = await call('POST', '/admin/login', { host: 'summit-homes.test', body: { email: 'sam@summit-homes.test', password: 'summit-owner-pass' } });
  assert.equal(samLogin.status, 200, samLogin.text);
  const sam = samLogin.json.token;
  assert.equal((await call('GET', '/admin/agents', { auth: sam, host: 'summit-homes.test' })).status, 200);

  // A brokerage admin is not the platform owner.
  assert.equal((await call('GET', '/platform/tenants', { auth: sam, host: 'summit-homes.test' })).status, 403);
  assert.equal((await call('GET', '/account/me', { auth: sam, host: 'summit-homes.test' })).json.platform, false);

  // Pausing a brokerage closes its site; it doesn't fall through to SAA.
  assert.equal((await call('PATCH', `/platform/tenants/${summitId}`, { auth, body: { status: 'suspended' } })).status, 200);
  const paused = await call('POST', '/auth/session', { host: 'summit-homes.test', body: { email: 'new@buyer.test', phone: '9705550123' } });
  assert.equal(paused.status, 503);
  assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM users WHERE email = 'new@buyer.test'")).rows[0].n, 0);
  assert.equal((await call('PATCH', `/platform/tenants/${summitId}`, { auth, body: { status: 'active' } })).status, 200);
  assert.equal((await call('GET', '/admin/agents', { auth: sam, host: 'summit-homes.test' })).status, 200);

  assert.equal((await call('PATCH', '/platform/tenants/1', { auth, body: { status: 'suspended' } })).status, 400, 'SAA can’t be paused');
});

test('the platform owner can turn on two-step sign-in too', { skip }, async () => {
  const login = () => call('POST', '/admin/login', { body: { email: 'owner@platform.test', password: 'platform-owner-pass' } });
  const auth = (await login()).json.token;
  const setup = await call('POST', '/account/2fa/setup', { auth });
  const step = totp.stepAt();
  const enable = await call('POST', '/account/2fa/enable', { auth, body: { code: totp.codeAt(setup.json.secret, step) } });
  assert.equal(enable.status, 200, enable.text);

  const second = await login();
  assert.equal(second.json.needs_2fa, true);
  const done = await call('POST', '/account/2fa/verify', { body: { challenge: second.json.challenge, code: totp.codeAt(setup.json.secret, step + 1) } });
  assert.equal(done.status, 200, done.text);
  assert.equal((await call('GET', '/platform/tenants', { auth: done.json.token })).status, 200);

  await call('POST', '/account/2fa/disable', { auth, body: { code: enable.json.recovery_codes[0] } });
});
