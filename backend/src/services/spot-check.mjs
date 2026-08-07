#!/usr/bin/env node
// Spot-check field mapping quality for 3 sample listings.
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const r = await pool.query(`
    SELECT listing_id, status, property_type, street_number, street_name, unit, city, state,
           postal_code, county, list_price, beds, baths, living_area, lot_size, year_built,
           garage_spaces, hoa_fee, latitude, longitude, slug, photos
    FROM listings WHERE city IN ('Fort Collins','Loveland','Greeley') AND is_active
    ORDER BY updated_at DESC LIMIT 3`);
  for (const row of r.rows) {
    const photos = row.photos || [];
    console.log('---');
    console.log(JSON.stringify({ ...row, photos: `${photos.length} photos` }, null, 0));
  }
  // data-quality stats
  const q = await pool.query(`
    SELECT
      count(*) FILTER (WHERE list_price IS NULL) AS null_price,
      count(*) FILTER (WHERE beds IS NULL) AS null_beds,
      count(*) FILTER (WHERE latitude IS NULL) AS null_lat,
      count(*) FILTER (WHERE photos::text = '[]') AS no_photos,
      count(*) FILTER (WHERE description IS NULL) AS null_desc
    FROM listings WHERE is_active`);
  console.log('quality:', JSON.stringify(q.rows[0]));
} catch (e) {
  console.log('DB ERROR:', e.message);
} finally {
  await pool.end();
}
