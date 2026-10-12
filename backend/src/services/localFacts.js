/**
 * Local facts for one home: what it costs to own beyond the mortgage, and the
 * Colorado-specific things buyers get surprised by (metro district taxes,
 * lot-only taxes on new builds, well and septic, water rights).
 *
 * Everything comes from the listing itself or from other live listings in
 * the same town. Nothing is estimated that the listing doesn't support, and
 * flood risk is a link to FEMA's own map, not a guess.
 */
import getPool from '../config/database.js';

const CACHE_MS = 6 * 60 * 60 * 1000;
const MIN_TOWN_SAMPLE = 10;
const taxRateCache = new Map(); // city → { at, rate, n }

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const truthy = (v) => v === true || v === 'true' || v === 'Y' || v === 'Yes';

export function monthlyHoa(fee, freq) {
  const n = num(fee);
  if (!n || n <= 0) return 0;
  const f = String(freq || '').toLowerCase();
  if (f.includes('semi')) return n / 6;
  if (f.includes('quarter')) return n / 3;
  if (f.includes('year') || f.includes('annual')) return n / 12;
  return n;
}

/** Median property tax as a share of list price, across this town's homes for sale. */
export async function townTaxRate(city, pool = getPool()) {
  const key = String(city || '').trim().toLowerCase();
  if (!key) return null;
  const hit = taxRateCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.n >= MIN_TOWN_SAMPLE ? hit.rate : null;
  const { rows: [r] } = await pool.query(
    `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (features->>'tax_annual')::numeric / list_price) AS rate,
            COUNT(*)::int AS n
     FROM listings
     WHERE is_active = TRUE AND status = 'Active' AND LOWER(city) = $1
       AND list_price > 50000
       AND COALESCE(home_type, '') <> 'land'
       AND COALESCE(features->>'new_construction', 'false') <> 'true'
       AND features->>'tax_annual' ~ '^[0-9]+(\\.[0-9]+)?$'
       AND (features->>'tax_annual')::numeric > 0`,
    [key]
  );
  const rate = r?.rate != null ? Number(r.rate) : null;
  taxRateCache.set(key, { at: Date.now(), rate, n: r?.n || 0 });
  return (r?.n || 0) >= MIN_TOWN_SAMPLE ? rate : null;
}

export function clearTownTaxCache() {
  taxRateCache.clear();
}

const pct = (r) => `${(Math.round(r * 10000) / 100).toFixed(2)}%`;

/**
 * Pure: the facts card for a listing, given the town's typical tax rate.
 * Returns null when there's nothing worth showing.
 */
export function buildLocalFacts(listing, { townRate = null } = {}) {
  if (!listing) return null;
  const f = listing.features || {};
  const price = num(listing.list_price);
  const city = listing.city || 'this area';
  const newBuild = truthy(f.new_construction);
  const text = [listing.description, f.disclosures, f.special_conditions, f.association_includes, f.community]
    .filter(Boolean).join(' ');

  const out = { notes: [] };

  const taxAnnual = num(f.tax_annual);
  if (taxAnnual && taxAnnual > 0) {
    const rate = price ? taxAnnual / price : null;
    out.taxes = {
      annual: Math.round(taxAnnual),
      monthly: Math.round(taxAnnual / 12),
      year: num(f.tax_year),
      rate: rate != null ? Math.round(rate * 100000) / 100000 : null,
      town_rate: townRate != null ? Math.round(townRate * 100000) / 100000 : null,
      town: listing.city || null,
    };
    if (rate != null && townRate) {
      if (newBuild && rate < townRate * 0.4) {
        out.taxes.flag = 'lot_only';
        out.notes.push({
          topic: 'taxes',
          text: `This is a new build and its taxes (${pct(rate)} of the price) are far below most ${city} homes (${pct(townRate)}). They may cover only the lot, so expect a bigger bill once the home is assessed.`,
        });
      } else if (rate > townRate * 1.35) {
        out.taxes.flag = 'high';
        out.notes.push({
          topic: 'taxes',
          text: `Taxes run higher than most ${city} homes for sale (${pct(rate)} of the price vs. ${pct(townRate)}). In newer Northern Colorado neighborhoods that usually means a metro district, so ask for its mill levy.`,
        });
      }
    }
  }

  if (/\bmetro(?:politan)?\s+(?:district|dist\.?)\b/i.test(text)) {
    out.metro_district = true;
    if (out.taxes?.flag !== 'high') {
      out.notes.push({ topic: 'taxes', text: 'The listing mentions a metro district, which adds to property taxes. Ask for its mill levy and any debt it carries.' });
    }
  }

  const hoaMonthly = Math.round(monthlyHoa(listing.hoa_fee, f.assoc_fee_freq));
  if (hoaMonthly > 0) {
    out.hoa = {
      monthly: hoaMonthly,
      name: f.association_name || null,
      includes: f.association_includes ? String(f.association_includes).split(/\s*,\s*/).filter(Boolean).slice(0, 8) : [],
    };
  } else if (f.association === false) {
    out.hoa = { monthly: 0, none: true, includes: [] };
  }

  if (out.taxes || out.hoa?.monthly) {
    out.monthly_fixed = (out.taxes?.monthly || 0) + (out.hoa?.monthly || 0);
  }

  const water = [];
  const ws = String(f.water_source || '');
  const sewer = String(f.sewer || '');
  if (/well/i.test(ws)) water.push('Well water');
  else if (/public|city|district|municipal/i.test(ws)) water.push('City or district water');
  if (/septic/i.test(sewer)) water.push('Septic system');
  else if (/public|city|district|municipal/i.test(sewer)) water.push('City or district sewer');
  if (truthy(f.irrigation_rights)) water.push('Comes with irrigation water rights');
  else if (f.irrigation) water.push(`Irrigation: ${String(f.irrigation).split(/\s*,\s*/)[0]}`);
  if (water.length) out.water = water;
  if (/well/i.test(ws) || /septic/i.test(sewer)) {
    out.notes.push({ topic: 'water', text: 'Well and septic homes need their own inspections; plan for a water test and a septic inspection.' });
  }

  const address = [
    [listing.street_number, listing.street_name].filter(Boolean).join(' '),
    listing.city,
    listing.state || 'CO',
    listing.postal_code,
  ].filter(Boolean).join(', ');
  if (listing.street_name) {
    out.flood_map_url = `https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(address)}`;
  }
  if (f.zoning) out.zoning = String(f.zoning).slice(0, 60);

  const meaningful = out.taxes || out.hoa || out.water || out.notes.length;
  return meaningful ? out : null;
}

export async function localFactsForListing(listing, pool = getPool()) {
  let townRate = null;
  try {
    townRate = await townTaxRate(listing.city, pool);
  } catch {
    townRate = null;
  }
  return buildLocalFacts(listing, { townRate });
}
