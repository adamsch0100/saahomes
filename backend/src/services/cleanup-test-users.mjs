import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  await pool.query("DELETE FROM users WHERE email IN ('test.buyer@example.com','unsub.test@example.com')");
  console.log('test users cleaned');
} catch (e) { console.log('ERR', e.message); }
await pool.end();
