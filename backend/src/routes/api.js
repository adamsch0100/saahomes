import express from 'express';
import rateLimit from 'express-rate-limit';
import getPool from '../config/database.js';
import transporter from '../config/email.js';
import { submitContactForm } from '../controllers/contactController.js';
import { submitMarketReportForm } from '../controllers/marketReportController.js';
import { submitChfaLeadForm } from '../controllers/chfaLeadController.js';
import { submitChampionsLeadForm } from '../controllers/championsLeadController.js';
import { submitChfaDpaLeadForm } from '../controllers/chfaDpaLeadController.js';
import { submitGhopeLeadForm } from '../controllers/ghopeLeadController.js';
import { submitCashBuyerLead } from '../controllers/cashBuyerController.js';
import { submitWebformLead } from '../controllers/webformController.js';
import { handleChatMessage, createSearchFromChat } from '../controllers/chatController.js';
import {
  searchListings,
  getListingBySlug,
  getListingStats,
  autocompleteLocations,
} from '../controllers/listingController.js';
import { listSoldListings } from '../controllers/soldListingsController.js';
import { getListingPhoto, getListingPhotoDefault } from '../controllers/photoController.js';
import {
  createAlert, listAlerts, getMe, sendMagicLink, signOut, updateAlert, deleteAlert, unsubscribeAll,
  recordView, recordEvent, trackPublicEvent,
} from '../controllers/alertController.js';
import { register, login, setPassword, ensureSession } from '../controllers/authController.js';
import { submitShowingRequest } from '../controllers/showingController.js';
import { runCronDigest } from '../controllers/cronController.js';
import { listSchools, runCronSchoolRatings } from '../controllers/schoolController.js';
import {
  listHomes,
  saveHomeProfile,
  getHomeValue,
  postAccuracy,
  patchHome,
  postSellerHeat,
  publicEstimate,
} from '../controllers/homeController.js';
import {
  listSavedHomes,
  saveHome,
  unsaveHome,
  savedHomesStatus,
} from '../controllers/savedHomesController.js';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
  getNotificationPrefs,
  putNotificationPrefs,
} from '../controllers/notificationsController.js';
import { getPublicTenant } from '../controllers/tenantDomainController.js';
import {
  validateContactSubmission,
  validateMarketReportSubmission,
  validateChfaLeadSubmission,
  validateChampionsLeadSubmission,
  validateChfaDpaLeadSubmission,
  validateGhopeLeadSubmission,
  handleValidationErrors,
} from '../middleware/validation.js';

const router = express.Router();

// Rate limiting for form submissions: 5 per IP per 15 minutes, counted per
// route. Each call makes its own limiter, so submitting one form never uses up
// the budget for another (one shared limiter once let five listing views block
// a visitor from saving a search).
const formLimit = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many submissions from this IP, please try again later.',
});

// Browsing activity (listing views, search events, hearts, notification
// reads) is high-volume by nature and shares one generous limiter.
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down.' },
});

// Agent website form capture (P-3b) — IP rate limit (in-process; embeds may retry)
const webformLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions from this IP, please try again later.' },
});

// Public tenant resolution (P-2b) — Host header → branded payload or null
router.get('/tenant', getPublicTenant);

// Public API routes
router.post(
  '/contact',
  formLimit(),
  validateContactSubmission,
  handleValidationErrors,
  submitContactForm
);

// Public agent webform capture — NO auth (front door for agent sites)
router.post('/webform/lead', webformLimiter, submitWebformLead);

router.post(
  '/market-report',
  formLimit(),
  validateMarketReportSubmission,
  handleValidationErrors,
  submitMarketReportForm
);

router.post(
  '/chfa-lead',
  formLimit(),
  validateChfaLeadSubmission,
  handleValidationErrors,
  submitChfaLeadForm
);

router.post(
  '/champions-lead',
  formLimit(),
  validateChampionsLeadSubmission,
  handleValidationErrors,
  submitChampionsLeadForm
);

router.post(
  '/chfa-dpa-lead',
  formLimit(),
  validateChfaDpaLeadSubmission,
  handleValidationErrors,
  submitChfaDpaLeadForm
);

router.post(
  '/g-hope-lead',
  formLimit(),
  validateGhopeLeadSubmission,
  handleValidationErrors,
  submitGhopeLeadForm
);

router.post('/cash-buyer-lead', formLimit(), submitCashBuyerLead);

// AI Chat — lighter rate limit for conversation flow
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Allow 20 messages per minute per IP
  message: 'Too many messages. Please slow down.',
});

router.post('/chat', chatLimiter, handleChatMessage);
// Nadia AI Search → real saved search (explicit Yes confirmation from chat UI)
router.post('/chat/create-search', formLimit(), createSearchFromChat);

// ── IDX listing search (IRES feed) ────────────────────────────────────────
const listingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many requests.',
});

router.get('/listings', listingLimiter, searchListings);
router.get('/sold-listings', listingLimiter, listSoldListings);
// Listing photo proxy (reliable serving despite MLS URL expiry/rate limits)
// Bare URL (no index) → first photo, so it answers instead of a catch-all 404.
router.get('/photo/:listingId', listingLimiter, getListingPhotoDefault);
router.get('/photo/:listingId/:idx', listingLimiter, getListingPhoto);

router.get('/listings/stats', listingLimiter, getListingStats);
// City/ZIP type-ahead with live counts (must be before /listings/:slug)
router.get('/listings/locations', listingLimiter, autocompleteLocations);
router.get('/listings/:slug', listingLimiter, getListingBySlug);

// GreatSchools ratings cache (read-only public API)
router.get('/schools', listingLimiter, listSchools);

// Client accounts (password login — cookie session)
router.post('/auth/register', formLimit(), register);
router.post('/auth/login', formLimit(), login);
router.post('/auth/password', setPassword);
// Email + phone session for save-home / lead capture (no password required)
router.post('/auth/session', formLimit(), ensureSession);

// Saved-search / follow-up alerts (lead capture → FUB)
router.post('/alerts', formLimit(), createAlert);
router.get('/alerts/manage', listAlerts);
router.get('/alerts/me', getMe);
router.post('/alerts/view', trackingLimiter, recordView);
router.post('/alerts/event', trackingLimiter, recordEvent);
router.post('/events', trackingLimiter, trackPublicEvent);
router.post('/alerts/magic-link', formLimit(), sendMagicLink);
router.post('/alerts/signout', signOut);
router.patch('/alerts/:id', updateAlert);
router.delete('/alerts/:id', deleteAlert);
router.post('/alerts/unsubscribe', formLimit(), unsubscribeAll);

// Cron triggers (protected by CRON_SECRET) — scheduler calls the site's own
// backend so email is sent from saahomes.com, not from Hermes.
router.post('/cron/digest', runCronDigest);
// Weekly GreatSchools city-page sync (NOT part of the 2h listings sync)
router.post('/cron/school-ratings', runCronSchoolRatings);

// Showing requests (listing page modal → lead → FUB)
router.post('/showing', formLimit(), submitShowingRequest);

// ── Seller nurture track (home profiles + multi-source value) ─────────────
const homeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Too many requests.',
});
router.get('/home', homeLimiter, listHomes);
router.post('/home/profile', formLimit(), saveHomeProfile);
router.post('/home/estimate', formLimit(), publicEstimate);
router.get('/home/:id/value', homeLimiter, getHomeValue);
router.post('/home/:id/accuracy', formLimit(), postAccuracy);
router.post('/home/:id/heat', formLimit(), postSellerHeat);
router.patch('/home/:id', formLimit(), patchHome);

// ── Account-linked saved homes (hearts) ───────────────────────────────────
const savedHomesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many requests.',
});
// status must be registered before :listing_key so "status" is not captured as a key
router.get('/saved-homes/status', savedHomesLimiter, savedHomesStatus);
router.get('/saved-homes', savedHomesLimiter, listSavedHomes);
router.post('/saved-homes', trackingLimiter, saveHome);
router.delete('/saved-homes/:listing_key', savedHomesLimiter, unsaveHome);

// ── Notification center (in-app nurture events + cadence prefs) ───────────
const notificationsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many requests.',
});
// Static paths before :id
router.get('/notifications', notificationsLimiter, listNotifications);
router.get('/notifications/prefs', notificationsLimiter, getNotificationPrefs);
router.put('/notifications/prefs', formLimit(), putNotificationPrefs);
router.post('/notifications/read-all', trackingLimiter, markAllNotificationsRead);
router.post('/notifications/dismiss-all', trackingLimiter, dismissAllNotifications);
router.post('/notifications/:id/read', trackingLimiter, markNotificationRead);
router.delete('/notifications/:id', notificationsLimiter, dismissNotification);

// ── Email open-tracking pixel (public, no auth — email clients hit this) ─
// 1×1 transparent GIF (43 bytes). Always 200 so clients never retry-storm.
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);
router.get('/email/open/:token', async (req, res) => {
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL_GIF.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
  });
  try {
    const token = String(req.params.token || '').slice(0, 64);
    if (token && /^[a-f0-9]{16,64}$/i.test(token)) {
      const pool = getPool();
      await pool.query(
        `UPDATE email_log
         SET open_count = COALESCE(open_count, 0) + 1,
             first_open_at = COALESCE(first_open_at, NOW()),
             last_open_at = NOW()
         WHERE open_token = $1`,
        [token]
      );
    }
  } catch {
    // Never fail the pixel — tracking is best-effort
  }
  res.status(200).end(PIXEL_GIF);
});

// ── Mail transport health probe (public, thin) ────────────────────────────
// The watch probes this URL so a dead SMTP credential is caught in minutes
// instead of at a visitor's form submit (incident: 535 auth failures went
// unnoticed for an hour). Answers 200 only when Gmail SMTP auth succeeds;
// 503 when the credential is dead or unset. Cached so the probe list and any
// abuse cannot hammer Gmail with a fresh SMTP connection each hit.
const MAIL_TEST_TTL = 5 * 60 * 1000;
let mailTestCache = { at: 0, status: 503, payload: { ok: false, smtp: 'unknown' } };

async function probeMailTransport() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { status: 503, payload: { ok: false, smtp: 'not-configured' } };
  }
  try {
    await transporter.verify();
    return { status: 200, payload: { ok: true, smtp: 'ok' } };
  } catch (error) {
    return {
      status: 503,
      payload: { ok: false, smtp: 'error', code: error.responseCode || null },
    };
  }
}

router.get('/mail-test', async (req, res) => {
  if (!mailTestCache.payload || Date.now() - mailTestCache.at > MAIL_TEST_TTL) {
    const result = await probeMailTransport();
    mailTestCache = { at: Date.now(), ...result };
  }
  res.status(mailTestCache.status).json({
    ...mailTestCache.payload,
    checkedAt: new Date(mailTestCache.at).toISOString(),
  });
});

export default router;

