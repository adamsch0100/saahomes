/**
 * Stripe that sets itself up from STRIPE_SECRET_KEY alone.
 *
 *  - ensureStripeCatalog(): our Product (fixed id, metadata app=brokerages)
 *    and one tiered Price per plan and interval, found by lookup key
 *    (brokerages_team_month, ...). When the owner changes a plan's numbers a
 *    new Price takes over the lookup key (transfer_lookup_key) and the old
 *    one stays active, so existing subscribers keep what they signed up for.
 *  - ensureStripeWebhook(): when STRIPE_WEBHOOK_SECRET isn't set, creates our
 *    webhook endpoint once at https://<site>/api/billing/webhook and keeps its
 *    signing secret encrypted in platform_settings (secretBox.js).
 *
 * The Stripe account is shared with another product (ListLogic). Nothing
 * here lists-and-changes anything that isn't ours: prices are only looked up
 * by our own lookup keys, and a product, price or webhook without metadata
 * app=brokerages is left alone. Both run at startup in the background and
 * from the platform console's "Sync plans to Stripe"; neither ever throws.
 * What was set up is kept per mode (test and live keys are separate worlds)
 * under platform_settings 'stripe_test' / 'stripe_live'.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  STRIPE_APP, stripeConfigured, stripeMode, stripeRequest, seatPriceId, setPlansReady,
} from './stripe.js';
import { getSetting, mergeSetting } from './platformSettings.js';
import { ALL_LOOKUP_KEYS, allTerms, loadPlanCatalog } from './plans.js';
import { canSeal, open, seal } from './secretBox.js';

export const PRODUCT_ID = 'brokerages_platform';
export const WEBHOOK_PATH = '/api/billing/webhook';
export const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
];
// Advisory locks so two instances booting together don't both create things.
const CATALOG_LOCK = 833712;
const WEBHOOK_LOCK = 833713;
const PRICE_CACHE_MS = 10 * 60 * 1000;
const PRICE_ERROR_CACHE_MS = 60 * 1000;
const SECRET_CACHE_MS = 60 * 1000;

const ours = (obj) => obj?.metadata?.app === STRIPE_APP;
const stateKey = () => `stripe_${stripeMode() || 'none'}`;
const iso = () => new Date().toISOString();

async function readState(pool) {
  try {
    return (await getSetting(stateKey(), { pool })) || {};
  } catch {
    return {};
  }
}

async function writeState(pool, patch) {
  try {
    await mergeSetting(stateKey(), patch, { pool });
  } catch (e) {
    logger.warn('could not save the Stripe setup state', { message: e.message });
  }
}

async function withLock(pool, key, fn) {
  let client;
  try {
    client = await pool.connect();
  } catch {
    return fn();
  }
  try {
    const r = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [key]);
    if (!r.rows[0]?.ok) return { skipped: 'busy' };
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

// ───────────────────────────────────────────────────────────── prices

/** Stripe's tiers for one plan: the base covers the included seats, then a price per seat. */
export function tiersFor(terms) {
  return [
    { up_to: terms.included, flat_amount: terms.base_cents, unit_amount: 0 },
    { up_to: 'inf', unit_amount: terms.extra_cents },
  ];
}

function priceMetadata(terms) {
  return {
    app: STRIPE_APP,
    plan: terms.plan,
    interval: terms.interval,
    included: String(terms.included),
    base_cents: String(terms.base_cents),
    extra_cents: String(terms.extra_cents),
  };
}

/** Does this Stripe price charge exactly these terms? Reads its tiers when expanded, else our metadata. */
export function priceMatches(price, terms) {
  if (!price || String(price.currency || '').toLowerCase() !== terms.currency) return false;
  if (price.recurring?.interval !== terms.interval || price.billing_scheme !== 'tiered' || price.tiers_mode !== 'graduated') return false;
  if (Array.isArray(price.tiers)) {
    const [a, b] = price.tiers;
    return price.tiers.length === 2
      && Number(a.up_to) === terms.included && Number(a.flat_amount || 0) === terms.base_cents && Number(a.unit_amount || 0) === 0
      && b.up_to == null && Number(b.unit_amount || 0) === terms.extra_cents && Number(b.flat_amount || 0) === 0;
  }
  const m = price.metadata || {};
  return Number(m.included) === terms.included && Number(m.base_cents) === terms.base_cents && Number(m.extra_cents) === terms.extra_cents;
}

/**
 * What a subscription's price charges, from the price itself: our plan
 * prices carry their terms in metadata; any other price is per seat.
 */
export function termsFromPrice(price) {
  if (!price || typeof price !== 'object') return null;
  const m = price.metadata || {};
  const interval = price.recurring?.interval || m.interval || 'month';
  const currency = String(price.currency || 'usd').toLowerCase();
  if (ours(price) && m.plan && Number.isFinite(Number(m.base_cents))) {
    return {
      plan: m.plan,
      interval,
      currency,
      included: Number(m.included) || 1,
      base_cents: Number(m.base_cents),
      extra_cents: Number(m.extra_cents) || 0,
    };
  }
  if (price.unit_amount != null) return { plan: 'legacy', interval, currency, unit_cents: Number(price.unit_amount) };
  return null;
}

/** Every price holding one of our lookup keys (active ones, or inactive with active: false). */
async function lookupPrices({ active = true } = {}) {
  const list = await stripeRequest('GET', '/prices', {
    lookup_keys: ALL_LOOKUP_KEYS,
    active,
    limit: 100,
    expand: ['data.tiers'],
  });
  return (list?.data || []).filter((p) => p && ALL_LOOKUP_KEYS.includes(p.lookup_key));
}

let priceCache = { at: 0, ttl: 0, map: null };

/**
 * Our plan prices in Stripe, by lookup key (cached ten minutes). Also tells
 * stripe.js whether every plan can be bought. Empty without a key or when
 * Stripe can't be reached.
 */
export async function findPlanPrices({ fresh = false } = {}) {
  if (!stripeConfigured()) {
    setPlansReady(false);
    return new Map();
  }
  if (!fresh && priceCache.map && Date.now() - priceCache.at < priceCache.ttl) return priceCache.map;
  try {
    const map = new Map();
    for (const p of await lookupPrices()) if (ours(p)) map.set(p.lookup_key, p);
    priceCache = { at: Date.now(), ttl: PRICE_CACHE_MS, map };
    setPlansReady(ALL_LOOKUP_KEYS.every((k) => map.has(k)));
  } catch (e) {
    logger.warn('could not look up the plan prices in Stripe', { message: e.message });
    priceCache = { at: Date.now(), ttl: PRICE_ERROR_CACHE_MS, map: priceCache.map || new Map() };
  }
  return priceCache.map;
}

export function clearPlanPriceCache() {
  priceCache = { at: 0, ttl: 0, map: null };
}

/** The Stripe price for a plan and interval, or null. */
export async function planPrice(lookup) {
  return (await findPlanPrices()).get(lookup) || null;
}

async function ensureProduct() {
  const { productName } = await import('../controllers/signupController.js');
  const name = productName();
  let product = null;
  try {
    product = await stripeRequest('GET', `/products/${PRODUCT_ID}`);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  if (product && !ours(product)) throw new Error(`The Stripe product ${PRODUCT_ID} belongs to something else`);
  if (!product) {
    return {
      ...(await stripeRequest('POST', '/products', {
        id: PRODUCT_ID, name, unit_label: 'agent', metadata: { app: STRIPE_APP },
      })),
      action: 'created',
    };
  }
  if (product.name !== name || product.active === false) {
    return { ...(await stripeRequest('POST', `/products/${PRODUCT_ID}`, { name, active: true })), action: 'updated' };
  }
  return { ...product, action: 'reused' };
}

/**
 * Make Stripe match the plan catalog. Returns { mode, product, prices:
 * [{ lookup_key, id, action: reused|created|replaced }], conflicts } or
 * { skipped } / { error }. Never throws.
 */
export async function ensureStripeCatalog({ pool = getPool(), catalog = null } = {}) {
  if (!stripeConfigured()) return { skipped: 'no_key' };
  const mode = stripeMode();
  try {
    const cat = catalog || (await loadPlanCatalog({ pool, fresh: true }));
    const out = await withLock(pool, CATALOG_LOCK, async () => {
      const product = await ensureProduct();
      const active = await lookupPrices();
      let inactive = null;
      const prices = [];
      const conflicts = [];
      for (const terms of allTerms(cat)) {
        const key = terms.lookup_key;
        let holder = active.find((p) => p.lookup_key === key) || null;
        if (!holder) {
          // An archived price can still hold the key; it has to be handed over.
          inactive = inactive || (await lookupPrices({ active: false }));
          holder = inactive.find((p) => p.lookup_key === key) || null;
        }
        if (holder && !ours(holder)) {
          conflicts.push(key);
          continue;
        }
        if (holder?.active !== false && holder && priceMatches(holder, terms)) {
          prices.push({ lookup_key: key, id: holder.id, action: 'reused' });
          continue;
        }
        const created = await stripeRequest('POST', '/prices', {
          product: PRODUCT_ID,
          currency: terms.currency,
          recurring: { interval: terms.interval },
          billing_scheme: 'tiered',
          tiers_mode: 'graduated',
          tiers: tiersFor(terms),
          lookup_key: key,
          transfer_lookup_key: holder ? true : undefined,
          nickname: `${terms.name} (${terms.interval === 'year' ? 'yearly' : 'monthly'})`,
          metadata: priceMetadata(terms),
        });
        prices.push({ lookup_key: key, id: created.id, action: holder ? 'replaced' : 'created' });
      }
      return { mode, product: product.id, product_action: product.action, prices, conflicts };
    });
    if (out.skipped) return out;
    clearPlanPriceCache();
    await findPlanPrices({ fresh: true });
    await writeState(pool, {
      product: out.product,
      prices: Object.fromEntries(out.prices.map((p) => [p.lookup_key, p.id])),
      synced_at: iso(),
      sync_error: out.conflicts.length ? `These lookup keys belong to something else: ${out.conflicts.join(', ')}` : null,
    });
    const changed = out.prices.filter((p) => p.action !== 'reused');
    if (changed.length || out.product_action !== 'reused') {
      logger.info('Stripe plans synced', { mode, product: out.product_action, changed: changed.map((p) => `${p.lookup_key}:${p.action}`) });
    }
    return out;
  } catch (e) {
    logger.error('Stripe plan sync failed', { mode, message: e.message });
    await writeState(pool, { sync_error: e.message, sync_failed_at: iso() });
    return { mode, error: e.message };
  }
}

// ──────────────────────────────────────────────────────────── webhook

/**
 * The site's public https origin, for the webhook URL: PUBLIC_API_URL,
 * PUBLIC_BASE_URL, SITE_URL, then Railway's own domain. Never localhost.
 */
export function publicBaseUrl() {
  const candidates = [
    process.env.PUBLIC_API_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.SITE_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ];
  for (const raw of candidates) {
    const s = String(raw || '').trim();
    if (!s) continue;
    try {
      const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
      if (u.protocol !== 'https:' || !u.hostname.includes('.') || /^(localhost|127\.|0\.0\.0\.0)/.test(u.hostname)) continue;
      return `https://${u.host}`;
    } catch {
      /* not a URL: try the next */
    }
  }
  return null;
}

export const webhookUrl = () => {
  const base = publicBaseUrl();
  return base ? `${base}${WEBHOOK_PATH}` : null;
};

const envWebhookSecret = () => String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const sameEvents = (a = []) => a.length === WEBHOOK_EVENTS.length && WEBHOOK_EVENTS.every((e) => a.includes(e));

let secretCache = { at: 0, mode: null, secrets: null };

/** Secrets a Stripe-Signature may be made with: STRIPE_WEBHOOK_SECRET first, then the one we stored. */
export async function webhookSecrets({ pool = getPool() } = {}) {
  const env = envWebhookSecret();
  const mode = stripeMode();
  if (!secretCache.secrets || secretCache.mode !== mode || Date.now() - secretCache.at > SECRET_CACHE_MS) {
    const state = mode ? await readState(pool) : {};
    const stored = state.webhook?.secret ? open(state.webhook.secret) : null;
    secretCache = { at: Date.now(), mode, secrets: stored ? [stored] : [] };
  }
  return [...new Set([env, ...secretCache.secrets].filter(Boolean))];
}

export function clearWebhookSecretCache() {
  secretCache = { at: 0, mode: null, secrets: null };
}

/**
 * Our webhook endpoint, created once when STRIPE_WEBHOOK_SECRET isn't set.
 * Returns { ready, source: 'env'|'auto', url, action } or { ready: false,
 * skipped | error, note }. Never throws.
 */
export async function ensureStripeWebhook({ pool = getPool() } = {}) {
  if (!stripeConfigured()) return { ready: false, skipped: 'no_key' };
  if (envWebhookSecret()) return { ready: true, source: 'env', action: 'env' };
  const url = webhookUrl();
  if (!url) {
    return {
      ready: false,
      skipped: 'no_public_url',
      note: 'Set SITE_URL to your site’s https address so Stripe can reach it, or set STRIPE_WEBHOOK_SECRET.',
    };
  }
  if (!canSeal()) return { ready: false, skipped: 'no_key_to_store', note: 'Set CREDENTIALS_KEY so the webhook secret can be stored.' };
  try {
    const out = await withLock(pool, WEBHOOK_LOCK, async () => {
      const state = await readState(pool);
      const known = state.webhook?.id && open(state.webhook.secret) ? state.webhook : null;
      if (known) {
        let endpoint = null;
        try {
          endpoint = await stripeRequest('GET', `/webhook_endpoints/${encodeURIComponent(known.id)}`);
        } catch (e) {
          if (e.status !== 404) throw e;
        }
        if (endpoint && ours(endpoint)) {
          if (endpoint.url === url && sameEvents(endpoint.enabled_events) && endpoint.status !== 'disabled') {
            return { ready: true, source: 'auto', url, action: 'reused' };
          }
          // The site moved, or the events changed: same endpoint, same secret.
          await stripeRequest('POST', `/webhook_endpoints/${encodeURIComponent(known.id)}`, {
            url, enabled_events: WEBHOOK_EVENTS, disabled: false,
          });
          await writeState(pool, { webhook: { ...known, url, updated_at: iso() } });
          return { ready: true, source: 'auto', url, action: 'updated' };
        }
      }
      // Ours at this address but its secret is lost (say, a fresh database):
      // its deliveries could never be checked, so it goes before a new one.
      const list = await stripeRequest('GET', '/webhook_endpoints', { limit: 100 });
      for (const e of list?.data || []) {
        if (ours(e) && e.url === url && e.id !== known?.id) {
          await stripeRequest('DELETE', `/webhook_endpoints/${encodeURIComponent(e.id)}`);
        }
      }
      const created = await stripeRequest('POST', '/webhook_endpoints', {
        url,
        enabled_events: WEBHOOK_EVENTS,
        description: 'Brokerage billing (set up automatically)',
        metadata: { app: STRIPE_APP },
      });
      if (!created?.secret) throw new Error('Stripe didn’t return the webhook signing secret');
      await writeState(pool, {
        webhook: { id: created.id, url, secret: seal(created.secret), created_at: iso() },
        webhook_error: null,
      });
      return { ready: true, source: 'auto', url, action: 'created' };
    });
    clearWebhookSecretCache();
    if (out.action === 'created' || out.action === 'updated') logger.info('Stripe webhook set up', { url, action: out.action });
    return out.skipped ? { ready: false, ...out } : out;
  } catch (e) {
    logger.error('Stripe webhook setup failed', { message: e.message });
    await writeState(pool, { webhook_error: e.message });
    return { ready: false, url, error: e.message };
  }
}

// ───────────────────────────────────────────────────────────── status

/** What the platform console shows about Stripe. */
export async function stripeSetupStatus({ pool = getPool(), catalog = null } = {}) {
  const keyPresent = stripeConfigured();
  const mode = stripeMode();
  const status = {
    key_present: keyPresent,
    mode,
    legacy_price: !!seatPriceId(),
    public_url: publicBaseUrl(),
    plans: { synced: false, missing: [], outdated: [], synced_at: null, error: null },
    webhook: { ready: false, source: null, url: webhookUrl(), note: null },
  };
  if (!keyPresent) {
    status.webhook.note = 'Add STRIPE_SECRET_KEY to turn billing on.';
    return status;
  }
  const state = await readState(pool);
  const cat = catalog || (await loadPlanCatalog({ pool }));
  const prices = await findPlanPrices();
  for (const terms of allTerms(cat)) {
    const p = prices.get(terms.lookup_key);
    if (!p) status.plans.missing.push(terms.lookup_key);
    else if (!priceMatches(p, terms)) status.plans.outdated.push(terms.lookup_key);
  }
  status.plans.synced = !status.plans.missing.length && !status.plans.outdated.length;
  status.plans.synced_at = state.synced_at || null;
  status.plans.error = state.sync_error || null;

  if (envWebhookSecret()) {
    status.webhook = { ...status.webhook, ready: true, source: 'env' };
  } else if (state.webhook?.id && open(state.webhook.secret)) {
    status.webhook = { ...status.webhook, ready: true, source: 'auto', url: state.webhook.url };
    if (status.webhook.url !== webhookUrl() && webhookUrl()) status.webhook.note = 'Your site address changed; sync to move the webhook.';
  } else if (!publicBaseUrl()) {
    status.webhook.note = 'Set SITE_URL to your site’s https address so Stripe can reach it, or set STRIPE_WEBHOOK_SECRET.';
  } else {
    status.webhook.note = state.webhook_error || 'Not set up yet. Sync to create it.';
  }
  return status;
}

/** Startup: plans then webhook, in the background, with a clear line in the logs. */
export async function syncStripeOnBoot({ pool = getPool() } = {}) {
  try {
    if (!stripeConfigured()) {
      console.log('Stripe: STRIPE_SECRET_KEY not set; billing is off (brokerages keep their trials)');
      return { skipped: 'no_key' };
    }
    const plans = await ensureStripeCatalog({ pool });
    const webhook = await ensureStripeWebhook({ pool });
    const planLine = plans.error ? `plans not synced (${plans.error})`
      : plans.skipped ? `plans ${plans.skipped}`
        : `${plans.prices.length} plan prices ready${plans.conflicts.length ? `, ${plans.conflicts.length} lookup keys taken by something else` : ''}`;
    const hookLine = webhook.ready ? `webhook ready (${webhook.source === 'env' ? 'STRIPE_WEBHOOK_SECRET' : webhook.url})`
      : `webhook not set up: ${webhook.note || webhook.error || webhook.skipped}`;
    console.log(`Stripe (${stripeMode()} mode): ${planLine}; ${hookLine}`);
    return { plans, webhook };
  } catch (e) {
    console.error('Stripe setup skipped:', e.message);
    return { error: e.message };
  }
}
