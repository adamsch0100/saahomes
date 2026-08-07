/**
 * GreatSchools ratings sync — weekly, polite, cache-only.
 *
 * Fetches public JSON-LD from greatschools.org city pages for the 19
 * Northern Colorado core cities, extracts School items with the
 * "GreatSchools Rating" PropertyValue (1–10), and upserts into
 * school_ratings. Never fabricates ratings; a failed city is skipped.
 *
 * Run:
 *   node backend/src/services/greatSchoolsSync.js
 *   node backend/src/services/greatSchoolsSync.js --city=fort-collins
 *   POST /api/cron/school-ratings?key=CRON_SECRET
 *
 * Rate limit: 1 fetch per city per run, ~1s pause between cities.
 * Weekly is plenty — school data changes rarely.
 */

import getPool from '../config/database.js';

const USER_AGENT =
  'SAAHomes/1.0 (+https://saahomes.com; school-ratings weekly cache; contact support@saahomes.com)';

/** 19 NoCo core cities — slug matches greatschools.org/colorado/{slug}/ */
export const CORE_CITIES = [
  { city: 'Fort Collins', slug: 'fort-collins' },
  { city: 'Loveland', slug: 'loveland' },
  { city: 'Windsor', slug: 'windsor' },
  { city: 'Greeley', slug: 'greeley' },
  { city: 'Timnath', slug: 'timnath' },
  { city: 'Wellington', slug: 'wellington' },
  { city: 'Johnstown', slug: 'johnstown' },
  { city: 'Eaton', slug: 'eaton' },
  { city: 'Milliken', slug: 'milliken' },
  { city: 'La Salle', slug: 'la-salle' },
  { city: 'Mead', slug: 'mead' },
  { city: 'Longmont', slug: 'longmont' },
  { city: 'Boulder', slug: 'boulder' },
  { city: 'Berthoud', slug: 'berthoud' },
  { city: 'Firestone', slug: 'firestone' },
  { city: 'Frederick', slug: 'frederick' },
  { city: 'Evans', slug: 'evans' },
  { city: 'Severance', slug: 'severance' },
  { city: 'Niwot', slug: 'niwot' },
];

const LEVEL_RE =
  /\b(elementary|middle|junior\s*high|high|k-?8|p-?8|pk-?8|charter|academy)\b/i;

/**
 * Normalize a school name for fuzzy match (IRES short names ↔ GS full names).
 * e.g. "Bauder" ↔ "Bauder Elementary School"
 */
export function normalizeSchoolName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[''']/g, '')
    .replace(
      /\b(elementary|middle|junior|jr\.?|high|school|charter|academy|magnet|preparatory|prep|k-?8|p-?8|pk-?8|early\s*childhood|ec)\b/gi,
      ' '
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when IRES name and GreatSchools name refer to the same school. */
export function schoolNamesMatch(a, b) {
  const na = normalizeSchoolName(a);
  const nb = normalizeSchoolName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Require ≥3 chars on the shorter side to avoid "East" matching everything
  if (na.length < 3 || nb.length < 3) return na === nb;
  return na.includes(nb) || nb.includes(na);
}

function inferLevel(name) {
  const n = String(name || '').toLowerCase();
  if (/\belementary\b|\bk-?\d|\bp-?\d|\bpk\b/.test(n) && !/\bmiddle\b|\bhigh\b/.test(n)) {
    return 'elementary';
  }
  if (/\bmiddle\b|\bjunior\b|\bjr\b/.test(n)) return 'middle';
  if (/\bhigh\b/.test(n) && !/\belementary\b/.test(n)) return 'high';
  if (/\bk-?8\b|\bp-?8\b|\bpk-?8\b/.test(n)) return 'k-8';
  return null;
}

function extractGsRating(additionalProperty) {
  const props = Array.isArray(additionalProperty)
    ? additionalProperty
    : additionalProperty
      ? [additionalProperty]
      : [];
  for (const p of props) {
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name || '');
    if (/greatschools\s*rating/i.test(name) && p.value != null) {
      const v = Number(p.value);
      if (Number.isFinite(v) && v >= 1 && v <= 10) return Math.round(v);
    }
  }
  return null;
}

/**
 * Parse School items from a GreatSchools city HTML page (JSON-LD only).
 */
export function parseSchoolsFromHtml(html, { city, slug } = {}) {
  const schools = [];
  const scriptRe =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const blocks = Array.isArray(data) ? data : [data];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      if (block['@type'] === 'ItemList' && Array.isArray(block.itemListElement)) {
        for (const li of block.itemListElement) {
          const item = li?.item;
          if (item && item['@type'] === 'School' && item.name) {
            schools.push(item);
          }
        }
      } else if (block['@type'] === 'School' && block.name) {
        schools.push(block);
      }
    }
  }

  const seen = new Set();
  const out = [];
  for (const s of schools) {
    const name = String(s.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rating = extractGsRating(s.additionalProperty);
    // Skip unrated schools — we only store real ratings
    if (rating == null) continue;

    const url =
      (typeof s.url === 'string' && s.url) ||
      (typeof s['@id'] === 'string' && s['@id'].replace(/#.*$/, '')) ||
      null;
    const agg = s.aggregateRating || {};
    out.push({
      school_name: name,
      city: city || null,
      city_slug: slug || null,
      rating,
      review_rating:
        agg.ratingValue != null && Number.isFinite(Number(agg.ratingValue))
          ? Number(agg.ratingValue)
          : null,
      review_count:
        agg.reviewCount != null || agg.ratingCount != null
          ? Number(agg.reviewCount ?? agg.ratingCount) || null
          : null,
      url,
      level: inferLevel(name),
    });
  }
  return out;
}

async function fetchCityPage(slug) {
  const url = `https://www.greatschools.org/colorado/${slug}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Upsert school rows for one city. Replaces stale rows for that city_slug
 * only for names we re-fetched (keeps other cities intact).
 */
async function upsertSchools(pool, rows) {
  if (!rows.length) return 0;
  let n = 0;
  for (const r of rows) {
    await pool.query(
      `INSERT INTO school_ratings
         (school_name, city, city_slug, rating, review_rating, review_count, url, level, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (school_name, city_slug) DO UPDATE SET
         city = EXCLUDED.city,
         rating = EXCLUDED.rating,
         review_rating = EXCLUDED.review_rating,
         review_count = EXCLUDED.review_count,
         url = EXCLUDED.url,
         level = EXCLUDED.level,
         fetched_at = NOW()`,
      [
        r.school_name,
        r.city,
        r.city_slug,
        r.rating,
        r.review_rating,
        r.review_count,
        r.url,
        r.level,
      ]
    );
    n += 1;
  }
  return n;
}

/**
 * Sync one or all core cities. Returns summary.
 */
export async function syncSchoolRatings({ onlySlug = null, delayMs = 1200 } = {}) {
  const pool = getPool();
  const cities = onlySlug
    ? CORE_CITIES.filter((c) => c.slug === onlySlug)
    : CORE_CITIES;

  if (!cities.length) {
    return { ok: false, error: `Unknown city slug: ${onlySlug}`, cities: [] };
  }

  const results = [];
  let totalUpserted = 0;

  for (let i = 0; i < cities.length; i += 1) {
    const { city, slug } = cities[i];
    const entry = { city, slug, count: 0, error: null };
    try {
      const html = await fetchCityPage(slug);
      const schools = parseSchoolsFromHtml(html, { city, slug });
      entry.count = await upsertSchools(pool, schools);
      totalUpserted += entry.count;
      console.log(`[greatSchools] ${city}: ${entry.count} schools with ratings`);
    } catch (err) {
      entry.error = err.message || String(err);
      console.warn(`[greatSchools] ${city} failed: ${entry.error}`);
    }
    results.push(entry);
    if (i < cities.length - 1) await sleep(delayMs);
  }

  return {
    ok: true,
    totalUpserted,
    cities: results,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Look up ratings for a listing's elementary/middle/high school fields.
 * Prefer same-city cache rows; fall back to full NoCo cache for fuzzy name match
 * (city pages only list a subset of schools).
 */
export async function matchRatingsForListing(listing) {
  if (!listing) return [];
  const pool = getPool();
  const city = listing.city || '';
  const citySlug = String(city)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Prefer city rows; always also load full cache for fallback name match
  let cityRows = [];
  if (citySlug) {
    const r = await pool.query(
      `SELECT school_name, city, city_slug, rating, url, level, review_rating, review_count
       FROM school_ratings
       WHERE city_slug = $1 OR city ILIKE $2
       ORDER BY rating DESC NULLS LAST`,
      [citySlug, city]
    );
    cityRows = r.rows;
  }
  const all = await pool.query(
    `SELECT school_name, city, city_slug, rating, url, level, review_rating, review_count
     FROM school_ratings
     ORDER BY rating DESC NULLS LAST`
  );
  const allRows = all.rows;

  const levels = [
    ['elementary', listing.elementary_school],
    ['middle', listing.middle_school],
    ['high', listing.high_school],
  ];

  const findHit = (name) => {
    const local = cityRows.find((row) => schoolNamesMatch(name, row.school_name));
    if (local) return local;
    return allRows.find((row) => schoolNamesMatch(name, row.school_name)) || null;
  };

  const matched = [];
  for (const [level, name] of levels) {
    if (!name) continue;
    const hit = findHit(name);
    matched.push({
      level,
      name,
      gsRating: hit?.rating ?? null,
      gsUrl: hit?.url ?? null,
      reviewRating: hit?.review_rating ?? null,
      reviewCount: hit?.review_count ?? null,
      matchedName: hit?.school_name ?? null,
    });
  }
  return matched;
}

/**
 * Top-rated schools for a city (for area pages).
 */
export async function getSchoolsByCity(cityOrSlug, { limit = 20 } = {}) {
  const pool = getPool();
  const raw = String(cityOrSlug || '').trim();
  if (!raw) return [];
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const r = await pool.query(
    `SELECT school_name AS name, city, city_slug, rating, url, level,
            review_rating, review_count, fetched_at
     FROM school_ratings
     WHERE city_slug = $1 OR LOWER(city) = LOWER($2)
     ORDER BY rating DESC NULLS LAST, school_name ASC
     LIMIT $3`,
    [slug, raw.replace(/-/g, ' '), limit]
  );
  return r.rows;
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isDirectRun = process.argv[1]?.includes('greatSchoolsSync');

if (isDirectRun) {
  const onlyArg = process.argv.find((a) => a.startsWith('--city='));
  const onlySlug = onlyArg ? onlyArg.split('=')[1] : null;
  syncSchoolRatings({ onlySlug })
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      process.exit(summary.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
