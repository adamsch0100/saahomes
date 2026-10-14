/**
 * The cockpit's light CRM, per brokerage and per agent:
 *   GET    /api/agent/crm/leads/:id            lead, pinned notes, open tasks, texting status, timeline
 *   GET    /api/agent/crm/leads/:id/timeline   ?before=&limit= (older pages)
 *   POST   /api/agent/crm/leads/:id/notes      { body, kind?, pinned? }
 *   PATCH  /api/agent/crm/notes/:id            { body?, pinned? }   (author or owner)
 *   DELETE /api/agent/crm/notes/:id
 *   POST   /api/agent/crm/leads/:id/tasks      { title, kind?, due_at?, remind_at?, assignee_id? }
 *   PATCH  /api/agent/crm/tasks/:id            { title?, due_at?, remind_at?, done?, assignee_id? }
 *   DELETE /api/agent/crm/tasks/:id
 *   GET    /api/agent/crm/tasks                ?scope=today|open  (mine; owners also unowned)
 *   GET    /api/agent/crm/leads/:id/texts      the text thread
 *   POST   /api/agent/crm/leads/:id/texts      { body }
 *   POST   /api/agent/crm/leads/:id/emails     { subject, body }
 *   POST   /api/agent/crm/leads/:id/drafts     { channel } → a draft only; nothing is sent
 *   POST   /api/agent/crm/drafts/:id/send      { body, subject? } → sent now (the agent pressed Send)
 *   POST   /api/agent/crm/drafts/:id/discard
 *   POST   /api/agent/crm/tours/:id/confirm    { start } → confirmed; buyer texted when they agreed to texts
 *   POST   /api/agent/push/subscribe|unsubscribe  hot-lead alerts on this device
 * Every lead is looked up through the brokerage's lead visibility rules, so
 * an agent only ever touches leads they can see in the cockpit.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { tenantIdOf } from '../services/tenantContext.js';
import { visibleLeadSql } from './agentController.js';
import {
  buildTimeline, NOTE_KINDS, TASK_KINDS, syncNoteToFub, syncTaskToFub, dueTasksFor,
} from '../services/crmService.js';
import {
  sendText, textCheck, smsConfigFor, SMS_REASON_TEXT, tourWhen, normalizePhone,
} from '../services/smsService.js';
import { createDraft, sendDraft, sendLeadEmail } from '../services/replyDrafts.js';
import { getConsents } from '../services/consent.js';
import { saveSubscription, removeSubscription } from '../services/pushService.js';

const posId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const EMAIL_REASON_TEXT = {
  no_email: 'There’s no email address for this person.',
  email_off: 'This person turned off emails from you.',
  empty: 'Write a message first.',
  failed: 'The email didn’t go through. Try again in a moment.',
};

/** The signed-in staff member (platform logins have no row). */
async function staffOf(req, pool) {
  const id = posId(req.user?.id);
  if (id) {
    const { rows: [s] } = await pool.query(
      'SELECT id, name, email, phone, role, voice_style, tenant_id FROM users WHERE id = $1 AND tenant_id = $2',
      [id, tenantIdOf(req)]
    );
    if (s) return s;
  }
  return { id: null, name: null, email: req.user?.email || null, role: req.user?.role || 'admin', tenant_id: tenantIdOf(req) };
}

/** A lead this staff member may see, or null. */
async function visibleLead(req, leadId, pool) {
  const params = [leadId];
  const { rows: [lead] } = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.tenant_id, u.assigned_agent_id, u.lifecycle_stage, u.created_at
     FROM users u WHERE u.id = $1 AND COALESCE(u.role, 'client') = 'client' AND ${visibleLeadSql(req, params, 'u.')}`,
    params
  );
  return lead || null;
}

const isOwner = (req) => String(req.user?.role || '') === 'admin';
const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });

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

async function textingStatus(req, lead, pool) {
  const check = await textCheck({ tenant: req.tenant, lead }, pool);
  return {
    can_text: check.ok,
    reason: check.reason,
    message: check.reason ? SMS_REASON_TEXT[check.reason] : null,
    set_up: smsConfigFor(req.tenant).ready,
  };
}

/** GET /crm/leads/:id */
export const getLeadDetail = wrap('getLeadDetail', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const tenantId = tenantIdOf(req);
  const [{ rows: notes }, { rows: tasks }, { rows: tours }, consents, texting, timeline] = await Promise.all([
    pool.query(
      `SELECT id, kind, body, pinned, author_id, author_name, created_at, updated_at, edited_by_name, fub_synced_at
       FROM lead_notes WHERE lead_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       ORDER BY pinned DESC, created_at DESC LIMIT 100`, [lead.id, tenantId]
    ),
    pool.query(
      `SELECT t.id, t.title, t.kind, t.due_at, t.remind_at, t.done_at, t.assignee_id, a.name AS assignee_name, t.created_at, t.fub_synced_at
       FROM lead_tasks t LEFT JOIN users a ON a.id = t.assignee_id
       WHERE t.lead_id = $1 AND t.tenant_id = $2
       ORDER BY (t.done_at IS NOT NULL), t.due_at NULLS LAST, t.created_at DESC LIMIT 100`, [lead.id, tenantId]
    ),
    pool.query(
      `SELECT id, listing_keys, windows, note, status, confirmed_start, created_at FROM tour_requests
       WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 10`, [lead.id, tenantId]
    ),
    getConsents(lead.id, pool),
    textingStatus(req, lead, pool),
    buildTimeline(lead.id, tenantId, { limit: 80 }, pool),
  ]);
  const me = posId(req.user?.id);
  return res.json({
    success: true,
    data: {
      viewer_id: me || null,
      lead: { ...lead, phone_e164: normalizePhone(lead.phone) },
      notes: notes.map((n) => ({ ...n, can_edit: isOwner(req) || (me && n.author_id === me) })),
      tasks,
      tours,
      consent: {
        sms: consents.sms?.status || null,
        email: consents.email?.status || null,
        sms_wording: consents.sms?.wording || null,
        sms_at: consents.sms?.created_at || null,
      },
      texting,
      timeline,
    },
  });
});

/** GET /crm/leads/:id/timeline */
export const getLeadTimeline = wrap('getLeadTimeline', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const items = await buildTimeline(lead.id, tenantIdOf(req), { limit: req.query.limit || 80, before: req.query.before || null }, pool);
  return res.json({ success: true, data: items });
});

// ------------------------------------------------------------ notes

/** POST /crm/leads/:id/notes */
export const addNote = wrap('addNote', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const body = String(req.body?.body || '').trim().slice(0, 5000);
  if (!body) return fail(res, 400, 'Write a note first');
  const kind = NOTE_KINDS.includes(req.body?.kind) ? req.body.kind : 'note';
  const me = await staffOf(req, pool);
  const { rows: [note] } = await pool.query(
    `INSERT INTO lead_notes (tenant_id, lead_id, author_id, author_name, kind, body, pinned)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [tenantIdOf(req), lead.id, me.id, me.name || me.email || 'Owner', kind, body, req.body?.pinned === true]
  );
  // A logged call is a first contact.
  if (kind === 'call') {
    await pool.query('UPDATE users SET first_contacted_at = COALESCE(first_contacted_at, NOW()), last_touched_at = NOW() WHERE id = $1', [lead.id]);
  }
  syncNoteToFub(note.id, pool).catch(() => {});
  return res.status(201).json({ success: true, data: { ...note, can_edit: true } });
});

async function visibleNote(req, noteId, pool) {
  const params = [noteId];
  const { rows: [n] } = await pool.query(
    `SELECT n.* FROM lead_notes n JOIN users u ON u.id = n.lead_id
     WHERE n.id = $1 AND n.deleted_at IS NULL AND n.tenant_id = u.tenant_id AND ${visibleLeadSql(req, params, 'u.')}`,
    params
  );
  return n || null;
}

/** PATCH /crm/notes/:id */
export const editNote = wrap('editNote', async (req, res, pool) => {
  const note = await visibleNote(req, posId(req.params.id), pool);
  if (!note) return fail(res, 404, 'Note not found');
  const me = await staffOf(req, pool);
  const sets = [];
  const vals = [note.id];
  if (req.body?.body !== undefined) {
    if (!isOwner(req) && note.author_id !== me.id) return fail(res, 403, 'Only the person who wrote this note can change it');
    const body = String(req.body.body || '').trim().slice(0, 5000);
    if (!body) return fail(res, 400, 'A note can’t be empty');
    vals.push(body);
    sets.push(`body = $${vals.length}`, 'updated_at = NOW()');
    vals.push(me.name || me.email || 'Owner');
    sets.push(`edited_by_name = $${vals.length}`);
  }
  if (req.body?.pinned !== undefined) {
    vals.push(req.body.pinned === true);
    sets.push(`pinned = $${vals.length}`);
  }
  if (!sets.length) return fail(res, 400, 'Nothing to change');
  const { rows: [updated] } = await pool.query(`UPDATE lead_notes SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals);
  return res.json({ success: true, data: { ...updated, can_edit: isOwner(req) || updated.author_id === me.id } });
});

/** DELETE /crm/notes/:id */
export const deleteNote = wrap('deleteNote', async (req, res, pool) => {
  const note = await visibleNote(req, posId(req.params.id), pool);
  if (!note) return fail(res, 404, 'Note not found');
  const me = await staffOf(req, pool);
  if (!isOwner(req) && note.author_id !== me.id) return fail(res, 403, 'Only the person who wrote this note can delete it');
  await pool.query('UPDATE lead_notes SET deleted_at = NOW() WHERE id = $1', [note.id]);
  return res.json({ success: true });
});

// ------------------------------------------------------------ tasks

function parseWhen(v) {
  if (v === null || v === '') return null;
  if (v === undefined) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'invalid' : d;
}

async function checkAssignee(req, id, pool) {
  if (id == null) return null;
  const { rows: [a] } = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin') AND status = 'active'",
    [id, tenantIdOf(req)]
  );
  return a ? a.id : 'invalid';
}

/** POST /crm/leads/:id/tasks */
export const addTask = wrap('addTask', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const title = String(req.body?.title || '').trim().slice(0, 255);
  if (!title) return fail(res, 400, 'What needs doing? Add a short title.');
  const kind = TASK_KINDS.includes(req.body?.kind) ? req.body.kind : 'follow_up';
  const due = parseWhen(req.body?.due_at);
  const remind = parseWhen(req.body?.remind_at);
  if (due === 'invalid' || remind === 'invalid') return fail(res, 400, 'That date doesn’t look right');
  const me = await staffOf(req, pool);
  const wanted = req.body?.assignee_id !== undefined ? posId(req.body.assignee_id) : (me.id || lead.assigned_agent_id || null);
  const assignee = await checkAssignee(req, wanted, pool);
  if (assignee === 'invalid') return fail(res, 400, 'Pick someone on your team');
  const { rows: [task] } = await pool.query(
    `INSERT INTO lead_tasks (tenant_id, lead_id, assignee_id, created_by, title, kind, due_at, remind_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [tenantIdOf(req), lead.id, assignee, me.id, title, kind, due || null, remind || null]
  );
  syncTaskToFub(task.id, pool).catch(() => {});
  return res.status(201).json({ success: true, data: task });
});

async function visibleTask(req, taskId, pool) {
  const params = [taskId];
  const { rows: [t] } = await pool.query(
    `SELECT t.* FROM lead_tasks t JOIN users u ON u.id = t.lead_id
     WHERE t.id = $1 AND t.tenant_id = u.tenant_id AND ${visibleLeadSql(req, params, 'u.')}`,
    params
  );
  return t || null;
}

/** PATCH /crm/tasks/:id */
export const editTask = wrap('editTask', async (req, res, pool) => {
  const task = await visibleTask(req, posId(req.params.id), pool);
  if (!task) return fail(res, 404, 'Task not found');
  const b = req.body || {};
  const sets = ['updated_at = NOW()'];
  const vals = [task.id];
  const add = (sql, v) => { vals.push(v); sets.push(`${sql} = $${vals.length}`); };
  if (b.title !== undefined) {
    const t = String(b.title || '').trim().slice(0, 255);
    if (!t) return fail(res, 400, 'A task needs a title');
    add('title', t);
  }
  if (b.kind !== undefined && TASK_KINDS.includes(b.kind)) add('kind', b.kind);
  for (const k of ['due_at', 'remind_at']) {
    const v = parseWhen(b[k]);
    if (v === 'invalid') return fail(res, 400, 'That date doesn’t look right');
    if (v !== undefined) add(k, v);
    if (k === 'remind_at' && v !== undefined) sets.push('reminded_at = NULL');
  }
  if (b.assignee_id !== undefined) {
    const a = await checkAssignee(req, b.assignee_id === null ? null : posId(b.assignee_id), pool);
    if (a === 'invalid') return fail(res, 400, 'Pick someone on your team');
    add('assignee_id', a);
  }
  if (b.done !== undefined) sets.push(b.done ? 'done_at = COALESCE(done_at, NOW())' : 'done_at = NULL');
  const { rows: [updated] } = await pool.query(`UPDATE lead_tasks SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals);
  if (b.done !== undefined && updated.fub_task_id) syncTaskToFub(updated.id, pool).catch(() => {});
  return res.json({ success: true, data: updated });
});

/** DELETE /crm/tasks/:id */
export const deleteTask = wrap('deleteTask', async (req, res, pool) => {
  const task = await visibleTask(req, posId(req.params.id), pool);
  if (!task) return fail(res, 404, 'Task not found');
  await pool.query('DELETE FROM lead_tasks WHERE id = $1', [task.id]);
  return res.json({ success: true });
});

/** GET /crm/tasks?scope=today|open */
export const listTasks = wrap('listTasks', async (req, res, pool) => {
  const me = await staffOf(req, pool);
  if (req.query.scope !== 'open') {
    const tasks = await dueTasksFor({ ...me, role: req.user?.role }, { tenant: req.tenant }, pool);
    return res.json({ success: true, data: tasks });
  }
  const params = [];
  const visible = visibleLeadSql(req, params, 'u.');
  params.push(me.id || 0, isOwner(req));
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.kind, t.due_at, t.lead_id, u.name AS lead_name, u.email AS lead_email, u.phone AS lead_phone
     FROM lead_tasks t JOIN users u ON u.id = t.lead_id
     WHERE t.done_at IS NULL AND t.tenant_id = u.tenant_id AND ${visible}
       AND (t.assignee_id = $${params.length - 1} OR ($${params.length} AND t.assignee_id IS NULL))
     ORDER BY t.due_at NULLS LAST, t.created_at LIMIT 100`,
    params
  );
  return res.json({ success: true, data: rows.map((r) => ({ ...r, lead_name: r.lead_name || r.lead_email })) });
});

// ------------------------------------------------------------ texts + emails

/** GET /crm/leads/:id/texts */
export const getTextThread = wrap('getTextThread', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const { rows } = await pool.query(
    `SELECT m.id, m.direction, m.kind, m.body, m.status, m.error, m.created_at, a.name AS agent_name
     FROM lead_messages m LEFT JOIN users a ON a.id = m.agent_id
     WHERE m.lead_id = $1 AND m.tenant_id = $2 AND m.channel = 'sms'
     ORDER BY m.created_at ASC, m.id ASC LIMIT 300`,
    [lead.id, tenantIdOf(req)]
  );
  return res.json({ success: true, data: { messages: rows, texting: await textingStatus(req, lead, pool) } });
});

/** POST /crm/leads/:id/texts */
export const sendLeadText = wrap('sendLeadText', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const me = await staffOf(req, pool);
  const r = await sendText({ tenant: req.tenant, leadId: lead.id, body: req.body?.body, agentId: me.id }, pool);
  if (!r.ok) return fail(res, r.reason === 'failed' ? 502 : 422, SMS_REASON_TEXT[r.reason] || 'Could not send', { reason: r.reason });
  return res.status(201).json({ success: true, data: r.message });
});

/** POST /crm/leads/:id/emails */
export const sendLeadEmailNow = wrap('sendLeadEmail', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const me = await staffOf(req, pool);
  const r = await sendLeadEmail({ tenant: req.tenant, leadId: lead.id, agent: me, subject: req.body?.subject, body: req.body?.body }, pool);
  if (!r.ok) return fail(res, r.reason === 'failed' ? 502 : 422, EMAIL_REASON_TEXT[r.reason] || 'Could not send', { reason: r.reason });
  return res.status(201).json({ success: true, data: r.message });
});

// ------------------------------------------------------------ drafts

/** POST /crm/leads/:id/drafts — writes a draft; never sends. */
export const draftReply = wrap('draftReply', async (req, res, pool) => {
  const lead = await visibleLead(req, posId(req.params.id), pool);
  if (!lead) return fail(res, 404, 'Lead not found');
  const me = await staffOf(req, pool);
  const channel = req.body?.channel === 'email' ? 'email' : 'sms';
  const draft = await createDraft({ tenant: req.tenant, leadId: lead.id, agent: me, channel }, pool);
  return res.status(201).json({ success: true, data: draft });
});

async function visibleDraft(req, draftId, pool) {
  const params = [draftId];
  const { rows: [d] } = await pool.query(
    `SELECT d.* FROM reply_drafts d JOIN users u ON u.id = d.lead_id
     WHERE d.id = $1 AND d.tenant_id = u.tenant_id AND ${visibleLeadSql(req, params, 'u.')}`,
    params
  );
  return d || null;
}

/** POST /crm/drafts/:id/send — the agent pressed Send. */
export const sendReplyDraft = wrap('sendReplyDraft', async (req, res, pool) => {
  const draft = await visibleDraft(req, posId(req.params.id), pool);
  if (!draft) return fail(res, 404, 'Draft not found');
  const me = await staffOf(req, pool);
  const r = await sendDraft({ tenant: req.tenant, draftId: draft.id, agent: me, body: req.body?.body, subject: req.body?.subject }, pool);
  if (!r.ok) {
    const msg = r.reason === 'already_sent' ? 'This draft was already sent'
      : (draft.channel === 'sms' ? SMS_REASON_TEXT[r.reason] : EMAIL_REASON_TEXT[r.reason]) || 'Could not send';
    return fail(res, r.reason === 'failed' ? 502 : r.reason === 'already_sent' ? 409 : 422, msg, { reason: r.reason });
  }
  return res.status(201).json({ success: true, data: r.message });
});

/** POST /crm/drafts/:id/discard */
export const discardDraft = wrap('discardDraft', async (req, res, pool) => {
  const draft = await visibleDraft(req, posId(req.params.id), pool);
  if (!draft) return fail(res, 404, 'Draft not found');
  await pool.query("UPDATE reply_drafts SET status = 'discarded' WHERE id = $1 AND status = 'draft'", [draft.id]);
  return res.json({ success: true });
});

// ------------------------------------------------------------ tours

/** POST /crm/tours/:id/confirm { start } */
export const confirmTour = wrap('confirmTour', async (req, res, pool) => {
  const params = [posId(req.params.id)];
  const { rows: [tour] } = await pool.query(
    `SELECT t.*, u.name AS lead_name FROM tour_requests t JOIN users u ON u.id = t.user_id
     WHERE t.id = $1 AND t.tenant_id = u.tenant_id AND ${visibleLeadSql(req, params, 'u.')}`,
    params
  );
  if (!tour) return fail(res, 404, 'Tour not found');
  const start = new Date(req.body?.start);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 3600000) return fail(res, 400, 'Pick a time for the tour');
  const me = await staffOf(req, pool);
  await pool.query(
    `UPDATE tour_requests SET status = 'confirmed', confirmed_start = $2, confirmed_by = $3, reminder_texted_at = NULL WHERE id = $1`,
    [tour.id, start, me.id]
  );
  const cfg = smsConfigFor(req.tenant);
  const n = (tour.listing_keys || []).length;
  const first = String(me.name || '').trim().split(/\s+/)[0];
  const body = `You're all set! Your tour of ${n} home${n === 1 ? '' : 's'} is confirmed for ${tourWhen(start, cfg.time_zone)}${first ? ` with ${first}` : ''}. Reply here with any questions.`;
  const texted = await sendText({ tenant: req.tenant, leadId: tour.user_id, body, agentId: me.id, kind: 'tour' }, pool);
  return res.json({
    success: true,
    data: {
      id: tour.id,
      status: 'confirmed',
      confirmed_start: start.toISOString(),
      texted: texted.ok,
      text_note: texted.ok ? 'We texted them the confirmation.' : SMS_REASON_TEXT[texted.reason] || null,
    },
  });
});

/** GET /crm/texting — is texting set up for this brokerage? */
export const getTextingStatus = wrap('getTextingStatus', async (req, res) => {
  const cfg = smsConfigFor(req.tenant);
  return res.json({ success: true, data: { ready: cfg.ready, reason: cfg.reason, message: cfg.reason ? SMS_REASON_TEXT[cfg.reason] : null } });
});

// ------------------------------------------------------------ agent push

/** POST /api/agent/push/subscribe { subscription } */
export const subscribeAgentPush = wrap('subscribeAgentPush', async (req, res, pool) => {
  const me = await staffOf(req, pool);
  if (!me.id) return fail(res, 400, 'Sign in with your own agent account to get alerts on this device');
  const r = await saveSubscription({ userId: me.id, subscription: req.body?.subscription, req, pool });
  if (!r.ok) return fail(res, 400, 'This browser sent a push subscription we can’t use.');
  return res.status(201).json({ success: true });
});

/** POST /api/agent/push/unsubscribe { endpoint } */
export const unsubscribeAgentPush = wrap('unsubscribeAgentPush', async (req, res, pool) => {
  const me = await staffOf(req, pool);
  if (me.id) await removeSubscription({ userId: me.id, endpoint: req.body?.endpoint, req, pool });
  return res.json({ success: true });
});
