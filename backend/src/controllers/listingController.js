import getPool from '../config/database.js';
import { NOCO_CITIES } from '../config/nocoCities.js';
import { buildListingFilters } from '../services/listingFilters.js';
import { matchRatingsForListing } from '../services/greatSchoolsSync.js';

/**
 * Listing search + detail API — powers /properties/ search and
 * /homes-for-sale/{slug}/ detail pages.
 *
 * Filters map to real IRES columns / features JSONB only.
 * Never fabricate a filter that cannot hit live data.
 */

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
         year_built, garage_spaces, hoa_fee, description, assumable, photos, photos_count, latitude, longitude, slug,
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
    // All aggregates are computed from live Active listings only — never editorialized.
    // price_per_sqft median ignores nulls; DOM median ignores nulls.
    const r = await pool.query(
      `SELECT COUNT(*) AS total,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY list_price) AS median_price,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_sqft)
                FILTER (WHERE price_per_sqft IS NOT NULL AND price_per_sqft > 0) AS median_price_per_sqft,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_on_market)
                FILTER (WHERE days_on_market IS NOT NULL) AS median_days_on_market,
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
        median_price_per_sqft: row.median_price_per_sqft != null ? Math.round(Number(row.median_price_per_sqft)) : null,
        median_days_on_market: row.median_days_on_market != null ? Math.round(Number(row.median_days_on_market)) : null,
        min_price: row.min_price != null ? Math.round(Number(row.min_price)) : null,
        max_price: row.max_price != null ? Math.round(Number(row.max_price)) : null,
        avg_price: row.avg_price != null ? Math.round(Number(row.avg_price)) : null,
        residential: parseInt(row.residential || 0, 10),
        condo_townhome: parseInt(row.condo_townhome || 0, 10),
        land: parseInt(row.land || 0, 10),
        city: city || null,
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
    // Attach GreatSchools ratings when school fields match the cache (never fabricate)
    try {
      listing.schools = await matchRatingsForListing(listing);
    } catch (schoolErr) {
      console.warn('school ratings lookup failed:', schoolErr.message);
      listing.schools = [];
    }
    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Listing fetch failed:', error);
    res.status(500).json({ success: false, error: 'Fetch failed' });
  }
};

/**
 * GET /api/listings/locations?q=den&limit=15
 * Type-ahead for city + ZIP with live Active listing counts from the DB.
 * Counts are never hardcoded (gate 6). Empty q returns top cities by volume.
 */
export const autocompleteLocations = async (req, res) => {
  try {
    const pool = getPool();
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 15), 40);
    const looksLikeZip = /^\d{1,5}$/.test(q);

    // Special scoped options (always available; counts from live DB)
    const nocoRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM listings
       WHERE is_active = TRUE AND status = 'Active' AND city = ANY($1::text[])`,
      [NOCO_CITIES]
    );
    const allRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM listings
       WHERE is_active = TRUE AND status = 'Active'`
    );
    const specials = [
      {
        type: 'scope',
        value: '__noco__',
        label: 'Northern Colorado',
        count: nocoRes.rows[0]?.cnt || 0,
      },
      {
        type: 'scope',
        value: '__all__',
        label: 'All Colorado',
        count: allRes.rows[0]?.cnt || 0,
      },
    ];

    let cities = [];
    let zips = [];

    if (!q) {
      const cityRes = await pool.query(
        `SELECT city AS value, COUNT(*)::int AS cnt
         FROM listings
         WHERE is_active = TRUE AND status = 'Active'
           AND city IS NOT NULL AND BTRIM(city) <> ''
         GROUP BY city
         ORDER BY cnt DESC
         LIMIT $1`,
        [limit]
      );
      cities = cityRes.rows.map((r) => ({
        type: 'city',
        value: r.value,
        label: r.value,
        count: r.cnt,
      }));
    } else if (looksLikeZip) {
      const zipRes = await pool.query(
        `SELECT postal_code AS value, COUNT(*)::int AS cnt
         FROM listings
         WHERE is_active = TRUE AND status = 'Active'
           AND postal_code IS NOT NULL AND postal_code LIKE $1
         GROUP BY postal_code
         ORDER BY cnt DESC
         LIMIT $2`,
        [`${q}%`, limit]
      );
      zips = zipRes.rows.map((r) => ({
        type: 'zip',
        value: r.value,
        label: r.value,
        count: r.cnt,
      }));
      // Also surface cities whose names start with digit-less partial? skip.
      // If full 5-digit yields few zips, still return city name matches for "8" etc. — only digits here.
    } else {
      const cityRes = await pool.query(
        `SELECT city AS value, COUNT(*)::int AS cnt
         FROM listings
         WHERE is_active = TRUE AND status = 'Active'
           AND city IS NOT NULL AND city ILIKE $1
         GROUP BY city
         ORDER BY
           CASE WHEN LOWER(city) = LOWER($2) THEN 0
                WHEN LOWER(city) LIKE LOWER($3) THEN 1
                ELSE 2 END,
           cnt DESC
         LIMIT $4`,
        [`%${q}%`, q, `${q}%`, limit]
      );
      cities = cityRes.rows.map((r) => ({
        type: 'city',
        value: r.value,
        label: r.value,
        count: r.cnt,
      }));
    }

    // When typing a city-like string, still offer matching zips if query has digits mixed — rare.

    // Filter specials by query (optional type-ahead for "colo", "north")
    const qLower = q.toLowerCase();
    const specialFiltered = !q
      ? specials
      : specials.filter(
        (s) =>
          s.label.toLowerCase().includes(qLower)
          || s.value.toLowerCase().includes(qLower)
          || (qLower === 'co' || qLower.startsWith('col') || qLower.includes('colorado'))
      );

    res.json({
      success: true,
      data: {
        specials: specialFiltered,
        cities,
        zips,
        nocoCities: NOCO_CITIES,
      },
    });
  } catch (error) {
    console.error('Location autocomplete failed:', error);
    res.status(500).json({ success: false, error: 'Autocomplete failed' });
  }
};
