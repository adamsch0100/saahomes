import express from 'express';
import rateLimit from 'express-rate-limit';
import { submitContactForm } from '../controllers/contactController.js';
import { submitMarketReportForm } from '../controllers/marketReportController.js';
import { submitChfaLeadForm } from '../controllers/chfaLeadController.js';
import { submitChampionsLeadForm } from '../controllers/championsLeadController.js';
import { submitChfaDpaLeadForm } from '../controllers/chfaDpaLeadController.js';
import { submitGhopeLeadForm } from '../controllers/ghopeLeadController.js';
import { submitCashBuyerLead } from '../controllers/cashBuyerController.js';
import { handleChatMessage } from '../controllers/chatController.js';
import {
  searchListings,
  getListingBySlug,
  getListingStats,
  autocompleteLocations,
} from '../controllers/listingController.js';
import { getListingPhoto } from '../controllers/photoController.js';
import {
  createAlert, listAlerts, getMe, sendMagicLink, signOut, updateAlert, deleteAlert, unsubscribeAll,
  recordView, recordEvent,
} from '../controllers/alertController.js';
import { register, login, setPassword } from '../controllers/authController.js';
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
  validateContactSubmission,
  validateMarketReportSubmission,
  validateChfaLeadSubmission,
  validateChampionsLeadSubmission,
  validateChfaDpaLeadSubmission,
  validateGhopeLeadSubmission,
  handleValidationErrors,
} from '../middleware/validation.js';

const router = express.Router();

// Rate limiting for form submissions
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many submissions from this IP, please try again later.',
});

// Public API routes
router.post(
  '/contact',
  formLimiter,
  validateContactSubmission,
  handleValidationErrors,
  submitContactForm
);

router.post(
  '/market-report',
  formLimiter,
  validateMarketReportSubmission,
  handleValidationErrors,
  submitMarketReportForm
);

router.post(
  '/chfa-lead',
  formLimiter,
  validateChfaLeadSubmission,
  handleValidationErrors,
  submitChfaLeadForm
);

router.post(
  '/champions-lead',
  formLimiter,
  validateChampionsLeadSubmission,
  handleValidationErrors,
  submitChampionsLeadForm
);

router.post(
  '/chfa-dpa-lead',
  formLimiter,
  validateChfaDpaLeadSubmission,
  handleValidationErrors,
  submitChfaDpaLeadForm
);

router.post(
  '/g-hope-lead',
  formLimiter,
  validateGhopeLeadSubmission,
  handleValidationErrors,
  submitGhopeLeadForm
);

router.post('/cash-buyer-lead', formLimiter, submitCashBuyerLead);

// AI Chat — lighter rate limit for conversation flow
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Allow 20 messages per minute per IP
  message: 'Too many messages. Please slow down.',
});

router.post('/chat', chatLimiter, handleChatMessage);

// ── IDX listing search (IRES feed) ────────────────────────────────────────
const listingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many requests.',
});

router.get('/listings', listingLimiter, searchListings);
// Listing photo proxy (reliable serving despite MLS URL expiry/rate limits)
router.get('/photo/:listingId/:idx', listingLimiter, getListingPhoto);

router.get('/listings/stats', listingLimiter, getListingStats);
// City/ZIP type-ahead with live counts (must be before /listings/:slug)
router.get('/listings/locations', listingLimiter, autocompleteLocations);
router.get('/listings/:slug', listingLimiter, getListingBySlug);

// GreatSchools ratings cache (read-only public API)
router.get('/schools', listingLimiter, listSchools);

// Client accounts (password login — cookie session)
router.post('/auth/register', formLimiter, register);
router.post('/auth/login', formLimiter, login);
router.post('/auth/password', setPassword);

// Saved-search / follow-up alerts (lead capture → FUB)
router.post('/alerts', formLimiter, createAlert);
router.get('/alerts/manage', listAlerts);
router.get('/alerts/me', getMe);
router.post('/alerts/view', formLimiter, recordView);
router.post('/alerts/event', formLimiter, recordEvent);
router.post('/alerts/magic-link', formLimiter, sendMagicLink);
router.post('/alerts/signout', signOut);
router.patch('/alerts/:id', updateAlert);
router.delete('/alerts/:id', deleteAlert);
router.post('/alerts/unsubscribe', formLimiter, unsubscribeAll);

// Cron triggers (protected by CRON_SECRET) — scheduler calls the site's own
// backend so email is sent from saahomes.com, not from Hermes.
router.post('/cron/digest', runCronDigest);
// Weekly GreatSchools city-page sync (NOT part of the 2h listings sync)
router.post('/cron/school-ratings', runCronSchoolRatings);

// Showing requests (listing page modal → lead → FUB)
router.post('/showing', formLimiter, submitShowingRequest);

// ── Seller nurture track (home profiles + multi-source value) ─────────────
const homeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Too many requests.',
});
router.get('/home', homeLimiter, listHomes);
router.post('/home/profile', formLimiter, saveHomeProfile);
router.post('/home/estimate', formLimiter, publicEstimate);
router.get('/home/:id/value', homeLimiter, getHomeValue);
router.post('/home/:id/accuracy', formLimiter, postAccuracy);
router.post('/home/:id/heat', formLimiter, postSellerHeat);
router.patch('/home/:id', formLimiter, patchHome);

export default router;

