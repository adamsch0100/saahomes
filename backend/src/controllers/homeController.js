/**
 * Seller home-profile + multi-source value API (Phase A / It 11).
 *
 *   GET    /api/home                 — session → list home profiles (cached estimates)
 *   POST   /api/home/profile         — create/update home profile
 *   GET    /api/home/:id/value       — multi-source value + chart (records view)
 *   POST   /api/home/:id/accuracy    — { signal: 'close'|'off' } one-two ask
 *   PATCH  /api/home/:id             — update profile fields / value_updates_enabled
 *   POST   /api/home/:id/heat        — flag SELLER HEAT (market-analysis request)
 *   POST   /api/home/estimate        — guest/public our-comps estimate (no AVM burn)
 */
import getPool from '../config/database.js';
import { setAuthCookie } from './alertController.js';
import {
  upsertHomeProfile,
  buildHomeValue,
  computeOurEstimate,
  recordValueView,
  setAccuracySignal,
  flagSellerHeat,
  cleanStr,
} from '../services/sellerValueService.js';
import { getCreditStatus, reefConfigured } from '../services/reefApiService.js';
import logger from '../utils/logger.js';

const COOKIE_NAME = 'saa_user_token';

async function findUserByToken(token) {
  if (!token || token.length < 16 || token.length > 80) return null;
  const r = await getPool().query(
    "SELECT * FROM users WHERE manage_token = $1 AND status = 'active'",
    [String(token)]
  );
  return r.rows[0] || null;
}

async function resolveUser(req) {
  const qToken = req.query?.token;
  if (qToken) {
    const u = await findUserByToken(qToken);
    if (u) return u;
  }
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return findUserByToken(cookieToken);
  const bodyToken = req.body?.token;
  if (bodyToken) return findUserByToken(bodyToken);
  return null;
}

function publicProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    address_line: row.address_line,
    unit: row.unit,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    beds: row.beds != null ? Number(row.beds) : null,
    baths: row.baths != null ? Number(row.baths) : null,
    living_area: row.living_area != null ? Number(row.living_area) : null,
    year_built: row.year_built,
    our_estimate_low: row.our_estimate_low,
    our_estimate_mid: row.our_estimate_mid,
    our_estimate_high: row.our_estimate_high,
    our_estimate_label: row.our_estimate_label,
    our_estimate_at: row.our_estimate_at,
    market_estimate_mid: row.market_estimate_mid,
    market_estimates: row.market_estimates,
    chart_series: row.chart_series,
    accuracy_signal: row.accuracy_signal,
    value_updates_enabled: row.value_updates_enabled,
    value_view_count: row.value_view_count,
    last_value_view_at: row.last_value_view_at,
    seller_heat: row.seller_heat,
    last_digest_at: row.last_digest_at,
    last_digest_value: row.last_digest_value,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** GET /api/home — list profiles for signed-in user */
export const listHomes = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });
    if (req.query.token) setAuthCookie(res, user.manage_token);

    const pool = getPool();
    const r = await pool.query(
      `SELECT * FROM home_profiles WHERE user_id = $1 ORDER BY updated_at DESC, id DESC`,
      [user.id]
    );
    const creditStatus = await getCreditStatus(pool);

    return res.json({
      success: true,
      data: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        intent: user.intent || null,
        seller_heat: !!user.seller_heat,
        homes: r.rows.map(publicProfile),
        reef_configured: reefConfigured(),
        credit_status: {
          at_hard_stop: creditStatus.at_hard_stop,
          credits_used: creditStatus.credits_used,
          hard_stop: creditStatus.hard_stop,
        },
      },
    });
  } catch (error) {
    logger.error('listHomes error', error);
    return res.status(500).json({ success: false, error: 'Could not load your home profiles.' });
  }
};

/** POST /api/home/profile — create or update */
export const saveHomeProfile = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in. Save a search or request a market report first.' });

    const profile = await upsertHomeProfile(user.id, req.body || {});

    // Mark seller intent if not set
    if (!user.intent || user.intent === 'buying') {
      const next = user.intent === 'buying' ? 'both' : 'selling';
      await getPool().query(
        `UPDATE users SET intent = COALESCE(intent, $1), last_active_at = NOW() WHERE id = $2`,
        [next, user.id]
      );
    }

    // Compute our estimate immediately (free); AVM on demand via /value
    let value = null;
    try {
      value = await buildHomeValue(profile, {
        fetchAvm: req.body?.fetchAvm === true || req.body?.fetch_avm === true,
        includeChart: req.body?.includeChart !== false,
      });
    } catch (e) {
      logger.warn('buildHomeValue on save failed', { message: e.message });
      const our = await computeOurEstimate(profile);
      value = { our, market: null, chart: null, compare_line: null };
    }

    // Refresh profile row after persist
    const refreshed = await getPool().query('SELECT * FROM home_profiles WHERE id = $1', [profile.id]);

    return res.status(201).json({
      success: true,
      data: {
        profile: publicProfile(refreshed.rows[0] || profile),
        value,
      },
    });
  } catch (error) {
    const status = error.status || 500;
    if (status < 500) {
      return res.status(status).json({ success: false, error: error.message });
    }
    logger.error('saveHomeProfile error', error);
    return res.status(500).json({ success: false, error: 'Could not save your home profile.' });
  }
};

/** GET /api/home/:id/value — multi-source value; records view + seller heat */
export const getHomeValue = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });
    if (req.query.token) setAuthCookie(res, user.manage_token);

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'Invalid home profile id.' });
    }

    const pool = getPool();
    const r = await pool.query(
      'SELECT * FROM home_profiles WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Home profile not found.' });
    }

    // Record value view → SELLER HEAT at 2x
    const updated = await recordValueView(id, user.id, pool);

    const fetchAvm = req.query.avm !== '0' && req.query.avm !== 'false';
    const includeChart = req.query.chart !== '0' && req.query.chart !== 'false';
    const value = await buildHomeValue(updated || r.rows[0], { fetchAvm, includeChart });

    const refreshed = await pool.query('SELECT * FROM home_profiles WHERE id = $1', [id]);

    return res.json({
      success: true,
      data: {
        profile: publicProfile(refreshed.rows[0]),
        value,
      },
    });
  } catch (error) {
    logger.error('getHomeValue error', error);
    return res.status(500).json({ success: false, error: 'Could not load home value.' });
  }
};

/** POST /api/home/:id/accuracy — one-two ask signal */
export const postAccuracy = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });

    const id = Number(req.params.id);
    const signal = req.body?.signal || req.body?.accuracy;
    const profile = await setAccuracySignal(id, user.id, signal);
    if (!profile) return res.status(404).json({ success: false, error: 'Home profile not found.' });

    // Personalized next CTA is client-side; optionally heat on "off" + analysis path later
    return res.json({
      success: true,
      data: {
        profile: publicProfile(profile),
        next_cta:
          profile.accuracy_signal === 'off'
            ? {
                primary: "Let's get the real number — free market analysis",
                href: '/for-sellers/#market-report',
                action: 'market_analysis',
              }
            : {
                primary: "Want to see what you'd actually net? Try the seller calculator",
                href: '/mortgage-calculator/',
                action: 'seller_calculator',
              },
      },
    });
  } catch (error) {
    const status = error.status || 500;
    if (status < 500) {
      return res.status(status).json({ success: false, error: error.message });
    }
    logger.error('postAccuracy error', error);
    return res.status(500).json({ success: false, error: 'Could not save your feedback.' });
  }
};

/** PATCH /api/home/:id — update fields or value_updates_enabled */
export const patchHome = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'Invalid home profile id.' });
    }

    const pool = getPool();
    const existing = await pool.query(
      'SELECT * FROM home_profiles WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ success: false, error: 'Home profile not found.' });
    }

    const body = req.body || {};
    // If address fields present, use upsert path
    if (body.address_line || body.address || body.street || body.living_area != null || body.sqft != null
      || body.city || body.postal_code || body.zip || body.beds != null || body.baths != null) {
      const profile = await upsertHomeProfile(user.id, { ...body, id });
      return res.json({ success: true, data: { profile: publicProfile(profile) } });
    }

    const sets = [];
    const params = [];
    let i = 1;
    if (body.value_updates_enabled != null) {
      sets.push(`value_updates_enabled = $${i++}`);
      params.push(!!body.value_updates_enabled);
    }
    if (!sets.length) {
      return res.status(400).json({ success: false, error: 'Nothing to update.' });
    }
    sets.push('updated_at = NOW()');
    params.push(id, user.id);
    const r = await pool.query(
      `UPDATE home_profiles SET ${sets.join(', ')}
       WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
      params
    );
    return res.json({ success: true, data: { profile: publicProfile(r.rows[0]) } });
  } catch (error) {
    const status = error.status || 500;
    if (status < 500) {
      return res.status(status).json({ success: false, error: error.message });
    }
    logger.error('patchHome error', error);
    return res.status(500).json({ success: false, error: 'Could not update home profile.' });
  }
};

/**
 * POST /api/home/:id/heat — market-analysis / high-intent signal → SELLER HEAT
 * (FUB write-back is It 12 — we only set the field here.)
 */
export const postSellerHeat = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });

    const id = Number(req.params.id);
    const pool = getPool();
    const r = await pool.query(
      'SELECT id FROM home_profiles WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Home profile not found.' });
    }

    await pool.query(
      `UPDATE home_profiles SET seller_heat = TRUE, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await flagSellerHeat(user.id, req.body?.reason || 'market_analysis_request', {
      profile_id: id,
    }, pool);

    return res.json({ success: true, data: { seller_heat: true } });
  } catch (error) {
    logger.error('postSellerHeat error', error);
    return res.status(500).json({ success: false, error: 'Could not record signal.' });
  }
};

/**
 * POST /api/home/estimate — public our-comps estimate (never burns ReefAPI credits).
 * Used before account creation or for quick address checks.
 */
export const publicEstimate = async (req, res) => {
  try {
    const body = req.body || {};
    const address_line = cleanStr(body.address_line || body.address || body.street, 255);
    const city = cleanStr(body.city, 100);
    const postal_code = cleanStr(body.postal_code || body.zip || body.zipCode, 16);
    const living_area = body.living_area != null || body.sqft != null
      ? Number(body.living_area ?? body.sqft)
      : null;

    if (!postal_code && !city) {
      return res.status(400).json({
        success: false,
        error: 'City or ZIP is required for an estimate.',
      });
    }

    const our = await computeOurEstimate({
      address_line,
      city,
      postal_code,
      living_area: living_area && Number.isFinite(living_area) ? living_area : null,
    });

    return res.json({
      success: true,
      data: {
        our,
        market: null,
        compare_line: our.mid != null
          ? `Our data says $${Number(our.low).toLocaleString()}–$${Number(our.high).toLocaleString()}`
          : null,
        disclaimer:
          'Estimated range based on live MLS sales data. Not an appraisal. Market service AVMs available after you save your home on My Home.',
      },
    });
  } catch (error) {
    logger.error('publicEstimate error', error);
    return res.status(500).json({ success: false, error: 'Could not compute estimate.' });
  }
};
