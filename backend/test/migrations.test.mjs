import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTestDatabase, createTestDatabase } from './helpers/testDb.mjs';

const ledgerCount = async (pool) =>
  Number((await pool.query('SELECT COUNT(*)::int AS n FROM schema_migrations')).rows[0].n);

// One database for the file: the pool is a singleton, so a dropped database
// cannot be followed by a second one in the same process.
test('migrations: fresh build, ledger, second run and failing steps', { skip: !hasTestDatabase }, async (t) => {
  const db = await createTestDatabase();
  t.after(db.drop);
  const { migrationFailures, extraMigrationSteps } = await import('../src/config/migrate.js');

  await t.test('build a fresh database from nothing', async () => {
    const { rows } = await db.pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tables = new Set(rows.map((r) => r.table_name));
    for (const name of [
      'contact_submissions', 'market_report_submissions', 'listings', 'users',
      'saved_searches', 'search_snapshots', 'saved_homes', 'notifications',
      'home_profiles', 'property_views', 'user_events', 'email_outbox',
      'lead_submit_log', 'schema_migrations',
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
  });

  await t.test('the ledger records every step once and a second run applies nothing', async (tt) => {
    // The fresh database ran every step: one ledger row each, nothing failed.
    const { rows: ledger } = await db.pool.query(
      'SELECT name, applied_at, duration_ms, checksum FROM schema_migrations ORDER BY name'
    );
    assert.ok(ledger.length > 40, `expected one row per step, got ${ledger.length}`);
    assert.equal(new Set(ledger.map((r) => r.name)).size, ledger.length);
    for (const row of ledger) {
      assert.match(row.name, /^\d{3}_[a-z0-9_]+$/, `step name ${row.name} is not NNN_slug`);
      assert.ok(row.applied_at instanceof Date);
      assert.equal(typeof row.duration_ms, 'number');
      assert.match(row.checksum, /^[0-9a-f]{16}$/);
    }
    assert.deepEqual(migrationFailures, []);

    // Startup runs migrations on every deploy. The second run finds everything
    // recorded: the ledger does not grow and the summary line says so.
    const before = await ledgerCount(db.pool);
    const log = tt.mock.method(console, 'log');
    const result = await db.runMigrations();
    log.mock.restore();
    assert.deepEqual(result, { applied: [], skipped: before, failed: [] });
    assert.equal(await ledgerCount(db.pool), before);
    const summary = log.mock.calls.map((c) => c.arguments.join(' ')).find((l) => l.startsWith('Database migrations:'));
    assert.match(summary, new RegExp(`^Database migrations: 0 applied, ${before} already applied, 0 failed \\(\\d+ ms\\)$`));
  });

  await t.test('a failing step is reported, left unrecorded and does not stop later steps', async (tt) => {
    tt.after(() => {
      extraMigrationSteps.length = 0;
      delete process.env.MIGRATIONS_STRICT;
    });
    extraMigrationSteps.push(
      ['900_test_broken', async (client) => { await client.query('SELECT * FROM no_such_table_for_this_test'); }],
      ['901_test_after_broken', async (client) => { await client.query('CREATE TABLE IF NOT EXISTS after_broken_step (id INT)'); }],
    );

    const before = await ledgerCount(db.pool);
    const error = tt.mock.method(console, 'error', () => {});
    const result = await db.runMigrations();
    error.mock.restore();

    // Loud: the step name and the Postgres message, at error level.
    const line = error.mock.calls.map((c) => c.arguments.join(' ')).find((l) => l.includes('900_test_broken'));
    assert.ok(line, 'no error line for the failed step');
    assert.match(line, /no_such_table_for_this_test/);

    // Reported for notify-health, with the step after it still applied.
    assert.deepEqual(result.failed.map((f) => f.name), ['900_test_broken']);
    assert.deepEqual(migrationFailures.map((f) => f.name), ['900_test_broken']);
    assert.match(migrationFailures[0].message, /no_such_table_for_this_test/);
    assert.deepEqual(result.applied, ['901_test_after_broken']);
    const { rows } = await db.pool.query(`SELECT name FROM schema_migrations WHERE name LIKE '90_%' ORDER BY name`);
    assert.deepEqual(rows.map((r) => r.name), ['901_test_after_broken']);
    assert.equal(await ledgerCount(db.pool), before + 1);
    const after = await db.pool.query(`SELECT to_regclass('after_broken_step') AS t`);
    assert.equal(after.rows[0].t, 'after_broken_step');

    // Strict mode: the same failure stops the boot. What worked stays committed.
    process.env.MIGRATIONS_STRICT = '1';
    const quiet = tt.mock.method(console, 'error', () => {});
    await assert.rejects(db.runMigrations(), /Migration steps failed: 900_test_broken/);
    quiet.mock.restore();
    assert.equal(await ledgerCount(db.pool), before + 1);
    assert.deepEqual(migrationFailures.map((f) => f.name), ['900_test_broken']);

    // Once the step is fixed it runs, is recorded, and the failure list clears.
    extraMigrationSteps[0] = ['900_test_broken', async (client) => { await client.query('SELECT 1'); }];
    const fixed = await db.runMigrations();
    assert.deepEqual(fixed, { applied: ['900_test_broken'], skipped: before + 1, failed: [] });
    assert.deepEqual(migrationFailures, []);
  });
});
