/**
 * Nightly saved-search digest engine (RealScout-style follow-up):
 *   For every active saved search:
 *     1. Run the saved filters against the listings table
 *     2. Diff vs the last snapshot → NEW listings
 *     3. Detect price drops (original_list_price > list_price) + status changes
 *     4. Send an HTML digest email with listing cards + match scores
 *     5. Record snapshot + email_log
 *
 * CLI:  node backend/src/services/alertDigest.js          → process everyone
 *       node backend/src/services/alertDigest.js --dry    → print, don't send
 *       node backend/src/services/alertDigest.js --email x@y.z → only that user
 *       node backend/src/services/alertDigest.js --search N → only that search
 *
 * Env:  DATABASE_URL (repo .env) + OUTREACH_SMTP_HOST/USER/PASSWORD/FROM
 *       (sourced from /opt/data/.env by the wrapper or shell).
 */
import 'dotenv/config';
import pg from 'pg';
import nodemailer from 'nodemailer';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const SITE = 'https://saahomes.com';
const FROM = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER || 'alerts@saahomes.com';

const fmtPrice = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

// ---------------------------------------------------------------- filters
const HOME_TYPE_LABEL = { detached: 'Detached Home', attached: 'Condo / Townhome / Attached', land: 'Land', commercial: 'Commercial', other: 'Property' };

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

function whyLines(l, filters, isNew) {
  const lines = [];
  if (isNew) lines.push('New today');
  if (l.original_list_price && l.list_price && Number(l.original_list_price) > Number(l.list_price)) {
    lines.push(`Price reduced ${fmtPrice(l.original_list_price)} → ${fmtPrice(l.list_price)}`);
  }
  if (filters.maxPrice && l.list_price != null && Number(l.list_price) <= Number(filters.maxPrice)) lines.push('Within your price range');
  if (filters.minPrice && l.list_price != null && Number(l.list_price) >= Number(filters.minPrice)) lines.push('Meets your minimum budget');
  if (filters.beds && l.beds != null && l.beds >= Number(filters.beds)) lines.push(`${l.beds}+ beds — matches your search`);
  return lines.slice(0, 3);
}

function cardHtml(l, filters, isNew) {
  const photo = (l.photos && l.photos[0]) || `${SITE}/images/buyers-hero.jpg`;
  const url = `${SITE}/homes-for-sale/${l.slug}/`;
  const score = matchScore(l, filters);
  const whys = whyLines(l, filters, isNew);
  const address = [l.street_number, l.street_name, l.city].filter(Boolean).join(' ');
  return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:16px;background:#fff">
      <a href="${url}" style="display:block;position:relative">
        <img src="${photo}" alt="${address}" style="width:100%;height:200px;object-fit:cover;display:block" loading="lazy"/>
        <span style="position:absolute;top:10px;left:10px;background:#CFB36E;color:#1a1a1a;font-weight:700;font-size:13px;padding:4px 10px;border-radius:6px">${score}% match</span>
        ${isNew ? '<span style="position:absolute;top:10px;right:10px;background:#111;color:#CFB36E;font-weight:700;font-size:11px;padding:4px 8px;border-radius:6px">NEW</span>' : ''}
      </a>
      <div style="padding:14px 16px">
        <div style="font-size:20px;font-weight:800;color:#111">${fmtPrice(l.list_price)}</div>
        <div style="color:#374151;font-size:14px;margin-top:2px">${[l.beds != null ? `${l.beds} bd` : '', l.baths != null ? `${l.baths} ba` : '', l.living_area != null ? `${Number(l.living_area).toLocaleString()} sqft` : '', HOME_TYPE_LABEL[l.home_type] || l.property_subtype].filter(Boolean).join(' · ')}</div>
        <div style="color:#6b7280;font-size:13px;margin-top:2px">${address}, CO</div>
        ${whys.length ? `<div style="margin-top:8px;font-size:12.5px;color:#92400e">${whys.map((w) => `✓ ${w}`).join(' &nbsp;·&nbsp; ')}</div>` : ''}
        <a href="${url}" style="display:inline-block;margin-top:10px;background:#111;color:#fff;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none">View this home</a>
      </div>
    </div>`;
}

function digestHtml({ searchName, filterSummary, cards, manageUrl, unsubscribeUrl }) {
  return `<!DOCTYPE html>
  <html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111">
    <tr><td align="center" style="padding:24px 16px">
      <div style="color:#CFB36E;font-size:22px;font-weight:800;letter-spacing:0.5px">SAA HOMES</div>
      <div style="color:#9ca3af;font-size:13px;margin-top:4px">Schwartz and Associates · Northern Colorado Real Estate</div>
    </td></tr>
  </table>
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <h1 style="font-size:20px;color:#111;margin:0 0 6px">New homes match your saved search</h1>
    <p style="color:#4b5563;font-size:14px;margin:0 0 4px"><strong>${escapeHtml(searchName)}</strong></p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px">${escapeHtml(filterSummary)}</p>
    ${cards}
    <p style="color:#9ca3af;font-size:12px;margin-top:20px;line-height:1.6">
      IDX information provided by IRES. Listing data is believed reliable but not guaranteed.<br/>
      <a href="${manageUrl}" style="color:#4b5563">Manage your alerts</a> · <a href="${unsubscribeUrl}" style="color:#4b5563">Unsubscribe</a>
    </p>
  </div>
  </body></html>`;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- send
async function sendEmail(to, subject, html) {
  const host = process.env.OUTREACH_SMTP_HOST;
  const user = process.env.OUTREACH_SMTP_USER;
  const password = process.env.OUTREACH_SMTP_PASSWORD;
  if (!host || !user || !password) throw new Error('OUTREACH_SMTP_* not set');
  const transporter = nodemailer.createTransport({ host, port: 587, secure: false, auth: { user, pass: password } });
  await transporter.sendMail({ from: `"SAA Homes Alerts" <${FROM}>`, to, subject, html });
}

// ---------------------------------------------------------------- main
async function runSearch(search, { dryRun, onlyEmail }) {
  const { whereSql, params } = buildWhere(search.filters);
  const res = await pool.query(
    `SELECT id, listing_id, slug, street_number, street_name, city, state, postal_code,
            list_price, original_list_price, beds, baths, living_area, home_type,
            property_subtype, days_on_market, photos, status, price_change_timestamp
     FROM listings WHERE ${whereSql} ORDER BY updated_at DESC LIMIT 60`,
    params
  );
  const current = res.rows;

  // last snapshot (result_ids)
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
  // status changes: listings that were active in the snapshot but now not (closed/pending)
  const statusChanges = [...prevIds].filter((id) => !curIds.has(id)).length;

  const fresh = events.filter((e) => e.type === 'new');
  const drops = events.filter((e) => e.type === 'price_drop');
  if (!fresh.length && !drops.length && !statusChanges) return { sent: false, events: 0 };

  const cards = [...fresh.map((e) => cardHtml(e.listing, search.filters, true)),
    ...drops.map((e) => cardHtml(e.listing, search.filters, false))].join('');

  const filterSummary = [
    search.filters.city ? `in ${search.filters.city}` : '',
    search.filters.minPrice || search.filters.maxPrice
      ? `${fmtPrice(search.filters.minPrice)} – ${fmtPrice(search.filters.maxPrice)}`
      : '',
    search.filters.beds ? `${search.filters.beds}+ beds` : '',
    search.filters.baths ? `${search.filters.baths}+ baths` : '',
    search.filters.type ? HOME_TYPE_LABEL[search.filters.type] : '',
  ].filter(Boolean).join(' · ');

  const freshText = fresh.length ? `${fresh.length} new` : '';
  const dropText = drops.length ? `${drops.length} price drop${drops.length > 1 ? 's' : ''}` : '';
  const changeText = statusChanges ? `${statusChanges} off market` : '';
  const subjectParts = [freshText, dropText, changeText].filter(Boolean);
  const subject = subjectParts.length
    ? `${subjectParts.join(', ')} — ${search.filters.city || 'Northern Colorado'} homes match your search`
    : 'Your saved search update';

  const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [search.user_id]);
  const to = userRes.rows[0]?.email;
  if (!to) return { sent: false, events: 0 };
  if (onlyEmail && !to.toLowerCase().includes(onlyEmail.toLowerCase())) return { sent: false, events: 0 };

  const manageUrl = `${SITE}/alerts/manage/?token=${search.manage_token}`;
  const unsubscribeUrl = `${SITE}/api/alerts/unsubscribe?token=${search.manage_token}`;

  if (dryRun) {
    console.log(`[dry] → ${to}: "${subject}" (${events.length} events, ${fresh.length} new, ${drops.length} drops, ${statusChanges} status)`);
    return { sent: false, events: events.length, subject };
  }

  await sendEmail(to, subject, digestHtml({ searchName: search.name, filterSummary, cards, manageUrl, unsubscribeUrl }));
  await pool.query(
    'INSERT INTO email_log (user_id, search_id, type, to_email, subject, events) VALUES ($1,$2,$3,$4,$5,$6)',
    [search.user_id, search.id, 'digest', to, subject, events.length]
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
  console.log(`✓ ${to}: "${subject}" — ${events.length} events (${fresh.length} new, ${drops.length} drops, ${statusChanges} off-market)`);
  return { sent: true, events: events.length, subject };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const onlyEmail = args.find((a) => a.startsWith('--email='))?.split('=')[1];
  const onlySearch = args.find((a) => a.startsWith('--search='))?.split('=')[1];

  const q = `
    SELECT s.id, s.user_id, s.name, s.filters, u.email AS user_email, u.manage_token
    FROM saved_searches s JOIN users u ON u.id = s.user_id
    WHERE s.is_active = TRUE AND u.status = 'active'
    ${onlySearch ? 'AND s.id = $1' : ''}
    ORDER BY s.id`;
  const params = onlySearch ? [Number(onlySearch)] : [];
  const searches = (await pool.query(q, params)).rows;
  console.log(`alertDigest: ${searches.length} active saved searches${dryRun ? ' (DRY RUN)' : ''}`);

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

export { buildWhere, matchScore };
