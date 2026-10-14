/**
 * The platform's own identity: the product brokerages sign up for, kept apart
 * from any one brokerage (SAA included). Signup, the platform's marketing
 * site, the owner console chrome and platform mail read it from here, so
 * renaming the product is a settings change, not a code change.
 *
 * Each field, first match wins:
 *   1. an override the platform owner saved in the console (platform_identity)
 *   2. its environment variable (see FIELDS)
 *   3. a default. The default name stays "SAA Homes for Brokerages" until the
 *      owner picks one, so nothing visibly changes for SAA.
 *
 * Overrides live in memory and refresh from the database once a minute
 * (refreshPlatformIdentity, called by the tenant middleware), so reads stay
 * synchronous.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';

export const DEFAULT_PLATFORM_NAME = 'SAA Homes for Brokerages';
const CACHE_MS = 60 * 1000;
const HEX = /^#[0-9a-f]{6}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
// The home brokerage's own hosts: never the platform's marketing site.
const HOME_HOSTS = new Set(['saahomes.com', 'www.saahomes.com']);

/** What the platform owner can set, the env vars behind each, and how each is checked. */
const FIELDS = {
  name: { env: ['PLATFORM_NAME', 'PRODUCT_NAME'], max: 80, label: 'Product name' },
  short_name: { env: ['PLATFORM_SHORT_NAME'], max: 30, label: 'Short name' },
  legal_name: { env: ['PLATFORM_LEGAL_NAME'], max: 160, label: 'Legal company name' },
  marketing_domain: { env: ['PLATFORM_MARKETING_DOMAIN'], kind: 'domain', label: 'Marketing site domain' },
  app_domain: { env: ['PLATFORM_BASE_DOMAIN', 'PLATFORM_DOMAIN'], kind: 'domain', label: 'Brokerage subdomain base' },
  cname_target: { env: ['PLATFORM_CNAME_TARGET'], kind: 'domain', label: 'Custom domain CNAME target' },
  support_email: { env: ['PLATFORM_SUPPORT_EMAIL'], kind: 'email', label: 'Support email' },
  from_email: { env: ['PLATFORM_FROM_EMAIL'], kind: 'email', label: 'Sending address' },
  logo_url: { env: ['PLATFORM_LOGO_URL'], kind: 'url', label: 'Logo URL' },
  icon_url: { env: ['PLATFORM_ICON_URL'], kind: 'url', label: 'Icon URL' },
  primary_color: { env: ['PLATFORM_PRIMARY_COLOR'], kind: 'color', label: 'Primary color' },
  accent_color: { env: ['PLATFORM_ACCENT_COLOR'], kind: 'color', label: 'Accent color' },
};
export const PLATFORM_FIELDS = Object.keys(FIELDS);

let overrides = {};
let loadedAt = 0;
let inflight = null;

const bareHost = (h) => String(h || '').trim().toLowerCase().split(':')[0].replace(/\.+$/, '').replace(/^www\./, '');

function fromEnv(key) {
  for (const name of FIELDS[key].env) {
    const v = String(process.env[name] || '').trim();
    if (v) return v;
  }
  return null;
}

/** A field's value before defaults: the owner's override, else its env var. */
function setValue(key) {
  const o = overrides[key];
  if (o !== undefined && o !== null && o !== '') return String(o);
  return fromEnv(key);
}

function clean(key, raw) {
  if (raw == null) return null;
  const rule = FIELDS[key];
  let v = String(raw).trim();
  if (!v) return null;
  if (rule.kind === 'domain') v = bareHost(v.replace(/^https?:\/\//i, '').replace(/\/.*$/, ''));
  if (rule.kind === 'color' && !HEX.test(v)) return null;
  return v;
}

/** "SAA Homes for Brokerages" → "SAA Homes"; short names stay as they are. */
function deriveShortName(name) {
  const stripped = name.replace(/\s+for\s+(real estate\s+)?brokerages$/i, '').trim();
  if (stripped && stripped.length <= 20) return stripped;
  return name.length <= 20 ? name : name.split(/\s+/)[0];
}

/** The platform's identity, every field resolved. */
export function platformIdentity() {
  const name = clean('name', setValue('name')) || DEFAULT_PLATFORM_NAME;
  const marketingRaw = clean('marketing_domain', setValue('marketing_domain'));
  const marketing = marketingRaw && !HOME_HOSTS.has(marketingRaw) ? marketingRaw : null;
  const app = clean('app_domain', setValue('app_domain'));
  const cnameSet = clean('cname_target', setValue('cname_target'));
  const support = clean('support_email', setValue('support_email'));
  return {
    name,
    short_name: clean('short_name', setValue('short_name')) || deriveShortName(name),
    legal_name: clean('legal_name', setValue('legal_name')) || name,
    marketing_domain: marketing,
    marketing_url: marketing ? `https://${marketing}` : null,
    app_domain: app,
    // Where a brokerage points its own domain. Without one set, the wildcard
    // the brokerage subdomains already need answers for cname.<app domain>.
    cname_target: cnameSet || (app ? `cname.${app}` : null),
    cname_target_set: !!cnameSet,
    support_email: support || (marketing ? `support@${marketing}` : null),
    from_email: clean('from_email', setValue('from_email')),
    logo_url: clean('logo_url', setValue('logo_url')),
    icon_url: clean('icon_url', setValue('icon_url')),
    primary_color: clean('primary_color', setValue('primary_color')) || '#111111',
    accent_color: clean('accent_color', setValue('accent_color')) || '#2563eb',
  };
}

/** The fields anyone may read (GET /api/platform): no sending address. */
export function publicPlatform(identity = platformIdentity()) {
  const { from_email, cname_target_set, ...rest } = identity;
  return {
    ...rest,
    start_path: '/start',
    sign_in_path: '/admin',
  };
}

/** The platform's own marketing host, or null when none is set. */
export function platformMarketingDomain() {
  return platformIdentity().marketing_domain;
}

/** True when this hostname is the platform's marketing site (with or without www.). */
export function isPlatformHost(hostname) {
  const marketing = platformMarketingDomain();
  return !!marketing && bareHost(hostname) === marketing;
}

/**
 * The platform's own address for links that belong to no brokerage site yet:
 * its marketing site when it has one, else the home site (as before).
 */
export function platformSiteUrl() {
  const id = platformIdentity();
  if (id.marketing_url) return id.marketing_url;
  return (process.env.SITE_URL || 'https://saahomes.com').replace(/\/$/, '');
}

/**
 * Who platform mail is from: the product's name, its own sending address
 * when one is set (else the shared sender), replies to support.
 */
export function platformSender() {
  const id = platformIdentity();
  return { name: id.name, address: id.from_email, replyTo: id.support_email };
}

/**
 * Validate an owner's changes. Only fields present are returned; '' or null
 * clears an override (back to env, then default). Returns { fields } or { error }.
 */
export function normalizePlatformSettings(input = {}) {
  const fields = {};
  for (const [key, rule] of Object.entries(FIELDS)) {
    if (!(key in (input || {}))) continue;
    const raw = input[key];
    if (raw === null || String(raw).trim() === '') {
      fields[key] = null;
      continue;
    }
    let v = String(raw).trim();
    if (rule.max) v = v.slice(0, rule.max);
    if (rule.kind === 'domain') {
      v = bareHost(v.replace(/^https?:\/\//i, '').replace(/\/.*$/, ''));
      if (!DOMAIN_RE.test(v)) return { error: `${rule.label} must be a domain like example.com` };
      if (key === 'marketing_domain' && HOME_HOSTS.has(v)) return { error: 'That domain belongs to the home brokerage' };
    }
    if (rule.kind === 'email' && !EMAIL_RE.test(v)) return { error: `${rule.label} must be an email address` };
    if (rule.kind === 'color' && !HEX.test(v)) return { error: `${rule.label} must be a color like #1a2b3c` };
    if (rule.kind === 'url') {
      let ok = false;
      try {
        const u = new URL(v, 'https://x.invalid');
        ok = u.protocol === 'https:' || v.startsWith('/');
      } catch { ok = false; }
      if (!ok) return { error: `${rule.label} must be an https:// link` };
    }
    fields[key] = v;
  }
  return { fields };
}

/** For the console: each field's value, where it comes from, and its env var. */
export function platformSettingsView() {
  const id = platformIdentity();
  const fields = PLATFORM_FIELDS.map((key) => {
    const o = overrides[key];
    const source = o !== undefined && o !== null && o !== '' ? 'console' : fromEnv(key) ? 'env' : 'default';
    return {
      key,
      label: FIELDS[key].label,
      env: FIELDS[key].env[0],
      value: id[key] ?? null,
      override: source === 'console' ? String(o) : null,
      env_value: fromEnv(key),
      source,
    };
  });
  return { identity: publicPlatform(id), fields };
}

/** Load overrides now, or when older than a minute. Never throws. */
export async function refreshPlatformIdentity({ pool = null, force = false } = {}) {
  if (!force && Date.now() - loadedAt < CACHE_MS) return platformIdentity();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const p = pool || getPool();
      const r = await p.query('SELECT overrides FROM platform_identity WHERE id = 1');
      overrides = r.rows[0]?.overrides || {};
    } catch (err) {
      // No database (or not migrated yet): env and defaults still answer.
      if (!/DATABASE_URL/.test(err.message)) logger.warn('platform identity load failed', { message: err.message });
    } finally {
      loadedAt = Date.now();
      inflight = null;
    }
    return platformIdentity();
  })();
  return inflight;
}

/** Save the owner's changes (normalized fields; null clears one). */
export async function savePlatformOverrides(fields, { pool = getPool(), by = null } = {}) {
  await refreshPlatformIdentity({ pool, force: true });
  const next = { ...overrides };
  for (const [k, v] of Object.entries(fields)) {
    if (v === null) delete next[k];
    else next[k] = v;
  }
  await pool.query(
    `INSERT INTO platform_identity (id, overrides, updated_by, updated_at) VALUES (1, $1::jsonb, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET overrides = EXCLUDED.overrides, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [JSON.stringify(next), by]
  );
  overrides = next;
  loadedAt = Date.now();
  return platformIdentity();
}

/** Tests: forget loaded overrides. */
export function resetPlatformIdentityCache() {
  overrides = {};
  loadedAt = 0;
}
