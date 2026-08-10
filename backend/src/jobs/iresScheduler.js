/**
 * In-process IRES MLS sync scheduler — runs the listing + signed-photo-URL
 * sync hourly at :57 on the Railway backend (the main site), so MLS sync no
 * longer depends on the flaky Hermes cron box (gateway restarts, stale-lock
 * stacking, delayed ticks — all caused 429s on Aug 10 2026).
 *
 * Safety:
 *  - Postgres advisory lock (session-scoped, same client for lock/unlock)
 *    makes concurrent replicas safe — exactly one sync runs cluster-wide.
 *  - syncListings() itself paces at ~1.4 RPS and takes the per-instance
 *    file lock as a second guard.
 *  - Hourly at :57 keeps signed URLs (valid ~60 min) fresh with margin;
 *    the photo proxy's 30/min IRES refresh covers the edges.
 *  - No-op when IRES creds are absent (local dev).
 */
import { syncListings } from '../services/iresSync.js';
import getPool from '../config/database.js';

const ADVISORY_LOCK_KEY = 833711; // app-wide constant — must not collide with other locks
const RUN_MINUTE = 57; // sync at :57 each hour
const TICK_MS = 20000; // check every 20s; fires inside the :57:00–:57:20 window
const MAX_RUN_HOURS = 1; // guard: never fire twice within the same minute window

let running = false;
let started = false;
let lastFiredHour = -1;

async function runSync() {
  if (running) return;
  running = true;
  const pool = getPool();
  const client = await pool.connect();
  let locked = false;
  try {
    const lr = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [ADVISORY_LOCK_KEY]);
    locked = lr.rows[0]?.ok === true;
    if (!locked) {
      console.log(`[ires-sync] ${new Date().toISOString()} skipped — another instance holds the sync advisory lock`);
      return;
    }
    console.log(`[ires-sync] ${new Date().toISOString()} starting hourly sync`);
    const result = await syncListings();
    console.log(`[ires-sync] ${new Date().toISOString()} complete:`, JSON.stringify(result));
  } catch (error) {
    console.error(`[ires-sync] ${new Date().toISOString()} FAILED:`, error.message);
  } finally {
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    }
    client.release();
    running = false;
  }
}

/** Mounted from server.js after migrations. */
export function startIresSyncScheduler() {
  if (started) return;
  started = true;
  if (!process.env.IRES_API_URL || !process.env.IRES_ACCESS_TOKEN) {
    console.warn('[ires-sync] scheduler NOT started — IRES_API_URL / IRES_ACCESS_TOKEN missing');
    return;
  }
  const tick = () => {
    const now = new Date();
    if (now.getMinutes() !== RUN_MINUTE) return;
    if (now.getHours() === lastFiredHour) return; // already fired this hour
    if (now.getSeconds() >= TICK_MS / 1000) return;
    lastFiredHour = now.getHours();
    runSync();
  };
  setInterval(tick, TICK_MS);
  console.log(`[ires-sync] hourly scheduler started — fires at :${String(RUN_MINUTE).padStart(2, '0')} UTC, advisory lock key ${ADVISORY_LOCK_KEY}`);
}
