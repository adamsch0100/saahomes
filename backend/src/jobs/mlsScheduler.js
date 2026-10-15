/**
 * Runs every live MLS connection (other than IRES, which has its own
 * scheduler) on its cadence.
 *
 * Every minute: pick the live connections whose next run is due and sync
 * them one after another. Each sync takes its feed's advisory lock, so a
 * second server running this same loop skips a feed that's already syncing.
 * A connection whose run died mid-way (deploy restart) is picked up again
 * once its lock is free; the watermark only moves after a successful run.
 *
 * Opt out with MLS_SYNC_SCHEDULER=off.
 */
import getPool from '../config/database.js';
import { syncFeed } from '../services/mls/engine.js';

const TICK_MS = 60 * 1000;
let started = false;
let running = false;

/** One pass: sync every due live connection. Returns what ran. */
export async function runDueFeeds({ pool = getPool(), limit = 10, ...opts } = {}) {
  if (running) return { skipped: 'busy' };
  running = true;
  const ran = [];
  try {
    const { rows } = await pool.query(
      `SELECT feed_key FROM mls_connections
       WHERE state = 'live' AND (next_run_at IS NULL OR next_run_at <= NOW())
         AND (running_since IS NULL OR running_since < NOW() - INTERVAL '2 hours')
       ORDER BY next_run_at NULLS FIRST
       LIMIT $1`,
      [limit]
    );
    for (const { feed_key: key } of rows) {
      const result = await syncFeed(key, { pool, ...opts });
      ran.push({ key, ...result });
      if (!result.skipped) {
        console.log(`[mls-sync] ${new Date().toISOString()} ${key}:`, JSON.stringify({
          ok: result.ok, mode: result.mode, listings: result.listings, sold: result.sold, removed: result.removed, error: result.error,
        }));
      }
    }
    return { ran };
  } finally {
    running = false;
  }
}

/** Mounted from server.js after migrations. */
export function startMlsScheduler() {
  if (started) return;
  started = true;
  const tick = () => {
    runDueFeeds().catch((e) => console.error('[mls-sync] tick failed:', e.message));
  };
  setInterval(tick, TICK_MS).unref?.();
  setTimeout(tick, 30 * 1000).unref?.();
  console.log('[mls-sync] scheduler started: live MLS connections sync on their own cadence');
}
