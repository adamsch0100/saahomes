/**
 * Photo proxy — GET /api/photo/:listingId/:idx
 *
 * Serves listing photos from a local cache, fetching from the (expiring,
 * rate-limited) MLS signed URLs only on cache miss. This gives visitors
 * reliable photos no matter how flaky the CDN URLs get:
 *   · one request per image (no 429 bursts from parallel browser loads)
 *   · cache survives URL expiry (re-fetch happens automatically)
 *   · disk cache under PHOTO_CACHE_DIR (default /tmp) — a Railway volume
 *     (e.g. /data) makes it durable across deploys
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = process.env.PHOTO_CACHE_DIR || path.join('/tmp', 'saahomes-photos');
const MAX_CACHE_FILES = parseInt(process.env.PHOTO_CACHE_MAX || '6000', 10);
const CONCURRENCY = 1; // serialized + paced — media CDN fetches count toward
// MLS Grid limits (2 RPS sustained / 4 RPS burst, Aug 2026 suspension
// warning). 1 concurrent + 700ms pacing ≈ ≤1.4 RPS worst case: never bursts
// the cap even while the hourly IRES sync is running on the same host.
const REQUEST_DELAY_MS = 700;
let active = 0;
const queue = [];

// IRES API quota guard — MLS Grid warns at >2 sustained RPS (hourly cap
// 7,200 req). The photo proxy must NEVER drive IRES usage: cap refreshes at
// 30/min (0.5 RPS) and degrade to the 502/placeholder path when exhausted.
// (Adam, 2026-08-08 — 4.0 RPS suspension warning after self-heal went live.)
const IRES_REFRESH_RATE_PER_MIN = parseInt(process.env.IRES_REFRESH_RATE_PER_MIN || '30', 10);
let refreshTokens = IRES_REFRESH_RATE_PER_MIN;
let refreshLastRefill = Date.now();
let refreshBlockedLogAt = 0;
const refreshInFlight = new Map(); // listingId -> Promise (dedupe concurrent misses)

function takeRefreshToken() {
  const now = Date.now();
  if (now - refreshLastRefill >= 60000) {
    refreshTokens = IRES_REFRESH_RATE_PER_MIN;
    refreshLastRefill = now;
  }
  if (refreshTokens <= 0) {
    if (now - refreshBlockedLogAt > 60000) {
      refreshBlockedLogAt = now;
      logger.warn('IRES refresh throttled by quota guard (0.5 RPS cap) — serving placeholder instead');
    }
    return false;
  }
  refreshTokens -= 1;
  return true;
}

function refreshWithDedupe(listingId, pool) {
  if (refreshInFlight.has(listingId)) return refreshInFlight.get(listingId);
  const p = refreshMlsUrls(listingId, pool).finally(() => refreshInFlight.delete(listingId));
  refreshInFlight.set(listingId, p);
  return p;
}

fs.mkdirSync(CACHE_DIR, { recursive: true });

function cachePath(listingId, idx) {
  return path.join(CACHE_DIR, `${listingId}-${idx}.jpg`);
}

// Simple LRU trim by mtime when over the file cap.
function trimCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR).map((f) => {
      const p = path.join(CACHE_DIR, f);
      return { p, m: fs.statSync(p).mtimeMs };
    });
    if (files.length <= MAX_CACHE_FILES) return;
    files.sort((a, b) => a.m - b.m);
    const excess = files.length - MAX_CACHE_FILES;
    for (const f of files.slice(0, Math.min(excess, 200))) {
      fs.unlinkSync(f.p);
    }
    logger.info(`photo cache trimmed: removed ${Math.min(excess, 200)} files`);
  } catch { /* noop */ }
}

async function fetchWithQueue(url) {
  const run = async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'saahomes-photo-proxy/1.0' },
      // Fail fast: expired signed URLs can hang the CDN connection forever.
      // A 20s cap keeps visitor requests bounded (platform timeout is 40s)
      // and pushes the request onto the refresh path instead of hanging.
      signal: AbortSignal.timeout(20000),
    });
    if (res.status === 429) {
      // Rate-limited: fail fast — the cache miss is retried by the NEXT
      // visitor, so we never pile extra requests onto a limited token.
      const err = new Error(`photo fetch 429`);
      err.status = 429;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`photo fetch ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return Buffer.from(await res.arrayBuffer());
  };
  if (active >= CONCURRENCY) {
    await new Promise((resolve) => queue.push(resolve));
  }
  active += 1;
  try {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS)); // pace the CDN
    return await run();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

/**
 * Refresh a listing's photo URLs from the IRES API. MLS signed URLs expire
 * ~60 min after each sync, so on a cache-miss fetch failure we regenerate
 * them (same API + token the sync uses), heal the DB photos array, and retry.
 * Returns the fresh URL array, or null on any failure (caller falls back to
 * the original error). Verified live 2026-08-08: ListingId filter + $expand=Media.
 */
async function refreshMlsUrls(listingId, pool) {
  const base = process.env.IRES_API_URL;
  const token = process.env.IRES_ACCESS_TOKEN;
  if (!base || !token) return null;
  try {
    const row = await pool.query('SELECT listing_id FROM listings WHERE id = $1', [listingId]);
    const lid = row.rows[0]?.listing_id;
    if (!lid) return null;
    const url = new URL(`${base}/Property`);
    url.searchParams.set('$top', '1');
    url.searchParams.set('$filter', `ListingId eq '${lid}'`);
    url.searchParams.set('$select', 'ListingKey,ListingId,StandardStatus,StreetNumber,City,PhotosCount');
    url.searchParams.set('$expand', 'Media');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const media = Array.isArray(data.value?.[0]?.Media) ? data.value[0].Media : [];
    const photos = media
      .filter((m) => typeof m?.MediaURL === 'string' && /\.(jpe?g|png|webp)(\?|$)/i.test(m.MediaURL))
      .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
      .map((m) => m.MediaURL)
      .filter(Boolean);
    if (!photos.length) return null;
    await pool.query('UPDATE listings SET photos = $1, photos_count = $2 WHERE id = $3', [
      JSON.stringify(photos),
      photos.length,
      listingId,
    ]);
    return photos;
  } catch (error) {
    logger.error('photo URL refresh failed', error);
    return null;
  }
}

/** True when a stored MLS signed URL is already past its expires= epoch.
 *  Signed URLs die ~60 min after the sync that issued them — fetching one
 *  is guaranteed to fail (or hang), so skip the doomed fetch entirely and
 *  go straight to the refresh path. Saves one dead request per healing and
 *  never hangs a visitor on an expired CDN connection. */
function isExpiredMlsUrl(u) {
  if (!u.includes('media.mlsgrid.com')) return false;
  const m = /[?&]expires=(\d+)/.exec(u);
  if (!m) return false;
  return parseInt(m[1], 10) < Date.now() / 1000;
}

async function loadPhotosForProxy(pool, rawId) {
  const numericId = Number(rawId);
  const isNumeric = Number.isInteger(numericId) && numericId > 0 && String(numericId) === String(rawId);
  if (isNumeric) {
    const byPk = await pool.query('SELECT photos FROM listings WHERE id = $1', [numericId]);
    if (byPk.rows.length) {
      return { photos: byPk.rows[0].photos || [], allowIresRefresh: true, refreshKey: numericId };
    }
  }
  const sold = await pool.query('SELECT photos FROM sold_listings WHERE listing_id = $1', [rawId]);
  if (sold.rows.length) {
    // Sold photos: serve stored URLs only. Do NOT refresh from IRES — that
    // would stack Closed-record fetches on the same MLS Grid budget.
    return { photos: sold.rows[0].photos || [], allowIresRefresh: false, refreshKey: null };
  }
  return null;
}

export const getListingPhoto = async (req, res) => {
  try {
    const rawId = String(req.params.listingId || '');
    const idx = Number(req.params.idx);
    if (!rawId || rawId.length > 64 || /[^A-Za-z0-9_-]/.test(rawId)
        || !Number.isInteger(idx) || idx < 0 || idx > 100) {
      return res.status(400).json({ error: 'Invalid photo reference' });
    }
    const file = cachePath(rawId, idx);
    if (fs.existsSync(file)) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Content-Type', 'image/jpeg');
      return res.sendFile(file);
    }

    const pool = getPool();
    const loaded = await loadPhotosForProxy(pool, rawId);
    if (!loaded) return res.status(404).json({ error: 'Listing not found' });
    const photos = loaded.photos || [];
    const url = photos[idx];
    if (!url) return res.status(404).json({ error: 'Photo not found' });

    let buf;
    try {
      // Expired signed URL → skip the doomed fetch, refresh first (heals the
      // DB row in one request instead of two, never hangs on a dead CDN).
      if (isExpiredMlsUrl(url)) throw new Error('photo URL expired (past expires=)');
      buf = await fetchWithQueue(url);
    } catch (fetchErr) {
      // MLS signed URLs expire ~60 min after sync → refresh from IRES and retry
      // once (heals the DB row too). R2 URLs are durable — never refresh those.
      // Quota guard: skip the refresh when the 0.5 RPS budget is exhausted —
      // degrade to the placeholder rather than risk IRES suspension.
      // Sold rows skip IRES refresh entirely (rate-limit headroom).
      if (!loaded.allowIresRefresh || !url.includes('media.mlsgrid.com')) throw fetchErr;
      if (!takeRefreshToken()) throw fetchErr;
      const fresh = await refreshWithDedupe(loaded.refreshKey, pool);
      const freshUrl = fresh?.[idx];
      if (!freshUrl) throw fetchErr;
      buf = await fetchWithQueue(freshUrl);
    }
    fs.writeFileSync(file, buf);
    trimCache();
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Cache', 'MISS');
    return res.send(buf);
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: 'Photo unavailable' });
    logger.error('photo proxy error', error);
    return res.status(502).json({ error: 'Photo temporarily unavailable' });
  }
};
