/**
 * Homeowner comps: recent nearby sales a homeowner can pick from, plus their
 * own read on condition and upgrades, rolled into an estimate they control.
 *
 * Each comp is adjusted toward the owner's home with simple, stated rules
 * (size, bedrooms, bathrooms). Condition and upgrades move the result by
 * fixed percentages. It is an estimate the owner builds, never an appraisal,
 * and the page says so.
 */
import getPool from '../config/database.js';

export const COMP_LOOKBACK_DAYS = 365;
export const MAX_COMPS = 12;
export const DEFAULT_INCLUDED = 6;

export const CONDITIONS = {
  needs_work: { label: 'Needs work', pct: -0.07 },
  average: { label: 'Average for the area', pct: 0 },
  updated: { label: 'Updated', pct: 0.03 },
  remodeled: { label: 'Fully remodeled', pct: 0.06 },
};

export const UPGRADES = {
  kitchen: { label: 'Kitchen remodel (last 10 years)', pct: 0.02 },
  baths: { label: 'Bathroom remodel', pct: 0.015 },
  basement: { label: 'Finished basement', pct: 0.03 },
  roof: { label: 'New roof (last 5 years)', pct: 0.01 },
  solar: { label: 'Owned solar panels', pct: 0.01 },
};
const MAX_UPGRADE_PCT = 0.08;

// Rules of thumb for adjusting a sale toward the subject home.
const MARGINAL_SQFT_SHARE = 0.5; // extra square feet are worth about half the average $/sqft
const BED_VALUE = 10000;
const BATH_VALUE = 7500;

const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round1k = (v) => Math.round(v / 1000) * 1000;

/** Similarity of a sale to the subject home, 0–1. */
export function similarity(subject, comp, now = new Date()) {
  let s = 1;
  const sq = n(subject.living_area);
  const csq = n(comp.living_area);
  if (sq && csq) s -= Math.min(0.5, Math.abs(csq - sq) / sq) * 0.9;
  const beds = n(subject.beds);
  const cbeds = n(comp.beds);
  if (beds != null && cbeds != null) s -= Math.min(2, Math.abs(cbeds - beds)) * 0.12;
  if (comp.closed_date) {
    const months = (now - new Date(comp.closed_date)) / (30.4 * 86400000);
    s -= Math.max(0, Math.min(12, months)) * 0.02;
  }
  return Math.max(0, Math.round(s * 100) / 100);
}

/** One sale adjusted toward the subject: what it might have sold for if it were their home. */
export function adjustComp(subject, comp) {
  const price = n(comp.sold_price);
  if (!price) return null;
  let adjusted = price;
  const notes = [];
  const sq = n(subject.living_area);
  const csq = n(comp.living_area);
  if (sq && csq) {
    const diff = sq - csq;
    const perSqft = (price / csq) * MARGINAL_SQFT_SHARE;
    if (Math.abs(diff) >= 50) {
      adjusted += diff * perSqft;
      notes.push(`${diff > 0 ? '+' : '−'}${Math.abs(Math.round(diff)).toLocaleString('en-US')} sq ft`);
    }
  }
  const beds = n(subject.beds);
  const cbeds = n(comp.beds);
  if (beds != null && cbeds != null && beds !== cbeds) {
    adjusted += (beds - cbeds) * BED_VALUE;
    notes.push(`${beds > cbeds ? '+' : '−'}${Math.abs(beds - cbeds)} bed`);
  }
  const baths = n(subject.baths);
  const cbaths = n(comp.baths);
  if (baths != null && cbaths != null && baths !== cbaths) {
    adjusted += (baths - cbaths) * BATH_VALUE;
    notes.push(`${baths > cbaths ? '+' : '−'}${Math.abs(baths - cbaths)} bath`);
  }
  return { adjusted: Math.round(adjusted), notes };
}

function weightedMedian(pairs) {
  const xs = pairs.filter(([v, w]) => v != null && w > 0).sort((a, b) => a[0] - b[0]);
  const total = xs.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of xs) {
    acc += w;
    if (acc >= total / 2) return v;
  }
  return null;
}

/**
 * The owner's estimate from the sales they picked and their own read on the
 * home. Returns null until at least one sale is picked.
 */
export function compEstimate(subject, comps, { condition = 'average', upgrades = [] } = {}) {
  const used = comps
    .map((c) => ({ c, adj: adjustComp(subject, c) }))
    .filter((x) => x.adj);
  if (!used.length) return null;
  const base = weightedMedian(used.map(({ c, adj }) => [adj.adjusted, Math.max(0.2, c.similarity ?? 1)]));
  const condPct = CONDITIONS[condition]?.pct ?? 0;
  const upPct = Math.min(MAX_UPGRADE_PCT, [...new Set(upgrades)].reduce((s, u) => s + (UPGRADES[u]?.pct || 0), 0));
  const mid = base * (1 + condPct + upPct);
  const sorted = used.map((u) => u.adj.adjusted).sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  const spread = sorted.length >= 3 ? Math.max(0.04, (q(0.75) - q(0.25)) / 2 / base) : 0.06;
  return {
    low: round1k(mid * (1 - spread)),
    mid: round1k(mid),
    high: round1k(mid * (1 + spread)),
    base: round1k(base),
    used: used.length,
    condition_pct: condPct,
    upgrades_pct: Math.round(upPct * 1000) / 1000,
  };
}

/** Recent sales like the subject home, most similar first. */
export async function findComps(profile, pool = getPool(), now = new Date()) {
  const run = async (where, params) => (await pool.query(
    `SELECT listing_id, address, street_number, street_name, unit, city, postal_code, subdivision,
            beds, baths, living_area, sold_price, list_price, closed_date, days_on_market, home_type
     FROM sold_listings
     WHERE ${where} AND sold_price > 0 AND living_area > 200
       AND closed_date >= CURRENT_DATE - make_interval(days => ${COMP_LOOKBACK_DAYS})
     ORDER BY closed_date DESC LIMIT 200`,
    params
  )).rows;
  let rows = profile.postal_code ? await run('postal_code = $1', [String(profile.postal_code)]) : [];
  let scope = 'zip';
  if (rows.length < 4 && profile.city) {
    rows = await run('LOWER(city) = LOWER($1)', [String(profile.city)]);
    scope = 'city';
  }
  const sq = n(profile.living_area);
  const beds = n(profile.beds);
  const close = rows.filter((r) =>
    (!sq || Math.abs(n(r.living_area) - sq) / sq <= 0.35) && (beds == null || n(r.beds) == null || Math.abs(n(r.beds) - beds) <= 1));
  const pool2 = close.length >= 3 ? close : rows;
  return {
    scope,
    comps: pool2
      .map((r) => {
        const street = [r.street_number, r.street_name, r.unit ? `#${r.unit}` : null].filter(Boolean).join(' ') || r.address;
        return {
          id: String(r.listing_id),
          address: [street, r.city].filter(Boolean).join(', '),
          beds: n(r.beds),
          baths: n(r.baths),
          living_area: n(r.living_area),
          sold_price: n(r.sold_price),
          list_price: n(r.list_price),
          closed_date: r.closed_date,
          price_per_sqft: n(r.living_area) ? Math.round(n(r.sold_price) / n(r.living_area)) : null,
          similarity: similarity(profile, r, now),
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_COMPS),
  };
}
