import express from 'express';
import { login, getSubmissions, getSubmission, getStats } from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public admin routes
router.post('/login', login);

// Protected admin routes
router.get('/submissions', authenticateToken, getSubmissions);
router.get('/submissions/:type/:id', authenticateToken, getSubmission);
router.get('/stats', authenticateToken, getStats);

export default router;

