// Prove the photo proxy works: temporarily point one listing's photo[0] at a
// local test image, hit /api/photo, confirm cache+serve, then restore the
// original URL. Requires the backend running on :3001 with DATABASE_URL.
import http from 'http';
import pg from 'pg';
import 'dotenv/config';

const PORT = 3999;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

// Minimal 1x1-ish JPEG (valid image bytes)
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'image/jpeg' });
  res.end(JPEG);
});
await new Promise((r) => server.listen(PORT, r));
console.log('test image server on', PORT);

try {
  // Pick a listing with photos
  const listing = (await pool.query("SELECT id, photos FROM listings WHERE jsonb_array_length(photos) > 0 LIMIT 1")).rows[0];
  if (!listing) { console.log('no listing with photos'); process.exit(1); }
  const original = listing.photos[0];
  console.log(`listing ${listing.id}: swapping photo[0] -> http://localhost:${PORT}/img.jpg`);

  // Swap
  const newPhotos = [...listing.photos];
  newPhotos[0] = `http://localhost:${PORT}/img.jpg`;
  await pool.query('UPDATE listings SET photos = $1::jsonb WHERE id = $2', [JSON.stringify(newPhotos), listing.id]);

  try {
    // First fetch → should pull from test server + cache
    const r1 = await fetch(`http://localhost:3001/api/photo/${listing.id}/0`);
    const b1 = Buffer.from(await r1.arrayBuffer());
    console.log('fetch 1:', r1.status, '| type:', r1.headers.get('content-type'), '| bytes:', b1.length, '| matches:', b1.equals(JPEG));

    // Second fetch → cache hit, server should NOT be hit again
    let hits = 0;
    server.on('request', () => hits++);
    const r2 = await fetch(`http://localhost:3001/api/photo/${listing.id}/0`);
    const b2 = Buffer.from(await r2.arrayBuffer());
    console.log('fetch 2:', r2.status, '| bytes:', b2.length, '| matches:', b2.equals(JPEG), '| upstream hits:', hits);
  } finally {
    // Restore original
    await pool.query('UPDATE listings SET photos = $1::jsonb WHERE id = $2', [JSON.stringify(listing.photos), listing.id]);
    console.log('restored original photos for listing', listing.id);
  }
} catch (e) {
  console.log('TEST ERR', e.stack || e);
} finally {
  server.close();
  await pool.end();
}
