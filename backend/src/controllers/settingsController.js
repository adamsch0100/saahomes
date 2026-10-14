/**
 * Self-serve settings: a brokerage owner's brand, website domain, email
 * sender, lead routing, security and Follow Up Boss; an agent's own profile;
 * and the public brand files (logo, icon, agent photos) those settings upload.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  tenantIdOf, clearTenantCache, leadVisibility, siteUrlFor, DEFAULT_TENANT_ID,
} from '../services/tenantContext.js';
import {
  normalizeBrandSettings, publicBrand, brandFor, BRAND_FIELDS, isHomeTenant,
} from '../services/brand.js';
import {
  railwayDomainsAvailable, cnameTarget, addCustomDomain, getCustomDomain,
} from '../services/railwayDomains.js';

const LEAD_VISIBILITY = ['own', 'own_and_unassigned', 'all'];
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/;
const MAX_ASSET_BYTES = 600 * 1024;
const ASSET_KIND_RE = /^(logo|icon|agent-\d{1,9})$/;

async function emailHelpers() {
  try {
    return await import('../services/emailer.js');
  } catch {
    return {};
  }
}

async function loadTenantRow(pool, id) {
  const r = await pool.query(
    'SELECT id, slug, name, primary_domain, market_key, status, settings FROM tenants WHERE id = $1',
    [id]
  );
  const row = r.rows[0];
  if (!row) return null;
  return { ...row, id: Number(row.id), settings: row.settings || {}, agent: null, site_host: null };
}

function normalizeDomain(raw) {
  return String(raw || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.+$/, '').replace(/^www\./, '');
}

async function settingsPayload(tenant) {
  const s = tenant.settings || {};
  const brand = {};
  for (const k of BRAND_FIELDS) brand[k] = s.brand?.[k] ?? null;
  const helpers = await emailHelpers();
  const own = typeof helpers.ownDomainSendingAvailable === 'function' && helpers.ownDomainSendingAvailable();
  const sending = s.email?.sending_domain || null;
  const platform = String(process.env.PLATFORM_DOMAIN || '').trim().toLowerCase();
  const fubKey = isHomeTenant(tenant) ? (process.env.FOLLOW_UP_BOSS_API_KEY || '') : String(s.fub_api_key || '');
  const site = s.site || {};
  return {
    brokerage: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    brand,
    resolved: publicBrand(tenant),
    lead_visibility: leadVisibility(tenant),
    require_2fa: s.require_2fa === true,
    fub: { connected: !!fubKey, last4: fubKey ? fubKey.slice(-4) : null, managed_by_platform: isHomeTenant(tenant) },
    email: {
      provider: sending?.status === 'verified' && own ? 'resend' : 'shared',
      can_use_own_domain: !!own,
      sending_domain: sending ? { domain: sending.domain, status: sending.status, records: sending.records || [] } : null,
    },
    site: {
      url: siteUrlFor(tenant),
      primary_domain: tenant.primary_domain || null,
      subdomain_url: platform && !isHomeTenant(tenant) ? `https://${tenant.slug}.${platform}` : null,
      dns: site.records || (tenant.primary_domain && !isHomeTenant(tenant)
        ? [{ type: 'CNAME', name: '@ or www', value: cnameTarget(), status: 'unknown' }]
        : []),
      domain_status: !tenant.primary_domain ? 'none' : (site.certificate === 'ISSUED' || isHomeTenant(tenant) ? 'active' : 'pending'),
      automatic: railwayDomainsAvailable(),
    },
  };
}

async function writeSettings(pool, tenantId, patch) {
  await pool.query('UPDATE tenants SET settings = settings || $1::jsonb WHERE id = $2', [JSON.stringify(patch), tenantId]);
  clearTenantCache();
}

/** GET /api/admin/settings */
export const getSettings = async (req, res) => {
  try {
    const tenant = await loadTenantRow(getPool(), tenantIdOf(req));
    if (!tenant) return res.status(404).json({ error: 'Brokerage not found' });
    return res.json({ success: true, data: await settingsPayload(tenant) });
  } catch (error) {
    logger.error('getSettings error', error);
    return res.status(500).json({ error: 'Could not load settings' });
  }
};

/** PATCH /api/admin/settings */
export const patchSettings = async (req, res) => {
  const b = req.body || {};
  const pool = getPool();
  try {
    const tenantId = tenantIdOf(req);
    const tenant = await loadTenantRow(pool, tenantId);
    if (!tenant) return res.status(404).json({ error: 'Brokerage not found' });
    const patch = {};

    if (b.brand !== undefined) {
      const parsed = normalizeBrandSettings(b.brand || {});
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const merged = { ...(tenant.settings.brand || {}) };
      for (const [k, v] of Object.entries(parsed.fields)) {
        if (v === null) delete merged[k];
        else merged[k] = v;
      }
      patch.brand = merged;
    }
    if (b.lead_visibility !== undefined) {
      if (!LEAD_VISIBILITY.includes(b.lead_visibility)) {
        return res.status(400).json({ error: 'Lead visibility must be own, own_and_unassigned or all' });
      }
      patch.lead_visibility = b.lead_visibility;
    }
    if (b.require_2fa !== undefined) patch.require_2fa = b.require_2fa === true;
    if (b.fub_api_key !== undefined) {
      if (isHomeTenant(tenant)) {
        return res.status(400).json({ error: "This brokerage's Follow Up Boss key is set on the server" });
      }
      const key = String(b.fub_api_key || '').trim();
      if (key) {
        const { verifyFollowUpBossApiKey } = await import('../services/followUpBossService.js');
        const verified = await verifyFollowUpBossApiKey(key);
        if (!verified.success) return res.status(400).json({ error: verified.error || 'Follow Up Boss didn’t accept that key' });
      }
      patch.fub_api_key = key || null;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change' });

    await writeSettings(pool, tenantId, patch);
    logger.info('brokerage settings updated', { tenant_id: tenantId, fields: Object.keys(patch), by: req.user?.email });
    const fresh = await loadTenantRow(pool, tenantId);
    return res.json({ success: true, data: await settingsPayload(fresh) });
  } catch (error) {
    logger.error('patchSettings error', error);
    return res.status(500).json({ error: 'Could not save settings' });
  }
};

function parseDataUrl(dataUrl) {
  const m = DATA_URL_RE.exec(String(dataUrl || ''));
  if (!m) return { error: 'Upload a PNG, JPEG, WebP or SVG image' };
  const data = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!data.length) return { error: 'That image is empty' };
  if (data.length > MAX_ASSET_BYTES) return { error: 'Images must be under 600 KB' };
  if (m[1] === 'image/svg+xml' && /<script|on\w+\s*=|javascript:/i.test(data.toString('utf8'))) {
    return { error: 'That SVG has scripts in it. Export it again as a plain image.' };
  }
  return { mime: m[1], data };
}

async function saveAsset(pool, tenantId, kind, mime, data) {
  await pool.query(
    `INSERT INTO tenant_assets (tenant_id, kind, mime, data, updated_at) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id, kind) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = NOW()`,
    [tenantId, kind, mime, data]
  );
}

const assetUrl = (tenant, kind) => `${siteUrlFor(tenant)}/api/tenant/asset/${kind}?v=${Date.now().toString(36)}`;

/** POST /api/admin/settings/asset/:kind { data_url } — logo or icon */
export const uploadBrandAsset = async (req, res) => {
  const kind = String(req.params.kind || '');
  if (!['logo', 'icon'].includes(kind)) return res.status(400).json({ error: 'Upload a logo or an icon' });
  const parsed = parseDataUrl(req.body?.data_url);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const pool = getPool();
    const tenantId = tenantIdOf(req);
    const tenant = await loadTenantRow(pool, tenantId);
    await saveAsset(pool, tenantId, kind, parsed.mime, parsed.data);
    const url = assetUrl(tenant, kind);
    await writeSettings(pool, tenantId, { brand: { ...(tenant.settings.brand || {}), [`${kind}_url`]: url } });
    return res.json({ success: true, url });
  } catch (error) {
    logger.error('uploadBrandAsset error', error);
    return res.status(500).json({ error: 'Could not save the image' });
  }
};

/** GET /api/tenant/asset/:kind — public; the current host's brokerage only. */
export const serveBrandAsset = async (req, res) => {
  const kind = String(req.params.kind || '');
  if (!ASSET_KIND_RE.test(kind)) return res.status(404).end();
  try {
    const r = await getPool().query('SELECT mime, data, updated_at FROM tenant_assets WHERE tenant_id = $1 AND kind = $2', [tenantIdOf(req), kind]);
    const a = r.rows[0];
    if (!a) return res.status(404).end();
    res.set('Content-Type', a.mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    // An uploaded SVG can never run script on the brokerage's domain.
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.set('Last-Modified', new Date(a.updated_at).toUTCString());
    return res.send(a.data);
  } catch (error) {
    logger.error('serveBrandAsset error', error);
    return res.status(500).end();
  }
};

/** GET /api/tenant/agents — the current brokerage's active agents, for its site. */
export const listPublicAgents = async (req, res) => {
  try {
    if (isHomeTenant(req.tenant)) return res.json({ success: true, data: [] });
    const r = await getPool().query(
      `SELECT id, name, title, phone, brand_phone, email, photo_url, bio
       FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin') AND status = 'active'
         AND password_hash IS NOT NULL
       ORDER BY name NULLS LAST, id LIMIT 60`,
      [tenantIdOf(req)]
    );
    return res.json({
      success: true,
      data: r.rows.map((a) => ({
        id: a.id, name: a.name, title: a.title, phone: a.brand_phone || a.phone || null,
        email: a.email, photo_url: a.photo_url, bio: a.bio,
      })),
    });
  } catch (error) {
    logger.error('listPublicAgents error', error);
    return res.status(500).json({ error: 'Could not load agents' });
  }
};

/** POST /api/admin/settings/domain { domain } — the brokerage's own website domain. */
export const setSiteDomain = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  if (tenantId === DEFAULT_TENANT_ID) return res.status(400).json({ error: "This brokerage's domain is managed by the platform" });
  const domain = normalizeDomain(req.body?.domain);
  if (!DOMAIN_RE.test(domain)) return res.status(400).json({ error: 'Enter a domain like yourbrokerage.com' });
  try {
    const taken = await pool.query(
      `SELECT 1 FROM tenants WHERE LOWER(REGEXP_REPLACE(primary_domain, '^www\\.', '')) = $1 AND id <> $2
       UNION ALL SELECT 1 FROM users WHERE custom_domain IN ($1, 'www.' || $1) AND domain_verified_at IS NOT NULL AND tenant_id <> $2
       LIMIT 1`,
      [domain, tenantId]
    );
    if (taken.rows[0]) return res.status(409).json({ error: 'That domain is already in use' });

    let site = { records: [{ type: 'CNAME', name: 'www', value: cnameTarget(), status: 'unknown' }], certificate: null };
    if (railwayDomainsAvailable()) {
      try {
        const added = await addCustomDomain(domain);
        site = { railway_id: added.id, records: added.records, certificate: added.certificate };
      } catch (e) {
        logger.error('Railway domain add failed', { domain, message: e.message });
        return res.status(502).json({ error: `Couldn't connect the domain: ${e.message}` });
      }
    }
    await pool.query('UPDATE tenants SET primary_domain = $1 WHERE id = $2', [domain, tenantId]);
    await writeSettings(pool, tenantId, { site });
    logger.info('brokerage domain set', { tenant_id: tenantId, domain });
    const fresh = await loadTenantRow(pool, tenantId);
    return res.json({ success: true, data: (await settingsPayload(fresh)).site });
  } catch (error) {
    logger.error('setSiteDomain error', error);
    return res.status(500).json({ error: 'Could not save the domain' });
  }
};

/** POST /api/admin/settings/domain/check — refresh DNS and certificate status. */
export const checkSiteDomain = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  try {
    const tenant = await loadTenantRow(pool, tenantId);
    const id = tenant.settings.site?.railway_id;
    if (id && railwayDomainsAvailable()) {
      const d = await getCustomDomain(id);
      await writeSettings(pool, tenantId, { site: { ...tenant.settings.site, records: d.records, certificate: d.certificate } });
    }
    const fresh = await loadTenantRow(pool, tenantId);
    return res.json({ success: true, data: (await settingsPayload(fresh)).site });
  } catch (error) {
    logger.error('checkSiteDomain error', error);
    return res.status(502).json({ error: 'Could not check the domain right now' });
  }
};

/** POST /api/admin/settings/email-domain { domain } */
export const setEmailDomain = async (req, res) => {
  const helpers = await emailHelpers();
  if (typeof helpers.ownDomainSendingAvailable !== 'function' || !helpers.ownDomainSendingAvailable()) {
    return res.status(503).json({ error: 'Sending from your own domain isn’t switched on for this platform yet' });
  }
  const domain = normalizeDomain(req.body?.domain);
  if (!DOMAIN_RE.test(domain)) return res.status(400).json({ error: 'Enter a domain like yourbrokerage.com' });
  try {
    const pool = getPool();
    const tenantId = tenantIdOf(req);
    const created = await helpers.createSendingDomain(domain);
    const tenant = await loadTenantRow(pool, tenantId);
    await writeSettings(pool, tenantId, { email: { ...(tenant.settings.email || {}), sending_domain: created } });
    const fresh = await loadTenantRow(pool, tenantId);
    return res.json({ success: true, data: (await settingsPayload(fresh)).email });
  } catch (error) {
    logger.error('setEmailDomain error', error);
    return res.status(502).json({ error: `Couldn't set up that sending domain: ${error.message}` });
  }
};

/** POST /api/admin/settings/email-domain/verify */
export const verifyEmailDomain = async (req, res) => {
  const helpers = await emailHelpers();
  try {
    const pool = getPool();
    const tenantId = tenantIdOf(req);
    const tenant = await loadTenantRow(pool, tenantId);
    const current = tenant.settings.email?.sending_domain;
    if (!current?.id) return res.status(400).json({ error: 'Add a sending domain first' });
    if (typeof helpers.verifySendingDomain !== 'function') return res.status(503).json({ error: 'Own-domain sending is off' });
    const checked = await helpers.verifySendingDomain(current.id);
    await writeSettings(pool, tenantId, { email: { ...(tenant.settings.email || {}), sending_domain: { ...current, ...checked } } });
    const fresh = await loadTenantRow(pool, tenantId);
    return res.json({ success: true, data: (await settingsPayload(fresh)).email });
  } catch (error) {
    logger.error('verifyEmailDomain error', error);
    return res.status(502).json({ error: 'Could not check the sending domain right now' });
  }
};

/** POST /api/admin/settings/test-email — a branded sample to the signed-in admin. */
export const sendTestEmail = async (req, res) => {
  const to = String(req.user?.email || '').trim();
  if (!to) return res.status(400).json({ error: 'Your account has no email address' });
  try {
    const pool = getPool();
    const tenant = await loadTenantRow(pool, tenantIdOf(req));
    const brand = brandFor(tenant);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const logo = brand.logo_url ? `<img src="${esc(brand.logo_url)}" alt="${esc(brand.name)}" style="max-height:48px;max-width:220px">` : `<strong style="font-size:20px">${esc(brand.name)}</strong>`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <div style="border-bottom:3px solid ${esc(brand.accent_color)};padding:16px 0">${logo}</div>
  <p>This is how emails from ${esc(brand.name)} will look to your clients.</p>
  <p style="margin:24px 0"><a href="${esc(brand.site_url)}" style="background:${esc(brand.accent_color)};color:#111;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Search homes</a></p>
  <p style="font-size:12px;color:#6b7280">${esc(brand.footer_line)}${brand.phone ? ` · ${esc(brand.phone)}` : ''}</p>
</div>`;
    const helpers = await emailHelpers();
    if (typeof helpers.smtpConfigured === 'function' && helpers.smtpConfigured()) {
      await helpers.sendEmail(to, `Test email from ${brand.name}`, html, brand.from_name || brand.name, { replyTo: brand.reply_to || brand.email, tenantId: tenant.id });
    } else {
      await pool.query('INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)', [to, `Test email from ${brand.name}`, html, tenant.id]);
    }
    return res.json({ success: true, to });
  } catch (error) {
    logger.error('sendTestEmail error', error);
    return res.status(500).json({ error: 'Could not send the test email' });
  }
};

// ── agent profile ──

const NOTIFY_KEYS = ['new_lead_email', 'hot_lead_push', 'morning_brief', 'hot_lead_text'];
const NOTIFY_OFF_BY_DEFAULT = ['hot_lead_text'];
const PROFILE_COLS = 'id, name, email, phone, bio, photo_url, brand_name, brand_phone, title, license_number, notify_prefs';

function profileOut(row) {
  const n = row.notify_prefs || {};
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone, bio: row.bio, photo_url: row.photo_url,
    brand_name: row.brand_name, brand_phone: row.brand_phone, title: row.title, license_number: row.license_number,
    notify: Object.fromEntries(NOTIFY_KEYS.map((k) => [k, NOTIFY_OFF_BY_DEFAULT.includes(k) ? n[k] === true : n[k] !== false])),
  };
}

function staffId(req) {
  const id = Number(req.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** GET /api/agent/profile */
export const getAgentProfile = async (req, res) => {
  const id = staffId(req);
  if (!id) return res.status(400).json({ error: 'This sign-in has no profile' });
  try {
    const r = await getPool().query(`SELECT ${PROFILE_COLS} FROM users WHERE id = $1 AND tenant_id = $2`, [id, tenantIdOf(req)]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ success: true, data: profileOut(r.rows[0]) });
  } catch (error) {
    logger.error('getAgentProfile error', error);
    return res.status(500).json({ error: 'Could not load your profile' });
  }
};

/** PATCH /api/agent/profile */
export const patchAgentProfile = async (req, res) => {
  const id = staffId(req);
  if (!id) return res.status(400).json({ error: 'This sign-in has no profile' });
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const add = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  const text = (v, max) => (v === null || v === '' ? null : String(v).trim().slice(0, max) || null);
  if (b.name !== undefined) {
    const name = text(b.name, 255);
    if (!name) return res.status(400).json({ error: 'Name is required' });
    add('name', name);
  }
  for (const [k, max] of [['bio', 2000], ['title', 120], ['license_number', 60], ['brand_name', 120], ['brand_phone', 30]]) {
    if (b[k] !== undefined) add(k, text(b[k], max));
  }
  if (b.phone !== undefined) {
    const digits = String(b.phone || '').replace(/\D/g, '');
    if (digits && (digits.length < 7 || digits.length > 15)) return res.status(400).json({ error: 'Phone looks wrong' });
    add('phone', digits || null);
  }
  if (b.notify !== undefined) {
    const n = {};
    for (const k of NOTIFY_KEYS) if (b.notify?.[k] !== undefined) n[k] = b.notify[k] === true;
    vals.push(JSON.stringify(n));
    sets.push(`notify_prefs = COALESCE(notify_prefs, '{}'::jsonb) || $${vals.length}::jsonb`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to change' });
  try {
    vals.push(id, tenantIdOf(req));
    const r = await getPool().query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND tenant_id = $${vals.length}
       RETURNING ${PROFILE_COLS}`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ success: true, data: profileOut(r.rows[0]) });
  } catch (error) {
    logger.error('patchAgentProfile error', error);
    return res.status(500).json({ error: 'Could not save your profile' });
  }
};

/** POST /api/agent/profile/photo { data_url } */
export const uploadAgentPhoto = async (req, res) => {
  const id = staffId(req);
  if (!id) return res.status(400).json({ error: 'This sign-in has no profile' });
  const parsed = parseDataUrl(req.body?.data_url);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (parsed.mime === 'image/svg+xml') return res.status(400).json({ error: 'Upload a photo (PNG, JPEG or WebP)' });
  try {
    const pool = getPool();
    const tenantId = tenantIdOf(req);
    const tenant = await loadTenantRow(pool, tenantId);
    const kind = `agent-${id}`;
    await saveAsset(pool, tenantId, kind, parsed.mime, parsed.data);
    const url = assetUrl(tenant, kind);
    await pool.query('UPDATE users SET photo_url = $1 WHERE id = $2 AND tenant_id = $3', [url, id, tenantId]);
    return res.json({ success: true, url });
  } catch (error) {
    logger.error('uploadAgentPhoto error', error);
    return res.status(500).json({ error: 'Could not save the photo' });
  }
};
