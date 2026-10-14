/**
 * The team inbox: one shared place for every inbound text, email reply,
 * Nadia handoff, form and new lead, per brokerage.
 *
 *   - One thread per lead (or per sender we don't know yet). Anything new
 *     reopens the thread and makes it unread for everyone who can see it.
 *   - Threads follow the brokerage's lead visibility: an agent sees a thread
 *     when they can see its lead; a thread with no lead yet is the owners',
 *     its assignee's, and (unless agents only see their own leads) the pond.
 *   - Claim, assign, mark done. Assigning a thread also assigns its lead.
 *   - Replies go out from the thread by text (smsService: consent, STOP and
 *     quiet hours) or email (in the brokerage's brand), and are the same
 *     lead_messages the cockpit timeline shows.
 *   - A text or email from the lead pauses their action plans.
 *
 * Inbound email arrives on POST /api/inbound/email from the brokerage's mail
 * provider (Resend, Postmark or SendGrid inbound JSON, or a plain JSON body),
 * checked against the brokerage's own intake key. See normalizeInboundEmail.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { leadVisibility, tenantIdOf } from './tenantContext.js';
import { hotTransport } from './hotLeads.js';

export const INBOX_KINDS = {
  text: 'Text',
  email: 'Email',
  nadia: 'Nadia handoff',
  form: 'Form',
  lead: 'New lead',
};

const preview = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
const isOwner = (req) => String(req.user?.role || '') === 'admin';
const meId = (req) => {
  const n = Number(req.user?.id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ------------------------------------------------------------ recording

/**
 * Something came in. Files it on the right thread (creating one if needed),
 * reopens the thread, and pauses the lead's plans when they wrote to us.
 * Returns { thread_id, item_id }.
 */
export async function recordInbound({
  tenantId, leadId = null, kind, body = '', subject = null, contactKey = null, contactName = null,
  leadMessageId = null, meta = {}, at = null,
}, pool = getPool()) {
  if (!INBOX_KINDS[kind]) throw new Error(`unknown inbox kind ${kind}`);
  const when = at || new Date();
  let lead = null;
  if (leadId) {
    ({ rows: [lead] } = await pool.query('SELECT id, name, email, assigned_agent_id FROM users WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]));
  }
  const key = lead ? null : String(contactKey || '').trim().toLowerCase().slice(0, 255) || null;
  if (!lead && !key) throw new Error('inbox item needs a lead or a contact');
  const text = String(body || '').slice(0, 20000);
  const { rows: [thread] } = lead
    ? await pool.query(
      `INSERT INTO inbox_threads (tenant_id, lead_id, contact_name, status, assignee_id, last_kind, last_preview, last_at, last_inbound_at)
       VALUES ($1, $2, $3, 'open', $4, $5, $6, $7, $7)
       ON CONFLICT (tenant_id, lead_id) WHERE lead_id IS NOT NULL DO UPDATE SET
         status = 'open', done_at = NULL, done_by = NULL, last_kind = EXCLUDED.last_kind, last_preview = EXCLUDED.last_preview,
         last_at = EXCLUDED.last_at, last_inbound_at = EXCLUDED.last_inbound_at,
         assignee_id = COALESCE(inbox_threads.assignee_id, EXCLUDED.assignee_id)
       RETURNING id`,
      [tenantId, lead.id, lead.name || lead.email, lead.assigned_agent_id || null, kind, preview(subject ? `${subject} · ${text}` : text), when]
    )
    : await pool.query(
      `INSERT INTO inbox_threads (tenant_id, contact_key, contact_name, status, last_kind, last_preview, last_at, last_inbound_at)
       VALUES ($1, $2, $3, 'open', $4, $5, $6, $6)
       ON CONFLICT (tenant_id, contact_key) WHERE lead_id IS NULL DO UPDATE SET
         status = 'open', done_at = NULL, done_by = NULL, last_kind = EXCLUDED.last_kind, last_preview = EXCLUDED.last_preview,
         last_at = EXCLUDED.last_at, last_inbound_at = EXCLUDED.last_inbound_at,
         contact_name = COALESCE(EXCLUDED.contact_name, inbox_threads.contact_name)
       RETURNING id`,
      [tenantId, key, contactName ? String(contactName).slice(0, 255) : null, kind, preview(subject ? `${subject} · ${text}` : text), when]
    );
  const { rows: [item] } = await pool.query(
    `INSERT INTO inbox_items (tenant_id, thread_id, kind, direction, subject, body, lead_message_id, meta, created_at)
     VALUES ($1, $2, $3, 'in', $4, $5, $6, $7::jsonb, $8) RETURNING id`,
    [tenantId, thread.id, kind, subject ? String(subject).slice(0, 300) : null, text, leadMessageId, JSON.stringify(meta || {}), when]
  );
  if (lead && (kind === 'text' || kind === 'email')) {
    const { pauseForLead } = await import('./actionPlans.js');
    await pauseForLead(lead.id, 'replied', {}, pool);
  }
  return { thread_id: thread.id, item_id: item.id };
}

/** Same as recordInbound, but never throws (callers are webhooks and forms). */
export async function recordInboundSafe(args, pool = getPool()) {
  try {
    return await recordInbound(args, pool);
  } catch (e) {
    logger.warn('inbox record failed', { message: e.message, kind: args?.kind });
    return null;
  }
}

/** A thread for a lead that never wrote in (so an agent can message them from the inbox). */
export async function threadForLead(tenantId, leadId, pool = getPool()) {
  const { rows: [t] } = await pool.query(
    `INSERT INTO inbox_threads (tenant_id, lead_id, contact_name, status, assignee_id, last_at)
     SELECT tenant_id, id, COALESCE(name, email), 'done', assigned_agent_id, NOW() FROM users WHERE id = $2 AND tenant_id = $1
     ON CONFLICT (tenant_id, lead_id) WHERE lead_id IS NOT NULL DO UPDATE SET lead_id = EXCLUDED.lead_id
     RETURNING id`,
    [tenantId, leadId]
  );
  return t?.id || null;
}

/** Push to staff (their devices). Never throws. */
export async function pushStaff(tenantId, staffIds, payload, pool = getPool()) {
  let delivered = 0;
  for (const id of [...new Set(staffIds.filter(Boolean))]) {
    const { rows: [s] } = await pool.query(
      "SELECT id, notify_prefs FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin') AND status = 'active'", [id, tenantId]
    );
    if (!s || s.notify_prefs?.hot_lead_push === false) continue;
    const { rows: subs } = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL', [id]
    );
    for (const sub of subs) {
      try {
        await hotTransport.push(sub, payload);
        delivered += 1;
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await pool.query('UPDATE push_subscriptions SET disabled_at = NOW() WHERE id = $1', [sub.id]).catch(() => {});
        }
      }
    }
  }
  return delivered;
}

/** The lead's agent, else the owners. */
export async function staffToTell(tenantId, assignedAgentId, pool = getPool()) {
  if (assignedAgentId) return [assignedAgentId];
  const { rows } = await pool.query("SELECT id FROM users WHERE tenant_id = $1 AND role = 'admin' AND status = 'active'", [tenantId]);
  return rows.map((r) => r.id);
}

// ------------------------------------------------------------ who sees what

/**
 * SQL (thread alias t., lead alias u.) for the threads this staff member may
 * see. Pushes its parameters onto params.
 */
export function visibleThreadSql(req, params) {
  params.push(tenantIdOf(req));
  const tenant = `t.tenant_id = $${params.length}`;
  if (isOwner(req)) return tenant;
  const visibility = leadVisibility(req.tenant);
  params.push(meId(req) || 0);
  const me = `$${params.length}`;
  const leadRule = visibility === 'all' ? 'TRUE'
    : visibility === 'own' ? `u.assigned_agent_id = ${me}`
      : `(u.assigned_agent_id = ${me} OR u.assigned_agent_id IS NULL)`;
  const looseRule = visibility === 'own' ? `t.assignee_id = ${me}` : `(t.assignee_id = ${me} OR t.assignee_id IS NULL)`;
  return `${tenant} AND ((t.lead_id IS NOT NULL AND u.tenant_id = t.tenant_id AND ${leadRule}) OR (t.lead_id IS NULL AND ${looseRule}))`;
}

const FILTERS = {
  open: "t.status = 'open'",
  done: "t.status = 'done'",
  mine: "t.status = 'open' AND t.assignee_id = $ME",
  unassigned: "t.status = 'open' AND t.assignee_id IS NULL",
  all: 'TRUE',
};

/** Threads for the inbox list, newest activity first. */
export async function listThreads(req, { filter = 'open', q = '', limit = 50 } = {}, pool = getPool()) {
  const params = [];
  const vis = visibleThreadSql(req, params);
  params.push(meId(req) || 0);
  const me = `$${params.length}`;
  const where = (FILTERS[filter] || FILTERS.open).replace('$ME', me);
  let search = 'TRUE';
  if (String(q).trim()) {
    params.push(`%${String(q).trim().slice(0, 80)}%`);
    const p = `$${params.length}`;
    search = `(t.contact_name ILIKE ${p} OR t.contact_key ILIKE ${p} OR u.email ILIKE ${p} OR u.phone ILIKE ${p} OR t.last_preview ILIKE ${p})`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const { rows } = await pool.query(
    `SELECT t.id, t.lead_id, t.contact_key, t.contact_name, t.status, t.assignee_id, a.name AS assignee_name,
            t.last_kind, t.last_preview, t.last_at, t.last_inbound_at, t.done_at,
            u.name AS lead_name, u.email AS lead_email, u.phone AS lead_phone, u.lifecycle_stage,
            (t.last_inbound_at IS NOT NULL AND t.last_inbound_at > COALESCE(r.read_at, 'epoch'::timestamptz)) AS unread
     FROM inbox_threads t
     LEFT JOIN users u ON u.id = t.lead_id
     LEFT JOIN users a ON a.id = t.assignee_id
     LEFT JOIN inbox_reads r ON r.thread_id = t.id AND r.user_id = ${me}
     WHERE ${vis} AND ${where} AND ${search}
     ORDER BY t.last_at DESC, t.id DESC LIMIT $${params.length}`,
    params
  );
  return rows.map(shapeThread);
}

const shownEmail = (e) => (e && !/\.invalid$/i.test(e) ? e : null);

function shapeThread(r) {
  return {
    id: r.id,
    lead_id: r.lead_id,
    name: r.lead_name || r.contact_name || shownEmail(r.lead_email) || r.contact_key || 'Unknown',
    email: shownEmail(r.lead_email) || (String(r.contact_key || '').includes('@') ? r.contact_key : null),
    phone: r.lead_phone || (/^\+?\d{10,15}$/.test(String(r.contact_key || '')) ? r.contact_key : null),
    stage: r.lifecycle_stage || null,
    status: r.status,
    assignee_id: r.assignee_id,
    assignee_name: r.assignee_name || null,
    last_kind: r.last_kind,
    last_kind_label: INBOX_KINDS[r.last_kind] || null,
    preview: r.last_preview,
    last_at: r.last_at,
    unread: !!r.unread,
    done_at: r.done_at,
  };
}

/** Unread and open counts for the inbox tab. */
export async function inboxCounts(req, pool = getPool()) {
  const params = [];
  const vis = visibleThreadSql(req, params);
  params.push(meId(req) || 0);
  const me = `$${params.length}`;
  const { rows: [c] } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE t.status = 'open')::int AS open,
            COUNT(*) FILTER (WHERE t.status = 'open' AND t.last_inbound_at > COALESCE(r.read_at, 'epoch'::timestamptz))::int AS unread,
            COUNT(*) FILTER (WHERE t.status = 'open' AND t.assignee_id = ${me})::int AS mine,
            COUNT(*) FILTER (WHERE t.status = 'open' AND t.assignee_id IS NULL)::int AS unassigned
     FROM inbox_threads t
     LEFT JOIN users u ON u.id = t.lead_id
     LEFT JOIN inbox_reads r ON r.thread_id = t.id AND r.user_id = ${me}
     WHERE ${vis}`,
    params
  );
  return c;
}

/** One thread this staff member may see, or null. */
export async function visibleThread(req, threadId, pool = getPool()) {
  const params = [];
  const vis = visibleThreadSql(req, params);
  params.push(threadId);
  const { rows: [t] } = await pool.query(
    `SELECT t.*, u.name AS lead_name, u.email AS lead_email, u.phone AS lead_phone, u.lifecycle_stage, u.assigned_agent_id AS lead_agent_id,
            a.name AS assignee_name, FALSE AS unread
     FROM inbox_threads t LEFT JOIN users u ON u.id = t.lead_id LEFT JOIN users a ON a.id = t.assignee_id
     WHERE ${vis} AND t.id = $${params.length}`,
    params
  );
  return t || null;
}

/** The conversation in a thread, oldest first (texts and emails both ways, forms, new-lead notes). */
export async function threadMessages(thread, pool = getPool()) {
  const items = (await pool.query(
    `SELECT i.id, i.kind, i.direction, i.subject, i.body, i.meta, i.created_at, a.name AS agent_name
     FROM inbox_items i LEFT JOIN users a ON a.id = i.agent_id
     WHERE i.thread_id = $1 AND i.tenant_id = $2 AND (NOT $3 OR i.lead_message_id IS NULL) ORDER BY i.created_at LIMIT 300`,
    [thread.id, thread.tenant_id, !!thread.lead_id]
  )).rows.map((i) => ({
    id: `i${i.id}`, at: i.created_at, kind: i.kind, kind_label: INBOX_KINDS[i.kind] || i.kind, direction: i.direction,
    subject: i.subject, body: i.body, agent_name: i.agent_name || null, meta: i.meta || {},
  }));
  let msgs = [];
  if (thread.lead_id) {
    msgs = (await pool.query(
      `SELECT m.id, m.channel, m.direction, m.kind, m.subject, m.body, m.status, m.created_at, a.name AS agent_name
       FROM lead_messages m LEFT JOIN users a ON a.id = m.agent_id
       WHERE m.lead_id = $1 AND m.tenant_id = $2 AND m.kind <> 'keyword'
       ORDER BY m.created_at DESC LIMIT 300`,
      [thread.lead_id, thread.tenant_id]
    )).rows.map((m) => ({
      id: `m${m.id}`, at: m.created_at, kind: m.channel === 'sms' ? 'text' : 'email',
      kind_label: m.kind === 'plan' ? `${m.channel === 'sms' ? 'Text' : 'Email'} from an action plan` : m.kind === 'alert' ? 'Home alert text' : (m.channel === 'sms' ? 'Text' : 'Email'),
      direction: m.direction, subject: m.subject, body: m.body, status: m.status, agent_name: m.agent_name || null,
    }));
  }
  return [...items, ...msgs].sort((a, b) => new Date(a.at) - new Date(b.at));
}

export async function markRead(threadId, tenantId, userId, pool = getPool()) {
  if (!userId) return;
  await pool.query(
    `INSERT INTO inbox_reads (tenant_id, thread_id, user_id, read_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (thread_id, user_id) DO UPDATE SET read_at = NOW()`,
    [tenantId, threadId, userId]
  );
}

/** Assign a thread (and its lead) to a teammate, or back to the pond. */
export async function assignThread(thread, agentId, { by = null, byRole = 'agent' } = {}, pool = getPool()) {
  await pool.query(
    'UPDATE inbox_threads SET assignee_id = $2, claimed_at = CASE WHEN $2::int IS NULL THEN NULL ELSE NOW() END WHERE id = $1',
    [thread.id, agentId]
  );
  if (thread.lead_id && (thread.lead_agent_id || null) !== (agentId || null) && agentId) {
    await pool.query('UPDATE users SET assigned_agent_id = $1 WHERE id = $2 AND tenant_id = $3', [agentId, thread.lead_id, thread.tenant_id]);
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'agent_assign', $2::jsonb)`,
      [thread.lead_id, JSON.stringify({ assigned_agent_id: agentId, previous_assigned_agent_id: thread.lead_agent_id || null, by_user_id: by, by_role: byRole, via: 'inbox' })]
    ).catch(() => {});
  }
}

export async function setThreadStatus(thread, status, by, pool = getPool()) {
  await pool.query(
    `UPDATE inbox_threads SET status = $2::text, done_at = CASE WHEN $2::text = 'done' THEN NOW() ELSE NULL END,
            done_by = CASE WHEN $2::text = 'done' THEN $3::int ELSE NULL END WHERE id = $1`,
    [thread.id, status, by]
  );
}

/** Log an outgoing reply on the thread. */
export async function recordOutbound(thread, { kind, body, subject = null, leadMessageId = null, agentId = null }, pool = getPool()) {
  await pool.query(
    `INSERT INTO inbox_items (tenant_id, thread_id, kind, direction, subject, body, lead_message_id, agent_id)
     VALUES ($1, $2, $3, 'out', $4, $5, $6, $7)`,
    [thread.tenant_id, thread.id, kind, subject, String(body || ''), leadMessageId, agentId]
  );
  await pool.query(
    'UPDATE inbox_threads SET last_kind = $2, last_preview = $3, last_at = NOW(), assignee_id = COALESCE(assignee_id, $4) WHERE id = $1',
    [thread.id, kind, preview(`You: ${body}`), agentId]
  );
}

// ------------------------------------------------------------ inbound email

/** "Jane Doe <jane@x.com>" → { email, name }. Pure. */
export function parseAddress(raw) {
  if (Array.isArray(raw)) return parseAddress(raw[0]);
  if (!raw) return { email: null, name: null };
  if (typeof raw === 'object') {
    const email = String(raw.Email || raw.email || raw.address || '').trim().toLowerCase() || null;
    const name = String(raw.Name || raw.name || '').trim() || null;
    return { email, name };
  }
  const s = String(raw).trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null };
  const e = s.match(/[^\s<>"',;]+@[^\s<>"',;]+/);
  return { email: e ? e[0].toLowerCase() : null, name: null };
}

const addressList = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => parseAddress(x).email).filter(Boolean);
  return String(v).split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => parseAddress(x).email).filter(Boolean);
};

/** Readable text from an HTML email body. Pure. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, label) => {
      const l = label.replace(/<[^>]+>/g, '').trim();
      return l && l !== href ? `${l} (${href})` : href;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Drop the quoted history under a reply ("On … wrote:", "> …"). Pure. */
export function stripQuotedReply(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*>/.test(l)) break;
    if (/^\s*On\b.*\bwrote:\s*$/i.test(l) || (/^\s*On\b/i.test(l) && /wrote:\s*$/i.test(`${l} ${lines[i + 1] || ''}`))) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(l)) break;
    if (/^\s*From:\s.+/i.test(l) && /^\s*(Sent|Date):/i.test(lines[i + 1] || '')) break;
    out.push(l);
  }
  const s = out.join('\n').trim();
  return s || String(text || '').trim();
}

/**
 * The email from any of the inbound shapes we accept. Pure.
 *   Postmark:  { From, FromFull, To, ToFull, Subject, TextBody, HtmlBody, StrippedTextReply, MessageID }
 *   Resend:    { type: 'email.received', data: { from, to, subject, text, html, email_id } }
 *   SendGrid:  Inbound Parse form fields { from, to, subject, text, html }
 *   plain:     { from, to, subject, text, html }
 */
export function normalizeInboundEmail(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  let src = p;
  if (p.data && typeof p.data === 'object' && (p.type || p.data.from)) src = p.data; // Resend
  const from = parseAddress(src.FromFull || src.from || src.From || src.sender);
  if (!from.name && src.FromName) from.name = String(src.FromName).trim() || null;
  const to = src.ToFull ? addressList(src.ToFull) : addressList(src.to || src.To || src.recipient);
  const subject = String(src.Subject ?? src.subject ?? '').trim().slice(0, 300);
  const html = String(src.HtmlBody ?? src.html ?? '');
  const rawText = String(src.TextBody ?? src.text ?? src.plain ?? '');
  const text = rawText.trim() ? rawText : htmlToText(html);
  const reply = src.StrippedTextReply ? String(src.StrippedTextReply) : null;
  return {
    from,
    to,
    reply_to: parseAddress(src.ReplyTo || src.reply_to || src.replyTo || src['reply-to'] || null).email,
    subject,
    text: text.replace(/\r\n/g, '\n'),
    html,
    reply: (reply && reply.trim()) || stripQuotedReply(text),
    message_id: String(src.MessageID || src.message_id || src.email_id || src['Message-Id'] || '').slice(0, 200) || null,
  };
}

/**
 * Text fields from a multipart/form-data body (SendGrid's Inbound Parse
 * posts this way). File parts are ignored. Pure.
 */
export function parseMultipartFields(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ''));
  if (!m) return {};
  const boundary = `--${m[1] || m[2]}`;
  const body = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  const out = {};
  for (const part of body.split(boundary)) {
    const sep = part.indexOf('\r\n\r\n');
    if (sep < 0) continue;
    const head = part.slice(0, sep);
    const name = /name="([^"]+)"/i.exec(head)?.[1];
    if (!name || /filename=/i.test(head)) continue;
    out[name] = part.slice(sep + 4).replace(/\r\n$/, '');
  }
  return out;
}
