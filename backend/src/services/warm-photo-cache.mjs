#!/usr/bin/env node
/**
 * Photo cache warmer — pre-fetch listing photos through the production
 * proxy so the disk cache on Railway is hot BEFORE visitors click.
 *
 * Why: every photo is ~1.5s on cache miss (proxy paces at ≤2 RPS to
 * respect MLS Grid limits). A cold 46-photo listing takes ~70s to fill.
 * Warming the most-visible listings nightly turns that into instant loads.
 *
 * Strategy: newest N listings per city (search sorted by created_at) ×
 * first K photos, fetched slowly (1 req / 700ms, 2 concurrent) to stay
 * far under MLS limits. Idempotent, safe to run after every sync.
 *
 * Usage: node backend/src/services/warm-photo-cache.mjs [--limit-per-city N]
 */
import getPool from '../config/database.js';

const API = process.env.SITE_URL || 'https://saahomes.com';
const PER_CITY = parseInt(process.argv[2] || '8', 10);
const PHOTOS_PER_LISTING = 12;
const CONCURRENCY = 2;
const DELAY_MS = 700;

const NOCO_CITIES = [
  'Fort Collins','Loveland','Windsor','Greeley','Timnath','Wellington',
  'Johnstown','Eaton','Milliken','La Salle','Mead','Longmont','Boulder',
  'Berthoud','Firestone','Frederick','Evans','Severance','Niwot',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPhoto(listingId, idx) {
  try {
    const res = await fetch(`${API}/api/photo/${listingId}/${idx}`, {
      headers: { 'User-Agent': 'saahomes-cache-warmer/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      await res.arrayBuffer(); // drain body
      return true;
    }
    if (res.status === 429) {
      // Rate-limited — back off hard, this is the danger zone
      await sleep(3000);
    }
    return false;
  } catch {
    return false;
  }
}

async function warmListing(pool, listingId) {
  for (let i = 0; i < PHOTOS_PER_LISTING; i++) {
    await fetchPhoto(listingId, i);
    await sleep(DELAY_MS + Math.random() * 200);
  }
}

async function main() {
  const pool = getPool();
  let total = 0;
  for (const city of NOCO_CITIES) {
    const res = await pool.query(
      `SELECT id FROM listings
       WHERE status = 'Active' AND city = $1 AND jsonb_array_length(photos) > 0
       ORDER BY created_at DESC NULLS LAST LIMIT $2`,
      [city, PER_CITY]
    );
    const ids = res.rows.map((r) => r.id);
    // small concurrency pool
    let i = 0;
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (i < ids.length) {
        const id = ids[i++];
        await warmListing(pool, id);
        total++;
      }
    });
    await Promise.all(workers);
  }
  await pool.end();
  console.log(`✅ photo cache warmed: ${total} listings × up to ${PHOTOS_PER_LISTING} photos across ${NOCO_CITIES.length} cities`);
}

main().catch((e) => {
  console.error('warm-photo-cache failed:', e.message);
  process.exit(1);
});
