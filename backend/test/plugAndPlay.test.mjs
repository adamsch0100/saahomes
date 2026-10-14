/**
 * Plug and play: a brokerage signs itself up, pays (or doesn't) through
 * Stripe, pastes widgets into its own website, and its Follow Up Boss account
 * gets notes, tags and automatic home alerts. Every outside call is faked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';
import { insertListing } from './helpers/fixtures.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-plug-and-play';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.STRIPE_PRICE_BROKERAGE_SEAT = 'price_seat_test';
process.env.FUB_SYSTEM_NAME = 'TestSystem';
process.env.FUB_SYSTEM_KEY = 'fub-system-key-test';
process.env.PLATFORM_BASE_DOMAIN = 'homes.test';
process.env.ADMIN_EMAIL = 'platform-owner@platform.test';
process.env.SIGNUP_RATE_LIMIT = '100';
delete process.env.OUTREACH_SMTP_HOST;

const SAA = 'saahomes.com';
const PEAK = 'peak-realty.test';
const SAA_STRINGS = /saahomes|SAA Homes|999-1407|Schwartz|CFB36E/i;
const DAY = 24 * 60 * 60 * 1000;
const skip = !hasTestDatabase;

let db;
let server;
let peak;
let peakOwner;
let as = {};

// ── fake Stripe and Follow Up Boss ──
const calls = [];
const realFetch = globalThis.fetch;
const fubPeople = new Map(); // id → person
function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
globalThis.fetch = async (input, init = {}) => {
  const url = String(input?.url || input);
  if (url.startsWith('https://api.stripe.com/') || url.startsWith('https://api.followupboss.com/')) {
    const body = typeof init.body === 'string' ? init.body : null;
    calls.push({ url, method: init.method || 'GET', body, headers: init.headers || {} });
    const path = url.replace(/^https:\/\/api\.[a-z]+\.com\/v1/, '');
    if (url.includes('stripe.com')) {
      if (path.startsWith('/customers')) return json(200, { id: `cus_new_${calls.length}` });
      if (path.startsWith('/checkout/sessions')) return json(200, { id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' });
      if (path.startsWith('/billing_portal/sessions')) return json(200, { url: 'https://billing.stripe.test/p/1' });
      if (path.startsWith('/prices/')) return json(200, { id: 'price_seat_test', unit_amount: 4900, currency: 'usd', recurring: { interval: 'month' } });
      if (path.startsWith('/subscriptions/')) return json(200, subscription('active'));
      if (path.startsWith('/subscription_items/')) return json(200, { id: 'si_1', quantity: 2 });
      return json(404, { error: { message: 'not faked' } });
    }
    if (path.startsWith('/people?limit=1')) return json(200, { people: [], _metadata: { total: 0 } });
    const person = path.match(/^\/people\/(\d+)\?fields=allFields/);
    if (person && init.method !== 'PUT') {
      const p = fubPeople.get(Number(person[1]));
      return p ? json(200, p) : json(404, { errorMessage: 'not found' });
    }
    if (path.startsWith('/webhooks')) return json(201, { id: 77, status: 'Active', event: 'peopleCreated' });
    if (path.startsWith('/notes')) return json(201, { id: 1 });
    if (path.startsWith('/people/')) return json(200, { id: 1 });
    if (path.startsWith('/events')) return json(200, {});
    return json(200, {});
  }
  return realFetch(input, init);
};
const fubCalls = (re) => calls.filter((c) => c.url.startsWith('https://api.followupboss.com/') && re.test(c.url));
const stripeCalls = (re) => calls.filter((c) => c.url.startsWith('https://api.stripe.com/') && re.test(c.url));

function subscription(status, tenantId = null, extra = {}) {
  return {
    id: 'sub_test_1',
    object: 'subscription',
    status,
    customer: 'cus_test_1',
    current_period_end: Math.floor((Date.now() + 30 * DAY) / 1000),
    metadata: tenantId ? { app: 'brokerages', tenant_id: String(tenantId) } : { app: 'brokerages' },
    items: { data: [{ id: 'si_1', quantity: 1 }] },
    ...extra,
  };
}

async function call(method, path, { auth, body, host = PEAK, headers = {}, raw } = {}) {
  const page = /^\/embed(\.js|\/(?!view))/.test(path);
  const res = await realFetch(`${server.url}${page ? '' : '/api'}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Host': host,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return v;
    await new Promise((r) => { setTimeout(r, 40); });
  }
}

const signupBody = (over = {}) => ({
  brokerage_name: 'Summit Peak Homes',
  name: 'Sam Summit',
  email: 'sam@summit.test',
  phone: '(970) 555-0101',
  password: 'summit-pass-123',
  city: 'Loveland',
  website: '',
  elapsed_ms: 9000,
  ...over,
});

test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  const q = (sql, p) => db.pool.query(sql, p);
  ({ rows: [peak] } = await q(
    `INSERT INTO tenants (slug, name, primary_domain, settings)
     VALUES ('peak', 'Peak Realty', $1, $2::jsonb) RETURNING *`,
    [PEAK, JSON.stringify({ fub_api_key: 'peak-fub-key', billing: { status: 'trialing', trial_ends_at: new Date(Date.now() + 10 * DAY).toISOString() } })]
  ));
  const hash = await bcrypt.hash('peak-pass-123', 4);
  ({ rows: [peakOwner] } = await q(
    `INSERT INTO users (email, name, role, status, manage_token, password_hash, tenant_id)
     VALUES ('olive@peak-realty.test', 'Olive Owner', 'admin', 'active', $1, $2, $3) RETURNING *`,
    [crypto.randomBytes(24).toString('hex'), hash, peak.id]
  ));
  const { generateToken } = await import('../src/middleware/auth.js');
  as = {
    owner: generateToken({ id: peakOwner.id, email: peakOwner.email, role: 'admin', tenant_id: peak.id }),
    platform: generateToken({ email: 'owner@platform.test', role: 'admin', platform: true }),
  };
});

test.after(async () => {
  if (skip) return;
  globalThis.fetch = realFetch;
  await server?.close();
  await db?.drop();
});

// ─────────────────────────────────────────────────────────────── signup

test('signup creates its own brokerage, owner, trial and address, apart from everyone else', { skip }, async () => {
  const info = await call('GET', '/signup/info', { host: SAA });
  assert.equal(info.status, 200, info.text);
  assert.equal(info.json.product_name, 'SAA Homes for Brokerages');
  assert.deepEqual(info.json.price, { amount: 49, currency: 'USD', interval: 'month' });
  assert.equal(info.json.trial_days, 14);

  const r = await call('POST', '/signup', { host: SAA, body: signupBody() });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.data.slug, 'summit-peak-homes');
  assert.equal(r.json.data.site_url, 'https://summit-peak-homes.homes.test');
  assert.equal(r.json.data.console_url, 'https://summit-peak-homes.homes.test/admin');

  const { rows: [t] } = await db.pool.query("SELECT * FROM tenants WHERE slug = 'summit-peak-homes'");
  assert.equal(t.status, 'active');
  assert.equal(t.primary_domain, null);
  assert.equal(t.settings.billing.status, 'trialing');
  const left = (new Date(t.settings.billing.trial_ends_at) - Date.now()) / DAY;
  assert.ok(left > 13.9 && left <= 14, `trial is 14 days (${left})`);
  assert.equal(t.settings.brand.name, 'Summit Peak Homes');
  assert.equal(t.settings.brand.market_name, 'Loveland');

  const { rows: owners } = await db.pool.query('SELECT * FROM users WHERE LOWER(email) = $1', ['sam@summit.test']);
  assert.equal(owners.length, 1);
  assert.equal(owners[0].tenant_id, t.id);
  assert.equal(owners[0].role, 'admin');
  assert.ok(owners[0].password_hash);
  assert.equal(owners[0].email_confirmed_at, null);

  // The confirm email: in the brokerage's name, linking to its own address.
  const { rows: [mail] } = await db.pool.query("SELECT * FROM email_outbox WHERE to_email = 'sam@summit.test' ORDER BY id DESC LIMIT 1");
  assert.match(mail.subject, /Confirm your email for Summit Peak Homes/);
  assert.equal(Number(mail.tenant_id), t.id);
  assert.doesNotMatch(mail.html, SAA_STRINGS);
  const token = mail.html.match(/summit-peak-homes\.homes\.test\/admin\?confirm=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(token, 'confirm link points at the new site');

  // The owner's token works on its own address only.
  const host = 'summit-peak-homes.homes.test';
  const setup = await call('GET', '/admin/setup', { host, auth: r.json.data.token });
  assert.equal(setup.status, 200, setup.text);
  assert.equal(setup.json.data.brokerage.name, 'Summit Peak Homes');
  assert.equal(setup.json.data.email_confirmed, false);
  assert.equal(setup.json.data.billing.status, 'trialing');
  assert.equal(setup.json.data.billing.trial_days_left, 14);
  assert.equal((await call('GET', '/admin/setup', { host: SAA, auth: r.json.data.token })).status, 403);
  assert.equal((await call('GET', '/admin/settings', { host: PEAK, auth: r.json.data.token })).status, 403);
  const pub = await call('GET', '/tenant', { host });
  assert.equal(pub.json.tenant.brand.brandName, 'Summit Peak Homes');
  assert.doesNotMatch(pub.text, SAA_STRINGS);

  // A confirm link can't set a password, and confirms only once.
  assert.equal((await call('POST', '/account/password-reset/confirm', { host, body: { token, password: 'hijack-pass-1' } })).status, 400);
  const ok = await call('POST', '/admin/setup/confirm-email', { host, body: { token } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await call('POST', '/admin/setup/confirm-email', { host, body: { token } })).status, 400);
  assert.equal((await call('GET', '/admin/setup', { host, auth: r.json.data.token })).json.data.email_confirmed, true);

  // SAA's own records are untouched.
  const { rows: [saa] } = await db.pool.query('SELECT status, settings FROM tenants WHERE id = 1');
  assert.equal(saa.status, 'active');
  assert.equal(saa.settings.billing, undefined);
  assert.equal((await call('GET', '/tenant', { host: SAA })).json.tenant, null);
});

test('signup only on the platform host, and bots are turned away', { skip }, async () => {
  assert.equal((await call('POST', '/signup', { host: PEAK, body: signupBody({ email: 'x1@summit.test' }) })).status, 404);
  assert.equal((await call('GET', '/signup/info', { host: PEAK })).status, 404);
  const honeypot = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'bot@summit.test', website: 'http://spam.test' }) });
  assert.equal(honeypot.status, 400);
  const tooFast = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'bot2@summit.test', elapsed_ms: 300 }) });
  assert.equal(tooFast.status, 400);
  const { rows } = await db.pool.query("SELECT 1 FROM users WHERE email LIKE 'bot%'");
  assert.equal(rows.length, 0);
});

test('signup can’t take an address another brokerage or agent already has', { skip }, async () => {
  await db.pool.query("INSERT INTO tenants (slug, name, primary_domain) VALUES ('acme-old', 'Acme', 'acme.homes.test')");
  const slugTaken = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'a1@x.test', slug: 'peak' }) });
  assert.equal(slugTaken.status, 409);
  assert.equal(slugTaken.json.field, 'slug');
  const domainTaken = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'a2@x.test', slug: 'acme' }) });
  assert.equal(domainTaken.status, 409, 'acme.homes.test already belongs to a brokerage');
  const reserved = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'a3@x.test', slug: 'admin' }) });
  assert.equal(reserved.status, 409);
  const check = await call('GET', '/signup/check?slug=peak', { host: SAA });
  assert.equal(check.json.available, false);
  // A name that's taken gets the next free address instead.
  const again = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'a4@x.test' }) });
  assert.equal(again.status, 201, again.text);
  assert.equal(again.json.data.slug, 'summit-peak-homes-2');
  const { rows } = await db.pool.query("SELECT COUNT(*)::int AS n FROM tenants WHERE slug LIKE 'summit-peak-homes%'");
  assert.equal(rows[0].n, 2);
});

test('without a base domain the console runs on the platform host for that brokerage only', { skip }, async () => {
  const saved = process.env.PLATFORM_BASE_DOMAIN;
  delete process.env.PLATFORM_BASE_DOMAIN;
  try {
    const r = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'nodomain@x.test', brokerage_name: 'No Domain Realty' }) });
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.data.site_url, null);
    assert.equal(r.json.data.console_url, 'https://saahomes.com/admin?brokerage=no-domain-realty');
    const headers = { 'X-Brokerage': 'no-domain-realty' };
    const s = await call('GET', '/admin/setup', { host: SAA, auth: r.json.data.token, headers });
    assert.equal(s.status, 200, s.text);
    assert.equal(s.json.data.brokerage.name, 'No Domain Realty');
    // The header never changes public pages, and a token can't use another brokerage's name.
    assert.equal((await call('GET', '/tenant', { host: SAA, headers })).json.tenant, null);
    assert.equal((await call('GET', '/admin/setup', { host: SAA, auth: as.owner, headers })).status, 403);
    assert.equal((await call('GET', '/admin/setup', { host: SAA, auth: r.json.data.token, headers: { 'X-Brokerage': 'peak' } })).status, 403);
    // No address of its own: Settings shows none, and its logo is served here by name.
    const settings = await call('GET', '/admin/settings', { host: SAA, auth: r.json.data.token, headers });
    assert.equal(settings.status, 200, settings.text);
    assert.equal(settings.json.data.site.url, null);
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const up = await call('POST', '/admin/settings/asset/logo', { host: SAA, auth: r.json.data.token, headers, body: { data_url: PNG } });
    assert.equal(up.status, 200, up.text);
    assert.match(up.json.url, /\/api\/tenant\/asset\/logo\?brokerage=no-domain-realty&v=/);
    const img = await call('GET', '/tenant/asset/logo?brokerage=no-domain-realty', { host: SAA });
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
  } finally {
    process.env.PLATFORM_BASE_DOMAIN = saved;
  }
});

// ─────────────────────────────────────────────────────────────── billing

test('the Stripe webhook rejects bad or stale signatures', { skip }, async () => {
  const { signStripePayload } = await import('../src/services/stripe.js');
  const body = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', created: Math.floor(Date.now() / 1000), data: { object: subscription('active', peak.id) } });
  const post = (sig) => call('POST', '/billing/webhook', { host: SAA, raw: body, headers: { 'Stripe-Signature': sig } });
  assert.equal((await post('t=1,v1=deadbeef')).status, 400);
  assert.equal((await post(signStripePayload(body, 'whsec_wrong'))).status, 400);
  assert.equal((await post(signStripePayload(body, 'whsec_test_fake', Math.floor(Date.now() / 1000) - 3600))).status, 400, 'an hour-old signature is a replay');
  assert.equal((await call('POST', '/billing/webhook', { host: SAA, raw: body })).status, 400);
  const { rows: [still] } = await db.pool.query('SELECT settings FROM tenants WHERE id = $1', [peak.id]);
  assert.equal(still.settings.billing.status, 'trialing', 'nothing applied');
  const good = await post(signStripePayload(body, 'whsec_test_fake'));
  assert.equal(good.status, 200, good.text);
  const { rows: [after] } = await db.pool.query('SELECT settings FROM tenants WHERE id = $1', [peak.id]);
  assert.equal(after.settings.billing.status, 'active');
  assert.equal(after.settings.billing.subscription, 'sub_test_1');
  assert.equal(after.settings.billing.subscription_item, 'si_1');
});

test('billing: trial → grace → paused → back on payment, on a moving clock', { skip }, async () => {
  const { runBillingSweep, handleStripeEvent } = await import('../src/services/billing.js');
  const start = Date.now();
  const r = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'grace@x.test', brokerage_name: 'Grace Realty' }) });
  assert.equal(r.status, 201, r.text);
  const host = 'grace-realty.homes.test';
  const token = r.json.data.token;
  const id = (await db.pool.query("SELECT id FROM tenants WHERE slug = 'grace-realty'")).rows[0].id;
  const billing = async () => (await db.pool.query('SELECT status, settings FROM tenants WHERE id = $1', [id])).rows[0];

  await runBillingSweep({ now: start + 13 * DAY });
  assert.equal((await billing()).settings.billing.status, 'trialing');

  // With no way to pay (no Stripe keys), a trial never runs out.
  const key = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    await runBillingSweep({ now: start + 60 * DAY });
    assert.equal((await billing()).settings.billing.status, 'trialing');
  } finally {
    process.env.STRIPE_SECRET_KEY = key;
  }

  await runBillingSweep({ now: start + 15 * DAY });
  let b = await billing();
  assert.equal(b.settings.billing.status, 'grace');
  assert.equal(b.status, 'active', 'the site stays up during grace');
  const graceEnd = new Date(b.settings.billing.grace_ends_at).getTime();
  assert.ok(Math.abs(graceEnd - (new Date(b.settings.billing.trial_ends_at).getTime() + 7 * DAY)) < 1000);
  const summary = (await call('GET', '/admin/billing', { host, auth: token })).json.data;
  assert.equal(summary.status, 'grace');
  assert.equal(summary.banner.kind, 'warning');

  await runBillingSweep({ now: start + 20 * DAY });
  assert.equal((await billing()).status, 'active', 'still in grace');
  await runBillingSweep({ now: start + 22 * DAY });
  b = await billing();
  assert.equal(b.status, 'suspended');
  assert.equal(b.settings.billing.suspended, true);

  // Paused: the site serves nothing, but the owner can sign in and pay.
  assert.equal((await call('GET', '/listings', { host })).status, 503);
  assert.equal((await call('GET', '/tenant', { host })).status, 200);
  const paused = await call('GET', '/admin/setup', { host, auth: token });
  assert.equal(paused.status, 200, paused.text);
  assert.equal(paused.json.data.paused, true);
  assert.equal((await call('GET', '/admin/cockpit', { host, auth: token })).status, 503);
  const login = await call('POST', '/admin/login', { host, body: { email: 'grace@x.test', password: 'summit-pass-123' } });
  assert.equal(login.status, 200, login.text);
  const checkout = await call('POST', '/admin/billing/checkout', { host, auth: token });
  assert.equal(checkout.status, 200, checkout.text);
  assert.equal(checkout.json.url, 'https://checkout.stripe.test/cs_test_1');
  const session = stripeCalls(/checkout\/sessions/).at(-1);
  const form = new URLSearchParams(session.body);
  assert.equal(form.get('mode'), 'subscription');
  assert.equal(form.get('line_items[0][price]'), 'price_seat_test');
  assert.equal(form.get('line_items[0][quantity]'), '1');
  assert.equal(form.get('metadata[tenant_id]'), String(id));
  assert.equal(form.get('subscription_data[trial_end]'), null, 'no trial left to carry over');
  assert.match(form.get('success_url'), /^https:\/\/grace-realty\.homes\.test\/admin\?billing=success/);

  // Paid: Stripe says active, and the site is back.
  await handleStripeEvent({ type: 'customer.subscription.created', created: Math.floor(Date.now() / 1000), data: { object: subscription('active', id, { customer: 'cus_grace' }) } }, { now: start + 22 * DAY });
  b = await billing();
  assert.equal(b.status, 'active');
  assert.equal(b.settings.billing.status, 'active');
  assert.equal(b.settings.billing.suspended, false);
  assert.equal((await call('GET', '/listings', { host })).status, 200);

  // A later failed payment starts a fresh grace, not an instant pause.
  await handleStripeEvent({ type: 'invoice.payment_failed', data: { object: { customer: 'cus_grace' } } }, { now: start + 40 * DAY });
  b = await billing();
  assert.equal(b.settings.billing.status, 'past_due');
  assert.equal(b.status, 'active');
  assert.ok(new Date(b.settings.billing.grace_ends_at).getTime() > start + 46 * DAY);
});

test('checkout carries the rest of the trial over and seats follow the team', { skip }, async () => {
  const r = await call('POST', '/signup', { host: SAA, body: signupBody({ email: 'trial@x.test', brokerage_name: 'Trial Carry' }) });
  const host = 'trial-carry.homes.test';
  const checkout = await call('POST', '/admin/billing/checkout', { host, auth: r.json.data.token });
  assert.equal(checkout.status, 200, checkout.text);
  const form = new URLSearchParams(stripeCalls(/checkout\/sessions/).at(-1).body);
  const trialEnd = Number(form.get('subscription_data[trial_end]')) * 1000;
  assert.ok(Math.abs(trialEnd - (Date.now() + 14 * DAY)) < 60 * 1000, 'the 14-day trial carries over');

  // Peak has a subscription item (from the webhook test): adding an agent bumps the quantity.
  const before = stripeCalls(/subscription_items/).length;
  const add = await call('POST', '/admin/agents', { host: PEAK, auth: as.owner, body: { email: 'new-agent@peak-realty.test', name: 'New Agent' } });
  assert.equal(add.status, 201, add.text);
  await waitFor(() => stripeCalls(/subscription_items/).length > before);
  const bump = stripeCalls(/subscription_items/).at(-1);
  assert.match(bump.url, /subscription_items\/si_1$/);
  assert.equal(new URLSearchParams(bump.body).get('quantity'), '2');

  // Manage billing opens Stripe's portal for that customer.
  const portal = await call('POST', '/admin/billing/portal', { host: PEAK, auth: as.owner });
  assert.equal(portal.status, 200, portal.text);
  assert.equal(new URLSearchParams(stripeCalls(/billing_portal/).at(-1).body).get('customer'), 'cus_test_1');
});

// ─────────────────────────────────────────────────────────────── embeds

test('embed pages can be framed anywhere and show the right brokerage', { skip }, async () => {
  const search = await call('GET', '/embed/search?city=Loveland&maxPrice=500000', { host: PEAK });
  assert.equal(search.status, 200);
  assert.equal(search.headers.get('content-security-policy'), 'frame-ancestors *');
  assert.match(search.text, /Peak Realty/);
  assert.match(search.text, /value="Loveland"/);
  assert.doesNotMatch(search.text, SAA_STRINGS);

  const grid = await call('GET', '/embed/listings?city=Fort%20Collins&beds=3&count=4&type=condo', { host: PEAK });
  assert.equal(grid.status, 200);
  assert.match(grid.text, /"q":"city=Fort\+Collins&beds=3&types=condo","count":4/);
  assert.match(grid.text, /\/api\/listings\?/, 'homes come from the public listing API');
  const one = await call('GET', '/embed/listing/123-main-st', { host: PEAK });
  assert.equal(one.status, 200);
  assert.match(one.text, /"slug":"123-main-st"/);
  const evil = await call('GET', '/embed/listings?city=%3Cscript%3E', { host: PEAK });
  assert.doesNotMatch(evil.text, /<script>alert|"q":"city=%3Cscript/);

  const saa = await call('GET', '/embed/search', { host: SAA });
  assert.match(saa.text, /SAA Homes/);
  assert.equal((await call('GET', '/embed/nope', { host: PEAK })).status, 404);

  // Only embed routes may be framed.
  const api = await call('GET', '/tenant', { host: PEAK });
  assert.equal(api.headers.get('content-security-policy'), null);

  const loader = await call('GET', '/embed.js', { host: PEAK });
  assert.equal(loader.status, 200);
  assert.match(loader.headers.get('content-type'), /javascript/);
  assert.match(loader.text, /saa-embed:height/);

  const view = await call('POST', '/embed/view', { host: PEAK, body: { widget: 'listings', page: 'https://peak-blog.test/homes?x=1' } });
  assert.equal(view.status, 204);
  const { rows } = await db.pool.query("SELECT tenant_id, source, meta FROM events WHERE type = 'embed_view'");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tenant_id, peak.id);
  assert.deepEqual(rows[0].meta, { widget: 'listings', page: 'peak-blog.test/homes' });
  const card = await call('GET', '/admin/embeds', { host: PEAK, auth: as.owner });
  assert.equal(card.json.data.base_url, `https://${PEAK}`);
  assert.equal(card.json.data.views_30d.listings, 1);
});

// ─────────────────────────────────────────────────────────────── Follow Up Boss

test('a third view of the same home adds one FUB note and a hot tag, once', { skip }, async () => {
  const listing = await insertListing(db.pool, { city: 'Loveland', list_price: 615000 });
  const { rows: [buyer] } = await db.pool.query(
    `INSERT INTO users (email, name, manage_token, tenant_id, fub_person_id)
     VALUES ('bea@buyer.test', 'Bea Buyer', $1, $2, 4242) RETURNING *`,
    [crypto.randomBytes(24).toString('hex'), peak.id]
  );
  const view = () => call('POST', '/alerts/view', { host: PEAK, body: { listing_id: listing.listing_id }, headers: { Cookie: `saa_user_token=${buyer.manage_token}` } });
  const backdate = () => db.pool.query("UPDATE property_views SET viewed_at = viewed_at - INTERVAL '2 hours' WHERE user_id = $1", [buyer.id]);
  const notes = () => fubCalls(/\/v1\/notes$/).filter((c) => JSON.parse(c.body).personId === 4242);

  assert.equal((await view()).status, 200);
  await backdate();
  assert.equal((await view()).status, 200);
  await backdate();
  await new Promise((r) => { setTimeout(r, 300); });
  assert.equal(notes().length, 0, 'two views: no note yet');
  assert.equal((await view()).status, 200);
  await waitFor(() => notes().length >= 1);
  assert.equal(notes().length, 1);
  const note = JSON.parse(notes()[0].body);
  assert.match(note.body, /Bea has looked at .*Loveland 3 times on Peak Realty/);
  assert.doesNotMatch(note.body, SAA_STRINGS);
  const tag = await waitFor(() => fubCalls(/\/people\/4242\?mergeTags=true$/).at(-1));
  assert.ok(tag, 'tags are merged, never replaced');
  assert.deepEqual(JSON.parse(tag.body).tags, ['Hot: 3+ views']);
  assert.equal(tag.headers['X-System'], 'TestSystem');

  await backdate();
  assert.equal((await view()).status, 200);
  await new Promise((r) => { setTimeout(r, 400); });
  assert.equal(notes().length, 1, 'once per home per person');
});

test('connecting a FUB key registers the new-contact webhook', { skip }, async () => {
  const r = await call('PATCH', '/admin/settings', { host: PEAK, auth: as.owner, body: { fub_api_key: 'peak-fub-key-2' } });
  assert.equal(r.status, 200, r.text);
  const hook = await waitFor(async () => (await db.pool.query("SELECT settings->'fub_webhook' AS h FROM tenants WHERE id = $1", [peak.id])).rows[0].h?.status === 'active'
    && (await db.pool.query("SELECT settings->'fub_webhook' AS h FROM tenants WHERE id = $1", [peak.id])).rows[0].h);
  assert.equal(hook.status, 'active');
  const reg = fubCalls(/\/v1\/webhooks$/).at(-1);
  const body = JSON.parse(reg.body);
  assert.equal(body.event, 'peopleCreated');
  assert.equal(body.url, `https://saahomes.com/api/fub/webhook/${peak.id}/${hook.token}`);
  assert.equal(reg.headers['X-System-Key'], 'fub-system-key-test');
  assert.match(reg.headers.Authorization, /^Basic /);
  const setup = await call('GET', '/admin/setup', { host: PEAK, auth: as.owner });
  assert.equal(setup.json.data.fub.new_contact_alerts, 'active');
});

test('a contact added in FUB gets one starter alert, in its own brokerage only', { skip }, async () => {
  const { signFubPayload } = await import('../src/services/fubAutomation.js');
  const { pendingFubWork } = await import('../src/controllers/fubWebhookController.js');
  const { rows: [{ token }] } = await db.pool.query("SELECT settings->'fub_webhook'->>'token' AS token FROM tenants WHERE id = $1", [peak.id]);
  fubPeople.set(9001, {
    id: 9001, firstName: 'Fran', lastName: 'Fubber', emails: [{ value: 'Fran@Contact.test' }], phones: [{ value: '970-555-0199' }],
    price: 500000, addresses: [{ city: 'Windsor', state: 'CO' }], customBedrooms: 3,
  });
  const payload = (eventId) => JSON.stringify({ eventId, eventCreated: new Date().toISOString(), event: 'peopleCreated', resourceIds: [9001], uri: 'https://api.followupboss.com/v1/people?id=9001' });
  const send = (body, { sig, path = `/fub/webhook/${peak.id}/${token}` } = {}) => call('POST', path, {
    host: SAA, raw: body, headers: { 'FUB-Signature': sig ?? signFubPayload(body, 'fub-system-key-test') },
  });
  const settle = async () => { await Promise.all([...pendingFubWork]); };

  const first = payload('evt-a');
  assert.equal((await send(first, { sig: signFubPayload(first, 'wrong-key') })).status, 401);
  assert.equal((await send(first, { sig: '' })).status, 401);
  assert.equal((await send(first, { path: `/fub/webhook/${peak.id}/not-the-token` })).status, 404);
  await settle();
  assert.equal((await db.pool.query("SELECT 1 FROM users WHERE LOWER(email) = 'fran@contact.test'")).rows.length, 0, 'nothing happens without a valid signature');

  const ok = await send(first);
  assert.equal(ok.status, 200, ok.text);
  await settle();
  const { rows: users } = await db.pool.query("SELECT * FROM users WHERE LOWER(email) = 'fran@contact.test'");
  assert.equal(users.length, 1);
  assert.equal(users[0].tenant_id, peak.id);
  assert.equal(Number(users[0].fub_person_id), 9001);
  const { rows: searches } = await db.pool.query('SELECT * FROM saved_searches WHERE user_id = $1', [users[0].id]);
  assert.equal(searches.length, 1);
  assert.equal(searches[0].tenant_id, peak.id);
  assert.deepEqual(searches[0].filters, { city: 'Windsor', minPrice: '400000', maxPrice: '550000', beds: '3' });
  const { rows: [welcome] } = await db.pool.query("SELECT * FROM email_outbox WHERE to_email = 'fran@contact.test'");
  assert.match(welcome.subject, /Your home alerts from Peak Realty are on/);
  assert.equal(Number(welcome.tenant_id), peak.id);
  assert.doesNotMatch(welcome.html, SAA_STRINGS);
  assert.match(welcome.html, /https:\/\/peak-realty\.test\/properties\/\?city=Windsor/);
  const tagged = fubCalls(/\/people\/9001\?mergeTags=true$/).at(-1);
  assert.deepEqual(JSON.parse(tagged.body).tags, ['Active searcher']);

  // FUB retries the same delivery, and sends a second event for the same person: still one alert.
  assert.equal((await send(first)).status, 200);
  assert.equal((await send(payload('evt-b'))).status, 200);
  await settle();
  const { rows: [{ n }] } = await db.pool.query(
    "SELECT COUNT(*)::int AS n FROM saved_searches s JOIN users u ON u.id = s.user_id WHERE LOWER(u.email) = 'fran@contact.test'"
  );
  assert.equal(n, 1);
  // Never SAA's.
  assert.equal((await db.pool.query("SELECT 1 FROM users WHERE LOWER(email) = 'fran@contact.test' AND tenant_id = 1")).rows.length, 0);
  assert.equal((await send(first, { path: `/fub/webhook/1/${token}` })).status, 404);
});

test('a contact with nothing stated gets a broad starter search', { skip }, async () => {
  const { starterFiltersFromPerson } = await import('../src/services/fubAutomation.js');
  assert.deepEqual(starterFiltersFromPerson({ emails: [{ value: 'a@b.test' }] }), {});
  assert.deepEqual(starterFiltersFromPerson({ addresses: [{ city: '<script>' }], price: 'abc' }), {});
});

// Last: these sweep a year ahead, which pauses every trial left above.
test('SAA is never billed or paused', { skip }, async () => {
  const { runBillingSweep, handleStripeEvent, writeBilling } = await import('../src/services/billing.js');
  await db.pool.query(
    `UPDATE tenants SET settings = settings || $1::jsonb WHERE id = 1`,
    [JSON.stringify({ billing: { status: 'grace', trial_ends_at: '2020-01-01T00:00:00Z', grace_ends_at: '2020-01-08T00:00:00Z' } })]
  );
  await runBillingSweep({ now: Date.now() + 365 * DAY });
  await handleStripeEvent({ type: 'customer.subscription.deleted', data: { object: subscription('canceled', 1) } });
  await writeBilling(db.pool, 1, { suspended: true }, { status: 'suspended' });
  const { rows: [saa] } = await db.pool.query('SELECT status, settings FROM tenants WHERE id = 1');
  assert.equal(saa.status, 'active');
  assert.notEqual(saa.settings.billing.suspended, true);
  const { generateToken } = await import('../src/middleware/auth.js');
  const s = await call('GET', '/admin/billing', { host: SAA, auth: generateToken({ email: 'owner@platform.test', role: 'admin', platform: true }) });
  assert.equal(s.json.data.exempt, true);
  assert.equal((await call('POST', '/admin/billing/checkout', { host: SAA, auth: as.platform })).status, 400);
  await db.pool.query("UPDATE tenants SET settings = settings - 'billing' WHERE id = 1");
});

test('the platform console shows each brokerage’s billing', { skip }, async () => {
  const r = await call('GET', '/platform/tenants', { host: SAA, auth: as.platform });
  assert.equal(r.status, 200, r.text);
  const saa = r.json.data.find((t) => t.id === 1);
  assert.equal(saa.billing, null);
  const grace = r.json.data.find((t) => t.slug === 'grace-realty');
  assert.ok(grace.billing.status);
});
