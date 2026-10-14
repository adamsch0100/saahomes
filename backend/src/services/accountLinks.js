/**
 * One-time links for staff accounts: "reset your password", "you're
 * invited, set your password" and "confirm your email" (a new brokerage's
 * owner, after signing up). Only a hash of each token is stored, links
 * point at the brokerage's own site (never at a Host header we don't know),
 * and using one link retires every other open link for that person.
 *
 * The confirm email to a new brokerage's owner is platform mail: it comes
 * from the product (its name, sending address and support), since the owner
 * just signed up for the product. Invites and resets come from the brokerage.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import { sendEmail, sendPlatformEmail, smtpConfigured } from './emailer.js';
import { platformIdentity } from './platform.js';
import { consoleUrlFor } from './tenantContext.js';
import { brandFor, isHomeTenant } from './brand.js';
import logger from '../utils/logger.js';

export const LINK_TTL_HOURS = { reset: 1, invite: 24 * 7, confirm: 24 * 7 };
const MAX_LINKS_PER_HOUR = 3;

export const hashLinkToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendOrQueue(pool, to, subject, html, fromName, tenantId, opts) {
  const platform = opts?.platform === true;
  const queueIt = () => pool.query(
    'INSERT INTO email_outbox (to_email, subject, html, tenant_id, platform) VALUES ($1, $2, $3, $4, $5)',
    [to, subject, html, tenantId, platform]
  );
  try {
    if (!smtpConfigured()) await queueIt();
    else if (platform) await sendPlatformEmail(to, subject, html);
    else await (opts ? sendEmail(to, subject, html, fromName, opts) : sendEmail(to, subject, html, fromName));
  } catch (e) {
    logger.error('account email send failed, queuing', { message: e.message });
    await queueIt();
  }
}

function emailHtml({ purpose, name, brokerage, link, hours, platform = null }) {
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hi ${esc(first)},` : 'Hi,';
  const lead = purpose === 'confirm' && platform
    ? `Welcome to ${esc(platform.name)}. ${esc(brokerage)} is set up. Confirm this is your email so we can send you leads, receipts and sign-in links.`
    : purpose === 'confirm'
    ? `Welcome to ${esc(brokerage)}. Confirm this is your email so we can send you leads, receipts and sign-in links.`
    : purpose === 'invite'
      ? `You've been set up with an account at ${esc(brokerage)}. Choose a password to sign in.`
      : `Someone asked to reset the password for your ${esc(brokerage)} account. If that was you, choose a new one below.`;
  const button = purpose === 'confirm' ? 'Confirm my email' : purpose === 'invite' ? 'Set my password' : 'Choose a new password';
  const expiry = hours >= 24 ? `${Math.round(hours / 24)} days` : `${hours} hour${hours === 1 ? '' : 's'}`;
  const tail = purpose !== 'reset'
    ? `This link works for ${expiry}.`
    : `This link works for ${expiry}. If you didn't ask for this, you can ignore this email and your password stays the same.`;
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <p>${hello}</p>
  <p>${lead}</p>
  <p style="margin:28px 0"><a href="${esc(link)}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${button}</a></p>
  <p style="font-size:13px;color:#6b7280">${tail}</p>
  <p style="font-size:12px;color:#9ca3af;word-break:break-all">${esc(link)}</p>${platform ? `
  <p style="font-size:12px;color:#9ca3af">${esc(platform.legal_name)}${platform.support_email ? ` · Questions? <a href="mailto:${esc(platform.support_email)}" style="color:#6b7280">${esc(platform.support_email)}</a>` : ''}</p>` : ''}
</div>`;
}

/**
 * Create a link for user (a users row) and email it. tenant is the tenant
 * the link belongs to (req.tenant, or a tenants row for a new brokerage).
 * Returns { sent: boolean } — false when the per-hour cap is hit.
 */
export async function issueAccountLink({ user, purpose, tenant, pool = getPool() }) {
  const kind = ['invite', 'confirm'].includes(purpose) ? purpose : 'reset';
  const recent = await pool.query(
    "SELECT COUNT(*)::int AS n FROM password_resets WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
    [user.id]
  );
  if (recent.rows[0].n >= MAX_LINKS_PER_HOUR) return { sent: false };

  const token = crypto.randomBytes(32).toString('base64url');
  const hours = LINK_TTL_HOURS[kind];
  await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(hours => $4))`,
    [user.id, hashLinkToken(token), kind, hours]
  );
  const link = kind === 'confirm'
    ? consoleUrlFor(tenant, `/admin?confirm=${token}`)
    : consoleUrlFor(tenant, `/reset-password?token=${token}`);
  // Another brokerage's name comes from its brand (never SAA's); SAA's is unchanged.
  const tenantId = Number(tenant?.id ?? 1);
  const home = isHomeTenant({ id: tenantId });
  const brand = home ? null : brandFor({ ...tenant, id: tenantId });
  const brokerage = home ? tenant?.name || 'SAA Homes' : brand.name;
  const subject = kind === 'confirm' ? `Confirm your email for ${brokerage}`
    : kind === 'invite' ? `You're invited to ${brokerage}` : `Reset your ${brokerage} password`;
  // A new brokerage's owner confirming their email hears from the platform.
  const fromPlatform = kind === 'confirm' && !home;
  const html = emailHtml({ purpose: kind, name: user.name, brokerage, link, hours, platform: fromPlatform ? platformIdentity() : null });
  if (home) await sendOrQueue(pool, user.email, subject, html, brokerage, user.tenant_id);
  else if (fromPlatform) await sendOrQueue(pool, user.email, subject, html, null, user.tenant_id, { platform: true });
  else {
    await sendOrQueue(pool, user.email, subject, html, brand.from_name || brokerage, user.tenant_id,
      { tenantId, replyTo: brand.reply_to || brand.email || null });
  }
  logger.info('account link issued', { user_id: user.id, purpose: kind });
  return { sent: true };
}

/**
 * The open link for a raw token in this tenant, joined to its user, or null.
 * Password links (reset, invite) by default; an email-confirm link never sets
 * a password.
 */
export async function findOpenLink(token, tenantId, pool = getPool(), { purposes = ['reset', 'invite'] } = {}) {
  if (!token || typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const r = await pool.query(
    `SELECT pr.id, pr.purpose, pr.user_id, u.email, u.name, u.role, u.tenant_id
     FROM password_resets pr JOIN users u ON u.id = pr.user_id
     WHERE pr.token_hash = $1 AND pr.tenant_id = $2 AND u.tenant_id = $2
       AND pr.used_at IS NULL AND pr.expires_at > NOW() AND u.status = 'active'
       AND pr.purpose = ANY($3::text[])`,
    [hashLinkToken(token), tenantId, purposes]
  );
  return r.rows[0] || null;
}

/** Retire every open link for a user (after a password is set). */
export async function retireLinks(userId, pool = getPool()) {
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
}
