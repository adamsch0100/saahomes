/**
 * Nightly saved-search digest engine (RealScout-style follow-up):
 *   Personalized agent-voice emails from Adam & Mandi Schwartz — accurate
 *   counts, data-derived "why this home" highlights, real listing details.
 *
 * CLI:  node backend/src/services/alertDigest.js          → process everyone
 *       node backend/src/services/alertDigest.js --dry    → print, don't send
 *       node backend/src/services/alertDigest.js --email x@y.z → only that user
 *       node backend/src/services/alertDigest.js --search N → only that search
 *
 * Env:  DATABASE_URL (repo .env) + OUTREACH_SMTP_HOST/USER/PASSWORD/FROM
 */
import 'dotenv/config';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { getRecentViews, filtersToSearchPath } from './leadScore.js';
import {
  notifyNewMatches,
  notifyPriceDrop,
  scanSavedHomesForNotifications,
} from './notificationService.js';
import { getPrefFrequency } from './notificationPrefs.js';
import { pickVariant, openToken, withOpenPixel } from './subjectVariants.js';
import { marketPack } from '../config/marketPack.js';
import { loadBrandForClientUser, voiceCopy } from './tenantBrand.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const SITE = marketPack.market.siteUrl || 'https://saahomes.com';
const FROM = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER || 'alerts@saahomes.com';
const AGENT_FROM = marketPack.agentVoice?.defaultFromName || `Adam Schwartz, ${marketPack.market.brand}`;
const AGENT_PHONE = marketPack.market.phone;

const fmtPrice = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
const fmtSqft = (n) => (n == null ? '' : `${Number(n).toLocaleString()} sqft`);

const HOME_TYPE_LABEL = { detached: 'Detached Home', attached: 'Condo / Townhome / Attached', land: 'Land', commercial: 'Commercial', other: 'Property' };

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------- Mountain Time helpers
const MT_TZ = 'America/Denver';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function mtNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MT_TZ, hour: '2-digit', minute: '2-digit', weekday: 'long', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  return {
    hhmm: `${get('hour')}:${get('minute')}`,
    weekday: get('weekday'),
    date: new Intl.DateTimeFormat('en-CA', { timeZone: MT_TZ }).format(new Date()),
  };
}

/** Is this search due to run right now? frequency × send_time × send_day. */
function isDue(search) {
  const now = mtNow();
  const freq = search.frequency || 'daily';
  if (freq === 'immediate') return true; // hourly runs catch these
  const sendTime = search.send_time || '06:00';
  if (now.hhmm < sendTime) return false;
  if (freq === 'weekly' && search.send_day && now.weekday !== search.send_day) return false;
  // Don't re-send on the same day (snapshot-less, low-volume searches)
  if (search.last_email_at) {
    const lastDate = new Intl.DateTimeFormat('en-CA', { timeZone: MT_TZ }).format(new Date(search.last_email_at));
    if (lastDate === now.date) return false;
  }
  return true;
}

/**
 * Account-level listing_alert pref gate on top of per-search isDue.
 * - off → never send
 * - weekly → only on the search's send_day (or Monday if unset), weekly-compatible
 * - immediate / daily / monthly → per-search isDue remains master
 * Missing pref row → default 'daily' (does not block).
 */
function isDueWithListingPref(search, listingPrefFreq) {
  const pref = listingPrefFreq || 'daily';
  if (pref === 'off') return false;
  if (!isDue(search)) return false;
  if (pref === 'weekly') {
    const now = mtNow();
    const day = search.send_day || 'Monday';
    if (now.weekday !== day) return false;
  }
  return true;
}

// ---------------------------------------------------------------- filters
function buildWhere(filters) {
  const where = ['is_active = TRUE', 'status = \'Active\''];
  const params = [];
  let i = 1;
  const f = filters || {};
  // Location: city may be multi ("Denver,Erie"); postal_code / zip may be multi.
  // Cities and zips OR within group; groups OR together (union of areas).
  const cityRaw = f.city ? String(f.city) : '';
  const zipRaw = f.postal_code || f.postalCode || f.zip || f.zipCode || f.zips || '';
  const cityList = cityRaw && cityRaw !== '__noco__' && cityRaw !== '__all__'
    ? cityRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const zipList = zipRaw
    ? String(zipRaw).split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const locParts = [];
  if (cityRaw === '__noco__' && zipList.length === 0) {
    // NoCO default scope for digests that still store __noco__
    const NOCO = [
      'Fort Collins', 'Loveland', 'Windsor', 'Greeley', 'Timnath', 'Wellington',
      'Johnstown', 'Eaton', 'Milliken', 'La Salle', 'Mead', 'Longmont', 'Boulder',
      'Berthoud', 'Firestone', 'Frederick', 'Evans', 'Severance', 'Niwot',
    ];
    where.push(`city = ANY($${i++}::text[])`);
    params.push(NOCO);
  } else {
    if (cityList.length === 1) {
      locParts.push(`LOWER(city) = LOWER($${i})`);
      params.push(cityList[0]);
      i += 1;
    } else if (cityList.length > 1) {
      locParts.push(`LOWER(city) = ANY($${i}::text[])`);
      params.push(cityList.map((c) => c.toLowerCase()));
      i += 1;
    }
    if (zipList.length === 1) {
      locParts.push(`postal_code = $${i}`);
      params.push(zipList[0]);
      i += 1;
    } else if (zipList.length > 1) {
      locParts.push(`postal_code = ANY($${i}::text[])`);
      params.push(zipList);
      i += 1;
    }
    if (locParts.length === 1) where.push(locParts[0]);
    else if (locParts.length > 1) where.push(`(${locParts.join(' OR ')})`);
  }
  if (f.minPrice) { where.push(`list_price >= $${i++}`); params.push(Number(f.minPrice)); }
  if (f.maxPrice) { where.push(`list_price <= $${i++}`); params.push(Number(f.maxPrice)); }
  if (f.beds) { where.push(`beds >= $${i++}`); params.push(Number(f.beds)); }
  if (f.baths) { where.push(`baths >= $${i++}`); params.push(Number(f.baths)); }
  if (f.type && ['detached', 'attached', 'land', 'commercial', 'other'].includes(f.type)) {
    where.push(`home_type = $${i++}`);
    params.push(f.type);
  }
  if (f.q) {
    where.push(`(LOWER(city) LIKE $${i} OR LOWER(street_name) LIKE $${i} OR LOWER(description) LIKE $${i})`);
    params.push(`%${String(f.q).toLowerCase()}%`);
    i += 1;
  }
  // Expanded MLS detail filters (parity with the search page)
  if (f.minSqft) { where.push(`living_area >= $${i++}`); params.push(Number(f.minSqft)); }
  if (f.minYear) { where.push(`year_built >= $${i++}`); params.push(Number(f.minYear)); }
  if (f.maxHoa) { where.push(`hoa_fee <= $${i++}`); params.push(Number(f.maxHoa)); }
  if (f.garage === 'true') where.push('garage_spaces > 0');
  if (f.basement === 'true') where.push(`COALESCE(features->>'basement','') NOT ILIKE '%none%' AND COALESCE(features->>'basement','') <> ''`);
  if (f.fireplace === 'true') where.push(`COALESCE(features->>'fireplaces','') <> ''`);
  if (f.pool === 'true') where.push(`COALESCE(features->>'pool','') NOT ILIKE 'n%' AND COALESCE(features->>'pool','') <> ''`);
  if (f.newConstruction === 'true') where.push(`features->>'new_construction' = 'true'`);
  if (f.waterfront === 'true') where.push(`features->>'waterfront' = 'true'`);
  if (f.newDays) { where.push(`days_on_market <= $${i++}`); params.push(Number(f.newDays)); }
  return { whereSql: where.join(' AND '), params };
}

function matchScore(l, filters) {
  let score = 60;
  const price = Number(l.list_price) || 0;
  if (filters.minPrice || filters.maxPrice) {
    const min = Number(filters.minPrice) || 0;
    const max = Number(filters.maxPrice) || Infinity;
    if (price >= min && price <= max) {
      const span = Math.max(1, max - min);
      const mid = min + span / 2;
      score += Math.max(0, 20 - Math.round((Math.abs(price - mid) / span) * 40));
    }
  }
  const dom = l.days_on_market;
  if (dom != null && dom <= 7) score += 10;
  if (filters.beds && l.beds != null && l.beds >= Number(filters.beds)) score += 5;
  if (filters.baths && l.baths != null && l.baths >= Number(filters.baths)) score += 5;
  return Math.min(99, score);
}

// ------------------------------------------------- "why this home" facts
// Every highlight is derived strictly from the listing data we sync — never
// invented. Picks the most notable facts first, max 4.
function featureHighlights(l) {
  const f = l.features || {};
  const out = [];
  const price = Number(l.list_price) || 0;
  if (l.original_list_price && price && Number(l.original_list_price) > price) {
    const pct = Math.round((1 - price / Number(l.original_list_price)) * 100);
    out.push(`Price reduced ${pct}% — now ${fmtPrice(price)} (was ${fmtPrice(l.original_list_price)})`);
  }
  if (f.new_construction) out.push('Brand-new construction');
  if (l.beds != null && l.beds >= 3) out.push(`${l.beds} bedrooms`);
  if (l.baths != null) out.push(`${l.baths} baths`);
  if (l.living_area) out.push(`${Number(l.living_area).toLocaleString()} sqft of living space`);
  if (f.basement) out.push(`Basement: ${f.basement}`);
  if (l.garage_spaces != null && l.garage_spaces > 0) out.push(`${l.garage_spaces}-car garage`);
  if (l.lot_size_acres) out.push(`Sits on ${l.lot_size_acres} acre${Number(l.lot_size_acres) === 1 ? '' : 's'}`);
  if (f.cooling) out.push(`Cooling: ${f.cooling}`);
  if (f.heating) out.push(`Heat: ${f.heating}`);
  if (f.fireplaces) out.push(`Fireplace${String(f.fireplaces).includes(',') ? 's' : ''}: ${f.fireplaces}`);
  if (f.pool) out.push('Pool on site');
  if (f.spa) out.push('Spa/hot tub');
  if (f.view) out.push(`Views: ${f.view}`);
  if (f.waterfront) out.push(`Waterfront${f.water_body ? ` — ${f.water_body}` : ''}`);
  if (f.exterior) out.push(`Exterior: ${f.exterior}`);
  if (l.elementary_school) out.push(`Served by ${l.elementary_school} Elementary`);
  if (l.school_district) out.push(`${l.school_district} schools`);
  if (l.subdivision) out.push(`In the ${l.subdivision} neighborhood`);
  if (f.hoa) out.push(`HOA ${fmtPrice(l.hoa_fee)}/${f.assoc_fee_freq || 'mo'}`);
  if (l.year_built) out.push(`Built ${l.year_built}`);
  return out.slice(0, 4);
}

function descriptionSnippet(l) {
  if (!l.description) return '';
  const clean = String(l.description).replace(/\s+/g, ' ').trim();
  const cut = clean.slice(0, 240);
  const lastPeriod = cut.lastIndexOf('. ');
  const end = lastPeriod > 80 ? lastPeriod + 1 : cut.length;
  return clean.slice(0, end).trim();
}

// ---------------------------------------------------------------- cards
function cardHtml(l, filters, isNew, isDrop) {
  // Serve photos through the site's durable proxy (/api/photo) instead of the
  // raw MLS signed URL — signed URLs expire ~60 min after sync, so direct
  // links die before the recipient opens the email (photos didn't load).
  // The proxy caches, heals expired URLs from IRES (rate-capped), and serves
  // R2 copies when present.
  const photo = (l.photos && l.photos[0])
    ? `${SITE}/api/photo/${l.id}/0`
    : `${SITE}/images/buyers-hero.jpg`;
  const url = `${SITE}/homes-for-sale/${l.slug}/`;
  const score = matchScore(l, filters);
  const highlights = featureHighlights(l);
  const snippet = descriptionSnippet(l);
  const address = [l.street_number, l.street_name, l.city].filter(Boolean).join(' ');
  const badge = isDrop ? 'PRICE DROP' : isNew ? 'NEW' : '';
  const badgeStyle = isDrop
    ? 'background:#065f46;color:#fff'
    : 'background:#CFB36E;color:#1a1a1a';

  return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:18px;background:#fff">
      <a href="${url}" style="display:block;position:relative">
        <img src="${photo}" alt="${address}" style="width:100%;height:220px;object-fit:cover;display:block" loading="lazy"/>
        <span style="position:absolute;top:10px;left:10px;${badgeStyle};font-weight:800;font-size:12px;padding:4px 10px;border-radius:6px">${badge || `${score}% match`}</span>
      </a>
      <div style="padding:16px 18px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">
          <span style="font-size:22px;font-weight:800;color:#111">${fmtPrice(l.list_price)}</span>
          <span style="color:#6b7280;font-size:12.5px">${score}% match to your search</span>
        </div>
        <div style="color:#374151;font-size:14px;margin-top:2px">${[l.beds != null ? `${l.beds} bd` : '', l.baths != null ? `${l.baths} ba` : '', fmtSqft(l.living_area), HOME_TYPE_LABEL[l.home_type] || l.property_subtype].filter(Boolean).join(' · ')}</div>
        <div style="color:#6b7280;font-size:13px;margin-top:2px">${address}, CO ${l.postal_code || ''}</div>
        ${highlights.length ? `
        <div style="margin-top:10px;padding:10px 12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#374151;line-height:1.55">
          <strong style="color:#111">Why you got this:</strong><br/>${highlights.map((h) => `• ${escapeHtml(h)}`).join('<br/>')}
        </div>` : ''}
        ${snippet ? `<div style="margin-top:10px;font-size:13px;color:#4b5563;line-height:1.6;font-style:italic">"${escapeHtml(snippet)}"</div>` : ''}
        <a href="${url}" style="display:inline-block;margin-top:12px;background:#111;color:#fff;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;text-decoration:none">View this home</a>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- email
/**
 * @param {object} opts
 * @param {import('./tenantBrand.js').getAgentBrand extends Function ? object : object|null} [opts.brand]
 *   When null/undefined → unassigned SAA copy (byte-stable). When set → assigned agent brand.
 */
function digestHtml({
  firstName, searchName, filterSummary, summaryLines, standouts, cards,
  manageUrl, unsubscribeUrl, searchUrl, viewedCallout, brand = null, cityLabel = '',
}) {
  const { market, sources, dpa, fairHousing, footer, honestLabels } = marketPack;
  const useBrand = !!brand;

  // Unassigned path: exact historical SAA agent-voice (do not change).
  if (!useBrand) {
    const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
    const brandUpper = String(market.brand || 'SAA Homes').toUpperCase();
    return `<!DOCTYPE html>
  <html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111">
    <tr><td align="center" style="padding:26px 16px">
      <div style="color:#CFB36E;font-size:22px;font-weight:800;letter-spacing:0.5px">${escapeHtml(brandUpper)}</div>
      <div style="color:#9ca3af;font-size:13px;margin-top:4px">${escapeHtml(footer.headerSubline)}</div>
    </td></tr>
  </table>
  <div style="max-width:580px;margin:0 auto;padding:26px 16px">
    <p style="color:#111;font-size:15px;margin:0 0 4px">${greeting}</p>
    <p style="color:#4b5563;font-size:14.5px;line-height:1.6;margin:0 0 4px">
      It's <strong>Adam Schwartz</strong> with ${escapeHtml(market.brand)}. Here's what came in for your
      <strong>${escapeHtml(searchName)}</strong> search — ${escapeHtml(filterSummary)}:
    </p>
    <ul style="color:#374151;font-size:14px;line-height:1.7;margin:8px 0 14px;padding-left:20px">
      ${summaryLines.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
    </ul>
    ${viewedCallout ? `
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 18px;background:#fffbeb;border-left:3px solid #CFB36E;padding:12px 14px;border-radius:0 8px 8px 0">
      ${viewedCallout}
    </p>` : ''}
    ${standouts.length ? `
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;background:#f9fafb;border-left:3px solid #CFB36E;padding:12px 14px;border-radius:0 8px 8px 0">
      <strong style="color:#111">A few worth a look:</strong><br/>
      ${standouts.map((s) => escapeHtml(s)).join('<br/><br/>')}
    </p>` : ''}
    ${cards}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:#111;border-radius:12px">
      <tr><td style="padding:20px" align="center">
        <a href="${searchUrl || manageUrl}" style="display:inline-block;background:#CFB36E;color:#1a1a1a;font-size:14px;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;margin-bottom:12px">
          View all matches for this search
        </a>
        <p style="color:#fff;font-size:14px;line-height:1.7;margin:0">
          Any of these catch your eye? <strong style="color:#CFB36E">Just reply to this email</strong> and we'll set up a showing — or call/text <a href="${market.tel}" style="color:#CFB36E;text-decoration:none">${escapeHtml(AGENT_PHONE)}</a>.
        </p>
        <p style="color:#9ca3af;font-size:13px;margin:10px 0 0">— Adam &amp; Mandi Schwartz · ${escapeHtml(market.brand)} · ${escapeHtml(AGENT_PHONE)} · saahomes.com</p>
      </td></tr>
    </table>
    <div style="color:#9ca3af;font-size:11.5px;margin-top:18px;line-height:1.65">
      <p style="margin:0 0 8px">${escapeHtml(sources.iresIdx)}</p>
      <p style="margin:0 0 8px">${escapeHtml(footer.depthLine)}</p>
      <p style="margin:0 0 8px">
        ${escapeHtml(dpa.chfaLine)}
        <a href="${dpa.hubUrl}" style="color:#6b7280">${escapeHtml(dpa.hubPath)}</a>
      </p>
      <p style="margin:0 0 8px">${escapeHtml(fairHousing)} · ${escapeHtml(honestLabels.notAppraisal)}</p>
      <p style="margin:0">
        <a href="${manageUrl}" style="color:#4b5563">Manage your alerts</a> · <a href="${unsubscribeUrl}" style="color:#4b5563">Unsubscribe</a>
        <br/>${escapeHtml(footer.brandLine)} · ${escapeHtml(AGENT_PHONE)}
      </p>
    </div>
  </div>
  </body></html>`;
  }

  // Assigned-agent brand path (P-2)
  const brandUpper = String(brand.brandName || market.brand || 'SAA Homes').toUpperCase();
  const phone = brand.phone || AGENT_PHONE;
  const tel = brand.tel || market.tel;
  const headerSubline = brand.headerSubline || footer.headerSubline;
  const brandLine = brand.brandLine || footer.brandLine;
  const signOffName = brand.agentName || brand.brandName || market.brand;
  const voice = voiceCopy('digest', brand.voiceStyle, {
    firstName,
    city: cityLabel || brand.marketName || market.name,
    searchName,
    filterSummary,
    agentName: brand.agentName,
    brandName: brand.brandName,
  });
  const greeting = escapeHtml(voice.greeting);

  return `<!DOCTYPE html>
  <html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111">
    <tr><td align="center" style="padding:26px 16px">
      <div style="color:#CFB36E;font-size:22px;font-weight:800;letter-spacing:0.5px">${escapeHtml(brandUpper)}</div>
      <div style="color:#9ca3af;font-size:13px;margin-top:4px">${escapeHtml(headerSubline)}</div>
    </td></tr>
  </table>
  <div style="max-width:580px;margin:0 auto;padding:26px 16px">
    <p style="color:#111;font-size:15px;margin:0 0 4px">${greeting}</p>
    <p style="color:#4b5563;font-size:14.5px;line-height:1.6;margin:0 0 4px">
      ${voice.introHtml}
    </p>
    <ul style="color:#374151;font-size:14px;line-height:1.7;margin:8px 0 14px;padding-left:20px">
      ${summaryLines.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
    </ul>
    ${viewedCallout ? `
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 18px;background:#fffbeb;border-left:3px solid #CFB36E;padding:12px 14px;border-radius:0 8px 8px 0">
      ${viewedCallout}
    </p>` : ''}
    ${standouts.length ? `
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;background:#f9fafb;border-left:3px solid #CFB36E;padding:12px 14px;border-radius:0 8px 8px 0">
      <strong style="color:#111">A few worth a look:</strong><br/>
      ${standouts.map((s) => escapeHtml(s)).join('<br/><br/>')}
    </p>` : ''}
    ${cards}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:#111;border-radius:12px">
      <tr><td style="padding:20px" align="center">
        <a href="${searchUrl || manageUrl}" style="display:inline-block;background:#CFB36E;color:#1a1a1a;font-size:14px;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;margin-bottom:12px">
          View all matches for this search
        </a>
        <p style="color:#fff;font-size:14px;line-height:1.7;margin:0">
          Any of these catch your eye? <strong style="color:#CFB36E">Just reply to this email</strong> and we'll set up a showing — or call/text <a href="${tel}" style="color:#CFB36E;text-decoration:none">${escapeHtml(phone)}</a>.
        </p>
        <p style="color:#9ca3af;font-size:13px;margin:10px 0 0">— ${escapeHtml(signOffName)} · ${escapeHtml(brand.brandName)} · ${escapeHtml(phone)} · saahomes.com</p>
      </td></tr>
    </table>
    <div style="color:#9ca3af;font-size:11.5px;margin-top:18px;line-height:1.65">
      <p style="margin:0 0 8px">${escapeHtml(sources.iresIdx)}</p>
      <p style="margin:0 0 8px">${escapeHtml(footer.depthLine)}</p>
      <p style="margin:0 0 8px">
        ${escapeHtml(dpa.chfaLine)}
        <a href="${dpa.hubUrl}" style="color:#6b7280">${escapeHtml(dpa.hubPath)}</a>
      </p>
      <p style="margin:0 0 8px">${escapeHtml(fairHousing)} · ${escapeHtml(honestLabels.notAppraisal)}</p>
      <p style="margin:0">
        <a href="${manageUrl}" style="color:#4b5563">Manage your alerts</a> · <a href="${unsubscribeUrl}" style="color:#4b5563">Unsubscribe</a>
        <br/>${escapeHtml(brandLine)} · ${escapeHtml(phone)}
      </p>
    </div>
  </div>
  </body></html>`;
}

/**
 * Build a "you viewed X — N similar just hit the market" callout from real view data.
 * Only returns HTML when we have a real viewed address AND fresh matches exist.
 */
function buildViewedCallout(recentViews, freshListings) {
  if (!recentViews?.length || !freshListings?.length) return '';
  const viewed = recentViews.find((v) => v.street || v.address);
  if (!viewed) return '';
  const label = viewed.street || viewed.address;
  if (!label) return '';
  // Don't mention a listing if it's already in the fresh cards
  const freshIds = new Set(freshListings.map((l) => l.listing_id));
  const similarCount = freshListings.length;
  if (freshIds.has(viewed.listing_id) && similarCount <= 1) {
    // They viewed one of the new ones — still useful nudge
    return `<strong style="color:#111">You recently viewed ${escapeHtml(label)}</strong> — and it's still matching your search. Worth a closer look?`;
  }
  const n = similarCount === 1 ? '1 similar home just hit the market' : `${similarCount} similar homes just hit the market`;
  return `<strong style="color:#111">You viewed ${escapeHtml(label)}</strong> — ${n}. Here are the ones that match your saved search.`;
}

async function sendEmail(to, subject, html, fromName = AGENT_FROM) {
  const host = process.env.OUTREACH_SMTP_HOST;
  const user = process.env.OUTREACH_SMTP_USER;
  const password = process.env.OUTREACH_SMTP_PASSWORD;
  if (!host || !user || !password) throw new Error('OUTREACH_SMTP_* not set');
  const transporter = nodemailer.createTransport({ host, port: 587, secure: false, auth: { user, pass: password } });
  await transporter.sendMail({ from: `"${fromName || AGENT_FROM}" <${FROM}>`, to, subject, html });
}

// ---------------------------------------------------------------- main
async function runSearch(search, { dryRun, onlyEmail }) {
  const { whereSql, params } = buildWhere(search.filters);
  const res = await pool.query(
    `SELECT id, listing_id, slug, street_number, street_name, city, state, postal_code,
            list_price, original_list_price, beds, baths, living_area, home_type,
            property_subtype, days_on_market, photos, status, price_change_timestamp,
            elementary_school, middle_school, high_school, school_district, subdivision,
            lot_size_acres, garage_spaces, year_built, hoa_fee, features, description
     FROM listings WHERE ${whereSql} ORDER BY updated_at DESC LIMIT 60`,
    params
  );
  const current = res.rows;

  const snap = await pool.query(
    'SELECT result_ids FROM search_snapshots WHERE search_id = $1 ORDER BY run_at DESC LIMIT 1',
    [search.id]
  );
  const prevIds = snap.rows.length ? new Set(snap.rows[0].result_ids || []) : new Set();
  const curIds = new Set(current.map((l) => l.listing_id));

  const events = [];
  for (const l of current) {
    if (!prevIds.has(l.listing_id)) {
      events.push({ type: 'new', listing: l });
    } else if (
      l.original_list_price && l.list_price &&
      Number(l.original_list_price) > Number(l.list_price)
    ) {
      events.push({ type: 'price_drop', listing: l });
    }
  }
  const statusChanges = [...prevIds].filter((id) => !curIds.has(id)).length;

  const fresh = events.filter((e) => e.type === 'new');
  const drops = events.filter((e) => e.type === 'price_drop');
  if (!fresh.length && !drops.length && !statusChanges) return { sent: false, events: 0 };

  const cards = [...fresh.map((e) => cardHtml(e.listing, search.filters, true, false)),
    ...drops.map((e) => cardHtml(e.listing, search.filters, false, true))].join('');

  const zipLabel = search.filters.postal_code || search.filters.postalCode || search.filters.zip || '';
  const locBits = [
    search.filters.city && search.filters.city !== '__noco__' && search.filters.city !== '__all__'
      ? String(search.filters.city).replace(/,/g, ', ')
      : '',
    zipLabel ? String(zipLabel).replace(/,/g, ', ') : '',
  ].filter(Boolean);
  const filterSummary = [
    locBits.length ? `in ${locBits.join(' · ')}` : '',
    search.filters.minPrice || search.filters.maxPrice
      ? `${fmtPrice(search.filters.minPrice)} – ${fmtPrice(search.filters.maxPrice)}`
      : '',
    search.filters.beds ? `${search.filters.beds}+ beds` : '',
    search.filters.baths ? `${search.filters.baths}+ baths` : '',
    search.filters.type ? HOME_TYPE_LABEL[search.filters.type] : '',
  ].filter(Boolean).join(' · ');

  // Accurate, human summary lines (counts always match the cards above)
  const summaryLines = [];
  if (fresh.length === 1) summaryLines.push('1 new home hit the market matching your search');
  if (fresh.length > 1) summaryLines.push(`${fresh.length} new homes hit the market matching your search`);
  if (drops.length === 1) summaryLines.push('1 price drop on a home you may have seen');
  if (drops.length > 1) summaryLines.push(`${drops.length} price drops on homes you may have seen`);
  if (statusChanges === 1) summaryLines.push('1 home from your search went off market');
  if (statusChanges > 1) summaryLines.push(`${statusChanges} homes from your search went off market`);
  if (!summaryLines.length) summaryLines.push('New activity matched your search');

  const userRes = await pool.query('SELECT email, name FROM users WHERE id = $1', [search.user_id]);
  const userRow = userRes.rows[0];
  if (!userRow?.email) return { sent: false, events: 0 };
  if (onlyEmail && !userRow.email.toLowerCase().includes(onlyEmail.toLowerCase())) return { sent: false, events: 0 };
  const firstName = (userRow.name || '').trim().split(' ')[0] || null;

  // Personalized subject: "Adam — 3 new homes in Fort Collins match your search"
  const cityLabel = (() => {
    const c = search.filters.city;
    const z = search.filters.postal_code || search.filters.postalCode || search.filters.zip || '';
    if (c && c !== '__noco__' && c !== '__all__') {
      const parts = String(c).split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 2) return `${parts.slice(0, 2).join(', ')} +${parts.length - 2}`;
      if (parts.length) return parts.join(', ');
    }
    if (z) {
      const zparts = String(z).split(',').map((s) => s.trim()).filter(Boolean);
      if (zparts.length > 2) return `ZIP ${zparts.slice(0, 2).join(', ')} +${zparts.length - 2}`;
      return `ZIP ${zparts.join(', ')}`;
    }
    if (c === '__all__') return 'Colorado';
    return marketPack.market.name;
  })();
  const newCount = fresh.length;
  const dropCount = drops.length;
  // Assigned-agent brand (P-2). Unassigned → null → SAA copy unchanged.
  let brand = null;
  try {
    brand = await loadBrandForClientUser(pool, search.user_id);
  } catch (e) {
    console.error('tenant brand lookup failed:', e.message);
    brand = null;
  }

  // Deterministic A/B subject (same user always gets same variant for digest)
  let { key: subjectVariant, subject } = pickVariant('digest', search.user_id, {
    firstName,
    cityLabel,
    newCount,
    dropCount,
  });
  // Optional brand prefix only on variant C ("market update" slot) when assigned
  if (brand?.agentFirstName && subjectVariant === 'C') {
    subject = `${brand.agentFirstName} · ${subject}`;
  }

  // Conversational standouts: 2-3 notable homes with data-derived facts.
  const standouts = [];
  const notable = [...drops.slice(0, 2), ...fresh.slice(0, 2)].slice(0, 3);
  for (const e of notable) {
    const l = e.listing;
    const addr = [l.street_number, l.street_name, l.city].filter(Boolean).join(' ');
    const facts = featureHighlights(l);
    const factText = facts.slice(0, 2).join(', ');
    if (e.type === 'price_drop') {
      const pct = l.list_price && l.original_list_price
        ? Math.round((1 - Number(l.list_price) / Number(l.original_list_price)) * 100) : null;
      standouts.push(`The ${l.beds != null ? `${l.beds}-bed ` : ''}home at ${addr} just dropped ${pct ? `${pct}%` : 'in price'} to ${fmtPrice(l.list_price)}${factText ? ` — ${factText}` : ''}.`);
    } else {
      standouts.push(`New today: the ${l.beds != null ? `${l.beds}-bed ` : ''}home at ${addr} is listed at ${fmtPrice(l.list_price)}${factText ? ` — ${factText}` : ''}.`);
    }
  }

  // "You viewed X" personalization from real property_views
  let recentViews = [];
  try {
    recentViews = await getRecentViews(search.user_id, 5, pool);
  } catch (e) {
    console.error('recent views lookup failed:', e.message);
  }
  const viewedCallout = buildViewedCallout(recentViews, fresh.map((e) => e.listing));

  const manageUrl = `${SITE}/my-saved-searches/?token=${search.manage_token}`;
  const unsubscribeUrl = `${SITE}/api/alerts/unsubscribe?token=${search.manage_token}`;
  const searchPath = filtersToSearchPath(search.filters || {});
  const searchUrl = `${SITE}${searchPath}`;

  if (dryRun) {
    console.log(`[dry] → ${userRow.email}: "${subject}" [variant ${subjectVariant}] (${events.length} events: ${fresh.length} new, ${drops.length} drops, ${statusChanges} off-market)${viewedCallout ? ' [viewed callout]' : ''}`);
    return { sent: false, events: events.length, subject, subjectVariant, viewedCallout: !!viewedCallout };
  }

  const tok = openToken();
  const html = withOpenPixel(digestHtml({
    firstName,
    searchName: search.name,
    filterSummary,
    summaryLines,
    standouts,
    cards,
    manageUrl,
    unsubscribeUrl,
    searchUrl,
    viewedCallout,
    brand,
    cityLabel,
  }), SITE, tok);

  const fromName = brand?.fromName || AGENT_FROM;
  await sendEmail(userRow.email, subject, html, fromName);
  await pool.query(
    `INSERT INTO email_log (user_id, search_id, type, to_email, subject, events, subject_variant, open_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [search.user_id, search.id, 'digest', userRow.email, subject, events.length, subjectVariant, tok]
  );
  for (const e of events) {
    await pool.query(
      'INSERT INTO alert_events (search_id, listing_id, type, detail) VALUES ($1,$2,$3,$4)',
      [search.id, e.listing.listing_id, e.type, JSON.stringify({ old_price: null, list_price: e.listing.list_price })]
    );
  }

  // In-app notification center (non-blocking — email path already succeeded)
  try {
    if (fresh.length) {
      await notifyNewMatches({
        userId: search.user_id,
        searchName: search.name,
        listings: fresh.map((e) => e.listing),
        pool,
      });
    }
    for (const e of drops.slice(0, 10)) {
      await notifyPriceDrop({
        userId: search.user_id,
        listing: e.listing,
        oldPrice: e.listing.original_list_price,
        pool,
      });
    }
  } catch (notifErr) {
    console.error('notification insert failed:', notifErr.message);
  }

  await pool.query('UPDATE saved_searches SET last_run_at = NOW(), last_email_at = NOW() WHERE id = $1', [search.id]);
  await pool.query(
    'INSERT INTO search_snapshots (search_id, result_ids) VALUES ($1, $2)',
    [search.id, JSON.stringify([...curIds])]
  );
  console.log(`✓ ${userRow.email}: "${subject}" — ${events.length} events (${fresh.length} new, ${drops.length} drops, ${statusChanges} off-market)`);
  return { sent: true, events: events.length, subject };
}

/** Send pending email_outbox rows (magic links, transactional emails).
 *  Respects due_at when set (cadence-queued rows wait until due). */
async function drainOutbox() {
  const pending = await pool.query(
    `SELECT id, to_email, subject, html FROM email_outbox
     WHERE sent_at IS NULL
       AND (due_at IS NULL OR due_at <= NOW())
     ORDER BY id
     LIMIT 50`
  );
  if (!pending.rows.length) return 0;
  let sent = 0;
  for (const row of pending.rows) {
    try {
      await sendEmail(row.to_email, row.subject, row.html);
      await pool.query('UPDATE email_outbox SET sent_at = NOW() WHERE id = $1', [row.id]);
      sent += 1;
    } catch (e) {
      console.error(`outbox row ${row.id} failed: ${e.message}`);
    }
  }
  console.log(`outbox: ${sent}/${pending.rows.length} pending emails sent`);
  return sent;
}

export async function runDigest({ dryRun = false, onlyEmail = null, onlySearch = null, outboxOnly = false, force = false, closePool = false } = {}) {
  if (outboxOnly) {
    const n = await drainOutbox();
    if (closePool) await pool.end();
    return { outboxSent: n };
  }

  const q = `
    SELECT s.id, s.user_id, s.name, s.filters, s.frequency, s.send_time, s.send_day, s.last_email_at,
           u.email AS user_email, u.manage_token
    FROM saved_searches s JOIN users u ON u.id = s.user_id
    WHERE s.is_active = TRUE AND u.status = 'active'
    ${onlySearch ? 'AND s.id = $1' : ''}
    ORDER BY s.id`;
  const params = onlySearch ? [Number(onlySearch)] : [];
  const allSearches = (await pool.query(q, params)).rows;

  // Cache listing_alert prefs per user (default daily when no row)
  const listingPrefByUser = new Map();
  async function listingPrefFor(userId) {
    if (listingPrefByUser.has(userId)) return listingPrefByUser.get(userId);
    const freq = await getPrefFrequency(userId, 'listing_alert', pool);
    listingPrefByUser.set(userId, freq);
    return freq;
  }

  const dueSearches = [];
  for (const s of allSearches) {
    if (force) {
      dueSearches.push(s);
      continue;
    }
    const pref = await listingPrefFor(s.user_id);
    if (isDueWithListingPref(s, pref)) dueSearches.push(s);
  }
  const searches = dueSearches;
  if (allSearches.length !== searches.length) {
    console.log(`alertDigest: ${allSearches.length} active searches, ${searches.length} due now${dryRun ? ' (DRY RUN)' : ''}`);
  } else {
    console.log(`alertDigest: ${searches.length} active saved searches${dryRun ? ' (DRY RUN)' : ''}`);
  }

  let sent = 0;
  let totalEvents = 0;
  for (const s of searches) {
    // Always honor 'off' — even with --force (user explicitly stopped listing emails)
    const pref = await listingPrefFor(s.user_id);
    if (pref === 'off') {
      console.log(`skip search ${s.id}: listing_alert pref is off`);
      continue;
    }
    const result = await runSearch({ ...s, manage_token: s.manage_token }, { dryRun, onlyEmail });
    if (result.sent) sent += 1;
    totalEvents += result.events || 0;
  }
  console.log(`alertDigest done: ${sent} emails sent, ${totalEvents} total events.`);

  // Saved-home price drops + off-market (independent of search digests)
  if (!dryRun) {
    try {
      const scanned = await scanSavedHomesForNotifications({ pool });
      if (scanned.priceDrops || scanned.offMarket) {
        console.log(
          `saved-homes notifications: ${scanned.priceDrops} price drops, ${scanned.offMarket} off-market`
        );
      }
    } catch (e) {
      console.error('saved-homes notification scan failed:', e.message);
    }
  }

  const outboxSent = await drainOutbox();
  if (closePool) await pool.end();
  return { sent, events: totalEvents, outboxSent };
}

const isMain = process.argv[1]?.endsWith('alertDigest.js');
if (isMain) {
  const args = process.argv.slice(2);
  runDigest({
    dryRun: args.includes('--dry'),
    onlyEmail: args.find((a) => a.startsWith('--email='))?.split('=')[1],
    onlySearch: args.find((a) => a.startsWith('--search='))?.split('=')[1],
    outboxOnly: args.includes('--outbox-only'),
    force: args.includes('--force'),
    closePool: true,
  })
    .then(() => process.exit(0))
    .catch((e) => { console.error('alertDigest error:', e); process.exit(1); });
}

export { buildWhere, matchScore, featureHighlights };
