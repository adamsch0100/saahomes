import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const r = await pool.query(
    `SELECT raw->>'PropertySubType' AS subtype, COUNT(*) AS cnt
     FROM listings WHERE is_active AND raw ? 'PropertySubType' AND raw->>'PropertySubType' IS NOT NULL
     GROUP BY 1 ORDER BY cnt DESC LIMIT 25`
  );
  for (const x of r.rows) console.log(`${x.subtype}: ${x.cnt}`);
} catch (e) {
  console.log('ERR', e.message);
}
await pool.end();
