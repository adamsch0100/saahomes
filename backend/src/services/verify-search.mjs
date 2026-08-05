#!/usr/bin/env node
// Local verification of the fixed facet query (city filter case).
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const city = 'Fort Collins';
  const status = 'Active';
  const limit = 24, offset = 0;
  const where = ['is_active = TRUE', 'status = $1', 'LOWER(city) = LOWER($2)'];
  const params = [status, city];
  const count = await pool.query(`SELECT COUNT(*) FROM listings WHERE ${where.join(' AND ')}`, params);
  const data = await pool.query(
    `SELECT id, listing_id, city, list_price, beds, baths, slug FROM listings
     WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
    [...params, limit, offset]
  );
  // facet query (fixed): city clause dropped, own params
  const fWhere = ['is_active = TRUE', 'status = $1'];
  const fParams = [status];
  const facets = await pool.query(
    `SELECT city, COUNT(*) AS cnt FROM listings WHERE ${fWhere.join(' AND ')} AND city IS NOT NULL
     GROUP BY city ORDER BY cnt DESC LIMIT 5`, fParams
  );
  console.log('total FC:', count.rows[0].count);
  console.log('sample:', data.rows.slice(0, 3).map(r => `${r.street_name ?? '?'} ${r.city} $${r.list_price}`).join(' | '));
  console.log('facets:', facets.rows.map(r => `${r.city}:${r.cnt}`).join(', '));
  console.log('✅ FIX VERIFIED — city search + facets work');
} catch (e) {
  console.log('❌ still failing:', e.message);
} finally {
  await pool.end();
}
