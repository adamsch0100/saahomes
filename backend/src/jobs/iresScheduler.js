/**
 * In-process IRES MLS sync scheduler — runs the listing + signed-photo-URL
 * sync on the Railway backend (the main site), so MLS sync no longer depends
 * on an external cron box (gateway restarts, stale-lock stacking, delayed
 * ticks — all caused 429s on Aug 10 2026).
 *
 * Cadence (all UTC):
 *  - Every hour at :57  → INCREMENTAL sync (watermark-based, seconds-fast;
 *    refreshes signed photo URLs for changed listings within the ~60 min
 *    expiry window).
 *  - At 03:57 daily     → FULL sync (archive-unseen sweep: marks listings
 *    not returned by the full pull as inactive — sold/expired/removed).
 *  - At 04:57 daily     → SOLD/CLOSED ingest (after the full sync; own lock
 *    file + slower pace so we never stack with the photo proxy).
 *
 * Safety:
 *  - Postgres advisory lock (session-scoped, same client for lock/unlock)
 *    makes concurrent replicas safe — exactly one sync runs cluster-wide.
 *  - syncListings() itself paces at ~1.8 RPS and takes the per-instance
 *    file lock as a second guard.
 *  - A deploy restart mid-run is now harmless: incremental syncs complete
 *    in seconds, the watermark persists only AFTER a successful run, and
 *    the next hourly tick simply retries.
 *  - No-op when IRES creds are absent (local dev).
 */
import { syncListings } from '../services/iresSync.js';
import { syncSoldListings } from '../services/iresSoldSync.js';
import getPool from '../config/database.js';
import { runPushPass } from '../services/pushService.js';
import { runMorningBriefs } from '../services/morningBrief.js';
import { runStayInTouch } from '../services/stayInTouch.js';
import { refreshMlsRoster, applyRosterNames } from '../services/mlsRoster.js';

const ADVISORY_LOCK_KEY = 833711; // app-wide constant — must not collide with other locks
const RUN_MINUTE = 57; // sync at :57 each hour (UTC)
const TICK_MS = 20000; // check every 20s; fires inside the :57:00–:57:20 window
const MAX_RUN_HOURS = 1; // guard: never fire twice within the same minute window
const FULL_SYNC_HOUR = 3; // daily full (archive-unseen) at 03:57 UTC
const SOLD_SYNC_HOUR = 4; // daily sold ingest at 04:57 UTC (after full sync)

let running = false;
let started = false;
let lastFiredHour = -1;

async function runSync() {
  if (running) return;
  running = true;
  const startedAt = new Date();
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
    const now = new Date();
    const hour = now.getUTCHours();
    const mode = hour === FULL_SYNC_HOUR ? 'full' : 'incremental';
    console.log(`[ires-sync] ${now.toISOString()} starting ${mode} sync`);
    const result = await syncListings({ mode });
    console.log(`[ires-sync] ${new Date().toISOString()} complete:`, JSON.stringify(result));
    // "Listing courtesy of": the office/agent roster refreshes with the daily
    // full sync; every tick names new listings from it.
    try {
      const roster = mode === 'full' ? await refreshMlsRoster() : { applied: await applyRosterNames() };
      console.log(`[mls-roster] ${new Date().toISOString()}`, JSON.stringify(roster));
    } catch (rosterErr) {
      console.error(`[mls-roster] ${new Date().toISOString()} FAILED:`, rosterErr.message);
    }
    // Instant alerts ride the sync: new listings and price changes reach
    // phones minutes after they land, not at the next digest.
    try {
      const push = await runPushPass();
      console.log(`[push] ${new Date().toISOString()} pass:`, JSON.stringify(push));
    } catch (pushErr) {
      console.error(`[push] ${new Date().toISOString()} pass FAILED:`, pushErr.message);
    }
    // Sold ingest runs AFTER the hourly listing tick at 04:57 so the two
    // never share the MLS Grid budget. Own file lock inside syncSoldListings.
    if (hour === SOLD_SYNC_HOUR) {
      console.log(`[ires-sold] ${new Date().toISOString()} starting incremental sold sync`);
      const sold = await syncSoldListings({ mode: 'incremental' });
      console.log(`[ires-sold] ${new Date().toISOString()} complete:`, JSON.stringify(sold));
    }
  } catch (error) {
    console.error(`[ires-sync] ${new Date().toISOString()} FAILED:`, error.message);
  } finally {
    if (locked) {
      // The agents' morning brief rides the 6:57am Mountain tick (a no-op
      // otherwise), and runs even when the MLS sync failed.
      try {
        const brief = await runMorningBriefs({ now: startedAt });
        if (brief.sent) console.log(`[brief] ${new Date().toISOString()} sent:`, JSON.stringify(brief));
      } catch (briefErr) {
        console.error(`[brief] ${new Date().toISOString()} FAILED:`, briefErr.message);
      }
      // Stay-in-touch emails and seller-intent scores ride the 9:57am Mountain tick.
      try {
        const stay = await runStayInTouch({ now: startedAt });
        if (stay.sent || stay.signals) console.log(`[stay] ${new Date().toISOString()} pass:`, JSON.stringify(stay));
      } catch (stayErr) {
        console.error(`[stay] ${new Date().toISOString()} FAILED:`, stayErr.message);
      }
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    }
    client.release();
    running = false;
  }
}

async function seedRosterOnce() {
  const pool = getPool();
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM mls_offices');
  if (n > 0) return;
  const client = await pool.connect();
  try {
    const lr = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [ADVISORY_LOCK_KEY]);
    if (lr.rows[0]?.ok !== true) return;
    try {
      const roster = await refreshMlsRoster({ pool });
      console.log(`[mls-roster] ${new Date().toISOString()} first fill:`, JSON.stringify(roster));
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    }
  } finally {
    client.release();
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
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    if (minute !== RUN_MINUTE) return;
    if (hour === lastFiredHour) return; // already fired this hour
    if (now.getUTCSeconds() >= TICK_MS / 1000) return;
    lastFiredHour = hour;
    runSync();
  };
  setInterval(tick, TICK_MS);
  // First boot with an empty roster: fill it now rather than at the next full sync.
  setTimeout(() => { seedRosterOnce().catch((e) => console.error('[mls-roster] first fill failed:', e.message)); }, 3 * 60 * 1000).unref?.();
  console.log(`[ires-sync] hourly scheduler started — fires at :${String(RUN_MINUTE).padStart(2, '0')} UTC (daily full at 0${FULL_SYNC_HOUR}:57 UTC, sold ingest at 0${SOLD_SYNC_HOUR}:57 UTC), advisory lock key ${ADVISORY_LOCK_KEY}`);
}
