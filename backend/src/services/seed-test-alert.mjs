import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  // idempotent test user + search
  const u = await pool.query(
    `INSERT INTO users (email, name, manage_token) VALUES ('adam@saahomes.com', 'Adam Test', 'testtoken1234567890abcdef1234567890')
     ON CONFLICT (email) DO UPDATE SET status='active', manage_token='testtoken1234567890abcdef1234567890' RETURNING id`
  );
  const s = await pool.query(
    `INSERT INTO saved_searches (user_id, name, filters, is_active)
     VALUES ($1, 'Fort Collins — 3+ bed detached', $2, TRUE)
     ON CONFLICT DO NOTHING RETURNING id`,
    [u.rows[0].id, JSON.stringify({ city: 'Fort Collins', minPrice: '400000', maxPrice: '700000', beds: '3', type: 'detached' })]
  );
  console.log('user id:', u.rows[0].id, '| search id:', s.rows.length ? s.rows[0].id : '(exists)');
  const check = await pool.query(`SELECT id, name, filters FROM saved_searches WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [u.rows[0].id]);
  console.log('active search:', JSON.stringify(check.rows[0]));
} catch (e) { console.log('ERR', e.message); }
await pool.end();
