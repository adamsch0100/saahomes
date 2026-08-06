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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const SITE = 'https://saahomes.com';
const FROM = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER || 'alerts@saahomes.com';
const AGENT_FROM = 'Adam Schwartz, SAA Homes';
const AGENT_PHONE = '(970) 999-1407';

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

// ---------------------------------------------------------------- filters
function buildWhere(filters) {
  const where = ['is_active = TRUE', 'status = \'Active\''];
  const params = [];
  let i = 1;
  const f = filters || {};
  if (f.city) { where.push(`LOWER(city) = LOWER($${i++})`); params.push(String(f.city)); }
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
  }
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
  const photo = (l.photos && l.photos[0]) || `${SITE}/images/buyers-hero.jpg`;
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
function digestHtml({ firstName, searchName, filterSummary, summaryLines, standouts, cards, manageUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  return `<!DOCTYPE html>
  <html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111">
    <tr><td align="center" style="padding:26px 16px">
      <div style="color:#CFB36E;font-size:22px;font-weight:800;letter-spacing:0.5px">SAA HOMES</div>
      <div style="color:#9ca3af;font-size:13px;margin-top:4px">Schwartz and Associates · Northern Colorado Real Estate</div>
    </td></tr>
  </table>
  <div style="max-width:580px;margin:0 auto;padding:26px 16px">
    <p style="color:#111;font-size:15px;margin:0 0 4px">${greeting}</p>
    <p style="color:#4b5563;font-size:14.5px;line-height:1.6;margin:0 0 4px">
      It's <strong>Adam Schwartz</strong> with SAA Homes. Here's what came in for your
      <strong>${escapeHtml(searchName)}</strong> search — ${escapeHtml(filterSummary)}:
    </p>
    <ul style="color:#374151;font-size:14px;line-height:1.7;margin:8px 0 14px;padding-left:20px">
      ${summaryLines.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
    </ul>
    ${standouts.length ? `
    <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;background:#f9fafb;border-left:3px solid #CFB36E;padding:12px 14px;border-radius:0 8px 8px 0">
      <strong style="color:#111">A few worth a look:</strong><br/>
      ${standouts.map((s) => escapeHtml(s)).join('<br/><br/>')}
    </p>` : ''}
    ${cards}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:#111;border-radius:12px">
      <tr><td style="padding:20px">
        <p style="color:#fff;font-size:14px;line-height:1.7;margin:0">
          Any of these catch your eye? <strong style="color:#CFB36E">Just reply to this email</strong> and we'll set up a showing — or call/text <a href="tel:+19709991407" style="color:#CFB36E;text-decoration:none">${AGENT_PHONE}</a>.
        </p>
        <p style="color:#9ca3af;font-size:13px;margin:10px 0 0">— Adam &amp; Mandi Schwartz · SAA Homes · saahomes.com</p>
      </td></tr>
    </table>
    <p style="color:#9ca3af;font-size:11.5px;margin-top:18px;line-height:1.6">
      IDX information provided by IRES. Listing data is believed reliable but not guaranteed.<br/>
      <a href="${manageUrl}" style="color:#4b5563">Manage your alerts</a> · <a href="${unsubscribeUrl}" style="color:#4b5563">Unsubscribe</a>
    </p>
  </div>
  </body></html>`;
}

async function sendEmail(to, subject, html) {
  const host = process.env.OUTREACH_SMTP_HOST;
  const user = process.env.OUTREACH_SMTP_USER;
  const password = process.env.OUTREACH_SMTP_PASSWORD;
  if (!host || !user || !password) throw new Error('OUTREACH_SMTP_* not set');
  const transporter = nodemailer.createTransport({ host, port: 587, secure: false, auth: { user, pass: password } });
  await transporter.sendMail({ from: `"${AGENT_FROM}" <${FROM}>`, to, subject, html });
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

  const filterSummary = [
    search.filters.city ? `in ${search.filters.city}` : '',
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

  const freshText = fresh.length ? `${fresh.length} new` : '';
  const dropText = drops.length ? `${drops.length} price drop${drops.length > 1 ? 's' : ''}` : '';
  const changeText = statusChanges ? `${statusChanges} off market` : '';
  const subjectParts = [freshText, dropText, changeText].filter(Boolean);
  const subject = subjectParts.length
    ? `Adam here — ${subjectParts.join(', ')} in ${search.filters.city || 'Northern Colorado'}`
    : 'Adam here — an update on your saved search';

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

  const userRes = await pool.query('SELECT email, name FROM users WHERE id = $1', [search.user_id]);
  const userRow = userRes.rows[0];
  if (!userRow?.email) return { sent: false, events: 0 };
  if (onlyEmail && !userRow.email.toLowerCase().includes(onlyEmail.toLowerCase())) return { sent: false, events: 0 };
  const firstName = (userRow.name || '').trim().split(' ')[0] || null;

  const manageUrl = `${SITE}/alerts/manage/?token=${search.manage_token}`;
  const unsubscribeUrl = `${SITE}/api/alerts/unsubscribe?token=${search.manage_token}`;

  if (dryRun) {
    console.log(`[dry] → ${userRow.email}: "${subject}" (${events.length} events: ${fresh.length} new, ${drops.length} drops, ${statusChanges} off-market)`);
    return { sent: false, events: events.length, subject };
  }

  await sendEmail(userRow.email, subject, digestHtml({
    firstName, searchName: search.name, filterSummary, summaryLines, standouts, cards, manageUrl, unsubscribeUrl,
  }));
  await pool.query(
    'INSERT INTO email_log (user_id, search_id, type, to_email, subject, events) VALUES ($1,$2,$3,$4,$5,$6)',
    [search.user_id, search.id, 'digest', userRow.email, subject, events.length]
  );
  for (const e of events) {
    await pool.query(
      'INSERT INTO alert_events (search_id, listing_id, type, detail) VALUES ($1,$2,$3,$4)',
      [search.id, e.listing.listing_id, e.type, JSON.stringify({ old_price: null, list_price: e.listing.list_price })]
    );
  }
  await pool.query('UPDATE saved_searches SET last_run_at = NOW(), last_email_at = NOW() WHERE id = $1', [search.id]);
  await pool.query(
    'INSERT INTO search_snapshots (search_id, result_ids) VALUES ($1, $2)',
    [search.id, JSON.stringify([...curIds])]
  );
  console.log(`✓ ${userRow.email}: "${subject}" — ${events.length} events (${fresh.length} new, ${drops.length} drops, ${statusChanges} off-market)`);
  return { sent: true, events: events.length, subject };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const onlyEmail = args.find((a) => a.startsWith('--email='))?.split('=')[1];
  const onlySearch = args.find((a) => a.startsWith('--search='))?.split('=')[1];

  const q = `
    SELECT s.id, s.user_id, s.name, s.filters, s.frequency, s.send_time, s.send_day, s.last_email_at,
           u.email AS user_email, u.manage_token
    FROM saved_searches s JOIN users u ON u.id = s.user_id
    WHERE s.is_active = TRUE AND u.status = 'active'
    ${onlySearch ? 'AND s.id = $1' : ''}
    ORDER BY s.id`;
  const params = onlySearch ? [Number(onlySearch)] : [];
  const allSearches = (await pool.query(q, params)).rows;
  const force = args.includes('--force');
  const searches = force ? allSearches : allSearches.filter((s) => isDue(s));
  if (allSearches.length !== searches.length) {
    console.log(`alertDigest: ${allSearches.length} active searches, ${searches.length} due now${dryRun ? ' (DRY RUN)' : ''}`);
  } else {
    console.log(`alertDigest: ${searches.length} active saved searches${dryRun ? ' (DRY RUN)' : ''}`);
  }

  let sent = 0;
  let totalEvents = 0;
  for (const s of searches) {
    const result = await runSearch({ ...s, manage_token: s.manage_token }, { dryRun, onlyEmail });
    if (result.sent) sent += 1;
    totalEvents += result.events || 0;
  }
  console.log(`alertDigest done: ${sent} emails sent, ${totalEvents} total events.`);
  await pool.end();
}

const isMain = process.argv[1]?.endsWith('alertDigest.js');
if (isMain) {
  main().catch((e) => { console.error('alertDigest error:', e); process.exit(1); });
}

export { buildWhere, matchScore, featureHighlights };
