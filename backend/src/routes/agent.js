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

export default router;
