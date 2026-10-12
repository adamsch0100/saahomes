import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase } from './helpers/testDb.mjs';

test('migrations build a fresh database from nothing and can run again', { skip: !hasTestDatabase }, async (t) => {
  const db = await createTestDatabase();
  t.after(db.drop);

  const { rows } = await db.pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const tables = new Set(rows.map((r) => r.table_name));
  for (const name of [
    'contact_submissions', 'market_report_submissions', 'listings', 'users',
    'saved_searches', 'search_snapshots', 'saved_homes', 'notifications',
    'home_profiles', 'property_views', 'user_events', 'email_outbox',
  ]) {
    assert.ok(tables.has(name), `missing table ${name}`);
  }

  // Columns that used to be added before the listings table existed.
  const cols = await db.pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'listings'`
  );
  const listingCols = new Set(cols.rows.map((r) => r.column_name));
  for (const c of ['original_list_price', 'price_change_timestamp', 'features', 'lot_size_acres', 'photos_count']) {
    assert.ok(listingCols.has(c), `listings.${c} missing`);
  }

  // Startup runs migrations on every deploy, so a second run must be a no-op.
  await db.runMigrations();
});
