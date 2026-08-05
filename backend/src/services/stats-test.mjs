import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const r = await pool.query(`SELECT COUNT(*) AS total,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY list_price) AS median_price,
    MIN(list_price) AS min_price, MAX(list_price) AS max_price
    FROM listings WHERE is_active = TRUE AND status = 'Active' AND LOWER(city) = LOWER('Fort Collins')`);
  console.log('stats SQL OK:', JSON.stringify(r.rows[0]));
} catch (e) {
  console.log('ERR', e.message);
}
await pool.end();
