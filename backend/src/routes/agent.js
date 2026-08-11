import express from 'express';
import {
  agentLogin,
  getAgentCockpit,
  patchAgentCockpitLead,
  assignLead,
  listTeammates,
  getAgentMe,
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

export default router;
