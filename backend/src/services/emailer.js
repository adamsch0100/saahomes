/**
 * Shared SMTP sender — reads OUTREACH_SMTP_* env vars.
 * Used by the alert digest, magic-link emails, and any transactional mail.
 * Falls back to the email_outbox queue when SMTP isn't configured on the
 * runtime (e.g. the deployed backend without SMTP env vars).
 *
 * A brokerage that has verified its own sending domain (settings.email
 * .sending_domain, status 'verified') sends through Resend instead, from
 * notify@<its domain>, when RESEND_API_KEY is set on the platform. Any other
 * brokerage's mail goes out from the platform's sending address when one is
 * set (PLATFORM_FROM_EMAIL), never from the home brokerage's.
 *
 * Platform mail (signup confirmations and anything else from the product
 * itself, not from a brokerage) goes through sendPlatformEmail.
 */
import nodemailer from 'nodemailer';
import getPool from '../config/database.js';
import { tenantById, siteUrlFor } from './tenantContext.js';
import { brandFor, isHomeTenant } from './brand.js';
import { platformSender } from './platform.js';

const FROM = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER || 'alerts@saahomes.com';
const RESEND_API = 'https://api.resend.com';
const RESEND_TIMEOUT_MS = 10000;

export const smtpConfigured = () =>
  !!(process.env.OUTREACH_SMTP_HOST && process.env.OUTREACH_SMTP_USER && process.env.OUTREACH_SMTP_PASSWORD);

/**
 * Verify the already-configured OUTREACH_SMTP_* transport without sending.
 * Returns { ok, configured, code?, error? }. Never throws, so a health probe
 * can report the leg instead of skipping it.
 */
export async function probeOutreachSmtp() {
  const host = process.env.OUTREACH_SMTP_HOST;
  const user = process.env.OUTREACH_SMTP_USER;
  const password = process.env.OUTREACH_SMTP_PASSWORD;
  if (!host || !user || !password) {
    return { ok: false, configured: false, error: 'not_configured' };
  }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.OUTREACH_SMTP_PORT || 587),
      secure: String(process.env.OUTREACH_SMTP_SECURE || '') === 'true',
      auth: { user, pass: password },
    });
    await transporter.verify();
    return { ok: true, configured: true };
  } catch (error) {
    return { ok: false, configured: true, code: error.responseCode || null, error: error.message };
  }
}

/** True when the platform can send from a brokerage's own domain. */
export const ownDomainSendingAvailable = () => !!process.env.RESEND_API_KEY;

const displayName = (s) => String(s ?? '').replace(/["<>\r\n]/g, '').trim();

async function resend(method, path, body) {
  const res = await fetch(`${RESEND_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${data?.message || data?.name || 'request failed'}`);
  return data;
}

/** A tenant's verified sending domain, or null. */
function verifiedSendingDomain(tenant) {
  const sd = tenant?.settings?.email?.sending_domain;
  return sd && sd.status === 'verified' && sd.domain ? sd : null;
}

/**
 * Send one email. opts.tenantId (the brokerage the email is from) picks the
 * brokerage's own domain when it has one; for another brokerage it also
 * defaults the display name and Reply-To to its brand. SAA's mail is unchanged.
 */
export async function sendEmail(to, subject, html, fromName = 'SAA Homes', opts = {}) {
  const { replyTo: replyToOpt, tenantId = null } = opts || {};
  let tenant = null;
  if (tenantId != null) {
    try { tenant = await tenantById(tenantId); } catch { tenant = null; }
  }
  let name = fromName;
  let replyTo = replyToOpt || null;
  if (tenant && !isHomeTenant(tenant)) {
    const brand = brandFor(tenant);
    if (!name || name === 'SAA Homes') name = brand.from_name || brand.name;
    if (replyToOpt === undefined) replyTo = brand.reply_to || brand.email || null;
  }

  const own = process.env.RESEND_API_KEY ? verifiedSendingDomain(tenant) : null;
  if (own) {
    await resend('POST', '/emails', {
      from: `${displayName(name)} <notify@${own.domain}>`,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });
    return;
  }

  if (!smtpConfigured()) throw new Error('OUTREACH_SMTP_* not set');
  const brokerage = tenant && !isHomeTenant(tenant);
  await smtpTransport().sendMail({
    from: `"${brokerage ? displayName(name) : name}" <${brokerage ? sharedFromAddress() : FROM}>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}

function smtpTransport() {
  return nodemailer.createTransport({
    host: process.env.OUTREACH_SMTP_HOST,
    port: Number(process.env.OUTREACH_SMTP_PORT || 587),
    secure: String(process.env.OUTREACH_SMTP_SECURE || '') === 'true',
    auth: { user: process.env.OUTREACH_SMTP_USER, pass: process.env.OUTREACH_SMTP_PASSWORD },
  });
}

/** The address another brokerage's shared mail and platform mail come from. */
export function sharedFromAddress() {
  return platformSender().address || FROM;
}

/** From and Reply-To for platform mail: the product's name and support. */
export function platformFrom() {
  const s = platformSender();
  return { from: `"${displayName(s.name)}" <${sharedFromAddress()}>`, replyTo: s.replyTo || null };
}

/** Send one email from the platform itself (not from any brokerage). */
export async function sendPlatformEmail(to, subject, html, { replyTo } = {}) {
  if (!smtpConfigured()) throw new Error('OUTREACH_SMTP_* not set');
  const f = platformFrom();
  const reply = replyTo === undefined ? f.replyTo : replyTo;
  await smtpTransport().sendMail({ from: f.from, to, subject, html, ...(reply ? { replyTo: reply } : {}) });
}

function shapeDomain(d) {
  return {
    id: d.id,
    domain: d.name,
    status: d.status,
    records: (d.records || []).map((r) => ({ type: r.type, name: r.name, value: r.value, status: r.status })),
  };
}

/** Register a sending domain with Resend: { id, domain, status, records }. */
export async function createSendingDomain(domain) {
  return shapeDomain(await resend('POST', '/domains', { name: domain }));
}

export async function getSendingDomain(id) {
  return shapeDomain(await resend('GET', `/domains/${encodeURIComponent(id)}`));
}

/** Ask Resend to check the DNS records now, then return the domain's state. */
export async function verifySendingDomain(id) {
  await resend('POST', `/domains/${encodeURIComponent(id)}/verify`);
  return getSendingDomain(id);
}

// ------------------------------------------------ brand helpers for emails

/**
 * The tenant and brand for an email to one users row: the row's brokerage,
 * narrowed to the buyer's assigned agent when there is one. (SAA's emails
 * keep their own per-agent handling in tenantBrand.js, so for SAA the agent
 * is left out and the brand is exactly SAA's.)
 */
export async function emailBrandForUser(user, { pool = getPool() } = {}) {
  const tenant = await tenantById(user?.tenant_id, { pool });
  let agent = null;
  if (user?.assigned_agent_id && !isHomeTenant(tenant)) {
    const r = await pool.query(
      `SELECT id, name, email, phone, brand_name, brokerage_name, brand_phone, voice_style, market_key
       FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin') AND status = 'active'`,
      [user.assigned_agent_id, tenant.id]
    );
    agent = r.rows[0] || null;
  }
  return { tenant, agent, brand: brandFor(tenant, { agent }) };
}

/** Base URL for links in a tenant's emails. SAA keeps the base it always used. */
export function emailSiteUrl(tenant, homeSite = 'https://saahomes.com') {
  return isHomeTenant(tenant) ? homeSite : siteUrlFor(tenant);
}

export const siteHost = (url) => String(url || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/** "Legal name · phone · domain" for a short email footer; missing parts are left out. */
export function contactLine(brand, site = brand?.site_url) {
  return [brand?.legal_name || brand?.name, brand?.phone, siteHost(site)].filter(Boolean).join(' · ');
}

/** Readable text color on an accent background: dark on light colors, white on dark. */
export function textOnAccent(hex, dark = '#1a1a1a') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return dark;
  const n = parseInt(m[1], 16);
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.35 ? dark : '#ffffff';
}

/**
 * The getAgentBrand-shaped object the nurture templates read, built from
 * brand.js for another brokerage. Never carries SAA's values; missing parts
 * are null. `tenantBrand: true` tells templates to drop SAA-only copy.
 */
export function nurtureBrand(tenant, brand, agent = null) {
  const agentName = brand.agent_name || null;
  return {
    tenantBrand: true,
    brandName: brand.name,
    brokerage: brand.legal_name,
    phone: brand.phone,
    tel: brand.tel,
    email: brand.email,
    voiceStyle: agent?.voice_style || 'warm',
    agentName,
    agentFirstName: agentName ? agentName.split(/\s+/)[0] : null,
    fromName: brand.from_name || brand.name,
    replyTo: brand.reply_to || brand.email || null,
    headerSubline: [brand.legal_name !== brand.name ? brand.legal_name : null, brand.market_name ? `${brand.market_name} Real Estate` : null]
      .filter(Boolean).join(' · '),
    brandLine: brand.footer_line,
    marketKey: tenant?.market_key || null,
    marketName: brand.market_name || null,
    siteUrl: brand.site_url,
    accent: brand.accent_color,
    tenantId: brand.tenant_id,
  };
}
