/**
 * Client life after the search: stay in touch after closing, and the seller
 * dashboard. Two routers: `client` under /api (signed-in buyers and owners),
 * `staff` under /api/agent (agents and owners).
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  listStayInTouch, getClosing, postClosing, patchStay, previewStay,
  getStayTemplate, putStayTemplate, getStaySettings, putStaySettings, getMyStay, putMyStay,
} from '../controllers/stayInTouchController.js';
import {
  getMySellerPlan, startMySellerPlan, requestCma, tickChecklist,
  listSellerPlans, makeSeller, getSellerPlan, patchSellerPlan, addOffer, patchOffer, deleteOffer, addFeedback, deleteFeedback,
} from '../controllers/sellerController.js';

const limit = (max, windowMs = 60 * 1000) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down.' },
});

// ── Client ────────────────────────────────────────────────────────────────
const client = express.Router();
client.get('/stay/me', limit(60), getMyStay);
client.put('/stay/me', limit(30), putMyStay);
client.get('/seller', limit(60), getMySellerPlan);
client.post('/seller/start', limit(5, 15 * 60 * 1000), startMySellerPlan);
client.post('/seller/cma', limit(5, 15 * 60 * 1000), requestCma);
client.patch('/seller/checklist/:itemId', limit(60), tickChecklist);

// ── Staff ─────────────────────────────────────────────────────────────────
const staff = express.Router();
const agentOrAdmin = [authenticateToken, requireRole('agent', 'admin')];
staff.get('/stay', ...agentOrAdmin, listStayInTouch);
// Static paths before :id
staff.get('/stay/template', ...agentOrAdmin, getStayTemplate);
staff.put('/stay/template', ...agentOrAdmin, putStayTemplate);
staff.get('/stay/settings', ...agentOrAdmin, getStaySettings);
staff.put('/stay/settings', ...agentOrAdmin, putStaySettings);
staff.patch('/stay/:id', ...agentOrAdmin, patchStay);
staff.get('/stay/:id/preview/:kind', ...agentOrAdmin, previewStay);
staff.get('/clients/:id/closing', ...agentOrAdmin, getClosing);
staff.post('/clients/:id/closing', ...agentOrAdmin, postClosing);
staff.post('/clients/:id/seller', ...agentOrAdmin, makeSeller);
staff.get('/sellers', ...agentOrAdmin, listSellerPlans);
staff.get('/sellers/:planId', ...agentOrAdmin, getSellerPlan);
staff.patch('/sellers/:planId', ...agentOrAdmin, patchSellerPlan);
staff.post('/sellers/:planId/offers', ...agentOrAdmin, addOffer);
staff.patch('/sellers/:planId/offers/:id', ...agentOrAdmin, patchOffer);
staff.delete('/sellers/:planId/offers/:id', ...agentOrAdmin, deleteOffer);
staff.post('/sellers/:planId/feedback', ...agentOrAdmin, addFeedback);
staff.delete('/sellers/:planId/feedback/:id', ...agentOrAdmin, deleteFeedback);

export default { client, staff };
