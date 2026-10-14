/**
 * Owner-to-seller signals: is a homeowner starting to think about selling?
 *
 * A score from 0 to 100 built only from things the owner actually did (or
 * plain facts about their ownership), each with a plain reason the agent can
 * read:
 *   - checked their home value several times lately
 *   - built their own value from recent sales (comps)
 *   - opened their home anniversary report
 *   - asked Nadia about selling
 *   - asked what their home would sell for (market analysis)
 *   - saved homes elsewhere while owning one
 *   - has owned their home for the years when people typically move up
 *
 * Scores are kept in seller_intent, shown in the agent's morning brief, and
 * sent to Follow Up Boss (as a seller event and a note) when they first reach
 * "likely", or rise a lot, using the existing Follow Up Boss functions.
 */
import getPool from '../config/database.js';
import { denverToday } from '../controllers/tourController.js';

export const LIKELY = 60;
export const MAYBE = 35;
const FUB_RISE = 15;
const FUB_REPUSH_DAYS = 30;
const MOVE_UP_YEARS = [5, 12];

/**
 * Pure: score and reasons from counts.
 * facts: { valueViews, compsBuilt, anniversaryOpens, nadiaSelling, marketAnalysis,
 *          savedElsewhere, ownsHome, yearsOwned }
 */
export function scoreSellerIntent(f) {
  const reasons = [];
  let score = 0;
  const add = (pts, reason) => {
    score += pts;
    reasons.push(reason);
  };
  if (f.nadiaSelling > 0) add(25, 'Asked Nadia about selling');
  if (f.valueViews >= 3) add(20, `Checked their home value ${f.valueViews} times this month`);
  else if (f.valueViews > 0) add(8, 'Checked their home value');
  if (f.compsBuilt > 0) add(20, 'Built their own home value from recent sales');
  if (f.marketAnalysis > 0) add(15, 'Asked what their home would sell for');
  if (f.anniversaryOpens >= 2) add(15, 'Opened their home anniversary report more than once');
  else if (f.anniversaryOpens > 0) add(10, 'Opened their home anniversary report');
  if (f.ownsHome && f.savedElsewhere >= 3) add(20, `Saved ${f.savedElsewhere} homes while owning one`);
  else if (f.ownsHome && f.savedElsewhere > 0) add(10, `Saved ${f.savedElsewhere === 1 ? 'a home' : `${f.savedElsewhere} homes`} while owning one`);
  if (f.ownsHome && f.yearsOwned >= MOVE_UP_YEARS[0] && f.yearsOwned <= MOVE_UP_YEARS[1]) {
    add(15, `Owned their home ${f.yearsOwned} years, when many people move up`);
  }
  return { score: Math.min(100, score), reasons };
}

export const levelOf = (score) => (score >= LIKELY ? 'likely' : score >= MAYBE ? 'maybe' : 'low');

/** Gather the facts for one client from stored activity. */
export async function sellerFacts(pool, user, now = new Date()) {
  const n = async (sql, params) => {
    try {
      const { rows } = await pool.query(sql, params);
      return Number(rows[0]?.n || 0);
    } catch {
      return 0;
    }
  };
  const id = user.id;
  const valueEvents = await n(
    "SELECT COUNT(*)::int AS n FROM events WHERE user_id = $1 AND type = 'home_value_view' AND occurred_at > $2::timestamptz - INTERVAL '30 days'",
    [id, now]
  );
  const profileViews = await n(
    "SELECT COALESCE(MAX(value_view_count), 0)::int AS n FROM home_profiles WHERE user_id = $1 AND last_value_view_at > $2::timestamptz - INTERVAL '30 days'",
    [id, now]
  );
  const { rows: [closing] } = await pool.query(
    'SELECT side, close_date FROM client_closings WHERE user_id = $1', [id]
  ).catch(() => ({ rows: [] }));
  const homes = await n('SELECT COUNT(*)::int AS n FROM home_profiles WHERE user_id = $1', [id]);
  const ownsHome = (closing && closing.side !== 'seller') || homes > 0;
  let yearsOwned = 0;
  if (closing && closing.side !== 'seller') {
    const { yearsOwned: yo } = await import('./stayInTouch.js');
    yearsOwned = yo(closing.close_date, denverToday(now));
  }
  return {
    valueViews: Math.max(valueEvents, profileViews),
    compsBuilt: await n(
      "SELECT COUNT(*)::int AS n FROM events WHERE user_id = $1 AND type = 'comps_adjusted' AND occurred_at > $2::timestamptz - INTERVAL '60 days'",
      [id, now]
    ),
    anniversaryOpens: await n(
      "SELECT COALESCE(SUM(open_count), 0)::int AS n FROM email_log WHERE user_id = $1 AND type = 'stay_anniversary' AND last_open_at > $2::timestamp - INTERVAL '60 days'",
      [id, now]
    ),
    nadiaSelling: await n(
      "SELECT COUNT(*)::int AS n FROM events WHERE user_id = $1 AND type = 'seller_question' AND occurred_at > $2::timestamptz - INTERVAL '60 days'",
      [id, now]
    ),
    marketAnalysis: user.seller_heat_at && now - new Date(user.seller_heat_at) < 60 * 86400000 ? 1 : 0,
    savedElsewhere: ownsHome ? await n(
      "SELECT COUNT(DISTINCT listing_id)::int AS n FROM events WHERE user_id = $1 AND type = 'home_saved' AND occurred_at > $2::timestamptz - INTERVAL '30 days'",
      [id, now]
    ) : 0,
    ownsHome,
    yearsOwned,
  };
}

/** Default Follow Up Boss writer: the existing seller event and note functions. */
async function defaultFubPush(user, intent) {
  const fub = await import('./followUpBossService.js');
  const message = [`Seller intent ${intent.score}/100`, ...intent.reasons].join('\n');
  await fub.pushNurtureSignalToFollowUpBoss({
    signal: 'seller_heat',
    tenantId: user.tenant_id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    message,
  });
  await fub.addFollowUpBossNote(user.id, { subject: 'Might be thinking of selling', body: message });
}

/**
 * Recompute and store one client's score; tell Follow Up Boss when it first
 * reaches "likely" or rises a lot. Returns { score, reasons, level, pushed }.
 */
export async function refreshSellerIntent(userId, { pool = getPool(), now = new Date(), fubPush = defaultFubPush } = {}) {
  const { rows: [user] } = await pool.query(
    "SELECT id, tenant_id, email, name, phone, seller_heat_at FROM users WHERE id = $1 AND COALESCE(role, 'client') = 'client'",
    [userId]
  );
  if (!user) return null;
  const intent = scoreSellerIntent(await sellerFacts(pool, user, now));
  const { rows: [prev] } = await pool.query('SELECT fub_pushed_at, fub_pushed_score FROM seller_intent WHERE user_id = $1', [user.id]);
  let pushed = false;
  const stale = !prev?.fub_pushed_at || now - new Date(prev.fub_pushed_at) > FUB_REPUSH_DAYS * 86400000;
  if (intent.score >= LIKELY && (!prev?.fub_pushed_at || (intent.score >= (prev.fub_pushed_score || 0) + FUB_RISE) || (stale && intent.score > (prev.fub_pushed_score || 0)))) {
    try {
      await fubPush(user, intent);
      pushed = true;
    } catch (e) {
      console.warn('[seller-intent] FUB push failed:', e.message);
    }
  }
  await pool.query(
    `INSERT INTO seller_intent (tenant_id, user_id, score, reasons, computed_at, fub_pushed_at, fub_pushed_score)
     VALUES ($1, $2, $3::int, $4::jsonb, $5::timestamptz, CASE WHEN $6::boolean THEN $5::timestamptz END, CASE WHEN $6::boolean THEN $3::int END)
     ON CONFLICT (user_id) DO UPDATE SET score = EXCLUDED.score, reasons = EXCLUDED.reasons, computed_at = EXCLUDED.computed_at,
       fub_pushed_at = COALESCE(EXCLUDED.fub_pushed_at, seller_intent.fub_pushed_at),
       fub_pushed_score = COALESCE(EXCLUDED.fub_pushed_score, seller_intent.fub_pushed_score)`,
    [user.tenant_id, user.id, intent.score, JSON.stringify(intent.reasons), now, pushed]
  );
  return { ...intent, level: levelOf(intent.score), pushed };
}

/**
 * Daily: every owner we know about (a home on My Home or a buyer closing),
 * excluding clients already working on a sale with us.
 */
export async function refreshAllSellerIntent({ pool = getPool(), now = new Date(), fubPush } = {}) {
  const { rows } = await pool.query(
    `SELECT u.id FROM users u
     WHERE COALESCE(u.role, 'client') = 'client' AND u.status = 'active'
       AND (EXISTS (SELECT 1 FROM home_profiles hp WHERE hp.user_id = u.id)
            OR EXISTS (SELECT 1 FROM client_closings c WHERE c.user_id = u.id AND c.side = 'buyer'))
       AND NOT EXISTS (SELECT 1 FROM seller_plans sp WHERE sp.user_id = u.id AND sp.status <> 'withdrawn')
     ORDER BY u.id LIMIT 5000`
  );
  let likely = 0;
  let pushed = 0;
  for (const r of rows) {
    const res = await refreshSellerIntent(r.id, { pool, now, ...(fubPush ? { fubPush } : {}) }).catch(() => null);
    if (res?.level === 'likely') likely += 1;
    if (res?.pushed) pushed += 1;
  }
  return { scored: rows.length, likely, pushed };
}

/**
 * For the morning brief: owners this agent works with (admins also see the
 * unassigned) who may be thinking of selling, best first.
 */
export async function sellerWatchFor(agent, { pool = getPool(), limit = 5 } = {}) {
  const isAdmin = String(agent.role || '') === 'admin';
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, si.score, si.reasons
       FROM seller_intent si JOIN users u ON u.id = si.user_id AND u.tenant_id = si.tenant_id
       WHERE si.tenant_id = $1 AND si.score >= $2 AND u.status = 'active'
         AND (u.assigned_agent_id = $3 OR ($4 AND u.assigned_agent_id IS NULL))
         AND NOT EXISTS (SELECT 1 FROM seller_plans sp WHERE sp.user_id = u.id AND sp.status <> 'withdrawn')
       ORDER BY si.score DESC, si.computed_at DESC LIMIT $5`,
      [agent.tenant_id, MAYBE, agent.id, isAdmin, limit]
    );
    return rows.map((r) => ({
      lead_id: r.id,
      name: r.name || r.email,
      phone: r.phone || null,
      score: r.score,
      level: levelOf(r.score),
      reasons: (r.reasons || []).slice(0, 3),
      opener: 'Ask how they feel about their home these days, and offer a free look at what it would sell for.',
    }));
  } catch {
    return [];
  }
}

/** Words that mean a homeowner is asking Nadia about selling. */
export function mentionsSelling(text) {
  const t = String(text || '').toLowerCase();
  return /\b(sell(ing)? (my|our)\b|list(ing)? (my|our) (home|house|place|condo|townhome)|(i|we)('m|'re| am| are)? (thinking (about|of) |want(ing)? to |planning (on|to) |ready to |need to |going to )?sell(ing)?\b|what('s| is) (my|our) (home|house|place) worth|how much (is|could|would) (i|we|my|our)\b.{0,30}\b(get|worth|sell)|put (my|our) (home|house) on the market|downsiz)/.test(t);
}
