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
  'ListingKey', 'ListingId', 'StandardStatus', 'PropertyType',
  'StreetNumber', 'StreetName', 'UnitNumber', 'City', 'StateOrProvince',
  'PostalCode', 'CountyOrParish', 'ListPrice', 'BedroomsTotal',
  'BathroomsTotalInteger', 'BathroomsFull', 'LivingArea', 'LotSizeArea',
  'YearBuilt', 'GarageSpaces', 'AssociationFee', 'PublicRemarks',
  'Latitude', 'Longitude',
];

const STATUS_MAP = {
  Active: 'Active',
  Pending: 'Pending',
  Contingent: 'Pending',
  Closed: 'Sold',
  Sold: 'Sold',
  Expired: 'Expired',
  Withdrawn: 'Withdrawn',
  OffMarket: 'Withdrawn',
};

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

  const slugBase = `${street || 'home'} ${city} ${state} ${raw.ListPrice || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return {
    listing_id: String(raw.ListingId || raw.ListingKey),
    status: STATUS_MAP[raw.StandardStatus] || String(raw.StandardStatus || 'Active'),
    property_type: raw.PropertyType || null,
    street_number: raw.StreetNumber ? String(raw.StreetNumber) : null,
    street_name: raw.StreetName || null,
    unit: raw.UnitNumber ? String(raw.UnitNumber) : null,
    city,
    state,
    postal_code: raw.PostalCode ? String(raw.PostalCode) : null,
    county: raw.CountyOrParish || null,
    list_price: num(raw.ListPrice, 1e9),
    beds: num(raw.BedroomsTotal, 100),
    baths: num(raw.BathroomsTotalInteger, 50) ?? num(raw.BathroomsFull, 50),
    living_area: num(raw.LivingArea, 1e7),
    lot_size: num(raw.LotSizeArea, 1e12),
    year_built: num(raw.YearBuilt, 2100),
    garage_spaces: num(raw.GarageSpaces, 100),
    hoa_fee: num(raw.AssociationFee, 1e6),
    description: raw.PublicRemarks || null,
    photos,
    latitude: num(raw.Latitude, 90),
    longitude: num(raw.Longitude, 180),
    listing_url: null,
    mls_source: 'IRES',
    raw,
    slug: `${slugBase}-${String(raw.ListingId || raw.ListingKey).slice(-6)}`,
  };
}

async function fetchPage(authToken, offset) {
  const url = new URL(`${process.env.IRES_API_URL}/Property`);
  url.searchParams.set('$top', '100');
  url.searchParams.set('$skip', String(offset));
  url.searchParams.set('$filter', "StandardStatus eq 'Active'");
  url.searchParams.set('$select', MLS_FIELDS.join(','));
  url.searchParams.set('$expand', 'Media');

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
    throw new Error(`IRES fetch failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
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

export async function syncListings() {
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
  const token = await getToken();

  let offset = 0;
  let total = 0;
  const seenIds = [];

  while (true) {
    const page = await fetchPage(token, offset);
    const records = Array.isArray(page.value) ? page.value : [];
    if (records.length === 0) break;

    for (const raw of records) {
      const l = normalizeListing(raw);
      seenIds.push(l.listing_id);
      await pool.query(
        `INSERT INTO listings (listing_id, status, property_type, street_number, street_name, unit,
           city, state, postal_code, county, list_price, beds, baths, living_area, lot_size,
           year_built, garage_spaces, hoa_fee, description, photos, latitude, longitude,
           listing_url, mls_source, raw, slug, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,NOW())
         ON CONFLICT (listing_id) DO UPDATE SET
           status = EXCLUDED.status, property_type = EXCLUDED.property_type,
           street_number = EXCLUDED.street_number, street_name = EXCLUDED.street_name,
           unit = EXCLUDED.unit, city = EXCLUDED.city, state = EXCLUDED.state,
           postal_code = EXCLUDED.postal_code, county = EXCLUDED.county,
           list_price = EXCLUDED.list_price, beds = EXCLUDED.beds, baths = EXCLUDED.baths,
           living_area = EXCLUDED.living_area, lot_size = EXCLUDED.lot_size,
           year_built = EXCLUDED.year_built, garage_spaces = EXCLUDED.garage_spaces,
           hoa_fee = EXCLUDED.hoa_fee, description = EXCLUDED.description,
           photos = EXCLUDED.photos, latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude, listing_url = EXCLUDED.listing_url,
           mls_source = EXCLUDED.mls_source, raw = EXCLUDED.raw, slug = EXCLUDED.slug,
           is_active = TRUE, updated_at = NOW(), last_seen_at = NOW()`,
        [l.listing_id, l.status, l.property_type, l.street_number, l.street_name, l.unit,
         l.city, l.state, l.postal_code, l.county, l.list_price, l.beds, l.baths, l.living_area,
         l.lot_size, l.year_built, l.garage_spaces, l.hoa_fee, l.description,
         JSON.stringify(l.photos), l.latitude, l.longitude, l.listing_url,
         l.mls_source, JSON.stringify(l.raw), l.slug]
      );
      total += 1;
    }
    offset += records.length;
    if (records.length < 100) break;
  }

  // Archive listings not seen in this sync (sold/expired/removed)
  if (seenIds.length) {
    await pool.query(
      `UPDATE listings SET is_active = FALSE, status = 'Withdrawn', updated_at = NOW()
       WHERE is_active = TRUE AND listing_id != ALL($1::varchar[])`,
      [seenIds]
    );
  }

  console.log(`✅ IRES sync complete: ${total} active listings processed, ${seenIds.length} unique`);
  return { total, unique: seenIds.length };
}

// Direct run: node backend/src/services/iresSync.js
const isDirectRun = process.argv[1]?.includes('iresSync.js');
if (isDirectRun) {
  syncListings()
    .then((r) => process.exit(r.skipped ? 0 : 0))
    .catch((e) => { console.error('❌ Sync failed:', e.message); process.exit(1); });
}
