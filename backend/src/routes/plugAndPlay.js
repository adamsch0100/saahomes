/**
 * Plug and play: self-serve signup, first-run setup, billing, embeds and the
 * Follow Up Boss automations. Kept apart from the older route files so each
 * piece is easy to find.
 *
 *   publicRoutes  → /api        signup, embed view beacon
 *   adminRoutes   → /api/admin  setup, billing, embeds (+ watchers on agents/settings)
 *   embedPages    → /           /embed.js and /embed/* (any host)
 *   rawWebhooks   → before the JSON parser: Stripe and Follow Up Boss
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { tenantIdOf } from '../services/tenantContext.js';
import { signup, signupInfo, checkSlug, redeemHandoff } from '../controllers/signupController.js';
import {
  getSetup, patchSetup, confirmEmail, resendConfirm, getEmbeds,
} from '../controllers/setupController.js';
import {
  getBilling, startCheckout, choosePlan, openPortal, stripeWebhook,
} from '../controllers/billingController.js';
import { serveEmbedPage, serveEmbedLoader, recordEmbedView } from '../controllers/embedController.js';
import { fubPeopleCreatedWebhook } from '../controllers/fubWebhookController.js';
import logger from '../utils/logger.js';

const limiter = (windowMs, max, error) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error },
});

// ── public (/api) ──
export const publicRoutes = express.Router();
publicRoutes.get('/signup/info', signupInfo);
publicRoutes.get('/signup/check', limiter(15 * 60 * 1000, 60, 'Too many checks. Please wait a minute.'), checkSlug);
publicRoutes.post('/signup', limiter(60 * 60 * 1000, Number(process.env.SIGNUP_RATE_LIMIT) || 5, 'Too many signups from here. Please try again in an hour.'), signup);
publicRoutes.post('/signup/handoff', limiter(15 * 60 * 1000, 30, 'Too many tries. Please wait a few minutes.'), redeemHandoff);
publicRoutes.post('/embed/view', limiter(15 * 60 * 1000, 300, 'Too many requests.'), recordEmbedView);

// ── owner (/api/admin) ──
export const adminRoutes = express.Router();
const adminOnly = [authenticateToken, requireRole('admin')];

/** Run fn after a successful response (never delays it). */
function after(match, fn) {
  return (req, res, next) => {
    if (match(req)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          Promise.resolve().then(() => fn(req)).catch((e) => logger.warn('after-hook failed', { message: e.message }));
        }
      });
    }
    next();
  };
}

// Seats follow the team: agents added, paused or brought back.
adminRoutes.use('/agents', after(
  (req) => req.method === 'POST' || req.method === 'PATCH',
  async (req) => {
    const { syncSeats } = await import('../services/billing.js');
    await syncSeats(tenantIdOf(req));
  }
));
// A connected (or removed) Follow Up Boss key turns new-contact alerts on (or off).
adminRoutes.use('/settings', after(
  (req) => req.method === 'PATCH' && req.path === '/' && req.body && Object.prototype.hasOwnProperty.call(req.body, 'fub_api_key'),
  async (req) => {
    const { syncFubWebhook } = await import('../services/fubAutomation.js');
    await syncFubWebhook(tenantIdOf(req));
  }
));

adminRoutes.post('/setup/confirm-email', limiter(15 * 60 * 1000, 20, 'Too many tries. Please wait a few minutes.'), confirmEmail);
adminRoutes.get('/setup', ...adminOnly, getSetup);
adminRoutes.patch('/setup', ...adminOnly, patchSetup);
adminRoutes.post('/setup/resend-confirm', ...adminOnly, limiter(60 * 60 * 1000, 5, 'Too many emails. Try again later.'), resendConfirm);
adminRoutes.get('/billing', ...adminOnly, getBilling);
adminRoutes.post('/billing/checkout', ...adminOnly, startCheckout);
adminRoutes.post('/billing/plan', ...adminOnly, choosePlan);
adminRoutes.post('/billing/portal', ...adminOnly, openPortal);
adminRoutes.get('/embeds', ...adminOnly, getEmbeds);

// ── widget pages (any host) ──
export const embedPages = express.Router();
embedPages.get('/embed.js', serveEmbedLoader);
embedPages.get('/embed/listing/:slug', (req, res) => {
  req.params.widget = 'listing';
  return serveEmbedPage(req, res);
});
embedPages.get('/embed/:widget', serveEmbedPage);

// ── webhooks: raw bodies, before express.json ──
export const rawWebhooks = express.Router();
const raw = express.raw({ type: '*/*', limit: '1mb' });
rawWebhooks.post('/api/billing/webhook', raw, stripeWebhook);
rawWebhooks.post('/api/fub/webhook/:tenantId/:token', limiter(60 * 1000, 120, 'Too many requests.'), raw, fubPeopleCreatedWebhook);
