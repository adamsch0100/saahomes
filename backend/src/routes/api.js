import express from 'express';
import rateLimit from 'express-rate-limit';
import { submitContactForm } from '../controllers/contactController.js';
import { submitMarketReportForm } from '../controllers/marketReportController.js';
import { submitChfaLeadForm } from '../controllers/chfaLeadController.js';
import { submitChampionsLeadForm } from '../controllers/championsLeadController.js';
import { submitChfaDpaLeadForm } from '../controllers/chfaDpaLeadController.js';
import {
  validateContactSubmission,
  validateMarketReportSubmission,
  validateChfaLeadSubmission,
  validateChampionsLeadSubmission,
  validateChfaDpaLeadSubmission,
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

export default router;

