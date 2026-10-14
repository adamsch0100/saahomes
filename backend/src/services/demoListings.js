/**
 * Sample homes for a brokerage whose MLS hasn't approved its site yet.
 *
 * About fifty made-up homes for sale and two dozen made-up sales along the
 * Colorado Front Range, stored with feed = 'demo' so they only ever show on a
 * brokerage in demo mode (never on SAA, never next to real IRES listings).
 * Every one is labeled "Sample listing" wherever it appears. Photos are
 * simple drawn houses served by the photo proxy, never real pictures.
 *
 * seedDemoListings() runs with the migrations on every start and is
 * idempotent: same ids, same homes, dates kept fresh.
 */
import getPool from '../config/database.js';

export const DEMO_FEED = 'demo';
export const DEMO_PHOTO_PREFIX = 'demo:';

// Town, county, ZIP and a center point to scatter homes around.
const TOWNS = [
  { city: 'Fort Collins', county: 'Larimer', zip: '80525', lat: 40.5600, lng: -105.0600, ppsf: 285 },
  { city: 'Fort Collins', county: 'Larimer', zip: '80521', lat: 40.5850, lng: -105.1000, ppsf: 300 },
  { city: 'Loveland', county: 'Larimer', zip: '80538', lat: 40.4200, lng: -105.0700, ppsf: 255 },
  { city: 'Windsor', county: 'Weld', zip: '80550', lat: 40.4780, lng: -104.9010, ppsf: 260 },
  { city: 'Greeley', county: 'Weld', zip: '80634', lat: 40.4100, lng: -104.7600, ppsf: 220 },
  { city: 'Longmont', county: 'Boulder', zip: '80503', lat: 40.1900, lng: -105.1300, ppsf: 300 },
  { city: 'Boulder', county: 'Boulder', zip: '80304', lat: 40.0350, lng: -105.2700, ppsf: 520 },
  { city: 'Lafayette', county: 'Boulder', zip: '80026', lat: 39.9950, lng: -105.0900, ppsf: 340 },
  { city: 'Erie', county: 'Weld', zip: '80516', lat: 40.0400, lng: -105.0500, ppsf: 310 },
  { city: 'Broomfield', county: 'Broomfield', zip: '80023', lat: 39.9600, lng: -105.0300, ppsf: 320 },
  { city: 'Westminster', county: 'Adams', zip: '80031', lat: 39.8800, lng: -105.0400, ppsf: 290 },
  { city: 'Arvada', county: 'Jefferson', zip: '80005', lat: 39.8300, lng: -105.1100, ppsf: 310 },
  { city: 'Golden', county: 'Jefferson', zip: '80401', lat: 39.7500, lng: -105.2100, ppsf: 360 },
  { city: 'Denver', county: 'Denver', zip: '80211', lat: 39.7650, lng: -105.0200, ppsf: 380 },
  { city: 'Littleton', county: 'Arapahoe', zip: '80120', lat: 39.6100, lng: -105.0200, ppsf: 300 },
  { city: 'Castle Rock', county: 'Douglas', zip: '80104', lat: 39.3700, lng: -104.8600, ppsf: 280 },
  { city: 'Colorado Springs', county: 'El Paso', zip: '80918', lat: 38.9100, lng: -104.7700, ppsf: 230 },
];

const STREETS = [
  'Aspen Ridge Dr', 'Cottonwood Ln', 'Prairie Sky Ct', 'Columbine Way', 'Elk Meadow Rd',
  'Foothills Pkwy', 'Larkspur St', 'Blue Spruce Ave', 'Sunset Mesa Dr', 'Willow Bend Ct',
  'Ponderosa Trl', 'Meadowlark Ln', 'Juniper Hill Rd', 'Bluebell Ct', 'Silver Sage Dr',
  'Riverbend Way', 'Kestrel Ct', 'Golden Eagle Dr', 'Canyon View Ln', 'Harvest Moon St',
];

const SUBDIVISIONS = [
  'Aspen Ridge', 'Prairie Meadows', 'Cottonwood Creek', 'Sunset Mesa', 'Willow Bend',
  'Foothills Estates', 'Harvest Park', 'Elk Meadow', 'Riverbend', 'Columbine Village',
];

// Shape of each sample home: type, beds, baths, size, lot, year, garage.
const PLANS = [
  { kind: 'ranch', home_type: 'detached', sub: 'Single Family Residence', beds: 3, baths: 2, sqft: 1650, lot: 0.18, year: 1998, garage: 2 },
  { kind: 'two-story', home_type: 'detached', sub: 'Single Family Residence', beds: 4, baths: 3, sqft: 2650, lot: 0.21, year: 2014, garage: 3 },
  { kind: 'craftsman', home_type: 'detached', sub: 'Single Family Residence', beds: 3, baths: 2, sqft: 1980, lot: 0.15, year: 2006, garage: 2 },
  { kind: 'townhome', home_type: 'attached', sub: 'Townhouse', beds: 2, baths: 3, sqft: 1420, lot: 0.04, year: 2019, garage: 2 },
  { kind: 'modern', home_type: 'detached', sub: 'Single Family Residence', beds: 4, baths: 4, sqft: 3400, lot: 0.32, year: 2021, garage: 3 },
  { kind: 'condo', home_type: 'attached', sub: 'Condominium', beds: 2, baths: 2, sqft: 1080, lot: null, year: 2009, garage: 1 },
  { kind: 'bungalow', home_type: 'detached', sub: 'Single Family Residence', beds: 2, baths: 1, sqft: 1150, lot: 0.14, year: 1948, garage: 1 },
  { kind: 'two-story', home_type: 'detached', sub: 'Single Family Residence', beds: 5, baths: 4, sqft: 3900, lot: 0.45, year: 2008, garage: 3 },
  { kind: 'ranch', home_type: 'detached', sub: 'Single Family Residence', beds: 4, baths: 3, sqft: 2900, lot: 1.6, year: 1985, garage: 3 },
  { kind: 'townhome', home_type: 'attached', sub: 'Townhouse', beds: 3, baths: 3, sqft: 1760, lot: 0.05, year: 2016, garage: 2 },
];

const PALETTES = ['sage', 'slate', 'sand', 'brick', 'cream', 'charcoal'];

const OPENERS = {
  ranch: 'Easy one-level living on a quiet street',
  'two-story': 'Room for everyone in this bright two-story home',
  craftsman: 'Classic craftsman charm with a deep front porch',
  townhome: 'Low-maintenance townhome close to trails and shops',
  modern: 'Clean lines, big windows and mountain light throughout',
  condo: 'Lock-and-leave condo with an easy walk to coffee and parks',
  bungalow: 'Character-filled bungalow on a tree-lined block',
};

const EXTRAS = [
  'The kitchen opens to the family room, with a large island and plenty of storage.',
  'A finished basement adds a rec room and a guest suite.',
  'The fenced backyard has a covered patio and room for a garden.',
  'Main-floor primary suite with a walk-in closet.',
  'Mountain views from the upstairs loft.',
  'Newer roof, furnace and water heater.',
  'Walk to the neighborhood pool, parks and the trail system.',
  'A south-facing driveway keeps winter mornings easy.',
];

// Small deterministic random so every start seeds the exact same homes.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const round = (n, step) => Math.round(n / step) * step;

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function describe(plan, town, street, extras) {
  const opener = OPENERS[plan.kind] || 'A comfortable home';
  return `${opener} in ${town.city}. ${extras.join(' ')} This is a sample listing, shown so you can try the search. It is not for sale.`;
}

/** The sample homes for sale (pure, deterministic). */
export function demoActiveListings(count = 50) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const r = rng(9001 + i * 7919);
    const town = TOWNS[i % TOWNS.length];
    const plan = PLANS[(i * 3 + Math.floor(i / TOWNS.length)) % PLANS.length];
    const street = STREETS[(i * 7) % STREETS.length];
    const number = String(1000 + Math.floor(r() * 8900));
    const unit = plan.kind === 'condo' ? String(100 + Math.floor(r() * 300)) : null;
    const sizeJitter = 0.85 + r() * 0.35;
    const sqft = round(plan.sqft * sizeJitter, 10);
    const price = round(sqft * town.ppsf * (0.9 + r() * 0.25) + (plan.lot && plan.lot > 1 ? 120000 : 0), 5000);
    const statusRoll = r();
    const status = statusRoll < 0.8 ? 'Active' : statusRoll < 0.9 ? 'Active Under Contract' : 'Pending';
    const dom = Math.floor(r() * 60);
    const cut = r() < 0.2;
    const id = `DEMO-${1001 + i}`;
    const extras = [EXTRAS[i % EXTRAS.length], EXTRAS[(i + 3) % EXTRAS.length]];
    const lat = town.lat + (r() - 0.5) * 0.05;
    const lng = town.lng + (r() - 0.5) * 0.06;
    const palette = PALETTES[i % PALETTES.length];
    const photos = [0, 1, 2, 3].map((v) => `${DEMO_PHOTO_PREFIX}${plan.kind}:${palette}:${v}:${i}`);
    const lotAcres = plan.lot != null ? Math.round(plan.lot * (0.8 + r() * 0.5) * 100) / 100 : null;
    const hoa = plan.home_type === 'attached' ? round(180 + r() * 220, 5) : (r() < 0.4 ? round(40 + r() * 80, 5) : null);
    const taxAnnual = round(price * 0.0058, 10);
    out.push({
      listing_id: id,
      status,
      is_active: true,
      property_type: 'Residential',
      property_subtype: plan.sub,
      home_type: plan.home_type,
      street_number: number,
      street_name: street,
      unit,
      city: town.city,
      state: 'CO',
      postal_code: town.zip,
      county: town.county,
      list_price: price,
      original_list_price: cut ? round(price * 1.04, 5000) : null,
      beds: plan.beds,
      baths: plan.baths,
      living_area: sqft,
      lot_size: lotAcres != null ? Math.round(lotAcres * 43560) : null,
      lot_size_acres: lotAcres,
      year_built: plan.year + Math.floor(r() * 6) - 3,
      garage_spaces: plan.garage,
      hoa_fee: hoa,
      description: describe(plan, town, street, extras),
      photos,
      photos_count: photos.length,
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lng * 1e6) / 1e6,
      days_on_market: dom,
      price_per_sqft: Math.round(price / sqft),
      subdivision: SUBDIVISIONS[i % SUBDIVISIONS.length],
      features: {
        basement: plan.kind === 'two-story' || plan.kind === 'ranch' ? 'Full, Finished' : null,
        cooling: 'Central Air',
        heating: 'Forced Air',
        fireplaces: plan.kind === 'condo' ? null : 'Gas',
        tax_annual: taxAnnual,
        tax_year: 2025,
        new_construction: plan.year >= 2021 ? 'true' : null,
        assoc_fee_freq: hoa ? 'Monthly' : null,
        view: i % 4 === 0 ? 'Mountain(s)' : null,
      },
      slug: `sample-${slugify(`${number} ${street} ${town.city}`)}-${id.toLowerCase()}`,
    });
  }
  return out;
}

/** Sample sales for the home-value and recently-sold tools (pure). */
export function demoSoldListings(count = 24) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const r = rng(4242 + i * 104729);
    const town = TOWNS[(i * 5) % TOWNS.length];
    const plan = PLANS[i % PLANS.length];
    const street = STREETS[(i * 11 + 3) % STREETS.length];
    const number = String(1000 + Math.floor(r() * 8900));
    const sqft = round(plan.sqft * (0.85 + r() * 0.3), 10);
    const list = round(sqft * town.ppsf * (0.92 + r() * 0.2), 5000);
    const sold = round(list * (0.96 + r() * 0.06), 1000);
    const unit = plan.kind === 'condo' ? String(100 + Math.floor(r() * 300)) : null;
    out.push({
      listing_id: `DEMO-S${1001 + i}`,
      city: town.city,
      county: town.county,
      street_number: number,
      street_name: street,
      unit,
      address: [number, street, unit ? `#${unit}` : null].filter(Boolean).join(' '),
      postal_code: town.zip,
      lat: Math.round((town.lat + (r() - 0.5) * 0.05) * 1e6) / 1e6,
      lng: Math.round((town.lng + (r() - 0.5) * 0.06) * 1e6) / 1e6,
      property_type: 'Residential',
      home_type: plan.home_type,
      beds: plan.beds,
      baths: plan.baths,
      living_area: sqft,
      lot_size: plan.lot ? Math.round(plan.lot * 43560) : null,
      list_price: list,
      sold_price: sold,
      days_ago: 10 + Math.floor(r() * 300),
      days_on_market: 4 + Math.floor(r() * 50),
      subdivision: SUBDIVISIONS[(i + 2) % SUBDIVISIONS.length],
      photos: [0, 1].map((v) => `${DEMO_PHOTO_PREFIX}${plan.kind}:${PALETTES[(i + 1) % PALETTES.length]}:${v}:${i + 100}`),
    });
  }
  return out;
}

const ACTIVE_COLS = [
  'listing_id', 'status', 'is_active', 'property_type', 'property_subtype', 'home_type',
  'street_number', 'street_name', 'unit', 'city', 'state', 'postal_code', 'county',
  'list_price', 'original_list_price', 'beds', 'baths', 'living_area', 'lot_size', 'lot_size_acres',
  'year_built', 'garage_spaces', 'hoa_fee', 'description', 'photos', 'photos_count',
  'latitude', 'longitude', 'days_on_market', 'price_per_sqft', 'subdivision', 'features', 'slug',
];

/**
 * Write the sample homes. Safe to run on every start: rows are keyed by
 * their DEMO- ids and refreshed in place; nothing else is touched.
 */
export async function seedDemoListings(db = getPool()) {
  const homes = demoActiveListings();
  for (const h of homes) {
    const vals = ACTIVE_COLS.map((c) => (c === 'photos' || c === 'features' ? JSON.stringify(h[c]) : h[c]));
    await db.query(
      `INSERT INTO listings (${ACTIVE_COLS.join(', ')}, feed, mls_source, assumable, created_at, updated_at, last_seen_at)
       VALUES (${ACTIVE_COLS.map((_, i) => `$${i + 1}`).join(', ')}, 'demo', 'Sample', FALSE,
               NOW() - make_interval(days => $${ACTIVE_COLS.length + 1}), NOW(), NOW())
       ON CONFLICT (listing_id) DO UPDATE SET
         ${ACTIVE_COLS.filter((c) => c !== 'listing_id').map((c) => `${c} = EXCLUDED.${c}`).join(', ')},
         feed = 'demo', mls_source = 'Sample'
       WHERE listings.feed = 'demo'`,
      [...vals, h.days_on_market]
    );
  }
  const sold = demoSoldListings();
  for (const s of sold) {
    await db.query(
      `INSERT INTO sold_listings (listing_id, mls_source, feed, city, county, street_number, street_name, unit, address,
         postal_code, lat, lng, property_type, home_type, beds, baths, living_area, lot_size,
         list_price, sold_price, closed_date, days_on_market, subdivision, photos, photos_count, updated_at)
       VALUES ($1, 'Sample', 'demo', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
         CURRENT_DATE - $19::int, $20, $21, $22, $23, NOW())
       ON CONFLICT (listing_id) DO UPDATE SET
         sold_price = EXCLUDED.sold_price, list_price = EXCLUDED.list_price,
         closed_date = EXCLUDED.closed_date, photos = EXCLUDED.photos, photos_count = EXCLUDED.photos_count,
         updated_at = NOW()
       WHERE sold_listings.feed = 'demo'`,
      [s.listing_id, s.city, s.county, s.street_number, s.street_name, s.unit, s.address, s.postal_code,
        s.lat, s.lng, s.property_type, s.home_type, s.beds, s.baths, s.living_area, s.lot_size,
        s.list_price, s.sold_price, s.days_ago, s.days_on_market, s.subdivision,
        JSON.stringify(s.photos), s.photos.length]
    );
  }
  return { active: homes.length, sold: sold.length };
}

// ── Drawn photos ────────────────────────────────────────────────────────
const COLORS = {
  sage: { wall: '#9fb59a', trim: '#f4f1ea', roof: '#4a5248', door: '#7a4b2a' },
  slate: { wall: '#8796a6', trim: '#f2f4f7', roof: '#3a4250', door: '#b5452f' },
  sand: { wall: '#d8c3a0', trim: '#fffaf0', roof: '#6b5844', door: '#2f5d62' },
  brick: { wall: '#b5654a', trim: '#f3ede4', roof: '#463a35', door: '#283845' },
  cream: { wall: '#ece3cf', trim: '#ffffff', roof: '#5a6470', door: '#3c6e47' },
  charcoal: { wall: '#4b5058', trim: '#e9e6df', roof: '#24272c', door: '#c48a3a' },
};

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function windowRect(x, y, w, h, c) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#cfe3f0" stroke="${c.trim}" stroke-width="6"/>` +
    `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${c.trim}" stroke-width="3"/>`;
}

function houseShape(kind, c) {
  switch (kind) {
    case 'two-story':
      return `<rect x="230" y="210" width="340" height="250" fill="${c.wall}"/>
        <polygon points="210,215 400,110 590,215" fill="${c.roof}"/>
        ${windowRect(260, 240, 80, 60, c)}${windowRect(460, 240, 80, 60, c)}
        ${windowRect(260, 350, 80, 60, c)}${windowRect(460, 350, 80, 60, c)}
        <rect x="370" y="360" width="60" height="100" fill="${c.door}"/>
        <rect x="570" y="320" width="150" height="140" fill="${c.wall}" opacity="0.92"/>
        <polygon points="560,325 645,270 730,325" fill="${c.roof}"/>
        <rect x="590" y="360" width="110" height="100" fill="${c.trim}" opacity="0.85"/>`;
    case 'townhome':
      return [0, 1, 2].map((n) => {
        const x = 150 + n * 170;
        return `<rect x="${x}" y="220" width="160" height="240" fill="${c.wall}" opacity="${0.88 + n * 0.05}"/>
          <polygon points="${x - 8},225 ${x + 80},150 ${x + 168},225" fill="${c.roof}"/>
          ${windowRect(x + 25, 245, 50, 50, c)}${windowRect(x + 90, 245, 50, 50, c)}
          <rect x="${x + 20}" y="360" width="45" height="100" fill="${c.door}"/>
          <rect x="${x + 80}" y="370" width="65" height="90" fill="${c.trim}" opacity="0.85"/>`;
      }).join('');
    case 'condo':
      return `<rect x="220" y="130" width="360" height="330" fill="${c.wall}"/>
        <rect x="210" y="118" width="380" height="18" fill="${c.roof}"/>
        ${[0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((col) => windowRect(245 + col * 85, 155 + row * 70, 55, 45, c)).join('')).join('')}
        <rect x="370" y="420" width="60" height="40" fill="${c.door}"/>`;
    case 'modern':
      return `<rect x="200" y="250" width="420" height="210" fill="${c.wall}"/>
        <rect x="320" y="160" width="300" height="100" fill="${c.trim}"/>
        <rect x="190" y="240" width="440" height="14" fill="${c.roof}"/>
        <rect x="310" y="150" width="320" height="12" fill="${c.roof}"/>
        <rect x="340" y="180" width="260" height="60" fill="#cfe3f0"/>
        <rect x="220" y="280" width="180" height="110" fill="#cfe3f0"/>
        <rect x="430" y="300" width="60" height="160" fill="${c.door}"/>
        <rect x="510" y="330" width="100" height="130" fill="${c.trim}" opacity="0.9"/>`;
    case 'bungalow':
    case 'craftsman':
      return `<rect x="240" y="250" width="320" height="210" fill="${c.wall}"/>
        <polygon points="215,255 400,150 585,255" fill="${c.roof}"/>
        <rect x="240" y="330" width="320" height="12" fill="${c.trim}"/>
        <rect x="255" y="342" width="14" height="118" fill="${c.trim}"/><rect x="531" y="342" width="14" height="118" fill="${c.trim}"/>
        ${windowRect(280, 270, 70, 50, c)}${windowRect(450, 270, 70, 50, c)}
        <rect x="375" y="360" width="50" height="100" fill="${c.door}"/>
        ${windowRect(370, 195, 60, 40, c)}`;
    case 'ranch':
    default:
      return `<rect x="170" y="290" width="460" height="170" fill="${c.wall}"/>
        <polygon points="150,295 400,200 650,295" fill="${c.roof}"/>
        ${windowRect(200, 320, 90, 60, c)}${windowRect(310, 320, 70, 60, c)}
        <rect x="400" y="350" width="50" height="110" fill="${c.door}"/>
        <rect x="480" y="340" width="130" height="120" fill="${c.trim}" opacity="0.85"/>`;
  }
}

function roomShape(view, c) {
  if (view === 2) {
    // Living room: sofa, rug, window, lamp
    return `<rect width="800" height="600" fill="#f3efe7"/>
      <rect y="440" width="800" height="160" fill="#c9b79a"/>
      <rect x="470" y="110" width="230" height="200" fill="#cfe3f0" stroke="${c.trim}" stroke-width="10"/>
      <rect x="140" y="330" width="300" height="110" rx="18" fill="${c.wall}"/>
      <rect x="150" y="290" width="280" height="60" rx="16" fill="${c.wall}" opacity="0.85"/>
      <ellipse cx="400" cy="510" rx="230" ry="45" fill="${c.roof}" opacity="0.35"/>
      <rect x="560" y="330" width="10" height="110" fill="#555"/><polygon points="535,330 595,330 580,290 550,290" fill="#f6d36b"/>`;
  }
  // Kitchen: cabinets, island, pendant lights
  return `<rect width="800" height="600" fill="#f6f4ef"/>
    <rect y="470" width="800" height="130" fill="#b9a68a"/>
    <rect x="80" y="120" width="640" height="110" fill="${c.wall}"/>
    ${[0, 1, 2, 3, 4].map((n) => `<rect x="${92 + n * 126}" y="132" width="110" height="86" fill="none" stroke="${c.trim}" stroke-width="4"/>`).join('')}
    <rect x="80" y="300" width="640" height="170" fill="${c.wall}" opacity="0.9"/>
    <rect x="80" y="292" width="640" height="14" fill="#e8e4dc"/>
    <rect x="230" y="380" width="340" height="110" fill="${c.roof}"/>
    <rect x="220" y="370" width="360" height="16" fill="#efebe3"/>
    ${[300, 400, 500].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="300" stroke="#444" stroke-width="2"/><circle cx="${x}" cy="305" r="16" fill="#f6d36b"/>`).join('')}`;
}

/**
 * A drawn picture for a sample home's photo slot: "demo:<kind>:<palette>:<view>:<n>".
 * Views 0 and 1 are the outside (day and dusk), 2 the living room, 3 the kitchen.
 */
export function demoPhotoSvg(ref, { label = 'Sample listing' } = {}) {
  const [, kind = 'ranch', palette = 'sage', viewRaw = '0'] = String(ref || '').split(':');
  const c = COLORS[palette] || COLORS.sage;
  const view = Number(viewRaw) || 0;
  let body;
  if (view >= 2) {
    body = roomShape(view, c);
  } else {
    const dusk = view === 1;
    body = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${dusk ? '#f2a65a' : '#8ec5e8'}"/><stop offset="1" stop-color="${dusk ? '#f7d9b0' : '#e3f1fa'}"/>
      </linearGradient></defs>
      <rect width="800" height="600" fill="url(#sky)"/>
      <polygon points="0,330 140,230 260,300 380,210 520,290 660,220 800,300 800,420 0,420" fill="${dusk ? '#8c7a8f' : '#a9b7c6'}" opacity="0.7"/>
      <rect y="420" width="800" height="180" fill="${dusk ? '#6f8f5a' : '#86b26b'}"/>
      <rect x="360" y="455" width="80" height="145" fill="#d9d4c7"/>
      ${houseShape(kind, c)}
      <circle cx="110" cy="400" r="55" fill="#4f7a43"/><rect x="104" y="420" width="12" height="60" fill="#5b4632"/>
      <circle cx="700" cy="390" r="45" fill="#5d8a4e"/><rect x="694" y="405" width="12" height="70" fill="#5b4632"/>`;
  }
  // Label sits top-right so it isn't hidden under the badges cards put top-left.
  const labelWidth = Math.max(150, esc(label).length * 11 + 30);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  ${body}
  <rect x="${780 - labelWidth}" y="20" rx="8" width="${labelWidth}" height="40" fill="#111" opacity="0.78"/>
  <text x="${798 - labelWidth}" y="47" fill="#fff" font-family="system-ui,-apple-system,sans-serif" font-size="19" font-weight="700">${esc(label)}</text>
</svg>`;
}

export const isDemoPhotoRef = (u) => typeof u === 'string' && u.startsWith(DEMO_PHOTO_PREFIX);
