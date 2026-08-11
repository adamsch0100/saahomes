/**
 * Market content pack registry (P-4).
 *
 * Per-market data/config packs: stats sources, school data, DPA programs,
 * local copy. Engine is market-agnostic; local depth + brand live in packs.
 *
 * ── How to add a market (2-line recipe) ──────────────────────────────────
 * 1. Copy backend/src/config/marketPack.js → marketPack.<key>.js and fill
 *    real verified local data only (never fabricate stats/schools/DPA).
 * 2. Import it below and register: marketPacks['<key>'] = thatPack;
 * 3. Set the agent's users.market_key = '<key>' (admin create/patch).
 *
 * Frontend twin: src/data/marketPacks.js (same keys + getMarketPack contract).
 * NoCO is the shipped v1 template. Unknown/null keys always fall back to NoCO
 * — never throw, never invent a second market's content.
 */
import { marketPack as nocoPack } from './marketPack.js';

/** @type {Record<string, typeof nocoPack>} */
export const marketPacks = {
  noco: nocoPack,
};

/** Default market key when unset or unknown. */
export const DEFAULT_MARKET_KEY = 'noco';

/**
 * Registered market keys (for admin validation / 400 error lists).
 * @returns {string[]}
 */
export function listMarketKeys() {
  return Object.keys(marketPacks);
}

/**
 * Normalize a raw market_key for storage.
 * null/empty → 'noco'. Unknown key → { error }. Valid → lowercase key.
 *
 * @param {unknown} raw
 * @returns {{ key: string } | { error: string }}
 */
export function normalizeMarketKey(raw) {
  if (raw == null || raw === '') {
    return { key: DEFAULT_MARKET_KEY };
  }
  const key = String(raw).toLowerCase().trim();
  if (!key) return { key: DEFAULT_MARKET_KEY };
  if (!Object.prototype.hasOwnProperty.call(marketPacks, key)) {
    return {
      error: `marketKey must be one of: ${listMarketKeys().join(', ')}`,
    };
  }
  return { key };
}

/**
 * Resolve pack for a market key. Unknown/null → NoCO pack (never throw).
 *
 * @param {string|null|undefined} marketKey
 * @returns {typeof nocoPack}
 */
export function getMarketPack(marketKey) {
  if (marketKey == null || marketKey === '') {
    return marketPacks[DEFAULT_MARKET_KEY];
  }
  const key = String(marketKey).toLowerCase().trim();
  return marketPacks[key] || marketPacks[DEFAULT_MARKET_KEY];
}

/**
 * Effective market key for a user row (null/empty/unknown → 'noco').
 * @param {string|null|undefined} marketKey
 * @returns {string}
 */
export function resolveMarketKey(marketKey) {
  if (marketKey == null || marketKey === '') return DEFAULT_MARKET_KEY;
  const key = String(marketKey).toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(marketPacks, key)
    ? key
    : DEFAULT_MARKET_KEY;
}

export default {
  marketPacks,
  getMarketPack,
  listMarketKeys,
  normalizeMarketKey,
  resolveMarketKey,
  DEFAULT_MARKET_KEY,
};
