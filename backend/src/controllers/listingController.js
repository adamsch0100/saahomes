import getPool from '../config/database.js';

/**
 * Listing search + detail API — powers /properties/ search and
 * /homes-for-sale/{slug}/ detail pages.
 *
 * Filters map to real IRES columns / features JSONB only.
 * Never fabricate a filter that cannot hit live data.
 */

// The 19 Northern Colorado cities we own (market-dominance scope).
// The search page defaults to these; __all__ opts into the whole state.
const NOCO_CITIES = [
  'Fort Collins', 'Loveland', 'Windsor', 'Greeley', 'Timnath', 'Wellington',
  'Johnstown', 'Eaton', 'Milliken', 'La Salle', 'Mead', 'Longmont', 'Boulder',
  'Berthoud', 'Firestone', 'Frederick', 'Evans', 'Severance', 'Niwot',
];

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
 * Build WHERE clause + bind params from req.query.
 * Shared by main search and city facets so they never drift.
 */
function buildListingFilters(query = {}) {
  const {
    city, minPrice, maxPrice, beds, baths, type, types, status = 'Active',
    q, keywords,
    minSqft, maxSqft, minYear, maxYear, maxHoa, minHoa,
    garage, basement, fireplace, pool: hasPool,
    newConstruction, waterfront, newDays,
    minLotAcres, maxLotAcres, stories,
    cooling, heating, parking, view, style, community, exterior,
    interior, // comma-separated interior feature keywords
    listingStatus, // price-drop | new | active
    hasImages, hasTour, has3d,
  } = query;

  const where = [];
  const params = [];
  let i = 1;

  const push = (sql, value) => {
    where.push(sql.replace(/\$n/g, () => `$${i++}`));
    if (value !== undefined) params.push(value);
  };
  const pushRaw = (sql) => { where.push(sql); };

  pushRaw('is_active = TRUE');

  // Status: Active default; listingStatus=price-drop overlays price-cut filter
  // without changing MLS status unless explicitly non-Active.
  if (status && status !== 'any' && status !== 'all') {
    push('status = $n', status);
  }

  if (city === '__noco__') {
    push('city = ANY($n::text[])', NOCO_CITIES);
  } else if (city && city !== '__all__') {
    push('LOWER(city) = LOWER($n)', city);
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
    // One bind reused across OR clauses (Postgres allows same $n multiple times)
    const p = `%${searchText.toLowerCase()}%`;
    where.push(
      `(LOWER(city) LIKE $${i} OR LOWER(street_name) LIKE $${i} OR LOWER(COALESCE(description,'')) LIKE $${i} OR LOWER(COALESCE(subdivision,'')) LIKE $${i})`
    );
    params.push(p);
    i += 1;
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
  if (view) addFeatureMatch('view', view);
  if (style) addFeatureMatch('style', style);
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

  // Listing status chips (overlay on Active inventory)
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

  return { where, params, i };
}

function orderBySql(sort) {
  switch (sort) {
    case 'price-asc':
      return 'list_price ASC NULLS LAST';
    case 'price-desc':
      return 'list_price DESC NULLS LAST';
    case 'price-sqft':
    case 'price-per-sqft':
      return 'price_per_sqft ASC NULLS LAST, list_price ASC NULLS LAST';
    case 'price-sqft-desc':
      return 'price_per_sqft DESC NULLS LAST';
    case 'lot-size':
    case 'lot-desc':
      return 'COALESCE(lot_size_acres, lot_size) DESC NULLS LAST';
    case 'lot-asc':
      return 'COALESCE(lot_size_acres, lot_size) ASC NULLS LAST';
    case 'sqft':
    case 'sqft-desc':
      return 'living_area DESC NULLS LAST';
    case 'sqft-asc':
      return 'living_area ASC NULLS LAST';
    case 'days':
    case 'dom':
    case 'days-on-market':
      return 'days_on_market ASC NULLS LAST, updated_at DESC';
    case 'recommended':
      // Prefer newly listed / recently updated actives
      return `CASE WHEN days_on_market IS NOT NULL AND days_on_market <= 14 THEN 0 ELSE 1 END, updated_at DESC`;
    case 'newest':
    default:
      return 'updated_at DESC';
  }
}

export const searchListings = async (req, res) => {
  try {
    const pool = getPool();
    const { page = 1, limit = 24, sort = 'newest' } = req.query;

    const { where, params, i: nextI } = buildListingFilters(req.query);
    const whereSql = where.join(' AND ');
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const orderSql = orderBySql(sort);

    const countRes = await pool.query(`SELECT COUNT(*) FROM listings WHERE ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    let i = nextI;
    const dataRes = await pool.query(
      `SELECT id, listing_id, status, property_type, property_subtype, home_type, street_number, street_name, unit,
         city, state, postal_code, list_price, original_list_price, beds, baths, living_area, lot_size, lot_size_acres,
         year_built, garage_spaces, hoa_fee, description, photos, photos_count, latitude, longitude, slug,
         updated_at, days_on_market, price_per_sqft, subdivision
       FROM listings WHERE ${whereSql} ORDER BY ${orderSql} LIMIT $${i} OFFSET $${i + 1}`,
      [...params, Number(limit), offset]
    );

    // City facet counts — same filters (including city scope)
    const facetRes = await pool.query(
      `SELECT city, COUNT(*) AS cnt FROM listings
       WHERE ${whereSql} AND city IS NOT NULL
       GROUP BY city ORDER BY cnt DESC LIMIT 20`,
      params
    );

    res.json({
      success: true,
      data: dataRes.rows,
      facets: facetRes.rows,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) || 0 },
    });
  } catch (error) {
    console.error('Listing search failed:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
};

export const getListingStats = async (req, res) => {
  try {
    const pool = getPool();
    const { city } = req.query;
    const params = [];
    let where = 'is_active = TRUE AND status = \'Active\'';
    if (city) {
      params.push(city);
      where += ` AND LOWER(city) = LOWER($${params.length})`;
    }
    const r = await pool.query(
      `SELECT COUNT(*) AS total,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY list_price) AS median_price,
              MIN(list_price) AS min_price,
              MAX(list_price) AS max_price,
              ROUND(AVG(list_price)) AS avg_price,
              COUNT(*) FILTER (WHERE property_type ILIKE '%residential%' OR property_type = 'Residential') AS residential,
              COUNT(*) FILTER (WHERE property_subtype ILIKE '%condo%' OR property_subtype ILIKE '%town%' OR property_subtype ILIKE '%attached%' OR property_type ILIKE '%condo%') AS condo_townhome,
              COUNT(*) FILTER (WHERE property_type ILIKE '%land%' OR property_type ILIKE '%lot%') AS land
       FROM listings WHERE ${where}`,
      params
    );
    const row = r.rows[0] || {};
    res.json({
      success: true,
      data: {
        total: parseInt(row.total || 0, 10),
        median_price: row.median_price != null ? Math.round(Number(row.median_price)) : null,
        min_price: row.min_price != null ? Math.round(Number(row.min_price)) : null,
        max_price: row.max_price != null ? Math.round(Number(row.max_price)) : null,
        avg_price: row.avg_price != null ? Math.round(Number(row.avg_price)) : null,
        residential: parseInt(row.residential || 0, 10),
        condo_townhome: parseInt(row.condo_townhome || 0, 10),
        land: parseInt(row.land || 0, 10),
      },
    });
  } catch (error) {
    console.error('Listing stats failed:', error);
    res.status(500).json({ success: false, error: 'Stats failed' });
  }
};

export const getListingBySlug = async (req, res) => {
  try {
    const pool = getPool();
    const { slug } = req.params;
    const result = await pool.query(
      `SELECT * FROM listings WHERE slug = $1 OR listing_id = $2`,
      [slug, slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    const listing = result.rows[0];
    if (listing.raw) {
      delete listing.raw;
    }
    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Listing fetch failed:', error);
    res.status(500).json({ success: false, error: 'Fetch failed' });
  }
};
