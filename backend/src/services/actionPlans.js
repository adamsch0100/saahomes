/**
 * Action plans: follow-up sequences an agent or owner builds once and the
 * cockpit runs for each lead.
 *
 *   - A plan is a list of steps: an email, a text, a task, or "wait N days".
 *   - A lead joins a plan by hand ("Add to plan") or automatically when the
 *     plan's trigger fires and the plan is set to start on its own: a new lead
 *     from a source, a stage change, a tag, or a closing.
 *   - Texts go through smsService.sendText, so consent, STOP and quiet hours
 *     apply; a text that hits quiet hours waits for the morning. Emails are in
 *     the brokerage's brand with an unsubscribe link, and never go to someone
 *     who turned email off. A step that can't go (no phone, no consent) is
 *     skipped and noted, and the plan moves on.
 *   - A plan pauses on its own when the lead replies (text or email) or books
 *     a tour, so nobody gets "just checking in" after they wrote back. The
 *     agent can resume or stop it from the lead's Plans tab.
 *   - runDuePlans() moves every due run forward; the scheduler calls it every
 *     minute (one server at a time). Tests pass their own clock.
 *
 * Plans are per brokerage. The owner's plans (and the starter plans) are
 * shared with the whole team; an agent's own plans are theirs until the
 * owner shares them.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { tenantById, siteUrlFor } from './tenantContext.js';
import { brandFor, isHomeTenant } from './brand.js';
import { getConsents } from './consent.js';
import { sendText, isTextingQuietHours, smsConfigFor } from './smsService.js';
import { emailShell, esc } from './stayEmails.js';
import { emailSiteUrl } from './emailer.js';
import { LIFECYCLE_STAGES } from './agentCockpit.js';

export const STEP_TYPES = ['email', 'text', 'task', 'wait'];
export const TRIGGER_TYPES = ['manual', 'new_lead', 'stage', 'tag', 'closed'];
export const TASK_KINDS = ['call', 'text', 'email', 'follow_up', 'showing'];
/** Lead sources a "new lead" trigger can name. */
export const LEAD_SOURCES = {
  website: 'Signed up on your website',
  contact: 'Contact form',
  nadia: 'Chat with Nadia',
  webform: 'Agent website form',
  home_value: 'Home value form',
  zillow: 'Zillow',
  realtor: 'Realtor.com',
  homes: 'Homes.com',
  facebook: 'Facebook lead ads',
  zapier: 'Zapier or web form',
  email: 'Forwarded lead email',
};
const MAX_STEPS = 30;
const MAX_WAIT_DAYS = 365;
const LOCK_MINUTES = 5;
const DAY_MS = 86400000;

/** Swappable in tests: the clock and the email send. */
export const planTransport = {
  now: () => new Date(),
  sendEmail: null, // (to, subject, html, fromName, opts) => Promise; null = the platform emailer
};

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const cleanText = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const isPlaceholderEmail = (e) => /\.invalid$/i.test(String(e || '').trim());

// ------------------------------------------------------------ plan shape

/**
 * Check and tidy a plan from the builder. Returns { fields } or { error }.
 * Pure.
 */
export function normalizePlan(input = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || input.name !== undefined) {
    const name = cleanText(input.name, 120);
    if (!name) return { error: 'Give the plan a name.' };
    out.name = name;
  }
  if (input.description !== undefined) out.description = cleanText(input.description, 500) || null;
  if (input.pause_on_reply !== undefined) out.pause_on_reply = input.pause_on_reply !== false;
  if (input.auto_start !== undefined) out.auto_start = input.auto_start === true;
  if (input.shared !== undefined) out.shared = input.shared === true;
  if (!partial || input.trigger !== undefined) {
    const t = input.trigger || { type: 'manual' };
    const type = TRIGGER_TYPES.includes(t.type) ? t.type : null;
    if (!type) return { error: 'Pick when this plan starts.' };
    const trigger = { type };
    if (type === 'new_lead') {
      const sources = (Array.isArray(t.sources) ? t.sources : []).map((s) => String(s).toLowerCase()).filter((s) => LEAD_SOURCES[s]);
      trigger.sources = [...new Set(sources)];
    }
    if (type === 'stage') {
      const stage = String(t.stage || '').toLowerCase();
      if (!LIFECYCLE_STAGES.includes(stage)) return { error: 'Pick the stage that starts this plan.' };
      trigger.stage = stage;
    }
    if (type === 'tag') {
      const tag = normalizeTag(t.tag);
      if (!tag) return { error: 'Type the tag that starts this plan.' };
      trigger.tag = tag;
    }
    out.trigger = trigger;
  }
  if (!partial || input.steps !== undefined) {
    if (!Array.isArray(input.steps) || !input.steps.length) return { error: 'Add at least one step.' };
    if (input.steps.length > MAX_STEPS) return { error: `A plan can have up to ${MAX_STEPS} steps.` };
    const steps = [];
    for (const [i, s] of input.steps.entries()) {
      const n = i + 1;
      const type = STEP_TYPES.includes(s?.type) ? s.type : null;
      if (!type) return { error: `Step ${n}: pick email, text, task or wait.` };
      if (type === 'wait') {
        const days = Math.round(Number(s.days));
        if (!Number.isFinite(days) || days < 1 || days > MAX_WAIT_DAYS) return { error: `Step ${n}: wait between 1 and ${MAX_WAIT_DAYS} days.` };
        steps.push({ type, days });
      } else if (type === 'email') {
        const subject = cleanText(s.subject, 160);
        const body = cleanText(s.body, 5000);
        if (!subject || !body) return { error: `Step ${n}: an email needs a subject and a message.` };
        steps.push({ type, subject, body });
      } else if (type === 'text') {
        const body = cleanText(s.body, 480);
        if (!body) return { error: `Step ${n}: write the text.` };
        steps.push({ type, body });
      } else {
        const title = cleanText(s.title, 200);
        if (!title) return { error: `Step ${n}: say what the task is.` };
        const kind = TASK_KINDS.includes(s.task_kind) ? s.task_kind : 'follow_up';
        steps.push({ type, title, task_kind: kind });
      }
    }
    out.steps = steps;
  }
  return { fields: out };
}

export function normalizeTag(raw) {
  return String(raw ?? '').replace(/[\r\n,]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** "Email: Welcome", "Wait 3 days"… Pure. */
export function describeStep(step) {
  if (!step) return null;
  if (step.type === 'wait') return `Wait ${step.days} day${step.days === 1 ? '' : 's'}`;
  if (step.type === 'email') return `Email: ${step.subject}`;
  if (step.type === 'text') return `Text: ${step.body.length > 60 ? `${step.body.slice(0, 57)}…` : step.body}`;
  return `Task: ${step.title}`;
}

/** Total length of a plan in days. Pure. */
export const planDays = (steps = []) => steps.reduce((n, s) => n + (s.type === 'wait' ? s.days : 0), 0);

/** Fill {first_name}, {agent_name}… Unknown names are left as written. Pure. */
export function renderTemplate(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k] ?? '') : m));
}

export const TEMPLATE_FIELDS = ['first_name', 'agent_name', 'agent_first_name', 'agent_phone', 'brokerage', 'site_url', 'search_url', 'home_url'];

// ------------------------------------------------------------ starter plans

/** The plans every brokerage starts with (turned off until the owner switches them on). Pure. */
export function starterPlans() {
  return [
    {
      starter_key: 'new_online_buyer',
      name: 'New online buyer (14 days)',
      description: 'For someone who just signed up on your site. A quick hello, a call, and a few friendly check-ins over two weeks.',
      trigger: { type: 'new_lead', sources: ['website', 'zillow', 'realtor', 'homes', 'facebook', 'zapier', 'email'] },
      steps: [
        { type: 'text', body: 'Hi {first_name}, it’s {agent_first_name} with {brokerage}. Thanks for checking out homes with us! Did any catch your eye? Happy to set up a tour.' },
        { type: 'email', subject: 'Welcome, {first_name}', body: 'Hi {first_name},\n\nThanks for starting your home search with {brokerage}. I’m {agent_first_name}, and I’ll be your go-to person for anything you need: questions about a home, a neighborhood, or what you can afford.\n\nYou can keep searching any time here: {search_url}\n\nWhat’s on your must-have list? Just hit reply and tell me.' },
        { type: 'task', title: 'Call {first_name} to say hello', task_kind: 'call' },
        { type: 'wait', days: 2 },
        { type: 'email', subject: 'A few things that help buyers here', body: 'Hi {first_name},\n\nA few quick tips from what I see every week:\n\n1. Save a search so new homes reach you the day they list.\n2. Tap the heart on homes you like. It helps me spot what you love.\n3. If a home looks great, ask for a tour early. Good ones move fast.\n\nAnything I can look into for you?' },
        { type: 'wait', days: 3 },
        { type: 'text', body: 'Hi {first_name}, {agent_first_name} here. Seen anything you’d like to walk through this week?' },
        { type: 'wait', days: 4 },
        { type: 'task', title: 'Check in with {first_name}: still looking?', task_kind: 'follow_up' },
        { type: 'wait', days: 5 },
        { type: 'email', subject: 'Still looking, {first_name}?', body: 'Hi {first_name},\n\nJust checking in. Whether you’re ready to tour this weekend or just browsing for later, I’m happy to help at your pace.\n\nIf your plans changed, no problem at all. Reply and let me know what would be most useful.' },
      ],
    },
    {
      starter_key: 'new_seller',
      name: 'New seller lead',
      description: 'For a homeowner who asked what their home is worth. A fast call, a helpful email, and a follow-up.',
      trigger: { type: 'tag', tag: 'Seller' },
      steps: [
        { type: 'task', title: 'Call {first_name} about selling', task_kind: 'call' },
        { type: 'email', subject: 'Your home’s value', body: 'Hi {first_name},\n\nThanks for reaching out about your home. Online estimates are a starting point, but the real number depends on condition, updates and what’s selling right near you.\n\nI’d be glad to put together a short, no-pressure price opinion for you. When is a good time for a 15-minute call?' },
        { type: 'wait', days: 2 },
        { type: 'text', body: 'Hi {first_name}, it’s {agent_first_name} with {brokerage}. Want me to run the numbers on your home this week?' },
        { type: 'wait', days: 5 },
        { type: 'email', subject: 'What’s selling near you', body: 'Hi {first_name},\n\nHomes like yours are still getting attention. If you’re thinking about timing, I can show you what nearby homes sold for and how long they took.\n\nYou can also follow your home’s value here: {home_url}\n\nReply any time.' },
        { type: 'wait', days: 7 },
        { type: 'task', title: 'Follow up with {first_name} on selling plans', task_kind: 'follow_up' },
      ],
    },
    {
      starter_key: 'past_client',
      name: 'Past client after closing',
      description: 'Starts when a lead is marked Closed. A thank-you, a settling-in check, and a few touches through the first year.',
      trigger: { type: 'closed' },
      steps: [
        { type: 'wait', days: 1 },
        { type: 'email', subject: 'Congratulations, {first_name}!', body: 'Hi {first_name},\n\nCongratulations on your new home! It was a real pleasure working with you.\n\nIf anything comes up as you settle in (a contractor, a question about the house, anything at all), I’m one text away at {agent_phone}.' },
        { type: 'wait', days: 7 },
        { type: 'text', body: 'Hi {first_name}, {agent_first_name} here. How’s the new place? Anything you need a name for (plumber, painter, handyman)?' },
        { type: 'wait', days: 30 },
        { type: 'email', subject: 'A small favor', body: 'Hi {first_name},\n\nI hope the house is feeling like home. If you were happy with how things went, a short review or a referral to a friend means the world to a small business like ours.\n\nThank you again for trusting {brokerage}.' },
        { type: 'wait', days: 60 },
        { type: 'task', title: 'Call {first_name}: 90-day check-in', task_kind: 'call' },
        { type: 'wait', days: 90 },
        { type: 'email', subject: 'Six months in', body: 'Hi {first_name},\n\nIt’s been about six months since you moved in. If you’re curious what your home is worth today, you can see it here: {home_url}\n\nAlways here if you need anything.' },
      ],
    },
    {
      starter_key: 'gone_quiet',
      name: 'Gone quiet: re-engage',
      description: 'For a lead who hasn’t been active in a while. Add them by hand from the cockpit.',
      trigger: { type: 'manual' },
      steps: [
        { type: 'text', body: 'Hi {first_name}, it’s {agent_first_name} with {brokerage}. Are you still thinking about a move? No pressure, just checking in.' },
        { type: 'wait', days: 3 },
        { type: 'email', subject: 'Still on your radar?', body: 'Hi {first_name},\n\nIt’s been a little while, so I wanted to check in. The market has changed since you last looked, and there may be homes now that fit better.\n\nTake a fresh look here: {search_url}\n\nOr reply and tell me what you’re hoping to find. I’ll do the digging.' },
        { type: 'wait', days: 7 },
        { type: 'task', title: 'Call {first_name}: still looking?', task_kind: 'call' },
      ],
    },
  ];
}

/** Add the starter plans once per brokerage (an owner who deletes one doesn't get it back). */
export async function ensureStarterPlans(tenantId, pool = getPool()) {
  const { rows: [t] } = await pool.query("SELECT settings->>'plans_seeded' AS seeded FROM tenants WHERE id = $1", [tenantId]);
  if (!t || t.seeded === 'true') return false;
  for (const p of starterPlans()) {
    await pool.query(
      `INSERT INTO action_plans (tenant_id, owner_id, name, description, shared, trigger, auto_start, steps, starter_key)
       VALUES ($1, NULL, $2, $3, TRUE, $4::jsonb, FALSE, $5::jsonb, $6)
       ON CONFLICT (tenant_id, starter_key) WHERE starter_key IS NOT NULL DO NOTHING`,
      [tenantId, p.name, p.description, JSON.stringify(p.trigger), JSON.stringify(p.steps), p.starter_key]
    );
  }
  await pool.query(`UPDATE tenants SET settings = settings || '{"plans_seeded":"true"}'::jsonb WHERE id = $1`, [tenantId]);
  return true;
}

// ------------------------------------------------------------ who sees which plans

const isOwnerRole = (staff) => String(staff?.role || '') === 'admin';

/** SQL (alias p.) for the plans a staff member may see and use. */
export function visiblePlanSql(staff, params) {
  if (isOwnerRole(staff)) return 'TRUE';
  params.push(Number(staff?.id) || 0);
  return `(p.shared OR p.owner_id = $${params.length})`;
}

/** May this staff member change the plan? Owners: any. Agents: their own. */
export function canEditPlan(staff, plan) {
  if (isOwnerRole(staff)) return true;
  return !!plan && !plan.shared && Number(plan.owner_id) === Number(staff?.id);
}

export function shapePlan(p, staff = null) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    shared: p.shared,
    owner_id: p.owner_id,
    owner_name: p.owner_name || null,
    trigger: p.trigger,
    auto_start: p.auto_start,
    pause_on_reply: p.pause_on_reply,
    steps: p.steps,
    days: planDays(p.steps),
    starter: !!p.starter_key,
    active_runs: Number(p.active_runs || 0),
    can_edit: staff ? canEditPlan(staff, p) : false,
    updated_at: p.updated_at,
  };
}

export async function listPlans(tenantId, staff, pool = getPool()) {
  await ensureStarterPlans(tenantId, pool).catch((e) => logger.warn('starter plans failed', { message: e.message }));
  const params = [tenantId];
  const vis = visiblePlanSql(staff, params);
  const { rows } = await pool.query(
    `SELECT p.*, o.name AS owner_name,
            (SELECT COUNT(*)::int FROM action_plan_runs r WHERE r.plan_id = p.id AND r.status IN ('active', 'paused')) AS active_runs
     FROM action_plans p LEFT JOIN users o ON o.id = p.owner_id
     WHERE p.tenant_id = $1 AND p.archived_at IS NULL AND ${vis}
     ORDER BY p.shared DESC, p.starter_key IS NULL, p.name`,
    params
  );
  return rows.map((p) => shapePlan(p, staff));
}

export async function getPlan(tenantId, planId, staff, pool = getPool()) {
  const params = [tenantId, planId];
  const vis = visiblePlanSql(staff, params);
  const { rows: [p] } = await pool.query(
    `SELECT p.* FROM action_plans p WHERE p.tenant_id = $1 AND p.id = $2 AND p.archived_at IS NULL AND ${vis}`,
    params
  );
  return p || null;
}

// ------------------------------------------------------------ enrolling

/**
 * Put a lead on a plan. A lead is on a plan at most once at a time; adding
 * them again while they're on it does nothing. Returns { run, created }.
 */
export async function enrollLead({
  tenantId, planId, leadId, startedBy = null, reason = 'manual', now = planTransport.now(),
}, pool = getPool()) {
  const { rows: [lead] } = await pool.query(
    "SELECT id, status FROM users WHERE id = $1 AND tenant_id = $2 AND COALESCE(role, 'client') = 'client'",
    [leadId, tenantId]
  );
  if (!lead) return { error: 'not_found' };
  if (lead.status === 'unsubscribed') return { error: 'unsubscribed' };
  const { rows: [plan] } = await pool.query(
    'SELECT id, steps FROM action_plans WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL', [planId, tenantId]
  );
  if (!plan) return { error: 'plan_not_found' };
  const { rows: [run] } = await pool.query(
    `INSERT INTO action_plan_runs (tenant_id, plan_id, lead_id, status, step_index, next_at, started_by, start_reason, started_at)
     VALUES ($1, $2, $3, 'active', 0, $4, $5, $6, $4)
     ON CONFLICT (plan_id, lead_id) WHERE status IN ('active', 'paused') DO NOTHING
     RETURNING *`,
    [tenantId, plan.id, lead.id, now, startedBy, String(reason).slice(0, 40)]
  );
  if (!run) {
    const { rows: [existing] } = await pool.query(
      "SELECT * FROM action_plan_runs WHERE plan_id = $1 AND lead_id = $2 AND status IN ('active', 'paused')", [plan.id, lead.id]
    );
    return { run: existing, created: false };
  }
  await logStep(pool, run, { outcome: 'started', detail: reason === 'manual' ? 'Added to the plan' : `Started: ${TRIGGER_LABEL[reason] || reason}`, at: now });
  return { run, created: true };
}

const TRIGGER_LABEL = {
  new_lead: 'new lead', stage: 'stage changed', tag: 'tag added', closed: 'closed',
};

/**
 * Start every plan whose trigger matches, for plans set to start on their
 * own. A lead is never put on the same automatic plan twice.
 * event: { type: 'new_lead'|'stage'|'tag'|'closed', source?, stage?, tag? }
 */
export async function triggerPlans({ tenantId, leadId, event, now = planTransport.now() }, pool = getPool()) {
  try {
    if (!event?.type || !TRIGGER_TYPES.includes(event.type) || event.type === 'manual') return [];
    const { rows: [lead] } = await pool.query(
      "SELECT id, assigned_agent_id, status FROM users WHERE id = $1 AND tenant_id = $2 AND COALESCE(role, 'client') = 'client'",
      [leadId, tenantId]
    );
    if (!lead || lead.status === 'unsubscribed') return [];
    const { rows: plans } = await pool.query(
      `SELECT p.* FROM action_plans p
       WHERE p.tenant_id = $1 AND p.archived_at IS NULL AND p.auto_start = TRUE AND p.trigger->>'type' = $2
         AND (p.shared OR p.owner_id = $3)
         AND NOT EXISTS (SELECT 1 FROM action_plan_runs r WHERE r.plan_id = p.id AND r.lead_id = $4)
       ORDER BY p.id`,
      [tenantId, event.type, lead.assigned_agent_id || 0, lead.id]
    );
    const started = [];
    for (const p of plans) {
      const t = p.trigger || {};
      if (event.type === 'new_lead' && Array.isArray(t.sources) && t.sources.length && !t.sources.includes(String(event.source || ''))) continue;
      if (event.type === 'stage' && t.stage !== event.stage) continue;
      if (event.type === 'tag' && String(t.tag || '').toLowerCase() !== String(event.tag || '').toLowerCase()) continue;
      const r = await enrollLead({ tenantId, planId: p.id, leadId: lead.id, reason: event.type, now }, pool);
      if (r.created) started.push(r.run);
    }
    return started;
  } catch (e) {
    logger.warn('plan trigger failed', { message: e.message });
    return [];
  }
}

/** Stage changed in the cockpit: stop buyer plans on closed/lost, then start any matching plans. */
export async function onStageChanged({ tenantId, leadId, from = null, to, now = planTransport.now() }, pool = getPool()) {
  if (!to || to === from) return;
  if (to === 'closed' || to === 'lost') {
    const { rows } = await pool.query(
      `UPDATE action_plan_runs r SET status = 'stopped', ended_at = $3, end_reason = 'stage_changed', next_at = NULL
       FROM action_plans p
       WHERE p.id = r.plan_id AND r.lead_id = $1 AND r.tenant_id = $2 AND r.status IN ('active', 'paused')
         AND COALESCE(p.trigger->>'type', 'manual') <> 'closed'
       RETURNING r.*`,
      [leadId, tenantId, now]
    );
    for (const run of rows) await logStep(pool, run, { outcome: 'stopped', detail: `Stopped: marked ${to}`, at: now });
  }
  await triggerPlans({ tenantId, leadId, event: { type: 'stage', stage: to }, now }, pool);
  if (to === 'closed') await triggerPlans({ tenantId, leadId, event: { type: 'closed' }, now }, pool);
}

/** Tags were added to a lead: start plans waiting on those tags. */
export async function onTagsAdded({ tenantId, leadId, tags = [], now = planTransport.now() }, pool = getPool()) {
  for (const tag of tags) await triggerPlans({ tenantId, leadId, event: { type: 'tag', tag }, now }, pool);
}

/**
 * The lead replied or booked a tour: pause their plans (the ones set to
 * pause on reply). reason: 'replied' | 'tour'.
 */
export async function pauseForLead(leadId, reason, { now = planTransport.now() } = {}, pool = getPool()) {
  try {
    const { rows } = await pool.query(
      `UPDATE action_plan_runs r SET status = 'paused', paused_at = $3, pause_reason = $2, locked_until = NULL
       FROM action_plans p
       WHERE p.id = r.plan_id AND r.lead_id = $1 AND r.status = 'active' AND p.pause_on_reply = TRUE
       RETURNING r.*`,
      [leadId, reason, now]
    );
    for (const run of rows) {
      await logStep(pool, run, { outcome: 'paused', detail: reason === 'tour' ? 'Paused: they asked for a tour' : 'Paused: they replied', at: now });
    }
    return rows.length;
  } catch (e) {
    logger.warn('plan pause failed', { message: e.message });
    return 0;
  }
}

/** Events from recordEvent: tours pause plans; a website signup is a new lead. Never throws. */
export async function onPlanEvent(ev, pool = getPool()) {
  try {
    if (!ev?.user_id) return;
    if (ev.type === 'tour_request' || ev.type === 'showing_request') await pauseForLead(ev.user_id, 'tour', {}, pool);
    if (ev.type === 'signup') {
      const source = ev.meta?.via === 'market_report' ? 'home_value' : 'website';
      await triggerPlans({ tenantId: ev.tenant_id, leadId: ev.user_id, event: { type: 'new_lead', source } }, pool);
    }
  } catch (e) {
    logger.warn('plan event failed', { message: e.message });
  }
}

/** Pause, resume or stop one run (from the lead's Plans tab). */
export async function changeRun(runId, tenantId, action, { by = null, now = planTransport.now() } = {}, pool = getPool()) {
  const { rows: [run] } = await pool.query('SELECT * FROM action_plan_runs WHERE id = $1 AND tenant_id = $2', [runId, tenantId]);
  if (!run) return { error: 'not_found' };
  let updated = null;
  if (action === 'pause' && run.status === 'active') {
    ({ rows: [updated] } = await pool.query(
      "UPDATE action_plan_runs SET status = 'paused', paused_at = $2, pause_reason = 'by_agent', locked_until = NULL WHERE id = $1 RETURNING *", [run.id, now]
    ));
    await logStep(pool, run, { outcome: 'paused', detail: 'Paused by your team', at: now });
  } else if (action === 'resume' && run.status === 'paused') {
    // Waiting steps keep their day; anything overdue goes now.
    ({ rows: [updated] } = await pool.query(
      `UPDATE action_plan_runs SET status = 'active', paused_at = NULL, pause_reason = NULL,
              next_at = GREATEST(COALESCE(next_at, $2), $2)
       WHERE id = $1 RETURNING *`, [run.id, now]
    ));
    await logStep(pool, run, { outcome: 'resumed', detail: 'Resumed', at: now });
  } else if (action === 'stop' && ['active', 'paused'].includes(run.status)) {
    ({ rows: [updated] } = await pool.query(
      "UPDATE action_plan_runs SET status = 'stopped', ended_at = $2, end_reason = 'by_agent', next_at = NULL WHERE id = $1 RETURNING *", [run.id, now]
    ));
    await logStep(pool, run, { outcome: 'stopped', detail: 'Stopped by your team', at: now });
  } else {
    return { error: 'no_change', run };
  }
  return { run: updated, by };
}

/** Stop every plan for a lead (they unsubscribed). */
export async function stopAllForLead(leadId, reason, { now = planTransport.now() } = {}, pool = getPool()) {
  const { rows } = await pool.query(
    `UPDATE action_plan_runs SET status = 'stopped', ended_at = $3, end_reason = $2, next_at = NULL
     WHERE lead_id = $1 AND status IN ('active', 'paused') RETURNING *`,
    [leadId, reason, now]
  );
  for (const run of rows) await logStep(pool, run, { outcome: 'stopped', detail: reason === 'unsubscribed' ? 'Stopped: they unsubscribed' : 'Stopped', at: now });
  return rows.length;
}

async function logStep(pool, run, { stepIndex = null, stepType = null, outcome, detail = null, at = null }) {
  await pool.query(
    `INSERT INTO action_plan_log (tenant_id, run_id, lead_id, step_index, step_type, outcome, detail, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))`,
    [run.tenant_id, run.id, run.lead_id, stepIndex, stepType, outcome, detail ? String(detail).slice(0, 500) : null, at]
  ).catch((e) => logger.warn('plan log failed', { message: e.message }));
}

// ------------------------------------------------------------ the lead's view

const PAUSE_TEXT = { replied: 'They replied', tour: 'They asked for a tour', by_agent: 'Paused by your team' };
const END_TEXT = {
  done: 'Finished', by_agent: 'Stopped by your team', stage_changed: 'Stopped when the stage changed',
  unsubscribed: 'They unsubscribed', plan_removed: 'The plan was deleted',
};

/** Every plan a lead is or was on, with where they are and what happened. */
export async function leadPlans(leadId, tenantId, pool = getPool()) {
  const { rows } = await pool.query(
    `SELECT r.*, p.name, p.steps, p.archived_at FROM action_plan_runs r JOIN action_plans p ON p.id = r.plan_id
     WHERE r.lead_id = $1 AND r.tenant_id = $2 ORDER BY (r.status IN ('active', 'paused')) DESC, r.started_at DESC LIMIT 20`,
    [leadId, tenantId]
  );
  const ids = rows.map((r) => r.id);
  const log = ids.length ? (await pool.query(
    `SELECT run_id, step_index, step_type, outcome, detail, created_at FROM action_plan_log
     WHERE run_id = ANY($1::int[]) ORDER BY created_at DESC, id DESC LIMIT 200`, [ids]
  )).rows : [];
  return rows.map((r) => {
    const steps = r.steps || [];
    const next = ['active', 'paused'].includes(r.status) ? steps[r.step_index] : null;
    return {
      id: r.id,
      plan_id: r.plan_id,
      name: r.name,
      status: r.status,
      step: Math.min(r.step_index + 1, steps.length),
      steps_total: steps.length,
      steps: steps.map((s, i) => ({ index: i, label: describeStep(s), type: s.type, done: i < r.step_index })),
      next_step: next ? describeStep(next) : null,
      next_at: ['active', 'paused'].includes(r.status) ? r.next_at : null,
      started_at: r.started_at,
      pause_reason: r.pause_reason,
      pause_text: r.status === 'paused' ? PAUSE_TEXT[r.pause_reason] || 'Paused' : null,
      ended_at: r.ended_at,
      end_text: r.ended_at ? END_TEXT[r.end_reason] || 'Ended' : null,
      log: log.filter((l) => l.run_id === r.id).slice(0, 30),
    };
  });
}

// ------------------------------------------------------------ running steps

/** The next moment texts may go out (8am where the brokerage is). */
export function nextTextWindow(now, tz) {
  const start = Math.floor(now.getTime() / 3600000) * 3600000;
  for (let h = 1; h <= 26; h += 1) {
    const t = new Date(start + h * 3600000);
    if (!isTextingQuietHours(t, tz)) return new Date(t.getTime() + 60000);
  }
  return new Date(now.getTime() + 12 * 3600000);
}

async function senderFor(pool, lead, run, tenant) {
  const id = lead.assigned_agent_id || run.started_by;
  if (!id) return null;
  const { rows: [a] } = await pool.query(
    `SELECT id, name, email, phone, brand_name, brokerage_name, brand_phone, photo_url, voice_style FROM users
     WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin') AND status = 'active'`,
    [id, tenant.id]
  );
  return a || null;
}

/** Template values for one lead. Pure. */
export function templateVars({ lead, agent, tenant, site }) {
  const brand = brandFor(tenant);
  const agentName = agent?.name || brand.name;
  return {
    first_name: firstName(lead.name) || 'there',
    agent_name: agentName,
    agent_first_name: agent?.name ? firstName(agent.name) : brand.name,
    agent_phone: brandFor(tenant, agent ? { agent } : {}).phone || brand.phone || '',
    brokerage: brand.name,
    site_url: site,
    search_url: `${site}/properties/`,
    home_url: `${site}/my-home/`,
  };
}

/** A plan email in the brokerage's brand, with a way to stop. Pure. */
export function planEmailHtml({ body, brand, site, agent, unsubscribeUrl }) {
  const paras = String(body || '').split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#374151">${esc(p).replace(/\n/g, '<br/>')
      .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#111">${u}</a>`)}</p>`)
    .join('');
  const name = agent?.name || brand.name;
  const phone = agent?.phone || brand.phone;
  const signature = `<p style="margin:14px 0 0;font-size:14px;color:#111;line-height:1.5"><strong>${esc(name)}</strong>${phone ? `<br/><span style="color:#6b7280">${esc(phone)}</span>` : ''}${agent?.name ? `<br/><span style="color:#6b7280">${esc(brand.name)}</span>` : ''}</p>`;
  return emailShell({
    brand,
    site,
    kind: null,
    bodyHtml: `<tr><td style="padding:24px 24px 8px">${paras}${signature}</td></tr>`,
    unsubscribeUrl,
    reason: `You get this because you’re in touch with ${brand.name} about buying or selling a home.`,
    stopLabel: 'Unsubscribe from these emails',
  });
}

async function sendPlanEmail(pool, { tenant, lead, agent, subject, body, site }) {
  if (!lead.email || isPlaceholderEmail(lead.email)) return { ok: false, reason: 'no_email' };
  if (lead.status === 'unsubscribed') return { ok: false, reason: 'email_off' };
  const consents = await getConsents(lead.id, pool);
  if (consents.email?.status === 'revoked') return { ok: false, reason: 'email_off' };
  const brand = brandFor(tenant, isHomeTenant(tenant) || !agent ? {} : { agent });
  const unsubscribeUrl = `${site}/api/plans/unsubscribe?token=${encodeURIComponent(lead.manage_token || '')}`;
  const html = planEmailHtml({ body, brand, site, agent, unsubscribeUrl });
  const fromName = agent?.name ? `${agent.name}, ${brandFor(tenant).name}` : (brand.from_name || brand.name);
  const replyTo = tenant.settings?.inbound?.reply_to || agent?.email || undefined;
  const { rows: [msg] } = await pool.query(
    `INSERT INTO lead_messages (tenant_id, lead_id, agent_id, channel, direction, kind, to_addr, from_addr, subject, body, status)
     VALUES ($1, $2, $3, 'email', 'out', 'plan', $4, $5, $6, $7, 'queued') RETURNING id`,
    [tenant.id, lead.id, agent?.id || null, lead.email, agent?.email || null, subject, body]
  );
  try {
    if (planTransport.sendEmail) {
      await planTransport.sendEmail(lead.email, subject, html, fromName, { tenantId: tenant.id, replyTo });
      await pool.query("UPDATE lead_messages SET status = 'sent' WHERE id = $1", [msg.id]);
    } else {
      const emailer = await import('./emailer.js');
      if (emailer.smtpConfigured() || emailer.ownDomainSendingAvailable()) {
        await emailer.sendEmail(lead.email, subject, html, fromName, { tenantId: tenant.id, replyTo });
        await pool.query("UPDATE lead_messages SET status = 'sent' WHERE id = $1", [msg.id]);
      } else {
        await pool.query('INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)', [lead.email, subject, html, tenant.id]);
      }
    }
    return { ok: true };
  } catch (e) {
    await pool.query("UPDATE lead_messages SET status = 'failed', error = $2 WHERE id = $1", [msg.id, String(e.message).slice(0, 300)]);
    return { ok: false, reason: 'failed' };
  }
}

const SKIP_TEXT = {
  no_phone: 'no mobile number', no_consent: 'they haven’t agreed to texts', opted_out: 'they replied STOP',
  not_set_up: 'texting isn’t set up', no_number: 'texting isn’t set up', off: 'texting is off',
  no_email: 'no email address', email_off: 'they turned off emails', failed: 'it didn’t go through',
};

/**
 * Move one claimed run forward: do every step that is due, until a wait,
 * a text that has to wait for the morning, or the end.
 */
export async function advanceRun(run, { now = planTransport.now() } = {}, pool = getPool()) {
  const { rows: [plan] } = await pool.query('SELECT * FROM action_plans WHERE id = $1', [run.plan_id]);
  const finish = async (status, reason, detail) => {
    await pool.query(
      `UPDATE action_plan_runs SET status = $2, ended_at = $3, end_reason = $4, next_at = NULL, locked_until = NULL WHERE id = $1`,
      [run.id, status, now, reason]
    );
    await logStep(pool, run, { outcome: status === 'done' ? 'done' : 'stopped', detail, at: now });
    return { status };
  };
  if (!plan || plan.archived_at) return finish('stopped', 'plan_removed', 'Stopped: the plan was deleted');
  const { rows: [lead] } = await pool.query(
    'SELECT id, name, email, phone, status, assigned_agent_id, manage_token, tenant_id FROM users WHERE id = $1 AND tenant_id = $2',
    [run.lead_id, run.tenant_id]
  );
  if (!lead) return finish('stopped', 'gone', 'Stopped: the lead was removed');
  if (lead.status === 'unsubscribed') return finish('stopped', 'unsubscribed', 'Stopped: they unsubscribed');

  const tenant = await tenantById(run.tenant_id, { pool });
  const agent = await senderFor(pool, lead, run, tenant);
  const site = emailSiteUrl(tenant, siteUrlFor(tenant));
  const vars = templateVars({ lead, agent, tenant, site });
  const steps = plan.steps || [];
  let i = run.step_index;
  const done = [];

  while (i < steps.length) {
    const step = steps[i];
    const base = { stepIndex: i, stepType: step.type, at: now };
    if (step.type === 'wait') {
      i += 1;
      const next = new Date(now.getTime() + step.days * DAY_MS);
      await pool.query('UPDATE action_plan_runs SET step_index = $2, next_at = $3, locked_until = NULL WHERE id = $1', [run.id, i, next]);
      return { status: 'waiting', next_at: next, done };
    }
    if (step.type === 'text') {
      const r = await sendText({ tenant, leadId: lead.id, body: renderTemplate(step.body, vars), kind: 'plan', now }, pool);
      if (!r.ok && r.reason === 'quiet_hours') {
        const next = nextTextWindow(now, smsConfigFor(tenant).time_zone);
        await pool.query('UPDATE action_plan_runs SET step_index = $2, next_at = $3, locked_until = NULL WHERE id = $1', [run.id, i, next]);
        return { status: 'deferred', next_at: next, done };
      }
      await logStep(pool, run, { ...base, outcome: r.ok ? 'sent' : 'skipped', detail: r.ok ? describeStep(step) : `Text skipped: ${SKIP_TEXT[r.reason] || r.reason}` });
      done.push({ type: 'text', ok: r.ok, reason: r.reason || null });
    } else if (step.type === 'email') {
      const r = await sendPlanEmail(pool, {
        tenant, lead, agent, site, subject: renderTemplate(step.subject, vars), body: renderTemplate(step.body, vars),
      });
      await logStep(pool, run, { ...base, outcome: r.ok ? 'sent' : 'skipped', detail: r.ok ? describeStep({ ...step, subject: renderTemplate(step.subject, vars) }) : `Email skipped: ${SKIP_TEXT[r.reason] || r.reason}` });
      done.push({ type: 'email', ok: r.ok, reason: r.reason || null });
    } else if (step.type === 'task') {
      const title = renderTemplate(step.title, vars).slice(0, 255);
      const { rows: [task] } = await pool.query(
        `INSERT INTO lead_tasks (tenant_id, lead_id, assignee_id, created_by, title, kind, due_at)
         VALUES ($1, $2, $3, NULL, $4, $5, $6) RETURNING id`,
        [tenant.id, lead.id, lead.assigned_agent_id || run.started_by || null, title, step.task_kind || 'follow_up', now]
      );
      import('./crmService.js').then(({ syncTaskToFub }) => syncTaskToFub(task.id, pool)).catch(() => {});
      await logStep(pool, run, { ...base, outcome: 'created', detail: `Task: ${title}` });
      done.push({ type: 'task', ok: true });
    }
    i += 1;
    await pool.query('UPDATE action_plan_runs SET step_index = $2 WHERE id = $1', [run.id, i]);
  }
  await finish('done', 'done', 'Plan finished');
  return { status: 'done', done };
}

/** Run every plan step that is due. Returns counts. */
export async function runDuePlans({ now = planTransport.now(), pool = getPool(), limit = 200 } = {}) {
  const { rows } = await pool.query(
    `UPDATE action_plan_runs SET locked_until = $1::timestamptz + make_interval(mins => ${LOCK_MINUTES})
     WHERE id IN (SELECT id FROM action_plan_runs
                  WHERE status = 'active' AND next_at IS NOT NULL AND next_at <= $1
                    AND (locked_until IS NULL OR locked_until < $1)
                  ORDER BY next_at LIMIT $2 FOR UPDATE SKIP LOCKED)
     RETURNING *`,
    [now, limit]
  );
  const result = { runs: rows.length, done: 0, waiting: 0, deferred: 0, failed: 0 };
  for (const run of rows) {
    try {
      const r = await advanceRun(run, { now }, pool);
      if (r.status === 'done') result.done += 1;
      else if (r.status === 'deferred') result.deferred += 1;
      else result.waiting += 1;
    } catch (e) {
      result.failed += 1;
      logger.warn('plan run failed', { run_id: run.id, message: e.message });
      await pool.query(
        "UPDATE action_plan_runs SET locked_until = NULL, next_at = $2::timestamptz + INTERVAL '15 minutes' WHERE id = $1", [run.id, now]
      ).catch(() => {});
    }
  }
  return result;
}

// ------------------------------------------------------------ scheduler

let planTimer = null;
const PLAN_LOCK_KEY = 833714;

/** Every minute, one server at a time: move due plan steps forward. */
export function startActionPlanScheduler() {
  if (planTimer || process.env.ACTION_PLAN_SCHEDULER === 'off' || process.env.CRM_SCHEDULER === 'off') return;
  planTimer = setInterval(async () => {
    const pool = getPool();
    const client = await pool.connect().catch(() => null);
    if (!client) return;
    try {
      const { rows: [{ ok }] } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [PLAN_LOCK_KEY]);
      if (!ok) return;
      try {
        const r = await runDuePlans({ pool });
        if (r.runs) logger.info('action plan pass', r);
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [PLAN_LOCK_KEY]).catch(() => {});
      }
    } catch (e) {
      logger.warn('action plan pass failed', { message: e.message });
    } finally {
      client.release();
    }
  }, 60 * 1000);
  planTimer.unref?.();
}
