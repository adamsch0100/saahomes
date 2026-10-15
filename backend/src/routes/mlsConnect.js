/**
 * Connecting any MLS (controllers/mlsConnectController.js).
 *
 *   owner     → /api/admin     the brokerage owner's "Connect your MLS"
 *   platform  → /api/platform  every MLS connection, for the platform owner
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { requirePlatform } from '../controllers/platformController.js';
import {
  getCatalog, getConnect, startConnect, patchConnect, putConnectCredentials, testConnect, goLive, cancelConnect,
  listConnections, createConnection, patchConnection, putConnectionCredentials, testConnectionConsole, syncNow,
} from '../controllers/mlsConnectController.js';

const limiter = (windowMs, max, error) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error },
});

// A test pulls listings from the MLS: keep it well inside every platform's limits.
const testLimit = limiter(15 * 60 * 1000, Number(process.env.MLS_TEST_RATE_LIMIT) || 15, 'Too many connection tests. Please wait a few minutes.');
const credLimit = limiter(15 * 60 * 1000, 30, 'Too many tries. Please wait a few minutes.');

export const owner = express.Router();
const adminOnly = [authenticateToken, requireRole('admin')];
owner.get('/mls/catalog', ...adminOnly, getCatalog);
owner.get('/mls/connect', ...adminOnly, getConnect);
owner.post('/mls/connect', ...adminOnly, startConnect);
owner.patch('/mls/connect/:key', ...adminOnly, patchConnect);
owner.put('/mls/connect/:key/credentials', ...adminOnly, credLimit, putConnectCredentials);
owner.post('/mls/connect/:key/test', ...adminOnly, testLimit, testConnect);
owner.post('/mls/connect/:key/go-live', ...adminOnly, goLive);
owner.delete('/mls/connect/:key', ...adminOnly, cancelConnect);

export const platform = express.Router();
const platformOnly = [authenticateToken, requireRole('admin'), requirePlatform];
platform.get('/mls/catalog', ...platformOnly, getCatalog);
platform.get('/mls/connections', ...platformOnly, listConnections);
platform.post('/mls/connections', ...platformOnly, createConnection);
platform.patch('/mls/connections/:key', ...platformOnly, patchConnection);
platform.put('/mls/connections/:key/credentials', ...platformOnly, putConnectionCredentials);
platform.post('/mls/connections/:key/test', ...platformOnly, testLimit, testConnectionConsole);
platform.post('/mls/connections/:key/sync', ...platformOnly, syncNow);

export default { owner, platform };
