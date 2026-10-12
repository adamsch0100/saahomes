/**
 * Taste profile: what a buyer likes, learned from what they do.
 *
 * Signals, strongest first: Love / Maybe reactions and saved homes, then
 * homes they opened more than once, then single views. Not for me counts
 * against a home and hides it from their results and alerts.
 *
 * The profile is a handful of plain ranges (price, beds, size, towns, home
 * type, age, lot, garage). scoreListing() compares one home to it and
 * returns a 0–100 fit plus up to three reasons a person would say out loud.
 * Every reason names a fact about the home and a fact about the buyer's own
 * history; nothing is inferred that the data can't back up.
 */
import getPool from '../config/database.js';

const WEIGHTS = { love: 3, maybe: 1.5, saved: 3, view: 0.5 };
const MAX_VIEW_WEIGHT = 3; // three or more opens of one home count the same
const VIEW_LOOKBACK_DAYS = 120;
const MAX_VIEWED_HOMES = 60;
const READY_WEIGHT = 4;
const READY_HOMES = 3;
const CACHE_MS = 60 * 1000;

export const REACTIONS = ['love', 'maybe', 'pass'];

const cache = new Map();

export function invalidateTaste(userId) {
  cache.delete(Number(userId));
}

const num = (v) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function weightedQuantile(pairs, q) {
  const xs = pairs.filter(([v, w]) => v != null && w > 0).sort((a, b) => a[0] - b[0]);
  if (!xs.length) return null;
  const total = xs.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of xs) {
    acc += w;
    if (acc >= q * total) return v;
  }
  return xs[xs.length - 1][0];
}

function shareMap(pairs) {
  const by = {};
  let total = 0;
  for (const [k, w] of pairs) {
    if (!k || w <= 0) continue;
    by[k] = (by[k] || 0) + w;
    total += w;
  }
  if (!total) return {};
  for (const k of Object.keys(by)) by[k] = Math.round((by[k] / total) * 1000) / 1000;
  return by;
}

/**
 * Build a profile from signal rows: one per home, carrying the buyer's
 * reaction, whether it's saved, how often they opened it, and the home's facts.
 * Pure so it can be tested without a database.
 */
export function profileFromSignals(rows = []) {
  const positive = [];
  const passes = [];
  const counts = { loved: 0, maybe: 0, saved: 0, viewed: 0, passed: 0 };
  for (const r of rows) {
    if (r.reaction === 'pass') {
      counts.passed += 1;
      passes.push(r);
      continue;
    }
    const strong = Math.max(
      r.reaction === 'love' ? WEIGHTS.love : 0,
      r.reaction === 'maybe' ? WEIGHTS.maybe : 0,
      r.saved ? WEIGHTS.saved : 0
    );
    const views = Math.min(Number(r.views) || 0, MAX_VIEW_WEIGHT / WEIGHTS.view);
    const weight = strong + views * WEIGHTS.view;
    if (r.reaction === 'love') counts.loved += 1;
    if (r.reaction === 'maybe') counts.maybe += 1;
    if (r.saved) counts.saved += 1;
    if (Number(r.views) > 0) counts.viewed += 1;
    if (weight > 0 && r.list_price != null) positive.push({ ...r, weight, strong: strong > 0 });
  }

  const totalWeight = positive.reduce((s, r) => s + r.weight, 0);
  const strongWeight = positive.filter((r) => r.strong).reduce((s, r) => s + r.weight, 0);
  const ready = totalWeight >= READY_WEIGHT && positive.length >= READY_HOMES;
  const pick = (fn) => positive.map((r) => [fn(r), r.weight]);

  const strongByCity = {};
  for (const r of positive) if (r.strong && r.city) strongByCity[r.city] = (strongByCity[r.city] || 0) + 1;
  const passByCity = {};
  for (const r of passes) if (r.city) passByCity[r.city] = (passByCity[r.city] || 0) + 1;

  const garageKnown = positive.filter((r) => num(r.garage_spaces) != null);
  const garageWeight = garageKnown.reduce((s, r) => s + r.weight, 0);
  const share3 = garageWeight
    ? garageKnown.filter((r) => num(r.garage_spaces) >= 3).reduce((s, r) => s + r.weight, 0) / garageWeight
    : 0;

  return {
    ready,
    // "saved" when saves and reactions carry most of the weight, else "viewed"
    basis: strongWeight >= totalWeight / 2 && strongWeight > 0 ? 'saved' : 'viewed',
    counts,
    homes: positive.length,
    price: {
      p25: weightedQuantile(pick((r) => num(r.list_price)), 0.25),
      p50: weightedQuantile(pick((r) => num(r.list_price)), 0.5),
      p75: weightedQuantile(pick((r) => num(r.list_price)), 0.75),
    },
    beds: weightedQuantile(pick((r) => num(r.beds)), 0.5),
    sqft: weightedQuantile(pick((r) => num(r.living_area)), 0.5),
    year: weightedQuantile(pick((r) => num(r.year_built)), 0.5),
    lot: weightedQuantile(pick((r) => num(r.lot_size_acres)), 0.5),
    garage3: Math.round(share3 * 100) / 100,
    cities: shareMap(pick((r) => r.city)),
    types: shareMap(pick((r) => r.home_type)),
    strongByCity,
    passByCity,
  };
}

/** Signal rows for one buyer: reactions, saved homes and recent opens. */
export async function loadSignals(userId, pool = getPool()) {
  const { rows } = await pool.query(
    `WITH r AS (SELECT listing_key, reaction FROM home_reactions WHERE user_id = $1),
          s AS (SELECT listing_key FROM saved_homes WHERE user_id = $1),
          v AS (SELECT listing_id AS listing_key, COUNT(*)::int AS views
                FROM events
                WHERE user_id = $1 AND type = 'listing_view' AND listing_id IS NOT NULL
                  AND occurred_at > NOW() - make_interval(days => $2)
                GROUP BY listing_id ORDER BY MAX(occurred_at) DESC LIMIT $3),
          k AS (SELECT listing_key FROM r UNION SELECT listing_key FROM s UNION SELECT listing_key FROM v)
     SELECT k.listing_key, r.reaction, (s.listing_key IS NOT NULL) AS saved, COALESCE(v.views, 0) AS views,
            l.list_price, l.beds, l.living_area, l.city, l.home_type, l.year_built,
            l.garage_spaces, l.lot_size_acres
     FROM k
     LEFT JOIN r ON r.listing_key = k.listing_key
     LEFT JOIN s ON s.listing_key = k.listing_key
     LEFT JOIN v ON v.listing_key = k.listing_key
     LEFT JOIN listings l ON l.listing_id = k.listing_key`,
    [userId, VIEW_LOOKBACK_DAYS, MAX_VIEWED_HOMES]
  );
  return rows;
}

export async function getTasteProfile(userId, pool = getPool(), { fresh = false } = {}) {
  if (!userId) return null;
  const key = Number(userId);
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.profile;
  const profile = profileFromSignals(await loadSignals(userId, pool));
  cache.set(key, { at: Date.now(), profile });
  if (cache.size > 5000) cache.delete(cache.keys().next().value);
  return profile;
}

/** Listing keys the buyer marked Not for me. */
export async function passedListingKeys(userId, pool = getPool()) {
  if (!userId) return [];
  const { rows } = await pool.query(
    "SELECT listing_key FROM home_reactions WHERE user_id = $1 AND reaction = 'pass'",
    [userId]
  );
  return rows.map((r) => String(r.listing_key));
}

const fmtK = (n) => {
  if (n == null) return '';
  if (n >= 1_000_000) return `$${(Math.round(n / 10_000) / 100).toString().replace(/\.?0+$/, '')}M`;
  return `$${Math.round(n / 1000)}K`;
};

/**
 * How well one home fits the profile: { score 0–100, reasons[≤3] }, or null
 * when we don't know the buyer well enough yet.
 */
export function scoreListing(listing, profile) {
  if (!profile?.ready || !listing) return null;
  const verb = profile.basis === 'saved' ? 'saved' : 'looked at';
  const parts = [];
  const add = (key, weight, fit, reason = null) => parts.push({ key, weight, fit: Math.max(-0.5, Math.min(1, fit)), reason });

  const price = num(listing.list_price);
  const { p25, p50, p75 } = profile.price;
  if (price != null && p50) {
    const lo = p25 * 0.92;
    const hi = p75 * 1.08;
    const outside = price < lo ? lo - price : price > hi ? price - hi : 0;
    const fit = outside ? 1 - outside / (0.25 * p50) : 1;
    add('price', 0.3, fit, outside ? null : `In your price range (${fmtK(lo)}–${fmtK(hi)})`);
  }

  const city = listing.city;
  if (city) {
    const shares = Object.values(profile.cities);
    const top = shares.length ? Math.max(...shares) : 0;
    const share = profile.cities[city] || 0;
    const saved = profile.strongByCity[city] || 0;
    let reason = null;
    if (saved >= 2) reason = `In ${city}, where you've saved ${saved} homes`;
    else if (top && share / top >= 0.5) reason = `In ${city}, a town you keep coming back to`;
    let fit = top ? share / top : 0;
    if (!share && (profile.passByCity[city] || 0) >= 2) fit = -0.5;
    add('city', 0.2, fit, reason);
  }

  const beds = num(listing.beds);
  if (beds != null && profile.beds != null) {
    const d = Math.abs(beds - profile.beds);
    add('beds', 0.15, d < 0.5 ? 1 : d < 1.5 ? 0.5 : 0, d < 0.5 ? `${beds} beds, like the homes you've ${verb}` : null);
  }

  const sqft = num(listing.living_area);
  if (sqft && profile.sqft) {
    const off = Math.abs(sqft / profile.sqft - 1);
    add('sqft', 0.15, off <= 0.15 ? 1 : 1 - (off - 0.15) / 0.35,
      off <= 0.15 ? `${Math.round(sqft).toLocaleString('en-US')} sq ft, close to what you like` : null);
  }

  if (listing.home_type && Object.keys(profile.types).length) {
    const share = profile.types[listing.home_type] || 0;
    add('type', 0.1, share >= 0.5 ? 1 : share * 2);
  }

  // Extras: only speak up when the buyer's history clearly leans one way.
  const extras = [];
  const garage = num(listing.garage_spaces);
  if (profile.garage3 >= 0.5 && garage != null) {
    extras.push(garage >= 3
      ? { fit: 1, reason: `${garage}-car garage, like most homes you've ${verb}` }
      : { fit: 0 });
  }
  const year = num(listing.year_built);
  if (profile.year && year) {
    if (profile.year >= 2010 && year >= 2010) extras.push({ fit: 1, reason: `Built in ${year}, newer like your favorites` });
    else extras.push({ fit: 1 - Math.min(1, Math.abs(year - profile.year) / 30) });
  }
  const lot = num(listing.lot_size_acres);
  if (profile.lot != null && profile.lot >= 0.4 && lot != null) {
    extras.push(lot >= 0.4
      ? { fit: 1, reason: `${Math.round(lot * 100) / 100} acres, room like the homes you've ${verb}` }
      : { fit: 0.2 });
  }
  if (extras.length) {
    const avg = extras.reduce((s, e) => s + e.fit, 0) / extras.length;
    parts.push({ key: 'extras', weight: 0.1, fit: avg, reason: null });
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0) || 1;
  const raw = parts.reduce((s, p) => s + p.weight * p.fit, 0) / totalWeight;
  const score = Math.max(0, Math.min(100, Math.round(raw * 100)));

  // City and price lead; a standout garage beats bed count; size comes last.
  const partReason = (k) => parts.find((p) => p.key === k && p.fit === 1 && p.reason)?.reason;
  const extraReason = (word) => extras.find((e) => e.reason?.includes(word))?.reason;
  const reasons = [
    partReason('city'), partReason('price'), extraReason('garage'), partReason('beds'),
    extraReason('acres'), extraReason('Built'), partReason('sqft'),
  ].filter(Boolean);
  return { score, reasons: reasons.slice(0, 3) };
}

/** A short, honest summary of the profile for the buyer's own eyes. */
export function describeProfile(profile) {
  if (!profile) return null;
  const topCities = Object.entries(profile.cities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);
  return {
    ready: profile.ready,
    basis: profile.basis,
    counts: profile.counts,
    price_range: profile.price.p50 ? [Math.round(profile.price.p25 * 0.92), Math.round(profile.price.p75 * 1.08)] : null,
    beds: profile.beds,
    sqft: profile.sqft ? Math.round(profile.sqft) : null,
    cities: topCities,
    likes_big_garage: profile.garage3 >= 0.5,
  };
}
