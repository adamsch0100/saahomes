/**
 * Search-to-lead funnel from the unified event stream. A "person" is a
 * contact once identified (pre-signup browsing is stitched to them), else
 * an anonymous visitor id. Each step counts people who did it in the window.
 */
import getPool from '../config/database.js';

export const FUNNEL_STEPS = [
  { key: 'visited', label: 'Visited', types: null },
  { key: 'searched', label: 'Searched', types: ['search'] },
  { key: 'viewed', label: 'Viewed a home', types: ['listing_view'] },
  { key: 'saved_home', label: 'Saved a home', types: ['home_saved'] },
  { key: 'identified', label: 'Saved a search or signed up', types: ['search_saved', 'signup'] },
  { key: 'engaged', label: 'Opened or clicked an alert', types: ['alert_open', 'alert_click'] },
  { key: 'showing', label: 'Asked for a showing', types: ['showing_request'] },
];

export async function getFunnel({ days = 30, tenantId = 1 } = {}, pool = getPool()) {
  const d = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
  const params = [tenantId, d];
  const select = FUNNEL_STEPS.map((s) => {
    if (!s.types) return `COUNT(DISTINCT person)::int AS ${s.key}`;
    params.push(s.types);
    return `COUNT(DISTINCT person) FILTER (WHERE type = ANY($${params.length}::text[]))::int AS ${s.key}`;
  }).join(',\n      ');
  const sql = `
    WITH e AS (
      SELECT COALESCE('u' || user_id::text, 'v' || visitor_id) AS person, type
      FROM events
      WHERE tenant_id = $1 AND occurred_at > NOW() - ($2 * INTERVAL '1 day')
        AND type NOT IN ('alert_sent', 'consent_changed')
    )
    SELECT ${select} FROM e`;
  const { rows: [counts] } = await pool.query(sql, params);

  const top = counts.visited || 0;
  const steps = FUNNEL_STEPS.map((s, i) => {
    const n = counts[s.key] || 0;
    const prev = i ? counts[FUNNEL_STEPS[i - 1].key] || 0 : null;
    return {
      key: s.key,
      label: s.label,
      people: n,
      pct_of_visitors: top ? Math.round((n / top) * 1000) / 10 : 0,
      pct_of_previous: prev ? Math.round((n / prev) * 1000) / 10 : null,
    };
  });

  const { rows: sources } = await pool.query(
    `SELECT COALESCE(meta->>'via', 'unknown') AS via, COUNT(*)::int AS n
     FROM events WHERE tenant_id = $1 AND type = 'signup' AND occurred_at > NOW() - ($2 * INTERVAL '1 day')
     GROUP BY 1 ORDER BY 2 DESC`,
    [tenantId, d]
  );
  return { days: d, steps, signups_by_form: sources };
}
