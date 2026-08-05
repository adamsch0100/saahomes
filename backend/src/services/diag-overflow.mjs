#!/usr/bin/env node
// Scan ALL active listings for numeric values that overflow the listings columns.
import 'dotenv/config';

const URL = process.env.IRES_API_URL;
const TOK = process.env.IRES_ACCESS_TOKEN;
const FIELDS = ['ListingKey','ListPrice','BedroomsTotal','BathroomsTotalInteger','BathroomsFull','LivingArea','LotSizeArea','GarageSpaces','AssociationFee','Latitude','Longitude','YearBuilt'];

const limits = {
  ListPrice: 9999999999, LivingArea: 999999999, LotSizeArea: 99999999999,
  GarageSpaces: 9999, AssociationFee: 99999999, Latitude: 999, Longitude: 999, YearBuilt: 99999,
  BedroomsTotal: 9999, BathroomsTotalInteger: 9999, BathroomsFull: 9999,
};

let offset = 0, total = 0;
const problems = {};
const maxes = {};
while (true) {
  const res = await fetch(`${URL}/Property?$top=100&$skip=${offset}&$filter=StandardStatus eq 'Active'&$select=${FIELDS.join(',')}`, {
    headers: { Authorization: `Bearer ${TOK}`, Accept: 'application/json', 'Accept-Encoding': 'gzip', 'User-Agent': 'saahomes-idx/1.0' },
  });
  if (!res.ok) { console.log('fetch failed', res.status, await res.text()); break; }
  const rows = (await res.json()).value || [];
  if (!rows.length) break;
  for (const r of rows) {
    total++;
    for (const f of FIELDS) {
      const v = r[f];
      if (v === null || v === undefined || v === '') continue;
      const n = Number(v);
      if (!Number.isFinite(n)) { (problems[f] ||= []).push(`${r.ListingKey}:${v} non-numeric`); continue; }
      maxes[f] = Math.max(maxes[f] ?? 0, Math.abs(n));
      if (Math.abs(n) > (limits[f] ?? 1e12)) (problems[f] ||= []).push(`${r.ListingKey}:${v}`);
    }
  }
  offset += rows.length;
  if (rows.length < 100) break;
  if (offset > 20000) break;
}
console.log('total active scanned:', total);
console.log('max abs per field:', JSON.stringify(maxes));
for (const [f, vals] of Object.entries(problems)) {
  console.log(`OVERFLOW ${f}:`, [...new Set(vals)].slice(0, 6));
}
if (!Object.keys(problems).length) console.log('NO OVERFLOWS FOUND');
