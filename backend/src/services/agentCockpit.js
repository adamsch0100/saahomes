/**
 * Agent cockpit helpers — heat, lifecycle stage, next-touch.
 * All values derived from real stored events only — never fabricated.
 *
 * Heat 🔥 = 2+ high-intent events in last 7 days:
 *   - value view (home_profiles last_value_view_at / value_view_count, user_events)
 *   - saved search created
 *   - showing request
 *   - market analysis / seller heat
 *
 * Lifecycle (auto, unless lifecycle_stage_manual):
 *   new → nurturing → showing → active → closed | lost
 *
 * Next-touch cadence (auto when next_touch_at is null):
 *   new: same day · showing: +1d · active: +3d · nurturing: +7d · closed/lost: none
 */
import getPool from '../config/database.js';

export const LIFECYCLE_STAGES = ['new', 'nurturing', 'showing', 'active', 'closed', 'lost'];

const HIGH_INTENT_EVENT_TYPES = [
  'seller_heat',
  'value_accuracy',
  'market_analysis',
  'value_view',
  'listing_view_2x',
];

/**
 * Count high-intent events in the last 7 days for a user.
 * Returns { count, isHot, signals[] } from real DB rows only.
 */
export async function computeHeat(userId, email, pool = getPool()) {
  const emailStr = String(email || '').trim().toLowerCase();
  const signals = [];
  let count = 0;

  const safe = async (sql, params) => {
    try {
      return await pool.query(sql, params);
    } catch {
      return { rows: [], rowCount: 0 };
    }
  };

  // Saved searches created in last 7d
  const searches = await safe(
    `SELECT id, name, created_at FROM saved_searches
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC`,
    [userId]
  );
  for (const row of searches.rows) {
    signals.push({ type: 'saved_search', at: row.created_at, detail: row.name });
    count += 1;
  }

  // Showing requests (by email) in last 7d
  if (emailStr) {
    const showings = await safe(
      `SELECT id, listing_address, created_at FROM showing_requests
       WHERE LOWER(email) = $1 AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC`,
      [emailStr]
    );
    for (const row of showings.rows) {
      signals.push({ type: 'showing_request', at: row.created_at, detail: row.listing_address });
      count += 1;
    }
  }

  // Market report / analysis requests in last 7d
  if (emailStr) {
    const reports = await safe(
      `SELECT id, area, created_at FROM market_report_submissions
       WHERE LOWER(email) = $1 AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC`,
      [emailStr]
    );
    for (const row of reports.rows) {
      signals.push({ type: 'market_analysis', at: row.created_at, detail: row.area });
      count += 1;
    }
  }

  // Value views: home profile views in last 7d (each profile with a recent view counts)
  const valueViews = await safe(
    `SELECT id, address_line, last_value_view_at, value_view_count
     FROM home_profiles
     WHERE user_id = $1
       AND last_value_view_at > NOW() - INTERVAL '7 days'
       AND value_view_count >= 1`,
    [userId]
  );
  for (const row of valueViews.rows) {
    // Count min(value_view_count, 3) so 2+ views contribute heat without runaway
    const n = Math.min(Number(row.value_view_count) || 1, 3);
    for (let i = 0; i < n; i++) {
      signals.push({
        type: 'value_view',
        at: row.last_value_view_at,
        detail: row.address_line,
      });
      count += 1;
    }
  }

  // Named high-intent user_events in last 7d
  const events = await safe(
    `SELECT event_type, created_at, meta FROM user_events
     WHERE user_id = $1
       AND event_type = ANY($2::text[])
       AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC`,
    [userId, HIGH_INTENT_EVENT_TYPES]
  );
  for (const row of events.rows) {
    // Avoid double-counting seller_heat when we already counted value views for same window
    if (row.event_type === 'seller_heat' && valueViews.rows.length) continue;
    signals.push({ type: row.event_type, at: row.created_at, detail: null });
    count += 1;
  }

  // Listing viewed 2x+ in last 7d (distinct listings with 2+ view sessions)
  const multiViews = await safe(
    `SELECT listing_id, COUNT(*)::int AS n, MAX(viewed_at) AS last_at
     FROM property_views
     WHERE user_id = $1 AND viewed_at > NOW() - INTERVAL '7 days'
     GROUP BY listing_id
     HAVING COUNT(*) >= 2`,
    [userId]
  );
  for (const row of multiViews.rows) {
    signals.push({ type: 'listing_view_2x', at: row.last_at, detail: row.listing_id });
    count += 1;
  }

  return {
    heat_count: count,
    is_hot: count >= 2,
    signals: signals.slice(0, 20),
  };
}

/**
 * Derive lifecycle stage from real signals.
 * Manual stages (lifecycle_stage_manual) are left alone by the caller.
 */
export function deriveLifecycleStage({ hasShowing, hasSearch, hasContact, hasViews, hasSellerHeat, score, lastActiveAt, createdAt }) {
  const daysSinceActive = lastActiveAt
    ? (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
    : createdAt
      ? (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

  // Stale + never engaged hard → still "new" if brand new, else stay nurturing floor
  if (hasShowing && (score >= 40 || daysSinceActive <= 14)) {
    // Showing scheduled + recent engagement → active buyer
    if (score >= 50 || hasSellerHeat) return 'active';
    return 'showing';
  }
  if (hasShowing) return 'showing';
  if (hasSearch || hasContact || hasViews || hasSellerHeat || (score && score >= 15)) {
    return 'nurturing';
  }
  return 'new';
}

/**
 * Default next-touch date from stage + last activity.
 * Returns Date or null (closed/lost have no auto touch).
 */
export function deriveNextTouchAt(stage, { lastTouchedAt, createdAt, lastActiveAt } = {}) {
  if (stage === 'closed' || stage === 'lost') return null;

  const base = lastTouchedAt
    ? new Date(lastTouchedAt)
    : lastActiveAt
      ? new Date(lastActiveAt)
      : createdAt
        ? new Date(createdAt)
        : new Date();

  const days = {
    new: 0,       // due today
    showing: 1,   // call within a day
    active: 3,
    nurturing: 7,
  }[stage] ?? 7;

  const due = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  // If computed due is in the past, it's overdue → due today (start of day + a bit)
  const now = new Date();
  if (due < now) {
    // Overdue: due today
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  }
  return due;
}

/**
 * Enrich a user row with heat, lifecycle, next-touch for the cockpit.
 * Optionally persists auto-derived stage/next_touch when not manual.
 */
export async function enrichLeadForCockpit(user, { persist = false } = {}, pool = getPool()) {
  const heat = await computeHeat(user.id, user.email, pool);
  const email = String(user.email || '').toLowerCase();

  const safeCount = async (sql, params) => {
    try {
      const r = await pool.query(sql, params);
      return Number(r.rows[0]?.n || 0);
    } catch {
      return 0;
    }
  };

  const hasShowing = email
    ? (await safeCount('SELECT COUNT(*)::int AS n FROM showing_requests WHERE LOWER(email) = $1', [email])) > 0
    : false;
  const hasSearch = (await safeCount('SELECT COUNT(*)::int AS n FROM saved_searches WHERE user_id = $1', [user.id])) > 0;
  const hasContact = email
    ? (await safeCount('SELECT COUNT(*)::int AS n FROM contact_submissions WHERE LOWER(email) = $1', [email])) > 0
    : false;
  const hasViews = (await safeCount('SELECT COUNT(*)::int AS n FROM property_views WHERE user_id = $1', [user.id])) > 0;
  const hasSellerHeat = !!(user.seller_heat);

  const autoStage = deriveLifecycleStage({
    hasShowing,
    hasSearch,
    hasContact,
    hasViews,
    hasSellerHeat,
    score: user.lead_score || 0,
    lastActiveAt: user.last_active_at,
    createdAt: user.created_at,
  });

  const stage = user.lifecycle_stage_manual && user.lifecycle_stage
    ? user.lifecycle_stage
    : autoStage;

  // Prefer stored next_touch_at; otherwise derive
  let nextTouch = user.next_touch_at ? new Date(user.next_touch_at) : null;
  if (!nextTouch) {
    nextTouch = deriveNextTouchAt(stage, {
      lastTouchedAt: user.last_touched_at,
      createdAt: user.created_at,
      lastActiveAt: user.last_active_at,
    });
  }

  if (persist) {
    try {
      if (!user.lifecycle_stage_manual && stage !== user.lifecycle_stage) {
        await pool.query(
          `UPDATE users SET lifecycle_stage = $1 WHERE id = $2`,
          [stage, user.id]
        );
      }
      if (!user.next_touch_at && nextTouch) {
        await pool.query(
          `UPDATE users SET next_touch_at = $1 WHERE id = $2 AND next_touch_at IS NULL`,
          [nextTouch, user.id]
        );
      }
    } catch {
      // non-blocking mid-deploy
    }
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const isDueToday = nextTouch
    ? nextTouch <= endOfToday && stage !== 'closed' && stage !== 'lost'
    : false;
  const isOverdue = nextTouch
    ? nextTouch < startOfToday && stage !== 'closed' && stage !== 'lost'
    : false;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    intent: user.intent || null,
    status: user.status,
    lead_score: user.lead_score ?? 0,
    lead_score_updated_at: user.lead_score_updated_at || null,
    is_hot: heat.is_hot,
    heat_count: heat.heat_count,
    heat_signals: heat.signals,
    seller_heat: !!user.seller_heat,
    lifecycle_stage: stage,
    lifecycle_stage_manual: !!user.lifecycle_stage_manual,
    next_touch_at: nextTouch ? nextTouch.toISOString() : null,
    last_touched_at: user.last_touched_at || null,
    last_active_at: user.last_active_at || null,
    created_at: user.created_at,
    fub_person_id: user.fub_person_id || null,
    is_due_today: isDueToday,
    is_overdue: isOverdue,
    search_count: hasSearch ? undefined : 0, // filled by list query when available
  };
}

/**
 * After a meaningful signal, recompute stage + bump next_touch if needed.
 * Call fire-and-forget from controllers.
 */
export async function refreshLeadLifecycle(userId, pool = getPool()) {
  try {
    const r = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!r.rows[0]) return null;
    return enrichLeadForCockpit(r.rows[0], { persist: true }, pool);
  } catch (err) {
    console.error('refreshLeadLifecycle error:', err.message);
    return null;
  }
}

/**
 * Resolve user id by email for lifecycle refresh from form leads.
 */
export async function refreshLeadLifecycleByEmail(email, pool = getPool()) {
  const emailStr = String(email || '').trim().toLowerCase();
  if (!emailStr.includes('@')) return null;
  try {
    const r = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [emailStr]);
    if (!r.rows[0]) return null;
    return refreshLeadLifecycle(r.rows[0].id, pool);
  } catch {
    return null;
  }
}
