/**
 * Nadia drafts a reply; the agent edits it and presses Send.
 *
 * createDraft() only ever writes a reply_drafts row. Nothing reaches the lead
 * until sendDraft() runs, and only the cockpit's Send button calls that, with
 * the agent's own (possibly edited) words. Drafts use the same chat model as
 * Nadia; without its key the agent gets a plain starting point instead.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { brandFor, isHomeTenant } from './brand.js';
import { siteUrlFor } from './tenantContext.js';
import { getConsents } from './consent.js';
import { buildTimeline } from './crmService.js';
import { sendText } from './smsService.js';

const TEXT_MAX = 320;

/** Swappable in tests: the model call. */
export const draftTransport = {
  complete: async (messages, opts) => (await import('../controllers/chatController.js')).chatCompletion(messages, opts),
};

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

/** A plain opener from what the lead did last, when the model isn't available. Pure. */
export function templateDraft({ channel, lead, agentName, brandName, timeline = [] }) {
  const hi = firstName(lead.name) ? `Hi ${firstName(lead.name)}` : 'Hi there';
  const me = agentName ? `it's ${firstName(agentName)} with ${brandName}` : `it's ${brandName}`;
  const latest = timeline.find((t) => ['tour', 'seller', 'save', 'view', 'reaction', 'text', 'nadia'].includes(t.kind));
  let line = 'Just checking in on your home search. Is there anything I can help with this week?';
  if (latest?.kind === 'tour') line = 'I saw your tour request and would love to set it up. What day and time work best?';
  else if (latest?.kind === 'seller') line = 'I saw you were looking at your home’s value. I’m happy to walk you through what it would sell for today.';
  else if (latest?.kind === 'text') line = 'Thanks for your message! Happy to help.';
  else if (latest?.kind === 'nadia') line = 'I saw your question about buying. I can walk you through the numbers whenever you like.';
  else if (latest && /^(Saved|Viewed|Loved) /.test(latest.title)) {
    const home = latest.title.replace(/^(Saved|Viewed|Loved) /, '').replace(/\s*\(.*\)$/, '');
    line = `I noticed you’ve been looking at ${home}. Would you like to see it in person?`;
  }
  if (channel === 'sms') return { subject: null, body: `${hi}, ${me}. ${line}` };
  return {
    subject: latest?.kind === 'tour' ? 'Your tour request' : 'Your home search',
    body: `${hi},\n\n${line}\n\n${agentName ? `${agentName}\n` : ''}${brandName}`,
  };
}

function promptFor({ channel, lead, agent, brand, timeline, notes, lastInbound }) {
  const voice = agent?.voice_style || 'warm';
  const facts = [
    `Lead: ${lead.name || lead.email}${lead.lifecycle_stage ? ` (stage: ${lead.lifecycle_stage})` : ''}`,
    lead.tags?.length ? `Tags: ${lead.tags.join(', ')}` : null,
    lead.source ? `Came from: ${lead.source}` : null,
    `Agent writing: ${agent?.name || 'the agent'} at ${brand.name}`,
    lastInbound ? `The lead's latest message to us: "${String(lastInbound).slice(0, 400)}"` : null,
    notes.length ? `Agent notes:\n${notes.map((n) => `- ${String(n).slice(0, 200)}`).join('\n')}` : null,
    `What the lead did recently (newest first):\n${timeline.slice(0, 15).map((t) => `- ${t.title}${t.detail ? `: ${String(t.detail).slice(0, 120)}` : ''}`).join('\n') || '- nothing yet'}`,
  ].filter(Boolean).join('\n\n');
  const shape = channel === 'sms'
    ? `Write one text message, under ${TEXT_MAX} characters, first person as the agent. No links, no emojis, no sign-off line, no "Reply STOP" (added automatically).`
    : 'Write a short email (under 120 words), first person as the agent. First line exactly "SUBJECT: <subject>", then a blank line, then the body, ending with the agent\'s first name.';
  return [
    {
      role: 'system',
      content: `You draft replies for a real estate agent at ${brand.name}. Tone: ${voice}, plain and friendly, like a helpful local agent. Use only the facts given; never invent homes, prices, dates or promises. Suggest one clear next step. Fair housing: never mention protected characteristics or describe neighborhoods by who lives there. ${shape} Output only the message.`,
    },
    { role: 'user', content: facts },
  ];
}

function parseEmail(text) {
  const m = String(text).match(/^\s*SUBJECT:\s*(.+)\n+([\s\S]+)$/i);
  if (m) return { subject: m[1].trim().slice(0, 160), body: m[2].trim() };
  return { subject: 'Your home search', body: String(text).trim() };
}

/**
 * Draft a reply. Stores and returns { id, channel, subject, body, source }.
 * source 'nadia' (the model) or 'template' (no model available).
 */
export async function createDraft({ tenant, leadId, agent, channel = 'sms' }, pool = getPool()) {
  if (!['sms', 'email'].includes(channel)) throw Object.assign(new Error('Pick text or email'), { status: 400 });
  const { rows: [lead] } = await pool.query(
    'SELECT id, name, email, phone, lifecycle_stage, tags, source FROM users WHERE id = $1 AND tenant_id = $2', [leadId, tenant.id]
  );
  if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
  const brand = brandFor(tenant, isHomeTenant(tenant) ? {} : { agent });
  const brandName = isHomeTenant(tenant) ? brand.name : brandFor(tenant).name;
  const timeline = await buildTimeline(lead.id, tenant.id, { limit: 40 }, pool);
  const { rows: noteRows } = await pool.query(
    `SELECT body FROM lead_notes WHERE lead_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     ORDER BY pinned DESC, created_at DESC LIMIT 3`, [lead.id, tenant.id]
  );
  const lastInbound = timeline.find((t) => t.direction === 'in')?.detail || null;

  let draft;
  let source = 'nadia';
  try {
    const text = await draftTransport.complete(
      promptFor({ channel, lead, agent, brand: { name: brandName }, timeline, notes: noteRows.map((r) => r.body), lastInbound }),
      { maxTokens: 1200, temperature: 0.6 }
    );
    const clean = text.replace(/\[\[[A-Z_]+\]\]/g, '').trim();
    draft = channel === 'sms' ? { subject: null, body: clean.replace(/^["“]|["”]$/g, '').slice(0, TEXT_MAX) } : parseEmail(clean);
  } catch (e) {
    if (e.code !== 'not_configured') logger.warn('reply draft model failed', { message: e.message });
    source = 'template';
    draft = templateDraft({ channel, lead, agentName: agent?.name || null, brandName, timeline });
  }
  const { rows: [row] } = await pool.query(
    `INSERT INTO reply_drafts (tenant_id, lead_id, agent_id, channel, subject, body, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, channel, subject, body, source, status, created_at`,
    [tenant.id, lead.id, agent?.id || null, channel, draft.subject, draft.body, source]
  );
  return row;
}

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A one-to-one email from the agent, in the brokerage's brand. Pure. */
export function leadEmailHtml({ body, brand, site }) {
  const paras = String(body || '').split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#1f2937;font-size:15px">
  ${paras}
  <p style="margin-top:24px;font-size:12px;color:#6b7280">${escHtml(brand.name)}${brand.phone ? ` · ${escHtml(brand.phone)}` : ''}${site ? ` · <a href="${escHtml(site)}" style="color:#6b7280">${escHtml(site.replace(/^https?:\/\//, ''))}</a>` : ''}</p>
</div>`;
}

/**
 * Email a lead from the cockpit. Refuses when the lead turned email off.
 * Sends now when email is set up, else queues it in the outbox.
 */
export async function sendLeadEmail({ tenant, leadId, agent, subject, body, draftId = null }, pool = getPool()) {
  const text = String(body || '').trim();
  const subj = String(subject || '').trim().slice(0, 160) || 'Your home search';
  if (!text) return { ok: false, reason: 'empty' };
  const { rows: [lead] } = await pool.query(
    "SELECT id, email, status FROM users WHERE id = $1 AND tenant_id = $2 AND COALESCE(role, 'client') = 'client'",
    [leadId, tenant.id]
  );
  if (!lead?.email || /\.invalid$/i.test(lead.email)) return { ok: false, reason: 'no_email' };
  if (lead.status === 'unsubscribed') return { ok: false, reason: 'email_off' };
  const consents = await getConsents(lead.id, pool);
  if (consents.email?.status === 'revoked') return { ok: false, reason: 'email_off' };

  const brand = brandFor(tenant, isHomeTenant(tenant) ? {} : { agent });
  const html = leadEmailHtml({ body: text, brand, site: siteUrlFor(tenant) });
  const fromName = agent?.name ? `${agent.name}, ${brandFor(tenant).name}` : (brand.from_name || brand.name);
  const { rows: [msg] } = await pool.query(
    `INSERT INTO lead_messages (tenant_id, lead_id, agent_id, channel, direction, kind, to_addr, from_addr, subject, body, status, draft_id)
     VALUES ($1, $2, $3, 'email', 'out', 'conversation', $4, $5, $6, $7, 'queued', $8) RETURNING *`,
    [tenant.id, lead.id, agent?.id || null, lead.email, agent?.email || null, subj, text, draftId]
  );
  try {
    const emailer = await import('./emailer.js');
    if (emailer.smtpConfigured() || emailer.ownDomainSendingAvailable()) {
      // Replies come back to the team inbox when the brokerage set up an inbound address.
      const replyTo = tenant.settings?.inbound?.reply_to || agent?.email || undefined;
      await emailer.sendEmail(lead.email, subj, html, fromName, { tenantId: tenant.id, replyTo });
      await pool.query("UPDATE lead_messages SET status = 'sent' WHERE id = $1", [msg.id]);
    } else {
      await pool.query('INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)', [lead.email, subj, html, tenant.id]);
    }
    if (agent?.id) await pool.query('UPDATE users SET first_contacted_at = NOW() WHERE id = $1 AND first_contacted_at IS NULL', [lead.id]);
    const { rows: [done] } = await pool.query('SELECT * FROM lead_messages WHERE id = $1', [msg.id]);
    return { ok: true, message: done };
  } catch (e) {
    await pool.query("UPDATE lead_messages SET status = 'failed', error = $2 WHERE id = $1", [msg.id, String(e.message).slice(0, 300)]);
    logger.warn('lead email failed', { message: e.message });
    return { ok: false, reason: 'failed' };
  }
}

/**
 * The agent pressed Send: deliver their (edited) words through the usual
 * checks (consent, STOP, quiet hours for texts). A draft is sent at most once.
 */
export async function sendDraft({ tenant, draftId, agent, body, subject }, pool = getPool()) {
  const { rows: [d] } = await pool.query(
    "SELECT * FROM reply_drafts WHERE id = $1 AND tenant_id = $2", [draftId, tenant.id]
  );
  if (!d) return { ok: false, reason: 'not_found' };
  if (d.status !== 'draft') return { ok: false, reason: 'already_sent' };
  const finalBody = String(body ?? d.body).trim();
  const r = d.channel === 'sms'
    ? await sendText({ tenant, leadId: d.lead_id, body: finalBody, agentId: agent?.id || null, kind: 'conversation', draftId: d.id }, pool)
    : await sendLeadEmail({ tenant, leadId: d.lead_id, agent, subject: subject ?? d.subject, body: finalBody, draftId: d.id }, pool);
  if (r.ok) {
    await pool.query(
      "UPDATE reply_drafts SET status = 'sent', sent_at = NOW(), body = $2, subject = $3, message_id = $4 WHERE id = $1",
      [d.id, finalBody, subject ?? d.subject, r.message?.id || null]
    );
  }
  return r;
}
