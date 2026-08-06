import express from 'express';
import { login, getSubmissions, getSubmission, getStats, getClientSearches, createClientSearch, updateClientSearch, deleteClientSearch, searchStats } from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public admin routes
router.post('/login', login);

// Protected admin routes
router.get('/submissions', authenticateToken, getSubmissions);
router.get('/submissions/:type/:id', authenticateToken, getSubmission);
router.get('/stats', authenticateToken, getStats);

// Client saved-search CRM (agent side)
router.get('/searches', authenticateToken, getClientSearches);
router.post('/searches', authenticateToken, createClientSearch);
router.patch('/searches/:id', authenticateToken, updateClientSearch);
router.delete('/searches/:id', authenticateToken, deleteClientSearch);
router.get('/search-stats', authenticateToken, searchStats);

export default router;

