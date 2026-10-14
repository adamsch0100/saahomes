import express from 'express';
import rateLimit from 'express-rate-limit';
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
  getFunnelStats,
  createAgent,
  listAgents,
  patchAgent,
  resendAgentInvite,
} from '../controllers/adminController.js';
import {
  setAgentDomain,
  verifyAgentDomain,
  deleteAgentDomain,
} from '../controllers/tenantDomainController.js';
import {
  getSettings,
  patchSettings,
  uploadBrandAsset,
  setSiteDomain,
  checkSiteDomain,
  setEmailDomain,
  verifyEmailDomain,
  sendTestEmail,
} from '../controllers/settingsController.js';
import { getSmsSettings, patchSmsSettings, getAgentReports } from '../controllers/textingController.js';
import {
  getCrmSettings, setCrmMode, exportContacts, previewContactsImport, importContacts,
  getIntake, patchIntake, newIntakeKey, testIntake,
} from '../controllers/ownCrmController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public admin routes
// Failed logins only count toward the limit, so a typo doesn't lock anyone out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});
router.post('/login', loginLimiter, login);

// Protected admin-only routes (agents use /api/agent/* for cockpit)
const adminOnly = [authenticateToken, requireRole('admin')];

router.get('/submissions', ...adminOnly, getSubmissions);
router.get('/submissions/:type/:id', ...adminOnly, getSubmission);
router.get('/stats', ...adminOnly, getStats);
router.get('/lead-quality-stats', ...adminOnly, getLeadQualityStats);
router.get('/email-ab-stats', ...adminOnly, getEmailAbStats);
router.get('/funnel', ...adminOnly, getFunnelStats);

// Client saved-search CRM (agent side — still admin console for P-1)
router.get('/searches', ...adminOnly, getClientSearches);
router.post('/searches', ...adminOnly, createClientSearch);
router.patch('/searches/:id', ...adminOnly, updateClientSearch);
router.delete('/searches/:id', ...adminOnly, deleteClientSearch);
router.get('/search-stats', ...adminOnly, searchStats);

// Agent cockpit (It 12) — score / heat / lifecycle / due-today
router.get('/cockpit', ...adminOnly, getCockpitLeads);
router.get('/cockpit/due-today', ...adminOnly, getDueTodayQueue);
router.patch('/cockpit/:id', ...adminOnly, patchCockpitLead);
// Agent share-home (It 16 / P5) — home + note → FUB + timeline + client inbox
router.post('/share-home', ...adminOnly, shareHome);
// FUB two-way read (It 17 / P6) — tags/stage → our lifecycle
router.post('/sync-fub-lifecycle', ...adminOnly, syncFubLifecycle);
router.get('/fub/status', ...adminOnly, getFubStatus);

// Multi-agent seats (P-1) — create / list / activate-deactivate teammates
router.get('/agents', ...adminOnly, listAgents);
router.post('/agents', ...adminOnly, createAgent);
router.patch('/agents/:id', ...adminOnly, patchAgent);
router.post('/agents/:id/invite', ...adminOnly, resendAgentInvite);
router.post('/agents/:id/domain', ...adminOnly, setAgentDomain);
router.post('/agents/:id/domain/verify', ...adminOnly, verifyAgentDomain);
router.delete('/agents/:id/domain', ...adminOnly, deleteAgentDomain);

// Brokerage settings (owner): brand, domain, email sender, routing, FUB
router.get('/settings', ...adminOnly, getSettings);
router.patch('/settings', ...adminOnly, patchSettings);
router.post('/settings/asset/:kind', ...adminOnly, uploadBrandAsset);
router.post('/settings/domain', ...adminOnly, setSiteDomain);
router.post('/settings/domain/check', ...adminOnly, checkSiteDomain);
router.post('/settings/email-domain', ...adminOnly, setEmailDomain);
router.post('/settings/email-domain/verify', ...adminOnly, verifyEmailDomain);
router.post('/settings/test-email', ...adminOnly, sendTestEmail);
// Texting (Twilio, 10DLC) and hot-lead routing
router.get('/settings/sms', ...adminOnly, getSmsSettings);
router.patch('/settings/sms', ...adminOnly, patchSmsSettings);

// Your CRM: Follow Up Boss or the cockpit; contacts out (CSV) and in (Follow Up Boss CSV)
const csvBody = express.text({ type: ['text/csv', 'text/plain', 'application/csv'], limit: '15mb' });
router.get('/crm/settings', ...adminOnly, getCrmSettings);
router.put('/crm/mode', ...adminOnly, setCrmMode);
router.get('/crm/export', ...adminOnly, exportContacts);
router.post('/crm/import/preview', ...adminOnly, csvBody, previewContactsImport);
router.post('/crm/import', ...adminOnly, csvBody, importContacts);
// Lead sources: portal emails, Facebook lead ads, Zapier/web forms, routing rules
router.get('/intake', ...adminOnly, getIntake);
router.patch('/intake', ...adminOnly, patchIntake);
router.post('/intake/key', ...adminOnly, newIntakeKey);
router.post('/intake/test', ...adminOnly, testIntake);

// Brokerage reporting per agent (7/30/90 days, CSV)
router.get('/reports/agents', ...adminOnly, getAgentReports);

export default router;
