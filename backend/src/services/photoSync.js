/**
 * Photo pipeline: download MLS photos → strip EXIF → resize to WebP (1600px
 * hero + 400px thumbnail) → upload to Cloudflare R2 with SEO filenames.
 *
 * Storage layout (mirrors listing page slugs so Google links image ↔ page):
 *   photos/{listing-slug}/01-hero.webp
 *   photos/{listing-slug}/02-hero.webp
 *   photos/{listing-slug}/01-400w.webp
 *
 * Runs standalone:  node backend/src/services/photoSync.js [--all|--limit N]
 * Requires R2_* env vars. Without them, exits gracefully (no-op).
 */
import 'dotenv/config';
import pg from 'pg';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'saahomes-photos';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const isConfigured = () => !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_URL);

let s3 = null;
function getS3() {
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return s3;
}

const CONCURRENCY = 6;
const HERO_WIDTH = 1600;
const THUMB_WIDTH = 400;
const USER_AGENT = 'saahomes-idx/1.0 (Schwartz and Associates)';

async function downloadPhoto(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' }, redirect: 'follow' });
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
  await getS3().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

const keyFor = (slug, idx, suffix) => `photos/${slug}/${String(idx).padStart(2, '0')}${suffix}.webp`;
const publicUrlFor = (key) => `${R2_PUBLIC_URL}/${key}`;

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
    while (cursor < urls.length) {
      const i = cursor++;
      const url = urls[i];
      try {
        const buf = await downloadPhoto(url);
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

/** Standalone sweep: process every active listing whose photos aren't hosted yet. */
async function sweep({ limit = null } = {}) {
  if (!isConfigured()) {
    console.log('photoSync: R2 not configured (missing R2_* env vars) — skipping photo download.');
    await pool.end();
    return;
  }
  const base = R2_PUBLIC_URL.replace(/^https?:\/\//, '');
  const q = limit
    ? `SELECT id, listing_id, slug, photos FROM listings WHERE is_active AND photos::text <> '[]' AND NOT (photos::text LIKE $1) ORDER BY updated_at ASC LIMIT $2`
    : `SELECT id, listing_id, slug, photos FROM listings WHERE is_active AND photos::text <> '[]' AND NOT (photos::text LIKE $1) ORDER BY updated_at ASC`;
  const params = limit ? [`%${base}%`, limit] : [`%${base}%`];
  const res = await pool.query(q, params);
  console.log(`photoSync: ${res.rows.length} listings need photos`);

  let done = 0;
  let photoCount = 0;
  for (const row of res.rows) {
    const urls = row.photos || [];
    const newUrls = await syncListingPhotos(row, urls);
    if (newUrls && newUrls.length) {
      await pool.query('UPDATE listings SET photos = $1, photos_count = $2, updated_at = NOW() WHERE id = $3', [
        JSON.stringify(newUrls), newUrls.length, row.id,
      ]);
      photoCount += newUrls.length;
    }
    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${res.rows.length} listings, ${photoCount} photos`);
  }
  console.log(`photoSync complete: ${done} listings, ${photoCount} photos uploaded.`);
  await pool.end();
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
    pool.end();
  }
}

export { isConfigured };
