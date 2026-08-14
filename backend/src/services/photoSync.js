/**
 * Photo pipeline: download MLS photos → strip EXIF → resize to WebP (1600px
 * hero + 400px thumbnail) → upload to Cloudflare R2 with SEO filenames.
 *
 * Storage layout (mirrors listing page slugs so Google links image ↔ page):
 *   photos/{listing-slug}/01-hero.webp
 *   photos/{listing-slug}/02-hero.webp
 *   photos/{listing-slug}/01-400w.webp
 * Sold / closed (distinct namespace so active slugs never collide):
 *   photos/sold/{listing_id}/01-hero.webp
 *   photos/sold/{listing_id}/01-400w.webp
 *
 * Runs standalone:  node backend/src/services/photoSync.js [--all|--limit N]
 * Requires R2_* env vars. Without them, exits gracefully (no-op).
 */
import 'dotenv/config';
import pg from 'pg';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Lazy pool — this module is also imported by iresSoldSync; do not open a
// connection just because the file was loaded.
let pool = null;
function getSweepPool() {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  return pool;
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_API_TOKEN = process.env.R2_API_TOKEN; // Cloudflare REST token (cfut_...) — alternative auth
const R2_BUCKET = process.env.R2_BUCKET || 'saahomes-photos';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const isConfigured = () =>
  !!(
    R2_ACCOUNT_ID &&
    R2_PUBLIC_URL &&
    (R2_API_TOKEN || (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY))
  );

let s3 = null;
function getS3() {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return s3;
}

const CONCURRENCY = 2; // MLS media CDN counts toward rate limits — ≤2 RPS
const HERO_WIDTH = 1600;
const THUMB_WIDTH = 400;
const USER_AGENT = 'saahomes-idx/1.0 (Schwartz and Associates)';
const REQUEST_DELAY_MS = 1000; // 2 workers × 1s spacing = hard 2 RPS cap

/**
 * Download a photo. media.mlsgrid.com IP-blocks some networks (this Hermes
 * box gets 400/429 while Railway's proxy fetches fine), so route MLS CDN
 * downloads through our own public proxy — it caches + backoffs and works
 * from any IP. Non-MLS URLs (already-R2, etc.) fetch directly.
 */
async function downloadPhoto(url, { listingId, idx, retries = 2 } = {}) {
  if (!url) throw new Error('photo URL missing from listing row');
  const isMlsCdn = url.includes('media.mlsgrid.com');
  const SITE = process.env.SITE_URL || 'https://saahomes.com';
  if (isMlsCdn && listingId) {
    url = `${SITE}/api/photo/${listingId}/${idx}`;
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 429 && retries > 0) {
    // Rate-limited: back off long (10s, 30s) and retry — then give up.
    const wait = 10000 * Math.pow(3, 2 - retries);
    console.log(`  photo 429 — backing off ${wait / 1000}s (${retries} left)`);
    await new Promise((r) => setTimeout(r, wait));
    return downloadPhoto(url, { listingId, idx, retries: retries - 1 });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Resize + WebP. sharp strips EXIF/metadata by default → privacy-safe. */
async function processPhoto(buf) {
  const hero = await sharp(buf).rotate().resize({ width: HERO_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const thumb = await sharp(buf).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  return { hero, thumb };
}

async function upload(key, body, contentType = 'image/webp') {
  if (R2_API_TOKEN) {
    // Cloudflare REST API auth (cfut_ token) — no S3 credentials needed.
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${R2_API_TOKEN}`,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
        body,
      }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`R2 REST upload ${res.status}: ${err.slice(0, 120)}`);
    }
    return;
  }
  const s3Client = getS3();
  if (!s3Client) throw new Error('no R2 auth configured');
  await s3Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

const keyFor = (slug, idx, suffix) => `photos/${slug}/${String(idx).padStart(2, '0')}${suffix}.webp`;
const soldKeyFor = (listingId, idx, suffix) =>
  `photos/sold/${listingId}/${String(idx).padStart(2, '0')}${suffix}.webp`;
const publicUrlFor = (key) => `${R2_PUBLIC_URL}/${key}`;

/** True when the stored photos array already points at our durable R2 copies. */
export function isR2Hosted(photos) {
  const arr = Array.isArray(photos) ? photos : [];
  return arr.some((u) => {
    if (typeof u !== 'string' || !u) return false;
    if (u.includes('r2.dev')) return true;
    if (R2_PUBLIC_URL && u.startsWith(R2_PUBLIC_URL)) return true;
    return false;
  });
}

/**
 * Download + upload one listing's photos. Returns the new R2 photo URL array,
 * or null if nothing was uploaded. `photoUrls` = the listing's current photo
 * URLs (signed MLS URLs from the latest sync — they expire, so run this
 * right after a sync).
 */
export async function syncListingPhotos(listing, photoUrls, { onProgress } = {}) {
  if (!isConfigured()) return null;
  const urls = (photoUrls || []).filter((u) => typeof u === 'string' && u.length > 10);
  if (!urls.length) return null;

  const slug = listing.slug || `listing-${listing.listing_id}`;
  const uploaded = [];
  let cursor = 0;
  let failed = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) return;
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS)); // pace the CDN
      const url = urls[i];
      try {
        const buf = await downloadPhoto(url, { listingId: listing.id, idx: i });
        const { hero, thumb } = await processPhoto(buf);
        const heroKey = keyFor(slug, i + 1, '-hero');
        const thumbKey = keyFor(slug, i + 1, '-400w');
        await Promise.all([
          upload(heroKey, hero),
          upload(thumbKey, thumb),
        ]);
        uploaded.push(publicUrlFor(heroKey));
      } catch (e) {
        failed += 1;
        console.error(`  photo ${i + 1}/${urls.length} failed: ${e.message}`);
      }
      onProgress?.(uploaded.length, urls.length, failed);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  if (!uploaded.length) return null;
  if (failed > 0) console.log(`  ${failed}/${urls.length} photos failed for ${slug}`);
  return uploaded;
}

/**
 * Durable-copy sold/closed photos to R2 under photos/sold/{listing_id}/.
 * Returns R2 public URLs in source order (hero first), or null if the hero
 * (idx 0) could not be copied — caller must leave the MLS URLs in place.
 */
export async function syncSoldListingPhotos(listingId, photoUrls, { onProgress } = {}) {
  if (!isConfigured()) return null;
  const safeId = String(listingId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeId) return null;
  const urls = (photoUrls || []).filter((u) => typeof u === 'string' && u.length > 10);
  if (!urls.length) return null;

  const uploaded = new Array(urls.length).fill(null);
  let cursor = 0;
  let failed = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) return;
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      const url = urls[i];
      try {
        // listingId is the sold MLS id — photo proxy looks up sold_listings.
        const buf = await downloadPhoto(url, { listingId: safeId, idx: i });
        const { hero, thumb } = await processPhoto(buf);
        const heroKey = soldKeyFor(safeId, i + 1, '-hero');
        const thumbKey = soldKeyFor(safeId, i + 1, '-400w');
        await Promise.all([
          upload(heroKey, hero),
          upload(thumbKey, thumb),
        ]);
        uploaded[i] = publicUrlFor(heroKey);
      } catch (e) {
        failed += 1;
        console.error(`  sold photo ${i + 1}/${urls.length} failed for ${safeId}: ${e.message}`);
      }
      onProgress?.(uploaded.filter(Boolean).length, urls.length, failed);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  if (!uploaded[0]) return null;
  if (failed > 0) console.log(`  ${failed}/${urls.length} sold photos failed for ${safeId}`);
  return uploaded.filter(Boolean);
}

/** Standalone sweep: process every active listing whose photos aren't hosted yet. */
async function sweep({ limit = null } = {}) {
  const sweepPool = getSweepPool();
  if (!isConfigured()) {
    console.log('photoSync: R2 not configured (missing R2_* env vars) — skipping photo download.');
    await sweepPool.end();
    return;
  }
  const base = R2_PUBLIC_URL.replace(/^https?:\/\//, '');
  const q = limit
    ? `SELECT id, listing_id, slug, photos FROM listings WHERE is_active AND photos::text <> '[]' AND NOT (photos::text LIKE $1) ORDER BY updated_at DESC LIMIT $2`
    : `SELECT id, listing_id, slug, photos FROM listings WHERE is_active AND photos::text <> '[]' AND NOT (photos::text LIKE $1) ORDER BY updated_at DESC`;
  const params = limit ? [`%${base}%`, limit] : [`%${base}%`];
  const res = await sweepPool.query(q, params);
  console.log(`photoSync: ${res.rows.length} listings need photos`);

  let done = 0;
  let photoCount = 0;
  for (const row of res.rows) {
    const urls = row.photos || [];
    const newUrls = await syncListingPhotos(row, urls);
    if (newUrls && newUrls.length) {
      await sweepPool.query('UPDATE listings SET photos = $1, photos_count = $2, updated_at = NOW() WHERE id = $3', [
        JSON.stringify(newUrls), newUrls.length, row.id,
      ]);
      photoCount += newUrls.length;
    }
    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${res.rows.length} listings, ${photoCount} photos`);
  }
  console.log(`photoSync complete: ${done} listings, ${photoCount} photos uploaded.`);
  await sweepPool.end();
}

// CLI
const isMain = process.argv[1] && process.argv[1].endsWith('photoSync.js');
if (isMain) {
  const arg = process.argv[2];
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : null;
  if (arg === '--all' || arg === '--limit') {
    sweep({ limit }).catch((e) => { console.error('photoSync error:', e.message); process.exit(1); });
  } else {
    console.log('usage: node backend/src/services/photoSync.js [--all|--limit N]');
    getSweepPool().end();
  }
}

export { isConfigured };
