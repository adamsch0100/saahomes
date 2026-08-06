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

    const buf = await fetchWithQueue(url);
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
