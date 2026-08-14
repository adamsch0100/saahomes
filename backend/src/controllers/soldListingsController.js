import getPool from '../config/database.js';
import { NOCO_CITIES, resolveSoldCity } from '../config/nocoCities.js';

/**
 * GET /api/sold-listings?city=<slug>&limit=N
 *
 * Real Closed rows from sold_listings only. Empty array when nothing matches.
 * Never fabricates a price, date, or DOM. Raw MLS photo URLs are never returned.
 */
export async function listSoldListings(req, res) {
  try {
    const resolved = resolveSoldCity(req.query.city);
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(50, Math.max(1, Math.trunc(limitRaw)))
      : 12;

    const pool = getPool();
    const params = [];
    const where = [
      "closed_date IS NOT NULL",
      "closed_date >= (CURRENT_DATE - INTERVAL '12 months')",
      'sold_price IS NOT NULL',
    ];

    if (resolved.unknown) {
      return res.json({
        success: true,
        city: String(req.query.city).trim(),
        citySlug: '',
        count: 0,
        listings: [],
      });
    }

    if (resolved.city) {
      params.push(resolved.city);
      where.push(`city = $${params.length}`);
    } else {
      params.push(NOCO_CITIES);
      where.push(`city = ANY($${params.length}::text[])`);
    }

    params.push(limit);
    const result = await pool.query(
      `SELECT listing_id, address, street_number, street_name, unit, city, postal_code,
              sold_price, list_price, closed_date, days_on_market,
              beds, baths, living_area, home_type, photos_count, photos
         FROM sold_listings
        WHERE ${where.join(' AND ')}
        ORDER BY closed_date DESC, sold_price DESC NULLS LAST
        LIMIT $${params.length}`,
      params
    );

    const listings = result.rows.map((row) => {
      const photos = Array.isArray(row.photos) ? row.photos : [];
      const hasPhoto = photos.length > 0 || Number(row.photos_count) > 0;
      return {
        listing_id: row.listing_id,
        address: row.address || [row.street_number, row.street_name].filter(Boolean).join(' ') || null,
        city: row.city,
        postal_code: row.postal_code,
        sold_price: row.sold_price != null ? Number(row.sold_price) : null,
        list_price: row.list_price != null ? Number(row.list_price) : null,
        closed_date: row.closed_date
          ? String(row.closed_date instanceof Date ? row.closed_date.toISOString() : row.closed_date).slice(0, 10)
          : null,
        days_on_market: row.days_on_market != null ? Number(row.days_on_market) : null,
        beds: row.beds != null ? Number(row.beds) : null,
        baths: row.baths != null ? Number(row.baths) : null,
        living_area: row.living_area != null ? Number(row.living_area) : null,
        home_type: row.home_type,
        has_photo: Boolean(hasPhoto),
        // photoUrl() proxy — never a raw media.mlsgrid URL
        photo: hasPhoto ? `/api/photo/${encodeURIComponent(row.listing_id)}/0` : null,
      };
    });

    return res.json({
      success: true,
      city: resolved.label,
      citySlug: resolved.slug,
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error('sold-listings failed:', error);
    return res.status(500).json({ success: false, error: 'Sold listings unavailable', listings: [] });
  }
}
