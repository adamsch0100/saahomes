import getPool from '../config/database.js';
import { syncListingPhotos, isR2Hosted } from './photoSync.js';
// RESO → listings row mapping, shared with the other MLS feeds (mls/engine.js).
// IRES uses it with its defaults, unchanged.
import { normalizeResoListing as normalizeListing } from './mls/resoMapping.js';

/**
 * IRES IDX feed sync — RESO Web API (JSON) via MLS Grid.
 *
 * Env vars:
 *   IRES_API_URL       — RESO Web API base URL (https://api.mlsgrid.com/v2)
 *   IRES_ACCESS_TOKEN  — static bearer token (MLS Grid IDX token) — preferred
 *   — OR OAuth credentials (only if no static token):
 *   IRES_CLIENT_ID / IRES_CLIENT_SECRET / IRES_USERNAME / IRES_PASSWORD
 *
 * Runs via:  npm run sync-listings
 */

const MLS_FIELDS = [
  // Core
  'ListingKey', 'ListingId', 'StandardStatus', 'PropertyType', 'PropertySubType',
  'StreetNumber', 'StreetName', 'UnitNumber', 'City', 'StateOrProvince',
  'PostalCode', 'CountyOrParish', 'ListPrice', 'BedroomsTotal',
  'BathroomsTotalInteger', 'BathroomsFull', 'LivingArea', 'LotSizeArea',
  'YearBuilt', 'GarageSpaces', 'AssociationFee', 'PublicRemarks',
  'Latitude', 'Longitude',
  // Schools + market stats
  'ElementarySchool', 'MiddleOrJuniorSchool', 'HighSchool', 'HighSchoolDistrict',
  'DaysOnMarket', 'OriginalListPrice', 'PriceChangeTimestamp', 'MlsStatus',
  'OriginatingSystemName', 'PhotosCount',
  // Home type / structure
  'PropertyAttachedYN', 'Levels', 'StructureType', 'BuildingAreaTotal',
  'AboveGradeFinishedArea', 'BathroomsHalf', 'BathroomsThreeQuarter',
  'NumberOfUnitsTotal', 'LotSizeAcres', 'ParcelNumber', 'TaxYear', 'TaxAnnualAmount',
  // Features & amenities
  'ArchitecturalStyle', 'Basement', 'ConstructionMaterials', 'Roof',
  'InteriorFeatures', 'ExteriorFeatures', 'Appliances', 'Flooring',
  'Cooling', 'Heating', 'FireplaceFeatures', 'PoolFeatures', 'SpaFeatures',
  'ParkingFeatures', 'ParkingTotal', 'OtherParking', 'Fencing',
  'PatioAndPorchFeatures', 'WindowFeatures', 'SecurityFeatures',
  'DoorFeatures', 'Electric', 'LaundryFeatures', 'OtherEquipment',
  'OtherStructures', 'PetsAllowed', 'WaterBodyName', 'HorseAmenities',
  'IrrigationSource', 'IrrigationWaterRightsYN', 'View', 'WaterfrontYN',
  // Location / governance
  'Sewer', 'WaterSource', 'Utilities', 'Zoning', 'LotFeatures', 'SubdivisionName',
  'Directions', 'Disclosures', 'StreetDirPrefix', 'StreetDirSuffix',
  'StreetSuffix', 'UnparsedAddress', 'MLSAreaMajor', 'MLSAreaMinor',
  // Listing terms
  'ListingTerms', 'SpecialListingConditions', 'NewConstructionYN',
  'BuilderName', 'BuilderModel', 'AssociationYN', 'AssociationName',
  'AssociationFeeIncludes', 'AssociationPhone', 'AssociationFeeFrequency',
  'VirtualTourURLUnbranded', 'ShowingServiceName', 'AvailabilityDate',
  'ListingContractDate',
  // Accessibility / community
  'AccessibilityFeatures', 'CommunityFeatures', 'GreenEnergyEfficient',
  'GreenBuildingVerificationType', 'DevelopmentStatus',
  // Incremental replication (MLS Grid v2 docs: filter by ModificationTimestamp
  // after initial import; gate media on PhotosChangeTimestamp; drop when MlgCanView=false)
  'ModificationTimestamp', 'PhotosChangeTimestamp', 'MlgCanView',
];

// Listing office and agent, for "Listing courtesy of …" (IDX rules). When the
// feed refuses one of them in $select, sync drops just that field and carries
// on; names the feed won't give come from the Office/Member roster
// (services/mlsRoster.js) by MLS id.
export const OFFICE_FIELDS = ['ListOfficeName', 'ListOfficeMlsId', 'ListAgentFullName', 'ListAgentMlsId'];
const rejectedOfficeFields = new Set();

/** True when an MLS error body is the feed refusing one of the office/agent fields. */
export function rejectsOfficeFields(status, body) {
  return status === 400 && OFFICE_FIELDS.some((f) => String(body || '').includes(f));
}

/** The office/agent fields still worth asking for. */
export function officeSelectFields() {
  return OFFICE_FIELDS.filter((f) => !rejectedOfficeFields.has(f));
}

/**
 * Record which office/agent field(s) an MLS 400 refused. Returns true when a
 * field was newly dropped (so the caller retries), false when there's nothing
 * left to drop.
 */
export function dropRejectedOfficeFields(status, body) {
  if (!rejectsOfficeFields(status, body)) return false;
  const text = String(body || '');
  const named = [...text.matchAll(/field '([A-Za-z]+)'/g)].map((m) => m[1]).filter((f) => OFFICE_FIELDS.includes(f));
  const drop = (named.length ? named : OFFICE_FIELDS.filter((f) => text.includes(f)))
    .filter((f) => !rejectedOfficeFields.has(f));
  if (!drop.length) return false;
  for (const f of drop) rejectedOfficeFields.add(f);
  console.warn(`⚠️ IRES refused ${drop.join(', ')} — syncing without ${drop.length === 1 ? 'it' : 'them'}`);
  return true;
}

/** Test hook: forget refused fields. */
export function resetOfficeFieldRejections() {
  rejectedOfficeFields.clear();
}

// ── MLS Grid rate-limit compliance (suspension Aug 2026: 9 RPS) ──────────
// Hard ceilings: 4 RPS sustained (warning 2 RPS example), 7200 req/hr,
// 3072 MB/hr. We target ≤2 RPS with sequential paging + jitter, retry with
// exponential backoff on 429/5xx, and a lock file so overlapping runs can
// never multiply the request rate.
const RATE_LIMIT_MS = 700; // ~1.2–1.4 RPS worst case; the photo proxy on
// Railway shares the same MLS budget (CDN fetches count), so the sync must
// leave headroom — 2 syncs stacked at 550ms caused 429s on Aug 10 2026.
const LOCK_FILE = '/tmp/ires-sync.lock';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquireLock() {
  try {
    const fs = await import('fs');
    if (fs.existsSync(LOCK_FILE)) {
      const info = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      const ageMin = (Date.now() - (info.at || 0)) / 60000;
      // A stale lock (>90 min) is safe to take over — syncs never run longer.
      if (ageMin < 90) {
        console.log(`⏳ Another sync is already running (pid ${info.pid}, started ${Math.round(ageMin)}m ago) — skipping.`);
        return false;
      }
      console.log('⚠️ Stale sync lock detected — taking over.');
    }
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: Date.now() }));
    return true;
  } catch {
    return true; // lock infra unavailable — proceed (single-run envs)
  }
}

async function releaseLock() {
  try {
    const fs = await import('fs');
    fs.unlinkSync(LOCK_FILE);
  } catch { /* noop */ }
}

async function fetchPage(authToken, offset, { incrementalSince = null, retries = 4 } = {}) {
  const url = new URL(`${process.env.IRES_API_URL}/Property`);
  url.searchParams.set('$top', '100');
  url.searchParams.set('$skip', String(offset));
  if (incrementalSince) {
    // MLS Grid v2 incremental replication (docs): after initial import, query
    // ModificationTimestamp gt {last received}. Responses are ordered by
    // ModificationTimestamp by default, so paging resumes cleanly. No status
    // filter needed — status changes (incl. Sold/Withdrawn flips) bump the
    // ModificationTimestamp, so the change stream carries them.
    url.searchParams.set('$filter', `ModificationTimestamp gt ${incrementalSince}`);
  } else {
    url.searchParams.set('$filter', "(StandardStatus eq 'Active' or StandardStatus eq 'Active Under Contract' or StandardStatus eq 'Pending' or StandardStatus eq 'Withdrawn' or StandardStatus eq 'Expired')");
  }
  url.searchParams.set('$select', [...MLS_FIELDS, ...officeSelectFields()].join(','));
  url.searchParams.set('$expand', 'Media');

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'User-Agent': 'saahomes-idx/1.0 (Schwartz and Associates)',
      },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && retries > 0) {
        // Back off hard: 5s, 15s, 45s, 90s — never hammer a limited token.
        const wait = [5000, 15000, 45000, 90000][4 - retries] || 90000;
        console.log(`⚠️ IRES ${res.status} — backing off ${wait / 1000}s (${retries} left)`);
        await sleep(wait);
        return fetchPage(authToken, offset, { incrementalSince, retries: retries - 1 });
      }
      const body = await res.text();
      if (dropRejectedOfficeFields(res.status, body)) {
        // Retry without the refused field; listings keep syncing.
        return fetchPage(authToken, offset, { incrementalSince, retries });
      }
      throw new Error(`IRES fetch failed (${res.status}): ${body}`);
    }
    return res.json();
  } catch (error) {
    if (error.name === 'AbortError' && retries > 0) {
      console.log(`⚠️ IRES page timeout — retrying (${retries} left)`);
      await sleep(5000);
      return fetchPage(authToken, offset, { incrementalSince, retries: retries - 1 });
    }
    throw error;
  }
}

export async function getToken() {
  // Static token mode (MLS Grid IDX token) — no OAuth needed.
  if (process.env.IRES_ACCESS_TOKEN) {
    return process.env.IRES_ACCESS_TOKEN;
  }
  const tokenUrl = new URL('/oauth2/token', process.env.IRES_API_URL);
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.IRES_CLIENT_ID,
    client_secret: process.env.IRES_CLIENT_SECRET,
    username: process.env.IRES_USERNAME,
    password: process.env.IRES_PASSWORD,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`IRES token failed (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

// ── Incremental replication state (MLS Grid v2) ──────────────────────────
// Watermark = the greatest ModificationTimestamp we've consumed. Stored in
// the sync_state table so hourly incremental runs resume exactly where the
// previous run stopped (docs: "responses are ordered by ModificationTimestamp
// by default, allowing you to pick up where you left off").
const STATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

async function getState(pool, key) {
  await pool.query(STATE_TABLE_SQL);
  const r = await pool.query('SELECT value FROM sync_state WHERE key = $1', [key]);
  return r.rows[0]?.value || null;
}

async function setState(pool, key, value) {
  await pool.query(STATE_TABLE_SQL);
  await pool.query(
    `INSERT INTO sync_state (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

// Greatest ModificationTimestamp across a page of records (ISO-8601 sorts
// lexicographically, so max() is correct for same-format values).
function maxModificationTimestamp(records) {
  let maxTs = null;
  for (const r of records) {
    const ts = r?.ModificationTimestamp;
    if (ts && (!maxTs || String(ts) > String(maxTs))) maxTs = ts;
  }
  return maxTs;
}

const LISTING_UPSERT_SQL = `
  INSERT INTO listings (listing_id, status, is_active, property_type, property_subtype, home_type, street_number, street_name, unit,
    city, state, postal_code, county, list_price, original_list_price, beds, baths, half_baths,
    three_quarter_baths, living_area, above_grade_area, lot_size, lot_size_acres, units_total,
    year_built, garage_spaces, hoa_fee, description, assumable, photos, photos_count, latitude, longitude,
    listing_url, mls_source, elementary_school, middle_school, high_school, school_district,
    days_on_market, price_per_sqft, subdivision, features, raw, slug,
    list_office_name, list_office_mls_id, list_agent_name, list_agent_mls_id, last_seen_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,NOW())
  ON CONFLICT (listing_id) DO UPDATE SET
    status = EXCLUDED.status, is_active = EXCLUDED.is_active, property_type = EXCLUDED.property_type,
    property_subtype = EXCLUDED.property_subtype, home_type = EXCLUDED.home_type,
    street_number = EXCLUDED.street_number, street_name = EXCLUDED.street_name,
    unit = EXCLUDED.unit, city = EXCLUDED.city, state = EXCLUDED.state,
    postal_code = EXCLUDED.postal_code, county = EXCLUDED.county,
    list_price = EXCLUDED.list_price, original_list_price = EXCLUDED.original_list_price,
    beds = EXCLUDED.beds, baths = EXCLUDED.baths, half_baths = EXCLUDED.half_baths,
    three_quarter_baths = EXCLUDED.three_quarter_baths,
    living_area = EXCLUDED.living_area, above_grade_area = EXCLUDED.above_grade_area,
    lot_size = EXCLUDED.lot_size, lot_size_acres = EXCLUDED.lot_size_acres,
    units_total = EXCLUDED.units_total,
    year_built = EXCLUDED.year_built, garage_spaces = EXCLUDED.garage_spaces,
    hoa_fee = EXCLUDED.hoa_fee, description = EXCLUDED.description,
    assumable = EXCLUDED.assumable,
    -- Preserve R2-durable photo URLs: the full daily sync re-imports raw
    -- MLS signed URLs (expire ~60 min). Listings already backfilled to R2
    -- (photos[1] LIKE '%r2.dev%') must keep their permanent URLs or every
    -- 03:00 full sync undoes the backfill (Aug 13: 334/39,669 durable).
    photos = CASE WHEN listings.photos::text LIKE '%r2.dev%' THEN listings.photos ELSE EXCLUDED.photos END,
    photos_count = CASE WHEN listings.photos::text LIKE '%r2.dev%' THEN listings.photos_count ELSE EXCLUDED.photos_count END,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    listing_url = EXCLUDED.listing_url, mls_source = EXCLUDED.mls_source,
    elementary_school = EXCLUDED.elementary_school, middle_school = EXCLUDED.middle_school,
    high_school = EXCLUDED.high_school, school_district = EXCLUDED.school_district,
    days_on_market = EXCLUDED.days_on_market, price_per_sqft = EXCLUDED.price_per_sqft,
    subdivision = EXCLUDED.subdivision, features = EXCLUDED.features,
    raw = EXCLUDED.raw, slug = EXCLUDED.slug,
    list_office_name = COALESCE(EXCLUDED.list_office_name, listings.list_office_name),
    list_office_mls_id = COALESCE(EXCLUDED.list_office_mls_id, listings.list_office_mls_id),
    list_agent_name = COALESCE(EXCLUDED.list_agent_name, listings.list_agent_name),
    list_agent_mls_id = COALESCE(EXCLUDED.list_agent_mls_id, listings.list_agent_mls_id),
    updated_at = NOW(), last_seen_at = NOW()
  WHERE listings.feed = 'ires'`;

/**
 * IRES → Postgres sync.
 *
 * mode:
 *   'incremental' (default, hourly cron): pulls only records whose
 *     ModificationTimestamp gt {last watermark} — the MLS Grid v2 recommended
 *     replication pattern. Cheap: typically tens-to-hundreds of changed
 *     records vs 37K full pulls. NEVER runs the archive-unseen sweep (that
 *     would mark everything not-in-this-batch inactive).
 *   'full' (daily cron / first run / --full): pulls the whole active set and
 *     archives anything not seen (sold/expired/removed cleanup).
 */
export async function syncListings({ mode = 'incremental' } = {}) {
  const missing = ['IRES_API_URL'].filter((k) => !process.env[k]);
  if (process.env.IRES_ACCESS_TOKEN) {
    // static token mode — nothing else needed
  } else {
    missing.push(...['IRES_CLIENT_ID', 'IRES_CLIENT_SECRET', 'IRES_USERNAME', 'IRES_PASSWORD']
      .filter((k) => !process.env[k]));
  }
  if (missing.length) {
    console.log(`⏳ IRES feed not configured yet — missing: ${missing.join(', ')}`);
    return { skipped: true, missing };
  }

  const pool = getPool();
  const gotLock = await acquireLock();
  if (!gotLock) return { skipped: true, reason: 'lock' };
  const token = await getToken();

  // Full mode always runs from scratch; incremental resumes from the watermark.
  const since = mode === 'incremental' ? await getState(pool, 'ires_last_sync_ts') : null;
  if (mode === 'incremental' && !since) {
    console.log('⏳ No incremental watermark yet — running FULL initial import.');
    mode = 'full';
  }

  let offset = 0;
  let total = 0;
  let newWatermark = null;
  const seenIds = [];

  try {
    while (true) {
      await sleep(RATE_LIMIT_MS + Math.random() * 150); // pace: ≤~1.8 RPS
      const page = await fetchPage(token, offset, { incrementalSince: since });
      const records = Array.isArray(page.value) ? page.value : [];
      if (records.length === 0) break;

      const pageMaxTs = maxModificationTimestamp(records);
      if (pageMaxTs && (!newWatermark || String(pageMaxTs) > String(newWatermark))) {
        newWatermark = pageMaxTs;
      }

      for (const raw of records) {
        const l = normalizeListing(raw);
        seenIds.push(l.listing_id);
        await pool.query(
          LISTING_UPSERT_SQL,
          [l.listing_id, l.status, l.is_active, l.property_type, l.property_subtype, l.home_type,
           l.street_number, l.street_name, l.unit,
           l.city, l.state, l.postal_code, l.county, l.list_price, l.original_list_price,
           l.beds, l.baths, l.half_baths, l.three_quarter_baths, l.living_area, l.above_grade_area,
           l.lot_size, l.lot_size_acres, l.units_total,
           l.year_built, l.garage_spaces, l.hoa_fee, l.description, l.assumable,
           JSON.stringify(l.photos), l.photos_count, l.latitude, l.longitude, l.listing_url,
           l.mls_source, l.elementary_school, l.middle_school, l.high_school, l.school_district,
           l.days_on_market, l.price_per_sqft, l.subdivision, JSON.stringify(l.features),
           JSON.stringify(l.raw), l.slug,
           l.list_office_name, l.list_office_mls_id, l.list_agent_name, l.list_agent_mls_id]
        );
        total += 1;
      }
      offset += records.length;
      if (records.length < 100) break;
    }

    // Archive listings not seen — FULL mode ONLY. Incremental batches only
    // contain changed records; running this sweep there would mark the whole
    // DB inactive. (Status flips come through the change stream instead.)
    if (mode === 'full' && seenIds.length) {
      await pool.query(
        `UPDATE listings SET is_active = FALSE, status = 'Withdrawn', updated_at = NOW()
         WHERE is_active = TRUE AND feed = 'ires' AND listing_id != ALL($1::varchar[])`,
        [seenIds]
      );
    }

    // ── R2 durable-photo phase (SINGLE SOURCE — runs inside the sync lock) ──
    // Convert a bounded batch of active listings from expiring MLS signed URLs
    // to permanent Cloudflare R2 copies. Runs SEQUENTIALLY AFTER the API
    // listing sync (never concurrent with it) so MLS request rate stays inside
    // the same pacing budget. Downloads are paced by photoSync (2 RPS max) and
    // routed through the /api/photo proxy (rate-limited). This replaces the
    // old separate box cron (idx-photos-r2-backfill) — one process owns MLS.
    // No-op when R2 is not configured on this host (photoSync exits gracefully).
    const R2_BATCH = parseInt(process.env.R2_BACKFILL_PER_SYNC || '150', 10);
    let r2Done = 0, r2Photos = 0;
    try {
      const base = (process.env.R2_PUBLIC_URL || '').replace(/^https?:\/\//, '');
      const c = await pool.query(
        `SELECT id, listing_id, slug, photos FROM listings
         WHERE is_active AND feed = 'ires' AND photos::text <> '[]' AND NOT (photos::text LIKE $1)
         ORDER BY updated_at DESC LIMIT $2`,
        [base ? `%${base}%` : '%r2.dev%', R2_BATCH]
      );
      for (const row of c.rows) {
        if (isR2Hosted(row.photos || [])) continue;
        const newUrls = await syncListingPhotos(row, row.photos || []);
        if (newUrls && newUrls.length) {
          await pool.query(
            `UPDATE listings SET photos = $1, photos_count = $2, updated_at = NOW() WHERE id = $3`,
            [JSON.stringify(newUrls), newUrls.length, row.id]
          );
          r2Photos += newUrls.length;
        }
        r2Done += 1;
      }
      if (r2Done > 0) {
        console.log(`🖼️ R2 durable-photo phase: ${r2Done} listings → ${r2Photos} photos (batch ${R2_BATCH})`);
      }
    } catch (e) {
      console.error(`🖼️ R2 durable-photo phase FAILED (non-fatal): ${e.message}`);
    }

    // Persist the watermark for incremental runs. Only advance when we
    // actually consumed records (so a failed/empty run can't skip data).
    // Also persists after the first-run FULL fallback — otherwise the next
    // hourly run would re-import everything (no watermark → full again).
    if (newWatermark) {
      await setState(pool, 'ires_last_sync_ts', newWatermark);
    }

    console.log(`✅ IRES sync complete (${mode}): ${total} listings processed, ${seenIds.length} unique${since ? `, since ${since}` : ''}${r2Done ? `, ${r2Done} R2 photo listings` : ''}`);
    return { mode, total, unique: seenIds.length, r2PhotoListings: r2Done };
  } finally {
    await releaseLock();
  }
}

// Direct run: node backend/src/services/iresSync.js [--incremental|--full]
const isDirectRun = process.argv[1]?.includes('iresSync.js');
if (isDirectRun) {
  const mode = process.argv.includes('--full') ? 'full' : 'incremental';
  syncListings({ mode })
    .then((r) => process.exit(r.skipped ? 0 : 0))
    .catch((e) => { console.error('❌ Sync failed:', e.message); process.exit(1); });
}
