/**
 * The plan catalog: what a brokerage pays, in one place.
 *
 * Each plan is a monthly base that includes some agents, then a price for
 * each agent past that. Yearly billing is the monthly amounts times
 * yearly_months (10: two months free). In Stripe each plan and interval is
 * one tiered Price (graduated): the first `included` seats for the flat base,
 * every seat after at the per-agent price; the subscription quantity is the
 * brokerage's active seats (billing.countSeats).
 *
 * The defaults below can be changed from the platform console; the changes
 * live in platform_settings under 'plans' and are merged over the defaults.
 * Amounts here are whole dollars; everything computed is in cents.
 */
import getPool from '../config/database.js';
import { getSetting, putSetting } from './platformSettings.js';

export const CURRENCY = 'usd';
export const INTERVALS = ['month', 'year'];
export const DEFAULT_YEARLY_MONTHS = 10;
export const SETTINGS_KEY = 'plans';
const LOOKUP_PREFIX = 'brokerages';

export const DEFAULT_PLANS = [
  { key: 'team', name: 'Team', monthly: 299, included: 5, extra: 25, tagline: 'For a small team getting its own site.' },
  { key: 'brokerage', name: 'Brokerage', monthly: 699, included: 25, extra: 15, tagline: 'For a growing brokerage.' },
  { key: 'enterprise', name: 'Enterprise', monthly: 1499, included: 100, extra: 8, tagline: 'For large and multi-office brokerages.' },
];

/** What every plan comes with (the plans differ only in seats and price). */
export const FEATURES = [
  'Your own branded home search site and domain',
  'Saved searches and instant new-listing alerts',
  'An AI assistant that answers buyers any time',
  'Follow Up Boss or the built-in CRM',
  'Lead routing, action plans and a team inbox',
];

export const PLAN_KEYS = DEFAULT_PLANS.map((p) => p.key);
export const lookupKey = (planKey, interval) => `${LOOKUP_PREFIX}_${planKey}_${interval}`;
export const ALL_LOOKUP_KEYS = PLAN_KEYS.flatMap((k) => INTERVALS.map((i) => lookupKey(k, i)));

const LIMITS = { monthly: [1, 100000], included: [1, 10000], extra: [0, 10000], yearly_months: [1, 12] };
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

/** Defaults with the owner's changes merged in: { yearly_months, plans: [...] }. */
export function buildCatalog(overrides = null) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  const ym = num(o.yearly_months);
  const plans = DEFAULT_PLANS.map((d) => {
    const p = o.plans?.[d.key] || {};
    const pick = (field) => {
      const v = num(p[field]);
      const [lo, hi] = LIMITS[field];
      return Number.isFinite(v) && v >= lo && v <= hi ? v : d[field];
    };
    return {
      key: d.key,
      name: String(p.name || '').trim().slice(0, 40) || d.name,
      tagline: String(p.tagline || '').trim().slice(0, 120) || d.tagline,
      monthly: pick('monthly'),
      included: Math.round(pick('included')),
      extra: pick('extra'),
    };
  });
  return {
    currency: CURRENCY,
    yearly_months: Number.isInteger(ym) && ym >= LIMITS.yearly_months[0] && ym <= LIMITS.yearly_months[1] ? ym : DEFAULT_YEARLY_MONTHS,
    plans,
  };
}

/**
 * Check what the platform console sends: { yearly_months?, plans: { team:
 * { name?, monthly?, included?, extra? } } }. Returns { value } (only the
 * fields that differ from the defaults are kept) or { error }.
 */
export function validatePlanOverrides(body) {
  const b = body && typeof body === 'object' ? body : {};
  const value = { plans: {} };
  if (b.yearly_months !== undefined && b.yearly_months !== null && b.yearly_months !== '') {
    const ym = num(b.yearly_months);
    if (!Number.isInteger(ym) || ym < 1 || ym > 12) return { error: 'Yearly price must be 1 to 12 months of the monthly price' };
    if (ym !== DEFAULT_YEARLY_MONTHS) value.yearly_months = ym;
  }
  for (const d of DEFAULT_PLANS) {
    const p = b.plans?.[d.key];
    if (!p) continue;
    const out = {};
    for (const field of ['monthly', 'included', 'extra']) {
      if (p[field] === undefined || p[field] === null || p[field] === '') continue;
      const v = num(p[field]);
      const [lo, hi] = LIMITS[field];
      if (!Number.isFinite(v) || v < lo || v > hi || (field === 'included' && !Number.isInteger(v))
          || Math.abs(Math.round(v * 100) - v * 100) > 1e-6) {
        const label = { monthly: 'monthly price', included: 'agents included', extra: 'price per extra agent' }[field];
        return { error: `${d.name}: the ${label} doesn’t look right` };
      }
      if (v !== d[field]) out[field] = v;
    }
    for (const field of ['name', 'tagline']) {
      const s = String(p[field] ?? '').trim();
      if (s && s !== d[field]) out[field] = s.slice(0, field === 'name' ? 40 : 120);
    }
    if (Object.keys(out).length) value.plans[d.key] = out;
  }
  // Bigger plans have to include more agents, or the "next plan" advice is nonsense.
  const built = buildCatalog(value).plans;
  for (let i = 1; i < built.length; i += 1) {
    if (built[i].included <= built[i - 1].included) {
      return { error: `${built[i].name} has to include more agents than ${built[i - 1].name}` };
    }
  }
  return { value };
}

let cache = { at: 0, catalog: null };
const CACHE_MS = 60 * 1000;

/** The catalog (defaults + saved changes), cached a minute. Never throws. */
export async function loadPlanCatalog({ pool, fresh = false } = {}) {
  if (!fresh && cache.catalog && Date.now() - cache.at < CACHE_MS) return cache.catalog;
  let overrides = null;
  try {
    overrides = await getSetting(SETTINGS_KEY, { pool: pool || getPool() });
  } catch {
    overrides = null; // no database (or table) yet: the defaults
  }
  cache = { at: Date.now(), catalog: buildCatalog(overrides) };
  return cache.catalog;
}

/** The last catalog loaded, or the defaults (for code that can't wait). */
export const currentCatalog = () => cache.catalog || buildCatalog();

export async function savePlanOverrides(value, { pool = getPool() } = {}) {
  await putSetting(SETTINGS_KEY, value, { pool });
  clearPlanCache();
  return loadPlanCatalog({ pool, fresh: true });
}

export function clearPlanCache() {
  cache = { at: 0, catalog: null };
}

export const findPlan = (catalog, key) => catalog.plans.find((p) => p.key === key) || null;
export const isInterval = (v) => INTERVALS.includes(v);

/** One plan + interval in cents: what Stripe's tiered price is made of. */
export function planTerms(catalog, planKey, interval = 'month') {
  const plan = findPlan(catalog, planKey);
  if (!plan || !isInterval(interval)) return null;
  const times = interval === 'year' ? catalog.yearly_months : 1;
  return {
    plan: plan.key,
    name: plan.name,
    interval,
    currency: catalog.currency || CURRENCY,
    included: plan.included,
    base_cents: Math.round(plan.monthly * 100) * times,
    extra_cents: Math.round(plan.extra * 100) * times,
    lookup_key: lookupKey(plan.key, interval),
  };
}

/** Every plan × interval. */
export const allTerms = (catalog) => catalog.plans.flatMap((p) => INTERVALS.map((i) => planTerms(catalog, p.key, i)));

/**
 * What one billing period costs for `seats` active people, the way Stripe's
 * graduated tiers add it up: the base covers the included seats, each seat
 * after that is extra. Legacy per-seat terms ({ unit_cents }) are unit × seats.
 */
export function periodCents(terms, seats) {
  const n = Math.max(1, Math.floor(Number(seats) || 1));
  if (!terms) return null;
  if (terms.unit_cents != null) return terms.unit_cents * n;
  return terms.base_cents + Math.max(0, n - terms.included) * terms.extra_cents;
}

/** The same, spread per month (a yearly bill ÷ 12), for MRR. */
export function monthlyCents(terms, seats) {
  const c = periodCents(terms, seats);
  if (c == null) return null;
  return terms.interval === 'year' ? Math.round(c / 12) : c;
}

/** The cheapest plan for this many seats on this interval. */
export function cheapestPlan(catalog, seats, interval = 'month') {
  let best = null;
  for (const p of catalog.plans) {
    const t = planTerms(catalog, p.key, interval);
    const cents = periodCents(t, seats);
    if (!best || cents < best.cents) best = { key: p.key, name: p.name, cents };
  }
  return best;
}

/**
 * Advice for the Billing card: how many agents are past what the plan
 * includes and what they add, and a plan that would cost less for this
 * team (bigger when the extras pile up, smaller when the team shrank).
 */
export function planAdvice(catalog, terms, seats) {
  if (!terms || terms.unit_cents != null) return { over_plan: null, suggestion: null };
  const n = Math.max(1, Math.floor(Number(seats) || 1));
  const over = Math.max(0, n - terms.included);
  const current = periodCents(terms, n);
  const best = cheapestPlan(catalog, n, terms.interval);
  const suggestion = best && best.key !== terms.plan && best.cents < current
    ? {
      plan: best.key,
      name: best.name,
      interval: terms.interval,
      amount_cents: best.cents,
      savings_cents: current - best.cents,
      bigger: findPlan(catalog, best.key).included > terms.included,
    }
    : null;
  return {
    over_plan: over > 0 ? { agents: over, extra_cents: over * terms.extra_cents } : null,
    suggestion,
  };
}

/** The catalog as the signup page and the Billing card show it. */
export function publicCatalog(catalog) {
  return {
    currency: catalog.currency || CURRENCY,
    yearly_months: catalog.yearly_months,
    features: FEATURES,
    plans: catalog.plans.map((p) => {
      const month = planTerms(catalog, p.key, 'month');
      const year = planTerms(catalog, p.key, 'year');
      return {
        key: p.key,
        name: p.name,
        tagline: p.tagline,
        included: p.included,
        month: { base_cents: month.base_cents, extra_cents: month.extra_cents },
        year: { base_cents: year.base_cents, extra_cents: year.extra_cents },
      };
    }),
  };
}
