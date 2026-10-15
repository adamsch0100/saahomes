/**
 * Brokerage billing: a 14-day free trial, then a plan (plans.js) billed
 * monthly or yearly through Stripe, the subscription quantity following the
 * brokerage's active seats. Kept in tenants.settings.billing:
 *
 *   { status, trial_ends_at, grace_ends_at, current_period_end, customer,
 *     subscription, subscription_item, seats_billed, stripe_status,
 *     suspended, suspended_at, last_event_at,
 *     plan, interval,            the plan chosen (at signup, in Billing, or in Stripe)
 *     price_id, price_terms }    what the subscription's price charges, from Stripe
 *
 * status: trialing → active (paid) | grace (trial over, no payment yet) |
 * past_due (a payment failed) | canceled. Grace, past_due and canceled get
 * seven days; after that the sweep pauses the brokerage (tenants.status
 * 'suspended', billing.suspended true), and a payment brings it straight
 * back. The home brokerage (SAA, tenant 1) is never billed or paused.
 * Every function takes `now` so tests can move the clock.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  DEFAULT_TENANT_ID, clearTenantCache, consoleUrlFor,
} from './tenantContext.js';
import {
  STRIPE_APP, billingReady, plansReady, seatPriceId, seatPrice, stripeRequest, stripeConfigured,
} from './stripe.js';
import {
  findPlan, isInterval, loadPlanCatalog, lookupKey, cheapestPlan, monthlyCents, periodCents,
  planAdvice, planTerms, publicCatalog,
} from './plans.js';
import {
  ensureStripeCatalog, findPlanPrices, planPrice, termsFromPrice,
} from './stripeSetup.js';

export const TRIAL_DAYS = () => Math.max(1, Number(process.env.BROKERAGE_TRIAL_DAYS) || 14);
export const GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// Stripe Checkout needs a trial end at least two days away.
const MIN_CHECKOUT_TRIAL_MS = 2 * DAY_MS + 60 * 60 * 1000;
const GRACE_STATUSES = new Set(['grace', 'past_due', 'canceled']);

const iso = (ms) => new Date(ms).toISOString();
const ms = (v) => (v ? new Date(v).getTime() : NaN);
const isHome = (id) => Number(id) === DEFAULT_TENANT_ID;

/** The billing record a new brokerage starts with (and the plan it picked, if any). */
export function newTrial(now = Date.now(), { plan, interval } = {}) {
  const t = { status: 'trialing', trial_ends_at: iso(now + TRIAL_DAYS() * DAY_MS), started_at: iso(now) };
  if (plan) t.plan = plan;
  if (plan && interval) t.interval = interval;
  return t;
}

/**
 * A plan + interval someone asked for, checked against the catalog:
 * { plan, interval }, or null when it isn't a real plan.
 */
export function planChoice(catalog, plan, interval = 'month') {
  const key = String(plan || '').trim().toLowerCase();
  const iv = String(interval || 'month').trim().toLowerCase();
  if (!findPlan(catalog, key) || !isInterval(iv)) return null;
  return { plan: key, interval: iv };
}

const hasLiveSubscription = (b) => !!b.subscription && b.status !== 'canceled';

/**
 * What this brokerage is (or will be) charged per period: the terms of the
 * price its subscription is on (read from Stripe), else the plan it picked,
 * else the legacy per-seat price, else the cheapest plan for its team.
 * chosen is false when nobody has picked a plan yet.
 */
export function termsFor(b, catalog, { seats = 1, legacyPrice = null } = {}) {
  if (hasLiveSubscription(b) && b.price_terms && (b.price_terms.unit_cents != null || b.price_terms.base_cents != null)) {
    const plan = findPlan(catalog, b.price_terms.plan);
    return { ...b.price_terms, name: plan?.name || 'Per agent', chosen: true };
  }
  const onLegacy = !!legacyPrice && !plansReady();
  const choice = planChoice(catalog, b.plan, b.interval);
  if (choice && !onLegacy) return { ...planTerms(catalog, choice.plan, choice.interval), chosen: true };
  if (onLegacy) {
    return {
      plan: 'legacy',
      name: 'Per agent',
      interval: legacyPrice.interval || 'month',
      currency: String(legacyPrice.currency || 'usd').toLowerCase(),
      unit_cents: Math.round(legacyPrice.amount * 100),
      chosen: true,
    };
  }
  const best = cheapestPlan(catalog, seats, 'month');
  return { ...planTerms(catalog, best.key, 'month'), chosen: false };
}

/** Monthly recurring revenue from one brokerage, in cents: paying subscriptions only. */
export function mrrCents(b, catalog, seats = 1) {
  if (!b || !hasLiveSubscription(b) || !['active', 'past_due'].includes(b.status)) return 0;
  return monthlyCents(termsFor(b, catalog, { seats }), b.seats_billed ?? seats) || 0;
}

/** Active staff (owner + agents): what the brokerage pays for. */
export async function countSeats(tenantId, pool = getPool()) {
  const r = await pool.query(
    "SELECT COUNT(*)::int AS n FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin') AND status = 'active'",
    [tenantId]
  );
  return Math.max(1, r.rows[0]?.n || 0);
}

async function loadTenant(pool, tenantId) {
  const r = await pool.query('SELECT id, slug, name, primary_domain, status, settings FROM tenants WHERE id = $1', [tenantId]);
  const t = r.rows[0];
  return t ? { ...t, id: Number(t.id), settings: t.settings || {}, site_host: null, agent: null } : null;
}

/**
 * Merge a patch into settings.billing (and optionally set tenants.status).
 * Never touches the home brokerage.
 */
export async function writeBilling(pool, tenantId, patch, { status } = {}) {
  if (isHome(tenantId)) return;
  await pool.query(
    `UPDATE tenants
        SET settings = jsonb_set(settings, '{billing}', COALESCE(settings->'billing', '{}'::jsonb) || $1::jsonb),
            status = COALESCE($3, status)
      WHERE id = $2 AND id <> ${DEFAULT_TENANT_ID}`,
    [JSON.stringify(patch), tenantId, status || null]
  );
  clearTenantCache();
}

/** What the owner's Billing card and banners show. */
export function billingSummary(tenant, { seats = 1, now = Date.now(), price = null, catalog = null } = {}) {
  if (isHome(tenant?.id)) return { exempt: true, configured: billingReady(), status: 'exempt' };
  const b = tenant?.settings?.billing || {};
  const status = b.status || 'none';
  const trialLeft = Number.isFinite(ms(b.trial_ends_at)) ? Math.max(0, Math.ceil((ms(b.trial_ends_at) - now) / DAY_MS)) : null;
  const graceLeft = Number.isFinite(ms(b.grace_ends_at)) ? Math.max(0, Math.ceil((ms(b.grace_ends_at) - now) / DAY_MS)) : null;
  const suspended = b.suspended === true;
  const hasSubscription = !!b.subscription && !['canceled'].includes(status);
  let banner = null;
  if (suspended) {
    banner = { kind: 'error', text: 'Your site is paused because the free trial ended without a payment method. Subscribe to bring it back right away.' };
  } else if (GRACE_STATUSES.has(status)) {
    const when = b.grace_ends_at ? new Date(b.grace_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'soon';
    banner = {
      kind: 'warning',
      text: status === 'past_due'
        ? `Your last payment didn’t go through. Update your payment method by ${when} to keep your site live.`
        : status === 'canceled'
          ? `Your subscription has ended. Subscribe again by ${when} to keep your site live.`
          : `Your free trial has ended. Add a payment method by ${when} to keep your site live.`,
    };
  } else if (status === 'trialing' && !hasSubscription && trialLeft != null && trialLeft <= 3 && billingReady()) {
    banner = { kind: 'info', text: `${trialLeft === 0 ? 'Your free trial ends today' : `${trialLeft} day${trialLeft === 1 ? '' : 's'} left in your free trial`}. Add a payment method to keep everything running.` };
  }
  const plan = catalog ? termsFor(b, catalog, { seats, legacyPrice: price }) : null;
  return {
    exempt: false,
    configured: billingReady(),
    // 'plans' when the plan prices are in Stripe, 'legacy' on the old single price, 'none' before Stripe.
    billing_mode: plansReady() ? 'plans' : billingReady() ? 'legacy' : 'none',
    status,
    suspended,
    trial_ends_at: b.trial_ends_at || null,
    trial_days_left: status === 'trialing' ? trialLeft : null,
    grace_ends_at: GRACE_STATUSES.has(status) ? b.grace_ends_at || null : null,
    grace_days_left: GRACE_STATUSES.has(status) ? graceLeft : null,
    current_period_end: b.current_period_end || null,
    has_subscription: hasSubscription,
    has_customer: !!b.customer,
    seats,
    seats_billed: b.seats_billed ?? null,
    price,
    plan: plan ? {
      key: plan.plan,
      name: plan.name,
      interval: plan.interval,
      currency: plan.currency,
      included: plan.included ?? null,
      base_cents: plan.base_cents ?? null,
      extra_cents: plan.extra_cents ?? null,
      unit_cents: plan.unit_cents ?? null,
      legacy: plan.plan === 'legacy',
      chosen: plan.chosen,
    } : null,
    // The next bill at today's seat count: at the end of the trial, or of this period.
    estimate: plan ? {
      amount_cents: periodCents(plan, seats),
      currency: plan.currency,
      interval: plan.interval,
      extra_agents: plan.included != null ? Math.max(0, seats - plan.included) : null,
      due_at: status === 'trialing' && !hasSubscription ? b.trial_ends_at || null : b.current_period_end || null,
    } : null,
    ...(plan ? planAdvice(catalog, plan, seats) : { over_plan: null, suggestion: null }),
    catalog: catalog ? publicCatalog(catalog) : null,
    can_switch: hasSubscription && plansReady(),
    banner,
  };
}

/** GET-side helper: summary for a tenant row, with live seats, the plans and Stripe's prices. */
export async function billingFor(tenant, { pool = getPool(), now = Date.now() } = {}) {
  if (isHome(tenant?.id)) return billingSummary(tenant);
  const seats = await countSeats(tenant.id, pool);
  if (stripeConfigured()) await findPlanPrices();
  const catalog = await loadPlanCatalog({ pool });
  return billingSummary(tenant, { seats, now, price: await seatPrice(), catalog });
}

async function unsuspendIfNeeded(pool, tenant, patch, now) {
  if (tenant.settings?.billing?.suspended === true) {
    patch.suspended = false;
    patch.reactivated_at = iso(now);
    await writeBilling(pool, tenant.id, patch, { status: 'active' });
    logger.info('brokerage reactivated after payment', { tenant_id: tenant.id });
    return;
  }
  await writeBilling(pool, tenant.id, patch);
}

function periodEnd(sub) {
  const t = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return Number.isFinite(Number(t)) && Number(t) > 0 ? iso(Number(t) * 1000) : null;
}

/** Bring settings.billing in line with a Stripe subscription object. */
export async function applySubscription(pool, tenant, sub, { now = Date.now(), deleted = false } = {}) {
  const b = tenant.settings?.billing || {};
  const item = sub?.items?.data?.[0] || null;
  const stripeStatus = deleted ? 'canceled' : String(sub?.status || '').toLowerCase();
  const patch = {
    stripe_status: stripeStatus,
    subscription: sub?.id || b.subscription || null,
    customer: sub?.customer || b.customer || null,
    current_period_end: periodEnd(sub) || b.current_period_end || null,
    updated_at: iso(now),
  };
  if (item?.id) patch.subscription_item = item.id;
  if (item?.quantity != null) patch.seats_billed = Number(item.quantity);
  // The plan follows the price, wherever it was changed (here, the portal, the dashboard).
  const price = item?.price && typeof item.price === 'object' ? item.price : null;
  if (price?.id) {
    patch.price_id = price.id;
    const terms = termsFromPrice(price);
    if (terms) {
      patch.price_terms = terms;
      if (terms.plan !== 'legacy') {
        patch.plan = terms.plan;
        patch.interval = terms.interval;
      }
    }
  }

  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    patch.status = stripeStatus;
    patch.grace_ends_at = null;
    return unsuspendIfNeeded(pool, tenant, patch, now);
  }
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
    patch.status = 'past_due';
    patch.grace_ends_at = GRACE_STATUSES.has(b.status) && b.grace_ends_at ? b.grace_ends_at : iso(now + GRACE_DAYS * DAY_MS);
    return writeBilling(pool, tenant.id, patch);
  }
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
    patch.status = 'canceled';
    patch.grace_ends_at = GRACE_STATUSES.has(b.status) && b.grace_ends_at ? b.grace_ends_at : iso(now + GRACE_DAYS * DAY_MS);
    return writeBilling(pool, tenant.id, patch);
  }
  // incomplete / paused: record what Stripe says, change nothing else.
  return writeBilling(pool, tenant.id, patch);
}

/**
 * Move every brokerage's billing along the clock: a trial that ended with no
 * subscription starts its seven-day grace; a grace that ran out pauses the
 * site. Returns what changed.
 */
export async function runBillingSweep({ pool = getPool(), now = Date.now() } = {}) {
  // No way to pay yet: nobody's trial runs out and nobody is paused.
  if (stripeConfigured() && !seatPriceId()) await findPlanPrices();
  if (!billingReady()) return [];
  const r = await pool.query(
    `SELECT id, slug, name, primary_domain, status, settings FROM tenants
      WHERE id <> ${DEFAULT_TENANT_ID} AND settings ? 'billing'`
  );
  const changes = [];
  for (const row of r.rows) {
    const b = row.settings?.billing || {};
    const id = Number(row.id);
    try {
      if (b.status === 'trialing' && !b.subscription && Number.isFinite(ms(b.trial_ends_at)) && ms(b.trial_ends_at) <= now) {
        await writeBilling(pool, id, { status: 'grace', grace_ends_at: iso(ms(b.trial_ends_at) + GRACE_DAYS * DAY_MS), updated_at: iso(now) });
        changes.push({ tenant_id: id, to: 'grace' });
        // The grace may already be over (a sweep that didn't run for a week).
        if (ms(b.trial_ends_at) + GRACE_DAYS * DAY_MS > now) continue;
        b.status = 'grace';
        b.grace_ends_at = iso(ms(b.trial_ends_at) + GRACE_DAYS * DAY_MS);
      }
      if (GRACE_STATUSES.has(b.status) && !b.suspended && row.status === 'active'
          && Number.isFinite(ms(b.grace_ends_at)) && ms(b.grace_ends_at) <= now) {
        await writeBilling(pool, id, { suspended: true, suspended_at: iso(now) }, { status: 'suspended' });
        changes.push({ tenant_id: id, to: 'suspended' });
        logger.info('brokerage paused for billing', { tenant_id: id });
      }
    } catch (e) {
      logger.error('billing sweep failed for tenant', { tenant_id: id, message: e.message });
    }
  }
  return changes;
}

/** The brokerage a Stripe object belongs to: its metadata, else its customer. */
async function tenantForStripe(pool, obj) {
  const meta = obj?.metadata || {};
  if (meta.app && meta.app !== STRIPE_APP) return null; // another product on the same account
  const byMeta = Number(meta.tenant_id || obj?.client_reference_id);
  if (Number.isInteger(byMeta) && byMeta > 0 && !isHome(byMeta)) {
    const t = await loadTenant(pool, byMeta);
    if (t) return t;
  }
  const customer = typeof obj?.customer === 'string' ? obj.customer : obj?.customer?.id;
  if (!customer) return null;
  const r = await pool.query(
    `SELECT id FROM tenants WHERE id <> ${DEFAULT_TENANT_ID} AND settings->'billing'->>'customer' = $1 LIMIT 1`,
    [customer]
  );
  return r.rows[0] ? loadTenant(pool, Number(r.rows[0].id)) : null;
}

/**
 * Apply one verified Stripe event. Events for another product on the same
 * account, or for no brokerage we know, are acknowledged and ignored.
 */
export async function handleStripeEvent(event, { pool = getPool(), now = Date.now() } = {}) {
  const type = String(event?.type || '');
  const obj = event?.data?.object || {};
  const created = Number(event?.created) || Math.floor(now / 1000);

  if (type === 'checkout.session.completed') {
    if (obj.mode && obj.mode !== 'subscription') return { ignored: type };
    const tenant = await tenantForStripe(pool, obj);
    if (!tenant) return { ignored: type };
    const patch = { customer: obj.customer || tenant.settings.billing?.customer || null, updated_at: iso(now) };
    if (obj.subscription) patch.subscription = obj.subscription;
    await writeBilling(pool, tenant.id, patch);
    if (obj.subscription && stripeConfigured()) {
      try {
        const sub = await stripeRequest('GET', `/subscriptions/${encodeURIComponent(obj.subscription)}`);
        await applySubscription(pool, await loadTenant(pool, tenant.id), sub, { now });
      } catch (e) {
        logger.warn('could not read the new subscription', { tenant_id: tenant.id, message: e.message });
      }
    }
    return { tenant_id: tenant.id, applied: type };
  }

  if (type.startsWith('customer.subscription.')) {
    const tenant = await tenantForStripe(pool, obj);
    if (!tenant) return { ignored: type };
    const last = Number(tenant.settings.billing?.last_event_at) || 0;
    if (created < last) return { tenant_id: tenant.id, ignored: 'stale' };
    await applySubscription(pool, tenant, obj, { now, deleted: type === 'customer.subscription.deleted' });
    await writeBilling(pool, tenant.id, { last_event_at: created });
    return { tenant_id: tenant.id, applied: type };
  }

  if (type === 'invoice.payment_failed' || type === 'invoice.paid') {
    const tenant = await tenantForStripe(pool, { customer: obj.customer, metadata: obj.subscription_details?.metadata || {} });
    if (!tenant) return { ignored: type };
    const b = tenant.settings.billing || {};
    if (type === 'invoice.payment_failed') {
      await writeBilling(pool, tenant.id, {
        status: 'past_due',
        grace_ends_at: GRACE_STATUSES.has(b.status) && b.grace_ends_at ? b.grace_ends_at : iso(now + GRACE_DAYS * DAY_MS),
        updated_at: iso(now),
      });
    } else if (GRACE_STATUSES.has(b.status) || b.suspended) {
      await unsuspendIfNeeded(pool, tenant, { status: 'active', grace_ends_at: null, updated_at: iso(now) }, now);
    }
    return { tenant_id: tenant.id, applied: type };
  }
  return { ignored: type };
}

async function ensureCustomer(pool, tenant, owner) {
  const existing = tenant.settings?.billing?.customer;
  if (existing) return existing;
  const c = await stripeRequest('POST', '/customers', {
    email: owner?.email || undefined,
    name: tenant.settings?.brand?.name || tenant.name,
    metadata: { app: STRIPE_APP, tenant_id: String(tenant.id), slug: tenant.slug },
  }, { idempotencyKey: `brokerage-customer-${tenant.id}` });
  await writeBilling(pool, tenant.id, { customer: c.id });
  return c.id;
}

/**
 * The Stripe price to sell a plan with: our plan price by lookup key (set
 * up now if it's missing), else the legacy seat price. Null when neither.
 */
async function priceToSell(pool, choice) {
  const key = lookupKey(choice.plan, choice.interval);
  let price = await planPrice(key);
  if (!price && !seatPriceId()) {
    await ensureStripeCatalog({ pool });
    price = await planPrice(key);
  }
  if (price) return { id: price.id, legacy: false };
  return seatPriceId() ? { id: seatPriceId(), legacy: true } : null;
}

/**
 * A Stripe Checkout page for the plan the owner picked (now, or earlier at
 * signup or in Billing): quantity = active staff, and the days left in the
 * free trial carried over (Stripe needs at least two days; with less,
 * billing starts now).
 */
export async function createCheckout(reqTenant, owner, { pool = getPool(), now = Date.now(), plan, interval } = {}) {
  if (isHome(reqTenant.id)) throw Object.assign(new Error('This brokerage isn’t billed'), { status: 400 });
  if (!stripeConfigured()) throw Object.assign(new Error('Billing isn’t set up yet'), { status: 503 });
  const tenant = { ...(await loadTenant(pool, reqTenant.id)), site_host: reqTenant.site_host || null };
  const b = tenant.settings?.billing || {};
  const catalog = await loadPlanCatalog({ pool });
  const seats = await countSeats(tenant.id, pool);
  let choice;
  if (plan) {
    choice = planChoice(catalog, plan, interval);
    if (!choice) throw Object.assign(new Error('Pick one of the plans'), { status: 400 });
  } else {
    choice = planChoice(catalog, b.plan, b.interval) || { plan: cheapestPlan(catalog, seats, 'month').key, interval: 'month' };
  }
  const price = await priceToSell(pool, choice);
  if (!price) throw Object.assign(new Error('Billing isn’t set up yet'), { status: 503 });
  if (!price.legacy && (choice.plan !== b.plan || choice.interval !== b.interval)) {
    await writeBilling(pool, tenant.id, { plan: choice.plan, interval: choice.interval });
  }
  const customer = await ensureCustomer(pool, tenant, owner);
  const trialEnd = ms(b.trial_ends_at);
  const planMeta = price.legacy ? { plan: 'legacy' } : { plan: choice.plan, interval: choice.interval };
  const subscriptionData = { metadata: { app: STRIPE_APP, tenant_id: String(tenant.id), ...planMeta } };
  if (b.status === 'trialing' && Number.isFinite(trialEnd) && trialEnd - now >= MIN_CHECKOUT_TRIAL_MS) {
    subscriptionData.trial_end = Math.floor(trialEnd / 1000);
  }
  const session = await stripeRequest('POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: String(tenant.id),
    line_items: [{ price: price.id, quantity: seats }],
    success_url: consoleUrlFor(tenant, '/admin?billing=success'),
    cancel_url: consoleUrlFor(tenant, '/admin?billing=cancel'),
    metadata: { app: STRIPE_APP, tenant_id: String(tenant.id), seats: String(seats), ...planMeta },
    subscription_data: subscriptionData,
    allow_promotion_codes: true,
    payment_method_collection: 'always',
  });
  return { url: session.url, id: session.id };
}

/**
 * Pick or switch plans. Before there's a subscription this only remembers
 * the choice (checkout uses it). With one, the subscription's item moves to
 * the new plan's price at the current seat count, prorated.
 */
export async function changePlan(reqTenant, { plan, interval } = {}, { pool = getPool() } = {}) {
  if (isHome(reqTenant.id)) throw Object.assign(new Error('This brokerage isn’t billed'), { status: 400 });
  const catalog = await loadPlanCatalog({ pool });
  const choice = planChoice(catalog, plan, interval);
  if (!choice) throw Object.assign(new Error('Pick one of the plans'), { status: 400 });
  const tenant = await loadTenant(pool, reqTenant.id);
  const b = tenant?.settings?.billing || {};
  if (!hasLiveSubscription(b) || !b.subscription_item) {
    await writeBilling(pool, tenant.id, { plan: choice.plan, interval: choice.interval, updated_at: iso(Date.now()) });
    return { saved: true, switched: false, ...choice };
  }
  if (!stripeConfigured()) throw Object.assign(new Error('Billing isn’t set up yet'), { status: 503 });
  const price = await planPrice(lookupKey(choice.plan, choice.interval));
  if (!price) throw Object.assign(new Error('That plan isn’t available yet. Please try again in a few minutes.'), { status: 503 });
  if (b.price_id === price.id) return { saved: true, switched: false, unchanged: true, ...choice };
  const seats = await countSeats(tenant.id, pool);
  const sub = await stripeRequest('POST', `/subscriptions/${encodeURIComponent(b.subscription)}`, {
    items: [{ id: b.subscription_item, price: price.id, quantity: seats }],
    proration_behavior: 'create_prorations',
    metadata: { app: STRIPE_APP, tenant_id: String(tenant.id), plan: choice.plan, interval: choice.interval },
  });
  await writeBilling(pool, tenant.id, { plan: choice.plan, interval: choice.interval });
  if (sub?.id) await applySubscription(pool, await loadTenant(pool, tenant.id), sub);
  logger.info('brokerage switched plans', { tenant_id: tenant.id, ...choice, seats });
  return { saved: true, switched: true, ...choice };
}

/** Stripe's customer portal: cards, invoices, cancel. */
export async function createPortal(reqTenant, { pool = getPool() } = {}) {
  if (!stripeConfigured()) throw Object.assign(new Error('Billing isn’t set up yet'), { status: 503 });
  const tenant = { ...(await loadTenant(pool, reqTenant.id)), site_host: reqTenant.site_host || null };
  const customer = tenant.settings?.billing?.customer;
  if (!customer) throw Object.assign(new Error('Subscribe first, then you can manage billing here'), { status: 400 });
  const portal = await stripeRequest('POST', '/billing_portal/sessions', {
    customer,
    return_url: consoleUrlFor(tenant, '/admin?billing=portal'),
  });
  return { url: portal.url };
}

/**
 * After agents are added or removed: set the subscription's quantity to the
 * active staff count. Quietly does nothing before there is a subscription.
 */
export async function syncSeats(tenantId, { pool = getPool() } = {}) {
  if (isHome(tenantId) || !stripeConfigured()) return { skipped: 'not_configured' };
  const tenant = await loadTenant(pool, tenantId);
  const b = tenant?.settings?.billing || {};
  if (!b.subscription_item || b.status === 'canceled') return { skipped: 'no_subscription' };
  const seats = await countSeats(tenantId, pool);
  if (Number(b.seats_billed) === seats) return { skipped: 'unchanged', seats };
  await stripeRequest('POST', `/subscription_items/${encodeURIComponent(b.subscription_item)}`, {
    quantity: seats,
    proration_behavior: 'create_prorations',
  });
  await writeBilling(pool, tenantId, { seats_billed: seats });
  logger.info('seat count synced to Stripe', { tenant_id: tenantId, seats });
  return { ok: true, seats };
}

let sweepTimer = null;

/** Hourly sweep (and once shortly after start). */
export function startBillingScheduler() {
  if (sweepTimer) return;
  const run = () => runBillingSweep().catch((e) => logger.error('billing sweep failed', { message: e.message }));
  setTimeout(run, 30 * 1000).unref?.();
  sweepTimer = setInterval(run, 60 * 60 * 1000);
  sweepTimer.unref?.();
}
