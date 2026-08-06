import 'dotenv/config';
import pg from 'pg';
import sharp from 'sharp';
import { syncListingPhotos } from './photoSync.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

// Grab one active listing with photos
const r = await pool.query(
  `SELECT id, listing_id, slug, photos FROM listings WHERE is_active AND photos::text <> '[]' AND photos::text LIKE '%mlsgrid%' LIMIT 1`
);
if (!r.rows.length) { console.log('no listing with mlsgrid photos found'); process.exit(0); }
const row = r.rows[0];
console.log('listing:', row.slug, '| photos:', (row.photos || []).length);

const url = row.photos[0];
console.log('fetching:', url.slice(0, 90));
const res = await fetch(url, { headers: { 'User-Agent': 'saahomes-idx/1.0 (Schwartz and Associates)', Accept: 'image/*' } });
const buf = Buffer.from(await res.arrayBuffer());
console.log('source:', buf.length, 'bytes');

const hero = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
const thumb = await sharp(buf).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
const meta = await sharp(hero).metadata();
console.log('hero.webp:', hero.length, 'bytes |', meta.width + 'x' + meta.height, '| format:', meta.format);
console.log('EXIF present:', !!(meta.exif && meta.exif.length));
console.log('thumb.webp:', thumb.length, 'bytes |', (await sharp(thumb).metadata()).width + 'w');

// verify syncListingPhotos graceful-skip without R2 creds
const out = await syncListingPhotos(row, row.photos);
console.log('syncListingPhotos without R2 →', out === null ? 'skipped (correct)' : 'UNEXPECTED');

await pool.end();
