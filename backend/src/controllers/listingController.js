import getPool from '../config/database.js';

/**
 * Listing search + detail API — powers /properties/ search and
 * /homes-for-sale/{slug}/ detail pages.
 */

const FILTER_ALIASES = {
  city: 'city',
  minPrice: 'list_price',
  maxPrice: 'list_price',
  beds: 'beds',
  baths: 'baths',
  type: 'property_type',
  status: 'status',
};

// Property-type filter → SQL. The IRES feed classifies condos/townhomes under
// property_type 'Residential' with PropertySubType (Condo/Townhouse/Attached…),
// so type filters must consult both columns.
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

export const searchListings = async (req, res) => {
  try {
    const pool = getPool();
    const {
      city, minPrice, maxPrice, beds, baths, type, status = 'Active',
      q, page = 1, limit = 24, sort = 'newest',
    } = req.query;

    const where = [];
    const params = [];
    let i = 1;

    where.push(`is_active = TRUE`);
    if (status) { where.push(`status = $${i++}`); params.push(status); }
    if (city) { where.push(`LOWER(city) = LOWER($${i++})`); params.push(city); }
    if (minPrice) { where.push(`list_price >= $${i++}`); params.push(Number(minPrice)); }
    if (maxPrice) { where.push(`list_price <= $${i++}`); params.push(Number(maxPrice)); }
    if (beds) { where.push(`beds >= $${i++}`); params.push(Number(beds)); }
    if (baths) { where.push(`baths >= $${i++}`); params.push(Number(baths)); }
    if (type) {
      if (['detached', 'attached', 'land', 'commercial', 'other'].includes(type)) {
        where.push(`home_type = $${i++}`);
        params.push(type);
      } else if (TYPE_SQL[type]) {
        where.push(TYPE_SQL[type]);
      } else {
        where.push(`property_type = $${i++}`);
        params.push(type);
      }
    }
    if (q) {
      where.push(`(LOWER(city) LIKE $${i} OR LOWER(street_name) LIKE $${i} OR LOWER(description) LIKE $${i})`);
      params.push(`%${q.toLowerCase()}%`);
      i += 1;
    }

    const whereSql = where.join(' AND ');
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    const orderSql = sort === 'price-asc' ? 'list_price ASC'
      : sort === 'price-desc' ? 'list_price DESC'
      : 'updated_at DESC';

    const countRes = await pool.query(`SELECT COUNT(*) FROM listings WHERE ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataRes = await pool.query(
      `SELECT id, listing_id, status, property_type, property_subtype, home_type, street_number, street_name, unit,
         city, state, postal_code, list_price, beds, baths, living_area, lot_size,
         year_built, description, photos, latitude, longitude, slug, updated_at, days_on_market
       FROM listings WHERE ${whereSql} ORDER BY ${orderSql} LIMIT $${i} OFFSET $${i + 1}`,
      [...params, Number(limit), offset]
    );

    // City facet counts for filter chips — rebuilt with its OWN param list so
    // placeholder positions stay consistent (the old version stripped the city
    // clause but kept its param → PG bind-count error → "Search failed").
    const fWhere = [];
    const fParams = [];
    let fi = 1;
    fWhere.push('is_active = TRUE');
    if (status) { fWhere.push(`status = $${fi++}`); fParams.push(status); }
    if (minPrice) { fWhere.push(`list_price >= $${fi++}`); fParams.push(Number(minPrice)); }
    if (maxPrice) { fWhere.push(`list_price <= $${fi++}`); fParams.push(Number(maxPrice)); }
    if (beds) { fWhere.push(`beds >= $${fi++}`); fParams.push(Number(beds)); }
    if (baths) { fWhere.push(`baths >= $${fi++}`); fParams.push(Number(baths)); }
    if (type) {
      if (['detached', 'attached', 'land', 'commercial', 'other'].includes(type)) {
        fWhere.push(`home_type = $${fi++}`);
        fParams.push(type);
      } else if (TYPE_SQL[type]) {
        fWhere.push(TYPE_SQL[type]);
      } else {
        fWhere.push(`property_type = $${fi++}`);
        fParams.push(type);
      }
    }
    if (q) {
      fWhere.push(`(LOWER(city) LIKE $${fi} OR LOWER(street_name) LIKE $${fi} OR LOWER(description) LIKE $${fi})`);
      fParams.push(`%${q.toLowerCase()}%`);
      fi += 1;
    }
    const facetRes = await pool.query(
      `SELECT city, COUNT(*) AS cnt FROM listings
       WHERE ${fWhere.join(' AND ')} AND city IS NOT NULL
       GROUP BY city ORDER BY cnt DESC LIMIT 20`,
      fParams
    );

    res.json({
      success: true,
      data: dataRes.rows,
      facets: facetRes.rows,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
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
      // Expose normalized shape; raw kept for debug only
      delete listing.raw;
    }
    res.json({ success: true, data: listing });
  } catch (error) {
    console.error('Listing fetch failed:', error);
    res.status(500).json({ success: false, error: 'Fetch failed' });
  }
};
