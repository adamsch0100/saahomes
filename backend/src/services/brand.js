/**
 * A brokerage's brand: name, contact details, logo and colors, for its site,
 * its emails, its app icon and Nadia. One place, so nothing else hardcodes SAA.
 *
 * Layers, most specific first:
 *   1. the agent, on an agent's own domain or for a buyer assigned to them
 *      (users.brand_name / brand_phone, see tenantBrand.js)
 *   2. tenants.settings.brand, set by the brokerage owner in Settings
 *   3. defaults: SAA's current brand for SAA (byte-for-byte what the site and
 *      emails used before), and the brokerage's own name for anyone else.
 *      Another brokerage never falls back to SAA's phone, email or colors.
 */
import { DEFAULT_TENANT_ID, siteUrlFor } from './tenantContext.js';
import { marketPack } from '../config/marketPack.js';

const HEX = /^#[0-9a-f]{6}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SAA_BRAND = Object.freeze({
  name: marketPack.market.brand, // 'SAA Homes'
  legal_name: marketPack.market.brokerage, // 'Schwartz and Associates'
  phone: marketPack.market.phone,
  email: 'info@saahomes.com',
  logo_url: null,
  icon_url: '/icons/icon-192.png',
  primary_color: '#111111',
  accent_color: '#CFB36E',
  tagline: marketPack.market.tagline,
  address: 'Fort Collins, CO',
  license_line: null,
  market_name: marketPack.market.name,
  from_name: `Adam Schwartz, ${marketPack.market.brand}`,
  reply_to: null,
});

const NEUTRAL = Object.freeze({
  primary_color: '#111111',
  accent_color: '#2563eb',
  icon_url: null,
});

/** Settings fields an owner can set, with how each is checked. */
const FIELDS = {
  name: { max: 120 },
  legal_name: { max: 160 },
  phone: { max: 30, kind: 'phone' },
  email: { max: 255, kind: 'email' },
  logo_url: { max: 500, kind: 'url' },
  icon_url: { max: 500, kind: 'url' },
  primary_color: { kind: 'color' },
  accent_color: { kind: 'color' },
  tagline: { max: 160 },
  address: { max: 200 },
  license_line: { max: 200 },
  market_name: { max: 80 },
  from_name: { max: 80 },
  reply_to: { max: 255, kind: 'email' },
};
export const BRAND_FIELDS = Object.keys(FIELDS);

/**
 * Validate brand settings from a request body. Only fields present in input
 * are returned; '' or null clears a field. Returns { fields } or { error }.
 */
export function normalizeBrandSettings(input = {}) {
  const fields = {};
  for (const [key, rule] of Object.entries(FIELDS)) {
    if (!(key in (input || {}))) continue;
    const raw = input[key];
    if (raw === null || raw === '') {
      fields[key] = null;
      continue;
    }
    let v = String(raw).trim();
    if (rule.max) v = v.slice(0, rule.max);
    if (rule.kind === 'email' && !EMAIL_RE.test(v)) return { error: `${key.replace('_', ' ')} must be an email address` };
    if (rule.kind === 'color' && !HEX.test(v)) return { error: `${key.replace('_', ' ')} must be a color like #1a2b3c` };
    if (rule.kind === 'url') {
      let ok = false;
      try {
        const u = new URL(v, 'https://x.invalid');
        ok = u.protocol === 'https:' || v.startsWith('/');
      } catch { ok = false; }
      if (!ok) return { error: `${key.replace('_', ' ')} must be an https:// link` };
    }
    if (rule.kind === 'phone' && v.replace(/\D/g, '').length < 7) return { error: 'phone needs at least 7 digits' };
    fields[key] = v;
  }
  return { fields };
}

export function formatPhone(phone) {
  if (!phone) return null;
  const s = String(phone).trim();
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return s || null;
}

export function telHref(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  return `tel:${d.length === 10 ? `+1${d}` : `+${d}`}`;
}

export const isHomeTenant = (tenant) => (tenant?.id ?? DEFAULT_TENANT_ID) === DEFAULT_TENANT_ID;

/**
 * The resolved brand for a tenant (a req.tenant or tenantById result),
 * optionally narrowed to one agent (a users row with brand columns).
 */
export function brandFor(tenant, { agent = null } = {}) {
  const home = isHomeTenant(tenant);
  const set = (tenant?.settings && tenant.settings.brand) || {};
  const base = home
    ? { ...SAA_BRAND }
    : {
      ...NEUTRAL,
      name: tenant?.name || 'Home Search',
      legal_name: tenant?.name || null,
      phone: null,
      email: null,
      logo_url: null,
      tagline: null,
      address: null,
      license_line: null,
      market_name: null,
      from_name: tenant?.name || null,
      reply_to: null,
    };
  const b = { ...base };
  for (const k of BRAND_FIELDS) {
    if (set[k] !== undefined && set[k] !== null && set[k] !== '') b[k] = set[k];
  }
  if (!set.from_name && set.name && !home) b.from_name = set.name;

  let agentName = null;
  if (agent) {
    agentName = agent.name ? String(agent.name).trim() : null;
    if (agent.brand_name) b.name = String(agent.brand_name).trim();
    if (agent.brokerage_name) b.legal_name = String(agent.brokerage_name).trim();
    const agentPhone = agent.brand_phone || agent.phone;
    if (agentPhone) b.phone = agentPhone;
    if (agentName) b.from_name = `${agentName} — ${b.name}`;
    if (agent.email && !set.reply_to) b.reply_to = agent.email;
    if (agent.photo_url) b.agent_photo_url = agent.photo_url;
  }

  const phone = formatPhone(b.phone);
  return {
    ...b,
    phone,
    tel: telHref(phone),
    agent_name: agentName,
    site_url: siteUrlFor(tenant),
    is_home: home,
    tenant_id: tenant?.id ?? DEFAULT_TENANT_ID,
    // Email footer line: "Legal name · Address · License"
    footer_line: [b.legal_name, b.address, b.license_line].filter(Boolean).join(' · '),
  };
}

/**
 * The public shape the site reads (GET /api/tenant). Field names match what
 * the frontend already reads for agent domains (brandName, brokerage, phone,
 * tel, headerSubline), plus the brokerage-level additions.
 */
export function publicBrand(tenant, { agent = null } = {}) {
  const b = brandFor(tenant, { agent });
  return {
    brandName: b.name,
    brokerage: b.legal_name,
    phone: b.phone,
    tel: b.tel,
    email: b.email,
    headerSubline: [b.legal_name, b.market_name ? `${b.market_name} Real Estate` : null].filter(Boolean).join(' · ') || null,
    brandLine: [b.legal_name, b.address].filter(Boolean).join(' · ') || null,
    logoUrl: b.logo_url,
    iconUrl: b.icon_url,
    primaryColor: b.primary_color,
    accentColor: b.accent_color,
    tagline: b.tagline,
    address: b.address,
    licenseLine: b.license_line,
    marketName: b.market_name,
    siteUrl: b.site_url,
    agentName: b.agent_name,
    agentPhotoUrl: b.agent_photo_url || null,
  };
}
