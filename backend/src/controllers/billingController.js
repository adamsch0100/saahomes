/**
 * Brokerage billing (owner):
 *   GET  /api/admin/billing           plan, seats, trial days left, status
 *   POST /api/admin/billing/checkout  Stripe Checkout for the seat subscription → { url }
 *   POST /api/admin/billing/portal    Stripe customer portal → { url }
 * Stripe:
 *   POST /api/billing/webhook         raw body, Stripe-Signature verified
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { tenantIdOf } from '../services/tenantContext.js';
import {
  billingFor, createCheckout, createPortal, handleStripeEvent,
} from '../services/billing.js';
import { verifyStripeSignature } from '../services/stripe.js';

async function loadTenant(pool, id) {
  const r = await pool.query('SELECT id, slug, name, primary_domain, status, settings FROM tenants WHERE id = $1', [id]);
  const t = r.rows[0];
  return t ? { ...t, id: Number(t.id), settings: t.settings || {} } : null;
}

/** GET /api/admin/billing */
export const getBilling = async (req, res) => {
  try {
    const pool = getPool();
    const tenant = await loadTenant(pool, tenantIdOf(req));
    if (!tenant) return res.status(404).json({ error: 'Brokerage not found' });
    return res.json({ success: true, data: await billingFor(tenant, { pool }) });
  } catch (error) {
    logger.error('getBilling error', error);
    return res.status(500).json({ error: 'Could not load billing' });
  }
};

/** POST /api/admin/billing/checkout */
export const startCheckout = async (req, res) => {
  try {
    const owner = req.user?.platform ? null : { email: req.user?.email };
    const session = await createCheckout(req.tenant, owner);
    return res.json({ success: true, url: session.url });
  } catch (error) {
    logger.error('startCheckout error', { message: error.message });
    return res.status(error.status && error.status < 500 ? error.status : 502).json({
      error: error.status === 503 ? 'Billing isn’t set up yet' : (error.status && error.status < 500 ? error.message : 'Couldn’t reach the payment page. Please try again.'),
    });
  }
};

/** POST /api/admin/billing/portal */
export const openPortal = async (req, res) => {
  try {
    const portal = await createPortal(req.tenant);
    return res.json({ success: true, url: portal.url });
  } catch (error) {
    logger.error('openPortal error', { message: error.message });
    return res.status(error.status && error.status < 500 ? error.status : 502).json({
      error: error.status && error.status < 500 ? error.message : 'Couldn’t open billing. Please try again.',
    });
  }
};

/** POST /api/billing/webhook — mounted with express.raw so the signature sees the exact bytes. */
export const stripeWebhook = async (req, res) => {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) return res.status(503).json({ error: 'Billing isn’t set up yet' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!verifyStripeSignature(raw, req.get('stripe-signature'), secret)) {
    logger.warn('Stripe webhook signature rejected');
    return res.status(400).json({ error: 'Invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  try {
    const result = await handleStripeEvent(event);
    return res.json({ received: true, ...result });
  } catch (error) {
    logger.error('Stripe webhook handling failed', { type: event?.type, message: error.message });
    // A 500 makes Stripe retry later.
    return res.status(500).json({ error: 'Could not apply the event' });
  }
};
