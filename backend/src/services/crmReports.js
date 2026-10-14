/**
 * Brokerage reporting for owners: per agent, over the last 7, 30 or 90 days.
 * Every query is filtered to one tenant. Counts come only from stored rows.
 *
 *   leads_assigned      leads that joined assigned to the agent, or were
 *                       assigned to them, in the window
 *   first_contact_mins  median minutes from a lead joining to the agent's
 *                       first text, email or "Mark touched" (leads that
 *                       joined in the window)
 *   active_searchers    the agent's leads with a live saved search who were
 *                       on the site in the window
 *   hot_leads           the agent's leads that had a hot moment
 *   tours               tour and showing requests from the agent's leads
 *   texts_sent/emails_sent  one-to-one messages the agent sent
 *   response_rate       share of leads the agent texted who texted back
 */
import getPool from '../config/database.js';

export const REPORT_WINDOWS = [7, 30, 90];

const SOURCE_LABELS = {
  website: 'Your website',
  'fub-import': 'Follow Up Boss import',
  webform: 'Agent website form',
  nadia_chat: 'Nadia chat',
};
export const sourceLabel = (s) => SOURCE_LABELS[s] || String(s || 'website').replace(/[-_]/g, ' ');

const ACTIVE = ['search', 'listing_view', 'home_saved', 'home_reaction', 'search_saved', 'tour_request', 'sign_in', 'alert_click'];

export async function agentReport({ tenantId, days = 30 }, pool = getPool()) {
  const d = REPORT_WINDOWS.includes(Number(days)) ? Number(days) : 30;
  const since = new Date(Date.now() - d * 86400000);
  const p = [tenantId, since];
  const q = (sql, params = p) => pool.query(sql, params).then((r) => r.rows);
  const CLIENT = "COALESCE(u.role, 'client') = 'client'";

  const [staff, assigned, contact, searchers, hot, tours, msgs, replies, sources, unassignedNew] = await Promise.all([
    q(`SELECT id, name, email, role, status FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin')
       ORDER BY role DESC, name NULLS LAST, id`, [tenantId]),
    q(`SELECT agent_id, COUNT(DISTINCT lead_id)::int AS n FROM (
         SELECT u.assigned_agent_id AS agent_id, u.id AS lead_id FROM users u
          WHERE u.tenant_id = $1 AND ${CLIENT} AND u.created_at >= $2 AND u.assigned_agent_id IS NOT NULL
         UNION
         SELECT (ue.meta->>'assigned_agent_id')::int, ue.user_id FROM user_events ue JOIN users u ON u.id = ue.user_id
          WHERE u.tenant_id = $1 AND ue.event_type = 'agent_assign' AND ue.created_at >= $2
            AND ue.meta->>'assigned_agent_id' ~ '^[0-9]+$'
       ) x GROUP BY agent_id`),
    q(`SELECT u.assigned_agent_id AS agent_id, COUNT(*)::int AS leads,
              COUNT(u.first_contacted_at)::int AS contacted,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (u.first_contacted_at - u.created_at::timestamptz)) / 60)
                FILTER (WHERE u.first_contacted_at IS NOT NULL) AS median_mins
       FROM users u WHERE u.tenant_id = $1 AND ${CLIENT} AND u.created_at >= $2 AND u.assigned_agent_id IS NOT NULL
       GROUP BY u.assigned_agent_id`),
    q(`SELECT u.assigned_agent_id AS agent_id, COUNT(DISTINCT u.id)::int AS n FROM users u
       WHERE u.tenant_id = $1 AND ${CLIENT} AND u.assigned_agent_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM saved_searches s WHERE s.user_id = u.id AND s.is_active)
         AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.occurred_at >= $2 AND e.type = ANY($3::text[]))
       GROUP BY u.assigned_agent_id`, [...p, ACTIVE]),
    q(`SELECT u.assigned_agent_id AS agent_id, COUNT(DISTINCT h.lead_id)::int AS n FROM hot_lead_alerts h
       JOIN users u ON u.id = h.lead_id
       WHERE h.tenant_id = $1 AND u.tenant_id = $1 AND h.reason <> 'replied' AND h.created_at >= $2
       GROUP BY u.assigned_agent_id`),
    q(`SELECT agent_id, COUNT(*)::int AS n FROM (
         SELECT u.assigned_agent_id AS agent_id, t.id FROM tour_requests t JOIN users u ON u.id = t.user_id
          WHERE t.tenant_id = $1 AND u.tenant_id = $1 AND t.created_at >= $2
         UNION ALL
         SELECT u.assigned_agent_id, s.id FROM showing_requests s
           JOIN users u ON LOWER(u.email) = LOWER(s.email) AND u.tenant_id = s.tenant_id AND ${CLIENT}
          WHERE s.tenant_id = $1 AND s.created_at >= $2
            AND NOT EXISTS (SELECT 1 FROM tour_requests t WHERE t.showing_request_id = s.id)
       ) x GROUP BY agent_id`),
    q(`SELECT agent_id,
              COUNT(*) FILTER (WHERE channel = 'sms')::int AS texts,
              COUNT(*) FILTER (WHERE channel = 'email')::int AS emails,
              COUNT(DISTINCT lead_id) FILTER (WHERE channel = 'sms')::int AS texted_leads
       FROM lead_messages WHERE tenant_id = $1 AND direction = 'out' AND kind = 'conversation'
         AND status <> 'failed' AND created_at >= $2 AND agent_id IS NOT NULL
       GROUP BY agent_id`),
    q(`SELECT o.agent_id, COUNT(DISTINCT o.lead_id)::int AS n FROM (
         SELECT agent_id, lead_id, MIN(created_at) AS first_out FROM lead_messages
          WHERE tenant_id = $1 AND direction = 'out' AND channel = 'sms' AND kind = 'conversation'
            AND status <> 'failed' AND created_at >= $2 AND agent_id IS NOT NULL
          GROUP BY agent_id, lead_id
       ) o WHERE EXISTS (SELECT 1 FROM lead_messages i WHERE i.tenant_id = $1 AND i.lead_id = o.lead_id
                          AND i.direction = 'in' AND i.kind = 'conversation' AND i.created_at > o.first_out)
       GROUP BY o.agent_id`),
    q(`SELECT COALESCE(NULLIF(u.source, ''), 'website') AS source, u.assigned_agent_id AS agent_id, COUNT(*)::int AS n
       FROM users u WHERE u.tenant_id = $1 AND ${CLIENT} AND u.created_at >= $2
       GROUP BY 1, 2`),
    q(`SELECT COUNT(*)::int AS n FROM users u WHERE u.tenant_id = $1 AND ${CLIENT} AND u.created_at >= $2 AND u.assigned_agent_id IS NULL`),
  ]);

  const by = (rows, key = 'n') => new Map(rows.map((r) => [r.agent_id == null ? null : Number(r.agent_id), r[key] ?? r]));
  const assignedM = by(assigned);
  const contactM = new Map(contact.map((r) => [Number(r.agent_id), r]));
  const searchersM = by(searchers);
  const hotM = by(hot);
  const toursM = by(tours);
  const msgsM = new Map(msgs.map((r) => [Number(r.agent_id), r]));
  const repliesM = by(replies);

  const agents = staff.map((s) => {
    const c = contactM.get(s.id);
    const m = msgsM.get(s.id) || { texts: 0, emails: 0, texted_leads: 0 };
    const replied = repliesM.get(s.id) || 0;
    return {
      id: s.id,
      name: s.name || s.email,
      email: s.email,
      role: s.role,
      active: s.status === 'active',
      leads_assigned: assignedM.get(s.id) || 0,
      first_contact_mins: c?.median_mins != null ? Math.round(Number(c.median_mins)) : null,
      contacted: c?.contacted || 0,
      new_leads: c?.leads || 0,
      active_searchers: searchersM.get(s.id) || 0,
      hot_leads: hotM.get(s.id) || 0,
      tours: toursM.get(s.id) || 0,
      texts_sent: m.texts,
      emails_sent: m.emails,
      texted_leads: m.texted_leads,
      replied,
      response_rate: m.texted_leads ? Math.round((replied / m.texted_leads) * 100) / 100 : null,
    };
  });

  const srcTotals = new Map();
  for (const r of sources) {
    const cur = srcTotals.get(r.source) || { source: r.source, label: sourceLabel(r.source), total: 0, by_agent: {} };
    cur.total += r.n;
    cur.by_agent[r.agent_id == null ? 'unassigned' : r.agent_id] = (cur.by_agent[r.agent_id == null ? 'unassigned' : r.agent_id] || 0) + r.n;
    srcTotals.set(r.source, cur);
  }

  return {
    days: d,
    since: since.toISOString(),
    agents,
    unassigned: {
      new_leads: unassignedNew[0]?.n || 0,
      hot_leads: hotM.get(null) || 0,
      tours: toursM.get(null) || 0,
    },
    sources: [...srcTotals.values()].sort((a, b) => b.total - a.total),
  };
}

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // never a formula in a spreadsheet
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The report as CSV, one row per agent. Pure. */
export function reportCsv(report) {
  const head = ['Agent', 'Email', 'Role', 'Leads assigned', 'Median minutes to first contact', 'New leads contacted',
    'Active searchers', 'Hot leads', 'Tours', 'Texts sent', 'Emails sent', 'Texted leads who replied', 'Response rate'];
  const rows = report.agents.map((a) => [
    a.name, a.email, a.role === 'admin' ? 'Owner' : 'Agent', a.leads_assigned, a.first_contact_mins ?? '',
    `${a.contacted}/${a.new_leads}`, a.active_searchers, a.hot_leads, a.tours, a.texts_sent, a.emails_sent,
    `${a.replied}/${a.texted_leads}`, a.response_rate == null ? '' : `${Math.round(a.response_rate * 100)}%`,
  ]);
  rows.push(['Unassigned', '', '', report.unassigned.new_leads, '', '', '', report.unassigned.hot_leads, report.unassigned.tours, '', '', '', '']);
  const lines = [head, ...rows].map((r) => r.map(csvCell).join(','));
  lines.push('');
  lines.push(['Lead source', 'Leads'].join(','));
  for (const s of report.sources) lines.push([csvCell(s.label), s.total].join(','));
  return `${lines.join('\n')}\n`;
}
