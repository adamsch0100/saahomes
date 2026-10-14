/**
 * The owner's first-run setup and the cards around it:
 *
 *   GET   /api/admin/setup               progress, billing, Follow Up Boss and site status
 *   PATCH /api/admin/setup               { step, status } | { dismissed } | { completed } | { mls_paperwork_started }
 *   POST  /api/admin/setup/confirm-email { token } (public; the emailed link)
 *   POST  /api/admin/setup/resend-confirm
 *   GET   /api/admin/embeds              where the widgets live, and their views
 *
 * Progress lives in tenants.settings.setup, so an owner can leave and come
 * back. The forms themselves are the Settings forms (no copies here).
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  tenantIdOf, clearTenantCache, siteUrlFor, hasOwnAddress, pausedForBilling, DEFAULT_TENANT_ID,
} from '../services/tenantContext.js';
import { isHomeTenant } from '../services/brand.js';
import { billingFor } from '../services/billing.js';
import { fubWebhookStatusText } from '../services/fubAutomation.js';
import { issueAccountLink, hashLinkToken } from '../services/accountLinks.js';

export const SETUP_STEPS = ['brand', 'domain', 'fub', 'mls', 'agents', 'billing'];
const STEP_STATUS = ['done', 'skipped', 'open'];

async function loadTenant(pool, id) {
  const r = await pool.query('SELECT id, slug, name, primary_domain, market_key, status, settings FROM tenants WHERE id = $1', [id]);
  const t = r.rows[0];
  return t ? { ...t, id: Number(t.id), settings: t.settings || {}, agent: null, site_host: null } : null;
}

const isOwner = (req) => req.user?.role === 'admin' && req.user?.platform !== true;

async function payload(req, pool) {
  const base = await loadTenant(pool, tenantIdOf(req));
  const tenant = { ...base, site_host: req.tenant?.site_host || null };
  const home = isHomeTenant(tenant);
  const s = tenant.settings || {};
  const setup = s.setup || {};
  const steps = {};
  for (const k of SETUP_STEPS) steps[k] = setup.steps?.[k]?.status || 'open';
  let emailConfirmed = true;
  if (req.user?.id) {
    const u = await pool.query('SELECT email_confirmed_at FROM users WHERE id = $1 AND tenant_id = $2', [req.user.id, tenant.id]);
    emailConfirmed = !!u.rows[0]?.email_confirmed_at || s.signup?.via !== 'self_serve';
  }
  const hook = s.fub_webhook || {};
  return {
    home,
    owner: isOwner(req),
    brokerage: { id: tenant.id, name: s.brand?.name || tenant.name, slug: tenant.slug },
    steps,
    order: SETUP_STEPS,
    done_count: SETUP_STEPS.filter((k) => steps[k] !== 'open').length,
    completed_at: setup.completed_at || null,
    dismissed_at: setup.dismissed_at || null,
    mls_paperwork_started_at: setup.mls_paperwork_started_at || null,
    email_confirmed: emailConfirmed,
    paused: pausedForBilling(tenant),
    billing: await billingFor(tenant, { pool }),
    fub: {
      connected: home ? !!process.env.FOLLOW_UP_BOSS_API_KEY : !!s.fub_api_key,
      new_contact_alerts: home ? 'home' : (s.fub_api_key ? hook.status || 'pending' : 'off'),
      new_contact_alerts_text: home ? null : fubWebhookStatusText(s.fub_api_key ? hook : null),
    },
    site: { url: hasOwnAddress(tenant) ? siteUrlFor(tenant) : null, has_address: hasOwnAddress(tenant) },
  };
}

/** GET /api/admin/setup */
export const getSetup = async (req, res) => {
  try {
    return res.json({ success: true, data: await payload(req, getPool()) });
  } catch (error) {
    logger.error('getSetup error', error);
    return res.status(500).json({ error: 'Could not load setup' });
  }
};

/** PATCH /api/admin/setup */
export const patchSetup = async (req, res) => {
  const tenantId = tenantIdOf(req);
  if (tenantId === DEFAULT_TENANT_ID) return res.status(400).json({ error: 'This brokerage is already set up' });
  const b = req.body || {};
  const pool = getPool();
  try {
    const tenant = await loadTenant(pool, tenantId);
    const setup = { ...(tenant.settings.setup || {}) };
    const steps = { ...(setup.steps || {}) };
    const now = new Date().toISOString();
    if (!setup.started_at) setup.started_at = now;
    if (b.step !== undefined) {
      if (!SETUP_STEPS.includes(b.step)) return res.status(400).json({ error: 'Unknown step' });
      if (!STEP_STATUS.includes(b.status)) return res.status(400).json({ error: 'Status must be done, skipped or open' });
      steps[b.step] = { status: b.status, at: now };
    }
    if (b.mls_paperwork_started === true) {
      setup.mls_paperwork_started_at = setup.mls_paperwork_started_at || now;
      steps.mls = { status: 'done', at: now };
    }
    if (b.dismissed !== undefined) setup.dismissed_at = b.dismissed ? now : null;
    if (b.completed === true) setup.completed_at = now;
    setup.steps = steps;
    await pool.query("UPDATE tenants SET settings = jsonb_set(settings, '{setup}', $1::jsonb) WHERE id = $2", [JSON.stringify(setup), tenantId]);
    clearTenantCache();
    return res.json({ success: true, data: await payload(req, pool) });
  } catch (error) {
    logger.error('patchSetup error', error);
    return res.status(500).json({ error: 'Could not save your progress' });
  }
};

/** POST /api/admin/setup/confirm-email { token } — the owner's emailed link. */
export const confirmEmail = async (req, res) => {
  const token = String(req.body?.token || '');
  if (token.length < 20 || token.length > 100) return res.status(400).json({ error: 'This link has expired or was already used.' });
  try {
    const pool = getPool();
    const r = await pool.query(
      `UPDATE password_resets pr SET used_at = NOW()
       FROM users u
       WHERE pr.token_hash = $1 AND pr.tenant_id = $2 AND pr.purpose = 'confirm'
         AND pr.used_at IS NULL AND pr.expires_at > NOW()
         AND u.id = pr.user_id AND u.tenant_id = $2 AND u.status = 'active'
       RETURNING u.id, u.email`,
      [hashLinkToken(token), tenantIdOf(req)]
    );
    const u = r.rows[0];
    if (!u) return res.status(400).json({ error: 'This link has expired or was already used.' });
    await pool.query('UPDATE users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) WHERE id = $1', [u.id]);
    return res.json({ success: true, email: u.email });
  } catch (error) {
    logger.error('confirmEmail error', error);
    return res.status(500).json({ error: 'Could not confirm your email' });
  }
};

/** POST /api/admin/setup/resend-confirm */
export const resendConfirm = async (req, res) => {
  if (!req.user?.id) return res.status(400).json({ error: 'This sign-in has no email to confirm' });
  try {
    const pool = getPool();
    const r = await pool.query(
      "SELECT id, email, name, role, tenant_id, email_confirmed_at FROM users WHERE id = $1 AND tenant_id = $2 AND status = 'active'",
      [req.user.id, tenantIdOf(req)]
    );
    const u = r.rows[0];
    if (!u) return res.status(404).json({ error: 'Account not found' });
    if (u.email_confirmed_at) return res.json({ success: true, already: true });
    const { sent } = await issueAccountLink({ user: u, purpose: 'confirm', tenant: req.tenant, pool });
    if (!sent) return res.status(429).json({ error: 'We just sent one. Check your inbox, or try again in an hour.' });
    return res.json({ success: true, to: u.email });
  } catch (error) {
    logger.error('resendConfirm error', error);
    return res.status(500).json({ error: 'Could not send the email' });
  }
};

/** GET /api/admin/embeds */
export const getEmbeds = async (req, res) => {
  try {
    const pool = getPool();
    const tenantId = tenantIdOf(req);
    const tenant = { ...(await loadTenant(pool, tenantId)), site_host: req.tenant?.site_host || null };
    const r = await pool.query(
      `SELECT meta->>'widget' AS widget, COUNT(*)::int AS n FROM events
       WHERE tenant_id = $1 AND type = 'embed_view' AND occurred_at > NOW() - INTERVAL '30 days'
       GROUP BY 1`,
      [tenantId]
    );
    const views = { search: 0, listings: 0, listing: 0 };
    for (const row of r.rows) if (row.widget in views) views[row.widget] = row.n;
    return res.json({
      success: true,
      data: {
        base_url: hasOwnAddress(tenant) ? siteUrlFor(tenant) : null,
        views_30d: views,
        market_name: tenant.settings?.brand?.market_name || null,
      },
    });
  } catch (error) {
    logger.error('getEmbeds error', error);
    return res.status(500).json({ error: 'Could not load embeds' });
  }
};
