/**
 * Which listings a brokerage may show.
 *
 * Every listing carries the feed it came from (listings.feed: 'ires', 'demo',
 * later others). A brokerage shows only feeds the MLS approved it for
 * (tenant_feeds.status = 'approved'). With none approved it is in demo mode
 * and sees the sample homes (feed 'demo') so it can try everything. SAA, the
 * home brokerage, always shows IRES and never sample homes.
 *
 * Sold data (sold_listings, status 'Sold') shows only for feeds with
 * sold_enabled. When a brokerage has several feeds and two carry the same
 * home, it shows once, from the brokerage's first feed.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { DEFAULT_TENANT_ID, currentTenant, tenantById } from './tenantContext.js';
import { brandFor, isHomeTenant } from './brand.js';

export const HOME_FEED = 'ires';
export const DEMO_FEED = 'demo';
export const FEED_STATUSES = ['pending', 'approved', 'suspended'];
export const MAX_SERVICE_AREAS = 40;

const CACHE_MS = 30 * 1000;
const scopeCache = new Map(); // tenant id → { at, rows }
let feedInfoCache = { at: 0, map: null };

export function clearFeedCache() {
  scopeCache.clear();
  feedInfoCache = { at: 0, map: null };
}

const FALLBACK_FEEDS = {
  ires: {
    key: 'ires', name: 'IRES', vendor: 'IRES via MLS Grid', courtesy_required: true, sold_data_allowed: true,
    disclaimer: 'Listing data provided by IRES MLS via IDX and displayed by {brokerage}. Information is deemed reliable but not guaranteed. All measurements and square footage are approximate. Buyer should verify all information with independent sources before making decisions. Listing information last updated {updated}.',
  },
  demo: {
    key: 'demo', name: 'Sample listings', vendor: 'Sample data', courtesy_required: false, sold_data_allowed: true,
    disclaimer: 'These are sample homes so you can try {brokerage}\'s home search. They are not real listings and are not for sale. Live MLS listings appear here once the MLS approves this site.',
  },
};

/** Every feed the platform knows: key → { key, name, vendor, disclaimer, courtesy_required, sold_data_allowed }. */
export async function feedCatalog({ pool = getPool() } = {}) {
  if (feedInfoCache.map && Date.now() - feedInfoCache.at < CACHE_MS) return feedInfoCache.map;
  let map = new Map(Object.entries(FALLBACK_FEEDS));
  try {
    const r = await pool.query('SELECT key, name, vendor, disclaimer, courtesy_required, sold_data_allowed FROM mls_feeds ORDER BY key');
    if (r.rows.length) map = new Map(r.rows.map((row) => [row.key, row]));
  } catch (error) {
    logger.warn(`mls_feeds unavailable, using defaults: ${error.message}`);
  }
  feedInfoCache = { at: Date.now(), map };
  return map;
}

async function tenantFeedRows(tenantId, pool) {
  const hit = scopeCache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  let rows = null;
  try {
    const r = await pool.query(
      `SELECT feed_key, status, office_mls_id, sold_enabled, notes, approved_at, updated_at
       FROM tenant_feeds WHERE tenant_id = $1 ORDER BY created_at, feed_key`,
      [tenantId]
    );
    rows = r.rows;
  } catch (error) {
    logger.warn(`tenant_feeds unavailable: ${error.message}`);
    rows = null;
  }
  scopeCache.set(tenantId, { at: Date.now(), rows });
  return rows;
}

/** Cities or counties from settings.mls.service_areas, cleaned. */
export function normalizeServiceAreas(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[,\n]/);
  const out = [];
  for (const raw of list) {
    const v = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!v || !/^[A-Za-z][A-Za-z .'-]*$/.test(v)) continue;
    if (!out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
    if (out.length >= MAX_SERVICE_AREAS) break;
  }
  return out;
}

async function resolveTenant(tenant, pool) {
  if (tenant && typeof tenant === 'object' && Number.isInteger(Number(tenant.id))) return tenant;
  const id = Number(tenant);
  if (Number.isInteger(id) && id > 0) return tenantById(id, { pool });
  return currentTenant() || { id: DEFAULT_TENANT_ID, settings: {} };
}

/**
 * The listing scope for a brokerage (a req.tenant, a tenant id, or the
 * current request's tenant when omitted):
 *   { tenantId, home, demo, feeds, soldFeeds, serviceAreas, rows }
 */
export async function listingScope(tenant, { pool = getPool() } = {}) {
  const t = await resolveTenant(tenant, pool);
  const tenantId = Number(t?.id) || DEFAULT_TENANT_ID;
  const home = isHomeTenant({ id: tenantId });
  const rows = await tenantFeedRows(tenantId, pool);
  const approved = (rows || []).filter((r) => r.status === 'approved' && r.feed_key !== DEMO_FEED);
  let feeds = approved.map((r) => r.feed_key);
  let soldFeeds = approved.filter((r) => r.sold_enabled).map((r) => r.feed_key);
  let demo = false;
  if (home) {
    // SAA always shows IRES, and keeps its sold data unless it was turned off.
    if (!feeds.length) feeds = [HOME_FEED];
    if (!rows || !rows.some((r) => r.feed_key === HOME_FEED)) soldFeeds = [HOME_FEED];
  } else if (!feeds.length) {
    demo = true;
    feeds = [DEMO_FEED];
    soldFeeds = [DEMO_FEED];
  }
  return {
    tenantId,
    home,
    demo,
    feeds,
    soldFeeds,
    serviceAreas: normalizeServiceAreas(t?.settings?.mls?.service_areas || []),
    rows: rows || [],
  };
}

/** Approved feed keys for a brokerage, or ['demo'] in demo mode. SAA: ['ires']. */
export async function feedsFor(tenant, opts) {
  return (await listingScope(tenant, opts)).feeds;
}

/** Feeds whose sold data this brokerage may show. */
export async function soldFeedsFor(tenant, opts) {
  return (await listingScope(tenant, opts)).soldFeeds;
}

/**
 * SQL that keeps a listings query to the given feeds. `ref` is the
 * placeholder holding the feed array (e.g. '$3'); `alias` the listings alias
 * in the outer query. With more than one feed, a home also carried by an
 * earlier feed is left out so it shows once.
 */
export function feedFilterSql(ref, feeds, { alias = 'listings' } = {}) {
  const a = alias ? `${alias}.` : '';
  const base = `${a}feed = ANY(${ref}::text[])`;
  if (!Array.isArray(feeds) || feeds.length < 2) return base;
  return `(${base} AND NOT EXISTS (
    SELECT 1 FROM listings dup
    WHERE dup.feed = ANY(${ref}::text[]) AND dup.is_active
      AND array_position(${ref}::text[], dup.feed) < array_position(${ref}::text[], ${a}feed)
      AND listing_address_key(dup.street_number, dup.street_name, dup.unit, dup.city)
        = listing_address_key(${a}street_number, ${a}street_name, ${a}unit, ${a}city)))`;
}

/** WHERE fragment for a brokerage's service areas (cities or counties). */
export function serviceAreaSql(ref, { alias = '' } = {}) {
  const a = alias ? `${alias}.` : '';
  return `(LOWER(${a}city) = ANY(${ref}::text[])
    OR LOWER(REGEXP_REPLACE(COALESCE(${a}county, ''), '\\s+county$', '', 'i')) = ANY(${ref}::text[]))`;
}

export function serviceAreaValues(areas) {
  return (areas || []).map((v) => v.toLowerCase().replace(/\s+county$/i, ''));
}

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

function fillTemplate(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

/** "Listing courtesy of …" for a card, or null when the feed needs none or the office is unknown. */
export function courtesyLine(row, catalog) {
  const info = catalog?.get?.(row?.feed || HOME_FEED);
  if (!info || !info.courtesy_required) return null;
  const office = String(row?.list_office_name || '').trim();
  return office ? `Listing courtesy of ${office}` : null;
}

/**
 * Card fields every listing response carries: whether it's a sample home,
 * the courtesy line, and nothing about the listing agent.
 */
export function decorateCard(row, catalog) {
  if (!row) return row;
  const out = { ...row };
  out.feed = row.feed || HOME_FEED;
  out.sample = out.feed === DEMO_FEED;
  out.courtesy = courtesyLine(out, catalog);
  return out;
}

export async function decorateCards(rows, { pool } = {}) {
  const catalog = await feedCatalog({ pool });
  return rows.map((r) => decorateCard(r, catalog));
}

/**
 * Detail-page attribution: office, agent, the feed's disclaimer filled with
 * this brokerage's name and when the listing was last updated.
 */
export async function attributionFor(listing, tenant, { pool } = {}) {
  const catalog = await feedCatalog({ pool });
  const feed = listing?.feed || HOME_FEED;
  const info = catalog.get(feed) || FALLBACK_FEEDS[feed] || FALLBACK_FEEDS.ires;
  const brand = brandFor(tenant || { id: DEFAULT_TENANT_ID });
  const updatedAt = listing?.updated_at ? new Date(listing.updated_at) : null;
  const updated = updatedAt && !Number.isNaN(updatedAt.getTime()) ? `${TIME_FMT.format(updatedAt)} MT` : 'recently';
  return {
    feed,
    feed_name: info.name,
    sample: feed === DEMO_FEED,
    courtesy: courtesyLine({ ...listing, feed }, catalog),
    office: listing?.list_office_name || null,
    agent: listing?.list_agent_name || null,
    disclaimer: fillTemplate(info.disclaimer, { brokerage: brand.legal_name || brand.name, updated }),
    updated_at: updatedAt ? updatedAt.toISOString() : null,
  };
}

/** Plain-words status for the owner's Settings and the platform console. */
export async function feedStatusFor(tenant, { pool = getPool() } = {}) {
  const t = await resolveTenant(tenant, pool);
  const scope = await listingScope(t, { pool });
  const catalog = await feedCatalog({ pool });
  const named = (k) => catalog.get(k)?.name || k.toUpperCase();
  const feeds = [...catalog.values()]
    .filter((f) => f.key !== DEMO_FEED)
    .map((f) => {
      const row = scope.rows.find((r) => r.feed_key === f.key);
      return {
        key: f.key,
        name: f.name,
        vendor: f.vendor || null,
        status: row?.status || (scope.home && f.key === HOME_FEED ? 'approved' : 'none'),
        office_mls_id: row?.office_mls_id || null,
        sold_enabled: row ? !!row.sold_enabled : scope.home && f.key === HOME_FEED,
        notes: row?.notes || null,
        approved_at: row?.approved_at || null,
        updated_at: row?.updated_at || null,
      };
    });
  const live = scope.demo ? [] : scope.feeds.map(named);
  return {
    mode: scope.demo ? 'demo' : 'live',
    headline: scope.demo
      ? 'Showing sample homes until your MLS approves your site'
      : `Live: ${live.join(', ')}`,
    live_feeds: live,
    suspended: feeds.filter((f) => f.status === 'suspended').map((f) => f.name),
    pending: feeds.filter((f) => f.status === 'pending').map((f) => f.name),
    sold: scope.soldFeeds.length > 0,
    service_areas: scope.serviceAreas,
    feeds,
  };
}
