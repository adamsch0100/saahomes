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
const CONCURRENCY = 2; // serialized + paced — media CDN counts toward MLS limits
const REQUEST_DELAY_MS = 500; // ≤~2 RPS worst case
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
    const res = await fetch(url, { headers: { 'User-Agent': 'saahomes-photo-proxy/1.0' } });
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

export const getListingPhoto = async (req, res) => {
  try {
    const listingId = Number(req.params.listingId);
    const idx = Number(req.params.idx);
    if (!Number.isInteger(listingId) || !Number.isInteger(idx) || idx < 0 || idx > 100) {
      return res.status(400).json({ error: 'Invalid photo reference' });
    }
    const file = cachePath(listingId, idx);
    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }

    const pool = getPool();
    const result = await pool.query('SELECT photos FROM listings WHERE id = $1', [listingId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });
    const photos = result.rows[0].photos || [];
    const url = photos[idx];
    if (!url) return res.status(404).json({ error: 'Photo not found' });

    let buf;
    try {
      buf = await fetchWithQueue(url);
    } catch (fetchErr) {
      // MLS signed URLs expire ~60 min after sync → refresh from IRES and retry
      // once (heals the DB row too). R2 URLs are durable — never refresh those.
      // Quota guard: skip the refresh when the 0.5 RPS budget is exhausted —
      // degrade to the placeholder rather than risk IRES suspension.
      if (!url.includes('media.mlsgrid.com')) throw fetchErr;
      if (!takeRefreshToken()) throw fetchErr;
      const fresh = await refreshWithDedupe(listingId, pool);
      const freshUrl = fresh?.[idx];
      if (!freshUrl) throw fetchErr;
      buf = await fetchWithQueue(freshUrl);
    }
    fs.writeFileSync(file, buf);
    trimCache();
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buf);
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: 'Photo unavailable' });
    logger.error('photo proxy error', error);
    return res.status(502).json({ error: 'Photo temporarily unavailable' });
  }
};
