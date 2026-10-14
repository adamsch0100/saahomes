/**
 * Running a brokerage without Follow Up Boss: action plans, the team inbox,
 * lead tags, lead sources (intake), the CRM mode, and contacts in and out.
 *
 * Staff (/api/agent, agent or owner):
 *   GET    /plans                         plans this person may use (starter plans added once)
 *   POST   /plans                         { name, description?, trigger, steps, auto_start?, pause_on_reply?, shared? }
 *   PATCH  /plans/:id                     same fields (owner: any plan; agent: their own)
 *   DELETE /plans/:id                     removes the plan and stops it for everyone on it
 *   POST   /plans/:id/copy                a private copy to edit
 *   POST   /plans/runs/:id/:action        pause | resume | stop
 *   GET    /crm/leads/:id/plans           where this lead is in each plan
 *   POST   /crm/leads/:id/plans           { plan_id } add the lead to a plan
 *   PUT    /crm/leads/:id/tags            { tags: [] }
 *   GET    /inbox                         ?filter=open|mine|unassigned|done|all&q=
 *   GET    /inbox/counts
 *   GET    /inbox/:id                     the conversation (marks it read)
 *   POST   /inbox/:id/claim | /done | /reopen
 *   POST   /inbox/:id/assign              { agent_id | null }
 *   POST   /inbox/:id/reply               { channel: 'sms'|'email', body, subject? }
 *   POST   /inbox/:id/lead                add an unknown sender as a lead
 *   GET    /crm/mode                      { mode } for the console
 * Owner (/api/admin):
 *   GET    /crm/settings  PUT /crm/mode { mode: 'fub'|'own' }
 *   GET    /crm/export                    every contact as CSV
 *   POST   /crm/import/preview            CSV text (text/csv, or JSON { csv })
 *   POST   /crm/import                    CSV text + ?mapping= (or JSON { csv, mapping })
 *   GET    /intake  PATCH /intake  POST /intake/key  POST /intake/test
 * Public:
 *   POST   /api/inbound/email[/:key]      inbound email (key in path, ?key=, X-Intake-Key or basic auth)
 *   POST   /api/intake/:key/:source       zillow | realtor | homes | email | webhook | zapier | facebook
 *   GET    /api/intake/:key/facebook      Facebook's webhook check (hub.challenge)
 *   GET|POST /api/plans/unsubscribe       ?token= (one click from a plan email)
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  tenantIdOf, clearTenantCache, runWithTenant, siteUrlFor,
} from '../services/tenantContext.js';
import { visibleLeadSql } from './agentController.js';
import { brandFor, isHomeTenant } from '../services/brand.js';
import { crmModeOf, CRM_MODES } from '../services/crmMode.js';
import {
  listPlans, getPlan, normalizePlan, canEditPlan, shapePlan, enrollLead, changeRun, leadPlans, advanceRun,
  normalizeTag, onTagsAdded, stopAllForLead, LEAD_SOURCES, TEMPLATE_FIELDS, planTransport,
} from '../services/actionPlans.js';
import {
  listThreads, inboxCounts, visibleThread, threadMessages, markRead, assignThread, setThreadStatus, recordOutbound,
  normalizeInboundEmail, parseMultipartFields, recordInbound, pushStaff, staffToTell, INBOX_KINDS,
} from '../services/teamInbox.js';
import {
  ensureIntakeKey, rotateIntakeKey, tenantForKey, detectLeadSource, parseLeadEmail, parseWebhookLead, parseFacebookLead,
  verifyFacebookSignature, facebookSettings, fetchFacebookLead, ingestLead, intakeSettings, SOURCE_LABELS,
} from '../services/leadIntake.js';
import { exportContactsCsv, previewImport, importContactsCsv } from '../services/crmCsv.js';
import { sendText, SMS_REASON_TEXT, textCheck } from '../services/smsService.js';
import { sendLeadEmail } from '../services/replyDrafts.js';
import { recordConsent } from '../services/consent.js';

const posId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });
const isOwner = (req) => String(req.user?.role || '') === 'admin';

function wrap(name, fn) {
  return async (req, res) => {
    try {
      return await fn(req, res, getPool());
    } catch (error) {
      logger.error(`${name} error`, error);
      return fail(res, error.status || 500, error.status ? error.message : 'Something went wrong. Please try again.');
    }
  };
}

async function staffOf(req, pool) {
  const id = posId(req.user?.id);
  if (id) {
    const { rows: [s] } = await pool.query(
      'SELECT id, name, email, phone, role, tenant_id FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantIdOf(req)]
    );
    if (s) return { ...s, role: req.user?.role || s.role };
  }
  return { id: null, name: null, email: req.user?.email || null, role: req.user?.role || 'admin', tenant_id: tenantIdOf(req) };
}

async function visibleLead(req, leadId, pool) {
  const params = [leadId];
  const { rows: [lead] } = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.tags, u.tenant_id, u.assigned_agent_id, u.status FROM users u
     WHERE u.id = $1 AND COALESCE(u.role, 'client') = 'client' AND ${visibleLeadSql(req, params, 'u.')}`,
    params
  );
  return lead || null;
}

// ------------------------------------------------------------ plans

/** GET /api/agent/plans */
export const getPlans = wrap('getPlans', async (req, res, pool) => {
  const me = await staffOf(req, pool);
  const plans = await listPlans(tenantIdOf(req), me, pool);
  const { rows: team } = await pool.query(
    "SELECT id, name FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin') AND status = 'active' ORDER BY name", [tenantIdOf(req)]
  );
  return res.json({
    success: true,
    data: {
      plans,
      sources: LEAD_SOURCES,
      fields: TEMPLATE_FIELDS,
      can_share: isOwner(req),
      team,
    },
  });
});

/** POST /api/agent/plans */
export const createPlan = wrap('createPlan', async (req, res, pool) => {
  const parsed = normalizePlan(req.body || {});
  if (parsed.error) return fail(res, 400, parsed.error);
  const me = await staffOf(req, pool);
  const f = parsed.fields;
  // Owners' plans are the team's; an agent's plan is theirs.
  const shared = isOwner(req) ? f.shared !== false : false;
  const { rows: [p] } = await pool.query(
    `INSERT INTO action_plans (tenant_id, owner_id, name, description, shared, trigger, auto_start, pause_on_reply, steps)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb) RETURNING *`,
    [tenantIdOf(req), me.id, f.name, f.description || null, shared, JSON.stringify(f.trigger), f.auto_start === true,
      f.pause_on_reply !== false, JSON.stringify(f.steps)]
  );
  return res.status(201).json({ success: true, data: shapePlan(p, me) });
});

/** PATCH /api/agent/plans/:id */
export const updatePlan = wrap('updatePlan', async (req, res, pool) => {
  const me = await staffOf(req, pool);
  const plan = await getPlan(tenantIdOf(req), posId(req.params.id), me, pool);
  if (!plan) return fail(res, 404, 'Plan not found');
  if (!canEditPlan(me, plan)) return fail(res, 403, 'Only the owner can change a team plan. Make a copy to change it for yourself.');
  const parsed = normalizePlan(req.body || {}, { partial: true });
  if (parsed.error) return fail(res, 400, parsed.error);
  const f = parsed.fields;
  if (!isOwner(req)) delete f.shared;
  const sets = ['updated_at = NOW()'];
  const vals = [plan.id];
  const add = (col, v, cast = '') => { vals.push(v); sets.push(`${col} = $${vals.length}${cast}`); };
  if (f.name !== undefined) add('name', f.name);
  if (f.description !== undefined) add('description', f.description);
  if (f.shared !== undefined) add('shared', f.shared);
  if (f.trigger !== undefined) add('trigger', JSON.stringify(f.trigger), '::jsonb');
  if (f.auto_start !== undefined) add('auto_start', f.auto_start);
  if (f.pause_on_reply !== undefined) add('pause_on_reply', f.pause_on_reply);
  if (f.steps !== undefined) add('steps', JSON.stringify(f.steps), '::jsonb');
  const { rows: [p] } = await pool.query(`UPDATE action_plans SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals);
  return res.json({ success: true, data: shapePlan(p, me) });
});

/** DELETE /api/agent/plans/:id */
export const deletePlan = wrap('deletePlan', async (req, res, pool) => {
  const me = await staffOf(req, pool);
  const plan = await getPlan(tenantIdOf(req), posId(req.params.id), me, pool);
  if (!plan) return fail(res, 404, 'Plan not found');
  if (!canEditPlan(me, plan)) return fail(res, 403, 'Only the owner can delete a team plan.');
  await pool.query('UPDATE action_plans SET archived_at = NOW(), auto_start = FALSE WHERE id = $1', [plan.id]);
  const { rowCount } = await pool.query(
    `UPDATE action_plan_runs SET status = 'stopped', ended_at = NOW(), end_reason = 'plan_removed', next_at = NULL
     WHERE plan_id = $1 AND status IN ('active', 'paused')`, [plan.id]
  );
  return res.json({ success: true, data: { stopped: rowCount } });
});

/** POST /api/agent/plans/:id/copy */
export const copyPlan = wrap('copyPlan', async (req, res, pool) => {
  const me = await staffOf(req, pool);
  const plan = await getPlan(tenantIdOf(req), posId(req.params.id), me, pool);
  if (!plan) return fail(res, 404, 'Plan not found');
  const { rows: [p] } = await pool.query(
    `INSERT INTO action_plans (tenant_id, owner_id, name, description, shared, trigger, auto_start, pause_on_reply, steps)
     VALUES ($1, $2, $3, $4, FALSE, $5::jsonb, FALSE, $6, $7::jsonb) RETURNING *`,
    [plan.tenant_id, me.id, `${plan.name} (copy)`.slice(0, 120), plan.description, JSON.stringify(plan.trigger), plan.pause_on_reply, JSON.stringify(plan.steps)]
  );
  return res.status(201).json({ success: true, data: shapePlan(p, me) });
});

/** POST /api/agent/plans/runs/:id/:action */
export const changePlanRun = wrap('changePlanRun', async (req, res, pool) => {
  const action = String(req.params.action || '');
  if (!['pause', 'resume', 'stop'].includes(action)) return fail(res, 400, 'Pause, resume or stop');
  const params = [posId(req.params.id)];
  const { rows: [run] } = await pool.query(
    `SELECT r.id, r.tenant_id FROM action_plan_runs r JOIN users u ON u.id = r.lead_id
     WHERE r.id = $1 AND r.tenant_id = u.tenant_id AND ${visibleLeadSql(req, params, 'u.')}`,
    params
  );
  if (!run) return fail(res, 404, 'Not found');
  const me = await staffOf(req, pool);
  const r = await changeRun(run.id, run.tenant_id, action, { by: me.id }, pool);
  if (r.error === 'no_change') return fail(res, 409, 'That plan is not in a state to do that.');
  if (action === 'resume') kick(r.run, pool);
  return res.json({ success: true, data: { id: run.id, status: r.run.status } });
});

/** Run a lead's first due steps right away (not waiting for the next scheduler minute). */
function kick(run, pool) {
  if (!run || run.status !== 'active' || !run.next_at || new Date(run.next_at) > planTransport.now()) return;
  if (process.env.ACTION_PLAN_KICK === 'off') return;
  setImmediate(async () => {
    try {
      const { rows: [claimed] } = await pool.query(
        `UPDATE action_plan_runs SET locked_until = NOW() + INTERVAL '5 minutes'
         WHERE id = $1 AND status = 'active' AND (locked_until IS NULL OR locked_until < NOW()) RETURNING *`, [run.id]
      );
      if (claimed) await advanceRun(claimed, {}, pool);
    } catch (e) {
      logger.warn('plan kick failed', { message: e.message });
    }
  });
}

/** GET /api/agent/crm/leads/:id/plans */
export const getLeadPlans = wrap('getLeadPlans', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const me = await staffOf(req, pool);
  const [runs, plans] = await Promise.all([leadPlans(lead.id, tenantIdOf(req), pool), listPlans(tenantIdOf(req), me, pool)]);
  return res.json({
    success: true,
    data: { runs, plans: plans.map((p) => ({ id: p.id, name: p.name, days: p.days, steps: p.steps.length, shared: p.shared })) },
  });
});

/** POST /api/agent/crm/leads/:id/plans { plan_id } */
export const addLeadToPlan = wrap('addLeadToPlan', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const me = await staffOf(req, pool);
  const plan = await getPlan(tenantIdOf(req), posId(req.body?.plan_id), me, pool);
  if (!plan) return fail(res, 404, 'Plan not found');
  const r = await enrollLead({ tenantId: tenantIdOf(req), planId: plan.id, leadId: lead.id, startedBy: me.id, reason: 'manual' }, pool);
  if (r.error === 'unsubscribed') return fail(res, 422, 'This person unsubscribed, so they can’t be added to a plan.');
  if (r.error) return fail(res, 404, 'Could not add them to that plan');
  if (!r.created) return fail(res, 409, 'They’re already on this plan.');
  kick(r.run, pool);
  return res.status(201).json({ success: true, data: { id: r.run.id, status: r.run.status } });
});

/** PUT /api/agent/crm/leads/:id/tags { tags } */
export const setLeadTags = wrap('setLeadTags', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  if (!Array.isArray(req.body?.tags)) return fail(res, 400, 'Send the list of tags');
  const seen = new Set();
  const tags = [];
  for (const t of req.body.tags.map(normalizeTag).filter(Boolean)) {
    if (!seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); tags.push(t); }
  }
  if (tags.length > 30) return fail(res, 400, 'Up to 30 tags per person');
  const before = new Set((lead.tags || []).map((t) => t.toLowerCase()));
  await pool.query('UPDATE users SET tags = $2 WHERE id = $1', [lead.id, tags]);
  const added = tags.filter((t) => !before.has(t.toLowerCase()));
  if (added.length) await onTagsAdded({ tenantId: lead.tenant_id, leadId: lead.id, tags: added }, pool);
  return res.json({ success: true, data: { tags } });
});

/** GET /api/agent/crm/mode */
export const getCrmModeForStaff = wrap('getCrmModeForStaff', async (req, res) => res.json({
  success: true, data: { mode: crmModeOf(req.tenant) },
}));

// ------------------------------------------------------------ inbox

/** GET /api/agent/inbox */
export const getInbox = wrap('getInbox', async (req, res, pool) => {
  const filter = String(req.query.filter || 'open');
  const [threads, counts] = await Promise.all([
    listThreads(req, { filter, q: req.query.q || '', limit: req.query.limit || 60 }, pool),
    inboxCounts(req, pool),
  ]);
  return res.json({ success: true, data: { threads, counts, kinds: INBOX_KINDS } });
});

/** GET /api/agent/inbox/counts */
export const getInboxCounts = wrap('getInboxCounts', async (req, res, pool) => res.json({ success: true, data: await inboxCounts(req, pool) }));

async function threadPayload(req, thread, pool) {
  const messages = await threadMessages(thread, pool);
  let texting = null;
  if (thread.lead_id) {
    const check = await textCheck({ tenant: req.tenant, lead: { id: thread.lead_id, phone: thread.lead_phone } }, pool);
    texting = { can_text: check.ok, reason: check.reason, message: check.reason ? SMS_REASON_TEXT[check.reason] : null };
  }
  const email = thread.lead_email && !/\.invalid$/i.test(thread.lead_email) ? thread.lead_email : null;
  const lastEmail = [...messages].reverse().find((m) => m.kind === 'email' && m.subject);
  return {
    id: thread.id,
    lead_id: thread.lead_id,
    name: thread.lead_name || thread.contact_name || email || thread.contact_key,
    email: email || (String(thread.contact_key || '').includes('@') ? thread.contact_key : null),
    phone: thread.lead_phone || (/^\+?\d{10,15}$/.test(String(thread.contact_key || '')) ? thread.contact_key : null),
    stage: thread.lifecycle_stage || null,
    status: thread.status,
    assignee_id: thread.assignee_id,
    assignee_name: thread.assignee_name || null,
    can_email: !!email,
    texting,
    reply_subject: lastEmail ? (/^re:/i.test(lastEmail.subject) ? lastEmail.subject : `Re: ${lastEmail.subject}`) : null,
    messages,
  };
}

/** GET /api/agent/inbox/:id */
export const getInboxThread = wrap('getInboxThread', async (req, res, pool) => {
  const thread = await visibleThread(req, posId(req.params.id), pool);
  if (!thread) return fail(res, 404, 'Conversation not found');
  await markRead(thread.id, thread.tenant_id, posId(req.user?.id), pool);
  return res.json({ success: true, data: await threadPayload(req, thread, pool) });
});

async function teammate(req, id, pool) {
  if (id == null) return null;
  const { rows: [a] } = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin') AND status = 'active'", [id, tenantIdOf(req)]
  );
  return a ? a.id : 'invalid';
}

/** POST /api/agent/inbox/:id/:action — claim | assign | done | reopen */
export const actOnThread = wrap('actOnThread', async (req, res, pool) => {
  const thread = await visibleThread(req, posId(req.params.id), pool);
  if (!thread) return fail(res, 404, 'Conversation not found');
  const me = await staffOf(req, pool);
  const action = String(req.params.action || '');
  if (action === 'claim') {
    if (!me.id) return fail(res, 400, 'Sign in with your own account to claim a conversation');
    if (thread.assignee_id && thread.assignee_id !== me.id && !isOwner(req)) return fail(res, 409, `${thread.assignee_name || 'A teammate'} already has this one.`);
    await assignThread(thread, me.id, { by: me.id, byRole: req.user?.role }, pool);
  } else if (action === 'assign') {
    const raw = req.body?.agent_id;
    const id = raw === null || raw === '' ? null : await teammate(req, posId(raw), pool);
    if (id === 'invalid') return fail(res, 400, 'Pick someone on your team');
    await assignThread(thread, id, { by: me.id, byRole: req.user?.role }, pool);
  } else if (action === 'done' || action === 'reopen') {
    await setThreadStatus(thread, action === 'done' ? 'done' : 'open', me.id, pool);
  } else {
    return fail(res, 400, 'Unknown action');
  }
  const fresh = await visibleThread(req, thread.id, pool);
  return res.json({ success: true, data: fresh ? await threadPayload(req, fresh, pool) : { id: thread.id, hidden: true } });
});

/** POST /api/agent/inbox/:id/reply { channel, body, subject? } */
export const replyInThread = wrap('replyInThread', async (req, res, pool) => {
  const thread = await visibleThread(req, posId(req.params.id), pool);
  if (!thread) return fail(res, 404, 'Conversation not found');
  if (!thread.lead_id) return fail(res, 422, 'Add this person as a lead first, then reply.');
  const me = await staffOf(req, pool);
  const channel = req.body?.channel === 'email' ? 'email' : 'sms';
  const body = String(req.body?.body || '').trim();
  if (!body) return fail(res, 400, 'Write a message first.');
  let r;
  if (channel === 'sms') {
    r = await sendText({ tenant: req.tenant, leadId: thread.lead_id, body, agentId: me.id }, pool);
    if (!r.ok) return fail(res, r.reason === 'failed' ? 502 : 422, SMS_REASON_TEXT[r.reason] || 'Could not send', { reason: r.reason });
  } else {
    r = await sendLeadEmail({ tenant: req.tenant, leadId: thread.lead_id, agent: me, subject: req.body?.subject, body }, pool);
    if (!r.ok) {
      const text = { no_email: 'There’s no email address for this person.', email_off: 'This person turned off emails from you.', failed: 'The email didn’t go through. Try again in a moment.' };
      return fail(res, r.reason === 'failed' ? 502 : 422, text[r.reason] || 'Could not send', { reason: r.reason });
    }
  }
  await recordOutbound(thread, {
    kind: channel === 'sms' ? 'text' : 'email', body, subject: channel === 'email' ? (req.body?.subject || null) : null, leadMessageId: r.message?.id || null, agentId: me.id,
  }, pool);
  await markRead(thread.id, thread.tenant_id, me.id, pool);
  const fresh = await visibleThread(req, thread.id, pool);
  return res.status(201).json({ success: true, data: await threadPayload(req, fresh || thread, pool) });
});

/** POST /api/agent/inbox/:id/lead — someone we don't know wrote in: make them a lead. */
export const threadToLead = wrap('threadToLead', async (req, res, pool) => {
  const thread = await visibleThread(req, posId(req.params.id), pool);
  if (!thread) return fail(res, 404, 'Conversation not found');
  if (thread.lead_id) return res.json({ success: true, data: { lead_id: thread.lead_id } });
  const me = await staffOf(req, pool);
  const key = String(thread.contact_key || '');
  const isEmail = key.includes('@');
  const items = (await pool.query('SELECT kind, meta FROM inbox_items WHERE thread_id = $1 ORDER BY created_at LIMIT 1', [thread.id])).rows;
  const meta = items[0]?.meta || {};
  const r = await ingestLead(req.tenant, {
    name: thread.contact_name, email: isEmail ? key : (meta.email || null), phone: isEmail ? (meta.phone || null) : key,
  }, String(meta.source || (isEmail ? 'email' : 'contact')), { inboxKind: 'lead', agentId: me.id || null, pool });
  if (!r.ok) return fail(res, 422, r.error === 'staff_email' ? 'That address belongs to someone on your team.' : 'We need an email or phone number to add them.');
  // Fold this conversation into the lead's thread.
  const { rows: [leadThread] } = await pool.query(
    'SELECT id FROM inbox_threads WHERE tenant_id = $1 AND lead_id = $2', [thread.tenant_id, r.lead_id]
  );
  await pool.query(
    `UPDATE lead_messages SET lead_id = $1 WHERE tenant_id = $3 AND lead_id IS NULL
       AND id IN (SELECT lead_message_id FROM inbox_items WHERE thread_id = $2 AND lead_message_id IS NOT NULL)`,
    [r.lead_id, thread.id, thread.tenant_id]
  );
  if (leadThread && leadThread.id !== thread.id) {
    await pool.query('UPDATE inbox_items SET thread_id = $1 WHERE thread_id = $2', [leadThread.id, thread.id]);
    await pool.query('DELETE FROM inbox_threads WHERE id = $1', [thread.id]);
  } else {
    await pool.query('UPDATE inbox_threads SET lead_id = $2, contact_key = NULL WHERE id = $1', [thread.id, r.lead_id]);
  }
  return res.status(201).json({ success: true, data: { lead_id: r.lead_id, thread_id: leadThread?.id || thread.id, created: r.created } });
});

// ------------------------------------------------------------ CRM mode, export, import (owner)

/** GET /api/admin/crm/settings */
export const getCrmSettings = wrap('getCrmSettings', async (req, res, pool) => {
  const t = req.tenant;
  const s = t?.settings || {};
  const fubConnected = isHomeTenant(t) ? !!(process.env.FOLLOW_UP_BOSS_API_KEY || process.env.FOLLOW_UP_BOSS_WEBHOOK_URL) : !!s.fub_api_key;
  const { rows: [c] } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM users WHERE tenant_id = $1 AND COALESCE(role, 'client') = 'client') AS contacts,
            (SELECT COUNT(*)::int FROM lead_notes WHERE tenant_id = $1 AND deleted_at IS NULL) AS notes,
            (SELECT COUNT(*)::int FROM lead_tasks WHERE tenant_id = $1 AND done_at IS NULL) AS open_tasks,
            (SELECT COUNT(*)::int FROM action_plan_runs WHERE tenant_id = $1 AND status IN ('active', 'paused')) AS on_plans`,
    [tenantIdOf(req)]
  );
  return res.json({
    success: true,
    data: { mode: crmModeOf(t), fub_connected: fubConnected, fub_managed_by_platform: isHomeTenant(t), counts: c },
  });
});

/** PUT /api/admin/crm/mode { mode } */
export const setCrmMode = wrap('setCrmMode', async (req, res, pool) => {
  const mode = String(req.body?.mode || '');
  if (!CRM_MODES.includes(mode)) return fail(res, 400, 'Pick Follow Up Boss or the cockpit');
  await pool.query(
    `UPDATE tenants SET settings = settings || jsonb_build_object('crm_mode', $2::text, 'crm_mode_changed_at', NOW()::text) WHERE id = $1`,
    [tenantIdOf(req), mode]
  );
  clearTenantCache();
  logger.info('crm mode changed', { tenant_id: tenantIdOf(req), mode, by: req.user?.email || null });
  // Back on Follow Up Boss: register its new-contact webhook again if a key is saved.
  if (mode === 'fub' && !isHomeTenant(req.tenant)) {
    import('../services/fubAutomation.js').then(({ syncFubWebhook }) => syncFubWebhook(tenantIdOf(req))).catch(() => {});
  }
  return res.json({ success: true, data: { mode } });
});

/** GET /api/admin/crm/export */
export const exportContacts = wrap('exportContacts', async (req, res, pool) => {
  const { csv } = await exportContactsCsv(tenantIdOf(req), pool);
  const name = String(req.tenant?.slug || 'contacts').replace(/[^a-z0-9-]/gi, '') || 'contacts';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-contacts-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(`﻿${csv}`);
});

const csvText = (req) => (typeof req.body === 'string' ? req.body : String(req.body?.csv || ''));

/** POST /api/admin/crm/import/preview */
export const previewContactsImport = wrap('previewContactsImport', async (req, res) => {
  const text = csvText(req);
  if (!text.trim()) return fail(res, 400, 'Choose a CSV file first.');
  const p = previewImport(text);
  if (p.error) return fail(res, 400, p.error);
  return res.json({ success: true, data: p });
});

/** POST /api/admin/crm/import */
export const importContacts = wrap('importContacts', async (req, res, pool) => {
  const text = csvText(req);
  if (!text.trim()) return fail(res, 400, 'Choose a CSV file first.');
  let mapping = typeof req.body === 'object' && req.body?.mapping ? req.body.mapping : null;
  if (!mapping && req.query.mapping) {
    try { mapping = JSON.parse(String(req.query.mapping)); } catch { return fail(res, 400, 'That column mapping didn’t come through. Try again.'); }
  }
  const me = await staffOf(req, pool);
  const r = await importContactsCsv(tenantIdOf(req), text, mapping || {}, { importedBy: me.id }, pool);
  if (r.error) return fail(res, 400, r.error);
  logger.info('contacts imported', { tenant_id: tenantIdOf(req), created: r.created, updated: r.updated, skipped: r.skipped });
  return res.json({ success: true, data: r });
});

// ------------------------------------------------------------ lead sources (owner)

const facebookVerifyToken = (tenant, key) => facebookSettings(tenant).verify_token
  || crypto.createHash('sha256').update(`fb-verify:${key}`).digest('hex').slice(0, 24);

async function intakePayload(req, pool) {
  const tenant = req.tenant;
  const key = await ensureIntakeKey(tenant.id, pool);
  clearTenantCache();
  const fresh = await (await import('../services/tenantContext.js')).tenantById(tenant.id, { pool });
  const base = `${siteUrlFor(fresh)}/api`;
  const cfg = intakeSettings(fresh);
  const fb = facebookSettings(fresh);
  const { rows: log } = await pool.query(
    `SELECT l.id, l.source, l.outcome, l.summary, l.error, l.created_at, l.lead_id, a.name AS agent_name
     FROM lead_intake_log l LEFT JOIN users a ON a.id = l.assigned_agent_id
     WHERE l.tenant_id = $1 ORDER BY l.id DESC LIMIT 15`, [tenant.id]
  );
  const { rows: team } = await pool.query(
    "SELECT id, name, role FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin') AND status = 'active' ORDER BY name", [tenant.id]
  );
  return {
    key,
    endpoints: {
      email: `${base}/intake/${key}/email`,
      zillow: `${base}/intake/${key}/zillow`,
      realtor: `${base}/intake/${key}/realtor`,
      homes: `${base}/intake/${key}/homes`,
      webhook: `${base}/intake/${key}/webhook`,
      zapier: `${base}/intake/${key}/zapier`,
      facebook: `${base}/intake/${key}/facebook`,
      inbound_email: `${base}/inbound/email/${key}`,
    },
    facebook: {
      verify_token: facebookVerifyToken(fresh, key),
      page_token_set: !!fb.page_token,
      app_secret_set: !!fb.app_secret,
    },
    inbound: { reply_to: fresh.settings?.inbound?.reply_to || null },
    routing: cfg,
    sources: SOURCE_LABELS,
    team,
    recent: log,
  };
}

/** GET /api/admin/intake */
export const getIntake = wrap('getIntake', async (req, res, pool) => res.json({ success: true, data: await intakePayload(req, pool) }));

/** PATCH /api/admin/intake { routing?, facebook?, inbound? } */
export const patchIntake = wrap('patchIntake', async (req, res, pool) => {
  const b = req.body || {};
  const current = req.tenant.settings?.intake || {};
  const next = { ...current };
  const { rows: team } = await pool.query(
    "SELECT id FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin') AND status = 'active'", [tenantIdOf(req)]
  );
  const onTeam = new Set(team.map((t) => t.id));
  if (b.routing !== undefined) {
    const r = b.routing || {};
    const rules = [];
    for (const rule of Array.isArray(r.rules) ? r.rules.slice(0, 25) : []) {
      const agentId = posId(rule.agent_id);
      if (!agentId || !onTeam.has(agentId)) return fail(res, 400, 'Each rule needs someone on your team.');
      const out = {
        source: SOURCE_LABELS[String(rule.source || '').toLowerCase()] ? String(rule.source).toLowerCase() : '',
        city: String(rule.city || '').trim().slice(0, 60),
        min_price: Number(rule.min_price) > 0 ? Math.round(Number(rule.min_price)) : null,
        max_price: Number(rule.max_price) > 0 ? Math.round(Number(rule.max_price)) : null,
        agent_id: agentId,
      };
      if (!out.source && !out.city && !out.min_price && !out.max_price) return fail(res, 400, 'Each rule needs a source, a city or a price.');
      rules.push(out);
    }
    next.routing = {
      mode: r.mode === 'pool' ? 'pool' : 'round_robin',
      rules,
      rotation: (Array.isArray(r.rotation) ? r.rotation : []).map(posId).filter((id) => id && onTeam.has(id)),
    };
  }
  if (b.facebook !== undefined) {
    const fb = { ...(current.facebook || {}) };
    for (const k of ['page_token', 'app_secret', 'verify_token']) {
      if (b.facebook?.[k] !== undefined) {
        const v = String(b.facebook[k] || '').trim().slice(0, 400);
        if (v) fb[k] = v; else delete fb[k];
      }
    }
    next.facebook = fb;
  }
  const patch = { intake: next };
  if (b.inbound !== undefined) {
    const addr = String(b.inbound?.reply_to || '').trim().toLowerCase();
    if (addr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return fail(res, 400, 'That reply-to address doesn’t look right.');
    patch.inbound = { ...(req.tenant.settings?.inbound || {}), reply_to: addr || null };
  }
  await pool.query('UPDATE tenants SET settings = settings || $2::jsonb WHERE id = $1', [tenantIdOf(req), JSON.stringify(patch)]);
  clearTenantCache();
  req.tenant = await (await import('../services/tenantContext.js')).tenantById(tenantIdOf(req), { pool });
  return res.json({ success: true, data: await intakePayload(req, pool) });
});

/** POST /api/admin/intake/key — a new key (the old links stop working). */
export const newIntakeKey = wrap('newIntakeKey', async (req, res, pool) => {
  await rotateIntakeKey(tenantIdOf(req), pool);
  req.tenant = await (await import('../services/tenantContext.js')).tenantById(tenantIdOf(req), { pool });
  return res.json({ success: true, data: await intakePayload(req, pool) });
});

/** POST /api/admin/intake/test { subject?, text } — what we'd read from a lead email; nothing is saved. */
export const testIntake = wrap('testIntake', async (req, res) => {
  const text = String(req.body?.text || '').slice(0, 50000);
  if (!text.trim()) return fail(res, 400, 'Paste a lead email first.');
  const subject = String(req.body?.subject || '').slice(0, 300);
  const source = detectLeadSource({ fromEmail: req.body?.from || '', text, subject }) || 'email';
  return res.json({ success: true, data: { source, source_label: SOURCE_LABELS[source], lead: parseLeadEmail({ subject, text, fromEmail: req.body?.from || '' }) } });
});

// ------------------------------------------------------------ public: inbound email + intake

/** Body of a public intake request, whatever the parser left (JSON, form, multipart, raw). */
function bodyOf(req) {
  if (Buffer.isBuffer(req.body)) {
    const type = String(req.get('content-type') || '');
    if (/multipart\/form-data/i.test(type)) return parseMultipartFields(req.body, type);
    const text = req.body.toString('utf8');
    if (/json/i.test(type) || /^\s*[{[]/.test(text)) {
      try { return JSON.parse(text); } catch { return {}; }
    }
    if (/x-www-form-urlencoded/i.test(type)) return Object.fromEntries(new URLSearchParams(text));
    return { text };
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function keyFromRequest(req) {
  if (req.params.key) return req.params.key;
  if (req.query.key) return String(req.query.key);
  const header = req.get('x-intake-key');
  if (header) return header;
  const auth = String(req.get('authorization') || '');
  const m = /^Basic\s+(.+)$/i.exec(auth);
  if (m) {
    const [user, pass] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
    return pass || user;
  }
  return null;
}

async function intakeFromEmail(tenant, mail, source, pool) {
  const parsed = parseLeadEmail({ subject: mail.subject, text: mail.text, fromEmail: mail.from.email, replyTo: mail.reply_to });
  return ingestLead(tenant, parsed, source, { pool });
}

/** POST /api/inbound/email[/:key] */
export const inboundEmail = async (req, res) => {
  const pool = getPool();
  try {
    const tenant = await tenantForKey(keyFromRequest(req), pool);
    if (!tenant) return res.status(401).json({ ok: false, error: 'Unknown key' });
    const mail = normalizeInboundEmail(bodyOf(req));
    if (!mail.from.email) return res.status(202).json({ ok: false, error: 'No sender' });
    return await runWithTenant(tenant, async () => {
      const source = detectLeadSource({ fromEmail: mail.from.email, text: mail.text, subject: mail.subject });
      if (source) {
        const r = await intakeFromEmail(tenant, mail, source, pool);
        return res.status(r.ok ? 201 : 202).json({ ok: r.ok, kind: 'lead', source, lead_id: r.lead_id || null, error: r.error || null });
      }
      const { rows: [lead] } = await pool.query(
        "SELECT id, name, email, assigned_agent_id FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 AND COALESCE(role, 'client') = 'client' LIMIT 1",
        [tenant.id, mail.from.email]
      );
      if (!lead && mail.to.some((t) => /^(leads?|new-?leads?)[+@]/i.test(t))) {
        const r = await intakeFromEmail(tenant, mail, 'email', pool);
        return res.status(r.ok ? 201 : 202).json({ ok: r.ok, kind: 'lead', source: 'email', lead_id: r.lead_id || null, error: r.error || null });
      }
      const body = mail.reply.slice(0, 20000) || '(no text)';
      let messageId = null;
      if (lead) {
        const { rows: [m] } = await pool.query(
          `INSERT INTO lead_messages (tenant_id, lead_id, agent_id, channel, direction, kind, to_addr, from_addr, subject, body, status, provider_id)
           VALUES ($1, $2, $3, 'email', 'in', 'conversation', $4, $5, $6, $7, 'received', $8) RETURNING id`,
          [tenant.id, lead.id, lead.assigned_agent_id || null, mail.to[0] || null, mail.from.email, mail.subject || null, body, mail.message_id ? mail.message_id.slice(0, 64) : null]
        );
        messageId = m.id;
      }
      const rec = await recordInbound({
        tenantId: tenant.id, leadId: lead?.id || null, contactKey: lead ? null : mail.from.email, contactName: mail.from.name,
        kind: 'email', subject: mail.subject || null, body, leadMessageId: messageId,
      }, pool);
      pushStaff(tenant.id, await staffToTell(tenant.id, lead?.assigned_agent_id || null, pool), {
        title: `${lead?.name || mail.from.name || mail.from.email} emailed you`,
        body: `${mail.subject ? `${mail.subject}: ` : ''}${body}`.slice(0, 140),
        url: '/agent/?view=inbox',
        tag: `email-${rec.thread_id}`,
      }, pool).catch(() => {});
      return res.status(201).json({ ok: true, kind: 'reply', thread_id: rec.thread_id });
    });
  } catch (error) {
    logger.error('inboundEmail error', error);
    return res.status(500).json({ ok: false, error: 'Could not take that email' });
  }
};

const EMAIL_SOURCES = { email: 'email', zillow: 'zillow', realtor: 'realtor', homes: 'homes' };

/** POST /api/intake/:key/:source */
export const intakeLead = async (req, res) => {
  const pool = getPool();
  try {
    const source = String(req.params.source || '').toLowerCase();
    const tenant = await tenantForKey(req.params.key, pool);
    if (!tenant) return res.status(401).json({ ok: false, error: 'Unknown key' });
    if (source === 'facebook') return await facebookLeads(req, res, tenant, pool);
    const body = bodyOf(req);
    return await runWithTenant(tenant, async () => {
      let r;
      if (EMAIL_SOURCES[source]) {
        const mail = normalizeInboundEmail(body);
        const detected = source === 'email' ? (detectLeadSource({ fromEmail: mail.from.email, text: mail.text, subject: mail.subject }) || 'email') : source;
        r = await intakeFromEmail(tenant, mail, detected, pool);
      } else if (source === 'webhook' || source === 'zapier') {
        const lead = parseWebhookLead(body);
        const known = SOURCE_LABELS[String(lead.source_name || '').toLowerCase()] ? String(lead.source_name).toLowerCase() : null;
        r = await ingestLead(tenant, lead, known || source, { pool });
      } else {
        return res.status(404).json({ ok: false, error: 'Unknown lead source' });
      }
      if (!r.ok) return res.status(422).json({ ok: false, error: r.error === 'no_contact' ? 'A lead needs an email or a phone number' : 'Not accepted' });
      return res.status(r.created ? 201 : 200).json({ ok: true, lead_id: r.lead_id, created: r.created, duplicate: !r.created });
    });
  } catch (error) {
    logger.error('intakeLead error', error);
    return res.status(500).json({ ok: false, error: 'Could not take that lead' });
  }
};

/** Facebook lead ads: signed webhook (X-Hub-Signature-256), then the lead from the Graph API. */
async function facebookLeads(req, res, tenant, pool) {
  const fb = facebookSettings(tenant);
  if (!fb.app_secret) return res.status(403).json({ ok: false, error: 'Facebook isn’t set up for this brokerage yet' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  if (!verifyFacebookSignature(raw, req.get('x-hub-signature-256'), fb.app_secret)) {
    return res.status(403).json({ ok: false, error: 'Bad signature' });
  }
  let payload = {};
  try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ ok: false }); }
  const results = [];
  await runWithTenant(tenant, async () => {
    for (const entry of Array.isArray(payload.entry) ? payload.entry.slice(0, 50) : []) {
      for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
        if (change?.field !== 'leadgen' || !change.value?.leadgen_id) continue;
        const leadgenId = String(change.value.leadgen_id);
        if (!fb.page_token) {
          await recordInbound({
            tenantId: tenant.id, contactKey: `facebook-lead-${leadgenId}`, contactName: 'Facebook lead', kind: 'lead',
            subject: 'New lead from Facebook',
            body: 'A Facebook lead came in. Add your Facebook page access token in Settings → Lead sources so we can read their name and contact details.',
            meta: { source: 'facebook', leadgen_id: leadgenId },
          }, pool).catch(() => {});
          results.push({ leadgen_id: leadgenId, saved: false });
          continue;
        }
        try {
          const lead = parseFacebookLead(await fetchFacebookLead(leadgenId, fb.page_token));
          const r = await ingestLead(tenant, lead, 'facebook', { pool });
          results.push({ leadgen_id: leadgenId, saved: r.ok, lead_id: r.lead_id || null });
        } catch (e) {
          logger.warn('facebook lead fetch failed', { tenant_id: tenant.id, message: e.message });
          results.push({ leadgen_id: leadgenId, saved: false });
        }
      }
    }
  });
  // Facebook retries anything but a 200.
  return res.status(200).json({ ok: true, results });
}

/** GET /api/intake/:key/facebook — Facebook's subscription check. */
export const facebookVerify = async (req, res) => {
  try {
    const tenant = await tenantForKey(req.params.key);
    if (!tenant) return res.status(401).send('Unknown key');
    const expected = facebookVerifyToken(tenant, req.params.key);
    if (req.query['hub.mode'] === 'subscribe' && String(req.query['hub.verify_token'] || '') === expected) {
      return res.status(200).type('text/plain').send(String(req.query['hub.challenge'] || ''));
    }
    return res.status(403).send('Forbidden');
  } catch (error) {
    logger.error('facebookVerify error', error);
    return res.status(500).send('Error');
  }
};

// ------------------------------------------------------------ public: unsubscribe

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function unsubscribePage(brand, inner) {
  const accent = /^#[0-9a-f]{6}$/i.test(brand?.accent_color || '') ? brand.accent_color : '#111111';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${escHtml(brand?.name || 'Email preferences')}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<main style="max-width:440px;margin:48px auto;padding:28px 24px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.04em;color:${accent}">${escHtml(String(brand?.name || '').toUpperCase())}</p>
${inner}
</main></body></html>`;
}

async function personForToken(token, pool) {
  const t = String(token || '').trim();
  if (!/^[a-f0-9]{32,64}$/i.test(t)) return null;
  const { rows: [u] } = await pool.query("SELECT id, tenant_id, email FROM users WHERE manage_token = $1 AND COALESCE(role, 'client') = 'client'", [t]);
  return u || null;
}

/** GET /api/plans/unsubscribe?token= — asks first (link scanners open links too). */
export const planUnsubscribePage = async (req, res) => {
  const pool = getPool();
  try {
    const u = await personForToken(req.query.token, pool);
    const tenant = u ? await (await import('../services/tenantContext.js')).tenantById(u.tenant_id, { pool }) : null;
    const brand = tenant ? brandFor(tenant) : null;
    if (!u) return res.status(404).type('html').send(unsubscribePage(brand, '<h1 style="font-size:20px">This link has expired.</h1>'));
    return res.type('html').send(unsubscribePage(brand, `<h1 style="font-size:20px;margin:0 0 10px">Stop these emails?</h1>
<p style="font-size:15px;line-height:1.5;color:#374151">You won’t get any more follow-up emails from ${escHtml(brand.name)}. You can still reach your agent any time.</p>
<form method="post" action="?token=${encodeURIComponent(req.query.token)}"><button type="submit" style="margin-top:10px;min-height:44px;padding:0 18px;border:0;border-radius:8px;background:#111;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Unsubscribe</button></form>`));
  } catch (error) {
    logger.error('planUnsubscribePage error', error);
    return res.status(500).type('html').send('Something went wrong.');
  }
};

/** POST /api/plans/unsubscribe?token= — email turned off, every plan stopped. */
export const planUnsubscribe = async (req, res) => {
  const pool = getPool();
  try {
    const u = await personForToken(req.query.token || req.body?.token, pool);
    const tenant = u ? await (await import('../services/tenantContext.js')).tenantById(u.tenant_id, { pool }) : null;
    const brand = tenant ? brandFor(tenant) : null;
    if (!u) return res.status(404).type('html').send(unsubscribePage(brand, '<h1 style="font-size:20px">This link has expired.</h1>'));
    await recordConsent({ userId: u.id, channel: 'email', granted: false, wording: 'Unsubscribed from follow-up emails.', source: 'plan_unsubscribe', tenantId: u.tenant_id }, pool);
    await stopAllForLead(u.id, 'unsubscribed', {}, pool);
    return res.type('html').send(unsubscribePage(brand, `<h1 style="font-size:20px;margin:0 0 10px">You’re unsubscribed.</h1>
<p style="font-size:15px;line-height:1.5;color:#374151">You won’t get any more follow-up emails from ${escHtml(brand.name)}.</p>`));
  } catch (error) {
    logger.error('planUnsubscribe error', error);
    return res.status(500).type('html').send('Something went wrong.');
  }
};
