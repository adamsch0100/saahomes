#!/usr/bin/env node
// Quick listings DB status check.
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const r = await pool.query(`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE is_active) AS active,
           count(*) FILTER (WHERE photos::text <> '[]'::text AND photos::text <> 'null') AS with_photos,
           count(DISTINCT city) AS cities
    FROM listings`);
  console.log(JSON.stringify(r.rows[0]));
  const c = await pool.query(`SELECT city, count(*) FROM listings WHERE is_active GROUP BY city ORDER BY count(*) DESC LIMIT 10`);
  console.log('top cities:', c.rows.map(x => `${x.city}:${x.count}`).join(', '));
  const s = await pool.query(`SELECT status, count(*) FROM listings GROUP BY status`);
  console.log('statuses:', s.rows.map(x => `${x.status}:${x.count}`).join(', '));
} catch (e) {
  console.log('DB ERROR:', e.message);
} finally {
  await pool.end();
}
