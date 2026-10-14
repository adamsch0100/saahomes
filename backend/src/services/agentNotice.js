/**
 * Tell a client's agent that something needs them: a tour was asked for, a
 * market analysis (CMA) was asked for, a client said they're thinking of
 * selling. Goes to the assigned agent, or to the brokerage's owners when no
 * one is assigned; by email in the brokerage's brand, and by text when texting
 * is set up. Requests that need a follow-up also put the client at the top of
 * today's calls (next touch due now).
 *
 * Never throws: a notice must not break the request that triggered it.
 */
import getPool from '../config/database.js';
import { tenantById } from './tenantContext.js';
import { brandFor } from './brand.js';
import { sendEmail, emailSiteUrl } from './emailer.js';
import { agentNoticeEmail } from './stayEmails.js';
import { sendTextIfAllowed } from './textHook.js';

/** Staff who should hear about this client: the assigned agent, else the owners. */
export async function agentsForClient(client, pool = getPool()) {
  if (client?.assigned_agent_id) {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, role, tenant_id FROM users
       WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin') AND status = 'active'`,
      [client.assigned_agent_id, client.tenant_id]
    );
    if (rows.length) return rows;
  }
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, role, tenant_id FROM users
     WHERE tenant_id = $1 AND role = 'admin' AND status = 'active' AND email IS NOT NULL
     ORDER BY id LIMIT 5`,
    [client.tenant_id]
  );
  return rows;
}

/**
 * @param {object} opts
 * @param {object} opts.client users row of the client
 * @param {string} opts.kind tour_request | cma_request | seller_start | seller_question
 * @param {string} opts.title one line, e.g. "Jamie Rivera asked for a tour"
 * @param {string[]} [opts.lines] details
 * @param {boolean} [opts.dueNow] make the client due for a call today
 * @param {Function} [opts.send] email sender (tests)
 */
export async function notifyAgent({ client, kind, title, lines = [], dueNow = false, send = sendEmail, pool = getPool() } = {}) {
  const result = { emailed: 0, texted: 0 };
  try {
    if (!client?.id) return result;
    if (dueNow) {
      await pool.query(
        "UPDATE users SET next_touch_at = NOW() WHERE id = $1 AND tenant_id = $2 AND COALESCE(lifecycle_stage, '') <> 'lost'",
        [client.id, client.tenant_id]
      ).catch(() => {});
    }
    const tenant = await tenantById(client.tenant_id, { pool });
    const brand = brandFor(tenant);
    const site = emailSiteUrl(tenant);
    const staff = await agentsForClient(client, pool);
    const html = agentNoticeEmail({ brand, site, title, lines, link: `${site}/agent/` });
    for (const agent of staff) {
      if (agent.email) {
        try {
          await send(agent.email, title, html, brand.name, { tenantId: tenant.id, replyTo: client.email || undefined });
          result.emailed += 1;
        } catch (e) {
          // No mail transport (local dev, tests): queue it like other mail.
          await pool.query(
            'INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)',
            [agent.email, title, html, tenant.id]
          ).catch(() => {});
        }
      }
      const text = await sendTextIfAllowed({
        tenantId: tenant.id, userId: agent.id, kind, body: [title, ...lines.slice(0, 2)].join(' · ').slice(0, 300),
      }).catch(() => ({ sent: false }));
      if (text?.sent) result.texted += 1;
    }
  } catch (e) {
    console.error('[agent-notice] failed:', e.message);
  }
  return result;
}
