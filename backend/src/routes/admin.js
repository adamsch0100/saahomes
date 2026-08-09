import express from 'express';
import {
  login,
  getSubmissions,
  getSubmission,
  getStats,
  getClientSearches,
  createClientSearch,
  updateClientSearch,
  deleteClientSearch,
  searchStats,
  getCockpitLeads,
  getDueTodayQueue,
  patchCockpitLead,
  shareHome,
  syncFubLifecycle,
  getFubStatus,
  getLeadQualityStats,
  getEmailAbStats,
} from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public admin routes
router.post('/login', login);

// Protected admin routes
router.get('/submissions', authenticateToken, getSubmissions);
router.get('/submissions/:type/:id', authenticateToken, getSubmission);
router.get('/stats', authenticateToken, getStats);
router.get('/lead-quality-stats', authenticateToken, getLeadQualityStats);
router.get('/email-ab-stats', authenticateToken, getEmailAbStats);

// Client saved-search CRM (agent side)
router.get('/searches', authenticateToken, getClientSearches);
router.post('/searches', authenticateToken, createClientSearch);
router.patch('/searches/:id', authenticateToken, updateClientSearch);
router.delete('/searches/:id', authenticateToken, deleteClientSearch);
router.get('/search-stats', authenticateToken, searchStats);

// Agent cockpit (It 12) — score / heat / lifecycle / due-today
router.get('/cockpit', authenticateToken, getCockpitLeads);
router.get('/cockpit/due-today', authenticateToken, getDueTodayQueue);
router.patch('/cockpit/:id', authenticateToken, patchCockpitLead);
// Agent share-home (It 16 / P5) — home + note → FUB + timeline + client inbox
router.post('/share-home', authenticateToken, shareHome);
// FUB two-way read (It 17 / P6) — tags/stage → our lifecycle
router.post('/sync-fub-lifecycle', authenticateToken, syncFubLifecycle);
router.get('/fub/status', authenticateToken, getFubStatus);

export default router;

