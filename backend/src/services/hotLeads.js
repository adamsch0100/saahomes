/**
 * Instant alerts to the agent when a lead does something hot.
 *
 * Every event a lead makes passes through onLeadEvent() (from recordEvent).
 * A hot moment is one of:
 *   - opened the same home 3+ times in a week
 *   - saved 3 homes in a day
 *   - asked for a tour or a showing
 *   - asked Nadia about making an offer or what they can afford
 *   - came back after 14+ days away
 *   - asked what their home is worth
 * The lead's agent gets a web push (and a text, if they turned that on in
 * their profile). An unassigned lead goes to the brokerage's owners, or to the
 * next agent in turn when the owner chose round-robin (who then owns it).
 * The same lead and reason alert at most once a day, and one lead at most
 * once per half hour (a tour request always goes through).
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { deliverPush } from './pushService.js';
import { tenantById } from './tenantContext.js';
import { brandFor } from './brand.js';

export const HOT_REASONS = {
  repeat_views: 'Opened the same home 3+ times',
  saved_three: 'Saved 3 homes today',
  tour: 'Asked for a tour',
  nadia_offer: 'Asked Nadia about making an offer',
  nadia_afford: 'Asked Nadia what they can afford',
  back_after_quiet: 'Back after 14+ days away',
  home_value: 'Asked what their home is worth',
};

/** Things a person does themselves (not alerts we send or settings we record). */
export const ACTIVE_TYPES = [
  'page_view', 'search', 'listing_view', 'search_saved', 'home_saved', 'home_reaction', 'board_comment',
  'tour_request', 'showing_request', 'form_submit', 'home_value_view', 'comps_adjusted', 'chat_opened',
  'sign_in', 'alert_click', 'nadia_question', 'household_joined',
];

const HOME_VALUE_FORMS = new Set(['market_report', 'home_value', 'seller', 'cma', 'sell']);
const REASON_WINDOW_HOURS = 24;
const LEAD_WINDOW_MINUTES = 30;
const QUIET_DAYS = 14;

/** Swappable in tests. */
export const hotTransport = {
  push: (sub, payload) => deliverPush(sub, payload),
  text: async (args, pool) => (await import('./smsService.js')).sendStaffText(args, pool),
};

/** The hot reason for one stored event, or null. */
export async function detectHotReason(ev, pool = getPool()) {
  const uid = ev.user_id;
  const meta = ev.meta || {};
  if (ev.type === 'tour_request' || ev.type === 'showing_request') return { reason: 'tour' };
  if (ev.type === 'nadia_question') {
    if (meta.topic === 'offer') return { reason: 'nadia_offer', detail: meta.asked || null };
    if (meta.topic === 'afford') return { reason: 'nadia_afford', detail: meta.asked || null };
  }
  if (ev.type === 'home_value_view' || ev.type === 'comps_adjusted'
    || (ev.type === 'form_submit' && HOME_VALUE_FORMS.has(String(meta.form || '')))) {
    return { reason: 'home_value' };
  }
  if (ev.type === 'listing_view' && ev.listing_id) {
    const { rows: [r] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM events WHERE user_id = $1 AND type = 'listing_view' AND listing_id = $2
         AND occurred_at > NOW() - INTERVAL '7 days'`,
      [uid, ev.listing_id]
    );
    if (r.n >= 3) return { reason: 'repeat_views', detail: ev.listing_id };
  }
  if (ev.type === 'home_saved') {
    const { rows: [r] } = await pool.query(
      `SELECT COUNT(DISTINCT listing_id)::int AS n FROM events WHERE user_id = $1 AND type = 'home_saved'
         AND occurred_at > NOW() - INTERVAL '24 hours'`,
      [uid]
    );
    if (r.n >= 3) return { reason: 'saved_three' };
  }
  if (ACTIVE_TYPES.includes(ev.type)) {
    const { rows: [prev] } = await pool.query(
      `SELECT occurred_at FROM events WHERE user_id = $1 AND id <> $2 AND type = ANY($3::text[])
         AND occurred_at <= $4 ORDER BY occurred_at DESC LIMIT 1`,
      [uid, ev.id, ACTIVE_TYPES, ev.occurred_at || new Date()]
    );
    const at = new Date(ev.occurred_at || Date.now()).getTime();
    if (prev && at - new Date(prev.occurred_at).getTime() >= QUIET_DAYS * 86400000) {
      return { reason: 'back_after_quiet' };
    }
  }
  return null;
}

/** Called (fire-and-forget) for every recorded event. Never throws. */
export async function onLeadEvent(ev, pool = getPool()) {
  try {
    if (!ev?.user_id || process.env.HOT_LEAD_ALERTS === 'off') return null;
    if (ev.type === 'tour_request' && ev.meta?.tour_id) {
      import('./smsService.js')
        .then(({ textTourAck }) => textTourAck(ev.meta.tour_id, pool))
        .catch((e) => logger.warn('tour ack text failed', { message: e.message }));
    }
    const hot = await detectHotReason(ev, pool);
    if (!hot) return null;
    return await alertHotLead({ leadId: ev.user_id, ...hot }, pool);
  } catch (e) {
    logger.warn('hot lead check failed', { message: e.message });
    return null;
  }
}

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

async function staffById(id, tenantId, pool) {
  const { rows: [a] } = await pool.query(
    `SELECT id, name, email, phone, role, notify_prefs, tenant_id FROM users
     WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin') AND status = 'active'`,
    [id, tenantId]
  );
  return a || null;
}

/**
 * Who hears about an unassigned lead: the owners, or (round-robin) the next
 * agent in turn, who is then assigned the lead.
 */
async function routeUnassigned(lead, tenant, pool) {
  const mode = tenant.settings?.hot_leads?.unassigned === 'round_robin' ? 'round_robin' : 'owners';
  if (mode === 'round_robin') {
    const { rows: agents } = await pool.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role = 'agent' AND status = 'active' ORDER BY id`,
      [tenant.id]
    );
    if (agents.length) {
      const { rows: [last] } = await pool.query(
        `SELECT agent_id FROM hot_lead_alerts WHERE tenant_id = $1 AND 'round_robin' = ANY(channels)
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [tenant.id]
      );
      const next = agents.find((a) => a.id > Number(last?.agent_id || 0)) || agents[0];
      const claimed = await pool.query(
        'UPDATE users SET assigned_agent_id = $1 WHERE id = $2 AND assigned_agent_id IS NULL RETURNING id',
        [next.id, lead.id]
      );
      if (claimed.rows[0]) {
        await pool.query(
          `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'agent_assign', $2::jsonb)`,
          [lead.id, JSON.stringify({ assigned_agent_id: next.id, previous_assigned_agent_id: null, by_role: 'round_robin' })]
        ).catch(() => {});
      }
      const agent = await staffById(next.id, tenant.id, pool);
      return { recipients: agent ? [agent] : [], roundRobin: true };
    }
  }
  const { rows: owners } = await pool.query(
    `SELECT id, name, email, phone, role, notify_prefs, tenant_id FROM users
     WHERE tenant_id = $1 AND role = 'admin' AND status = 'active' ORDER BY id`,
    [tenant.id]
  );
  return { recipients: owners, roundRobin: false };
}

async function pushToStaff(staffId, payload, pool) {
  const { rows: subs } = await pool.query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL',
    [staffId]
  );
  let delivered = 0;
  for (const sub of subs) {
    try {
      await hotTransport.push(sub, payload);
      delivered += 1;
      await pool.query('UPDATE push_subscriptions SET last_success_at = NOW(), last_error = NULL WHERE id = $1', [sub.id]);
    } catch (e) {
      const gone = e?.statusCode === 404 || e?.statusCode === 410;
      await pool.query(
        'UPDATE push_subscriptions SET last_error = $2, disabled_at = CASE WHEN $3 THEN NOW() ELSE disabled_at END WHERE id = $1',
        [sub.id, String(e?.statusCode || e?.message || 'error').slice(0, 200), gone]
      );
    }
  }
  return delivered;
}

const prefOn = (agent, key, dflt) => {
  const v = agent?.notify_prefs?.[key];
  return v === undefined ? dflt : v === true;
};

/**
 * Alert the right people about one hot moment. Returns
 * { sent: [{ agent_id, channels }] } or { skipped }.
 */
export async function alertHotLead({ leadId, reason, detail = null }, pool = getPool()) {
  const { rows: [lead] } = await pool.query(
    `SELECT id, name, email, phone, tenant_id, assigned_agent_id, role, status FROM users WHERE id = $1`,
    [leadId]
  );
  if (!lead || String(lead.role || 'client') !== 'client' || lead.status === 'unsubscribed') return { skipped: 'not_a_lead' };

  const { rows: [dupe] } = await pool.query(
    `SELECT 1 FROM hot_lead_alerts
     WHERE lead_id = $1 AND reason <> 'replied'
       AND ((reason = $2 AND created_at > NOW() - make_interval(hours => $3))
         OR ($2 <> 'tour' AND created_at > NOW() - make_interval(mins => $4)))
     LIMIT 1`,
    [lead.id, reason, REASON_WINDOW_HOURS, LEAD_WINDOW_MINUTES]
  );
  if (dupe) return { skipped: 'dedupe' };

  const tenant = await tenantById(lead.tenant_id, { pool });
  let recipients = [];
  let roundRobin = false;
  if (lead.assigned_agent_id) {
    const agent = await staffById(lead.assigned_agent_id, tenant.id, pool);
    if (agent) recipients = [agent];
  }
  if (!recipients.length) ({ recipients, roundRobin } = await routeUnassigned(lead, tenant, pool));

  const who = lead.name || lead.email;
  const why = HOT_REASONS[reason] || 'Busy on the site';
  let listingLine = '';
  if (reason === 'repeat_views' && detail) {
    const { rows: [l] } = await pool.query(
      'SELECT street_number, street_name, city FROM listings WHERE listing_id = $1 LIMIT 1', [String(detail)]
    ).catch(() => ({ rows: [] }));
    if (l) listingLine = `: ${[l.street_number, l.street_name].filter(Boolean).join(' ')}${l.city ? `, ${l.city}` : ''}`;
  }
  const payload = {
    title: `Hot lead: ${who}`,
    body: `${why}${listingLine}.${lead.phone ? ' Call or text now.' : ' Reach out now.'}`,
    url: `/agent/?lead=${lead.id}`,
    tag: `hot-${lead.id}`,
  };

  const sent = [];
  if (!recipients.length) {
    await pool.query(
      `INSERT INTO hot_lead_alerts (tenant_id, lead_id, agent_id, reason, detail, channels) VALUES ($1, $2, NULL, $3, $4, '{}')`,
      [tenant.id, lead.id, reason, detail ? String(detail).slice(0, 300) : null]
    );
    return { sent };
  }
  for (const agent of recipients) {
    const channels = roundRobin ? ['round_robin'] : [];
    // Claim first, so two events at once can't both alert.
    const { rows: [row] } = await pool.query(
      `INSERT INTO hot_lead_alerts (tenant_id, lead_id, agent_id, reason, detail, channels)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [tenant.id, lead.id, agent.id, reason, detail ? String(detail).slice(0, 300) : null, channels]
    );
    if (prefOn(agent, 'hot_lead_push', true)) {
      if (await pushToStaff(agent.id, payload, pool)) channels.push('push');
    }
    if (prefOn(agent, 'hot_lead_text', false)) {
      const body = `${who} is hot: ${why}${listingLine}. ${lead.phone ? `Call ${lead.phone}.` : ''} ${brandFor(tenant).site_url}/agent/?lead=${lead.id}`.replace(/\s+/g, ' ').trim();
      const r = await hotTransport.text({ tenant, agent, body }, pool);
      if (r?.ok) channels.push('text');
    }
    await pool.query('UPDATE hot_lead_alerts SET channels = $2 WHERE id = $1', [row.id, channels]);
    sent.push({ agent_id: agent.id, channels });
  }
  return { sent };
}

/** A lead texted back: tell their agent (or the owners) right away. */
export async function notifyLeadReplied({ tenant, lead, body }, pool = getPool()) {
  const { rows: [recent] } = await pool.query(
    `SELECT 1 FROM hot_lead_alerts WHERE lead_id = $1 AND reason = 'replied' AND created_at > NOW() - INTERVAL '10 minutes' LIMIT 1`,
    [lead.id]
  );
  if (recent) return { skipped: 'dedupe' };
  let recipients = [];
  if (lead.assigned_agent_id) {
    const a = await staffById(lead.assigned_agent_id, tenant.id, pool);
    if (a) recipients = [a];
  }
  if (!recipients.length) {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, role, notify_prefs FROM users WHERE tenant_id = $1 AND role = 'admin' AND status = 'active'`,
      [tenant.id]
    );
    recipients = rows;
  }
  const payload = {
    title: `${lead.name || firstName(lead.email) || 'A lead'} texted you`,
    body: String(body || '').slice(0, 140),
    url: `/agent/?lead=${lead.id}&tab=texts`,
    tag: `reply-${lead.id}`,
  };
  for (const agent of recipients) {
    const channels = [];
    if (prefOn(agent, 'hot_lead_push', true) && await pushToStaff(agent.id, payload, pool)) channels.push('push');
    await pool.query(
      `INSERT INTO hot_lead_alerts (tenant_id, lead_id, agent_id, reason, detail, channels) VALUES ($1, $2, $3, 'replied', $4, $5)`,
      [tenant.id, lead.id, agent.id, String(body || '').slice(0, 300), channels]
    );
  }
  return { notified: recipients.length };
}
