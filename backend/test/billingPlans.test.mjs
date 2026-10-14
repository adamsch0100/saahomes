/**
 * Plans and a Stripe that sets itself up from STRIPE_SECRET_KEY alone: the
 * plan catalog and its tiered prices, the webhook the app creates for
 * itself, checkout and switching with a plan, the estimate and the
 * "a cheaper plan fits" nudge, and the platform console's MRR. Stripe is a
 * fake with state; another product (ListLogic) has objects on the same
 * account that must never be touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { hasTestDatabase, createTestDatabase, startTestServer } from './helpers/testDb.mjs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-billing-plans';
process.env.PLATFORM_BASE_DOMAIN = 'homes.test';
process.env.SIGNUP_RATE_LIMIT = '100';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.STRIPE_PRICE_BROKERAGE_SEAT;
delete process.env.STRIPE_PRICE_SEAT;
delete process.env.SITE_URL;
delete process.env.PUBLIC_API_URL;
delete process.env.PUBLIC_BASE_URL;
delete process.env.RAILWAY_PUBLIC_DOMAIN;
delete process.env.CREDENTIALS_KEY;
delete process.env.OUTREACH_SMTP_HOST;

const SAA = 'saahomes.com';
const DAY = 24 * 60 * 60 * 1000;
const skip = !hasTestDatabase;
const KEY = 'sk_test_brokerages_fake';

let db;
let server;
let as = {};

// ── a fake Stripe with state ──
const calls = [];
let stripe;
let seq = 0;
const newId = (prefix) => `${prefix}_${(seq += 1)}`;

function resetStripe() {
  stripe = {
    products: new Map([['prod_listlogic', { id: 'prod_listlogic', name: 'ListLogic', active: true, metadata: { app: 'listlogic' } }]]),
    prices: [
      // The other product's prices and webhook on the same account.
      { id: 'price_ll_pro', active: true, lookup_key: 'listlogic_pro_month', product: 'prod_listlogic', currency: 'usd', unit_amount: 9900, billing_scheme: 'per_unit', recurring: { interval: 'month' }, metadata: { app: 'listlogic' } },
    ],
    webhooks: new Map([['we_listlogic', { id: 'we_listlogic', url: 'https://listlogic.test/stripe', enabled_events: ['*'], status: 'enabled', metadata: { app: 'listlogic' } }]]),
    subscriptions: new Map(),
  };
}
resetStripe();

/** Stripe's form encoding back into objects (arrays come back as {0:…,1:…}). */
function decodeForm(str) {
  const out = {};
  for (const [k, v] of new URLSearchParams(str || '')) {
    const parts = k.replace(/\]/g, '').split('[');
    let o = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) o[p] = v;
      else o = (o[p] = o[p] || {});
    });
  }
  return out;
}
const list = (o) => (o ? Object.values(o) : []);

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const notFound = () => json(404, { error: { message: 'No such object' } });

function priceView(p, expandTiers) {
  const { tiers, ...rest } = p;
  return expandTiers && tiers ? { ...rest, tiers } : rest;
}

function handleStripe(method, url, form) {
  const u = new URL(url);
  const path = u.pathname.replace(/^\/v1/, '');
  const q = decodeForm(u.search.slice(1));
  const b = decodeForm(form);

  if (path === '/prices' && method === 'GET') {
    const keys = list(q.lookup_keys);
    const active = q.active === undefined ? true : q.active === 'true';
    const expand = list(q.expand).includes('data.tiers');
    const data = stripe.prices.filter((p) => keys.includes(p.lookup_key) && p.active === active).map((p) => priceView(p, expand));
    return json(200, { object: 'list', data, has_more: false });
  }
  if (path === '/prices' && method === 'POST') {
    const holder = stripe.prices.find((p) => p.lookup_key === b.lookup_key);
    if (holder && b.transfer_lookup_key !== 'true') return json(400, { error: { message: 'A price with this lookup_key already exists' } });
    if (holder) holder.lookup_key = null;
    const tiers = list(b.tiers).map((t) => ({
      up_to: t.up_to === 'inf' ? null : Number(t.up_to),
      flat_amount: t.flat_amount != null ? Number(t.flat_amount) : null,
      unit_amount: t.unit_amount != null ? Number(t.unit_amount) : null,
    }));
    const price = {
      id: newId('price'), object: 'price', active: true, lookup_key: b.lookup_key, product: b.product, currency: b.currency,
      billing_scheme: b.billing_scheme, tiers_mode: b.tiers_mode, tiers, recurring: { interval: b.recurring?.interval },
      nickname: b.nickname, metadata: b.metadata || {}, unit_amount: null,
    };
    stripe.prices.push(price);
    return json(200, priceView(price, true));
  }
  const prod = path.match(/^\/products\/([^/]+)$/);
  if (prod && method === 'GET') return stripe.products.get(prod[1]) ? json(200, stripe.products.get(prod[1])) : notFound();
  if (prod && method === 'POST') {
    const p = stripe.products.get(prod[1]);
    if (!p) return notFound();
    Object.assign(p, { ...b, active: b.active === undefined ? p.active : b.active === 'true' });
    return json(200, p);
  }
  if (path === '/products' && method === 'POST') {
    const id = b.id || newId('prod');
    if (stripe.products.has(id)) return json(400, { error: { message: 'Product already exists' } });
    const p = { id, object: 'product', name: b.name, unit_label: b.unit_label, active: true, metadata: b.metadata || {} };
    stripe.products.set(id, p);
    return json(200, p);
  }
  if (path === '/webhook_endpoints' && method === 'GET') return json(200, { object: 'list', data: [...stripe.webhooks.values()].map(({ secret, ...w }) => w) });
  if (path === '/webhook_endpoints' && method === 'POST') {
    const w = { id: newId('we'), object: 'webhook_endpoint', url: b.url, enabled_events: list(b.enabled_events), status: 'enabled', description: b.description, metadata: b.metadata || {}, secret: `whsec_${crypto.randomBytes(8).toString('hex')}` };
    stripe.webhooks.set(w.id, w);
    return json(200, w);
  }
  const hook = path.match(/^\/webhook_endpoints\/([^/]+)$/);
  if (hook) {
    const w = stripe.webhooks.get(hook[1]);
    if (!w) return notFound();
    const { secret, ...view } = w;
    if (method === 'GET') return json(200, view);
    if (method === 'DELETE') {
      stripe.webhooks.delete(w.id);
      return json(200, { id: w.id, deleted: true });
    }
    if (b.url) w.url = b.url;
    if (b.enabled_events) w.enabled_events = list(b.enabled_events);
    if (b.disabled === 'false') w.status = 'enabled';
    return json(200, { ...w, secret: undefined });
  }
  if (path === '/customers' && method === 'POST') return json(200, { id: newId('cus'), metadata: b.metadata || {} });
  if (path === '/checkout/sessions' && method === 'POST') return json(200, { id: 'cs_plan', url: 'https://checkout.stripe.test/cs_plan' });
  if (path === '/billing_portal/sessions' && method === 'POST') return json(200, { url: 'https://billing.stripe.test/p/plan' });
  const sub = path.match(/^\/subscriptions\/([^/]+)$/);
  if (sub && method === 'POST') {
    const s = stripe.subscriptions.get(sub[1]);
    if (!s) return notFound();
    const item = list(b.items)[0] || {};
    const price = stripe.prices.find((p) => p.id === item.price);
    s.items.data[0] = { ...s.items.data[0], price: priceView(price, false), quantity: Number(item.quantity) };
    s.metadata = { ...s.metadata, ...(b.metadata || {}) };
    return json(200, s);
  }
  if (path.startsWith('/subscription_items/')) return json(200, { id: path.split('/').pop(), quantity: Number(b.quantity) });
  return json(404, { error: { message: `not faked: ${method} ${path}` } });
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input?.url || input);
  if (url.startsWith('https://api.stripe.com/')) {
    const method = init.method || 'GET';
    const body = typeof init.body === 'string' ? init.body : null;
    calls.push({ url, method, body, headers: init.headers || {} });
    return handleStripe(method, url, body);
  }
  return realFetch(input, init);
};
const stripeCalls = (re = /./, method = null) => calls.filter((c) => re.test(c.url) && (!method || c.method === method));
const writes = () => calls.filter((c) => c.method !== 'GET');

async function call(method, path, { auth, body, host = SAA, headers = {}, raw } = {}) {
  const res = await realFetch(`${server.url}/api${path}`, {
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
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json: data, text };
}

const signupBody = (over = {}) => ({
  brokerage_name: 'Plan Realty',
  name: 'Pat Plan',
  email: 'pat@plan.test',
  phone: '(970) 555-0199',
  password: 'plan-pass-123',
  city: 'Loveland',
  website: '',
  elapsed_ms: 9000,
  ...over,
});

let mods;
test.before(async () => {
  if (skip) return;
  db = await createTestDatabase();
  server = await startTestServer();
  const { generateToken } = await import('../src/middleware/auth.js');
  as.platform = generateToken({ email: 'owner@platform.test', role: 'admin', platform: true });
  mods = {
    plans: await import('../src/services/plans.js'),
    setup: await import('../src/services/stripeSetup.js'),
    billing: await import('../src/services/billing.js'),
    stripe: await import('../src/services/stripe.js'),
    box: await import('../src/services/secretBox.js'),
  };
});

test.after(async () => {
  if (skip) return;
  globalThis.fetch = realFetch;
  await server?.close();
  await db?.drop();
});

// ───────────────────────────────────────────────────────────── math

test('tiered math: the base covers the included agents, then a price per agent; yearly is ten months', async () => {
  const { buildCatalog, planTerms, periodCents, monthlyCents, planAdvice, cheapestPlan } = await import('../src/services/plans.js');
  const cat = buildCatalog();
  const team = planTerms(cat, 'team', 'month');
  assert.deepEqual(
    { base: team.base_cents, included: team.included, extra: team.extra_cents, key: team.lookup_key },
    { base: 29900, included: 5, extra: 2500, key: 'brokerages_team_month' }
  );
  assert.equal(periodCents(team, 1), 29900);
  assert.equal(periodCents(team, 5), 29900);
  assert.equal(periodCents(team, 8), 29900 + 3 * 2500);
  const teamYear = planTerms(cat, 'team', 'year');
  assert.equal(teamYear.base_cents, 299000);
  assert.equal(teamYear.extra_cents, 25000);
  assert.equal(periodCents(teamYear, 8), 299000 + 3 * 25000);
  assert.equal(monthlyCents(teamYear, 5), Math.round(299000 / 12));
  assert.equal(periodCents(planTerms(cat, 'enterprise', 'month'), 120), 149900 + 20 * 800);

  // 8 agents on Team: 3 over, and Team is still the cheapest.
  let advice = planAdvice(cat, team, 8);
  assert.deepEqual(advice.over_plan, { agents: 3, extra_cents: 7500 });
  assert.equal(advice.suggestion, null);
  // 30 agents on Team ($924) would be $774 on Brokerage.
  advice = planAdvice(cat, team, 30);
  assert.equal(advice.suggestion.plan, 'brokerage');
  assert.equal(advice.suggestion.amount_cents, 69900 + 5 * 1500);
  assert.equal(advice.suggestion.savings_cents, (29900 + 25 * 2500) - (69900 + 5 * 1500));
  assert.equal(advice.suggestion.bigger, true);
  // Where it flips: 21 agents is still cheaper on Team, 22 is cheaper on Brokerage.
  assert.equal(cheapestPlan(cat, 21).key, 'team');
  assert.equal(cheapestPlan(cat, 22).key, 'brokerage');
  // A team that shrank: 3 agents on Brokerage would save $400 on Team.
  advice = planAdvice(cat, planTerms(cat, 'brokerage', 'month'), 3);
  assert.deepEqual([advice.suggestion.plan, advice.suggestion.savings_cents, advice.suggestion.bigger], ['team', 40000, false]);
  // Yearly compares yearly.
  advice = planAdvice(cat, teamYear, 30);
  assert.equal(advice.suggestion.interval, 'year');
  assert.equal(advice.suggestion.amount_cents, 699000 + 5 * 15000);
  // Legacy per-seat terms: no plan advice.
  assert.deepEqual(planAdvice(cat, { plan: 'legacy', unit_cents: 4900, interval: 'month' }, 40), { over_plan: null, suggestion: null });
});

test('plan changes from the console are checked before they are kept', async () => {
  const { validatePlanOverrides, buildCatalog } = await import('../src/services/plans.js');
  assert.deepEqual(validatePlanOverrides({ plans: { team: { monthly: 299, included: 5, extra: 25 } } }).value, { plans: {} }, 'defaults are not stored');
  const ok = validatePlanOverrides({ yearly_months: 11, plans: { team: { monthly: '349', extra: 29.5, name: 'Starter' } } });
  assert.deepEqual(ok.value, { yearly_months: 11, plans: { team: { monthly: 349, extra: 29.5, name: 'Starter' } } });
  const cat = buildCatalog(ok.value);
  assert.equal(cat.plans[0].name, 'Starter');
  assert.equal(cat.yearly_months, 11);
  assert.match(validatePlanOverrides({ plans: { team: { monthly: -1 } } }).error, /Team: the monthly price/);
  assert.match(validatePlanOverrides({ plans: { team: { included: 2.5 } } }).error, /agents included/);
  assert.match(validatePlanOverrides({ plans: { team: { extra: 1.234 } } }).error, /extra agent/);
  assert.match(validatePlanOverrides({ yearly_months: 13 }).error, /1 to 12/);
  assert.match(validatePlanOverrides({ plans: { brokerage: { included: 5 } } }).error, /Brokerage has to include more agents than Team/);
  // Junk in the database never breaks the catalog: bad values fall back to the defaults.
  assert.equal(buildCatalog({ plans: { team: { monthly: 'abc', included: -4 } }, yearly_months: 99 }).plans[0].monthly, 299);
});

test('stored secrets are sealed with AES-256-GCM and refuse to open when tampered with', async () => {
  const box = await import('../src/services/secretBox.js');
  const sealed = box.seal('whsec_abc123');
  assert.match(sealed, /^v1:/);
  assert.doesNotMatch(sealed, /whsec_abc123/);
  assert.equal(box.open(sealed), 'whsec_abc123');
  assert.notEqual(box.seal('whsec_abc123'), sealed, 'a fresh IV each time');
  const buf = Buffer.from(sealed.slice(3), 'base64');
  buf[buf.length - 1] ^= 1;
  assert.equal(box.open(`v1:${buf.toString('base64')}`), null);
  assert.equal(box.open('whsec_plain'), null);
  // An explicit CREDENTIALS_KEY is a different key from the JWT-derived one.
  process.env.CREDENTIALS_KEY = crypto.randomBytes(32).toString('hex');
  try {
    assert.equal(box.open(sealed), null);
    assert.equal(box.open(box.seal('x')), 'x');
  } finally {
    delete process.env.CREDENTIALS_KEY;
  }
});

// ───────────────────────────────────────────────────────── no key

test('without STRIPE_SECRET_KEY everything is a no-op and the plans still show', { skip }, async () => {
  const before = calls.length;
  assert.deepEqual(await mods.setup.ensureStripeCatalog({ pool: db.pool }), { skipped: 'no_key' });
  assert.equal((await mods.setup.ensureStripeWebhook({ pool: db.pool })).skipped, 'no_key');
  assert.equal((await mods.setup.findPlanPrices()).size, 0);
  assert.equal((await mods.setup.syncStripeOnBoot({ pool: db.pool })).skipped, 'no_key');
  assert.equal((await mods.billing.runBillingSweep({ pool: db.pool })).length, 0);

  const info = await call('GET', '/signup/info');
  assert.equal(info.status, 200, info.text);
  assert.deepEqual(info.json.plans.map((p) => [p.key, p.month.base_cents, p.included, p.month.extra_cents, p.year.base_cents]), [
    ['team', 29900, 5, 2500, 299000], ['brokerage', 69900, 25, 1500, 699000], ['enterprise', 149900, 100, 800, 1499000],
  ]);
  assert.equal(info.json.yearly_months, 10);
  assert.ok(info.json.features.length >= 3);
  assert.equal(info.json.price, null);

  const r = await call('POST', '/signup', { body: signupBody({ email: 'nokey@plan.test', brokerage_name: 'No Key Realty', plan: 'brokerage', interval: 'year' }) });
  assert.equal(r.status, 201, r.text);
  const host = 'no-key-realty.homes.test';
  const billing = (await call('GET', '/admin/billing', { host, auth: r.json.data.token })).json.data;
  assert.equal(billing.configured, false);
  assert.equal(billing.billing_mode, 'none');
  assert.equal(billing.plan.key, 'brokerage');
  assert.equal(billing.plan.interval, 'year');
  assert.equal(billing.estimate.amount_cents, 699000);
  assert.equal((await call('POST', '/admin/billing/checkout', { host, auth: r.json.data.token })).status, 503);
  // Picking a plan works without Stripe: it is remembered for checkout.
  const pick = await call('POST', '/admin/billing/plan', { host, auth: r.json.data.token, body: { plan: 'team', interval: 'month' } });
  assert.equal(pick.status, 200, pick.text);
  assert.equal(pick.json.data.plan.key, 'team');

  const status = (await call('GET', '/platform/billing', { auth: as.platform })).json.data.stripe;
  assert.equal(status.key_present, false);
  assert.equal(status.mode, null);
  assert.equal((await call('POST', '/platform/billing/sync', { auth: as.platform })).status, 400);
  assert.equal(calls.length, before, 'not one call to Stripe');
});

// ──────────────────────────────────────────────────────── catalog

test('the catalog creates our product and six tiered prices, then reuses them', { skip }, async () => {
  process.env.STRIPE_SECRET_KEY = KEY;
  calls.length = 0;
  const out = await mods.setup.ensureStripeCatalog({ pool: db.pool });
  assert.equal(out.error, undefined, out.error);
  assert.equal(out.mode, 'test');
  assert.equal(out.product, 'brokerages_platform');
  assert.equal(out.product_action, 'created');
  assert.deepEqual(out.prices.map((p) => p.action), Array(6).fill('created'));
  assert.deepEqual(out.conflicts, []);

  const product = decodeForm(stripeCalls(/\/v1\/products$/, 'POST')[0].body);
  assert.equal(product.id, 'brokerages_platform');
  assert.equal(product.name, (await import('../src/controllers/signupController.js')).productName());
  assert.equal(product.metadata.app, 'brokerages');
  assert.equal(product.unit_label, 'agent');

  const created = stripeCalls(/\/v1\/prices$/, 'POST').map((c) => decodeForm(c.body));
  const team = created.find((p) => p.lookup_key === 'brokerages_team_month');
  assert.deepEqual(team, {
    product: 'brokerages_platform',
    currency: 'usd',
    recurring: { interval: 'month' },
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    tiers: { 0: { up_to: '5', flat_amount: '29900', unit_amount: '0' }, 1: { up_to: 'inf', unit_amount: '2500' } },
    lookup_key: 'brokerages_team_month',
    nickname: 'Team (monthly)',
    metadata: { app: 'brokerages', plan: 'team', interval: 'month', included: '5', base_cents: '29900', extra_cents: '2500' },
  });
  const entYear = created.find((p) => p.lookup_key === 'brokerages_enterprise_year');
  assert.deepEqual(entYear.tiers, { 0: { up_to: '100', flat_amount: '1499000', unit_amount: '0' }, 1: { up_to: 'inf', unit_amount: '8000' } });
  assert.equal(entYear.recurring.interval, 'year');
  assert.ok(created.every((p) => p.transfer_lookup_key === undefined), 'nothing to take a key from');
  // The lookup asks only for our keys, with the tiers.
  const lookup = new URL(stripeCalls(/\/v1\/prices\?/, 'GET')[0].url);
  assert.deepEqual(list(decodeForm(lookup.search.slice(1)).lookup_keys).sort(), mods.plans.ALL_LOOKUP_KEYS.slice().sort());
  assert.ok(list(decodeForm(lookup.search.slice(1)).expand).includes('data.tiers'));
  assert.equal(mods.stripe.plansReady(), true);

  // Again: nothing new.
  calls.length = 0;
  const again = await mods.setup.ensureStripeCatalog({ pool: db.pool });
  assert.equal(again.product_action, 'reused');
  assert.deepEqual(again.prices.map((p) => p.action), Array(6).fill('reused'));
  assert.equal(writes().length, 0, 'a second sync writes nothing');
});

test('new amounts make a new price that takes the lookup key; the old one stays for its subscribers', { skip }, async () => {
  const before = new Map(stripe.prices.filter((p) => p.lookup_key?.startsWith('brokerages_')).map((p) => [p.lookup_key, p.id]));
  const res = await call('PUT', '/platform/plans', { auth: as.platform, body: { plans: { team: { monthly: 349 } } } });
  assert.equal(res.status, 200, res.text);
  const sync = res.json.sync;
  const byKey = Object.fromEntries(sync.prices.map((p) => [p.lookup_key, p]));
  assert.equal(byKey.brokerages_team_month.action, 'replaced');
  assert.equal(byKey.brokerages_team_year.action, 'replaced');
  for (const k of ['brokerages_brokerage_month', 'brokerages_brokerage_year', 'brokerages_enterprise_month', 'brokerages_enterprise_year']) {
    assert.equal(byKey[k].action, 'reused', k);
    assert.equal(byKey[k].id, before.get(k));
  }
  const replaced = decodeForm(stripeCalls(/\/v1\/prices$/, 'POST').at(-2).body);
  assert.equal(replaced.transfer_lookup_key, 'true');
  assert.equal(replaced.tiers[0].flat_amount, '34900');
  const old = stripe.prices.find((p) => p.id === before.get('brokerages_team_month'));
  assert.equal(old.active, true, 'the old price is never archived');
  assert.equal(old.lookup_key, null, 'the key moved to the new price');
  assert.equal(stripeCalls(/\/v1\/prices\/price_/, 'POST').length, 0, 'no existing price was edited');
  assert.equal(res.json.data.stripe.plans.synced, true);
  assert.equal(res.json.data.catalog.plans[0].month.base_cents, 34900);

  const bad = await call('PUT', '/platform/plans', { auth: as.platform, body: { plans: { team: { monthly: 'free' } } } });
  assert.equal(bad.status, 400);
  // Back to the defaults for the rest of the file.
  const reset = await call('PUT', '/platform/plans', { auth: as.platform, body: { plans: {} } });
  assert.equal(reset.status, 200, reset.text);
  assert.equal(reset.json.sync.prices.find((p) => p.lookup_key === 'brokerages_team_month').action, 'replaced');
});

test('objects without our metadata or lookup keys are never touched', { skip }, async () => {
  // Another product on the account somehow holds one of our lookup keys.
  const intruder = { id: 'price_ll_taken', active: true, lookup_key: 'brokerages_enterprise_year', product: 'prod_listlogic', currency: 'usd', billing_scheme: 'per_unit', unit_amount: 1, recurring: { interval: 'year' }, metadata: { app: 'listlogic' } };
  const ours = stripe.prices.find((p) => p.lookup_key === 'brokerages_enterprise_year');
  ours.lookup_key = null;
  stripe.prices.push(intruder);
  mods.setup.clearPlanPriceCache();
  calls.length = 0;
  const out = await mods.setup.ensureStripeCatalog({ pool: db.pool });
  assert.deepEqual(out.conflicts, ['brokerages_enterprise_year']);
  assert.equal(intruder.lookup_key, 'brokerages_enterprise_year', 'not taken from them');
  assert.equal(writes().length, 0);
  assert.equal(mods.stripe.plansReady(), false, 'a plan that can’t be bought means not ready');
  const status = (await call('GET', '/platform/billing', { auth: as.platform })).json.data.stripe;
  assert.deepEqual(status.plans.missing, ['brokerages_enterprise_year']);
  assert.match(status.plans.error, /belong to something else/);

  // A product with our id but not our metadata stops the sync instead of being renamed.
  stripe.products.get('brokerages_platform').metadata = { app: 'listlogic' };
  const blocked = await mods.setup.ensureStripeCatalog({ pool: db.pool });
  assert.match(blocked.error, /belongs to something else/);
  stripe.products.get('brokerages_platform').metadata = { app: 'brokerages' };

  // Put things back.
  stripe.prices.splice(stripe.prices.indexOf(intruder), 1);
  ours.lookup_key = 'brokerages_enterprise_year';
  mods.setup.clearPlanPriceCache();
  await mods.setup.findPlanPrices({ fresh: true });
  assert.equal(mods.stripe.plansReady(), true);

  // Every write so far went to our own objects.
  const ll = calls.concat().filter((c) => /listlogic|price_ll|we_listlogic/.test(c.url));
  assert.equal(ll.length, 0);
  assert.equal(stripe.prices.find((p) => p.id === 'price_ll_pro').lookup_key, 'listlogic_pro_month');
});

// ──────────────────────────────────────────────────────── webhook

test('the webhook sets itself up once, keeps its secret sealed, and verifies with it', { skip }, async () => {
  calls.length = 0;
  let r = await mods.setup.ensureStripeWebhook({ pool: db.pool });
  assert.equal(r.ready, false);
  assert.equal(r.skipped, 'no_public_url', 'no public address known: nothing created');
  assert.match(r.note, /SITE_URL/);
  process.env.SITE_URL = 'http://localhost:3000';
  assert.equal((await mods.setup.ensureStripeWebhook({ pool: db.pool })).skipped, 'no_public_url', 'never localhost');
  assert.equal(writes().length, 0);

  process.env.SITE_URL = 'https://platform.test/';
  r = await mods.setup.ensureStripeWebhook({ pool: db.pool });
  assert.equal(r.ready, true, JSON.stringify(r));
  assert.equal(r.action, 'created');
  assert.equal(r.url, 'https://platform.test/api/billing/webhook');
  const create = decodeForm(stripeCalls(/\/v1\/webhook_endpoints$/, 'POST')[0].body);
  assert.equal(create.url, 'https://platform.test/api/billing/webhook');
  assert.deepEqual(list(create.enabled_events).sort(), mods.setup.WEBHOOK_EVENTS.slice().sort());
  assert.equal(create.metadata.app, 'brokerages');
  const endpoint = [...stripe.webhooks.values()].find((w) => w.metadata.app === 'brokerages');

  // Stored sealed, never in plain text.
  const { rows: [state] } = await db.pool.query("SELECT value FROM platform_settings WHERE key = 'stripe_test'");
  assert.equal(state.value.webhook.id, endpoint.id);
  assert.doesNotMatch(JSON.stringify(state.value), new RegExp(endpoint.secret));
  assert.equal(mods.box.open(state.value.webhook.secret), endpoint.secret);

  // Once: the next boot finds it.
  calls.length = 0;
  assert.equal((await mods.setup.ensureStripeWebhook({ pool: db.pool })).action, 'reused');
  assert.equal(writes().length, 0);

  // The webhook route checks signatures with the stored secret.
  const { signStripePayload } = mods.stripe;
  const r2 = await call('POST', '/signup', { body: signupBody({ email: 'hook@plan.test', brokerage_name: 'Hook Realty' }) });
  const tenantId = (await db.pool.query("SELECT id FROM tenants WHERE slug = 'hook-realty'")).rows[0].id;
  const body = JSON.stringify({
    id: 'evt_hook', type: 'customer.subscription.updated', created: Math.floor(Date.now() / 1000),
    data: { object: { id: 'sub_hook', status: 'active', customer: 'cus_hook', metadata: { app: 'brokerages', tenant_id: String(tenantId) }, items: { data: [{ id: 'si_hook', quantity: 1 }] } } },
  });
  const post = (secret) => call('POST', '/billing/webhook', { raw: body, headers: { 'Stripe-Signature': signStripePayload(body, secret) } });
  assert.equal((await post('whsec_not_it')).status, 400);
  const good = await post(endpoint.secret);
  assert.equal(good.status, 200, good.text);
  assert.equal(good.json.tenant_id, tenantId);
  assert.ok(r2.json.data.token);
  // STRIPE_WEBHOOK_SECRET still wins when it's set, and the stored one keeps working.
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_from_env';
  try {
    assert.equal((await post('whsec_from_env')).status, 200);
    assert.equal((await post(endpoint.secret)).status, 200);
    assert.deepEqual(await mods.setup.ensureStripeWebhook({ pool: db.pool }), { ready: true, source: 'env', action: 'env' });
  } finally {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }

  // The site moved: same endpoint, same secret, new address.
  process.env.SITE_URL = 'https://platform2.test';
  r = await mods.setup.ensureStripeWebhook({ pool: db.pool });
  assert.equal(r.action, 'updated');
  assert.equal(stripe.webhooks.get(endpoint.id).url, 'https://platform2.test/api/billing/webhook');

  // A fresh database lost the secret: our orphan at that address goes, a new one comes; ListLogic's stays.
  await db.pool.query("DELETE FROM platform_settings WHERE key = 'stripe_test'");
  mods.setup.clearWebhookSecretCache();
  calls.length = 0;
  r = await mods.setup.ensureStripeWebhook({ pool: db.pool });
  assert.equal(r.action, 'created');
  assert.deepEqual(stripeCalls(/webhook_endpoints\//, 'DELETE').map((c) => c.url.split('/').pop()), [endpoint.id]);
  assert.ok(stripe.webhooks.has('we_listlogic'), 'the other product’s webhook is untouched');
  assert.equal([...stripe.webhooks.values()].filter((w) => w.metadata.app === 'brokerages').length, 1);
  process.env.SITE_URL = 'https://platform.test';
  await mods.setup.ensureStripeWebhook({ pool: db.pool });

  const status = await mods.setup.stripeSetupStatus({ pool: db.pool });
  assert.equal(status.webhook.ready, true);
  assert.equal(status.webhook.source, 'auto');
  assert.equal(status.plans.synced, true);
  assert.equal(status.mode, 'test');
});

// ─────────────────────────────────────────────── checkout and plans

test('checkout sells the plan picked, carries the trial, and switching moves the price with proration', { skip }, async () => {
  const r = await call('POST', '/signup', { body: signupBody({ email: 'buy@plan.test', brokerage_name: 'Buy Realty', plan: 'brokerage', interval: 'year' }) });
  assert.equal(r.status, 201, r.text);
  const host = 'buy-realty.homes.test';
  const token = r.json.data.token;
  const id = (await db.pool.query("SELECT id, settings FROM tenants WHERE slug = 'buy-realty'")).rows[0].id;
  const priceId = (key) => stripe.prices.find((p) => p.lookup_key === key).id;

  // The plan picked at signup is what the Billing card shows.
  let summary = (await call('GET', '/admin/billing', { host, auth: token })).json.data;
  assert.equal(summary.billing_mode, 'plans');
  assert.equal(summary.configured, true);
  assert.deepEqual([summary.plan.key, summary.plan.interval, summary.plan.chosen], ['brokerage', 'year', true]);
  assert.equal(summary.estimate.amount_cents, 699000);
  assert.equal(summary.trial_days_left, 14);
  // One person on Brokerage: Team would be cheaper.
  assert.equal(summary.suggestion.plan, 'team');
  assert.equal(summary.suggestion.amount_cents, 299000);

  assert.equal((await call('POST', '/admin/billing/checkout', { host, auth: token, body: { plan: 'platinum' } })).status, 400);

  // Seven more agents: eight seats.
  for (let i = 0; i < 7; i += 1) {
    await db.pool.query(
      `INSERT INTO users (email, name, role, status, manage_token, tenant_id) VALUES ($1, $2, 'agent', 'active', $3, $4)`,
      [`agent${i}@buy.test`, `Agent ${i}`, crypto.randomBytes(12).toString('hex'), id]
    );
  }
  calls.length = 0;
  const checkout = await call('POST', '/admin/billing/checkout', { host, auth: token, body: { plan: 'team', interval: 'month' } });
  assert.equal(checkout.status, 200, checkout.text);
  const form = new URLSearchParams(stripeCalls(/checkout\/sessions/).at(-1).body);
  assert.equal(form.get('line_items[0][price]'), priceId('brokerages_team_month'));
  assert.equal(form.get('line_items[0][quantity]'), '8');
  assert.equal(form.get('subscription_data[metadata][plan]'), 'team');
  assert.equal(form.get('subscription_data[metadata][interval]'), 'month');
  assert.equal(form.get('subscription_data[metadata][app]'), 'brokerages');
  const trialEnd = Number(form.get('subscription_data[trial_end]')) * 1000;
  assert.ok(Math.abs(trialEnd - (Date.now() + 14 * DAY)) < 60 * 1000, 'the trial carries over');
  assert.equal(writes().filter((c) => /\/prices|\/products/.test(c.url)).length, 0, 'checkout never creates prices when they exist');

  summary = (await call('GET', '/admin/billing', { host, auth: token })).json.data;
  assert.deepEqual([summary.plan.key, summary.plan.interval], ['team', 'month'], 'the choice is remembered');
  assert.equal(summary.estimate.amount_cents, 29900 + 3 * 2500);
  assert.equal(summary.estimate.extra_agents, 3);
  assert.deepEqual(summary.over_plan, { agents: 3, extra_cents: 7500 });
  assert.equal(summary.suggestion, null);

  // Stripe says the subscription started (trialing) on the Team price.
  const { handleStripeEvent } = mods.billing;
  const teamPrice = stripe.prices.find((p) => p.id === priceId('brokerages_team_month'));
  const sub = {
    id: 'sub_buy', object: 'subscription', status: 'trialing', customer: 'cus_buy',
    current_period_end: Math.floor((Date.now() + 14 * DAY) / 1000),
    metadata: { app: 'brokerages', tenant_id: String(id), plan: 'team', interval: 'month' },
    items: { data: [{ id: 'si_buy', quantity: 8, price: priceView(teamPrice, false) }] },
  };
  stripe.subscriptions.set('sub_buy', sub);
  await handleStripeEvent({ type: 'customer.subscription.created', created: Math.floor(Date.now() / 1000), data: { object: sub } });
  let b = (await db.pool.query('SELECT settings FROM tenants WHERE id = $1', [id])).rows[0].settings.billing;
  assert.equal(b.price_id, teamPrice.id);
  assert.deepEqual(b.price_terms, { plan: 'team', interval: 'month', currency: 'usd', included: 5, base_cents: 29900, extra_cents: 2500 });
  summary = (await call('GET', '/admin/billing', { host, auth: token })).json.data;
  assert.equal(summary.has_subscription, true);
  assert.equal(summary.can_switch, true);

  // Switch to Brokerage, yearly: the item's price changes, prorated, at today's seats.
  calls.length = 0;
  const sw = await call('POST', '/admin/billing/plan', { host, auth: token, body: { plan: 'brokerage', interval: 'year' } });
  assert.equal(sw.status, 200, sw.text);
  assert.equal(sw.json.switched, true);
  const upd = stripeCalls(/\/v1\/subscriptions\/sub_buy$/, 'POST')[0];
  const f = new URLSearchParams(upd.body);
  assert.equal(f.get('items[0][id]'), 'si_buy');
  assert.equal(f.get('items[0][price]'), priceId('brokerages_brokerage_year'));
  assert.equal(f.get('items[0][quantity]'), '8');
  assert.equal(f.get('proration_behavior'), 'create_prorations');
  assert.equal(f.get('metadata[plan]'), 'brokerage');
  b = (await db.pool.query('SELECT settings FROM tenants WHERE id = $1', [id])).rows[0].settings.billing;
  assert.deepEqual([b.plan, b.interval, b.price_id], ['brokerage', 'year', priceId('brokerages_brokerage_year')]);
  assert.equal(sw.json.data.plan.key, 'brokerage');
  // The same plan again changes nothing in Stripe.
  calls.length = 0;
  const same = await call('POST', '/admin/billing/plan', { host, auth: token, body: { plan: 'brokerage', interval: 'year' } });
  assert.equal(same.json.unchanged, true);
  assert.equal(writes().length, 0);

  // Paying: it counts toward MRR in the console (yearly ÷ 12).
  sub.status = 'active';
  await handleStripeEvent({ type: 'customer.subscription.updated', created: Math.floor(Date.now() / 1000) + 1, data: { object: sub } });
  const tenants = (await call('GET', '/platform/tenants', { auth: as.platform })).json.data;
  const row = tenants.find((t) => t.id === Number(id));
  assert.equal(row.billing.plan, 'brokerage');
  assert.equal(row.billing.plan_name, 'Brokerage');
  assert.equal(row.billing.interval, 'year');
  assert.equal(row.billing.mrr_cents, Math.round(699000 / 12));
  assert.equal(tenants.find((t) => t.id === 1).billing, null);
  const overview = (await call('GET', '/platform/billing', { auth: as.platform })).json.data;
  // Hook Realty pays too (from the webhook test), on a price we never saw: it
  // counts at the plan its team fits (one person on Team).
  assert.equal(overview.totals.mrr_cents, Math.round(699000 / 12) + 29900);
  assert.equal(overview.totals.paying, 2);
  assert.ok(overview.totals.trialing >= 1);
  assert.equal(overview.stripe.key_present, true);
  assert.equal(overview.stripe.mode, 'test');
  assert.equal(overview.stripe.plans.synced, true);
  assert.equal(overview.stripe.webhook.ready, true);
});

test('a missing plan price is set up at checkout; the legacy seat price still works when plans can’t be', { skip }, async () => {
  // The plan prices vanish (say, a brand-new live account): checkout sets them up.
  const r = await call('POST', '/signup', { body: signupBody({ email: 'late@plan.test', brokerage_name: 'Late Realty' }) });
  const host = 'late-realty.homes.test';
  for (const p of stripe.prices) if (p.lookup_key?.startsWith('brokerages_')) p.active = false;
  mods.setup.clearPlanPriceCache();
  calls.length = 0;
  const checkout = await call('POST', '/admin/billing/checkout', { host, auth: r.json.data.token });
  assert.equal(checkout.status, 200, checkout.text);
  const created = stripeCalls(/\/v1\/prices$/, 'POST').map((c) => decodeForm(c.body));
  assert.equal(created.length, 6);
  assert.ok(created.every((p) => p.transfer_lookup_key === 'true'), 'archived holders hand their keys over');
  const form = new URLSearchParams(stripeCalls(/checkout\/sessions/).at(-1).body);
  assert.equal(form.get('line_items[0][price]'), stripe.prices.find((p) => p.lookup_key === 'brokerages_team_month' && p.active).id);
  assert.equal(form.get('subscription_data[metadata][plan]'), 'team', 'nobody picked: the cheapest plan for the team');

  // Plans can't be set up (Stripe refuses), but the old single price is set: it sells that.
  process.env.STRIPE_PRICE_BROKERAGE_SEAT = 'price_legacy_seat';
  stripe.prices.push({ id: 'price_legacy_seat', active: true, lookup_key: null, product: 'prod_old', currency: 'usd', unit_amount: 4900, billing_scheme: 'per_unit', recurring: { interval: 'month' }, metadata: {} });
  const saved = stripe.prices.filter((p) => p.lookup_key?.startsWith('brokerages_'));
  saved.forEach((p) => { p.lookup_key = `gone_${p.lookup_key}`; });
  mods.setup.clearPlanPriceCache();
  try {
    calls.length = 0;
    const legacy = await call('POST', '/admin/billing/checkout', { host, auth: r.json.data.token });
    assert.equal(legacy.status, 200, legacy.text);
    const lf = new URLSearchParams(stripeCalls(/checkout\/sessions/).at(-1).body);
    assert.equal(lf.get('line_items[0][price]'), 'price_legacy_seat');
    assert.equal(lf.get('subscription_data[metadata][plan]'), 'legacy');
    assert.equal(stripeCalls(/\/v1\/prices$/, 'POST').length, 0, 'with a fallback, checkout doesn’t try to set plans up');
  } finally {
    delete process.env.STRIPE_PRICE_BROKERAGE_SEAT;
    saved.forEach((p) => { p.lookup_key = p.lookup_key.replace(/^gone_/, ''); });
    mods.setup.clearPlanPriceCache();
  }
});

test('the console Sync button runs both setups; startup never throws', { skip }, async () => {
  const res = await call('POST', '/platform/billing/sync', { auth: as.platform });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.json.sync.webhook.ready, true);
  assert.ok(res.json.sync.plans.prices.length === 6);
  // Only the platform owner.
  const { rows: [t] } = await db.pool.query("SELECT id FROM tenants WHERE slug = 'buy-realty'");
  const { generateToken } = await import('../src/middleware/auth.js');
  const owner = generateToken({ id: 999, email: 'x@buy.test', role: 'admin', tenant_id: t.id });
  assert.equal((await call('POST', '/platform/billing/sync', { auth: owner, host: 'buy-realty.homes.test' })).status, 403);
  assert.equal((await call('PUT', '/platform/plans', { auth: owner, host: 'buy-realty.homes.test', body: {} })).status, 403);

  // Stripe down at boot: a logged line, no exception.
  const saved = globalThis.fetch;
  globalThis.fetch = async (input, init) => (String(input?.url || input).startsWith('https://api.stripe.com/')
    ? json(500, { error: { message: 'Stripe is having a moment' } })
    : saved(input, init));
  try {
    mods.setup.clearPlanPriceCache();
    const boot = await mods.setup.syncStripeOnBoot({ pool: db.pool });
    assert.match(boot.plans.error, /having a moment/);
  } finally {
    globalThis.fetch = saved;
    mods.setup.clearPlanPriceCache();
  }
});
