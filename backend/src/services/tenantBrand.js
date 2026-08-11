/**
 * White-label / tenant brand resolution (P-2).
 *
 * Resolves per-agent brand fields with marketPack fallbacks.
 * Used by nurture email renderers and /api/agent/me.
 *
 * NULL brand columns on the agent row → SAA market pack defaults (no brand
 * change for our own mail). Never invents phone/stats — only real row values.
 */
import { marketPack } from '../config/marketPack.js';

export const VOICE_STYLES = ['warm', 'professional', 'short'];

/**
 * Normalize voice_style; invalid/empty → 'warm'.
 * @param {string|null|undefined} raw
 * @returns {'warm'|'professional'|'short'}
 */
export function normalizeVoiceStyle(raw) {
  const v = String(raw || '').toLowerCase().trim();
  return VOICE_STYLES.includes(v) ? v : 'warm';
}

/**
 * Format brand_phone / phone for display. Pass through if already formatted;
 * otherwise light US-style formatting when digits-only.
 * @param {string|null|undefined} phone
 * @returns {string|null}
 */
function formatPhoneDisplay(phone) {
  if (phone == null || phone === '') return null;
  const s = String(phone).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return s;
}

/**
 * tel: href from a display phone string.
 * @param {string|null|undefined} phone
 * @returns {string}
 */
function telHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return marketPack.market.tel || 'tel:+19709991407';
  const e164 = digits.length === 10 ? `+1${digits}` : digits.startsWith('1') ? `+${digits}` : `+${digits}`;
  return `tel:${e164}`;
}

/**
 * Resolve brand for an agent user row (or null for market-pack defaults).
 *
 * @param {object|null|undefined} user  agent/admin users row (snake_case columns)
 * @returns {{
 *   brandName: string,
 *   brokerage: string,
 *   phone: string,
 *   tel: string,
 *   voiceStyle: 'warm'|'professional'|'short',
 *   agentName: string|null,
 *   agentFirstName: string|null,
 *   fromName: string,
 *   headerSubline: string,
 *   brandLine: string,
 *   isCustom: boolean,
 * }}
 */
export function getAgentBrand(user) {
  const market = marketPack.market;
  const footer = marketPack.footer || {};

  const agentName = user?.name ? String(user.name).trim() : null;
  const agentFirstName = agentName ? agentName.split(/\s+/)[0] : null;

  const brandNameRaw = user?.brand_name != null ? String(user.brand_name).trim() : '';
  const brokerageRaw = user?.brokerage_name != null ? String(user.brokerage_name).trim() : '';
  const brandPhoneRaw = user?.brand_phone != null ? String(user.brand_phone).trim() : '';

  // Prefer brand_phone, then agent phone column, then market pack
  const phoneDisplay =
    formatPhoneDisplay(brandPhoneRaw) ||
    formatPhoneDisplay(user?.phone) ||
    market.phone;

  const brandName = brandNameRaw || market.brand || 'SAA Homes';
  const brokerage = brokerageRaw || market.brokerage || 'Schwartz and Associates';
  const voiceStyle = normalizeVoiceStyle(user?.voice_style);

  // Custom when any brand column is explicitly set (not pure market-pack defaults)
  const isCustom = !!(brandNameRaw || brokerageRaw || brandPhoneRaw);

  // From-name: "Agent Name — Brand" when we have an agent; else market default
  let fromName;
  if (agentName) {
    fromName = `${agentName} — ${brandName}`;
  } else {
    fromName = `Adam Schwartz, ${market.brand || 'SAA Homes'}`;
  }

  const headerSubline = `${brokerage} · ${market.name || 'Northern Colorado'} Real Estate`;
  const brandLine = `${brokerage} · Fort Collins, CO`;

  return {
    brandName,
    brokerage,
    phone: phoneDisplay,
    tel: telHref(phoneDisplay),
    voiceStyle,
    agentName,
    agentFirstName,
    fromName,
    headerSubline,
    brandLine,
    isCustom,
    // Preserve market pack references for callers that still need site/market
    siteUrl: market.siteUrl || 'https://saahomes.com',
    marketName: market.name || 'Northern Colorado',
  };
}

/**
 * Fixed voice-parameterized intro lines for nurture emails.
 * Placeholders only — no stats/prices. Written templates, not freeform AI.
 *
 * @param {'digest'|'home_value'} kind
 * @param {'warm'|'professional'|'short'} voiceStyle
 * @param {{ firstName?: string|null, city?: string, searchName?: string, filterSummary?: string, address?: string, agentName?: string|null, brandName?: string }} ctx
 * @returns {{ greeting: string, introHtml: string }}
 */
export function voiceCopy(kind, voiceStyle, ctx = {}) {
  const style = normalizeVoiceStyle(voiceStyle);
  const first = (ctx.firstName || '').trim();
  const greeting = first ? `Hi ${first},` : 'Hi there,';
  const city = (ctx.city || marketPack.market.name || 'Northern Colorado').trim();
  const searchName = (ctx.searchName || 'saved').trim();
  const filterSummary = (ctx.filterSummary || '').trim();
  const address = (ctx.address || 'your home').trim();
  const agentName = (ctx.agentName || '').trim();
  const brandName = (ctx.brandName || marketPack.market.brand || 'SAA Homes').trim();
  const agentLabel = agentName || brandName;

  if (kind === 'home_value') {
    const templates = {
      warm: `I keep an eye on ${city} for you — here&rsquo;s your monthly home value update for <strong>${escapeForTemplate(address)}</strong>.`,
      professional: `Please find your monthly estimated value update for <strong>${escapeForTemplate(address)}</strong> in ${escapeForTemplate(city)}.`,
      short: `Your monthly value update for <strong>${escapeForTemplate(address)}</strong>:`,
    };
    return { greeting, introHtml: templates[style] || templates.warm };
  }

  // digest (saved-search alerts)
  const filterBit = filterSummary ? ` — ${escapeForTemplate(filterSummary)}` : '';
  const templates = {
    warm: `I keep an eye on ${escapeForTemplate(city)} for you. Here&rsquo;s what came in for your <strong>${escapeForTemplate(searchName)}</strong> search${filterBit}:`,
    professional: `Below is the latest activity for your <strong>${escapeForTemplate(searchName)}</strong> search in ${escapeForTemplate(city)}${filterBit}.`,
    short: `New matches for <strong>${escapeForTemplate(searchName)}</strong>${filterBit}:`,
  };

  // Optional sign-in line used by some callers (agent attribution)
  const signOff =
    style === 'short'
      ? ''
      : style === 'professional'
        ? `This update is from ${escapeForTemplate(agentLabel)}.`
        : '';

  return {
    greeting,
    introHtml: templates[style] || templates.warm,
    signOffHtml: signOff,
  };
}

/** Escape for embedding into HTML templates we control (address/city/search names). */
function escapeForTemplate(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Load assigned agent brand for a client user id.
 * Returns null when unassigned or agent missing → callers keep SAA copy as-is.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} pool
 * @param {number} clientUserId
 * @returns {Promise<object|null>} getAgentBrand result or null
 */
export async function loadBrandForClientUser(pool, clientUserId) {
  if (!pool || !clientUserId) return null;
  const r = await pool.query(
    `SELECT a.id, a.name, a.email, a.phone, a.brand_name, a.brokerage_name,
            a.brand_phone, a.voice_style, a.role, a.status
     FROM users u
     JOIN users a ON a.id = u.assigned_agent_id
     WHERE u.id = $1
       AND a.role IN ('agent', 'admin')
       AND a.status = 'active'`,
    [clientUserId]
  );
  if (!r.rows[0]) return null;
  return getAgentBrand(r.rows[0]);
}

/**
 * Sanitize brand fields from request body for create/patch.
 * Returns { error } or { fields } with only present, validated values.
 *
 * @param {object} body
 * @param {{ requireAll?: boolean }} opts
 */
export function parseBrandFields(body = {}, opts = {}) {
  const out = {};
  const b = body || {};

  if (b.brand_name !== undefined || opts.requireAll) {
    if (b.brand_name === null || b.brand_name === '') {
      out.brand_name = null;
    } else if (b.brand_name != null) {
      const s = String(b.brand_name).trim().slice(0, 120);
      out.brand_name = s || null;
    }
  }

  if (b.brokerage_name !== undefined || opts.requireAll) {
    if (b.brokerage_name === null || b.brokerage_name === '') {
      out.brokerage_name = null;
    } else if (b.brokerage_name != null) {
      const s = String(b.brokerage_name).trim().slice(0, 120);
      out.brokerage_name = s || null;
    }
  }

  if (b.brand_phone !== undefined || opts.requireAll) {
    if (b.brand_phone === null || b.brand_phone === '') {
      out.brand_phone = null;
    } else if (b.brand_phone != null) {
      const s = String(b.brand_phone).trim().slice(0, 30);
      // Allow display formatting; store trimmed string (not only digits)
      out.brand_phone = s || null;
    }
  }

  if (b.voice_style !== undefined || opts.requireAll) {
    if (b.voice_style === null || b.voice_style === '') {
      out.voice_style = 'warm';
    } else {
      const v = String(b.voice_style).toLowerCase().trim();
      if (!VOICE_STYLES.includes(v)) {
        return { error: `voice_style must be one of: ${VOICE_STYLES.join(', ')}` };
      }
      out.voice_style = v;
    }
  }

  return { fields: out };
}

/** Agent row columns returned by admin/agent brand-aware endpoints. */
export const BRAND_SELECT_COLS =
  'brand_name, brokerage_name, brand_phone, voice_style';

/**
 * Shape a user row for API responses (brand subset + identity).
 */
export function publicAgentPayload(row) {
  if (!row) return null;
  const brand = getAgentBrand(row);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || null,
    role: row.role,
    status: row.status,
    brand_name: row.brand_name ?? null,
    brokerage_name: row.brokerage_name ?? null,
    brand_phone: row.brand_phone ?? null,
    voice_style: normalizeVoiceStyle(row.voice_style),
    // Resolved (with marketPack fallbacks) for console / preview
    brand: {
      brandName: brand.brandName,
      brokerage: brand.brokerage,
      phone: brand.phone,
      tel: brand.tel,
      voiceStyle: brand.voiceStyle,
      fromName: brand.fromName,
      headerSubline: brand.headerSubline,
      brandLine: brand.brandLine,
      isCustom: brand.isCustom,
    },
    created_at: row.created_at,
    last_active_at: row.last_active_at || null,
  };
}

export default {
  getAgentBrand,
  voiceCopy,
  loadBrandForClientUser,
  parseBrandFields,
  normalizeVoiceStyle,
  publicAgentPayload,
  VOICE_STYLES,
  BRAND_SELECT_COLS,
};
