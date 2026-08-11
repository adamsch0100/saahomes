import express from 'express';
import {
  agentLogin,
  getAgentCockpit,
  patchAgentCockpitLead,
  assignLead,
  listTeammates,
  getAgentMe,
  connectAgentFub,
  getAgentFubStatus,
  disconnectAgentFub,
  importAgentFubContacts,
  getAgentWebformSlug,
  regenerateAgentWebformSlug,
  getAgentWebformStats,
} from '../controllers/agentController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public agent login
router.post('/login', agentLogin);

// Agent + admin: team-pooled cockpit and assignment
const agentOrAdmin = [authenticateToken, requireRole('agent', 'admin')];

router.get('/me', ...agentOrAdmin, getAgentMe);
router.get('/cockpit', ...agentOrAdmin, getAgentCockpit);
router.patch('/cockpit/:id', ...agentOrAdmin, patchAgentCockpitLead);
router.post('/assign', ...agentOrAdmin, assignLead);
router.get('/teammates', ...agentOrAdmin, listTeammates);

// Connect CRM (P-3a) — per-agent FUB key + contact import
router.post('/fub/connect', ...agentOrAdmin, connectAgentFub);
router.get('/fub/status', ...agentOrAdmin, getAgentFubStatus);
router.post('/fub/disconnect', ...agentOrAdmin, disconnectAgentFub);
router.post('/fub/import', ...agentOrAdmin, importAgentFubContacts);

// Website forms (P-3b) — capture slug + lead stats
router.get('/webform/slug', ...agentOrAdmin, getAgentWebformSlug);
router.post('/webform/slug/regenerate', ...agentOrAdmin, regenerateAgentWebformSlug);
router.get('/webform/stats', ...agentOrAdmin, getAgentWebformStats);

export default router;
