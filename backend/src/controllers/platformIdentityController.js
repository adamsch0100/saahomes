/**
 * The platform's identity over HTTP:
 *
 *   GET /api/platform            public: the product's name, domains, support
 *                                address, logo and colors (signup, the
 *                                marketing site, the console chrome)
 *   GET /api/platform/settings   platform owner: each field, its value and
 *                                where it comes from (console, env, default)
 *   PUT /api/platform/settings   platform owner: change or clear overrides
 */
import logger from '../utils/logger.js';
import { clearTenantCache } from '../services/tenantContext.js';
import {
  publicPlatform, isPlatformHost, platformSettingsView, normalizePlatformSettings, savePlatformOverrides,
} from '../services/platform.js';

/** GET /api/platform */
export const getPlatform = (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  return res.json({ success: true, data: { ...publicPlatform(), is_platform_host: isPlatformHost(req.hostname) } });
};

/** GET /api/platform/settings */
export const getPlatformSettings = (req, res) => res.json({ success: true, data: platformSettingsView() });

/** PUT /api/platform/settings { name?, short_name?, ..., accent_color? } */
export const putPlatformSettings = async (req, res) => {
  const parsed = normalizePlatformSettings(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (!Object.keys(parsed.fields).length) return res.status(400).json({ error: 'Nothing to change' });
  try {
    await savePlatformOverrides(parsed.fields, { by: req.user?.email || null });
    // A new subdomain base changes which brokerage a host belongs to.
    clearTenantCache();
    logger.info('platform identity updated', { fields: Object.keys(parsed.fields), by: req.user?.email });
    return res.json({ success: true, data: platformSettingsView() });
  } catch (error) {
    logger.error('putPlatformSettings error', error);
    return res.status(500).json({ error: 'Could not save the platform settings' });
  }
};
