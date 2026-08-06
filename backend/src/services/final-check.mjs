import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const s = await pool.query(`SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE elementary_school IS NOT NULL) AS w_schools,
    COUNT(*) FILTER (WHERE high_school IS NOT NULL) AS w_hs,
    COUNT(*) FILTER (WHERE (features->>'virtual_tour') IS NOT NULL) AS w_tours,
    COUNT(*) FILTER (WHERE original_list_price > list_price) AS price_cuts,
    COUNT(*) FILTER (WHERE days_on_market IS NOT NULL) AS w_dom
    FROM listings WHERE is_active`);
  console.log(JSON.stringify(s.rows[0]));
} catch (e) { console.log('ERR', e.message); }
await pool.end();
