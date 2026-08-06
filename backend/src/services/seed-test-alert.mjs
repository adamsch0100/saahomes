import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const u = await pool.query(
    `INSERT INTO users (email, name, manage_token) VALUES ('adam@saahomes.com', 'Adam Schwartz', 'testtoken1234567890abcdef1234567890')
     ON CONFLICT (email) DO UPDATE SET name='Adam Schwartz', status='active', manage_token='testtoken1234567890abcdef1234567890' RETURNING id`
  );
  // fresh search so the digest treats matches as "new"
  await pool.query(
    `INSERT INTO saved_searches (user_id, name, filters, is_active)
     VALUES ($1, 'Loveland detached under 600K', $2, TRUE) RETURNING id`,
    [u.rows[0].id, JSON.stringify({ city: 'Loveland', minPrice: '425000', maxPrice: '600000', beds: '3', type: 'detached' })]
  );
  console.log('fresh test search created for adam@saahomes.com');
} catch (e) { console.log('ERR', e.message); }
await pool.end();
