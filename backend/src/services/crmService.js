/**
 * Light CRM behind the cockpit: one timeline per lead, notes, tasks, smart
 * filters, and keeping Follow Up Boss in step.
 *
 * Our tables are the source of truth inside the cockpit. When the brokerage
 * (or the lead's agent) has a Follow Up Boss key, new notes and tasks are
 * also sent there through FUB's public API (POST /v1/notes, POST /v1/tasks,
 * PUT /v1/tasks/{id}); that never blocks or fails the cockpit action.
 *
 * Every function takes a tenant id and filters by it; callers decide which
 * leads a staff member may see (lead_visibility).
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { fubRouteFor, addFollowUpBossNote } from './followUpBossService.js';
import { DEFAULT_TIME_ZONE, timeZoneFor } from './smsService.js';
import { HOT_REASONS, hotTransport } from './hotLeads.js';
import { DAY_PARTS } from './tourPlanner.js';

export const NOTE_KINDS = ['note', 'call'];
export const TASK_KINDS = ['call', 'text', 'email', 'follow_up', 'showing'];
export const SMART_FILTERS = ['hot', 'quiet', 'new', 'tour', 'homeowners'];

/** Swappable in tests: the HTTP call to Follow Up Boss. */
export const crmTransport = { fetch: (...args) => globalThis.fetch(...args) };

/**
 * SQL for a smart filter on the cockpit's users list (alias u.). Pure; the
 * fragment uses only columns and correlated subqueries, no parameters.
 *   hot        a hot-lead alert this week, or a score of 50+ with activity this week
 *   quiet      nothing done on the site for 14+ days (and not brand new)
 *   new        joined in the last 7 days
 *   tour       asked for a tour or a showing
 *   homeowners tracks a home they own, or asked about selling
 */
export function smartFilterSql(filter, alias = 'u.') {
  const a = alias;
  switch (filter) {
    case 'hot':
      return `(EXISTS (SELECT 1 FROM hot_lead_alerts h WHERE h.lead_id = ${a}id AND h.reason <> 'replied' AND h.created_at > NOW() - INTERVAL '7 days')
        OR (COALESCE(${a}lead_score, 0) >= 50 AND ${a}last_active_at > NOW() - INTERVAL '7 days'))`;
    case 'quiet':
      return `(${a}created_at < NOW() - INTERVAL '14 days'
        AND COALESCE((SELECT MAX(e.occurred_at) FROM events e WHERE e.user_id = ${a}id AND e.type NOT IN ('alert_sent', 'consent_changed')),
                     ${a}last_active_at, ${a}created_at) < NOW() - INTERVAL '14 days')`;
    case 'new':
      return `(${a}created_at > NOW() - INTERVAL '7 days')`;
    case 'tour':
      return `(EXISTS (SELECT 1 FROM tour_requests t WHERE t.user_id = ${a}id)
        OR EXISTS (SELECT 1 FROM showing_requests s WHERE LOWER(s.email) = LOWER(${a}email) AND s.tenant_id = ${a}tenant_id))`;
    case 'homeowners':
      return `(EXISTS (SELECT 1 FROM home_profiles hp WHERE hp.user_id = ${a}id) OR COALESCE(${a}seller_heat, FALSE)
        OR ${a}intent IN ('selling', 'sell', 'both'))`;
    default:
      return 'TRUE';
  }
}

/** Search also matches note text. Pure; $n is the ILIKE pattern's parameter. */
export function noteSearchSql(paramRef, alias = 'u.') {
  return `EXISTS (SELECT 1 FROM lead_notes n WHERE n.lead_id = ${alias}id AND n.deleted_at IS NULL AND n.body ILIKE ${paramRef})`;
}

// ------------------------------------------------------------ timeline

const fmtPrice = (p) => {
  const n = Number(p);
  if (!n) return null;
  return n >= 1e6 ? `$${(Math.round(n / 1e4) / 100)}M` : `$${Math.round(n / 1000)}K`;
};
const addr = (l) => (l ? [[l.street_number, l.street_name, l.unit ? `#${l.unit}` : null].filter(Boolean).join(' '), l.city].filter(Boolean).join(', ') : null);

function searchLabel(meta = {}) {
  if (meta.asked) return `Searched “${String(meta.asked).slice(0, 80)}”`;
  const p = new URLSearchParams(String(meta.params || ''));
  const bits = [];
  const city = p.get('city');
  if (city && city !== '__noco__') bits.push(city);
  const beds = p.get('beds') || p.get('minBeds');
  if (beds) bits.push(`${beds}+ beds`);
  const max = p.get('maxPrice') || p.get('max_price');
  if (max) bits.push(`under ${fmtPrice(max) || max}`);
  return bits.length ? `Searched ${bits.join(', ')}` : 'Searched homes';
}

const REACTION = { love: 'Loved', maybe: 'Marked “maybe” on', pass: 'Passed on' };
const FORM_LABEL = { contact: 'Sent a message', market_report: 'Asked what their home is worth', home_value: 'Asked what their home is worth' };

/** Plain words for one site event. Pure. */
export function describeEvent(e, home) {
  const where = addr(home) || (e.listing_id ? `home ${e.listing_id}` : 'a home');
  const m = e.meta || {};
  switch (e.type) {
    case 'listing_view': return { kind: 'view', title: `Viewed ${where}` };
    case 'search': return { kind: 'search', title: searchLabel(m) };
    case 'search_saved': return { kind: 'search', title: 'Saved a search' };
    case 'home_saved': return { kind: 'save', title: `Saved ${where}${fmtPrice(m.list_price) ? ` (${fmtPrice(m.list_price)})` : ''}` };
    case 'home_unsaved': return { kind: 'save', title: `Removed ${where} from saved homes` };
    case 'home_reaction': return { kind: 'reaction', title: `${REACTION[m.reaction] || 'Reacted to'} ${where}` };
    case 'household_invite': return { kind: 'board', title: 'Invited a partner to their home board' };
    case 'household_joined': return { kind: 'board', title: 'Joined a shared home board' };
    case 'board_comment': return { kind: 'board', title: `Commented on ${where}` };
    case 'comps_adjusted': return { kind: 'seller', title: 'Built their own home value from recent sales' };
    case 'home_value_view': return { kind: 'seller', title: 'Checked their home value' };
    case 'form_submit':
      if (m.form === 'lead_intake') return { kind: 'form', title: `${m.created === false ? 'Came back' : 'New lead'} from ${m.source_label || 'a lead source'}` };
      return { kind: 'form', title: FORM_LABEL[m.form] || 'Filled in a form' };
    case 'chat_opened': return { kind: 'nadia', title: 'Chatted with Nadia' };
    case 'nadia_question': return { kind: 'nadia', title: m.topic === 'offer' ? 'Asked Nadia about making an offer' : 'Asked Nadia what they can afford', detail: m.asked || null };
    case 'signup': return { kind: 'account', title: 'Created an account' };
    case 'sign_in': return { kind: 'account', title: 'Signed in' };
    case 'alert_open': return { kind: 'alert', title: 'Opened an alert email' };
    case 'alert_click': return { kind: 'alert', title: 'Clicked a home in an alert' };
    case 'consent_changed': {
      const ch = { sms: 'texts', email: 'emails', push: 'phone alerts', call: 'calls' }[m.channel] || m.channel;
      return { kind: 'consent', title: m.status === 'granted' ? `Agreed to ${ch}` : `Turned off ${ch}` };
    }
    default: return { kind: 'activity', title: String(e.type).replace(/_/g, ' ') };
  }
}

const SKIP_EVENT_TYPES = ['page_view', 'tour_request', 'showing_request', 'alert_sent'];

/**
 * The lead's whole story, newest first: site activity, alerts sent and
 * opened, saved homes, reactions, tours, texts, emails, notes, tasks, hot
 * moments, assignments and Follow Up Boss syncs.
 */
export async function buildTimeline(leadId, tenantId, { limit = 100, before = null } = {}, pool = getPool()) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const beforeTs = before ? new Date(before) : null;
  const b = beforeTs && !Number.isNaN(beforeTs.getTime()) ? beforeTs : null;
  const { rows: [lead] } = await pool.query('SELECT id, email, tenant_id FROM users WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
  if (!lead) return [];
  const q = (sql, params) => pool.query(sql, params).then((r) => r.rows).catch((e) => {
    logger.warn('timeline source failed', { message: e.message });
    return [];
  });
  const win = (col) => `($2::timestamptz IS NULL OR ${col} < $2) AND $3::int > 0`;
  const base = [lead.id, b, cap];

  const [events, emails, tours, showings, messages, notes, tasks, actions, hot] = await Promise.all([
    q(`SELECT id, type, listing_id, meta, source, occurred_at AS at, fub_synced_at FROM events
       WHERE user_id = $1 AND type <> ALL($4::text[]) AND ${win('occurred_at')}
       ORDER BY occurred_at DESC LIMIT $3`, [...base, SKIP_EVENT_TYPES]),
    q(`SELECT id, type, subject, sent_at AS at, open_count, first_open_at FROM email_log
       WHERE user_id = $1 AND ${win('sent_at')} ORDER BY sent_at DESC LIMIT $3`, base),
    q(`SELECT id, listing_keys, windows, note, status, est_minutes, confirmed_start, created_at AS at FROM tour_requests
       WHERE user_id = $1 AND tenant_id = $4 AND ${win('created_at')} ORDER BY created_at DESC LIMIT $3`, [...base, tenantId]),
    q(`SELECT s.id, s.listing_address, s.showing_date, s.showing_time, s.created_at AS at FROM showing_requests s
       WHERE $1::int > 0 AND LOWER(s.email) = LOWER($4) AND s.tenant_id = $5 AND ${win('s.created_at')}
         AND NOT EXISTS (SELECT 1 FROM tour_requests t WHERE t.showing_request_id = s.id)
       ORDER BY s.created_at DESC LIMIT $3`, [...base, lead.email, tenantId]),
    q(`SELECT m.id, m.channel, m.direction, m.kind, m.subject, m.body, m.status, m.error, m.created_at AS at, a.name AS agent_name
       FROM lead_messages m LEFT JOIN users a ON a.id = m.agent_id
       WHERE m.lead_id = $1 AND m.tenant_id = $4 AND ${win('m.created_at')} ORDER BY m.created_at DESC LIMIT $3`, [...base, tenantId]),
    q(`SELECT id, kind, body, pinned, author_name, created_at AS at, updated_at, edited_by_name FROM lead_notes
       WHERE lead_id = $1 AND tenant_id = $4 AND deleted_at IS NULL AND ${win('created_at')} ORDER BY created_at DESC LIMIT $3`, [...base, tenantId]),
    q(`SELECT t.id, t.title, t.kind, t.due_at, t.done_at, t.created_at AS at, a.name AS assignee_name FROM lead_tasks t
       LEFT JOIN users a ON a.id = t.assignee_id
       WHERE t.lead_id = $1 AND t.tenant_id = $4 AND ${win('t.created_at')} ORDER BY t.created_at DESC LIMIT $3`, [...base, tenantId]),
    q(`SELECT ue.id, ue.event_type, ue.meta, ue.created_at AS at, a.name AS agent_name FROM user_events ue
       LEFT JOIN users a ON a.id = NULLIF(ue.meta->>'assigned_agent_id', '')::int
       WHERE ue.user_id = $1 AND ue.event_type IN ('agent_assign', 'shared_home', 'fub_sync', 'seller_heat')
         AND ${win('ue.created_at')} ORDER BY ue.created_at DESC LIMIT $3`, base),
    q(`SELECT h.id, h.reason, h.channels, h.created_at AS at, a.name AS agent_name FROM hot_lead_alerts h
       LEFT JOIN users a ON a.id = h.agent_id
       WHERE h.lead_id = $1 AND h.tenant_id = $4 AND h.reason <> 'replied' AND ${win('h.created_at')}
       ORDER BY h.created_at DESC LIMIT $3`, [...base, tenantId]),
  ]);

  const listingIds = [...new Set(events.map((e) => e.listing_id).filter(Boolean))];
  const homes = new Map();
  if (listingIds.length) {
    const rows = await q('SELECT listing_id, street_number, street_name, unit, city, list_price, slug FROM listings WHERE listing_id = ANY($1::text[])', [listingIds]);
    for (const r of rows) homes.set(String(r.listing_id), r);
  }

  const items = [];
  for (const e of events) {
    const d = describeEvent(e, homes.get(String(e.listing_id)));
    const home = homes.get(String(e.listing_id));
    items.push({
      id: `ev-${e.id}`, at: e.at, kind: d.kind, title: d.title, detail: d.detail || null,
      link: home?.slug ? `/homes-for-sale/${home.slug}/` : null, in_fub: !!e.fub_synced_at,
    });
  }
  for (const m of emails) {
    items.push({ id: `al-${m.id}`, at: m.at, kind: 'alert', title: `Alert email sent: ${m.subject || 'listing alert'}`, detail: null });
    if (m.first_open_at && (!b || new Date(m.first_open_at) < b)) {
      items.push({ id: `ao-${m.id}`, at: m.first_open_at, kind: 'alert', title: `Opened “${m.subject || 'an alert'}”${m.open_count > 1 ? ` (${m.open_count} times)` : ''}` });
    }
  }
  for (const t of tours) {
    const n = (t.listing_keys || []).length;
    const windows = Array.isArray(t.windows) ? t.windows.map((w) => `${w.date} ${DAY_PARTS[w.part]?.label || w.part || ""}`.trim()).join('; ') : '';
    items.push({
      id: `tr-${t.id}`, at: t.at, kind: 'tour', title: `Asked for a tour of ${n} home${n === 1 ? '' : 's'}`,
      detail: [windows ? `Times that work: ${windows}` : null, t.note ? `Note: ${t.note}` : null].filter(Boolean).join(' · ') || null,
      tour: { id: t.id, status: t.status, confirmed_start: t.confirmed_start, windows: t.windows },
    });
  }
  for (const s of showings) {
    items.push({ id: `sh-${s.id}`, at: s.at, kind: 'tour', title: `Asked to see ${s.listing_address || 'a home'}`, detail: `${s.showing_date ? new Date(s.showing_date).toISOString().slice(0, 10) : ''} ${s.showing_time || ''}`.trim() || null });
  }
  for (const m of messages) {
    const out = m.direction === 'out';
    const ch = m.channel === 'sms' ? 'Text' : 'Email';
    const label = !out ? `${ch} from lead` : m.kind === 'alert' ? 'Text alert sent' : m.kind === 'tour' ? 'Tour text sent'
      : m.kind === 'plan' ? `${ch} sent by an action plan` : `${ch} sent${m.agent_name ? ` by ${m.agent_name}` : ''}`;
    items.push({
      id: `msg-${m.id}`, at: m.at, kind: m.channel === 'sms' ? 'text' : 'email', title: m.subject && m.channel === 'email' ? `${label}: ${m.subject}` : label,
      detail: m.body, status: m.status, direction: m.direction,
    });
  }
  for (const n of notes) {
    items.push({ id: `note-${n.id}`, at: n.at, kind: n.kind === 'call' ? 'call' : 'note', title: `${n.kind === 'call' ? 'Call logged' : 'Note'} by ${n.author_name || 'a teammate'}`, detail: n.body, pinned: n.pinned, edited: !!n.updated_at });
  }
  for (const t of tasks) {
    items.push({ id: `task-${t.id}`, at: t.at, kind: 'task', title: `Task: ${t.title}`, detail: [t.assignee_name ? `For ${t.assignee_name}` : null, t.due_at ? `due ${new Date(t.due_at).toISOString().slice(0, 10)}` : null, t.done_at ? 'done' : null].filter(Boolean).join(' · ') || null });
  }
  for (const a of actions) {
    const m = a.meta || {};
    let title = a.event_type.replace(/_/g, ' ');
    if (a.event_type === 'agent_assign') title = m.assigned_agent_id ? `Assigned to ${a.agent_name || 'an agent'}${m.by_role === 'round_robin' ? ' (round-robin)' : ''}` : 'Moved to the team pool';
    if (a.event_type === 'shared_home') title = `You shared ${m.address || 'a home'}`;
    if (a.event_type === 'fub_sync') title = 'Synced with Follow Up Boss';
    if (a.event_type === 'seller_heat') title = 'Showed interest in selling';
    items.push({ id: `ue-${a.id}`, at: a.at, kind: a.event_type === 'fub_sync' ? 'fub' : 'activity', title });
  }
  for (const h of hot) {
    items.push({ id: `hot-${h.id}`, at: h.at, kind: 'hot', title: `Hot: ${HOT_REASONS[h.reason] || h.reason}`, detail: h.agent_name ? `Alerted ${h.agent_name}${h.channels?.length ? ` by ${h.channels.filter((c) => c !== 'round_robin').join(' and ') || 'cockpit'}` : ''}` : null });
  }
  items.sort((x, y) => new Date(y.at) - new Date(x.at));
  return items.slice(0, cap);
}

// ------------------------------------------------------------ FUB sync

const fubAuth = (key) => `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
const FUB_TASK_TYPE = { call: 'Call', text: 'Text', email: 'Email', follow_up: 'Follow Up', showing: 'Showing' };

/** Push a new note to the lead's Follow Up Boss timeline. Never throws. */
export async function syncNoteToFub(noteId, pool = getPool()) {
  try {
    const { rows: [n] } = await pool.query(
      'SELECT n.id, n.lead_id, n.body, n.kind, n.author_name FROM lead_notes n WHERE n.id = $1', [noteId]
    );
    if (!n) return { skipped: 'gone' };
    const r = await addFollowUpBossNote(n.lead_id, {
      subject: `${n.kind === 'call' ? 'Call' : 'Note'} from ${n.author_name || 'the cockpit'}`,
      body: n.body,
    }, { pool, fetchImpl: crmTransport.fetch });
    if (r?.ok) await pool.query('UPDATE lead_notes SET fub_synced_at = NOW() WHERE id = $1', [n.id]);
    return r;
  } catch (e) {
    logger.warn('FUB note sync failed', { message: e.message });
    return { ok: false };
  }
}

/** Create (or complete) the task in Follow Up Boss. Never throws. */
export async function syncTaskToFub(taskId, pool = getPool()) {
  try {
    const { rows: [t] } = await pool.query(
      `SELECT t.*, u.fub_person_id, u.tenant_id AS lead_tenant, u.assigned_agent_id FROM lead_tasks t JOIN users u ON u.id = t.lead_id WHERE t.id = $1`,
      [taskId]
    );
    if (!t) return { skipped: 'gone' };
    const route = await fubRouteFor({ tenantId: t.lead_tenant, agentUserId: t.assigned_agent_id }, { pool });
    if (!route?.key) return { skipped: 'not_configured' };
    if (!t.fub_person_id) return { skipped: 'not_linked' };
    const headers = { 'Content-Type': 'application/json', Authorization: fubAuth(route.key) };
    if (t.fub_task_id) {
      const res = await crmTransport.fetch(`https://api.followupboss.com/v1/tasks/${t.fub_task_id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ name: t.title, isCompleted: !!t.done_at, ...(t.due_at ? { dueDate: new Date(t.due_at).toISOString().slice(0, 10) } : {}) }),
      });
      if (res.ok) await pool.query('UPDATE lead_tasks SET fub_synced_at = NOW() WHERE id = $1', [t.id]);
      return { ok: res.ok };
    }
    const res = await crmTransport.fetch('https://api.followupboss.com/v1/tasks', {
      method: 'POST', headers,
      body: JSON.stringify({
        personId: Number(t.fub_person_id),
        name: t.title,
        type: FUB_TASK_TYPE[t.kind] || 'Follow Up',
        ...(t.due_at ? { dueDate: new Date(t.due_at).toISOString().slice(0, 10), dueDateTime: new Date(t.due_at).toISOString() } : {}),
      }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json().catch(() => ({}));
    await pool.query('UPDATE lead_tasks SET fub_task_id = $2, fub_synced_at = NOW() WHERE id = $1', [t.id, Number(data?.id) || null]);
    return { ok: true };
  } catch (e) {
    logger.warn('FUB task sync failed', { message: e.message });
    return { ok: false };
  }
}

// ------------------------------------------------------------ tasks

/** End of "today" in a time zone, as a Date. */
export function endOfLocalDay(now, tz = DEFAULT_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  const offset = asUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 23, 59, 59) - offset);
}

/**
 * Open tasks due by the end of today (overdue included) for one staff
 * member; admins also see open tasks nobody owns.
 */
export async function dueTasksFor(staff, { now = new Date(), tenant = null } = {}, pool = getPool()) {
  const tenantId = staff.tenant_id ?? tenant?.id;
  const tz = tenant ? timeZoneFor(tenant) : DEFAULT_TIME_ZONE;
  const end = endOfLocalDay(now, tz);
  const isAdmin = String(staff.role || '') === 'admin';
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.kind, t.due_at, t.lead_id, u.name AS lead_name, u.email AS lead_email, u.phone AS lead_phone,
            (t.due_at < $4) AS overdue
     FROM lead_tasks t JOIN users u ON u.id = t.lead_id
     WHERE t.tenant_id = $1 AND t.done_at IS NULL AND t.due_at IS NOT NULL AND t.due_at <= $2
       AND (t.assignee_id = $3 OR ($5 AND t.assignee_id IS NULL))
     ORDER BY t.due_at ASC LIMIT 50`,
    [tenantId, end, staff.id || 0, new Date(end.getTime() - 86400000 + 1000), isAdmin]
  );
  return rows.map((r) => ({
    id: r.id, title: r.title, kind: r.kind, due_at: r.due_at, overdue: r.overdue,
    lead_id: r.lead_id, lead_name: r.lead_name || r.lead_email, lead_phone: r.lead_phone || null,
  }));
}

/**
 * Push task reminders that came due. Each task is claimed once
 * (reminded_at), so two servers can't both remind.
 */
export async function runTaskReminders({ pool = getPool(), push = null } = {}) {
  const { rows } = await pool.query(
    `UPDATE lead_tasks SET reminded_at = NOW()
     WHERE id IN (SELECT id FROM lead_tasks WHERE done_at IS NULL AND reminded_at IS NULL
                    AND remind_at IS NOT NULL AND remind_at <= NOW() AND remind_at > NOW() - INTERVAL '1 day'
                  ORDER BY remind_at LIMIT 100)
     RETURNING id, lead_id, assignee_id, title`
  );
  if (!rows.length) return { reminded: 0 };
  const send = push || hotTransport.push;
  let reminded = 0;
  for (const t of rows) {
    if (!t.assignee_id) continue;
    const { rows: [lead] } = await pool.query('SELECT name, email FROM users WHERE id = $1', [t.lead_id]);
    const { rows: subs } = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL', [t.assignee_id]
    );
    for (const sub of subs) {
      try {
        await send(sub, { title: `Reminder: ${t.title}`, body: lead?.name || lead?.email || '', url: `/agent/?lead=${t.lead_id}&tab=tasks`, tag: `task-${t.id}` });
        reminded += 1;
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await pool.query('UPDATE push_subscriptions SET disabled_at = NOW() WHERE id = $1', [sub.id]);
        }
      }
    }
  }
  return { reminded };
}

// ------------------------------------------------------------ scheduler

let crmTimer = null;
const CRM_LOCK_KEY = 833712;

/**
 * Every minute: task reminders. Every ten minutes: text alerts for saved
 * searches and tour reminders (one server at a time, via an advisory lock).
 */
export function startCrmScheduler() {
  if (crmTimer || process.env.CRM_SCHEDULER === 'off') return;
  let ticks = 0;
  crmTimer = setInterval(async () => {
    ticks += 1;
    const pool = getPool();
    try {
      await runTaskReminders({ pool });
    } catch (e) {
      logger.warn('task reminders failed', { message: e.message });
    }
    if (ticks % 10 !== 0) return;
    const client = await pool.connect().catch(() => null);
    if (!client) return;
    try {
      const { rows: [{ ok }] } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [CRM_LOCK_KEY]);
      if (!ok) return;
      try {
        const { runSmsAlertPass } = await import('./smsService.js');
        const r = await runSmsAlertPass({ pool });
        if (r.texted || r.reminders) logger.info('sms alert pass', r);
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [CRM_LOCK_KEY]).catch(() => {});
      }
    } catch (e) {
      logger.warn('sms alert pass failed', { message: e.message });
    } finally {
      client.release();
    }
  }, 60 * 1000);
  crmTimer.unref?.();
}
