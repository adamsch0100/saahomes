/**
 * Seller home-value engine (multi-source, honest labeling).
 *
 * Sources:
 *   1. OUR comps (always free, default) — zip/city median $/sqft × living_area
 *      from live MLS listings (/api/listings/stats pattern). NEVER fabricated AVM.
 *   2. ReefAPI AVMs when configured + under credit guard:
 *      - Zillow home_value_chart (10y curve)
 *      - Realtor.com estimates (3 independent AVMs)
 *      - Redfin listing_detail (optional)
 *
 * Display rule: "Our data says $X · Market services say $Y"
 * If no AVM available → our range only. Never invent a second number.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  reefConfigured,
  getCreditStatus,
  zillowHomeValueChart,
  zillowSearch,
  zillowMarketTrends,
  realtorEstimates,
} from './reefApiService.js';

const RANGE_BAND = 0.08; // ±8% around mid for our comps range

function roundDollar(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) / 1000) * 1000; // nearest $1k for honest estimate display
}

function cleanStr(v, max = 255) {
  const s = String(v || '').trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Median price_per_sqft for Active listings in a ZIP (preferred) or city.
 * Falls back to NoCO-wide if local sample is too thin (< 5).
 */
export async function getMedianPpsqft({ postal_code, city }, pool = getPool()) {
  const minSample = 5;
  const base = `is_active = TRUE AND status = 'Active'
    AND price_per_sqft IS NOT NULL AND price_per_sqft > 50 AND price_per_sqft < 2000
    AND living_area IS NOT NULL AND living_area > 200`;

  const tryQuery = async (where, params) => {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_sqft) AS med_ppsqft,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY list_price) AS med_price
       FROM listings WHERE ${where}`,
      params
    );
    const row = r.rows[0] || {};
    return {
      n: row.n || 0,
      med_ppsqft: row.med_ppsqft != null ? Number(row.med_ppsqft) : null,
      med_price: row.med_price != null ? Math.round(Number(row.med_price)) : null,
    };
  };

  let scope = null;
  let stats = { n: 0, med_ppsqft: null, med_price: null };

  if (postal_code) {
    stats = await tryQuery(`${base} AND postal_code = $1`, [String(postal_code).slice(0, 10)]);
    if (stats.n >= minSample && stats.med_ppsqft) {
      scope = { type: 'zip', value: String(postal_code), sample: stats.n };
    }
  }
  if (!scope && city) {
    stats = await tryQuery(`${base} AND LOWER(city) = LOWER($1)`, [String(city)]);
    if (stats.n >= minSample && stats.med_ppsqft) {
      scope = { type: 'city', value: String(city), sample: stats.n };
    }
  }
  if (!scope) {
    // Northern Colorado core cities
    const noco = [
      'Fort Collins', 'Loveland', 'Windsor', 'Greeley', 'Timnath', 'Wellington',
      'Johnstown', 'Berthoud', 'Severance', 'Eaton', 'Milliken', 'Evans',
      'Firestone', 'Frederick', 'Mead', 'Longmont', 'Erie',
    ];
    stats = await tryQuery(`${base} AND city = ANY($1::text[])`, [noco]);
    scope = { type: 'region', value: 'Northern Colorado', sample: stats.n };
  }

  return {
    median_ppsqft: stats.med_ppsqft != null ? Math.round(stats.med_ppsqft) : null,
    median_price: stats.med_price,
    sample_size: stats.n,
    scope,
  };
}

/**
 * Our estimate: median $/sqft × home sqft → mid, with ± band.
 * Honest label always includes scope + "estimate" + "updated monthly".
 */
export async function computeOurEstimate(profile, pool = getPool()) {
  const living = profile.living_area != null ? Number(profile.living_area) : null;
  const med = await getMedianPpsqft(
    { postal_code: profile.postal_code, city: profile.city },
    pool
  );

  if (!med.median_ppsqft) {
    return {
      low: null,
      mid: null,
      high: null,
      label: 'Insufficient local sales data for an estimate right now.',
      source: 'saa_mls',
      scope: med.scope,
      median_ppsqft: null,
      sample_size: med.sample_size,
      updated: 'monthly from live MLS',
    };
  }

  let mid = null;
  let low = null;
  let high = null;

  if (living && living > 200) {
    mid = roundDollar(med.median_ppsqft * living);
    low = roundDollar(mid * (1 - RANGE_BAND));
    high = roundDollar(mid * (1 + RANGE_BAND));
  } else if (med.median_price) {
    // No sqft — fall back to area median home price as a coarse range
    mid = med.median_price;
    low = roundDollar(mid * (1 - RANGE_BAND));
    high = roundDollar(mid * (1 + RANGE_BAND));
  }

  const scopeLabel =
    med.scope?.type === 'zip'
      ? `ZIP ${med.scope.value}`
      : med.scope?.type === 'city'
        ? med.scope.value
        : 'Northern Colorado';

  const label = living && living > 200
    ? `Estimated range based on ${scopeLabel} sales data (median $${med.median_ppsqft}/sqft × ${Number(living).toLocaleString()} sqft, ${med.sample_size} active listings). Updated monthly. Not an appraisal.`
    : `Estimated range based on ${scopeLabel} median list price (${med.sample_size} active listings). Add your home's square footage for a tighter estimate. Updated monthly. Not an appraisal.`;

  return {
    low,
    mid,
    high,
    label,
    source: 'saa_mls',
    source_label: 'SAA Homes (our MLS data)',
    scope: med.scope,
    median_ppsqft: med.median_ppsqft,
    sample_size: med.sample_size,
    updated: 'monthly from live MLS',
  };
}

/**
 * Resolve a Zillow zpid for an address (cached via reefCall search).
 * Costs 2 credits on miss — only when under budget.
 */
async function resolveZpid(profile) {
  if (profile.zpid) return { zpid: String(profile.zpid), cached: true };
  const location = [
    profile.address_line,
    profile.city,
    profile.state || 'CO',
    profile.postal_code,
  ].filter(Boolean).join(', ');
  if (!location || location.length < 8) return { zpid: null };

  const res = await zillowSearch({
    location,
    max_results: 5,
    max_pages: 1,
  });
  if (!res.ok || !res.data) return { zpid: null, error: res.error };

  const items = res.data.items || res.data.results || res.data.listings || [];
  const list = Array.isArray(items) ? items : [];
  // Prefer exact-ish address match
  const addrLower = String(profile.address_line || '').toLowerCase();
  const streetNum = addrLower.match(/^\d+/)?.[0];
  let best = list[0];
  if (streetNum) {
    const hit = list.find((it) =>
      String(it.address_line || it.address || '').toLowerCase().includes(streetNum)
    );
    if (hit) best = hit;
  }
  const zpid = best?.zpid != null ? String(best.zpid) : null;
  return { zpid, search_cached: res.cached, credits: res.credits || 0 };
}

/**
 * Normalize Zillow home_value_chart payload → series points for our chart.
 */
export function normalizeChartSeries(payload) {
  if (!payload) return null;
  const home = payload.this_home || payload.home || payload;
  const pointsRaw = home.points || home.history || payload.points || [];
  const points = (Array.isArray(pointsRaw) ? pointsRaw : [])
    .map((p) => {
      const dateMs = p.date_ms ?? p.dateMs ?? (p.date ? Date.parse(p.date) : null);
      const value = p.value_usd ?? p.valueUsd ?? p.value ?? p.y;
      if (dateMs == null || value == null) return null;
      return {
        date: new Date(Number(dateMs)).toISOString().slice(0, 10),
        date_ms: Number(dateMs),
        value: Math.round(Number(value)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date_ms - b.date_ms);

  // Comparison series if present (neighborhood/city)
  const series = [];
  const extra = payload.series || [];
  if (Array.isArray(extra)) {
    for (const s of extra) {
      const sp = (s.points || []).map((p) => {
        const dateMs = p.date_ms ?? p.dateMs ?? (p.date ? Date.parse(p.date) : null);
        const value = p.value_usd ?? p.valueUsd ?? p.value ?? p.y;
        if (dateMs == null || value == null) return null;
        return {
          date: new Date(Number(dateMs)).toISOString().slice(0, 10),
          date_ms: Number(dateMs),
          value: Math.round(Number(value)),
        };
      }).filter(Boolean);
      if (sp.length) {
        series.push({
          name: s.name || 'Comparison',
          points: sp,
        });
      }
    }
  }

  if (!points.length) return null;
  return {
    home: {
      name: home.name || 'This home',
      points,
      latest_value: payload.latest_value_usd ?? points[points.length - 1]?.value ?? null,
      earliest_value: payload.earliest_value_usd ?? points[0]?.value ?? null,
    },
    series,
    time_period: payload.time_period || '10y',
    source: 'Zillow (via licensed API)',
    attribution: 'Historical values via licensed market data. Not an appraisal.',
  };
}

/**
 * Normalize Realtor.com estimates → { providers: [{name, value, low, high}], mid }
 */
export function normalizeRealtorEstimates(payload) {
  if (!payload) return null;
  const providers = [];
  // Common shapes: estimates[], avms[], or named fields
  const candidates = [
    ...(Array.isArray(payload.estimates) ? payload.estimates : []),
    ...(Array.isArray(payload.avms) ? payload.avms : []),
  ];
  if (!candidates.length && typeof payload === 'object') {
    // Named AVMs: quantarium, collateral_analytics, cotality/corelogic
    const named = [
      ['quantarium', 'Quantarium'],
      ['collateral_analytics', 'Collateral Analytics'],
      ['collateral', 'Collateral Analytics'],
      ['cotality', 'Cotality / CoreLogic'],
      ['corelogic', 'Cotality / CoreLogic'],
      ['realtor', 'Realtor.com RealEstimate'],
      ['real_estimate', 'Realtor.com RealEstimate'],
    ];
    for (const [key, label] of named) {
      const v = payload[key] ?? payload[key + '_estimate'] ?? payload[`${key}_usd`];
      if (v == null) continue;
      if (typeof v === 'object') {
        providers.push({
          name: label,
          value: Math.round(Number(v.value ?? v.estimate ?? v.mid ?? v.amount)),
          low: v.low != null ? Math.round(Number(v.low)) : null,
          high: v.high != null ? Math.round(Number(v.high)) : null,
        });
      } else if (Number.isFinite(Number(v))) {
        providers.push({ name: label, value: Math.round(Number(v)), low: null, high: null });
      }
    }
  }
  for (const c of candidates) {
    const name = c.name || c.provider || c.source || 'AVM';
    const value = c.value ?? c.estimate ?? c.amount ?? c.mid;
    if (value == null || !Number.isFinite(Number(value))) continue;
    providers.push({
      name: String(name),
      value: Math.round(Number(value)),
      low: c.low != null ? Math.round(Number(c.low)) : null,
      high: c.high != null ? Math.round(Number(c.high)) : null,
    });
  }

  // high/low range on payload root
  const rangeLow = payload.low ?? payload.estimate_low ?? payload.min;
  const rangeHigh = payload.high ?? payload.estimate_high ?? payload.max;

  const vals = providers.map((p) => p.value).filter((n) => Number.isFinite(n));
  if (!vals.length && rangeLow == null && rangeHigh == null) return null;

  const mid = vals.length
    ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    : null;

  return {
    providers,
    mid,
    low: rangeLow != null ? Math.round(Number(rangeLow)) : (vals.length ? Math.min(...vals) : null),
    high: rangeHigh != null ? Math.round(Number(rangeHigh)) : (vals.length ? Math.max(...vals) : null),
    source: 'Realtor.com AVMs (via licensed API)',
    attribution: 'Independent automated valuation models. Not an appraisal.',
  };
}

/**
 * Full multi-source value payload for a home profile.
 * @param {object} profile - home_profiles row
 * @param {object} opts - { fetchAvm: boolean (default true), includeChart: boolean }
 */
export async function buildHomeValue(profile, opts = {}) {
  const pool = getPool();
  const fetchAvm = opts.fetchAvm !== false;
  const includeChart = opts.includeChart !== false;
  const creditStatus = await getCreditStatus(pool);

  // 1) Always compute our estimate (free)
  const our = await computeOurEstimate(profile, pool);

  const result = {
    our: {
      low: our.low,
      mid: our.mid,
      high: our.high,
      label: our.label,
      source: our.source,
      source_label: our.source_label,
      median_ppsqft: our.median_ppsqft,
      sample_size: our.sample_size,
      scope: our.scope,
    },
    market: null, // filled only with real AVM data
    chart: null,
    city_trends: null,
    compare_line: null,
    sources_available: ['saa_mls'],
    credit_status: {
      at_hard_stop: creditStatus.at_hard_stop,
      credits_used: creditStatus.credits_used,
      hard_stop: creditStatus.hard_stop,
    },
    reef_configured: reefConfigured(),
    disclaimer:
      'All figures are estimates, not appraisals. SAA Homes estimates use live MLS sales data. Market service figures come from licensed automated valuation APIs when available. For a definitive number, request a full market analysis from Adam & Mandi.',
  };

  // Build compare line from our data alone first
  if (our.mid != null) {
    result.compare_line = `Our data says ${fmt(our.low)}–${fmt(our.high)}`;
  }

  if (!fetchAvm || !reefConfigured() || creditStatus.at_hard_stop) {
    // Persist our estimate on profile
    await persistEstimates(profile.id, our, null, null, pool);
    return result;
  }

  // 2) Resolve zpid + pull chart + realtor estimates (budget-aware inside reefCall)
  let zpid = profile.zpid ? String(profile.zpid) : null;
  let creditsSpent = 0;

  if (!zpid) {
    const resolved = await resolveZpid(profile);
    zpid = resolved.zpid;
    creditsSpent += resolved.credits || 0;
    if (zpid && profile.id) {
      await pool.query('UPDATE home_profiles SET zpid = $1, updated_at = NOW() WHERE id = $2', [
        zpid,
        profile.id,
      ]);
    }
  }

  let chartNorm = null;
  let realtorNorm = null;

  if (zpid && includeChart) {
    const chartRes = await zillowHomeValueChart({ zpid, time_period: '10y' });
    creditsSpent += chartRes.credits || 0;
    if (chartRes.ok && chartRes.data) {
      chartNorm = normalizeChartSeries(chartRes.data);
      if (chartNorm) {
        chartNorm.cached = chartRes.cached;
        chartNorm.fetched_at = chartRes.fetched_at;
        result.chart = chartNorm;
        result.sources_available.push('zillow_chart');
      }
    }
  }

  // Realtor estimates by address (does not require zpid)
  const addr = [
    profile.address_line,
    profile.city,
    profile.state || 'CO',
    profile.postal_code,
  ].filter(Boolean).join(', ');

  if (addr) {
    // Realtor estimates endpoint — body shapes vary; try address field names
    const estRes = await realtorEstimates({
      address: addr,
      location: addr,
    });
    creditsSpent += estRes.credits || 0;
    if (estRes.ok && estRes.data) {
      realtorNorm = normalizeRealtorEstimates(estRes.data);
      if (realtorNorm && (realtorNorm.mid != null || realtorNorm.providers?.length)) {
        realtorNorm.cached = estRes.cached;
        realtorNorm.fetched_at = estRes.fetched_at;
        result.market = realtorNorm;
        result.sources_available.push('realtor_avm');
      }
    }
  }

  // Optional city trends (cheap context — only if city present and budget ok)
  if (profile.city && !creditStatus.at_hard_stop) {
    const loc = `${profile.city}, CO`;
    const trends = await zillowMarketTrends({ location: loc });
    creditsSpent += trends.credits || 0;
    if (trends.ok && trends.data) {
      const m = trends.data.market || trends.data;
      result.city_trends = {
        location: loc,
        zhvi: m.zhvi_usd ?? m.zhvi ?? null,
        median_sale: m.median_sale_price_usd ?? m.median_sale_price ?? null,
        median_list: m.median_list_price_usd ?? m.median_list_price ?? null,
        inventory: m.for_sale_inventory ?? m.inventory ?? null,
        days_to_pending: m.days_to_pending ?? null,
        source: 'Zillow market trends (via licensed API)',
        cached: trends.cached,
        attribution: 'City-level index — not a per-home appraisal.',
      };
      result.sources_available.push('zillow_trends');
    }
  }

  // Compare line: our + market
  if (our.mid != null && result.market?.mid != null) {
    result.compare_line = `Our data says ${fmt(our.mid)} · Market services say ${fmt(result.market.mid)}`;
  } else if (our.mid != null && chartNorm?.home?.latest_value) {
    result.compare_line = `Our data says ${fmt(our.mid)} · Market chart latest ${fmt(chartNorm.home.latest_value)}`;
    // If we have chart but no realtor mid, surface chart latest as market mid for UI
    if (!result.market) {
      result.market = {
        providers: [{ name: 'Zillow value history (latest)', value: chartNorm.home.latest_value, low: null, high: null }],
        mid: chartNorm.home.latest_value,
        low: null,
        high: null,
        source: 'Zillow (via licensed API)',
        attribution: 'Latest point on licensed value history. Not an appraisal.',
      };
      if (!result.sources_available.includes('zillow_chart')) {
        result.sources_available.push('zillow_chart');
      }
    }
  } else if (our.mid != null) {
    result.compare_line = `Our data says ${fmt(our.low)}–${fmt(our.high)}`;
  }

  result.credits_spent_this_request = creditsSpent;
  result.credit_status = await getCreditStatus(pool);

  await persistEstimates(profile.id, our, result.market, chartNorm, pool);
  return result;
}

function fmt(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

async function persistEstimates(profileId, our, market, chart, pool) {
  if (!profileId) return;
  try {
    await pool.query(
      `UPDATE home_profiles SET
         our_estimate_low = $1,
         our_estimate_mid = $2,
         our_estimate_high = $3,
         our_estimate_label = $4,
         our_estimate_at = NOW(),
         market_estimate_mid = $5,
         market_estimates = $6::jsonb,
         chart_series = $7::jsonb,
         updated_at = NOW()
       WHERE id = $8`,
      [
        our?.low ?? null,
        our?.mid ?? null,
        our?.high ?? null,
        our?.label ?? null,
        market?.mid ?? null,
        JSON.stringify(market || {}),
        chart ? JSON.stringify(chart) : null,
        profileId,
      ]
    );
  } catch (e) {
    logger.warn('persistEstimates failed', { message: e.message });
  }
}

/**
 * Create or update a home profile for a user.
 */
export async function upsertHomeProfile(userId, body, pool = getPool()) {
  const address_line = cleanStr(body.address_line || body.address || body.street, 255);
  if (!address_line) {
    throw Object.assign(new Error('Street address is required.'), { status: 400 });
  }
  const city = cleanStr(body.city, 100);
  const state = cleanStr(body.state, 2) || 'CO';
  const postal_code = cleanStr(body.postal_code || body.zip || body.zipCode, 16);
  const unit = cleanStr(body.unit, 32);
  const living_area = body.living_area != null || body.sqft != null
    ? Number(body.living_area ?? body.sqft)
    : null;
  const beds = body.beds != null ? Number(body.beds) : null;
  const baths = body.baths != null ? Number(body.baths) : null;
  const year_built = body.year_built != null ? Number(body.year_built) : null;
  const zpid = cleanStr(body.zpid, 32);

  // If id provided, update that profile (must belong to user)
  if (body.id) {
    const existing = await pool.query(
      'SELECT * FROM home_profiles WHERE id = $1 AND user_id = $2',
      [Number(body.id), userId]
    );
    if (!existing.rows[0]) {
      throw Object.assign(new Error('Home profile not found.'), { status: 404 });
    }
    const r = await pool.query(
      `UPDATE home_profiles SET
         address_line = $1, unit = $2, city = $3, state = $4, postal_code = $5,
         living_area = COALESCE($6, living_area),
         beds = COALESCE($7, beds),
         baths = COALESCE($8, baths),
         year_built = COALESCE($9, year_built),
         zpid = COALESCE($10, zpid),
         updated_at = NOW()
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [
        address_line, unit, city, state, postal_code,
        living_area && Number.isFinite(living_area) ? living_area : null,
        beds && Number.isFinite(beds) ? beds : null,
        baths && Number.isFinite(baths) ? baths : null,
        year_built && Number.isFinite(year_built) ? year_built : null,
        zpid,
        Number(body.id),
        userId,
      ]
    );
    return r.rows[0];
  }

  // Match existing by address+user
  const match = await pool.query(
    `SELECT * FROM home_profiles
     WHERE user_id = $1 AND LOWER(address_line) = LOWER($2)
       AND COALESCE(postal_code,'') = COALESCE($3,'')
     ORDER BY id DESC LIMIT 1`,
    [userId, address_line, postal_code || '']
  );
  if (match.rows[0]) {
    const id = match.rows[0].id;
    const r = await pool.query(
      `UPDATE home_profiles SET
         city = COALESCE($1, city), state = COALESCE($2, state),
         unit = COALESCE($3, unit),
         living_area = COALESCE($4, living_area),
         beds = COALESCE($5, beds), baths = COALESCE($6, baths),
         year_built = COALESCE($7, year_built),
         zpid = COALESCE($8, zpid),
         value_updates_enabled = TRUE,
         updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [
        city, state, unit,
        living_area && Number.isFinite(living_area) ? living_area : null,
        beds && Number.isFinite(beds) ? beds : null,
        baths && Number.isFinite(baths) ? baths : null,
        year_built && Number.isFinite(year_built) ? year_built : null,
        zpid,
        id,
      ]
    );
    return r.rows[0];
  }

  const inserted = await pool.query(
    `INSERT INTO home_profiles
       (user_id, address_line, unit, city, state, postal_code, living_area, beds, baths, year_built, zpid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      userId,
      address_line,
      unit,
      city,
      state,
      postal_code,
      living_area && Number.isFinite(living_area) ? living_area : null,
      beds && Number.isFinite(beds) ? beds : null,
      baths && Number.isFinite(baths) ? baths : null,
      year_built && Number.isFinite(year_built) ? year_built : null,
      zpid,
    ]
  );
  return inserted.rows[0];
}

/**
 * Record a value view + seller heat when 2+ views or market-analysis signal.
 */
export async function recordValueView(profileId, userId, pool = getPool()) {
  const r = await pool.query(
    `UPDATE home_profiles SET
       value_view_count = value_view_count + 1,
       last_value_view_at = NOW(),
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [profileId, userId]
  );
  const profile = r.rows[0];
  if (!profile) return null;

  // SELLER HEAT: 2+ value views
  if (profile.value_view_count >= 2 && !profile.seller_heat) {
    await pool.query(
      `UPDATE home_profiles SET seller_heat = TRUE WHERE id = $1`,
      [profileId]
    );
    await pool.query(
      `UPDATE users SET seller_heat = TRUE, seller_heat_at = NOW() WHERE id = $1`,
      [userId]
    );
    profile.seller_heat = true;
    try {
      await pool.query(
        `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'seller_heat', $2::jsonb)`,
        [userId, JSON.stringify({ profile_id: profileId, reason: 'value_view_2x' })]
      );
    } catch { /* table may lack event — non-blocking */ }
  }
  return profile;
}

export async function setAccuracySignal(profileId, userId, signal, pool = getPool()) {
  const s = signal === 'close' || signal === 'yes' ? 'close'
    : signal === 'off' || signal === 'no' ? 'off'
      : null;
  if (!s) throw Object.assign(new Error('Signal must be close or off.'), { status: 400 });
  const r = await pool.query(
    `UPDATE home_profiles SET accuracy_signal = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [s, profileId, userId]
  );
  try {
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'value_accuracy', $2::jsonb)`,
      [userId, JSON.stringify({ profile_id: profileId, signal: s })]
    );
  } catch { /* non-blocking */ }
  return r.rows[0] || null;
}

export async function flagSellerHeat(userId, reason, meta = {}, pool = getPool()) {
  await pool.query(
    `UPDATE users SET seller_heat = TRUE, seller_heat_at = NOW() WHERE id = $1`,
    [userId]
  );
  try {
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'seller_heat', $2::jsonb)`,
      [userId, JSON.stringify({ reason, ...meta })]
    );
  } catch { /* non-blocking */ }
}

export { cleanStr };
