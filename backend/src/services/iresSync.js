import getPool from '../config/database.js';

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

// Adam's home-type model (Aug 2026): attached = condos/townhomes/multi-unit,
// detached = freestanding homes. PropertyAttachedYN is the feed's definitive
// flag; PropertySubType carries the label.
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

const STATUS_MAP = {
  Active: 'Active',
  'Active Under Contract': 'Active Under Contract', // backup offers accepted
  Pending: 'Pending',
  Contingent: 'Pending',
  Closed: 'Sold',
  Sold: 'Sold',
  Expired: 'Expired',
  Withdrawn: 'Withdrawn',
  OffMarket: 'Withdrawn',
  Canceled: 'Canceled',
};

// Statuses shown as "listed" in search (is_active=TRUE). Sold/Withdrawn/
// Expired/Canceled are archived (is_active=FALSE but still stored).
const LISTED_STATUSES = new Set(['Active', 'Active Under Contract', 'Pending']);

function normalizeListing(raw) {
  const media = Array.isArray(raw.Media) ? raw.Media : [];
  const photos = media
    .filter((m) => typeof m?.MediaURL === 'string' && /\.(jpe?g|png|webp)(\?|$)/i.test(m.MediaURL))
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL)
    .filter(Boolean);

  const street = [raw.StreetNumber, raw.StreetName].filter(Boolean).join(' ');
  const city = raw.City || '';
  const state = raw.StateOrProvince || 'CO';

  // Data sanitization: MLS feeds contain garbage values (e.g. HOA fee $9.7B).
  // Store null rather than absurd numbers — never ship junk to the site.
  const num = (v, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  };
  // Signed variant for coordinates — Colorado longitudes are negative (-105°).
  const numSigned = (v, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 && Math.abs(n) <= max ? n : null;
  };

  const slugBase = `${street || 'home'} ${city} ${state} ${raw.ListPrice || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const livingArea = num(raw.LivingArea, 1e7) ?? num(raw.BuildingAreaTotal, 1e7);
  const listPrice = num(raw.ListPrice, 1e9);
  const originalPrice = num(raw.OriginalListPrice, 1e9);
  const str = (v) => (Array.isArray(v) ? v.join(', ') : v);
  const yn = (v) => v === 'Y' || v === true || v === 'Yes';
  const features = {
    style: str(raw.ArchitecturalStyle) || null,
    levels: str(raw.Levels) || null,
    structure_type: str(raw.StructureType) || null,
    basement: str(raw.Basement) || null,
    construction: str(raw.ConstructionMaterials) || null,
    roof: str(raw.Roof) || null,
    interior: str(raw.InteriorFeatures) || null,
    exterior: str(raw.ExteriorFeatures) || null,
    appliances: str(raw.Appliances) || null,
    flooring: str(raw.Flooring) || null,
    cooling: str(raw.Cooling) || null,
    heating: str(raw.Heating) || null,
    fireplaces: str(raw.FireplaceFeatures) || null,
    pool: str(raw.PoolFeatures) || yn(raw.PoolFeatures) || null,
    spa: str(raw.SpaFeatures) || null,
    parking: str(raw.ParkingFeatures) || null,
    parking_total: raw.ParkingTotal != null ? String(raw.ParkingTotal) : null,
    other_parking: str(raw.OtherParking) || null,
    fencing: str(raw.Fencing) || null,
    patio: str(raw.PatioAndPorchFeatures) || null,
    windows: str(raw.WindowFeatures) || null,
    security: str(raw.SecurityFeatures) || null,
    doors: str(raw.DoorFeatures) || null,
    electric: str(raw.Electric) || null,
    laundry: str(raw.LaundryFeatures) || null,
    other_equipment: str(raw.OtherEquipment) || null,
    other_structures: str(raw.OtherStructures) || null,
    pets: str(raw.PetsAllowed) || null,
    view: str(raw.View) || null,
    waterfront: yn(raw.WaterfrontYN),
    water_body: raw.WaterBodyName || null,
    horse: str(raw.HorseAmenities) || null,
    irrigation: str(raw.IrrigationSource) || null,
    irrigation_rights: yn(raw.IrrigationWaterRightsYN),
    sewer: str(raw.Sewer) || null,
    water_source: str(raw.WaterSource) || null,
    utilities: str(raw.Utilities) || null,
    zoning: str(raw.Zoning) || null,
    lot_features: str(raw.LotFeatures) || null,
    directions: raw.Directions || null,
    disclosures: str(raw.Disclosures) || null,
    association: yn(raw.AssociationYN),
    association_name: raw.AssociationName || null,
    association_includes: str(raw.AssociationFeeIncludes) || null,
    association_phone: raw.AssociationPhone || null,
    assoc_fee_freq: raw.AssociationFeeFrequency || null,
    builder: raw.BuilderName || null,
    builder_model: raw.BuilderModel || null,
    new_construction: yn(raw.NewConstructionYN),
    green_efficient: str(raw.GreenEnergyEfficient) || null,
    green_verification: str(raw.GreenBuildingVerificationType) || null,
    accessibility: str(raw.AccessibilityFeatures) || null,
    community: str(raw.CommunityFeatures) || null,
    tax_annual: num(raw.TaxAnnualAmount, 1e8),
    tax_year: num(raw.TaxYear, 2100),
    parcel: raw.ParcelNumber || null,
    listing_terms: str(raw.ListingTerms) || null,
    special_conditions: str(raw.SpecialListingConditions) || null,
    availability: raw.AvailabilityDate || null,
    subdivision: raw.SubdivisionName || null,
    mls_area: [raw.MLSAreaMajor, raw.MLSAreaMinor].filter(Boolean).join(' / ') || null,
    virtual_tour: raw.VirtualTourURLUnbranded || null,
  };

  return {
    listing_id: String(raw.ListingId || raw.ListingKey),
    status: STATUS_MAP[raw.StandardStatus] || String(raw.StandardStatus || 'Active'),
    // MlgCanView=false (docs: "record must be removed from your local data
    // store") → force archived so we never display a listing we're not
    // licensed to show. True/absent → normal status logic.
    is_active: (raw.MlgCanView === false || String(raw.MlgCanView).toLowerCase() === 'false')
      ? false
      : LISTED_STATUSES.has(STATUS_MAP[raw.StandardStatus] || String(raw.StandardStatus || 'Active')),
    modification_timestamp: raw.ModificationTimestamp || null,
    photos_change_timestamp: raw.PhotosChangeTimestamp || null,
    property_type: raw.PropertyType || null,
    property_subtype: raw.PropertySubType || null,
    home_type: classifyHomeType(raw.PropertyType, raw.PropertySubType, raw.PropertyAttachedYN),
    street_number: raw.StreetNumber ? String(raw.StreetNumber) : null,
    street_name: [raw.StreetDirPrefix, raw.StreetName, raw.StreetSuffix, raw.StreetDirSuffix].filter(Boolean).join(' ') || null,
    unit: raw.UnitNumber ? String(raw.UnitNumber) : null,
    city,
    state,
    postal_code: raw.PostalCode ? String(raw.PostalCode) : null,
    county: raw.CountyOrParish || null,
    list_price: listPrice,
    original_list_price: originalPrice,
    price_change_timestamp: raw.PriceChangeTimestamp || null,
    beds: num(raw.BedroomsTotal, 100),
    baths: num(raw.BathroomsTotalInteger, 50) ?? num(raw.BathroomsFull, 50),
    half_baths: num(raw.BathroomsHalf, 50),
    three_quarter_baths: num(raw.BathroomsThreeQuarter, 50),
    living_area: livingArea,
    above_grade_area: num(raw.AboveGradeFinishedArea, 1e7),
    lot_size: num(raw.LotSizeArea, 1e12),
    lot_size_acres: num(raw.LotSizeAcres, 1e6),
    units_total: num(raw.NumberOfUnitsTotal, 1000),
    year_built: num(raw.YearBuilt, 2100),
    garage_spaces: num(raw.GarageSpaces, 100),
    hoa_fee: num(raw.AssociationFee, 1e6),
    description: raw.PublicRemarks || null,
    photos,
    photos_count: num(raw.PhotosCount, 500) ?? photos.length,
    latitude: numSigned(raw.Latitude, 90),
    longitude: numSigned(raw.Longitude, 180),
    listing_url: null,
    mls_source: raw.OriginatingSystemName || 'IRES',
    elementary_school: raw.ElementarySchool || null,
    middle_school: raw.MiddleOrJuniorSchool || null,
    high_school: raw.HighSchool || null,
    school_district: raw.HighSchoolDistrict || null,
    days_on_market: num(raw.DaysOnMarket, 10000),
    price_per_sqft: livingArea && listPrice ? Math.round(listPrice / livingArea) : null,
    subdivision: raw.SubdivisionName || null,
    features,
    raw,
    slug: `${slugBase}-${String(raw.ListingId || raw.ListingKey).slice(-6)}`,
  };
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
  url.searchParams.set('$select', MLS_FIELDS.join(','));
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
        return fetchPage(authToken, offset, retries - 1);
      }
      throw new Error(`IRES fetch failed (${res.status}): ${await res.text()}`);
    }
    return res.json();
  } catch (error) {
    if (error.name === 'AbortError' && retries > 0) {
      console.log(`⚠️ IRES page timeout — retrying (${retries} left)`);
      await sleep(5000);
      return fetchPage(authToken, offset, retries - 1);
    }
    throw error;
  }
}

async function getToken() {
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
    year_built, garage_spaces, hoa_fee, description, photos, photos_count, latitude, longitude,
    listing_url, mls_source, elementary_school, middle_school, high_school, school_district,
    days_on_market, price_per_sqft, subdivision, features, raw, slug, last_seen_at)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,NOW())
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
    photos = EXCLUDED.photos, photos_count = EXCLUDED.photos_count,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    listing_url = EXCLUDED.listing_url, mls_source = EXCLUDED.mls_source,
    elementary_school = EXCLUDED.elementary_school, middle_school = EXCLUDED.middle_school,
    high_school = EXCLUDED.high_school, school_district = EXCLUDED.school_district,
    days_on_market = EXCLUDED.days_on_market, price_per_sqft = EXCLUDED.price_per_sqft,
    subdivision = EXCLUDED.subdivision, features = EXCLUDED.features,
    raw = EXCLUDED.raw, slug = EXCLUDED.slug,
    updated_at = NOW(), last_seen_at = NOW()`;

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
           l.year_built, l.garage_spaces, l.hoa_fee, l.description,
           JSON.stringify(l.photos), l.photos_count, l.latitude, l.longitude, l.listing_url,
           l.mls_source, l.elementary_school, l.middle_school, l.high_school, l.school_district,
           l.days_on_market, l.price_per_sqft, l.subdivision, JSON.stringify(l.features),
           JSON.stringify(l.raw), l.slug]
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
         WHERE is_active = TRUE AND listing_id != ALL($1::varchar[])`,
        [seenIds]
      );
    }

    // Persist the watermark for incremental runs. Only advance when we
    // actually consumed records (so a failed/empty run can't skip data).
    // Also persists after the first-run FULL fallback — otherwise the next
    // hourly run would re-import everything (no watermark → full again).
    if (newWatermark) {
      await setState(pool, 'ires_last_sync_ts', newWatermark);
    }

    console.log(`✅ IRES sync complete (${mode}): ${total} listings processed, ${seenIds.length} unique${since ? `, since ${since}` : ''}`);
    return { mode, total, unique: seenIds.length };
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
