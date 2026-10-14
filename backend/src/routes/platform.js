import express from 'express';
import {
  listTenants, createTenant, patchTenant, requirePlatform, getTenantFeeds, putTenantFeed, putTenantServiceAreas,
} from '../controllers/platformController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const platformOnly = [authenticateToken, requireRole('admin'), requirePlatform];

router.get('/tenants', ...platformOnly, listTenants);
router.post('/tenants', ...platformOnly, createTenant);
router.patch('/tenants/:id', ...platformOnly, patchTenant);
router.get('/tenants/:id/feeds', ...platformOnly, getTenantFeeds);
router.put('/tenants/:id/feeds/:key', ...platformOnly, putTenantFeed);
router.put('/tenants/:id/service-areas', ...platformOnly, putTenantServiceAreas);

export default router;
