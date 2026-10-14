/**
 * /api/platform billing — the platform owner's view of plans and Stripe:
 *
 *   GET  /api/platform/billing       Stripe setup status, the plans, total MRR
 *   PUT  /api/platform/plans         { yearly_months?, plans: { team: { name?, monthly?, included?, extra? } } }
 *                                    save new plan numbers, then sync them to Stripe
 *   POST /api/platform/billing/sync  "Sync plans to Stripe": prices and webhook
 *
 * Platform owner only (routes/platform.js).
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { DEFAULT_TENANT_ID } from '../services/tenantContext.js';
import { mrrCents, termsFor } from '../services/billing.js';
import {
  DEFAULT_PLANS, DEFAULT_YEARLY_MONTHS, loadPlanCatalog, monthlyCents, publicCatalog, savePlanOverrides,
  validatePlanOverrides,
} from '../services/plans.js';
import { stripeConfigured } from '../services/stripe.js';
import { ensureStripeCatalog, ensureStripeWebhook, stripeSetupStatus } from '../services/stripeSetup.js';

/** A brokerage's plan and MRR for the console's Billing column. */
export function tenantPlanLine(b, catalog, seats = 1) {
  if (!b) return {};
  const terms = termsFor(b, catalog, { seats });
  return {
    plan: terms?.chosen ? terms.plan : null,
    plan_name: terms?.chosen ? terms.name : null,
    interval: terms?.interval || null,
    mrr_cents: mrrCents(b, catalog, seats),
    // What a brokerage still in its trial would bring in once it pays.
    trial_mrr_cents: b.status === 'trialing' ? monthlyCents(terms, b.seats_billed ?? seats) || 0 : 0,
  };
}

async function totals(pool, catalog) {
  const r = await pool.query(
    `SELECT t.id, t.status, t.settings->'billing' AS billing,
            (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id AND u.role IN ('agent', 'admin') AND u.status = 'active') AS seats
       FROM tenants t WHERE t.id <> ${DEFAULT_TENANT_ID} AND t.settings ? 'billing'`
  );
  const out = { mrr_cents: 0, paying: 0, trialing: 0, trial_mrr_cents: 0 };
  for (const row of r.rows) {
    const line = tenantPlanLine(row.billing, catalog, Math.max(1, row.seats || 0));
    if (line.mrr_cents > 0) {
      out.mrr_cents += line.mrr_cents;
      out.paying += 1;
    }
    if (row.billing?.status === 'trialing' && row.status === 'active') {
      out.trialing += 1;
      out.trial_mrr_cents += line.trial_mrr_cents;
    }
  }
  return out;
}

async function overview(pool, { fresh = false } = {}) {
  const catalog = await loadPlanCatalog({ pool, fresh });
  return {
    stripe: await stripeSetupStatus({ pool, catalog }),
    catalog: {
      ...publicCatalog(catalog),
      // The editable numbers, as the owner typed them (whole dollars).
      editable: catalog.plans.map(({ key, name, tagline, monthly, included, extra }) => ({ key, name, tagline, monthly, included, extra })),
      defaults: { yearly_months: DEFAULT_YEARLY_MONTHS, plans: DEFAULT_PLANS },
    },
    totals: await totals(pool, catalog),
  };
}

/** GET /api/platform/billing */
export const getPlatformBilling = async (req, res) => {
  try {
    return res.json({ success: true, data: await overview(getPool()) });
  } catch (error) {
    logger.error('getPlatformBilling error', error);
    return res.status(500).json({ error: 'Could not load billing' });
  }
};

/** PUT /api/platform/plans */
export const putPlans = async (req, res) => {
  const { value, error } = validatePlanOverrides(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const pool = getPool();
    const catalog = await savePlanOverrides(value, { pool });
    logger.info('plan prices updated', { by: req.user?.email, plans: Object.keys(value.plans), yearly_months: value.yearly_months });
    const sync = stripeConfigured() ? await ensureStripeCatalog({ pool, catalog }) : { skipped: 'no_key' };
    return res.json({ success: true, sync, data: await overview(pool) });
  } catch (err) {
    logger.error('putPlans error', err);
    return res.status(500).json({ error: 'Could not save the plans' });
  }
};

/** POST /api/platform/billing/sync */
export const syncPlatformBilling = async (req, res) => {
  if (!stripeConfigured()) return res.status(400).json({ error: 'Add STRIPE_SECRET_KEY first' });
  try {
    const pool = getPool();
    const plans = await ensureStripeCatalog({ pool });
    const webhook = await ensureStripeWebhook({ pool });
    if (plans.skipped === 'busy' || webhook.skipped === 'busy') {
      return res.status(409).json({ error: 'A sync is already running. Try again in a minute.' });
    }
    return res.json({ success: true, sync: { plans, webhook }, data: await overview(pool) });
  } catch (err) {
    logger.error('syncPlatformBilling error', err);
    return res.status(500).json({ error: 'Could not sync with Stripe' });
  }
};
