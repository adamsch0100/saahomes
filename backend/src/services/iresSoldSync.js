import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import getPool from '../config/database.js';
import { isNocoCity } from '../config/nocoCities.js';

/**
 * IRES sold/closed ingest — MLS Grid RESO Web API.
 *
 * Separate from the live listing sync (iresSync.js). Own lock file, own
 * watermark, own ≤1.2 RPS pacing. Never stacked with the listing sync.
 *
 * Feed verification 2026-08-13 (live MLS Grid, IRES token):
 *   - StandardStatus eq 'Closed' returns rows (200). 'Sold' is NOT a valid enum.
 *   - ClosePrice (number) + CloseDate (YYYY-MM-DD) are present on Closed rows.
 *   - Replication $filter allows ONLY: MlgCanView, ModificationTimestamp,
 *     OriginatingSystemName, StandardStatus, ListingId, PropertyType, ListOfficeMlsId.
 *     City and CloseDate are illegal filter fields — applied client-side.
 *   - 12-month window: ModificationTimestamp ge {cutoff} + CloseDate client filter.
 *
 * Runs via: npm run sync-sold-listings
 *   --full          12-month ModificationTimestamp window from scratch
 *   --since=ISO     override incremental start
 *   --max-pages=N   safety cap (scheduled default 250)
 */

const SOLD_FIELDS = [
  'ListingKey', 'ListingId', 'StandardStatus', 'MlsStatus', 'PropertyType', 'PropertySubType',
  'StreetNumber', 'StreetName', 'StreetDirPrefix', 'StreetDirSuffix', 'StreetSuffix',
  'UnitNumber', 'City', 'StateOrProvince', 'PostalCode', 'CountyOrParish',
  'ListPrice', 'OriginalListPrice', 'ClosePrice', 'CloseDate', 'DaysOnMarket',
  'BedroomsTotal', 'BathroomsTotalInteger', 'BathroomsFull', 'LivingArea',
  'BuildingAreaTotal', 'LotSizeArea', 'LotSizeAcres',
  'Latitude', 'Longitude', 'PhotosCount', 'ParcelNumber', 'SubdivisionName',
  'ElementarySchool', 'MiddleOrJuniorSchool', 'HighSchool', 'HighSchoolDistrict',
  'ModificationTimestamp', 'ListingContractDate', 'OriginatingSystemName',
  'PropertyAttachedYN', 'MlgCanView',
];

// Slightly slower than listing sync (700ms) — leave photo-proxy headroom.
const RATE_LIMIT_MS = 850;
const LOCK_FILE = '/tmp/ires-sold-sync.lock';
const LISTING_LOCK_FILE = '/tmp/ires-sync.lock';
const DEFAULT_MAX_PAGES = 250;
const WATERMARK_KEY = 'ires_sold_last_sync_ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function classifyHomeType(propertyType, subtype, attachedYn) {
  const s = (subtype || '').toLowerCase();
  const t = (propertyType || '').toLowerCase();
  if (t.includes('land') || s.includes('land') || s.includes('unimproved')) return 'land';
  if (t.includes('commercial') || ['office', 'warehouse', 'retail', 'industrial', 'mixed use', 'mixed-use'].includes(s)) return 'commercial';
  if (attachedYn === true || attachedYn === 'Y') return 'attached';
  if (s.includes('condo') || s.includes('town') || s.includes('attached') ||
      s.includes('duplex') || s.includes('triplex') || s.includes('multi family') ||
      s.includes('timeshare') || t.includes('residential income') || t.includes('condominium')) return 'attached';
  if (s.includes('single family') || s.includes('detached') || s.includes('cabin') ||
      s.includes('farm') || s.includes('manufactured on land') || s === '') return 'detached';
  return 'other';
}

function twelveMonthsAgoIso() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString();
}

function twelveMonthsAgoDate() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildSoldFilter({ incrementalSince = null } = {}) {
  // 'Sold' is not a valid StandardStatus on this feed (400, verified 2026-08-13).
  const status = "StandardStatus eq 'Closed'";
  const types = "(PropertyType eq 'Residential' or PropertyType eq 'Residential Income')";
  const since = incrementalSince || twelveMonthsAgoIso();
  return `${status} and ${types} and ModificationTimestamp ge ${since}`;
}

function listingLockActive() {
  try {
    if (!existsSync(LISTING_LOCK_FILE)) return false;
    const info = JSON.parse(readFileSync(LISTING_LOCK_FILE, 'utf8'));
    const ageMin = (Date.now() - (info.at || 0)) / 60000;
    return ageMin < 90;
  } catch {
    return false;
  }
}

async function acquireLock() {
  try {
    if (listingLockActive()) {
      console.log('⏳ Live listing sync lock is held — skipping sold sync (rate-limit headroom).');
      return false;
    }
    if (existsSync(LOCK_FILE)) {
      const info = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
      const ageMin = (Date.now() - (info.at || 0)) / 60000;
      if (ageMin < 90) {
        console.log(`⏳ Another sold sync is already running (pid ${info.pid}, started ${Math.round(ageMin)}m ago) — skipping.`);
        return false;
      }
      console.log('⚠️ Stale sold-sync lock detected — taking over.');
    }
    writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: Date.now() }));
    return true;
  } catch {
    return true;
  }
}

async function releaseLock() {
  try {
    unlinkSync(LOCK_FILE);
  } catch { /* noop */ }
}

async function fetchSoldPage(authToken, offset, { incrementalSince = null, retries = 4 } = {}) {
  const url = new URL(`${process.env.IRES_API_URL}/Property`);
  url.searchParams.set('$top', '100');
  url.searchParams.set('$skip', String(offset));
  url.searchParams.set('$filter', buildSoldFilter({ incrementalSince }));
  url.searchParams.set('$select', SOLD_FIELDS.join(','));
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
        const wait = [5000, 15000, 45000, 90000][4 - retries] || 90000;
        console.log(`⚠️ IRES sold ${res.status} — backing off ${wait / 1000}s (${retries} left)`);
        await sleep(wait);
        return fetchSoldPage(authToken, offset, { incrementalSince, retries: retries - 1 });
      }
      throw new Error(`IRES sold fetch failed (${res.status}): ${await res.text()}`);
    }
    return res.json();
  } catch (error) {
    if (error.name === 'AbortError' && retries > 0) {
      console.log(`⚠️ IRES sold page timeout — retrying (${retries} left)`);
      await sleep(5000);
      return fetchSoldPage(authToken, offset, { incrementalSince, retries: retries - 1 });
    }
    throw error;
  }
}

async function getToken() {
  if (process.env.IRES_ACCESS_TOKEN) return process.env.IRES_ACCESS_TOKEN;
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

function maxModificationTimestamp(records) {
  let maxTs = null;
  for (const r of records) {
    const ts = r?.ModificationTimestamp;
    if (ts && (!maxTs || String(ts) > String(maxTs))) maxTs = ts;
  }
  return maxTs;
}

function extractPhotos(raw) {
  const media = Array.isArray(raw.Media) ? raw.Media : [];
  return media
    .filter((m) => typeof m?.MediaURL === 'string' && /\.(jpe?g|png|webp)(\?|$)/i.test(m.MediaURL))
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL)
    .filter(Boolean);
}

function normalizeSold(raw) {
  const num = (v, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  };
  const numSigned = (v, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 && Math.abs(n) <= max ? n : null;
  };

  const streetName = [raw.StreetDirPrefix, raw.StreetName, raw.StreetSuffix, raw.StreetDirSuffix]
    .filter(Boolean)
    .join(' ') || null;
  const streetNumber = raw.StreetNumber ? String(raw.StreetNumber) : null;
  const unit = raw.UnitNumber ? String(raw.UnitNumber) : null;
  const address = [streetNumber, streetName, unit ? `#${unit}` : null].filter(Boolean).join(' ') || null;
  const livingArea = num(raw.LivingArea, 1e7) ?? num(raw.BuildingAreaTotal, 1e7);
  const photos = extractPhotos(raw);

  // ClosePrice / CloseDate only — never invent a sold price or date.
  const soldPrice = num(raw.ClosePrice, 1e9);
  const closedDate = raw.CloseDate ? String(raw.CloseDate).slice(0, 10) : null;

  return {
    listing_id: String(raw.ListingId || raw.ListingKey || ''),
    mls_source: raw.OriginatingSystemName || 'IRES',
    city: raw.City || null,
    county: raw.CountyOrParish || null,
    street_number: streetNumber,
    street_name: streetName,
    unit,
    address,
    postal_code: raw.PostalCode ? String(raw.PostalCode) : null,
    lat: numSigned(raw.Latitude, 90),
    lng: numSigned(raw.Longitude, 180),
    property_type: raw.PropertyType || null,
    home_type: classifyHomeType(raw.PropertyType, raw.PropertySubType, raw.PropertyAttachedYN),
    beds: num(raw.BedroomsTotal, 100),
    baths: num(raw.BathroomsTotalInteger, 50) ?? num(raw.BathroomsFull, 50),
    living_area: livingArea,
    lot_size: num(raw.LotSizeArea, 1e12),
    list_price: num(raw.ListPrice, 1e9),
    sold_price: soldPrice,
    closed_date: closedDate,
    days_on_market: num(raw.DaysOnMarket, 10000),
    parcel_number: raw.ParcelNumber || null,
    subdivision: raw.SubdivisionName || null,
    elementary_school: raw.ElementarySchool || null,
    middle_school: raw.MiddleOrJuniorSchool || null,
    high_school: raw.HighSchool || null,
    school_district: raw.HighSchoolDistrict || null,
    photos,
    photos_count: num(raw.PhotosCount, 500) ?? photos.length,
    modification_timestamp: raw.ModificationTimestamp || null,
    mlg_can_view: raw.MlgCanView,
  };
}

function shouldKeep(row) {
  if (!row.listing_id) return false;
  if (row.mlg_can_view === false || String(row.mlg_can_view).toLowerCase() === 'false') return false;
  if (!isNocoCity(row.city)) return false;
  if (!row.closed_date) return false;
  const closed = new Date(`${row.closed_date}T00:00:00Z`);
  if (Number.isNaN(closed.getTime()) || closed < twelveMonthsAgoDate()) return false;
  // A row with neither price nor date is useless; date is required above.
  // Price may be null — API / UI will omit the dollar figure rather than invent one.
  return true;
}

const SOLD_UPSERT_SQL = `
  INSERT INTO sold_listings (
    listing_id, mls_source, city, county, street_number, street_name, unit, address,
    postal_code, lat, lng, property_type, home_type, beds, baths, living_area, lot_size,
    list_price, sold_price, closed_date, days_on_market, parcel_number, subdivision,
    elementary_school, middle_school, high_school, school_district,
    photos, photos_count, modification_timestamp, updated_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
    $24,$25,$26,$27,$28,$29,$30,NOW()
  )
  ON CONFLICT (listing_id) DO UPDATE SET
    mls_source = EXCLUDED.mls_source,
    city = EXCLUDED.city,
    county = EXCLUDED.county,
    street_number = EXCLUDED.street_number,
    street_name = EXCLUDED.street_name,
    unit = EXCLUDED.unit,
    address = EXCLUDED.address,
    postal_code = EXCLUDED.postal_code,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    property_type = EXCLUDED.property_type,
    home_type = EXCLUDED.home_type,
    beds = EXCLUDED.beds,
    baths = EXCLUDED.baths,
    living_area = EXCLUDED.living_area,
    lot_size = EXCLUDED.lot_size,
    list_price = EXCLUDED.list_price,
    sold_price = EXCLUDED.sold_price,
    closed_date = EXCLUDED.closed_date,
    days_on_market = EXCLUDED.days_on_market,
    parcel_number = EXCLUDED.parcel_number,
    subdivision = EXCLUDED.subdivision,
    elementary_school = EXCLUDED.elementary_school,
    middle_school = EXCLUDED.middle_school,
    high_school = EXCLUDED.high_school,
    school_district = EXCLUDED.school_district,
    photos = CASE WHEN sold_listings.photos::text LIKE '%r2.dev%' THEN sold_listings.photos ELSE EXCLUDED.photos END,
    photos_count = CASE WHEN sold_listings.photos::text LIKE '%r2.dev%' THEN sold_listings.photos_count ELSE EXCLUDED.photos_count END,
    modification_timestamp = EXCLUDED.modification_timestamp,
    updated_at = NOW()`;

/**
 * mode:
 *   'incremental' — ModificationTimestamp ge {watermark or 12 months}
 *   'full'        — ignore watermark, 12-month ModificationTimestamp window
 */
export async function syncSoldListings({
  mode = 'incremental',
  since: sinceOverride = null,
  maxPages = DEFAULT_MAX_PAGES,
} = {}) {
  const missing = ['IRES_API_URL'].filter((k) => !process.env[k]);
  if (!process.env.IRES_ACCESS_TOKEN) {
    missing.push(...['IRES_CLIENT_ID', 'IRES_CLIENT_SECRET', 'IRES_USERNAME', 'IRES_PASSWORD']
      .filter((k) => !process.env[k]));
  }
  if (missing.length) {
    console.log(`⏳ IRES sold feed not configured yet — missing: ${missing.join(', ')}`);
    return { skipped: true, missing };
  }

  const pool = getPool();
  const gotLock = await acquireLock();
  if (!gotLock) return { skipped: true, reason: 'lock' };
  const token = await getToken();

  let since = sinceOverride;
  if (!since && mode === 'incremental') {
    since = await getState(pool, WATERMARK_KEY);
  }
  if (mode === 'full') since = sinceOverride || twelveMonthsAgoIso();

  let offset = 0;
  let scanned = 0;
  let kept = 0;
  let pages = 0;
  let newWatermark = since || null;

  try {
    while (pages < maxPages) {
      await sleep(RATE_LIMIT_MS + Math.random() * 150);
      const page = await fetchSoldPage(token, offset, { incrementalSince: since });
      const records = Array.isArray(page.value) ? page.value : [];
      if (records.length === 0) break;

      const pageMaxTs = maxModificationTimestamp(records);
      if (pageMaxTs && (!newWatermark || String(pageMaxTs) > String(newWatermark))) {
        newWatermark = pageMaxTs;
      }

      for (const raw of records) {
        scanned += 1;
        const row = normalizeSold(raw);
        if (!shouldKeep(row)) continue;
        await pool.query(SOLD_UPSERT_SQL, [
          row.listing_id, row.mls_source, row.city, row.county,
          row.street_number, row.street_name, row.unit, row.address,
          row.postal_code, row.lat, row.lng, row.property_type, row.home_type,
          row.beds, row.baths, row.living_area, row.lot_size,
          row.list_price, row.sold_price, row.closed_date, row.days_on_market,
          row.parcel_number, row.subdivision,
          row.elementary_school, row.middle_school, row.high_school, row.school_district,
          JSON.stringify(row.photos), row.photos_count, row.modification_timestamp,
        ]);
        kept += 1;
      }

      offset += records.length;
      pages += 1;
      if (records.length < 100) break;
    }

    if (newWatermark) {
      await setState(pool, WATERMARK_KEY, newWatermark);
    }

    const hitCap = pages >= maxPages;
    console.log(
      `✅ IRES sold sync complete (${mode}): scanned ${scanned}, kept ${kept} NoCO/12mo, ${pages} pages` +
      `${since ? `, since ${since}` : ''}${hitCap ? `, hit max-pages=${maxPages}` : ''}`
    );
    return { mode, scanned, kept, pages, watermark: newWatermark, hitCap };
  } finally {
    await releaseLock();
  }
}

const isDirectRun = process.argv[1]?.includes('iresSoldSync.js');
if (isDirectRun) {
  const mode = process.argv.includes('--full') ? 'full' : 'incremental';
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const pagesArg = process.argv.find((a) => a.startsWith('--max-pages='));
  const since = sinceArg ? sinceArg.slice('--since='.length) : null;
  const maxPages = pagesArg ? Math.max(1, parseInt(pagesArg.slice('--max-pages='.length), 10) || DEFAULT_MAX_PAGES) : DEFAULT_MAX_PAGES;
  syncSoldListings({ mode, since, maxPages })
    .then(() => process.exit(0))
    .catch((e) => { console.error('❌ Sold sync failed:', e.message); process.exit(1); });
}
