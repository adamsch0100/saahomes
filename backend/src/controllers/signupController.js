/**
 * Self-serve signup on the platform's own site (/start): a brokerage owner
 * creates their brokerage, their owner account and a free site address in
 * one step, and lands in their setup with a 14-day free trial.
 *
 *   GET  /api/signup/info        product name, plans and prices, and trial
 *   GET  /api/signup/check?slug= is this site address free?
 *   POST /api/signup             create it all
 *
 * Only answers on the home brokerage's own host. Bots meet a hidden field,
 * a minimum fill time and a per-IP limit (routes/plugAndPlay.js).
 */
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  DEFAULT_TENANT_ID, clearTenantCache, platformBaseDomain, siteUrlFor, consoleUrlFor, hasOwnAddress,
} from '../services/tenantContext.js';
import { issueAccountLink } from '../services/accountLinks.js';
import { generateToken } from '../middleware/auth.js';
import { newTrial, planChoice, TRIAL_DAYS } from '../services/billing.js';
import { plansReady, seatPrice, stripeConfigured } from '../services/stripe.js';
import { loadPlanCatalog, publicCatalog } from '../services/plans.js';
import { findPlanPrices } from '../services/stripeSetup.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'agent', 'platform', 'mail', 'static', 'cdn', 'saa', 'start', 'signup',
  'help', 'support', 'billing', 'status', 'blog', 'docs', 'embed', 'assets', 'email', 'smtp', 'ftp', 'test',
]);
const MIN_FILL_MS = 2500;

export const productName = () => String(process.env.PRODUCT_NAME || '').trim() || 'SAA Homes for Brokerages';

const onHomeHost = (req) => (req.tenant?.id ?? DEFAULT_TENANT_ID) === DEFAULT_TENANT_ID && !req.tenant?.agent;

/** "Peak Realty Group, LLC" → "peak-realty-group" */
export function slugify(name) {
  return String(name || '').toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(llc|inc|ltd|co)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** Why a site address can't be used, or null when it's free. */
async function slugProblem(pool, slug) {
  if (!SLUG_RE.test(slug)) return 'Use 3 to 40 lowercase letters, numbers and dashes';
  if (RESERVED.has(slug)) return 'That address is reserved';
  const r = await pool.query('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
  if (r.rows[0]) return 'That address is taken';
  const base = platformBaseDomain();
  if (base) {
    const host = `${slug}.${base}`;
    const d = await pool.query(
      `SELECT 1 FROM tenants WHERE LOWER(REGEXP_REPLACE(primary_domain, '^www\\.', '')) = $1
       UNION ALL SELECT 1 FROM users WHERE custom_domain IN ($1, 'www.' || $1) AND domain_verified_at IS NOT NULL
       LIMIT 1`,
      [host]
    );
    if (d.rows[0]) return 'That address is taken';
  }
  return null;
}

async function freeSlugFrom(pool, name) {
  let base = slugify(name);
  if (base.length < 3) base = `${base || 'homes'}-homes`.replace(/^-/, '');
  if (!(await slugProblem(pool, base))) return base;
  for (let n = 2; n < 10; n += 1) {
    const s = `${base.slice(0, 36)}-${n}`;
    if (!(await slugProblem(pool, s))) return s;
  }
  return `${base.slice(0, 32)}-${crypto.randomBytes(3).toString('hex')}`;
}

/** GET /api/signup/info */
export const signupInfo = async (req, res) => {
  if (!onHomeHost(req)) return res.status(404).json({ error: 'Not found' });
  if (stripeConfigured()) await findPlanPrices();
  // The legacy single price only shows while the plan prices aren't in Stripe.
  const price = plansReady() ? null : await seatPrice();
  return res.json({
    success: true,
    product_name: productName(),
    trial_days: TRIAL_DAYS(),
    // The plans and their prices, known before any Stripe setup.
    ...publicCatalog(await loadPlanCatalog()),
    price, // legacy { amount, currency, interval }, or null
    base_domain: platformBaseDomain() || null,
  });
};

/** GET /api/signup/check?slug= */
export const checkSlug = async (req, res) => {
  if (!onHomeHost(req)) return res.status(404).json({ error: 'Not found' });
  const slug = String(req.query.slug || '').trim().toLowerCase();
  try {
    const problem = await slugProblem(getPool(), slug);
    const base = platformBaseDomain();
    return res.json({ success: true, available: !problem, reason: problem, host: base ? `${slug}.${base}` : null });
  } catch (error) {
    logger.error('checkSlug error', error);
    return res.status(500).json({ error: 'Could not check that address' });
  }
};

async function notifyPlatformOwner(pool, tenant, ownerEmail, city) {
  const to = String(process.env.ADMIN_EMAIL || '').trim();
  if (!EMAIL_RE.test(to)) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  await pool.query(
    'INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)',
    [to, `New brokerage signup: ${tenant.name}`,
      `<p>${esc(tenant.name)} (${esc(tenant.slug)}) just signed up.</p><p>Owner: ${esc(ownerEmail)}<br>Market: ${esc(city)}</p>`,
      DEFAULT_TENANT_ID]
  ).catch(() => {});
}

/**
 * POST /api/signup { brokerage_name, name, email, phone, password, city,
 *   slug?, plan?, interval?, website (hidden: must stay empty), elapsed_ms }
 */
export const signup = async (req, res) => {
  if (!onHomeHost(req)) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  // Bots fill every field and submit instantly.
  if (String(b.website || '').trim() || !(Number(b.elapsed_ms) >= MIN_FILL_MS)) {
    logger.warn('signup rejected as automated', { ip: req.ip });
    return res.status(400).json({ error: 'Something went wrong. Please try again.' });
  }
  const brokerageName = String(b.brokerage_name || '').trim().slice(0, 120);
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().toLowerCase();
  const phone = String(b.phone || '').replace(/\D/g, '');
  const password = String(b.password || '');
  const city = String(b.city || '').trim().slice(0, 80);
  const wantedSlug = String(b.slug || '').trim().toLowerCase();

  if (brokerageName.length < 2) return res.status(400).json({ error: 'Enter your brokerage’s name', field: 'brokerage_name' });
  if (name.length < 2) return res.status(400).json({ error: 'Enter your name', field: 'name' });
  if (!EMAIL_RE.test(email) || email.length > 255) return res.status(400).json({ error: 'Enter a valid email', field: 'email' });
  if (phone.length < 10 || phone.length > 15) return res.status(400).json({ error: 'Enter a phone number with area code', field: 'phone' });
  if (password.length < 8) return res.status(400).json({ error: 'Use a password of at least 8 characters', field: 'password' });
  if (password.length > 200) return res.status(400).json({ error: 'That password is too long', field: 'password' });
  if (city.length < 2) return res.status(400).json({ error: 'Enter the city or area you serve', field: 'city' });

  const pool = getPool();
  const client = await pool.connect();
  try {
    let slug;
    if (wantedSlug) {
      const problem = await slugProblem(client, wantedSlug);
      if (problem) return res.status(409).json({ error: problem, field: 'slug' });
      slug = wantedSlug;
    } else {
      slug = await freeSlugFrom(client, brokerageName);
    }
    const hash = await bcrypt.hash(password, 10);
    const settings = {
      billing: newTrial(Date.now(), planChoice(await loadPlanCatalog(), b.plan, b.interval) || {}),
      brand: { name: brokerageName, phone, market_name: city },
      signup: { city, at: new Date().toISOString(), via: 'self_serve' },
      setup: { started_at: null },
    };

    await client.query('BEGIN');
    const t = await client.query(
      `INSERT INTO tenants (slug, name, primary_domain, market_key, status, settings)
       VALUES ($1, $2, NULL, 'noco', 'active', $3::jsonb)
       RETURNING id, slug, name, primary_domain, market_key, status, settings`,
      [slug, brokerageName, JSON.stringify(settings)]
    );
    const tenant = { ...t.rows[0], id: Number(t.rows[0].id), agent: null, site_host: null };
    const owner = (await client.query(
      `INSERT INTO users (email, name, phone, role, status, manage_token, password_hash, tenant_id, last_active_at)
       VALUES ($1, $2, $3, 'admin', 'active', $4, $5, $6, NOW())
       RETURNING id, email, name, role, tenant_id`,
      [email, name, phone, crypto.randomBytes(24).toString('hex'), hash, tenant.id]
    )).rows[0];
    await client.query('COMMIT');
    clearTenantCache();

    let confirmSent = false;
    try {
      confirmSent = (await issueAccountLink({ user: owner, purpose: 'confirm', tenant, pool })).sent;
    } catch (e) {
      logger.error('signup confirm email failed', { message: e.message });
    }
    notifyPlatformOwner(pool, tenant, email, city);
    logger.info('brokerage signed up', { tenant_id: tenant.id, slug });

    const token = generateToken({ id: owner.id, email: owner.email, role: 'admin', tenant_id: tenant.id, name: owner.name });
    return res.status(201).json({
      success: true,
      data: {
        slug,
        name: brokerageName,
        site_url: hasOwnAddress(tenant) ? siteUrlFor(tenant) : null,
        console_url: consoleUrlFor(tenant, '/admin'),
        token,
        confirm_sent: confirmSent,
        trial_ends_at: settings.billing.trial_ends_at,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'That address is taken', field: 'slug' });
    logger.error('signup error', error);
    return res.status(500).json({ error: 'Could not create your brokerage. Please try again.' });
  } finally {
    client.release();
  }
};
