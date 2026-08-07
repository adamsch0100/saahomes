import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const total = await pool.query("SELECT COUNT(*) FROM listings WHERE status = 'Active'");
  const withPhotos = await pool.query("SELECT COUNT(*) FROM listings WHERE status = 'Active' AND jsonb_array_length(photos) > 0");
  const sample = await pool.query("SELECT slug, jsonb_array_length(photos) AS n FROM listings WHERE slug LIKE '230-n-2nd%' LIMIT 1");
  const broken = await pool.query("SELECT COUNT(*) FROM listings WHERE status = 'Active' AND jsonb_array_length(photos) = 0");
  const windrow = await pool.query("SELECT slug, jsonb_array_length(photos) AS n FROM listings WHERE slug LIKE '2339-windrow%' LIMIT 1");
  console.log('active total:', total.rows[0].count);
  console.log('active with photos:', withPhotos.rows[0].count);
  console.log('active WITHOUT photos:', broken.rows[0].count);
  console.log('230-n-2nd photos:', sample.rows[0]?.n ?? 'slug not found');
  console.log('2339-windrow photos:', windrow.rows[0]?.n ?? 'slug not found');
} catch (e) { console.log('ERR', e.message); }
await pool.end();
