/**
 * ReefAPI client with Postgres cache + hard monthly credit guard.
 *
 * PRIMARY licensed AVM source for seller home-value multi-source compare.
 * Endpoints: POST https://api.reefapi.com/<engine>/v1/<action>
 * Auth: header x-api-key
 *
 * COST GUARD (mandatory):
 *   - Free allowance: 1,000 credits (no card, never auto-bills)
 *   - Hard stop at 900 credits/mo → serve cache / our-comps only + flag
 *   - Never call live without checking cache first
 *   - Failed/blocked calls cost 0 (per ReefAPI docs)
 */
import crypto from 'crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';

const REEF_BASE = 'https://api.reefapi.com';
const PROVIDER = 'reefapi';
const MONTHLY_LIMIT = 1000;
const HARD_STOP = 900; // 90% — never approach paid territory

/** Default TTLs (days) by endpoint family */
const TTL_DAYS = {
  home_value_chart: 30,
  market_trends: 30,
  estimates: 30,
  listing_detail: 30,
  property_detail: 30,
  search: 14,
  sold: 14,
  comps: 14,
  default: 30,
};

/** Credit cost per successful call (from reefapi.com docs) */
export const CREDIT_COST = {
  'zillow/home_value_chart': 1,
  'zillow/market_trends': 2,
  'zillow/search': 2,
  'zillow/property_detail': 3,
  'zillow/comps': 2,
  'zillow/sold': 2,
  'realtor/estimates': 2,
  'realtor/detail': 3,
  'realtor/market_trends': 1,
  'redfin/listing_detail': 3,
  'redfin/similar': 2,
  'redfin/market_stats': 2,
};

function yearMonth(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function paramsHash(params) {
  const stable = JSON.stringify(params, Object.keys(params || {}).sort());
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 40);
}

function apiKey() {
  return process.env.REEFAPI_API_KEY || '';
}

export function reefConfigured() {
  return !!apiKey();
}

/**
 * Current month credit usage for reefapi.
 * @returns {{ credits_used: number, remaining_to_stop: number, at_hard_stop: boolean, year_month: string }}
 */
export async function getCreditStatus(pool = getPool()) {
  const ym = yearMonth();
  try {
    const r = await pool.query(
      `SELECT credits_used FROM api_credit_usage WHERE provider = $1 AND year_month = $2`,
      [PROVIDER, ym]
    );
    const used = r.rows[0]?.credits_used != null ? Number(r.rows[0].credits_used) : 0;
    return {
      credits_used: used,
      monthly_limit: MONTHLY_LIMIT,
      hard_stop: HARD_STOP,
      remaining_to_stop: Math.max(0, HARD_STOP - used),
      at_hard_stop: used >= HARD_STOP,
      year_month: ym,
    };
  } catch {
    // Table may not exist mid-deploy — treat as zero usage, but still refuse live if unknown later
    return {
      credits_used: 0,
      monthly_limit: MONTHLY_LIMIT,
      hard_stop: HARD_STOP,
      remaining_to_stop: HARD_STOP,
      at_hard_stop: false,
      year_month: ym,
    };
  }
}

async function recordCredits(credits, pool = getPool()) {
  if (!credits || credits <= 0) return;
  const ym = yearMonth();
  await pool.query(
    `INSERT INTO api_credit_usage (provider, year_month, credits_used)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider, year_month)
     DO UPDATE SET credits_used = api_credit_usage.credits_used + EXCLUDED.credits_used`,
    [PROVIDER, ym, credits]
  );
  // Flag once when we cross the hard stop
  const status = await getCreditStatus(pool);
  if (status.at_hard_stop) {
    await pool.query(
      `UPDATE api_credit_usage
       SET last_flagged_at = COALESCE(last_flagged_at, NOW()),
           notes = COALESCE(notes, $3)
       WHERE provider = $1 AND year_month = $2 AND last_flagged_at IS NULL`,
      [
        PROVIDER,
        ym,
        `HARD STOP: hit ${HARD_STOP}/${MONTHLY_LIMIT} ReefAPI credits. Serving cache/our-comps only. Flag Adam before any paid plan.`,
      ]
    );
    logger.warn('ReefAPI hard stop reached — cache/our-comps only', {
      credits_used: status.credits_used,
      year_month: ym,
    });
  }
}

/**
 * Read cache entry if fresh.
 * @returns {object|null} payload or null
 */
export async function getCache(provider, endpoint, params, { maxAgeDays } = {}, pool = getPool()) {
  const hash = paramsHash(params);
  const ttl = maxAgeDays ?? TTL_DAYS[endpoint] ?? TTL_DAYS.default;
  try {
    const r = await pool.query(
      `SELECT payload, credits_used, fetched_at
       FROM zillow_api_cache
       WHERE provider = $1 AND endpoint = $2 AND params_hash = $3
         AND fetched_at > NOW() - ($4::text || ' days')::interval
       LIMIT 1`,
      [provider, endpoint, hash, String(ttl)]
    );
    if (!r.rows[0]) return null;
    return {
      data: r.rows[0].payload,
      cached: true,
      fetched_at: r.rows[0].fetched_at,
      credits_used: r.rows[0].credits_used,
    };
  } catch (e) {
    logger.warn('zillow_api_cache read failed', { message: e.message });
    return null;
  }
}

/** Stale cache (any age) — used as last resort when hard-stopped. */
export async function getStaleCache(provider, endpoint, params, pool = getPool()) {
  const hash = paramsHash(params);
  try {
    const r = await pool.query(
      `SELECT payload, credits_used, fetched_at
       FROM zillow_api_cache
       WHERE provider = $1 AND endpoint = $2 AND params_hash = $3
       ORDER BY fetched_at DESC LIMIT 1`,
      [provider, endpoint, hash]
    );
    if (!r.rows[0]) return null;
    return {
      data: r.rows[0].payload,
      cached: true,
      stale: true,
      fetched_at: r.rows[0].fetched_at,
      credits_used: r.rows[0].credits_used,
    };
  } catch {
    return null;
  }
}

async function setCache(provider, endpoint, params, payload, creditsUsed, pool = getPool()) {
  const hash = paramsHash(params);
  await pool.query(
    `INSERT INTO zillow_api_cache (provider, endpoint, params_hash, payload, credits_used, fetched_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
     ON CONFLICT (provider, endpoint, params_hash)
     DO UPDATE SET payload = EXCLUDED.payload, credits_used = EXCLUDED.credits_used, fetched_at = NOW()`,
    [provider, endpoint, hash, JSON.stringify(payload), creditsUsed || 0]
  );
}

/**
 * Core call: cache-first, credit-guarded ReefAPI POST.
 *
 * @param {string} engine - 'zillow' | 'realtor' | 'redfin'
 * @param {string} action - e.g. 'home_value_chart', 'estimates'
 * @param {object} params - request body
 * @param {object} opts - { ttlDays, skipLive, forceLive }
 * @returns {Promise<{ ok, data, cached, credits, source, error?, credit_status? }>}
 */
export async function reefCall(engine, action, params = {}, opts = {}) {
  const pool = getPool();
  const endpoint = action;
  const provider = `${PROVIDER}_${engine}`;
  const costKey = `${engine}/${action}`;
  const cost = CREDIT_COST[costKey] ?? 2;
  const ttlDays = opts.ttlDays ?? TTL_DAYS[action] ?? TTL_DAYS.default;

  // 1) Fresh cache
  const hit = await getCache(provider, endpoint, params, { maxAgeDays: ttlDays }, pool);
  if (hit) {
    return {
      ok: true,
      data: hit.data,
      cached: true,
      credits: 0,
      source: provider,
      fetched_at: hit.fetched_at,
    };
  }

  // 2) Credit guard + key check
  const status = await getCreditStatus(pool);
  const key = apiKey();
  const canLive =
    !opts.skipLive &&
    !!key &&
    !status.at_hard_stop &&
    status.remaining_to_stop >= cost &&
    !opts.forceSkip;

  if (!canLive) {
    // Serve stale cache if any
    const stale = await getStaleCache(provider, endpoint, params, pool);
    if (stale) {
      return {
        ok: true,
        data: stale.data,
        cached: true,
        stale: true,
        credits: 0,
        source: provider,
        fetched_at: stale.fetched_at,
        credit_status: status,
        guard: status.at_hard_stop ? 'hard_stop' : !key ? 'no_key' : 'budget',
      };
    }
    return {
      ok: false,
      data: null,
      cached: false,
      credits: 0,
      source: provider,
      error: status.at_hard_stop
        ? 'ReefAPI monthly hard stop — serving our comps only. Flag Adam before paid plan.'
        : !key
          ? 'REEFAPI_API_KEY not configured'
          : 'Budget guard blocked live call',
      credit_status: status,
      guard: status.at_hard_stop ? 'hard_stop' : !key ? 'no_key' : 'budget',
    };
  }

  // 3) Live call
  try {
    const url = `${REEF_BASE}/${engine}/v1/${action}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const body = await res.json().catch(() => ({}));
    // ReefAPI: failed/blocked calls are free
    const callOk = body.ok === true || (res.ok && body.data != null);
    if (!callOk) {
      logger.warn('ReefAPI call not ok (free)', {
        engine,
        action,
        status: res.status,
        error: body.error || body.message,
      });
      return {
        ok: false,
        data: null,
        cached: false,
        credits: 0,
        source: provider,
        error: body.error?.message || body.message || `ReefAPI ${res.status}`,
        credit_status: status,
      };
    }

    const payload = body.data != null ? body.data : body;
    const used = Number(body.meta?.credits ?? cost) || cost;
    await setCache(provider, endpoint, params, payload, used, pool);
    await recordCredits(used, pool);

    return {
      ok: true,
      data: payload,
      cached: false,
      credits: used,
      source: provider,
      fetched_at: new Date().toISOString(),
      credit_status: await getCreditStatus(pool),
    };
  } catch (e) {
    logger.error('ReefAPI live call failed', { engine, action, message: e.message });
    const stale = await getStaleCache(provider, endpoint, params, pool);
    if (stale) {
      return {
        ok: true,
        data: stale.data,
        cached: true,
        stale: true,
        credits: 0,
        source: provider,
        fetched_at: stale.fetched_at,
        error: e.message,
      };
    }
    return {
      ok: false,
      data: null,
      cached: false,
      credits: 0,
      source: provider,
      error: e.message,
    };
  }
}

/** Convenience wrappers */
export const zillowHomeValueChart = (params, opts) =>
  reefCall('zillow', 'home_value_chart', params, opts);
export const zillowMarketTrends = (params, opts) =>
  reefCall('zillow', 'market_trends', params, opts);
export const zillowSearch = (params, opts) =>
  reefCall('zillow', 'search', params, opts);
export const realtorEstimates = (params, opts) =>
  reefCall('realtor', 'estimates', params, opts);
export const redfinListingDetail = (params, opts) =>
  reefCall('redfin', 'listing_detail', params, opts);
