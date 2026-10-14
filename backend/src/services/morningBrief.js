/**
 * The agent's morning brief: who to call today, why, and what to open with.
 *
 * Built only from what leads actually did (the event stream since yesterday
 * morning) plus follow-ups that are due. Each lead gets up to three plain
 * reasons and one suggested first line; nothing is inferred beyond the
 * events themselves.
 *
 * Sent once per agent per Mountain-time day from the hourly scheduler's
 * 6:57am tick, and shown live at the top of the cockpit.
 */
import getPool from '../config/database.js';
import { denverToday } from '../controllers/tourController.js';
import { currentTenantId, tenantById, siteUrlFor } from './tenantContext.js';
import { brandFor, isHomeTenant } from './brand.js';

const SITE = (process.env.SITE_URL || 'https://saahomes.com').replace(/\/$/, '');
export const MAX_BRIEF_LEADS = 10;
export const BRIEF_HOUR_DENVER = 6; // the 6:57am tick
const LOOKBACK_HOURS = 24;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const displayPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || '');
};
const shortPrice = (p) => (p ? (p >= 1e6 ? `$${Math.round(p / 1e5) / 10}M` : `$${Math.round(p / 1000)}K`) : null);

/** Denver wall-clock hour for a Date. */
export function denverHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', hourCycle: 'h23' }).format(now));
}

function homeLabel(h) {
  if (!h) return 'a home';
  const street = [h.street_number, h.street_name].filter(Boolean).join(' ');
  return [street || null, h.city].filter(Boolean).join(', ') || 'a home';
}

/**
 * Pure: turn one lead's recent events into reasons, a suggested opener and a
 * priority. `homes` maps listing_id → { street_number, street_name, city, list_price }.
 */
export function summarizeLead(lead, events, homes = new Map(), { dueToday = false } = {}) {
  const signals = [];
  const add = (weight, reason, opener) => signals.push({ weight, reason, opener });
  const by = (t) => events.filter((e) => e.type === t);

  const tours = by('tour_request');
  if (tours.length) {
    const n = Number(tours[0].meta?.homes) || 0;
    add(100, `Asked for a tour${n ? ` of ${plural(n, 'home')}` : ''}`, 'Confirm a time for the tour they asked for.');
  }
  const showings = by('showing_request');
  if (showings.length) {
    add(90, `Asked to see ${plural(showings.length, 'home')}`, 'Call to lock in the showing they asked for.');
  }

  const seller = events.filter((e) => e.type === 'comps_adjusted' || e.type === 'home_value_view');
  if (seller.length) {
    const adjusted = seller.some((e) => e.type === 'comps_adjusted');
    add(70, adjusted ? 'Built their own home value from recent sales' : 'Checked their home value',
      'Offer to walk through what their home would sell for today.');
  }

  const loves = by('home_reaction').filter((e) => e.meta?.reaction === 'love');
  if (loves.length) {
    const keys = [...new Set(loves.map((e) => e.listing_id))];
    const first = homes.get(keys[0]);
    const price = shortPrice(Number(first?.list_price));
    add(60, `Loved ${keys.length === 1 ? `${homeLabel(first)}${price ? ` (${price})` : ''}` : `${keys.length} homes, including ${homeLabel(first)}`}`,
      `Ask what they loved about ${homeLabel(first).split(',')[0]}.`);
  }

  const views = by('listing_view');
  const viewCounts = new Map();
  for (const v of views) viewCounts.set(v.listing_id, (viewCounts.get(v.listing_id) || 0) + 1);
  const [topKey, topN] = [...viewCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (topN >= 2) {
    add(55, `Opened ${homeLabel(homes.get(topKey))} ${topN} times`, `Ask if ${homeLabel(homes.get(topKey)).split(',')[0]} is worth seeing in person.`);
  }

  const saves = by('home_saved');
  if (saves.length) add(50, `Saved ${plural(new Set(saves.map((e) => e.listing_id)).size, 'home')}`, 'Ask which of the homes they saved stands out.');

  if (by('search_saved').length) add(45, 'Set up a search alert', 'Check the search fits what they want and offer to fine-tune it.');

  const asked = by('search').map((e) => e.meta?.asked).filter(Boolean);
  if (asked.length) {
    const q = String(asked[0]).slice(0, 80);
    add(40, `Searched “${q}”`, `Ask about what they're after: “${q}”.`);
  }

  if (by('household_joined').length) add(35, 'A partner joined their home search', 'Say hello to both of them and offer a tour together.');
  else if (by('board_comment').length) add(30, 'Commented on a home with their partner', 'Ask how the two of them are leaning.');

  if (topN === 1 || (!topN && views.length)) {
    if (viewCounts.size >= 3) add(20, `Looked at ${viewCounts.size} homes`, 'Ask how the search is going.');
  }

  if (dueToday) add(15, 'Follow-up due today', 'Check in on where their search stands.');

  signals.sort((a, b) => b.weight - a.weight);
  if (!signals.length) return null;
  return {
    lead_id: lead.id,
    name: lead.name || lead.email,
    email: lead.email,
    phone: lead.phone || null,
    lead_score: lead.lead_score || 0,
    reasons: signals.slice(0, 3).map((s) => s.reason),
    opener: signals[0].opener,
    priority: signals.slice(0, 3).reduce((s, x) => s + x.weight, 0) + Math.min(20, Math.round((lead.lead_score || 0) / 5)),
    last_event_at: events[0]?.occurred_at || null,
  };
}

/** The brief for one agent (or admin, who also covers unassigned leads), within the agent's tenant. */
export async function buildBrief(agent, { now = new Date(), pool = getPool() } = {}) {
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3600 * 1000);
  const isAdmin = String(agent.role || '') === 'admin';
  // Tasks due today (and overdue) from the cockpit CRM.
  let tasks = [];
  try {
    const { dueTasksFor } = await import('./crmService.js');
    const tenant = await tenantById(agent.tenant_id ?? currentTenantId(), { pool });
    tasks = await dueTasksFor({ ...agent, tenant_id: tenant.id }, { now, tenant }, pool);
  } catch {
    tasks = [];
  }
  const { rows: leads } = await pool.query(
    `SELECT id, name, email, phone, lead_score, next_touch_at, lifecycle_stage
     FROM users
     WHERE COALESCE(role, 'client') = 'client' AND status = 'active'
       AND tenant_id = $3
       AND (assigned_agent_id = $1 OR ($2 AND assigned_agent_id IS NULL))
       AND COALESCE(lifecycle_stage, '') NOT IN ('closed', 'lost')`,
    [agent.id, isAdmin, agent.tenant_id ?? currentTenantId()]
  );
  if (!leads.length) return { date: denverToday(now), items: [], tasks };

  const ids = leads.map((l) => l.id);
  const { rows: events } = await pool.query(
    `SELECT user_id, type, listing_id, meta, occurred_at FROM events
     WHERE user_id = ANY($1::int[]) AND occurred_at >= $2 AND occurred_at <= $3
     ORDER BY occurred_at DESC`,
    [ids, since, now]
  );
  const listingIds = [...new Set(events.map((e) => e.listing_id).filter(Boolean))];
  const homes = new Map();
  if (listingIds.length) {
    const { rows } = await pool.query(
      'SELECT listing_id, street_number, street_name, city, list_price FROM listings WHERE listing_id = ANY($1::text[])',
      [listingIds]
    );
    for (const r of rows) homes.set(String(r.listing_id), r);
  }

  const today = denverToday(now);
  const byLead = new Map();
  for (const e of events) {
    if (!byLead.has(e.user_id)) byLead.set(e.user_id, []);
    byLead.get(e.user_id).push(e);
  }
  const items = [];
  for (const lead of leads) {
    const due = lead.next_touch_at && denverToday(new Date(lead.next_touch_at)) <= today;
    const item = summarizeLead(lead, byLead.get(lead.id) || [], homes, { dueToday: due });
    if (item) items.push(item);
  }
  items.sort((a, b) => b.priority - a.priority || (b.lead_score - a.lead_score));
  return { date: today, items: items.slice(0, MAX_BRIEF_LEADS), more: Math.max(0, items.length - MAX_BRIEF_LEADS), tasks };
}

/** site: the agent's brokerage site (SAA's SITE by default). */
export function briefEmail(agent, brief, { site = SITE } = {}) {
  const first = (agent.name || '').trim().split(/\s+/)[0] || 'there';
  const rows = brief.items.map((it, i) => `
    <tr><td style="padding:14px 0;border-top:1px solid #eee">
      <div style="font-size:15px;font-weight:700;color:#111">${i + 1}. ${esc(it.name)}${it.phone ? ` · <a href="tel:${esc(it.phone)}" style="color:#111">${esc(displayPhone(it.phone))}</a>` : ''}</div>
      <div style="font-size:13px;color:#555;margin-top:4px">${it.reasons.map(esc).join(' · ')}</div>
      <div style="font-size:13px;color:#8a7340;margin-top:4px">Try: ${esc(it.opener)}</div>
    </td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:16px">
    <p style="font-size:15px;color:#111">Good morning, ${esc(first)}. ${brief.items.length ? `${brief.items.length === 1 ? 'One person is' : `${brief.items.length} people are`} worth a call today, based on what they did since yesterday morning.` : `You have ${plural(brief.tasks?.length || 0, 'task')} due today.`}</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    ${brief.more ? `<p style="font-size:13px;color:#555">${plural(brief.more, 'more lead')} in the cockpit.</p>` : ''}
    ${brief.tasks?.length ? `<p style="font-size:15px;font-weight:700;color:#111;margin:18px 0 6px">Due today</p>
    <ul style="padding-left:18px;margin:0;font-size:14px;color:#333">${brief.tasks.map((t) => `<li style="margin:4px 0">${esc(t.title)} · ${esc(t.lead_name)}${t.overdue ? ' <span style="color:#b91c1c">(overdue)</span>' : ''}</li>`).join('')}</ul>` : ''}
    <p style="margin-top:18px"><a href="${site}/agent/" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Open the cockpit</a></p>
  </div>`;
}

/**
 * Send today's brief to every agent who has something in it. Runs from the
 * hourly tick and only acts on the 6am Mountain one; one send per agent per
 * day is enforced by the morning_briefs table.
 */
export async function runMorningBriefs({ now = new Date(), force = false, send, pool = getPool() } = {}) {
  if (!force && denverHour(now) !== BRIEF_HOUR_DENVER) return { skipped: 'not_brief_hour', sent: 0 };
  const deliver = send || (await import('./emailer.js')).sendEmail;
  const today = denverToday(now);
  const { rows: agents } = await pool.query(
    `SELECT id, name, email, role, tenant_id FROM users
     WHERE role IN ('agent', 'admin') AND status = 'active' AND email IS NOT NULL
       AND COALESCE(morning_brief, TRUE)`
  );
  let sent = 0;
  for (const agent of agents) {
    try {
      const brief = await buildBrief(agent, { now, pool });
      if (!brief.items.length && !brief.tasks?.length) continue;
      const claim = await pool.query(
        `INSERT INTO morning_briefs (agent_id, brief_date, lead_count) VALUES ($1, $2, $3)
         ON CONFLICT (agent_id, brief_date) DO NOTHING RETURNING id`,
        [agent.id, today, brief.items.length]
      );
      if (!claim.rows.length) continue;
      const subject = brief.items.length
        ? `${plural(brief.items.length, 'person', 'people')} to call today${brief.items[0] ? `, starting with ${brief.items[0].name.split(' ')[0]}` : ''}`
        : `${plural(brief.tasks.length, 'task')} due today`;
      const tenant = await tenantById(agent.tenant_id, { pool });
      if (isHomeTenant(tenant)) {
        await deliver(agent.email, subject, briefEmail(agent, brief), 'SAA Homes');
      } else {
        // Another brokerage's agent: its own site and name.
        const brand = brandFor(tenant);
        await deliver(agent.email, subject, briefEmail(agent, brief, { site: siteUrlFor(tenant) }), brand.from_name || brand.name, { tenantId: tenant.id });
      }
      sent += 1;
    } catch (e) {
      console.error('[brief] agent', agent.id, 'failed:', e.message);
    }
  }
  return { sent, date: today };
}
