import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  await pool.query("DELETE FROM showing_requests WHERE email = 'jane@example.com'");
  console.log('test showing cleaned');
} catch (e) { console.log('ERR', e.message); }
await pool.end();
