import express from 'express';
import { listTenants, createTenant, patchTenant, requirePlatform } from '../controllers/platformController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const platformOnly = [authenticateToken, requireRole('admin'), requirePlatform];

router.get('/tenants', ...platformOnly, listTenants);
router.post('/tenants', ...platformOnly, createTenant);
router.patch('/tenants/:id', ...platformOnly, patchTenant);

export default router;
