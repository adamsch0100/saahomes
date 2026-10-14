import getPool from '../config/database.js';
import { NOCO_CITIES } from '../config/nocoCities.js';
import { buildListingFilters } from '../services/listingFilters.js';
import { matchRatingsForListing } from '../services/greatSchoolsSync.js';
import { localFactsForListing } from '../services/localFacts.js';
import { sessionUserId } from '../services/events.js';
import { getTasteProfile, passedListingKeys, scoreListing } from '../services/tasteProfile.js';
import {
  attributionFor, decorateCards, feedFilterSql, listingScope, mlsNumber, serviceAreaSql, serviceAreaValues,
} from '../services/feeds.js';

// "Best for you" ranks this many of the freshest matches, then pages through them.
const BEST_FOR_YOU_POOL = 500;

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
    const { page = 1, limit = 24 } = req.query;
    let { sort = 'newest' } = req.query;

    const scope = await listingScope(req.tenant, { pool });
    const { where, params, i: nextI } = buildListingFilters(req.query, scope);
    let i = nextI;

    // Signed-in buyers: hide homes they marked Not for me, and know their taste.
    const userId = await sessionUserId(req, pool);
    let profile = null;
    let hidden = 0;
    if (userId) {
      const [passed, taste] = await Promise.all([
        passedListingKeys(userId, pool).catch(() => []),
        getTasteProfile(userId, pool).catch(() => null),
      ]);
      profile = taste;
      hidden = passed.length;
      if (passed.length && req.query.show_hidden !== '1') {
        where.push(`listing_id <> ALL($${i}::text[])`);
        params.push(passed);
        i += 1;
      }
      res.set('Cache-Control', 'private, no-store');
    }
    const best = sort === 'best' && profile?.ready;
    if (sort === 'best' && !best) sort = 'recommended';

    const whereSql = where.join(' AND ');
    const pageNum = Math.max(1, Number(page));
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;
    const orderSql = orderBySql(best ? 'recommended' : sort);

    const countRes = await pool.query(`SELECT COUNT(*) FROM listings WHERE ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const columns = `id, listing_id, status, property_type, property_subtype, home_type, street_number, street_name, unit,
         city, state, postal_code, list_price, original_list_price, beds, baths, living_area, lot_size, lot_size_acres,
         year_built, garage_spaces, hoa_fee, description, assumable, photos, photos_count, latitude, longitude, slug,
         updated_at, days_on_market, price_per_sqft, subdivision, feed, list_office_name`;
    let rows;
    let pages = Math.ceil(total / limitNum) || 0;
    if (best) {
      const candidates = await pool.query(
        `SELECT ${columns} FROM listings WHERE ${whereSql} ORDER BY ${orderSql} LIMIT $${i}`,
        [...params, BEST_FOR_YOU_POOL]
      );
      const ranked = candidates.rows
        .map((row, idx) => ({ row, idx, match: scoreListing(row, profile) }))
        .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0) || a.idx - b.idx);
      rows = ranked.slice(offset, offset + limitNum).map((r) => ({ ...r.row, match: r.match }));
      pages = Math.ceil(Math.min(total, BEST_FOR_YOU_POOL) / limitNum) || 0;
    } else {
      const dataRes = await pool.query(
        `SELECT ${columns} FROM listings WHERE ${whereSql} ORDER BY ${orderSql} LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limitNum, offset]
      );
      rows = profile?.ready
        ? dataRes.rows.map((row) => ({ ...row, match: scoreListing(row, profile) }))
        : dataRes.rows;
    }

    // City facet counts — same filters (including city scope)
    const facetRes = await pool.query(
      `SELECT city, COUNT(*) AS cnt FROM listings
       WHERE ${whereSql} AND city IS NOT NULL
       GROUP BY city ORDER BY cnt DESC LIMIT 20`,
      params
    );

    rows = await decorateCards(rows, { pool });

    res.json({
      success: true,
      data: rows,
      facets: facetRes.rows,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages,
        sort: best ? 'best' : sort,
        taste: userId ? { ready: Boolean(profile?.ready), hidden } : null,
      },
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
    const scope = await listingScope(req.tenant, { pool });
    const params = [scope.feeds];
    let where = `is_active = TRUE AND status = 'Active' AND ${feedFilterSql('$1', scope.feeds)}`;
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
    const scope = await listingScope(req.tenant, { pool });
    // A home outside this brokerage's feeds doesn't exist here; a sold home
    // only when that feed's sold data is on.
    const result = await pool.query(
      `SELECT * FROM listings WHERE (slug = $1 OR listing_id = $1)
         AND feed = ANY(CASE WHEN status = 'Sold' THEN $3::text[] ELSE $2::text[] END)
       LIMIT 1`,
      [slug, scope.feeds, scope.soldFeeds]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    const listing = result.rows[0];
    if (listing.raw) {
      delete listing.raw;
    }
    listing.sample = listing.feed === 'demo';
    listing.mls_number = mlsNumber(listing);
    listing.attribution = await attributionFor(listing, req.tenant, { pool });
    listing.courtesy = listing.attribution.courtesy;
    // Attach GreatSchools ratings when school fields match the cache (never fabricate)
    try {
      listing.schools = await matchRatingsForListing(listing);
    } catch (schoolErr) {
      console.warn('school ratings lookup failed:', schoolErr.message);
      listing.schools = [];
    }
    try {
      listing.local_facts = await localFactsForListing(listing, pool, { feeds: scope.feeds });
    } catch (factsErr) {
      console.warn('local facts failed:', factsErr.message);
      listing.local_facts = null;
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
    const scope = await listingScope(req.tenant, { pool });
    const feedSql = feedFilterSql('$1', scope.feeds);

    // Special scoped options (always available; counts from live DB). The
    // default scope is SAA's Northern Colorado, or another brokerage's
    // service areas (everything it shows when it has none).
    const areas = serviceAreaValues(scope.serviceAreas);
    const nocoRes = areas.length
      ? await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM listings
         WHERE is_active = TRUE AND status = 'Active' AND ${feedSql} AND ${serviceAreaSql('$2')}`,
        [scope.feeds, areas]
      )
      : scope.home
        ? await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM listings
           WHERE is_active = TRUE AND status = 'Active' AND ${feedSql} AND city = ANY($2::text[])`,
          [scope.feeds, NOCO_CITIES]
        )
        : null;
    const allRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM listings
       WHERE is_active = TRUE AND status = 'Active' AND ${feedSql}`,
      [scope.feeds]
    );
    const specials = [
      {
        type: 'scope',
        value: '__noco__',
        label: 'Northern Colorado',
        count: (nocoRes || allRes).rows[0]?.cnt || 0,
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
         WHERE is_active = TRUE AND status = 'Active' AND ${feedSql}
           AND city IS NOT NULL AND BTRIM(city) <> ''
         GROUP BY city
         ORDER BY cnt DESC
         LIMIT $2`,
        [scope.feeds, limit]
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
         WHERE is_active = TRUE AND status = 'Active' AND ${feedSql}
           AND postal_code IS NOT NULL AND postal_code LIKE $2
         GROUP BY postal_code
         ORDER BY cnt DESC
         LIMIT $3`,
        [scope.feeds, `${q}%`, limit]
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
         WHERE is_active = TRUE AND status = 'Active' AND ${feedSql}
           AND city IS NOT NULL AND city ILIKE $2
         GROUP BY city
         ORDER BY
           CASE WHEN LOWER(city) = LOWER($3) THEN 0
                WHEN LOWER(city) LIKE LOWER($4) THEN 1
                ELSE 2 END,
           cnt DESC
         LIMIT $5`,
        [scope.feeds, `%${q}%`, q, `${q}%`, limit]
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
