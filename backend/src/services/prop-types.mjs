import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const r = await pool.query(
    `SELECT property_type, COUNT(*) AS cnt FROM listings WHERE is_active GROUP BY property_type ORDER BY cnt DESC LIMIT 20`
  );
  for (const x of r.rows) console.log(`${x.property_type}: ${x.cnt}`);
} catch (e) {
  console.log('ERR', e.message);
}
await pool.end();
