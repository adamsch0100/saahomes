/**
 * Public endpoints for running a brokerage without Follow Up Boss. They take
 * the raw request (JSON, form posts, multipart from email providers, and
 * Facebook's signed bytes), so they are mounted before the JSON parser.
 * Each brokerage is found by its own intake key, never by the host name.
 *
 *   POST /api/inbound/email[/:key]   inbound email (Postmark, Resend, SendGrid Inbound Parse, or plain JSON)
 *   POST /api/intake/:key/:source    zillow | realtor | homes | email | webhook | zapier | facebook
 *   GET  /api/intake/:key/facebook   Facebook's webhook check
 *   GET|POST /api/plans/unsubscribe  one-click unsubscribe from plan emails
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  inboundEmail, intakeLead, facebookVerify, planUnsubscribePage, planUnsubscribe,
} from '../controllers/ownCrmController.js';

const limiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests.' },
});

const raw = express.raw({ type: '*/*', limit: '10mb' });
const form = express.urlencoded({ extended: false, limit: '100kb' });

const router = express.Router();
router.post('/api/inbound/email/:key', limiter(60 * 1000, 240), raw, inboundEmail);
router.post('/api/inbound/email', limiter(60 * 1000, 240), raw, inboundEmail);
router.get('/api/intake/:key/facebook', limiter(60 * 1000, 60), facebookVerify);
router.post('/api/intake/:key/:source', limiter(60 * 1000, 240), raw, intakeLead);
router.get('/api/plans/unsubscribe', limiter(15 * 60 * 1000, 120), planUnsubscribePage);
router.post('/api/plans/unsubscribe', limiter(15 * 60 * 1000, 60), form, planUnsubscribe);

export default router;
