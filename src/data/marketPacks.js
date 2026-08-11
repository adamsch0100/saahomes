/**
 * Market content pack registry — frontend twin (P-4).
 *
 * Same contract as backend/src/config/marketPacks.js:
 *   marketPacks  — plain map marketKey → pack
 *   getMarketPack(marketKey) — NoCO fallback for unknown/null (never throw)
 *
 * ── How to add a market (mirror backend) ─────────────────────────────────
 * 1. Copy src/data/marketPack.js → marketPack.<key>.js with real local data.
 * 2. Import + register under the same key as the backend registry.
 * 3. Set agent users.market_key (admin). Console reads market via /api/agent/me.
 *
 * Consumers that import { marketPack } from marketPack.js stay on NoCO —
 * correct for the current single-market product surface.
 */
import { marketPack as nocoPack } from './marketPack.js';

/** @type {Record<string, typeof nocoPack>} */
export const marketPacks = {
  noco: nocoPack,
};

export const DEFAULT_MARKET_KEY = 'noco';

/**
 * @returns {string[]}
 */
export function listMarketKeys() {
  return Object.keys(marketPacks);
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
 * Effective market key (null/empty/unknown → 'noco').
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
  resolveMarketKey,
  DEFAULT_MARKET_KEY,
};
