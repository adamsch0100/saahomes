import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Always TLS: the only database in use is the Railway Postgres public
      // proxy (ballast.proxy.rlwy.net). Local cron runs (MLS sync, digests)
      // have NODE_ENV unset → ssl:false → plaintext connections that the
      // proxy resets mid-run ("Connection terminated unexpectedly", Aug 10
      // 2026 — sync died ~min 2 of a 5-min run).
      ssl: { rejectUnauthorized: false },
    });

    pool.on('connect', () => {
      console.log('Connected to PostgreSQL database');
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  return pool;
}

export default getPool;

