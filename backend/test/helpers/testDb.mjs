/**
 * Throwaway Postgres for backend tests.
 *
 * Set TEST_DATABASE_URL to a server you can create databases on, e.g.
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres
 * Each test file gets its own fresh database, built by the real migrations,
 * and drops it when done. Without TEST_DATABASE_URL, database tests skip.
 */
import pg from 'pg';
import crypto from 'node:crypto';

export const hasTestDatabase = !!process.env.TEST_DATABASE_URL;

function withDatabase(url, name) {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

function sslFor(url) {
  return /sslmode=require/.test(url) ? { rejectUnauthorized: false } : false;
}

/**
 * Create an empty database, point DATABASE_URL at it, and run migrations.
 * Call before importing any module that reads DATABASE_URL.
 */
export async function createTestDatabase() {
  const admin = process.env.TEST_DATABASE_URL;
  const name = `saa_test_${crypto.randomBytes(5).toString('hex')}`;
  const adminClient = new pg.Client({ connectionString: admin, ssl: sslFor(admin) });
  await adminClient.connect();
  await adminClient.query(`CREATE DATABASE ${name}`);
  await adminClient.end();

  process.env.DATABASE_URL = withDatabase(admin, name);
  if (!sslFor(admin)) process.env.DATABASE_SSL = 'disable';

  const { runMigrations } = await import('../../src/config/migrate.js');
  await runMigrations();
  const { default: getPool } = await import('../../src/config/database.js');
  const pool = getPool();

  async function drop() {
    await pool.end().catch(() => {});
    const c = new pg.Client({ connectionString: admin, ssl: sslFor(admin) });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.end();
  }

  return { name, pool, drop, runMigrations };
}

/** Start the Express app on a random port. Returns { url, close }. */
export async function startTestServer() {
  process.env.SAA_SERVER_NO_START = '1';
  const { default: app } = await import('../../src/server.js');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
