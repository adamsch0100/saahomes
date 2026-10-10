/**
 * Listing filters: query params -> SQL WHERE + bind params.
 *
 * The one place a search becomes SQL. The search page, saved-search match
 * counts and alert digests all call buildListingFilters, so a saved search
 * can never match different homes than the page the visitor saved it from.
 *
 * Filters map to real IRES columns / features JSONB only.
 * Never fabricate a filter that cannot hit live data.
 */
import { NOCO_CITIES } from '../config/nocoCities.js';


// Legacy single-value property_type aliases (still accepted).
const TYPE_SQL = {
  Residential: `(property_type = 'Residential' AND (property_subtype IS NULL OR (property_subtype NOT ILIKE '%condo%' AND property_subtype NOT ILIKE '%town%' AND property_subtype NOT ILIKE '%attached%')))`,
  Condominium: `(property_subtype ILIKE '%condo%' OR property_subtype ILIKE '%town%' OR property_subtype ILIKE '%attached%' OR property_type = 'Condominium')`,
  Townhouse: `(property_subtype ILIKE '%town%' OR property_type = 'Townhouse')`,
  Land: `property_type = 'Land'`,
  'Multi-Family': `property_type = 'Residential Income'`,
  'Commercial Sale': `(property_type = 'Commercial Sale' OR property_type = 'Commercial Lease')`,
  Farm: `property_type = 'Farm'`,
  'Manufactured In Park': `property_type = 'Manufactured In Park'`,
};

// Zillow-style multi home-type tokens → SQL fragments (no bind params).
const HOME_TYPE_SQL = {
  house: `(home_type = 'detached' OR (property_type = 'Residential' AND property_subtype ILIKE '%single family%'))`,
  houses: `(home_type = 'detached' OR (property_type = 'Residential' AND property_subtype ILIKE '%single family%'))`,
  detached: `home_type = 'detached'`,
  townhome: `(property_subtype ILIKE '%town%' OR property_type = 'Townhouse')`,
  townhomes: `(property_subtype ILIKE '%town%' OR property_type = 'Townhouse')`,
  townhouse: `(property_subtype ILIKE '%town%' OR property_type = 'Townhouse')`,
  condo: `(property_subtype ILIKE '%condo%' OR property_type = 'Condominium')`,
  condos: `(property_subtype ILIKE '%condo%' OR property_type = 'Condominium')`,
  attached: `home_type = 'attached'`,
  multi: `(property_type = 'Residential Income' OR property_subtype ILIKE '%multi%' OR property_subtype ILIKE '%duplex%' OR property_subtype ILIKE '%triplex%' OR property_subtype ILIKE '%fourplex%')`,
  multifamily: `(property_type = 'Residential Income' OR property_subtype ILIKE '%multi%' OR property_subtype ILIKE '%duplex%' OR property_subtype ILIKE '%triplex%')`,
  'multi-family': `(property_type = 'Residential Income' OR property_subtype ILIKE '%multi%' OR property_subtype ILIKE '%duplex%' OR property_subtype ILIKE '%triplex%')`,
  manufactured: `(property_type = 'Manufactured In Park' OR property_subtype ILIKE '%manufactured%' OR property_subtype ILIKE '%mobile%' OR property_subtype ILIKE '%modular%')`,
  land: `(home_type = 'land' OR property_type = 'Land')`,
  'lots-land': `(home_type = 'land' OR property_type = 'Land')`,
  commercial: `home_type = 'commercial'`,
};

/**
 * Parse polygon query param into a ring of [lng, lat] pairs.
 * Accepts:
 *   - "lng,lat;lng,lat;lng,lat" (semicolon-separated vertices)
 *   - GeoJSON Polygon / Feature string
 * Returns null if unusable (< 3 vertices).
 */
function parsePolygonRing(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // GeoJSON
  if (s.startsWith('{')) {
    try {
      const geo = JSON.parse(s);
      let coords = null;
      if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) {
        coords = geo.coordinates[0];
      } else if (geo.type === 'Feature' && geo.geometry?.type === 'Polygon') {
        coords = geo.geometry.coordinates[0];
      } else if (geo.type === 'FeatureCollection' && geo.features?.[0]) {
        const g = geo.features[0].geometry;
        if (g?.type === 'Polygon') coords = g.coordinates[0];
      }
      if (!coords || !Array.isArray(coords)) return null;
      const ring = coords
        .map((c) => [Number(c[0]), Number(c[1])])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
      return ring.length >= 3 ? ring : null;
    } catch {
      return null;
    }
  }

  // "lng,lat;lng,lat;..."
  const ring = s.split(/[;|]/)
    .map((pair) => {
      const parts = pair.split(',').map((x) => Number(String(x).trim()));
      if (parts.length < 2) return null;
      const [lng, lat] = parts;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return [lng, lat];
    })
    .filter(Boolean);
  return ring.length >= 3 ? ring : null;
}

/**
 * Pure-SQL even-odd ray casting (no PostGIS). True when (longitude, latitude)
 * falls inside the polygon ring. Vertices bound as float8 arrays of edges.
 */
function pushPolygonFilter(where, params, startI, ring) {
  const pts = ring.map((p) => [p[0], p[1]]);
  // Close ring if needed
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    pts.push([first[0], first[1]]);
  }
  if (pts.length < 4) return startI; // need ≥3 edges after close

  const lng1 = [];
  const lat1 = [];
  const lng2 = [];
  const lat2 = [];
  for (let e = 0; e < pts.length - 1; e += 1) {
    lng1.push(pts[e][0]);
    lat1.push(pts[e][1]);
    lng2.push(pts[e + 1][0]);
    lat2.push(pts[e + 1][1]);
  }

  const i = startI;
  where.push(`(
    latitude IS NOT NULL AND longitude IS NOT NULL
    AND (
      SELECT COALESCE(SUM(
        CASE
          WHEN (v.lat1 > latitude) <> (v.lat2 > latitude)
            AND longitude < ((v.lng2 - v.lng1) * (latitude - v.lat1) / NULLIF(v.lat2 - v.lat1, 0) + v.lng1)
          THEN 1 ELSE 0
        END
      ), 0) % 2 = 1
      FROM (
        SELECT
          unnest($${i}::float8[]) AS lng1,
          unnest($${i + 1}::float8[]) AS lat1,
          unnest($${i + 2}::float8[]) AS lng2,
          unnest($${i + 3}::float8[]) AS lat2
      ) v
    )
  )`);
  params.push(lng1, lat1, lng2, lat2);
  return i + 4;
}

/**
 * Keyword match modes:
 *   all   (default) — every whitespace/comma token must match (AND)
 *   any             — any token may match (OR)
 *   exact           — full input as one phrase
 *   comma           — comma-separated tokens, each must match (AND)
 */
function pushKeywordFilter(where, params, startI, searchText, mode) {
  let i = startI;
  const termClause = (paramIdx) =>
    `(LOWER(city) LIKE $${paramIdx} OR LOWER(street_name) LIKE $${paramIdx} OR LOWER(COALESCE(description,'')) LIKE $${paramIdx} OR LOWER(COALESCE(subdivision,'')) LIKE $${paramIdx})`;

  const pushTerm = (term) => {
    where.push(termClause(i));
    params.push(`%${term.toLowerCase()}%`);
    i += 1;
  };

  const m = (mode || 'all').toLowerCase();

  if (m === 'exact') {
    pushTerm(searchText);
    return i;
  }

  if (m === 'any') {
    const terms = searchText.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    if (terms.length === 0) return i;
    if (terms.length === 1) {
      pushTerm(terms[0]);
      return i;
    }
    const clauses = [];
    for (const term of terms) {
      clauses.push(termClause(i));
      params.push(`%${term.toLowerCase()}%`);
      i += 1;
    }
    where.push(`(${clauses.join(' OR ')})`);
    return i;
  }

  if (m === 'comma') {
    const terms = searchText.split(',').map((t) => t.trim()).filter(Boolean);
    for (const term of terms) pushTerm(term);
    return i;
  }

  // all (default): every word must appear
  const terms = searchText.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
  for (const term of terms) pushTerm(term);
  return i;
}

/** Split comma-separated location tokens; drop empties / specials. */
function parseLocationList(raw) {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '__noco__' && s !== '__all__');
}

/**
 * Build WHERE clause + bind params from req.query.
 * Shared by main search and city facets so they never drift.
 *
 * Location params (backward compatible):
 *   city=__noco__ | __all__ | "Denver" | "Denver,Erie,Windsor"
 *   postal_code=80521 | postal_code=80521,80525  (also zip / zipCode aliases)
 */
/** MLS home-status tokens (as stored in listings.status). */
export const HOME_STATUS_VALUES = new Set([
  'Active',
  'Active Under Contract',
  'Pending',
  'Sold',
  'Withdrawn',
  'Expired',
  'Canceled',
]);

export function buildListingFilters(query = {}) {
  const {
    city, minPrice, maxPrice, beds, baths, type, types,
    status: statusRaw,
    q, keywords, keywordMode, keyword_mode: keywordModeSnake,
    polygon,
    minSqft, maxSqft, minYear, maxYear, maxHoa, minHoa,
    garage, basement, fireplace, pool: hasPool,
    newConstruction, waterfront, newDays, dropDays, dropPct,
    minLotAcres, maxLotAcres, stories,
    cooling, heating, parking, view, style, community, exterior,
    interior, // comma-separated interior feature keywords
    listingStatus, // price-drop | new  OR (legacy) a home status string
    hasImages, hasTour, has3d,
    assumable,
    postal_code: postalCodeSnake,
    postalCode, zip, zipCode, zips,
  } = query;

  // Home status: prefer explicit `status=`. Also accept a home-status value in
  // `listingStatus=` (older frontend sent Pending/AUC there by mistake).
  // Default Active when neither is a home status (For sale inventory).
  let status = 'Active';
  if (statusRaw != null && String(statusRaw).trim() !== '') {
    status = String(statusRaw).trim();
  } else if (listingStatus && HOME_STATUS_VALUES.has(String(listingStatus))) {
    status = String(listingStatus);
  }

  const where = [];
  const params = [];
  let i = 1;

  const push = (sql, value) => {
    where.push(sql.replace(/\$n/g, () => `$${i++}`));
    if (value !== undefined) params.push(value);
  };
  const pushRaw = (sql) => { where.push(sql); };

  // Archived statuses (Sold/Withdrawn/Expired/Canceled) are stored with
  // is_active=FALSE — searching them drops the is_active guard so their rows
  // are reachable. Listed statuses (Active/AUC/Pending) keep the guard.
  const ARCHIVED_STATUSES = ['Sold', 'Withdrawn', 'Expired', 'Canceled'];
  if (!status || status === 'any' || status === 'all' || !ARCHIVED_STATUSES.includes(status)) {
    pushRaw('is_active = TRUE');
  }

  // Status: the HOME's status (Active | Active Under Contract | Pending |
  // Sold | Withdrawn | Expired). 'For sale' (default) = Active via frontend "".
  if (status && status !== 'any' && status !== 'all') {
    push('status = $n', status);
  }

  // Drawn polygon overrides city/zip scope (point-in-polygon replaces location).
  const polyRing = parsePolygonRing(polygon ? String(polygon) : '');
  const zipRaw = postalCodeSnake || postalCode || zip || zipCode || zips || '';
  const zipList = parseLocationList(zipRaw);

  if (!polyRing) {
    if (city === '__noco__') {
      // NoCO default — still allow zip refinement within / outside via OR when zips set
      if (zipList.length === 0) {
        push('city = ANY($n::text[])', NOCO_CITIES);
      } else if (zipList.length === 1) {
        // Zip alone while city is still the NoCO default: treat as zip-only statewide
        // (UI clears __noco__ when picking a zip; this is a safety net for direct API use)
        push('postal_code = $n', zipList[0]);
      } else {
        push('postal_code = ANY($n::text[])', zipList);
      }
    } else {
      const cityList = parseLocationList(city);
      const locationClauses = [];

      if (city && city !== '__all__' && cityList.length === 1) {
        locationClauses.push({ sql: 'LOWER(city) = LOWER($n)', value: cityList[0] });
      } else if (cityList.length > 1) {
        // Case-insensitive multi-city: LOWER(city) = ANY(lowercased array)
        locationClauses.push({
          sql: 'LOWER(city) = ANY($n::text[])',
          value: cityList.map((c) => c.toLowerCase()),
        });
      }

      if (zipList.length === 1) {
        locationClauses.push({ sql: 'postal_code = $n', value: zipList[0] });
      } else if (zipList.length > 1) {
        locationClauses.push({ sql: 'postal_code = ANY($n::text[])', value: zipList });
      }

      // Multiple location chips (cities and/or zips) are OR'd — union of areas.
      // Single city + single zip without multi intent still works as one clause each
      // OR'd (homes in those cities OR those zips). When only one group is set, same.
      if (locationClauses.length === 1) {
        push(locationClauses[0].sql, locationClauses[0].value);
      } else if (locationClauses.length > 1) {
        const parts = [];
        for (const clause of locationClauses) {
          parts.push(clause.sql.replace(/\$n/g, () => `$${i}`));
          params.push(clause.value);
          i += 1;
        }
        pushRaw(`(${parts.join(' OR ')})`);
      }
      // city === '__all__' and no zips → no location filter (whole state)
    }
  }

  if (minPrice) push('list_price >= $n', Number(minPrice));
  if (maxPrice) push('list_price <= $n', Number(maxPrice));
  if (beds) push('beds >= $n', Number(beds));
  if (baths) push('baths >= $n', Number(baths));

  // Home type: multi via `types=house,condo` or single `type=`
  const typeList = [
    ...(types ? String(types).split(',') : []),
    ...(type ? String(type).split(',') : []),
  ].map((t) => t.trim()).filter(Boolean);

  if (typeList.length > 0) {
    const clauses = [];
    for (const rawT of typeList) {
      const t = rawT.toLowerCase();
      if (HOME_TYPE_SQL[t]) {
        clauses.push(HOME_TYPE_SQL[t]);
      } else if (TYPE_SQL[rawT]) {
        clauses.push(TYPE_SQL[rawT]);
      } else if (['detached', 'attached', 'land', 'commercial', 'other'].includes(t)) {
        clauses.push(`home_type = $${i}`);
        params.push(t);
        i += 1;
      } else {
        clauses.push(`property_type = $${i}`);
        params.push(rawT);
        i += 1;
      }
    }
    const unique = [...new Set(clauses.filter(Boolean))];
    if (unique.length === 1) pushRaw(unique[0]);
    else if (unique.length > 1) pushRaw(`(${unique.join(' OR ')})`);
  }

  const searchText = (keywords || q || '').trim();
  if (searchText) {
    // Default "all" (AND words) — least surprising when keywordMode omitted
    const mode = keywordMode || keywordModeSnake || 'all';
    i = pushKeywordFilter(where, params, i, searchText, mode);
  }

  // Custom drawn area (ray-cast, no PostGIS)
  if (polyRing) {
    i = pushPolygonFilter(where, params, i, polyRing);
  }

  if (minSqft) push('living_area >= $n', Number(minSqft));
  if (maxSqft) push('living_area <= $n', Number(maxSqft));
  if (minYear) push('year_built >= $n', Number(minYear));
  if (maxYear) push('year_built <= $n', Number(maxYear));
  if (maxHoa) push('hoa_fee <= $n', Number(maxHoa));
  if (minHoa) push('hoa_fee >= $n', Number(minHoa));

  // Lot size (acres). Prefer lot_size_acres; fall back to lot_size/43560 when acres null.
  const lotAcresExpr = `COALESCE(lot_size_acres, CASE WHEN lot_size > 100 THEN lot_size / 43560.0 WHEN lot_size > 0 THEN lot_size ELSE NULL END)`;
  if (minLotAcres) push(`${lotAcresExpr} >= $n`, Number(minLotAcres));
  if (maxLotAcres) push(`${lotAcresExpr} <= $n`, Number(maxLotAcres));

  // Garage: true = any garage; numeric = min spaces (1+, 2+, 3+)
  if (garage === 'true' || garage === '1+') {
    pushRaw('garage_spaces > 0');
  } else if (garage && garage !== 'false' && garage !== '') {
    const n = Number(String(garage).replace('+', ''));
    if (Number.isFinite(n) && n > 0) push('garage_spaces >= $n', n);
  }

  // Basement: true | finished | walkout | unfinished
  if (basement === 'true' || basement === 'any') {
    pushRaw(`COALESCE(features->>'basement','') NOT ILIKE '%none%' AND COALESCE(features->>'basement','') <> ''`);
  } else if (basement === 'finished') {
    pushRaw(`(features->>'basement' ILIKE '%finish%' AND features->>'basement' NOT ILIKE '%unfinish%')`);
  } else if (basement === 'walkout') {
    pushRaw(`(features->>'basement' ILIKE '%walkout%' OR features->>'basement' ILIKE '%walk-out%' OR features->>'basement' ILIKE '%walk out%')`);
  } else if (basement === 'unfinished') {
    pushRaw(`features->>'basement' ILIKE '%unfinish%'`);
  }

  if (fireplace === 'true') {
    pushRaw(`COALESCE(features->>'fireplaces','') <> '' AND COALESCE(features->>'fireplaces','') NOT ILIKE 'none%' AND COALESCE(features->>'fireplaces','') NOT ILIKE 'no %'`);
  }
  if (hasPool === 'true') {
    pushRaw(`COALESCE(features->>'pool','') NOT ILIKE 'n%' AND COALESCE(features->>'pool','') <> '' AND COALESCE(features->>'pool','') NOT ILIKE 'none%'`);
  }
  if (newConstruction === 'true') {
    pushRaw(`(features->>'new_construction' = 'true' OR features->>'new_construction' = 'Yes')`);
  }
  if (waterfront === 'true') {
    pushRaw(`(features->>'waterfront' = 'true' OR features->>'waterfront' = 'Yes' OR COALESCE(features->>'water_body','') <> '')`);
  }
  if (newDays) push('days_on_market <= $n', Number(newDays));

  // Stories / levels
  if (stories === '1') {
    pushRaw(`(features->>'levels' ILIKE 'one%' OR features->>'levels' ILIKE '%one story%' OR features->>'levels' = '1')`);
  } else if (stories === '2') {
    pushRaw(`(features->>'levels' ILIKE '%two%' OR features->>'levels' = '2')`);
  } else if (stories === '3' || stories === '3+') {
    pushRaw(`(features->>'levels' ILIKE '%three%' OR features->>'levels' ILIKE '%3%' OR features->>'levels' ILIKE '%four%')`);
  }

  // Feature keyword filters — json keys are fixed allow-list only (never user input)
  const addFeatureMatch = (jsonKey, value) => {
    if (!value) return;
    where.push(`COALESCE(features->>'${jsonKey}','') ILIKE $${i}`);
    params.push(`%${String(value).toLowerCase()}%`);
    i += 1;
  };

  if (cooling) {
    if (cooling === 'central') addFeatureMatch('cooling', 'central');
    else if (cooling === 'evaporative' || cooling === 'swamp') addFeatureMatch('cooling', 'evapor');
    else if (cooling === 'wall' || cooling === 'window') addFeatureMatch('cooling', 'wall');
    else if (cooling === 'ductless' || cooling === 'mini-split') addFeatureMatch('cooling', 'ductless');
    else if (cooling === 'none') {
      pushRaw(`(COALESCE(features->>'cooling','') = '' OR features->>'cooling' ILIKE '%none%' OR features->>'cooling' ILIKE '%no %')`);
    } else addFeatureMatch('cooling', cooling);
  }
  if (heating) {
    if (heating === 'forced' || heating === 'forced-air') addFeatureMatch('heating', 'forced');
    else if (heating === 'heat-pump' || heating === 'heatpump') addFeatureMatch('heating', 'heat pump');
    else if (heating === 'radiant') addFeatureMatch('heating', 'radiant');
    else if (heating === 'baseboard') addFeatureMatch('heating', 'baseboard');
    else addFeatureMatch('heating', heating);
  }
  if (parking) {
    if (parking === 'attached') addFeatureMatch('parking', 'attached');
    else if (parking === 'detached') addFeatureMatch('parking', 'detached');
    else if (parking === 'carport') addFeatureMatch('parking', 'carport');
    else if (parking === 'none') {
      pushRaw(`(COALESCE(features->>'parking','') ILIKE '%none%' OR COALESCE(features->>'parking','') = '' OR features->>'parking' ILIKE '%no garage%')`);
    } else addFeatureMatch('parking', parking);
  }
  if (view) {
    if (view === 'mountain') addFeatureMatch('view', 'mountain');
    else if (view === 'water') addFeatureMatch('view', 'water');
    else if (view === 'city') addFeatureMatch('view', 'city');
    else if (view === 'golf') addFeatureMatch('view', 'golf');
    else if (view === 'park') addFeatureMatch('view', 'park');
    else if (view === 'plains' || view === 'plains-view') addFeatureMatch('view', 'plains');
    else if (view === 'hills') addFeatureMatch('view', 'hills');
    else addFeatureMatch('view', view);
  }
  if (style) {
    // ArchitecturalStyle values in IRES are sparse (mostly Contemporary).
    // Map Zillow-style tokens to real substrings; never invent matches.
    if (style === 'mid' || style === 'mid-century' || style === 'midcentury') {
      pushRaw(`(features->>'style' ILIKE '%mid%' OR features->>'style' ILIKE '%century%')`);
    } else if (style === 'ranch') {
      // Ranch rarely appears as ArchitecturalStyle; also match Levels "Raised Ranch"
      pushRaw(`(features->>'style' ILIKE '%ranch%' OR features->>'levels' ILIKE '%ranch%')`);
    } else if (style === 'patio' || style === 'patio-home') {
      addFeatureMatch('style', 'patio');
    } else if (style === 'cottage') {
      addFeatureMatch('style', 'cottage');
    } else if (style === 'farmhouse') {
      addFeatureMatch('style', 'farmhouse');
    } else if (style === 'chalet') {
      addFeatureMatch('style', 'chalet');
    } else {
      addFeatureMatch('style', style);
    }
  }
  if (community) {
    if (community === '55+' || community === '55') {
      pushRaw(`(features->>'community' ILIKE '%55%' OR features->>'community' ILIKE '%senior%' OR features->>'community' ILIKE '%adult%' OR COALESCE(description,'') ILIKE '%55+%' OR COALESCE(description,'') ILIKE '%55 +%')`);
    } else if (community === 'gated') {
      pushRaw(`(features->>'community' ILIKE '%gated%' OR features->>'lot_features' ILIKE '%gated%' OR COALESCE(description,'') ILIKE '%gated%')`);
    } else if (community === 'golf') {
      pushRaw(`(features->>'community' ILIKE '%golf%' OR features->>'lot_features' ILIKE '%golf%' OR features->>'view' ILIKE '%golf%')`);
    } else {
      addFeatureMatch('community', community);
    }
  }
  if (exterior) {
    // Exterior often lives in construction materials
    where.push(`(COALESCE(features->>'exterior','') ILIKE $${i} OR COALESCE(features->>'construction','') ILIKE $${i})`);
    params.push(`%${String(exterior).toLowerCase()}%`);
    i += 1;
  }

  // Interior feature keywords (comma-separated): fireplace, wet-bar, walk-in, solar, ev, office
  if (interior) {
    const tokens = String(interior).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    for (const tok of tokens) {
      if (tok === 'fireplace' || tok === 'fireplaces') {
        pushRaw(`COALESCE(features->>'fireplaces','') <> '' AND COALESCE(features->>'fireplaces','') NOT ILIKE 'none%'`);
      } else if (tok === 'wet-bar' || tok === 'wetbar') {
        pushRaw(`features->>'interior' ILIKE '%wet bar%'`);
      } else if (tok === 'walk-in' || tok === 'walkin') {
        pushRaw(`features->>'interior' ILIKE '%walk-in%'`);
      } else if (tok === 'solar') {
        pushRaw(`(features->>'interior' ILIKE '%solar%' OR features->>'green_efficient' ILIKE '%solar%' OR features->>'other_equipment' ILIKE '%solar%')`);
      } else if (tok === 'ev' || tok === 'ev-charging') {
        pushRaw(`(features->>'interior' ILIKE '%ev %' OR features->>'other_equipment' ILIKE '%ev %' OR features->>'parking' ILIKE '%ev %' OR features->>'interior' ILIKE '%electric vehicle%' OR features->>'other_equipment' ILIKE '%charger%')`);
      } else if (tok === 'office' || tok === 'home-office') {
        pushRaw(`(features->>'interior' ILIKE '%office%' OR features->>'interior' ILIKE '%study%' OR features->>'interior' ILIKE '%den%')`);
      } else if (tok === 'smart' || tok === 'smart-home') {
        pushRaw(`features->>'interior' ILIKE '%smart%'`);
      } else {
        // Generic interior text match (safe: bound param)
        where.push(`COALESCE(features->>'interior','') ILIKE $${i}`);
        params.push(`%${tok}%`);
        i += 1;
      }
    }
  }

  // Editable price-drop filter: price changed within dropDays days AND current
  // list price is at least dropPct% below the original list price.
  if (dropDays) push('price_change_timestamp >= NOW() - make_interval(days => $n)', Number(dropDays));
  if (dropPct) push('original_list_price IS NOT NULL AND list_price IS NOT NULL AND list_price <= original_list_price * (1 - $n / 100.0)', Number(dropPct));

  // Legacy listing status chips (overlay on Active inventory) — superseded by
  // the editable controls above but kept for old URLs. Home-status values in
  // listingStatus are already resolved into `status` above.
  if (listingStatus === 'price-drop' || listingStatus === 'price_drop') {
    pushRaw(`original_list_price IS NOT NULL AND list_price IS NOT NULL AND list_price < original_list_price`);
  } else if (listingStatus === 'new') {
    pushRaw(`(days_on_market IS NOT NULL AND days_on_market <= 7)`);
  }

  if (hasImages === 'true') {
    pushRaw(`(COALESCE(photos_count, 0) > 0 OR jsonb_array_length(COALESCE(photos, '[]'::jsonb)) > 0)`);
  }
  if (hasTour === 'true' || has3d === 'true') {
    pushRaw(`COALESCE(features->>'virtual_tour','') <> ''`);
  }

  // Assumable VA/FHA/USDA signal — derived at sync from remarks text
  // (description ILIKE '%assum%'). Combine with city/price/beds like any other filter.
  if (assumable === 'true' || assumable === true || assumable === '1') {
    pushRaw('assumable = TRUE');
  }

  return { where, params, i };
}

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------

const NUMBER_KEYS = [
  'minPrice', 'maxPrice', 'beds', 'baths', 'minSqft', 'maxSqft', 'minYear', 'maxYear',
  'maxHoa', 'minHoa', 'newDays', 'dropDays', 'dropPct', 'minLotAcres', 'maxLotAcres',
];
const BOOLEAN_KEYS = [
  'pool', 'waterfront', 'newConstruction', 'fireplace', 'hasImages', 'hasTour', 'has3d', 'assumable',
];
// Short option tokens chosen from the search page's menus.
const TOKEN_KEYS = [
  'basement', 'stories', 'cooling', 'heating', 'parking', 'view', 'style', 'community',
  'exterior', 'keywordMode', 'listingStatus', 'sort',
];
const TOKEN_RE = /^[A-Za-z0-9 +\-_.]{1,40}$/;
const LIST_RE = /^[A-Za-z0-9 +\-_.,]{1,200}$/;
const CITY_RE = /^[A-Za-z .'\-,_]{1,300}$/;
const MAX_POLYGON_VERTICES = 200;

/** Every key a saved search may store: exactly what the search page sends. */
export const SAVED_FILTER_KEYS = [
  'city', 'postal_code', 'polygon', 'types', 'type', 'status', 'q', 'keywords',
  'garage', 'interior', ...NUMBER_KEYS, ...BOOLEAN_KEYS, ...TOKEN_KEYS,
];

function truthy(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/**
 * Keep every filter the search page understands, validated, and nothing else.
 * Values are stored as strings, the way they arrive in a search URL.
 */
export function sanitizeSavedFilters(body = {}) {
  const out = {};
  const b = body || {};

  const city = b.city != null ? String(b.city).trim() : '';
  if (city && CITY_RE.test(city)) out.city = city;

  const zipRaw = b.postal_code ?? b.postalCode ?? b.zip ?? b.zipCode ?? b.zips;
  if (zipRaw != null && zipRaw !== '') {
    const zips = String(zipRaw).split(',').map((z) => z.trim()).filter((z) => /^\d{5}$/.test(z)).slice(0, 20);
    if (zips.length) out.postal_code = zips.join(',');
  }

  if (b.polygon) {
    const ring = parsePolygonRing(String(b.polygon).slice(0, 20000));
    if (ring && ring.length <= MAX_POLYGON_VERTICES) {
      out.polygon = ring.map(([lng, lat]) => `${+lng.toFixed(6)},${+lat.toFixed(6)}`).join(';');
    }
  }

  for (const key of ['types', 'type', 'interior']) {
    const v = b[key] != null ? String(b[key]).trim() : '';
    if (v && LIST_RE.test(v)) out[key] = v;
  }

  const status = b.status != null ? String(b.status).trim() : '';
  if (status && (HOME_STATUS_VALUES.has(status) || status === 'any')) out.status = status;

  for (const key of ['q', 'keywords']) {
    const v = b[key] != null ? String(b[key]).trim() : '';
    if (v) out[key] = v.slice(0, 200);
  }

  if (b.garage != null && b.garage !== '') {
    const g = String(b.garage).trim();
    if (g === 'true' || /^[1-9]\+?$/.test(g)) out.garage = g;
  }

  for (const key of NUMBER_KEYS) {
    const v = b[key];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n < 1e9) out[key] = String(n);
  }
  for (const key of BOOLEAN_KEYS) {
    if (truthy(b[key])) out[key] = 'true';
  }
  for (const key of TOKEN_KEYS) {
    const v = b[key] != null ? String(b[key]).trim() : '';
    if (v && TOKEN_RE.test(v)) out[key] = v;
  }
  return out;
}

/**
 * WHERE clause for a saved search's alerts. Same builder as the search page;
 * alerts are always about homes for sale now, so status is pinned to Active.
 */
export function buildSavedSearchWhere(filters = {}) {
  const f = { ...(filters || {}) };
  delete f.status;
  if (HOME_STATUS_VALUES.has(String(f.listingStatus || ''))) delete f.listingStatus;
  if (!f.city && !f.postal_code && !f.polygon) f.city = '__noco__';
  const { where, params } = buildListingFilters({ ...f, status: 'Active' });
  return { whereSql: where.join(' AND '), params };
}

/** /properties/ link that reopens a saved search exactly as it was saved. */
export function savedSearchPath(filters = {}) {
  const params = new URLSearchParams();
  for (const key of SAVED_FILTER_KEYS) {
    const v = filters?.[key];
    if (v === undefined || v === null || v === '') continue;
    if (key === 'city' && v === '__noco__') continue;
    params.set(key, String(v));
  }
  const qs = params.toString();
  return qs ? `/properties/?${qs}` : '/properties/';
}
