/**
 * "Connect your MLS": the brokerage owner's guided setup, and the platform
 * console's view of every MLS connection.
 *
 * Owner (/api/admin, always the signed-in brokerage; never a tenant id from
 * the request):
 *   GET    /mls/catalog?q=                 find your MLS (+ the platforms, for "not listed")
 *   GET    /mls/connect                    your MLSs, each with its checklist, vendor sheet and status
 *   POST   /mls/connect                    { catalog_id, platform? } | { custom: { name, platform, states } }
 *   PATCH  /mls/connect/:key               { stage: applied|approved } { office_mls_id } { confirm_display } { sold_enabled }
 *   PUT    /mls/connect/:key/credentials   { config, credentials } (saved encrypted, never sent back)
 *   POST   /mls/connect/:key/test          a few live listings with your attribution and disclaimer
 *   POST   /mls/connect/:key/go-live       { attest: true }
 *   DELETE /mls/connect/:key               stop setting this MLS up
 *
 * Platform owner (/api/platform):
 *   GET    /mls/connections                every MLS, its health and its brokerages
 *   POST   /mls/connections                add an MLS without a brokerage
 *   PATCH  /mls/connections/:key           display rules, state, cadence, settings
 *   PUT    /mls/connections/:key/credentials
 *   POST   /mls/connections/:key/test
 *   POST   /mls/connections/:key/sync      { mode, wait }
 *
 * Status a brokerage sees: Not started → Applied → Approved → Connected → Live.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { tenantIdOf, siteUrlFor, hasOwnAddress, DEFAULT_TENANT_ID } from '../services/tenantContext.js';
import { brandFor } from '../services/brand.js';
import {
  clearFeedCache, feedStatusFor, attributionFor, DEMO_FEED, HOME_FEED,
} from '../services/feeds.js';
import { productName } from './signupController.js';
import { platformIdentity } from '../services/platform.js';
import { CATALOG, catalogEntry, searchCatalog, DEFAULT_DISCLAIMER, DEFAULT_DISPLAY } from '../services/mls/catalog.js';
import { PLATFORMS, PLATFORM_IDS, platformList } from '../services/mls/platforms.js';
import { createAdapter, MlsApiError } from '../services/mls/adapters.js';
import { encryptSecret, credentialHints } from '../services/mls/secrets.js';
import {
  loadConnection, credentialsOf, syncFeed, testConnection, promoteWaitingTenants,
} from '../services/mls/engine.js';

const MLS_ID_RE = /^[A-Za-z0-9._-]{1,40}$/;
const STATE_RE = /^[A-Z]{2}$/;
const OWNER_STAGES = ['started', 'applied', 'approved'];
const MAX_FEEDS_PER_TENANT = 5;
const CONNECTION_STATES = ['setup', 'connected', 'live', 'paused'];

const isPlatform = (req) => req.user?.platform === true;

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function fail(res, error, what) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message, ...error.extra });
  logger.error(`${what} error`, error);
  return res.status(500).json({ error: `Could not ${what}` });
}

async function tenantRow(pool, id) {
  const r = await pool.query('SELECT id, slug, name, primary_domain, market_key, status, settings FROM tenants WHERE id = $1', [id]);
  const t = r.rows[0];
  return t ? { ...t, id: Number(t.id), settings: t.settings || {}, agent: null, site_host: null } : null;
}

const fill = (text, vars) => String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));

// ── feeds and connections ──────────────────────────────────────────────

/** The IRES feed runs on its own pipeline; it has no connection row. */
const isBuiltin = (key) => key === HOME_FEED;

function builtinConnection() {
  const configured = !!(process.env.IRES_API_URL && process.env.IRES_ACCESS_TOKEN);
  return {
    builtin: true,
    platform: 'mlsgrid',
    platform_name: PLATFORMS.mlsgrid.name,
    state: configured ? 'live' : 'setup',
    has_credentials: configured,
    credentials_hint: {},
    mine: false,
    config: { originating_system: 'ires' },
    last_test_ok: configured || null,
  };
}

/** A connection as the browser may see it: no secrets, only hints. */
function publicConnection(row, tenantId = null) {
  if (!row) return null;
  return {
    builtin: false,
    platform: row.platform,
    platform_name: PLATFORMS[row.platform]?.name || row.platform,
    state: row.state,
    has_credentials: !!row.credentials_enc || row.platform === 'mlsgrid',
    credentials_hint: row.credentials_hint || {},
    credentials_updated_at: row.credentials_updated_at || null,
    mine: tenantId != null && Number(row.credentials_tenant_id) === Number(tenantId),
    entered_by_other: tenantId != null && row.credentials_tenant_id != null && Number(row.credentials_tenant_id) !== Number(tenantId),
    config: row.config || {},
    dropped_fields: row.dropped_fields || [],
    cadence_minutes: row.cadence_minutes,
    last_test_at: row.last_test_at || null,
    last_test_ok: row.last_test_ok,
    last_test_error: row.last_test_error || null,
    last_run_at: row.last_run_at || null,
    last_success_at: row.last_success_at || null,
    last_error: row.last_error || null,
    last_error_at: row.last_error_at || null,
    listing_count: row.listing_count || 0,
    sold_count: row.sold_count || 0,
    next_run_at: row.next_run_at || null,
    running: !!row.running_since,
    full_import_at: row.full_import_at || null,
  };
}

async function ensureFeed(pool, { key, name, vendor, catalogId, states, display }) {
  await pool.query(
    `INSERT INTO mls_feeds (key, name, vendor, disclaimer, sold_data_allowed, courtesy_required, logo_required, catalog_id, states)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (key) DO NOTHING`,
    [key, name.slice(0, 80), vendor ? vendor.slice(0, 120) : null, display.disclaimer, !!display.sold_data_allowed,
      display.courtesy_required !== false, !!display.logo_required, catalogId, states || []]
  );
}

async function ensureConnection(pool, { key, platform, config, tenantId }) {
  await pool.query(
    `INSERT INTO mls_connections (feed_key, platform, config, cadence_minutes, created_by_tenant_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (feed_key) DO NOTHING`,
    [key, platform, JSON.stringify(config || {}), Math.max(30, PLATFORMS[platform].min_cadence_minutes), tenantId]
  );
}

/** Create (or find) the feed and connection for a catalog entry or a custom MLS. */
async function provisionFeed(pool, body, tenantId) {
  if (body?.catalog_id) {
    const entry = catalogEntry(body.catalog_id);
    if (!entry) throw new HttpError(400, 'We don’t know that MLS. Pick it from the list, or choose “My MLS isn’t listed”.');
    const choice = entry.platforms.find((p) => p.platform === body.platform) || entry.platforms[0];
    const key = entry.id;
    if (!isBuiltin(key)) {
      await ensureFeed(pool, {
        key, name: entry.short, vendor: `${entry.name} via ${PLATFORMS[choice.platform].name}`,
        catalogId: entry.id, states: entry.states, display: entry.display,
      });
      const config = {};
      if (choice.originating_system) config.originating_system = choice.originating_system;
      if (choice.dataset_id) config.dataset_id = choice.dataset_id;
      await ensureConnection(pool, { key, platform: choice.platform, config, tenantId });
    }
    return key;
  }
  const c = body?.custom || {};
  const name = String(c.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (name.length < 2) throw new HttpError(400, 'Enter your MLS’s name.', { field: 'name' });
  if (!PLATFORM_IDS.includes(c.platform)) throw new HttpError(400, 'Pick the data platform your MLS uses.', { field: 'platform' });
  const states = (Array.isArray(c.states) ? c.states : String(c.states || '').split(/[,\s]+/))
    .map((s) => String(s).trim().toUpperCase()).filter((s) => STATE_RE.test(s)).slice(0, 6);
  // Keys stay within 16 characters: x-<name>-<4 hex>.
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 9) || 'mls';
  const key = `x-${slug}-${crypto.randomBytes(2).toString('hex')}`;
  const display = { ...DEFAULT_DISPLAY, disclaimer: DEFAULT_DISCLAIMER.replace('{mls}', name) };
  await ensureFeed(pool, { key, name, vendor: `${name} via ${PLATFORMS[c.platform].name}`, catalogId: null, states, display });
  await ensureConnection(pool, { key, platform: c.platform, config: {}, tenantId });
  return key;
}

/** Config values for a platform: only its own fields, trimmed, https addresses. */
function cleanConfig(platform, input, current = {}) {
  const fields = PLATFORMS[platform].config_fields.map((f) => f.key);
  const out = { ...current };
  for (const [k, v] of Object.entries(input || {})) {
    if (!fields.includes(k)) continue;
    const s = String(v ?? '').trim().slice(0, 300);
    if (!s) { delete out[k]; continue; }
    if (/url$/.test(k) && !/^https:\/\/[^\s]+$/i.test(s)) throw new HttpError(400, 'Addresses must start with https://', { field: k });
    if (k === 'originating_system' && !/^[A-Za-z0-9_-]{1,40}$/.test(s)) throw new HttpError(400, 'The MLS code is letters and numbers, like “mred”.', { field: k });
    out[k] = s;
  }
  return out;
}

/**
 * Save credentials and settings on a connection. Fields left empty keep what
 * was saved; clear=true forgets everything. The adapter is built once to
 * catch a missing field before anything is stored.
 */
async function saveCredentials(pool, row, body, { tenantId }) {
  const config = cleanConfig(row.platform, body?.config, row.config || {});
  const fields = PLATFORMS[row.platform].credential_fields.map((f) => f.key);
  const current = body?.clear ? {} : credentialsOf(row);
  const next = { ...current };
  for (const [k, v] of Object.entries(body?.credentials || {})) {
    if (!fields.includes(k)) continue;
    const s = String(v ?? '').trim().slice(0, 2000);
    if (s) next[k] = s;
  }
  for (const k of Object.keys(next)) if (!fields.includes(k)) delete next[k];
  try {
    createAdapter({ platform: row.platform, config, credentials: next });
  } catch (e) {
    if (e instanceof MlsApiError) throw new HttpError(400, e.message);
    throw e;
  }
  await pool.query(
    `UPDATE mls_connections SET config = $2, credentials_enc = $3, credentials_hint = $4,
       credentials_tenant_id = $5, credentials_updated_at = NOW(),
       state = CASE WHEN state = 'live' THEN state ELSE 'setup' END,
       last_test_ok = NULL, last_test_error = NULL, dropped_fields = '{}', updated_at = NOW()
     WHERE feed_key = $1`,
    [row.feed_key, JSON.stringify(config), Object.keys(next).length ? encryptSecret(next) : null,
      JSON.stringify(credentialHints(next)), tenantId]
  );
}

// ── the owner's view ───────────────────────────────────────────────────

async function ownerContact(pool, tenantId, req) {
  if (req.user?.id && !isPlatform(req)) {
    const { rows: [u] } = await pool.query(
      'SELECT name, email, phone, license_number FROM users WHERE id = $1 AND tenant_id = $2', [req.user.id, tenantId]
    ).catch(() => ({ rows: [] }));
    if (u) return u;
  }
  const { rows: [owner] } = await pool.query(
    "SELECT name, email, phone, license_number FROM users WHERE tenant_id = $1 AND role = 'admin' ORDER BY id LIMIT 1", [tenantId]
  ).catch(() => ({ rows: [] }));
  return owner || {};
}

/** The pre-filled sheet MLSs and platforms ask technology providers for. */
function vendorSheet({ tenant, owner, feed, platform, officeMlsId, soldAllowed }) {
  const brand = brandFor(tenant);
  const site = hasOwnAddress(tenant) ? siteUrlFor(tenant) : null;
  const id = platformIdentity();
  const vendorName = process.env.MLS_VENDOR_COMPANY || id.legal_name || productName();
  // The platform's support address stands in until a named contact is set.
  const vendorContact = [process.env.MLS_VENDOR_CONTACT_NAME, process.env.MLS_VENDOR_CONTACT_EMAIL || id.support_email, process.env.MLS_VENDOR_CONTACT_PHONE]
    .filter(Boolean).join(' · ');
  const p = PLATFORMS[platform];
  const rows = [
    ['MLS', feed.name],
    ['Data platform', p?.name || platform],
    ['Feed type', 'IDX (display on the brokerage’s public website)'],
    ['Technology provider (vendor)', vendorName],
    ['Product', `${productName()}: the brokerage’s home-search website and buyer app`],
    ['Vendor contact', vendorContact || 'Ask us and we’ll add our contact details'],
    ['Website where listings will show', site || 'Your site address (set it in Settings → Website domain)'],
    ['How the data is used', `Shown to the public on ${brand.name}’s website and home-search app for consumers looking for homes. Every listing shows the listing office and the MLS’s IDX notice. The data is not resold, shared with third parties or used for anything else.`],
    ['Data requested', `Active, under-contract and pending listings with photos; the office and agent roster for listing attribution${soldAllowed ? '; closed sales from the last 12 months' : ''}`],
    ['How often it updates', `Every ${Math.max(30, p?.min_cadence_minutes || 30)} minutes or so, within the platform’s rate limits`],
    ['Brokerage', brand.legal_name || brand.name],
    ['Brokerage address', brand.address || ''],
    ['Brokerage phone', brand.phone || ''],
    ['Endorsing (managing) broker', owner.name || ''],
    ['Broker license number', owner.license_number || brand.license_line || ''],
    ['Broker email', owner.email || brand.email || ''],
    ['Broker phone', owner.phone || brand.phone || ''],
    ['Office MLS ID', officeMlsId || ''],
  ];
  if (p?.vendor_contact) {
    rows.push(['Platform contact', [p.vendor_contact.name, p.vendor_contact.email, p.vendor_contact.url].filter(Boolean).join(' · ')]);
  }
  const text = [`Vendor information for ${feed.name} (${p?.name || platform})`, '', ...rows.map(([k, v]) => `${k}: ${v || '(fill in)'}`)].join('\n');
  return { rows: rows.map(([label, value]) => ({ label, value: value || null })), text };
}

/** Where a brokerage is: started, applied, approved, connected, going_live, live or paused. */
function stageOf(tf, conn) {
  if (tf.status === 'approved') return 'live';
  if (tf.status === 'suspended') return 'paused';
  if (tf.go_live_requested_at) return 'going_live';
  const ready = conn && (conn.builtin ? conn.state === 'live' : conn.last_test_ok === true || conn.state === 'live');
  if (ready && ['approved', 'connected'].includes(tf.stage)) return 'connected';
  if (tf.stage === 'connected') return ready ? 'connected' : 'approved';
  return tf.stage || 'started';
}

async function feedView(pool, tenant, tf, { req, owner }) {
  const { rows: [feed] } = await pool.query(
    'SELECT key, name, vendor, disclaimer, sold_data_allowed, courtesy_required, logo_required, catalog_id, states FROM mls_feeds WHERE key = $1',
    [tf.feed_key]
  );
  if (!feed) return null;
  const row = isBuiltin(feed.key) ? null : await loadConnection(pool, feed.key);
  const conn = isBuiltin(feed.key) ? builtinConnection() : publicConnection(row, tenant.id);
  const platform = conn?.platform || 'reso';
  const entry = feed.catalog_id ? catalogEntry(feed.catalog_id) : null;
  const brand = brandFor(tenant);
  const vars = {
    mls: feed.name, brokerage: brand.name, product: productName(), owner_email: owner.email || 'your email',
  };
  // Only the brokerage that entered the credentials (its own license) goes
  // live by itself; on a shared connection we confirm the MLS approval first.
  const selfServe = !!conn && !conn.builtin && conn.mine;
  const stage = stageOf(tf, conn);
  const sample = await attributionFor({ feed: feed.key, updated_at: new Date().toISOString(), list_office_name: 'Example Realty' }, tenant, { pool })
    .catch(() => null);
  return {
    key: feed.key,
    name: feed.name,
    vendor: feed.vendor,
    catalog: entry ? { id: entry.id, name: entry.name, states: entry.states, sources: entry.sources, unverified: entry.unverified } : null,
    states: feed.states || [],
    status: tf.status,
    stage,
    stage_log: tf.stage_log || {},
    office_mls_id: tf.office_mls_id || null,
    sold_enabled: !!tf.sold_enabled,
    display: {
      disclaimer: feed.disclaimer,
      disclaimer_preview: sample?.disclaimer || null,
      courtesy_required: feed.courtesy_required,
      sold_data_allowed: feed.sold_data_allowed,
      logo_required: !!feed.logo_required,
    },
    display_confirmed_at: tf.display_confirmed_at || null,
    go_live_requested_at: tf.go_live_requested_at || null,
    self_serve_go_live: selfServe,
    can_enter_credentials: !conn?.builtin && conn?.state !== 'live' && !conn?.entered_by_other,
    connection: conn,
    platform: {
      id: platform,
      name: PLATFORMS[platform]?.name || platform,
      summary: PLATFORMS[platform]?.summary || null,
      docs: PLATFORMS[platform]?.docs || [],
      vendor_contact: PLATFORMS[platform]?.vendor_contact || null,
      credential_fields: PLATFORMS[platform]?.credential_fields || [],
      config_fields: PLATFORMS[platform]?.config_fields || [],
      rate_note: PLATFORMS[platform]?.rate.note || null,
    },
    checklist: (PLATFORMS[platform]?.apply_steps || []).map((s) => ({ title: fill(s.title, vars), body: fill(s.body, vars) })),
    vendor_sheet: vendorSheet({
      tenant, owner, feed, platform, officeMlsId: tf.office_mls_id, soldAllowed: feed.sold_data_allowed,
    }),
    updated_at: tf.updated_at,
  };
}

async function ownerPayload(pool, req) {
  const tenantId = tenantIdOf(req);
  const tenant = { ...(await tenantRow(pool, tenantId)), site_host: req.tenant?.site_host || null };
  const owner = await ownerContact(pool, tenantId, req);
  const { rows } = await pool.query(
    `SELECT feed_key, status, office_mls_id, sold_enabled, notes, stage, stage_log, display_confirmed_at,
            go_live_requested_at, go_live_auto, approved_at, created_at, updated_at
     FROM tenant_feeds WHERE tenant_id = $1 AND feed_key <> $2 ORDER BY created_at, feed_key`,
    [tenantId, DEMO_FEED]
  );
  const feeds = [];
  for (const tf of rows) {
    const v = await feedView(pool, tenant, tf, { req, owner });
    if (v) feeds.push(v);
  }
  const status = await feedStatusFor(tenant, { pool });
  return {
    mode: status.mode,
    headline: status.headline,
    product: productName(),
    site_url: hasOwnAddress(tenant) ? siteUrlFor(tenant) : null,
    home: tenantId === DEFAULT_TENANT_ID,
    feeds,
    platforms: platformList(),
  };
}

async function ownTenantFeed(pool, tenantId, key) {
  const { rows: [tf] } = await pool.query(
    'SELECT * FROM tenant_feeds WHERE tenant_id = $1 AND feed_key = $2', [tenantId, key]
  );
  if (!tf || key === DEMO_FEED) throw new HttpError(404, 'You haven’t started connecting this MLS.');
  return tf;
}

async function logChange(pool, tenantId, key, by, changes) {
  await pool.query(
    'INSERT INTO tenant_feed_log (tenant_id, feed_key, changed_by, changes) VALUES ($1, $2, $3, $4)',
    [tenantId, key, by || null, JSON.stringify(changes)]
  );
}

const keyParam = (req) => String(req.params.key || '').trim().toLowerCase().slice(0, 16);

/** GET /mls/catalog?q= */
export const getCatalog = async (req, res) => {
  const q = String(req.query.q || '').slice(0, 80);
  return res.json({
    success: true,
    data: { results: searchCatalog(q, { limit: q ? 25 : 100 }), total: CATALOG.length, platforms: platformList() },
  });
};

/** GET /mls/connect */
export const getConnect = async (req, res) => {
  try {
    return res.json({ success: true, data: await ownerPayload(getPool(), req) });
  } catch (error) {
    return fail(res, error, 'load your MLS setup');
  }
};

/** POST /mls/connect */
export const startConnect = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  try {
    const { rows: [{ n }] } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM tenant_feeds WHERE tenant_id = $1 AND feed_key <> 'demo'", [tenantId]
    );
    if (n >= MAX_FEEDS_PER_TENANT) throw new HttpError(400, `You can connect up to ${MAX_FEEDS_PER_TENANT} MLSs. Remove one you’re not using first.`);
    const key = await provisionFeed(pool, req.body || {}, tenantId);
    const ins = await pool.query(
      `INSERT INTO tenant_feeds (tenant_id, feed_key, status, stage, stage_log)
       VALUES ($1, $2, 'pending', 'started', jsonb_build_object('started', NOW()))
       ON CONFLICT (tenant_id, feed_key) DO NOTHING RETURNING feed_key`,
      [tenantId, key]
    );
    if (ins.rows.length) await logChange(pool, tenantId, key, req.user?.email, { stage: { from: null, to: 'started' } });
    clearFeedCache();
    const data = await ownerPayload(pool, req);
    return res.status(ins.rows.length ? 201 : 200).json({ success: true, key, data });
  } catch (error) {
    return fail(res, error, 'start connecting this MLS');
  }
};

/** PATCH /mls/connect/:key */
export const patchConnect = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  const key = keyParam(req);
  const b = req.body || {};
  try {
    const tf = await ownTenantFeed(pool, tenantId, key);
    const { rows: [feed] } = await pool.query('SELECT sold_data_allowed FROM mls_feeds WHERE key = $1', [key]);
    const sets = [];
    const vals = [tenantId, key];
    const changes = {};
    const add = (sql, v) => { vals.push(v); sets.push(sql.replace('?', `$${vals.length}`)); };
    if (b.stage !== undefined) {
      if (!OWNER_STAGES.includes(b.stage)) throw new HttpError(400, 'That step isn’t one you can set.');
      if (tf.status !== 'pending') throw new HttpError(400, 'This MLS is already live.');
      add('stage = ?', b.stage);
      add(`stage_log = stage_log || jsonb_build_object(?::text, NOW())`, b.stage);
      changes.stage = { from: tf.stage, to: b.stage };
    }
    if (b.office_mls_id !== undefined) {
      const v = String(b.office_mls_id || '').trim();
      if (v && !MLS_ID_RE.test(v)) throw new HttpError(400, 'Your office MLS ID should be letters and numbers.', { field: 'office_mls_id' });
      add('office_mls_id = ?', v || null);
      changes.office_mls_id = { from: tf.office_mls_id, to: v || null };
    }
    if (b.sold_enabled !== undefined) {
      const on = b.sold_enabled === true;
      if (on && !feed?.sold_data_allowed) throw new HttpError(400, 'This MLS’s rules on our platform don’t allow sold data yet. Ask us to check them.');
      add('sold_enabled = ?', on);
      changes.sold_enabled = { from: tf.sold_enabled, to: on };
    }
    if (b.confirm_display === true) {
      sets.push('display_confirmed_at = NOW()');
      changes.display_confirmed = { from: !!tf.display_confirmed_at, to: true };
    }
    if (!sets.length) throw new HttpError(400, 'Nothing to change');
    await pool.query(`UPDATE tenant_feeds SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1 AND feed_key = $2`, vals);
    await logChange(pool, tenantId, key, req.user?.email, changes);
    clearFeedCache();
    return res.json({ success: true, data: await ownerPayload(pool, req) });
  } catch (error) {
    return fail(res, error, 'save that');
  }
};

/** PUT /mls/connect/:key/credentials */
export const putConnectCredentials = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  const key = keyParam(req);
  try {
    await ownTenantFeed(pool, tenantId, key);
    if (isBuiltin(key)) throw new HttpError(400, 'We already hold the connection for this MLS. Nothing to enter.');
    const row = await loadConnection(pool, key);
    if (!row) throw new HttpError(404, 'This MLS isn’t set up yet.');
    if (!isPlatform(req)) {
      if (row.state === 'live') throw new HttpError(403, 'This MLS is already connected on our platform, so there’s nothing to enter. Mark it approved and ask to go live.');
      if (row.credentials_tenant_id != null && Number(row.credentials_tenant_id) !== tenantId) {
        throw new HttpError(403, 'Another brokerage is already connecting this MLS. We’ll confirm your approval and switch you on when it’s live.');
      }
    }
    await saveCredentials(pool, row, req.body, { tenantId: isPlatform(req) ? row.credentials_tenant_id : tenantId });
    await logChange(pool, tenantId, key, req.user?.email, { credentials: { from: row.credentials_enc ? 'saved' : 'none', to: 'saved' } });
    return res.json({ success: true, data: await ownerPayload(pool, req) });
  } catch (error) {
    return fail(res, error, 'save the connection details');
  }
};

/** POST /mls/connect/:key/test */
export const testConnect = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  const key = keyParam(req);
  try {
    const tf = await ownTenantFeed(pool, tenantId, key);
    const tenant = await tenantRow(pool, tenantId);
    if (isBuiltin(key)) throw new HttpError(400, 'This MLS is connected and managed by us.');
    const row = await loadConnection(pool, key);
    if (!row) throw new HttpError(404, 'This MLS isn’t set up yet.');
    if (!isPlatform(req) && row.credentials_tenant_id != null && Number(row.credentials_tenant_id) !== tenantId && row.state !== 'live') {
      throw new HttpError(403, 'Another brokerage is connecting this MLS.');
    }
    const result = await testConnection(key, { pool });
    if (result.ok) {
      await pool.query(
        `UPDATE tenant_feeds SET stage = 'connected', stage_log = stage_log || jsonb_build_object('connected', NOW()), updated_at = NOW()
         WHERE tenant_id = $1 AND feed_key = $2 AND status = 'pending'`,
        [tenantId, key]
      );
      if (tf.stage !== 'connected') await logChange(pool, tenantId, key, req.user?.email, { stage: { from: tf.stage, to: 'connected' } });
      const attribution = await attributionFor({ feed: key, updated_at: new Date().toISOString(), list_office_name: result.listings[0]?.office || null }, tenant, { pool });
      result.listings = result.listings.map((l) => ({ ...l, courtesy: l.office && row.courtesy_required ? `Listing courtesy of ${l.office}` : null }));
      result.disclaimer = attribution.disclaimer;
    }
    return res.status(result.ok ? 200 : 422).json({ success: result.ok, ...result, data: await ownerPayload(pool, req) });
  } catch (error) {
    return fail(res, error, 'test the connection');
  }
};

/** POST /mls/connect/:key/go-live { attest: true } */
export const goLive = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  const key = keyParam(req);
  try {
    const tf = await ownTenantFeed(pool, tenantId, key);
    if (tf.status === 'approved') throw new HttpError(400, 'You’re already live on this MLS.');
    if (tf.status === 'suspended') throw new HttpError(400, 'This MLS is paused for your site. Contact us to turn it back on.');
    if (req.body?.attest !== true) throw new HttpError(400, 'Please confirm the MLS approved your site for IDX display.', { field: 'attest' });
    if (!tf.display_confirmed_at) throw new HttpError(400, 'Confirm the display rules first.', { step: 'display' });
    const row = isBuiltin(key) ? null : await loadConnection(pool, key);
    const conn = isBuiltin(key) ? builtinConnection() : publicConnection(row, tenantId);
    const mine = !!conn && !conn.builtin && conn.mine;
    if (mine && conn.last_test_ok !== true && conn.state !== 'live') {
      throw new HttpError(400, 'Test the connection first, so we know your listings will come through.', { step: 'connect' });
    }
    await pool.query(
      `UPDATE tenant_feeds SET go_live_requested_at = NOW(), go_live_auto = $3,
         stage_log = stage_log || jsonb_build_object('go_live_requested', NOW()), updated_at = NOW()
       WHERE tenant_id = $1 AND feed_key = $2`,
      [tenantId, key, mine]
    );
    await logChange(pool, tenantId, key, req.user?.email, { go_live: { from: null, to: mine ? 'requested (own connection)' : 'requested (awaiting platform check)' } });
    let promoted = [];
    if (mine) {
      // Start syncing now; the site switches as soon as the first import has homes.
      await pool.query(
        "UPDATE mls_connections SET state = 'live', next_run_at = NOW(), updated_at = NOW() WHERE feed_key = $1",
        [key]
      );
      promoted = await promoteWaitingTenants(pool, key);
      if (!promoted.includes(tenantId) && process.env.MLS_SYNC_ON_GO_LIVE !== 'off') {
        syncFeed(key, { pool }).catch((e) => logger.warn(`go-live sync failed: ${e.message}`));
      }
    }
    clearFeedCache();
    return res.json({
      success: true,
      live: promoted.includes(tenantId),
      waiting_for: mine ? (promoted.includes(tenantId) ? null : 'first_import') : 'platform',
      data: await ownerPayload(pool, req),
    });
  } catch (error) {
    return fail(res, error, 'go live');
  }
};

/** DELETE /mls/connect/:key */
export const cancelConnect = async (req, res) => {
  const pool = getPool();
  const tenantId = tenantIdOf(req);
  const key = keyParam(req);
  try {
    const tf = await ownTenantFeed(pool, tenantId, key);
    if (tf.status === 'approved') throw new HttpError(400, 'This MLS is live on your site. Contact us to turn it off.');
    await pool.query('DELETE FROM tenant_feeds WHERE tenant_id = $1 AND feed_key = $2', [tenantId, key]);
    // Credentials this brokerage entered for a connection nobody else uses go too.
    await pool.query(
      `UPDATE mls_connections c SET credentials_enc = NULL, credentials_hint = '{}', credentials_tenant_id = NULL,
         state = 'setup', updated_at = NOW()
       WHERE c.feed_key = $1 AND c.credentials_tenant_id = $2 AND c.state <> 'live'
         AND NOT EXISTS (SELECT 1 FROM tenant_feeds t WHERE t.feed_key = c.feed_key)`,
      [key, tenantId]
    );
    await logChange(pool, tenantId, key, req.user?.email, { stage: { from: tf.stage, to: null } });
    clearFeedCache();
    return res.json({ success: true, data: await ownerPayload(pool, req) });
  } catch (error) {
    return fail(res, error, 'remove this MLS');
  }
};

// ── the platform console ───────────────────────────────────────────────

async function iresHealth(pool) {
  const counts = await pool.query(
    "SELECT (SELECT COUNT(*)::int FROM listings WHERE feed = 'ires' AND is_active) AS listings, (SELECT COUNT(*)::int FROM sold_listings WHERE feed = 'ires') AS sold"
  );
  let watermark = null;
  let updated = null;
  try {
    const r = await pool.query("SELECT value, updated_at FROM sync_state WHERE key = 'ires_last_sync_ts'");
    watermark = r.rows[0]?.value || null;
    updated = r.rows[0]?.updated_at || null;
  } catch { /* table appears with the first IRES sync */ }
  return {
    ...builtinConnection(),
    listing_count: counts.rows[0].listings,
    sold_count: counts.rows[0].sold,
    last_success_at: updated,
    watermark,
    note: 'Runs on its own hourly schedule (iresScheduler).',
  };
}

async function consoleList(pool) {
  const { rows: feeds } = await pool.query(
    `SELECT key, name, vendor, disclaimer, sold_data_allowed, courtesy_required, logo_required, catalog_id, states, display_verified_at
     FROM mls_feeds WHERE key <> $1 ORDER BY (key = $2) DESC, name`,
    [DEMO_FEED, HOME_FEED]
  );
  const { rows: tfs } = await pool.query(
    `SELECT f.tenant_id, t.name AS tenant_name, t.slug, f.feed_key, f.status, f.stage, f.office_mls_id, f.sold_enabled,
            f.go_live_requested_at, f.go_live_auto, f.display_confirmed_at, f.approved_at, f.updated_at
     FROM tenant_feeds f JOIN tenants t ON t.id = f.tenant_id
     WHERE f.feed_key <> $1 ORDER BY f.created_at`,
    [DEMO_FEED]
  );
  const out = [];
  for (const f of feeds) {
    const row = isBuiltin(f.key) ? null : await loadConnection(pool, f.key);
    const conn = isBuiltin(f.key) ? await iresHealth(pool) : publicConnection(row);
    out.push({
      ...f,
      connection: conn,
      brokerages: tfs.filter((t) => t.feed_key === f.key).map((t) => ({
        ...t,
        stage: stageOf(t, conn),
        waiting_for_you: t.status === 'pending' && !!t.go_live_requested_at && !t.go_live_auto,
      })),
    });
  }
  return {
    feeds: out,
    waiting: out.flatMap((f) => f.brokerages.filter((b) => b.waiting_for_you).map((b) => ({ feed_key: f.key, feed_name: f.name, ...b }))),
    platforms: platformList(),
    catalog_size: CATALOG.length,
  };
}

/** GET /mls/connections */
export const listConnections = async (req, res) => {
  try {
    return res.json({ success: true, data: await consoleList(getPool()) });
  } catch (error) {
    return fail(res, error, 'list MLS connections');
  }
};

/** POST /mls/connections { catalog_id, platform? } | { custom } */
export const createConnection = async (req, res) => {
  try {
    const pool = getPool();
    const key = await provisionFeed(pool, req.body || {}, null);
    clearFeedCache();
    return res.status(201).json({ success: true, key, data: await consoleList(pool) });
  } catch (error) {
    return fail(res, error, 'add the MLS');
  }
};

/** PATCH /mls/connections/:key — display rules, state, cadence and settings. */
export const patchConnection = async (req, res) => {
  const pool = getPool();
  const key = keyParam(req);
  const b = req.body || {};
  try {
    const { rows: [feed] } = await pool.query('SELECT * FROM mls_feeds WHERE key = $1', [key]);
    if (!feed || key === DEMO_FEED) throw new HttpError(404, 'Unknown MLS');
    const feedSets = [];
    const feedVals = [key];
    const addF = (col, v) => { feedVals.push(v); feedSets.push(`${col} = $${feedVals.length}`); };
    if (b.name !== undefined) {
      const name = String(b.name || '').trim().slice(0, 80);
      if (!name) throw new HttpError(400, 'Name is required');
      addF('name', name);
    }
    if (b.disclaimer !== undefined) {
      const d = String(b.disclaimer || '').trim().slice(0, 2000);
      if (!d.includes('{brokerage}')) throw new HttpError(400, 'The notice must name the brokerage: include {brokerage}.', { field: 'disclaimer' });
      addF('disclaimer', d);
    }
    for (const col of ['courtesy_required', 'sold_data_allowed', 'logo_required']) {
      if (b[col] !== undefined) addF(col, b[col] === true);
    }
    if (b.display_verified === true) feedSets.push('display_verified_at = NOW()');
    if (feedSets.length) await pool.query(`UPDATE mls_feeds SET ${feedSets.join(', ')}, updated_at = NOW() WHERE key = $1`, feedVals);
    // Sold data turned off for the MLS turns it off for every brokerage on it.
    if (b.sold_data_allowed === false) await pool.query('UPDATE tenant_feeds SET sold_enabled = FALSE WHERE feed_key = $1', [key]);

    if (!isBuiltin(key)) {
      const row = await loadConnection(pool, key);
      if (row) {
        const sets = [];
        const vals = [key];
        const add = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
        if (b.state !== undefined) {
          if (!CONNECTION_STATES.includes(b.state)) throw new HttpError(400, 'State must be setup, connected, live or paused');
          if (b.state === 'live' && !row.credentials_enc && row.platform !== 'mlsgrid') throw new HttpError(400, 'Save credentials before turning the sync on.');
          add('state', b.state);
          if (b.state === 'live') sets.push('next_run_at = NOW()');
        }
        if (b.cadence_minutes !== undefined) {
          const m = Math.round(Number(b.cadence_minutes));
          const min = PLATFORMS[row.platform].min_cadence_minutes;
          if (!Number.isFinite(m) || m < min || m > 1440) throw new HttpError(400, `Sync every ${min} to 1,440 minutes on ${PLATFORMS[row.platform].name}.`);
          add('cadence_minutes', m);
        }
        if (b.config !== undefined) add('config', JSON.stringify(cleanConfig(row.platform, b.config, row.config || {})));
        if (sets.length) await pool.query(`UPDATE mls_connections SET ${sets.join(', ')}, updated_at = NOW() WHERE feed_key = $1`, vals);
      }
    }
    logger.info('mls connection updated', { feed: key, fields: Object.keys(b), by: req.user?.email });
    clearFeedCache();
    return res.json({ success: true, data: await consoleList(pool) });
  } catch (error) {
    return fail(res, error, 'update the MLS');
  }
};

/** PUT /mls/connections/:key/credentials */
export const putConnectionCredentials = async (req, res) => {
  const pool = getPool();
  const key = keyParam(req);
  try {
    const row = await loadConnection(pool, key);
    if (!row) throw new HttpError(404, 'Unknown MLS connection');
    await saveCredentials(pool, row, req.body, { tenantId: row.credentials_tenant_id });
    logger.info('mls credentials saved', { feed: key, by: req.user?.email });
    return res.json({ success: true, data: await consoleList(pool) });
  } catch (error) {
    return fail(res, error, 'save the credentials');
  }
};

/** POST /mls/connections/:key/test */
export const testConnectionConsole = async (req, res) => {
  const pool = getPool();
  const key = keyParam(req);
  try {
    if (!(await loadConnection(pool, key))) throw new HttpError(404, 'Unknown MLS connection');
    const result = await testConnection(key, { pool });
    return res.status(result.ok ? 200 : 422).json({ success: result.ok, ...result });
  } catch (error) {
    return fail(res, error, 'test the connection');
  }
};

/** POST /mls/connections/:key/sync { mode, wait } */
export const syncNow = async (req, res) => {
  const pool = getPool();
  const key = keyParam(req);
  try {
    if (!(await loadConnection(pool, key))) throw new HttpError(404, 'Unknown MLS connection');
    const mode = ['incremental', 'full'].includes(req.body?.mode) ? req.body.mode : 'auto';
    if (req.body?.wait === true) {
      const result = await syncFeed(key, { pool, mode });
      return res.json({ success: result.ok, result, data: await consoleList(pool) });
    }
    syncFeed(key, { pool, mode }).catch((e) => logger.warn(`sync now failed: ${e.message}`));
    return res.status(202).json({ success: true, started: true });
  } catch (error) {
    return fail(res, error, 'start the sync');
  }
};
