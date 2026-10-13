import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  requestPasswordReset,
  checkPasswordReset,
  confirmPasswordReset,
  getAccountMe,
  verifyTwoStep,
  getTwoStep,
  setupTwoStep,
  enableTwoStep,
  disableTwoStep,
} from '../controllers/accountController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

const limit = (max) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tries. Please wait a few minutes and try again.' },
});

// Password reset and invite links (public)
router.post('/password-reset/request', limit(5), requestPasswordReset);
router.get('/password-reset/check', limit(30), checkPasswordReset);
router.post('/password-reset/confirm', limit(10), confirmPasswordReset);

// Second step of a staff login
router.post('/2fa/verify', limit(10), verifyTwoStep);

// Signed-in staff
const staff = [authenticateToken, requireRole('agent', 'admin')];
router.get('/me', ...staff, getAccountMe);
router.get('/2fa', ...staff, getTwoStep);
router.post('/2fa/setup', ...staff, limit(10), setupTwoStep);
router.post('/2fa/enable', ...staff, limit(10), enableTwoStep);
router.post('/2fa/disable', ...staff, limit(10), disableTwoStep);

export default router;
