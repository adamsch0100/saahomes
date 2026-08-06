import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const r = await pool.query("SELECT id FROM saved_searches WHERE name = 'Loveland detached under 600K' ORDER BY id DESC LIMIT 1");
  console.log(r.rows[0]?.id || 'none');
} catch (e) { console.log('ERR', e.message); }
await pool.end();
