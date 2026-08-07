// Photo health check — proxy + CDN status right now
const base = 'https://saahomes.com';
const s = await fetch(`${base}/api/listings?city=Fort%20Collins&limit=10`);
const sd = await s.json();
const listings = (sd?.data || []).filter((l) => l.photos?.length > 0).slice(0, 3);
for (const l of listings) {
  const p = await fetch(`${base}/api/photo/${l.id}/0`);
  const buf = await p.arrayBuffer();
  const direct = await fetch(l.photos[0], { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log(`id=${l.id} photos=${l.photos.length} proxy=${p.status} ${(buf.byteLength/1024).toFixed(0)}KB cdnDirect=${direct.status}`);
}
