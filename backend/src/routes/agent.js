import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  agentLogin,
  getAgentCockpit,
  patchAgentCockpitLead,
  assignLead,
  listTeammates,
  getAgentMe,
  getAgentMarket,
  connectAgentFub,
  getAgentFubStatus,
  disconnectAgentFub,
  importAgentFubContacts,
  getAgentWebformSlug,
  regenerateAgentWebformSlug,
  getAgentWebformStats,
  getAgentBrief,
  setAgentBriefEmail,
} from '../controllers/agentController.js';
import { getAgentProfile, patchAgentProfile, uploadAgentPhoto } from '../controllers/settingsController.js';
import {
  getLeadDetail, getLeadTimeline, addNote, editNote, deleteNote, addTask, editTask, deleteTask, listTasks,
  getTextThread, sendLeadText, sendLeadEmailNow, draftReply, sendReplyDraft, discardDraft, confirmTour,
  getTextingStatus, subscribeAgentPush, unsubscribeAgentPush,
} from '../controllers/crmController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public agent login
// Failed logins only count toward the limit, so a typo doesn't lock anyone out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});
router.post('/login', loginLimiter, agentLogin);

// Agent + admin: team-pooled cockpit and assignment
const agentOrAdmin = [authenticateToken, requireRole('agent', 'admin')];

router.get('/me', ...agentOrAdmin, getAgentMe);
router.get('/market', ...agentOrAdmin, getAgentMarket);
router.get('/cockpit', ...agentOrAdmin, getAgentCockpit);
router.patch('/cockpit/:id', ...agentOrAdmin, patchAgentCockpitLead);
router.post('/assign', ...agentOrAdmin, assignLead);
router.get('/teammates', ...agentOrAdmin, listTeammates);
router.get('/brief', ...agentOrAdmin, getAgentBrief);
router.put('/brief', ...agentOrAdmin, setAgentBriefEmail);

// Connect CRM (P-3a) — per-agent FUB key + contact import
router.post('/fub/connect', ...agentOrAdmin, connectAgentFub);
router.get('/fub/status', ...agentOrAdmin, getAgentFubStatus);
router.post('/fub/disconnect', ...agentOrAdmin, disconnectAgentFub);
router.post('/fub/import', ...agentOrAdmin, importAgentFubContacts);

// Website forms (P-3b) — capture slug + lead stats
router.get('/webform/slug', ...agentOrAdmin, getAgentWebformSlug);
router.post('/webform/slug/regenerate', ...agentOrAdmin, regenerateAgentWebformSlug);
router.get('/webform/stats', ...agentOrAdmin, getAgentWebformStats);

// Agent's own profile: photo, bio, contact, notifications
router.get('/profile', ...agentOrAdmin, getAgentProfile);
router.patch('/profile', ...agentOrAdmin, patchAgentProfile);
router.post('/profile/photo', ...agentOrAdmin, uploadAgentPhoto);

// Light CRM: lead timeline, notes, tasks, texts, emails, reply drafts, tours
router.get('/crm/leads/:id', ...agentOrAdmin, getLeadDetail);
router.get('/crm/leads/:id/timeline', ...agentOrAdmin, getLeadTimeline);
router.post('/crm/leads/:id/notes', ...agentOrAdmin, addNote);
router.patch('/crm/notes/:id', ...agentOrAdmin, editNote);
router.delete('/crm/notes/:id', ...agentOrAdmin, deleteNote);
router.post('/crm/leads/:id/tasks', ...agentOrAdmin, addTask);
router.patch('/crm/tasks/:id', ...agentOrAdmin, editTask);
router.delete('/crm/tasks/:id', ...agentOrAdmin, deleteTask);
router.get('/crm/tasks', ...agentOrAdmin, listTasks);
router.get('/crm/leads/:id/texts', ...agentOrAdmin, getTextThread);
router.post('/crm/leads/:id/texts', ...agentOrAdmin, sendLeadText);
router.post('/crm/leads/:id/emails', ...agentOrAdmin, sendLeadEmailNow);
router.post('/crm/leads/:id/drafts', ...agentOrAdmin, draftReply);
router.post('/crm/drafts/:id/send', ...agentOrAdmin, sendReplyDraft);
router.post('/crm/drafts/:id/discard', ...agentOrAdmin, discardDraft);
router.post('/crm/tours/:id/confirm', ...agentOrAdmin, confirmTour);
router.get('/crm/texting', ...agentOrAdmin, getTextingStatus);
// Hot-lead alerts on this device (web push for staff)
router.post('/push/subscribe', ...agentOrAdmin, subscribeAgentPush);
router.post('/push/unsubscribe', ...agentOrAdmin, unsubscribeAgentPush);

export default router;
