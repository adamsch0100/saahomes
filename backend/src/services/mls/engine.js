/**
 * The sync engine for every MLS feed other than IRES (IRES keeps its own
 * pipeline in iresSync.js, untouched).
 *
 * One run of syncFeed(key):
 *   1. takes the feed's advisory lock (two servers never sync one feed);
 *   2. first run: imports the whole active set, then removes local homes the
 *      MLS no longer has, and (when the MLS allows sold data) the last
 *      12 months of sales;
 *      later runs: asks only for what changed since the watermark (the
 *      greatest ModificationTimestamp we've stored) and applies it: new and
 *      changed homes, status flips, sales, MLS Grid's MlgCanView=false;
 *   3. once a day on platforms that don't report removals, checks every
 *      active ListingKey and takes down homes that vanished;
 *   4. fills office and agent names from the MLS roster when the feed only
 *      gives their MLS ids ("Listing courtesy of …");
 *   5. records health (last success, last error, listing count, next run)
 *      and switches waiting brokerages from sample homes to live listings
 *      once their first import has homes in it.
 *
 * Listing ids are "<feed>-<MLS number>" so two MLSs never collide; the
 * MLS's own number is shown to buyers (feeds.mlsNumber).
 */
import getPool from '../../config/database.js';
import logger from '../../utils/logger.js';
import { createAdapter, explainError, MlsApiError } from './adapters.js';
import { normalizeResoListing, isPhotoMedia, photosFromMedia } from './resoMapping.js';
import { decryptSecret } from './secrets.js';
import { PLATFORMS } from './platforms.js';
import { applyRosterNames } from '../mlsRoster.js';
import { clearFeedCache } from '../feeds.js';

export const MLS_LOCK_NS = 833712; // two-key advisory locks: (833712, hashtext(feed))
const IRES_LOCK_KEY = 833711; // iresScheduler's lock: MLS Grid traffic never overlaps it
const DAY_MS = 24 * 60 * 60 * 1000;
const SOLD_MONTHS = 12;

export const LIVE_STATES = ['live'];

/** The feed's connection row joined with its display rules. */
export async function loadConnection(pool, key) {
  const { rows: [row] } = await pool.query(
    `SELECT c.*, f.name, f.vendor, f.disclaimer, f.sold_data_allowed, f.courtesy_required,
            f.logo_required, f.catalog_id, f.states
     FROM mls_connections c JOIN mls_feeds f ON f.key = c.feed_key
     WHERE c.feed_key = $1`,
    [key]
  );
  return row || null;
}

/** Decrypted credentials for a connection row ({} when none are saved). */
export function credentialsOf(row) {
  if (!row?.credentials_enc) return {};
  return decryptSecret(row.credentials_enc) || {};
}

/** An adapter for a connection row. */
export function adapterFor(row, opts = {}) {
  return createAdapter(
    { platform: row.platform, config: row.config || {}, credentials: opts.credentials || credentialsOf(row) },
    { droppedFields: row.dropped_fields || [], ...opts }
  );
}

/** Mapping options for a feed: id prefix, home state, source name, photo rule. */
export function mappingFor(row) {
  return {
    idPrefix: `${row.feed_key}-`,
    defaultState: (row.states && row.states[0]) || null,
    defaultSource: String(row.name || row.feed_key).slice(0, 32),
    isPhoto: isPhotoMedia,
  };
}

const LISTING_COLS = [
  'listing_id', 'status', 'is_active', 'property_type', 'property_subtype', 'home_type', 'street_number',
  'street_name', 'unit', 'city', 'state', 'postal_code', 'county', 'list_price', 'original_list_price',
  'price_change_timestamp', 'beds', 'baths', 'half_baths', 'three_quarter_baths', 'living_area',
  'above_grade_area', 'lot_size', 'lot_size_acres', 'units_total', 'year_built', 'garage_spaces', 'hoa_fee',
  'description', 'assumable', 'photos', 'photos_count', 'latitude', 'longitude', 'listing_url', 'mls_source',
  'elementary_school', 'middle_school', 'high_school', 'school_district', 'days_on_market', 'price_per_sqft',
  'subdivision', 'features', 'raw', 'slug', 'list_office_name', 'list_office_mls_id', 'list_agent_name',
  'list_agent_mls_id',
];
const KEEP_WHEN_MISSING = new Set(['list_office_name', 'list_office_mls_id', 'list_agent_name', 'list_agent_mls_id']);
const JSON_COLS = new Set(['photos', 'features', 'raw']);

// One home per statement, scoped to its feed: a listing id another feed
// owns is never overwritten (ids are prefixed, so this is belt and braces).
const LISTING_UPSERT_SQL = `
  INSERT INTO listings (${LISTING_COLS.join(', ')}, feed, updated_at, last_seen_at)
  VALUES (${LISTING_COLS.map((_, i) => `$${i + 1}`).join(', ')}, $${LISTING_COLS.length + 1}, NOW(), NOW())
  ON CONFLICT (listing_id) DO UPDATE SET
    ${LISTING_COLS.filter((c) => c !== 'listing_id').map((c) => (KEEP_WHEN_MISSING.has(c)
    ? `${c} = COALESCE(EXCLUDED.${c}, listings.${c})`
    : `${c} = EXCLUDED.${c}`)).join(',\n    ')},
    updated_at = NOW(), last_seen_at = NOW()
  WHERE listings.feed = EXCLUDED.feed`;

const SOLD_COLS = [
  'listing_id', 'mls_source', 'city', 'county', 'street_number', 'street_name', 'unit', 'address', 'postal_code',
  'lat', 'lng', 'property_type', 'home_type', 'beds', 'baths', 'living_area', 'lot_size', 'list_price',
  'sold_price', 'closed_date', 'days_on_market', 'parcel_number', 'subdivision', 'elementary_school',
  'middle_school', 'high_school', 'school_district', 'photos', 'photos_count', 'modification_timestamp',
  'list_office_name', 'list_office_mls_id', 'list_agent_name', 'list_agent_mls_id',
];
const SOLD_UPSERT_SQL = `
  INSERT INTO sold_listings (${SOLD_COLS.join(', ')}, feed, updated_at)
  VALUES (${SOLD_COLS.map((_, i) => `$${i + 1}`).join(', ')}, $${SOLD_COLS.length + 1}, NOW())
  ON CONFLICT (listing_id) DO UPDATE SET
    ${SOLD_COLS.filter((c) => c !== 'listing_id').map((c) => (KEEP_WHEN_MISSING.has(c)
    ? `${c} = COALESCE(EXCLUDED.${c}, sold_listings.${c})`
    : `${c} = EXCLUDED.${c}`)).join(',\n    ')},
    updated_at = NOW()
  WHERE sold_listings.feed = EXCLUDED.feed`;

const canView = (raw) => !(raw?.MlgCanView === false || String(raw?.MlgCanView).toLowerCase() === 'false');

/** A sold_listings row from a Closed record, or null when it can't be one. */
export function soldRowFrom(l, raw, { now = new Date() } = {}) {
  const closed = raw.CloseDate ? String(raw.CloseDate).slice(0, 10) : null;
  if (!closed || !/^\d{4}-\d{2}-\d{2}$/.test(closed)) return null;
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - SOLD_MONTHS);
  if (new Date(`${closed}T00:00:00Z`) < cutoff) return null;
  const price = Number(raw.ClosePrice);
  return {
    listing_id: l.listing_id,
    mls_source: l.mls_source,
    city: l.city || null,
    county: l.county,
    street_number: l.street_number,
    street_name: l.street_name,
    unit: l.unit,
    address: [l.street_number, l.street_name, l.unit ? `#${l.unit}` : null].filter(Boolean).join(' ') || null,
    postal_code: l.postal_code,
    lat: l.latitude,
    lng: l.longitude,
    property_type: l.property_type,
    home_type: l.home_type,
    beds: l.beds,
    baths: l.baths,
    living_area: l.living_area,
    lot_size: l.lot_size,
    list_price: l.list_price,
    sold_price: Number.isFinite(price) && price > 0 && price <= 1e9 ? price : null,
    closed_date: closed,
    days_on_market: l.days_on_market,
    parcel_number: raw.ParcelNumber ? String(raw.ParcelNumber).slice(0, 64) : null,
    subdivision: l.subdivision,
    elementary_school: l.elementary_school,
    middle_school: l.middle_school,
    high_school: l.high_school,
    school_district: l.school_district,
    photos: l.photos,
    photos_count: l.photos_count,
    modification_timestamp: raw.ModificationTimestamp || null,
    list_office_name: l.list_office_name,
    list_office_mls_id: l.list_office_mls_id,
    list_agent_name: l.list_agent_name,
    list_agent_mls_id: l.list_agent_mls_id,
  };
}

function clip(l) {
  // Column widths in listings: keep a long MLS value from failing the row.
  const cut = (v, n) => (v == null ? v : String(v).slice(0, n));
  return {
    ...l,
    property_type: cut(l.property_type, 64),
    property_subtype: cut(l.property_subtype, 128),
    street_number: cut(l.street_number, 32),
    street_name: cut(l.street_name, 255),
    unit: cut(l.unit, 32),
    city: cut(l.city, 100),
    state: l.state ? cut(String(l.state).toUpperCase(), 2) : null,
    postal_code: cut(l.postal_code, 16),
    county: cut(l.county, 100),
    elementary_school: cut(l.elementary_school, 128),
    middle_school: cut(l.middle_school, 128),
    high_school: cut(l.high_school, 128),
    school_district: cut(l.school_district, 255),
    subdivision: cut(l.subdivision, 255),
    slug: cut(l.slug, 255),
    status: cut(l.status, 32),
    mls_source: cut(l.mls_source, 32),
  };
}

async function upsertListing(pool, feedKey, l) {
  await pool.query(LISTING_UPSERT_SQL, [
    ...LISTING_COLS.map((c) => (JSON_COLS.has(c) ? JSON.stringify(l[c] ?? (c === 'photos' ? [] : {})) : l[c] ?? null)),
    feedKey,
  ]);
}

async function upsertSold(pool, feedKey, s) {
  await pool.query(SOLD_UPSERT_SQL, [
    ...SOLD_COLS.map((c) => (c === 'photos' ? JSON.stringify(s.photos || []) : s[c] ?? null)),
    feedKey,
  ]);
}

function maxTs(records, current) {
  let out = current;
  for (const r of records) {
    const ts = r?.ModificationTimestamp;
    if (ts && (!out || String(ts) > String(out))) out = String(ts);
  }
  return out;
}

/**
 * Store one page of Property records. Returns counts. Closed records go to
 * sold_listings when the feed allows sold data (and come off the market);
 * MlgCanView=false takes a home down everywhere.
 */
async function applyPage(pool, row, records, ctx) {
  const opts = mappingFor(row);
  const out = { listings: 0, sold: 0, removed: 0 };
  for (const raw of records) {
    if (!raw || !(raw.ListingKey || raw.ListingId)) continue;
    const l = clip(normalizeResoListing(raw, opts));
    if (!l.state) l.state = null;
    ctx.seen?.add(String(raw.ListingKey || ''));
    await upsertListing(pool, row.feed_key, l);
    out.listings += 1;
    if (!canView(raw)) {
      await pool.query('DELETE FROM sold_listings WHERE listing_id = $1 AND feed = $2', [l.listing_id, row.feed_key]);
      out.removed += 1;
      continue;
    }
    if (raw.StandardStatus === 'Closed' && row.sold_data_allowed) {
      const s = soldRowFrom(l, raw, { now: ctx.now });
      if (s) {
        await upsertSold(pool, row.feed_key, s);
        out.sold += 1;
      }
    }
  }
  return out;
}

/** Attach Media fetched separately when the platform didn't expand it. */
async function withMedia(adapter, records) {
  if (adapter.expandsMedia || adapter.platform === 'bridge') return records;
  const keys = records.filter((r) => !Array.isArray(r.Media)).map((r) => r.ListingKey).filter(Boolean);
  if (!keys.length) return records;
  const media = await adapter.mediaFor(keys);
  return records.map((r) => (Array.isArray(r.Media) ? r : { ...r, Media: media.get(String(r.ListingKey)) || [] }));
}

/** Take the feed's advisory lock on a dedicated client. Returns release() or null. */
async function lockFeed(pool, key, { shareWithIres = false } = {}) {
  const client = await pool.connect();
  try {
    const { rows: [r] } = await client.query('SELECT pg_try_advisory_lock($1, hashtext($2)) AS ok', [MLS_LOCK_NS, key]);
    if (!r.ok) {
      client.release();
      return null;
    }
    if (shareWithIres) {
      const { rows: [i] } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [IRES_LOCK_KEY]);
      if (!i.ok) {
        await client.query('SELECT pg_advisory_unlock($1, hashtext($2))', [MLS_LOCK_NS, key]).catch(() => {});
        client.release();
        return null;
      }
    }
  } catch (e) {
    client.release();
    throw e;
  }
  return async () => {
    if (shareWithIres) await client.query('SELECT pg_advisory_unlock($1)', [IRES_LOCK_KEY]).catch(() => {});
    await client.query('SELECT pg_advisory_unlock($1, hashtext($2))', [MLS_LOCK_NS, key]).catch(() => {});
    client.release();
  };
}

/**
 * MLS Grid limits apply to the whole account, and IRES (iresScheduler) syncs
 * on the same account at :57 each hour. Other MLS Grid feeds stay out of
 * :50–:59 and hold the IRES lock while they run, so the two never overlap.
 */
export function sharesIresBudget(row) {
  return row.platform === 'mlsgrid' && !!process.env.IRES_ACCESS_TOKEN && process.env.MLS_SHARE_IRES_BUDGET !== 'off';
}
const inIresWindow = (d) => d.getUTCMinutes() >= 50;

/** Office/agent names from the MLS roster, when listings carry only ids. */
async function refreshRoster(pool, row, adapter, { force = false } = {}) {
  const { rows: [need] } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM listings
              WHERE feed = $1 AND list_office_mls_id IS NOT NULL AND list_office_name IS NULL)
          + (SELECT COUNT(*) FROM sold_listings
              WHERE feed = $1 AND list_office_mls_id IS NOT NULL AND list_office_name IS NULL) AS n`,
    [row.feed_key]
  );
  const fresh = row.roster_at && Date.now() - new Date(row.roster_at).getTime() < DAY_MS;
  if (!Number(need.n)) return { skipped: true };
  // The roster itself refreshes once a day; every run names new homes from it.
  if (fresh && !force) return { applied: await applyRosterNames({ pool, feed: row.feed_key }) };
  const result = {};
  const tables = {
    office: { table: 'mls_offices', idCol: 'office_mls_id', nameCol: 'name', id: 'OfficeMlsId', name: 'OfficeName' },
    member: { table: 'mls_members', idCol: 'member_mls_id', nameCol: 'full_name', id: 'MemberMlsId', name: 'MemberFullName' },
  };
  for (const [kind, t] of Object.entries(tables)) {
    try {
      const { rows: [s] } = await pool.query(`SELECT MAX(modified_at) AS since FROM ${t.table} WHERE feed = $1`, [row.feed_key]);
      const since = row.roster_at && s.since ? new Date(s.since).toISOString() : null;
      let saved = 0;
      for await (const page of adapter.rosterPages(kind, { since })) {
        const ids = [];
        const names = [];
        const mods = [];
        for (const r of page.records) {
          const id = r[t.id] ? String(r[t.id]).slice(0, 40) : null;
          if (!id) continue;
          ids.push(id);
          names.push(r.MlgCanView === false || !r[t.name] ? null : String(r[t.name]).slice(0, 255));
          mods.push(r.ModificationTimestamp || null);
        }
        if (ids.length) {
          await pool.query(
            `INSERT INTO ${t.table} (feed, ${t.idCol}, ${t.nameCol}, modified_at, updated_at)
             SELECT $1, x.id, x.name, x.modified, NOW()
             FROM UNNEST($2::text[], $3::text[], $4::timestamptz[]) AS x(id, name, modified)
             ON CONFLICT (feed, ${t.idCol}) DO UPDATE
               SET ${t.nameCol} = EXCLUDED.${t.nameCol}, modified_at = EXCLUDED.modified_at, updated_at = NOW()`,
            [row.feed_key, ids, names, mods]
          );
          saved += ids.length;
        }
      }
      result[kind] = { saved };
    } catch (e) {
      // Some licenses don't include the roster: the names just stay empty.
      result[kind] = { error: explainError(e) };
    }
  }
  result.applied = await applyRosterNames({ pool, feed: row.feed_key });
  await pool.query('UPDATE mls_connections SET roster_at = NOW() WHERE feed_key = $1', [row.feed_key]);
  return result;
}

/** Brokerages that asked to go live switch over once the feed has homes. */
export async function promoteWaitingTenants(pool, feedKey) {
  const { rows: [c] } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM listings WHERE feed = $1 AND is_active", [feedKey]
  );
  if (!c.n) return [];
  const { rows } = await pool.query(
    `UPDATE tenant_feeds SET status = 'approved', stage = 'live', approved_at = NOW(), updated_at = NOW(),
       stage_log = stage_log || jsonb_build_object('live', NOW())
     WHERE feed_key = $1 AND status = 'pending' AND go_live_auto AND go_live_requested_at IS NOT NULL
     RETURNING tenant_id`,
    [feedKey]
  );
  for (const r of rows) {
    await pool.query(
      'INSERT INTO tenant_feed_log (tenant_id, feed_key, changed_by, changes) VALUES ($1, $2, $3, $4)',
      [r.tenant_id, feedKey, 'first import finished', JSON.stringify({ status: { from: 'pending', to: 'approved' } })]
    );
  }
  if (rows.length) clearFeedCache();
  return rows.map((r) => r.tenant_id);
}

async function countsFor(pool, key) {
  const { rows: [r] } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM listings WHERE feed = $1 AND is_active) AS listings,
            (SELECT COUNT(*)::int FROM sold_listings WHERE feed = $1) AS sold`,
    [key]
  );
  return r;
}

/**
 * Sync one feed. mode: 'auto' (first run imports everything, later runs are
 * incremental), 'incremental' or 'full'. Never throws: returns a summary
 * with ok=false and the error in plain words.
 */
export async function syncFeed(key, {
  pool = getPool(), mode = 'auto', fetchImpl, sleep, minIntervalMs, now = () => new Date(), maxPages,
} = {}) {
  const row = await loadConnection(pool, key);
  if (!row) return { ok: false, skipped: 'no_connection' };
  const share = sharesIresBudget(row);
  if (share && inIresWindow(now())) return { ok: true, skipped: 'ires_window' };
  const release = await lockFeed(pool, key, { shareWithIres: share });
  if (!release) return { ok: true, skipped: 'locked' };
  const startedAt = now();
  const summary = { ok: false, mode, listings: 0, sold: 0, removed: 0, pages: 0 };
  try {
    await pool.query('UPDATE mls_connections SET running_since = NOW(), last_run_at = NOW() WHERE feed_key = $1', [key]);
    const adapter = adapterFor(row, { fetchImpl, sleep, minIntervalMs });
    const first = !row.full_import_at || !row.watermark;
    const full = mode === 'full' || (mode === 'auto' && first) || (mode === 'incremental' && first);
    summary.mode = full ? 'full' : 'incremental';
    const ctx = { now: startedAt, seen: full ? new Set() : null };
    let watermark = row.watermark || null;
    let stoppedEarly = false;

    const pages = full
      ? adapter.propertyPages({ initial: true, maxPages })
      : adapter.propertyPages({ since: row.watermark, maxPages });
    for await (const page of pages) {
      const records = await withMedia(adapter, page.records);
      const r = await applyPage(pool, row, records, ctx);
      summary.listings += r.listings;
      summary.sold += r.sold;
      summary.removed += r.removed;
      summary.pages += 1;
      watermark = maxTs(records, watermark);
      // MLS Grid pages come in ModificationTimestamp order, so stopping
      // before IRES's slot and resuming from here loses nothing.
      if (share && !full && inIresWindow(now())) {
        stoppedEarly = true;
        break;
      }
    }

    // A full pass: homes we hold that the MLS no longer lists come down.
    if (full && !stoppedEarly && ctx.seen.size) {
      const gone = await pool.query(
        `UPDATE listings SET is_active = FALSE, status = 'Withdrawn', updated_at = NOW()
         WHERE feed = $1 AND is_active AND NOT ((raw->>'ListingKey') = ANY($2::text[]))`,
        [key, [...ctx.seen]]
      );
      summary.removed += gone.rowCount;
    }

    // First import with sold data allowed: the last 12 months of sales.
    if (row.sold_data_allowed && !row.sold_backfill_at && !stoppedEarly) {
      const cutoff = new Date(startedAt);
      cutoff.setUTCMonth(cutoff.getUTCMonth() - SOLD_MONTHS);
      for await (const page of adapter.propertyPages({ sold: true, soldSince: cutoff.toISOString(), maxPages })) {
        const records = await withMedia(adapter, page.records);
        const r = await applyPage(pool, row, records, { now: startedAt, seen: null });
        summary.sold += r.sold;
        summary.pages += 1;
      }
      await pool.query('UPDATE mls_connections SET sold_backfill_at = NOW() WHERE feed_key = $1', [key]);
    }

    // Daily check for homes that left the market without telling us.
    const reconcileDue = !full && adapter.reconciles
      && (!row.reconciled_at || startedAt.getTime() - new Date(row.reconciled_at).getTime() > DAY_MS);
    if (reconcileDue && !stoppedEarly) {
      const keys = await adapter.activeKeys();
      if (keys && keys.size) {
        const gone = await pool.query(
          `UPDATE listings SET is_active = FALSE, status = 'Withdrawn', updated_at = NOW()
           WHERE feed = $1 AND is_active AND NOT ((raw->>'ListingKey') = ANY($2::text[]))`,
          [key, [...keys]]
        );
        summary.removed += gone.rowCount;
        summary.reconciled = true;
      }
      await pool.query('UPDATE mls_connections SET reconciled_at = NOW() WHERE feed_key = $1', [key]);
    } else if (full) {
      await pool.query('UPDATE mls_connections SET reconciled_at = NOW() WHERE feed_key = $1', [key]);
    }

    if (row.courtesy_required !== false && !stoppedEarly) {
      summary.roster = await refreshRoster(pool, row, adapter, { force: full });
    }

    const counts = await countsFor(pool, key);
    summary.ok = true;
    summary.calls = adapter.calls;
    summary.dropped_fields = adapter.droppedFields;
    const cadence = Math.max(Number(row.cadence_minutes) || 30, PLATFORMS[row.platform]?.min_cadence_minutes || 10);
    await pool.query(
      `UPDATE mls_connections SET
         watermark = COALESCE($2, watermark),
         full_import_at = CASE WHEN $3 AND NOT $4 THEN NOW() ELSE full_import_at END,
         dropped_fields = $5, listing_count = $6, sold_count = $7,
         last_success_at = NOW(), last_error = NULL, last_result = $8,
         next_run_at = NOW() + make_interval(mins => $9),
         running_since = NULL, updated_at = NOW()
       WHERE feed_key = $1`,
      [key, watermark, full, stoppedEarly, adapter.droppedFields, counts.listings, counts.sold,
        JSON.stringify({ ...summary, finished_at: new Date().toISOString() }), stoppedEarly ? 15 : cadence]
    );
    summary.counts = counts;
    summary.promoted = await promoteWaitingTenants(pool, key);
    clearFeedCache();
    return summary;
  } catch (error) {
    const reason = explainError(error);
    logger.warn(`[mls-sync] ${key} failed: ${error.message}`);
    // Back off: 15 minutes, or an hour when the MLS refused us outright.
    const retry = error instanceof MlsApiError && [401, 403, 404].includes(error.status) ? 60 : 15;
    await pool.query(
      `UPDATE mls_connections SET last_error = $2, last_error_at = NOW(), running_since = NULL,
         next_run_at = NOW() + make_interval(mins => $3), updated_at = NOW()
       WHERE feed_key = $1`,
      [key, reason, retry]
    ).catch(() => {});
    return { ...summary, ok: false, error: reason };
  } finally {
    await release();
  }
}

/**
 * "Test connection": a handful of active listings, mapped the way the site
 * shows them, without storing anything. Saves the outcome on the connection
 * (a passing test moves a new connection to 'connected').
 */
export async function testConnection(key, { pool = getPool(), fetchImpl, sleep, minIntervalMs, n = 5 } = {}) {
  const row = await loadConnection(pool, key);
  if (!row) return { ok: false, error: 'This MLS isn’t set up yet.' };
  let adapter;
  try {
    adapter = adapterFor(row, { fetchImpl, sleep, minIntervalMs, retries: 1 });
    const records = await withMedia(adapter, await adapter.preview(n));
    const opts = mappingFor(row);
    const listings = records.map((raw) => {
      const l = normalizeResoListing(raw, opts);
      return {
        mls_number: String(raw.ListingId || raw.ListingKey),
        address: [l.street_number, l.street_name, l.unit ? `#${l.unit}` : null].filter(Boolean).join(' ') || null,
        city: l.city || null,
        state: l.state || null,
        price: l.list_price,
        beds: l.beds,
        baths: l.baths,
        sqft: l.living_area,
        status: l.status,
        photo: photosFromMedia(raw.Media, isPhotoMedia)[0] || null,
        photos: l.photos.length,
        office: l.list_office_name,
        office_mls_id: l.list_office_mls_id,
      };
    });
    const warnings = [];
    if (!listings.length) warnings.push('The connection works, but the MLS sent no active listings. Check that the license covers IDX data for active listings.');
    if (listings.length && listings.every((l) => !l.photos)) warnings.push('No photos came with these listings. Photos may need a separate approval from the MLS.');
    if (listings.length && listings.every((l) => !l.office)) {
      warnings.push(listings.some((l) => l.office_mls_id)
        ? 'Office names aren’t in the listing data; we’ll look them up from the MLS’s office roster for “Listing courtesy of”.'
        : 'The listing office isn’t in the data. Most MLSs require “Listing courtesy of” on every home; ask the MLS to include ListOfficeName.');
    }
    if (adapter.droppedFields.length) warnings.push(`The MLS doesn’t share ${adapter.droppedFields.length} of the fields we ask for (${adapter.droppedFields.slice(0, 6).join(', ')}${adapter.droppedFields.length > 6 ? ', …' : ''}). We sync without them.`);
    await pool.query(
      `UPDATE mls_connections SET last_test_at = NOW(), last_test_ok = TRUE, last_test_error = NULL,
         dropped_fields = $2, state = CASE WHEN state = 'setup' THEN 'connected' ELSE state END, updated_at = NOW()
       WHERE feed_key = $1`,
      [key, adapter.droppedFields]
    );
    return { ok: true, listings, warnings, calls: adapter.calls };
  } catch (error) {
    const reason = explainError(error);
    await pool.query(
      `UPDATE mls_connections SET last_test_at = NOW(), last_test_ok = FALSE, last_test_error = $2, updated_at = NOW()
       WHERE feed_key = $1`,
      [key, reason]
    ).catch(() => {});
    return { ok: false, error: reason, status: error?.status || null };
  }
}

// Photo refreshes for feeds whose media links expire (MLS Grid: one hour).
// Their own small budget, apart from IRES's: 20 a minute across the process.
const REFRESH_PER_MIN = 20;
let refreshBudget = { at: 0, left: REFRESH_PER_MIN };

/**
 * Fresh photo URLs for one listing (by listings.id) from its feed, saved on
 * the row. Null when the feed isn't a connected MLS, the budget is spent, or
 * anything fails (the photo proxy then shows its placeholder).
 */
export async function refreshListingPhotos(pool, listingRowId, { fetchImpl } = {}) {
  try {
    const now = Date.now();
    if (now - refreshBudget.at >= 60000) refreshBudget = { at: now, left: REFRESH_PER_MIN };
    if (refreshBudget.left <= 0) return null;
    const { rows: [l] } = await pool.query(
      "SELECT id, feed, raw->>'ListingKey' AS key FROM listings WHERE id = $1", [listingRowId]
    );
    if (!l?.key || ['ires', 'demo'].includes(l.feed)) return null;
    const row = await loadConnection(pool, l.feed);
    if (!row || row.state !== 'live') return null;
    refreshBudget.left -= 1;
    const adapter = adapterFor(row, { fetchImpl, retries: 0 });
    const record = await adapter.byKey(l.key);
    const media = Array.isArray(record?.Media)
      ? record.Media
      : (await adapter.mediaFor([l.key])).get(String(l.key)) || [];
    const photos = photosFromMedia(media, isPhotoMedia);
    if (!photos.length) return null;
    await pool.query('UPDATE listings SET photos = $1, photos_count = $2 WHERE id = $3', [JSON.stringify(photos), photos.length, l.id]);
    return photos;
  } catch (error) {
    logger.warn(`[mls-photos] refresh failed: ${error.message}`);
    return null;
  }
}
