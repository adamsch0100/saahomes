/**
 * Leads from outside lead sources, without Follow Up Boss in the middle.
 *
 * Each brokerage gets one secret intake key (tenants.settings.intake.key,
 * shaped t<tenant id>_<32 hex>). With it, leads arrive on:
 *   POST /api/intake/<key>/email      a lead notification email, as the mail
 *                                     provider's inbound JSON (Postmark,
 *                                     Resend, SendGrid Inbound Parse, plain)
 *   POST /api/intake/<key>/zillow     the same, known to be Zillow
 *   POST /api/intake/<key>/realtor    … Realtor.com
 *   POST /api/intake/<key>/homes      … Homes.com
 *   POST /api/intake/<key>/webhook    JSON from a web form or Zapier
 *   GET|POST /api/intake/<key>/facebook   Facebook lead ads (Webhooks + the
 *                                     Graph API's lead retrieval, per
 *                                     developers.facebook.com docs)
 * Zillow, Realtor.com and Homes.com deliver leads to agents by email; we
 * read those emails the agent's mail forwards to us. No portal is scraped
 * and no private API is used.
 *
 * Every lead is matched to an existing contact by email, then phone, inside
 * the brokerage (never across brokerages). New leads get a source tag, an
 * agent by the owner's rules (source, city, price) or by taking turns, a
 * note with what they said, an inbox item, a push to their agent, and any
 * action plan set to start for that source.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { tenantById, runWithTenant } from './tenantContext.js';
import { isHomeTenant } from './brand.js';
import { crmModeOf } from './crmMode.js';
import { normalizePhone } from './smsService.js';
import { recordEvent } from './events.js';
import { recordInboundSafe, pushStaff, staffToTell } from './teamInbox.js';
import { triggerPlans, onTagsAdded, normalizeTag } from './actionPlans.js';

export const SOURCE_LABELS = {
  zillow: 'Zillow',
  realtor: 'Realtor.com',
  homes: 'Homes.com',
  facebook: 'Facebook',
  zapier: 'Zapier',
  webhook: 'Web form',
  email: 'Email lead',
  contact: 'Contact form',
  nadia: 'Nadia chat',
  webform: 'Website form',
  home_value: 'Home value form',
  website: 'Website',
  import: 'Imported',
};

/** Swappable in tests: calls out (Facebook's Graph API) and the clock. */
export const intakeTransport = {
  fetch: (...args) => globalThis.fetch(...args),
  now: () => new Date(),
};

export const FACEBOOK_GRAPH = 'https://graph.facebook.com/v21.0';
const KEY_RE = /^t(\d{1,9})_([a-f0-9]{32})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PORTAL_DOMAINS = {
  zillow: /(^|\.)zillow\.com$|(^|\.)zillowgroup\.com$|(^|\.)trulia\.com$/i,
  realtor: /(^|\.)realtor\.com$|(^|\.)move\.com$/i,
  homes: /(^|\.)homes\.com$/i,
};
const TOLL_FREE = /^(800|888|877|866|855|844|833)/;

// ------------------------------------------------------------ the key

export function newIntakeKey(tenantId) {
  return `t${Number(tenantId)}_${crypto.randomBytes(16).toString('hex')}`;
}

/** The brokerage's intake key, made on first use. */
export async function ensureIntakeKey(tenantId, pool = getPool()) {
  const { rows: [t] } = await pool.query("SELECT settings->'intake'->>'key' AS key FROM tenants WHERE id = $1", [tenantId]);
  if (t?.key && KEY_RE.test(t.key)) return t.key;
  return rotateIntakeKey(tenantId, pool);
}

export async function rotateIntakeKey(tenantId, pool = getPool()) {
  const key = newIntakeKey(tenantId);
  await pool.query(
    `UPDATE tenants SET settings = jsonb_set(settings, '{intake}', COALESCE(settings->'intake', '{}'::jsonb) || jsonb_build_object('key', $2::text))
     WHERE id = $1`,
    [tenantId, key]
  );
  (await import('./tenantContext.js')).clearTenantCache();
  return key;
}

/** The brokerage this key belongs to, or null. Constant-time compare. */
export async function tenantForKey(rawKey, pool = getPool()) {
  const key = String(rawKey || '').trim();
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const { rows: [t] } = await pool.query("SELECT id, status, settings->'intake'->>'key' AS key FROM tenants WHERE id = $1", [Number(m[1])]);
  if (!t?.key || t.status === 'suspended') return null;
  const a = Buffer.from(String(t.key));
  const b = Buffer.from(key);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return tenantById(t.id, { pool });
}

// ------------------------------------------------------------ parsing

const domainOf = (email) => String(email || '').split('@')[1]?.toLowerCase() || '';
const clean = (s, max = 255) => {
  const v = String(s ?? '').replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, max) : null;
};
const looksLikeName = (s) => /^[A-Z][A-Za-z'’.-]+(?: [A-Z][A-Za-z'’.-]*){0,3}$/.test(String(s || '').trim())
  && !/\b(New|Lead|Contact|Inquiry|Zillow|Realtor|Homes|View|Reply|Listing|Property|Price|Street|St|Ave|Road)\b/.test(s);

/** Which portal a lead email came from: by sender, or a forwarded "From:" line. Pure. */
export function detectLeadSource({ fromEmail, text = '', subject = '' }) {
  const domains = [domainOf(fromEmail)];
  for (const m of String(text).matchAll(/^\s*\*?From:\*?\s.*?([A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,}))/gim)) domains.push(m[2].toLowerCase());
  for (const [source, re] of Object.entries(PORTAL_DOMAINS)) {
    if (domains.some((d) => re.test(d))) return source;
  }
  // A forward that lost its header but is plainly a portal lead.
  if (/\b(zillow premier agent|new zillow lead|zillow\.com\/homedetails)/i.test(`${subject}\n${text}`) && /\b(lead|contact|inquiry|interested)\b/i.test(`${subject}\n${text}`)) return 'zillow';
  return null;
}

const LABELS = {
  name: /^(?:full name|name|contact name|lead name|buyer name|buyer|from)$/i,
  first_name: /^(?:first name|first)$/i,
  last_name: /^(?:last name|last|surname)$/i,
  email: /^(?:e-?mail(?: address)?|email address)$/i,
  phone: /^(?:phone(?: number)?|mobile|cell|telephone|tel)$/i,
  message: /^(?:message|comments?|question|notes?|inquiry|lead message|their message)$/i,
  property: /^(?:property|address|property address|listing|home|listing address|regarding|interested in)$/i,
  price: /^(?:price|list price|listing price|budget|price range)$/i,
  city: /^(?:city|area|location)$/i,
};

/**
 * A lead from the text of a lead notification email (Zillow, Realtor.com,
 * Homes.com or any forwarded lead email). Labeled fields ("Name:", "Phone:")
 * win; otherwise the first contact details that aren't the portal's own.
 * Pure. Returns { name, email, phone, message, property_url, property_address, city, price }.
 */
export function parseLeadEmail({ subject = '', text = '', fromEmail = '', replyTo = '' } = {}) {
  const body = String(text || '').replace(/\r\n/g, '\n').replace(/ /g, ' ');
  const lines = body.split('\n').map((l) => l.replace(/^[\s>*]+|[\s*]+$/g, ''));
  const out = { name: null, email: null, phone: null, message: null, property_url: null, property_address: null, city: null, price: null };
  const label = {};
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^([A-Za-z][A-Za-z -]{1,24}?)\s*[:：]\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const key = Object.keys(LABELS).find((k) => LABELS[k].test(m[1].trim()));
    if (!key || label[key]) continue;
    let value = m[2].trim();
    // A forward's "From: Site <forms@site.com>" header is the sender, not the lead.
    if (key === 'name' && /^from$/i.test(m[1].trim()) && /@/.test(value)) continue;
    if (!value && lines[i + 1]) value = lines[i + 1].trim(); // "Message:" then the text on the next line
    if (key === 'message') {
      const more = [value];
      for (let j = i + 1; j < lines.length && more.length < 12; j += 1) {
        if (!lines[j] || /^[A-Za-z][A-Za-z -]{1,24}:\s/.test(lines[j])) break;
        if (j === i + 1 && !m[2].trim()) continue;
        more.push(lines[j]);
      }
      value = more.filter(Boolean).join(' ');
    }
    if (value) label[key] = value;
  }

  // Email: labeled, then Reply-To, then the first one that isn't the portal's or a forward header's.
  const portal = (e) => Object.values(PORTAL_DOMAINS).some((re) => re.test(domainOf(e))) || /no-?reply|donotreply|notifications?@/i.test(e);
  const headerLine = (l) => /^(To|Cc|From|Sent|Date|Subject)\s*:/i.test(l);
  const emailIn = (s) => (String(s || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [])[0];
  const labeled = emailIn(label.email);
  const reply = parseReplyTo(replyTo);
  if (labeled) out.email = labeled.toLowerCase();
  else if (reply && !portal(reply)) out.email = reply;
  else {
    for (const l of lines) {
      if (headerLine(l) && !/^Reply-To\s*:/i.test(l)) continue;
      for (const e of l.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []) {
        if (!portal(e) && e.toLowerCase() !== String(fromEmail || '').toLowerCase()) { out.email = e.toLowerCase(); break; }
      }
      if (out.email) break;
    }
  }

  // Phone: labeled, else the first non-toll-free number before the footer.
  const phoneRe = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/;
  const phoneFrom = (s) => {
    const m = phoneRe.exec(String(s || ''));
    return m && !TOLL_FREE.test(m[1]) ? `${m[1]}${m[2]}${m[3]}` : null;
  };
  out.phone = phoneFrom(label.phone);
  if (!out.phone) {
    for (const l of lines) {
      if (/unsubscribe|privacy|copyright|©|customer support|help center/i.test(l)) break;
      if (headerLine(l) || /https?:\/\//.test(l)) continue;
      out.phone = phoneFrom(l);
      if (out.phone) break;
    }
  }

  // Property link and address.
  const urls = body.match(/https?:\/\/[^\s<>"')\]]+/g) || [];
  out.property_url = urls.find((u) => /zillow\.com\/homedetails|zillow\.com\/homes\/|realtor\.com\/realestateandhomes-detail|homes\.com\/property|\/homes-for-sale\/[^/\s]+|\/listing\//i.test(u)) || null;
  const addrRe = /\b\d{1,6}\s+[A-Za-z0-9 .'#-]+?,\s*([A-Za-z .'-]+?),\s*([A-Z]{2})\s*(\d{5})?\b/;
  const addrMatch = addrRe.exec(label.property || '') || lines.map((l) => addrRe.exec(l)).find(Boolean);
  if (addrMatch) {
    out.property_address = clean(addrMatch[0], 200);
    out.city = clean(addrMatch[1], 100);
  } else if (label.property) {
    out.property_address = clean(label.property, 200);
  }
  if (!out.property_url && out.property_address === null && label.property && /^https?:/.test(label.property)) out.property_url = label.property;
  if (label.city) out.city = clean(label.city, 100);

  // Price: labeled, else the first dollar amount that looks like a home price.
  const priceIn = (s) => {
    const m = /\$\s?(\d{1,3}(?:,\d{3})+|\d{5,})(?:\.\d+)?\s*([kKmM])?/.exec(String(s || ''));
    if (!m) return null;
    let n = Number(m[1].replace(/,/g, ''));
    if (/k/i.test(m[2] || '')) n *= 1000;
    if (/m/i.test(m[2] || '')) n *= 1000000;
    return n >= 10000 ? n : null;
  };
  out.price = priceIn(label.price) || priceIn(lines.find((l) => /\$\s?\d/.test(l) && !/fee|commission|save/i.test(l)));

  // Name: labeled, else from the subject, else the line just above the email.
  if (label.first_name || label.last_name) out.name = clean([label.first_name, label.last_name].filter(Boolean).join(' '));
  else if (label.name && !emailIn(label.name)) out.name = clean(label.name.replace(/<.*>/, ''));
  if (!out.name) {
    const s = String(subject || '').replace(/^(?:fwd?|fw|re):\s*/i, '');
    const m = /(?:from|lead:|contact:|inquiry:)\s+([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3})/.exec(s)
      || /^([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3})\s+(?:is interested|wants|requested|has a question|sent you|would like|asked)/.exec(s)
      || /(?:new (?:\w+ )?(?:lead|contact|inquiry))[:\s-]+([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3})/i.exec(s);
    if (m && looksLikeName(m[1])) out.name = m[1].trim();
  }
  if (!out.name && out.email) {
    const at = lines.findIndex((l) => l.toLowerCase().includes(out.email));
    for (let j = at - 1; j >= Math.max(0, at - 3); j -= 1) {
      if (looksLikeName(lines[j])) { out.name = lines[j].trim(); break; }
    }
  }

  // What they said: labeled, else the first quoted sentence.
  out.message = clean(label.message, 2000);
  if (!out.message) {
    const q = /[“"]([^”"]{8,1000})[”"]/.exec(body);
    if (q) out.message = clean(q[1], 2000);
  }
  return out;
}

function parseReplyTo(v) {
  const m = String(v || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

/**
 * A lead from a JSON web form or Zapier zap. Accepts the common field names
 * (name / full_name / first_name + last_name, email, phone / phone_number,
 * message / comments, property / property_url / address, city, price,
 * source, tags). Pure.
 */
export function parseWebhookLead(raw = {}) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = b[k] ?? b[k.replace(/_/g, ' ')] ?? b[k.toUpperCase()];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return null;
  };
  const first = pick('first_name', 'firstName', 'first');
  const last = pick('last_name', 'lastName', 'last');
  const url = pick('property_url', 'propertyUrl', 'listing_url', 'listingUrl', 'url', 'link');
  const property = pick('property', 'property_address', 'address', 'listing');
  const tags = pick('tags', 'tag');
  const priceRaw = pick('price', 'list_price', 'budget', 'max_price');
  const price = priceRaw == null ? null : Number(String(priceRaw).replace(/[^0-9.]/g, '')) || null;
  return {
    name: clean(pick('name', 'full_name', 'fullName', 'contact_name') || [first, last].filter(Boolean).join(' ')),
    email: clean(pick('email', 'email_address', 'emailAddress', 'e-mail'), 255)?.toLowerCase() || null,
    phone: clean(pick('phone', 'phone_number', 'phoneNumber', 'mobile', 'cell'), 40),
    message: clean(pick('message', 'comments', 'comment', 'notes', 'note', 'question', 'inquiry'), 2000),
    property_url: url && /^https?:\/\//i.test(String(url)) ? clean(url, 500) : (property && /^https?:\/\//i.test(String(property)) ? clean(property, 500) : null),
    property_address: property && !/^https?:\/\//i.test(String(property)) ? clean(property, 200) : null,
    city: clean(pick('city', 'area', 'location'), 100),
    price: price && price >= 1000 ? price : null,
    source_name: clean(pick('source', 'lead_source', 'leadSource'), 40),
    tags: (Array.isArray(tags) ? tags : String(tags || '').split(',')).map(normalizeTag).filter(Boolean).slice(0, 10),
  };
}

/** A lead from Facebook's Graph API lead object ({ field_data: [{ name, values }] }). Pure. */
export function parseFacebookLead(lead = {}) {
  const fields = {};
  const extra = [];
  for (const f of Array.isArray(lead.field_data) ? lead.field_data : []) {
    const name = String(f?.name || '').toLowerCase();
    const value = Array.isArray(f?.values) ? f.values.filter(Boolean).join(', ') : String(f?.values ?? '');
    if (!name || !value) continue;
    if (['full_name', 'first_name', 'last_name', 'email', 'phone_number', 'city', 'zip_code', 'post_code', 'street_address', 'state'].includes(name)) fields[name] = value;
    else extra.push(`${name.replace(/_/g, ' ').replace(/\?$/, '')}: ${value}`);
  }
  return {
    name: clean(fields.full_name || [fields.first_name, fields.last_name].filter(Boolean).join(' ')),
    email: clean(fields.email)?.toLowerCase() || null,
    phone: clean(fields.phone_number, 40),
    message: extra.length ? extra.join('\n').slice(0, 2000) : null,
    property_url: null,
    property_address: clean([fields.street_address, fields.city, fields.state, fields.zip_code || fields.post_code].filter(Boolean).join(', '), 200),
    city: clean(fields.city, 100),
    price: null,
    facebook_lead_id: lead.id ? String(lead.id) : null,
  };
}

/** X-Hub-Signature-256: "sha256=" + HMAC-SHA256 of the raw body with the app secret. */
export function verifyFacebookSignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !Buffer.isBuffer(rawBody)) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(String(header));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function facebookSettings(tenant) {
  const fb = tenant?.settings?.intake?.facebook || {};
  return {
    page_token: String(fb.page_token || '').trim() || null,
    app_secret: String(fb.app_secret || process.env.FACEBOOK_APP_SECRET || '').trim() || null,
    verify_token: String(fb.verify_token || '').trim() || null,
  };
}

/** Read one lead by its leadgen id (GET /{lead-id}). */
export async function fetchFacebookLead(leadgenId, pageToken) {
  const res = await intakeTransport.fetch(
    `${FACEBOOK_GRAPH}/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(pageToken)}`,
    { method: 'GET', signal: AbortSignal.timeout(10000) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Facebook returned ${res.status}`);
  return data;
}

// ------------------------------------------------------------ routing

export function intakeSettings(tenant) {
  const s = tenant?.settings?.intake || {};
  const r = s.routing || {};
  return {
    mode: r.mode === 'pool' ? 'pool' : 'round_robin',
    rules: Array.isArray(r.rules) ? r.rules : [],
    rotation: Array.isArray(r.rotation) ? r.rotation.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
  };
}

const ruleMatches = (rule, lead, source) => {
  if (rule.source && String(rule.source).toLowerCase() !== String(source).toLowerCase()) return false;
  if (rule.city) {
    const city = String(rule.city).trim().toLowerCase();
    const where = `${lead.city || ''} ${lead.property_address || ''}`.toLowerCase();
    if (!city || !where.includes(city)) return false;
  }
  const min = Number(rule.min_price) || 0;
  const max = Number(rule.max_price) || 0;
  if ((min || max) && !lead.price) return false;
  if (min && lead.price < min) return false;
  if (max && lead.price > max) return false;
  return !!(rule.source || rule.city || min || max);
};

/** Who gets a new lead: { agentId, by: 'rule' | 'round_robin' | null }. */
export async function chooseAgent(tenant, lead, source, pool = getPool()) {
  const cfg = intakeSettings(tenant);
  const { rows: staff } = await pool.query(
    "SELECT id, role FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin') AND status = 'active' ORDER BY id",
    [tenant.id]
  );
  const active = new Set(staff.map((s) => s.id));
  for (const rule of cfg.rules) {
    const id = Number(rule.agent_id);
    if (active.has(id) && ruleMatches(rule, lead, source)) return { agentId: id, by: 'rule' };
  }
  if (cfg.mode === 'pool') return { agentId: null, by: null };
  const rotation = (cfg.rotation.length ? cfg.rotation.filter((id) => active.has(id)) : staff.filter((s) => s.role === 'agent').map((s) => s.id))
    .sort((a, b) => a - b);
  if (!rotation.length) return { agentId: null, by: null };
  const { rows: [last] } = await pool.query(
    "SELECT assigned_agent_id FROM lead_intake_log WHERE tenant_id = $1 AND assigned_by = 'round_robin' ORDER BY id DESC LIMIT 1",
    [tenant.id]
  );
  const next = rotation.find((id) => id > Number(last?.assigned_agent_id || 0)) || rotation[0];
  return { agentId: next, by: 'round_robin' };
}

// ------------------------------------------------------------ saving a lead

/** Stand-in email for a lead who only gave a phone number (never emailed). */
export const placeholderEmail = (phone) => `phone-${String(phone).replace(/\D/g, '')}@no-email.invalid`;

function leadSummary(lead) {
  return [
    lead.message ? `“${lead.message}”` : null,
    lead.property_address ? `Home: ${lead.property_address}` : null,
    lead.price ? `Price: $${Number(lead.price).toLocaleString('en-US')}` : null,
    lead.property_url || null,
  ].filter(Boolean).join('\n');
}

/**
 * Save one lead for a brokerage. Matches an existing contact by email, then
 * phone (inside this brokerage only). Returns
 * { ok, lead_id, created, assigned_agent_id, assigned_by } or { ok: false, error }.
 * opts.inboxKind: 'lead' (default), 'form' or 'nadia'. opts.assign: false to leave unassigned.
 */
export async function ingestLead(tenant, lead, source, {
  inboxKind = 'lead', assign = true, agentId = null, tags: extraTags = [], pool = getPool(), now = intakeTransport.now(),
} = {}) {
  const src = String(source || 'webhook').toLowerCase();
  // A web form or zap can name its own source ("Open house"); portals keep theirs.
  const custom = ['webhook', 'zapier'].includes(src) ? clean(lead.source_name, 40) : null;
  const label = custom || SOURCE_LABELS[src] || clean(lead.source_name, 40) || 'Lead source';
  const email = lead.email && EMAIL_RE.test(lead.email) && !/\.invalid$/i.test(lead.email) ? String(lead.email).trim().toLowerCase() : null;
  const phone = normalizePhone(lead.phone);
  const name = clean(lead.name);
  const logRow = async (outcome, extra = {}) => pool.query(
    `INSERT INTO lead_intake_log (tenant_id, source, lead_id, outcome, assigned_agent_id, assigned_by, summary, error, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [tenant.id, src.slice(0, 24), extra.leadId || null, outcome, extra.agentId || null, extra.by || null,
      clean([name, email, phone].filter(Boolean).join(' · '), 300), extra.error || null, now]
  ).catch((e) => logger.warn('intake log failed', { message: e.message }));

  if (!email && !phone) {
    await logRow('rejected', { error: 'No email or phone in the lead' });
    return { ok: false, error: 'no_contact' };
  }
  if (email) {
    const { rows: [staff] } = await pool.query(
      "SELECT id FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 AND role IN ('agent', 'admin')", [tenant.id, email]
    );
    if (staff) {
      await logRow('rejected', { error: 'That email belongs to someone on your team' });
      return { ok: false, error: 'staff_email' };
    }
  }

  const sourceTag = label;
  const tags = [...new Set([sourceTag, ...(lead.tags || []), ...extraTags].map(normalizeTag).filter(Boolean))].slice(0, 12);

  let existing = null;
  if (email) {
    ({ rows: [existing] } = await pool.query(
      "SELECT * FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 AND COALESCE(role, 'client') = 'client' LIMIT 1", [tenant.id, email]
    ));
  }
  if (!existing && phone) {
    ({ rows: [existing] } = await pool.query(
      `SELECT * FROM users WHERE tenant_id = $1 AND COALESCE(role, 'client') = 'client'
         AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g'), 10) = RIGHT($2, 10)
       ORDER BY last_active_at DESC NULLS LAST, id DESC LIMIT 1`,
      [tenant.id, phone.replace(/\D/g, '')]
    ));
  }

  let leadId;
  let created = false;
  let assigned = { agentId: null, by: null };
  let addedTags = tags;
  if (existing) {
    leadId = existing.id;
    addedTags = tags.filter((t) => !(existing.tags || []).some((x) => x.toLowerCase() === t.toLowerCase()));
    const placeholder = /\.invalid$/i.test(existing.email || '');
    await pool.query(
      `UPDATE users SET name = COALESCE(name, $2), phone = COALESCE(NULLIF(phone, ''), $3),
              email = CASE WHEN $4::text IS NOT NULL AND $5 THEN $4 ELSE email END,
              tags = (SELECT ARRAY(SELECT DISTINCT unnest(tags || $6::text[]))), source = COALESCE(source, $7)
       WHERE id = $1`,
      [leadId, name, phone, email, placeholder, addedTags, src]
    );
    assigned = { agentId: existing.assigned_agent_id || null, by: null };
  } else {
    if (assign) assigned = agentId ? { agentId, by: 'set' } : await chooseAgent(tenant, lead, src, pool);
    const { rows: [row] } = await pool.query(
      `INSERT INTO users (email, name, phone, manage_token, role, status, source, assigned_agent_id, lifecycle_stage,
                          lifecycle_stage_manual, tags, tenant_id, created_at, last_active_at)
       VALUES ($1, $2, $3, $4, 'client', 'active', $5, $6, 'new', FALSE, $7, $8, $9, $9) RETURNING id`,
      [email || placeholderEmail(phone), name, phone, crypto.randomBytes(24).toString('hex'), src, assigned.agentId, tags, tenant.id, now]
    );
    leadId = row.id;
    created = true;
    if (assigned.agentId) {
      await pool.query(
        `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'agent_assign', $2::jsonb)`,
        [leadId, JSON.stringify({ assigned_agent_id: assigned.agentId, previous_assigned_agent_id: null, by_role: assigned.by === 'round_robin' ? 'round_robin' : 'intake_rule' })]
      ).catch(() => {});
    }
  }

  const summary = leadSummary(lead);
  const verb = created ? 'New lead' : (inboxKind === 'lead' ? 'Came back' : 'Message');
  if (summary) {
    await pool.query(
      `INSERT INTO lead_notes (tenant_id, lead_id, author_id, author_name, kind, body, created_at) VALUES ($1, $2, NULL, $3, 'note', $4, $5)`,
      [tenant.id, leadId, label, `${verb} from ${label}\n${summary}`.slice(0, 5000), now]
    );
  }
  await runWithTenant(tenant, () => recordEvent({
    type: 'form_submit', userId: leadId, source: 'intake', tenantId: tenant.id,
    meta: { form: 'lead_intake', source: src, source_label: label, created },
  }, pool));
  await logRow(created ? 'created' : 'duplicate', { leadId, agentId: assigned.agentId, by: assigned.by });

  const thread = await recordInboundSafe({
    tenantId: tenant.id,
    leadId,
    kind: inboxKind,
    subject: inboxKind === 'lead' ? `${verb} from ${label}` : null,
    body: summary || `${verb} from ${label}`,
    meta: { source: src, created },
    at: now,
  }, pool);

  const who = name || email || phone;
  pushStaff(tenant.id, await staffToTell(tenant.id, assigned.agentId, pool), {
    title: created ? `New lead from ${label}: ${who}` : `${who} came back via ${label}`,
    body: String(lead.message || lead.property_address || 'Reach out now.').slice(0, 140),
    url: `/agent/?lead=${leadId}`,
    tag: `lead-${leadId}`,
  }, pool).catch(() => {});

  if (created) await triggerPlans({ tenantId: tenant.id, leadId, event: { type: 'new_lead', source: src }, now }, pool);
  if (addedTags.length) await onTagsAdded({ tenantId: tenant.id, leadId, tags: addedTags, now }, pool);

  return { ok: true, lead_id: leadId, created, assigned_agent_id: assigned.agentId, assigned_by: assigned.by, thread_id: thread?.thread_id || null };
}

/**
 * A form on the site (contact, home value) or a Nadia handoff: always lands
 * in the team inbox. A brokerage whose cockpit is its CRM (every brokerage
 * but the home one, or any in own-CRM mode) also gets the person as a lead,
 * matched and assigned like any other; the home brokerage keeps its forms
 * going to Follow Up Boss as before, and the inbox links the lead if we
 * already know them.
 */
export async function formToInbox(tenant, { name, email, phone, message, source = 'contact', kind = 'form', tags = [] }, pool = getPool()) {
  try {
    if (!tenant?.id) return null;
    const lead = { name, email: email ? String(email).trim().toLowerCase() : null, phone, message };
    if (!isHomeTenant(tenant) || crmModeOf(tenant) === 'own') {
      return await ingestLead(tenant, lead, source, { inboxKind: kind, tags, pool });
    }
    let known = null;
    if (lead.email) {
      ({ rows: [known] } = await pool.query(
        "SELECT id FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 AND COALESCE(role, 'client') = 'client' LIMIT 1", [tenant.id, lead.email]
      ));
    }
    const key = lead.email || normalizePhone(phone);
    if (!known && !key) return null;
    return await recordInboundSafe({
      tenantId: tenant.id,
      leadId: known?.id || null,
      contactKey: known ? null : key,
      contactName: clean(name),
      kind,
      body: String(message || '').slice(0, 20000) || (kind === 'nadia' ? 'Asked to talk with an agent' : 'Sent a form'),
      meta: { source, phone: phone || null, email: lead.email },
    }, pool);
  } catch (e) {
    logger.warn('form to inbox failed', { message: e.message });
    return null;
  }
}
