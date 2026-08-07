// Test the expanded search filters against the local API
const base = 'http://localhost:3001';
const tests = [
  ['baseline NoCO', 'city=__noco__&limit=3'],
  ['minSqft 2000', 'city=__noco__&minSqft=2000&limit=3'],
  ['garage', 'city=__noco__&garage=true&limit=3'],
  ['newConstruction', 'city=__noco__&newConstruction=true&limit=3'],
  ['waterfront', 'city=__noco__&waterfront=true&limit=3'],
  ['pool', 'city=__noco__&pool=true&limit=3'],
  ['basement', 'city=__noco__&basement=true&limit=3'],
  ['fireplace', 'city=__noco__&fireplace=true&limit=3'],
  ['year 2020+', 'city=__noco__&minYear=2020&limit=3'],
  ['newDays 14', 'city=__noco__&newDays=14&limit=3'],
  ['maxHoa 200', 'city=__noco__&maxHoa=200&limit=3'],
  ['combo sqft+garage+pool', 'city=__noco__&minSqft=2500&garage=true&pool=true&limit=3'],
];
for (const [name, qs] of tests) {
  try {
    const r = await fetch(`${base}/api/listings?${qs}`);
    const d = await r.json();
    const rows = d.data || [];
    const sample = rows[0] ? `${rows[0].city} ${rows[0].living_area || '?'}sf ${rows[0].year_built || '?'}yr g${rows[0].garage_spaces || 0} ${(rows[0].features || {}).new_construction || ''}` : 'none';
    console.log(`${name.padEnd(28)} total=${String(d.meta?.total).padEnd(6)} first=${sample}`);
  } catch (e) {
    console.log(`${name.padEnd(28)} ERR ${e.message}`);
  }
}
