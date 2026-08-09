/**
 * Monthly seller home-value digest (Phase A / It 11).
 *
 * Email: "Your home's estimated value: $X (up $Y vs last month)"
 * Numbers come from VERIFIED zip/city MLS medians (our comps) — never a
 * fabricated per-home AVM. Market service AVMs stay on the dashboard (cached).
 *
 * CLI:  node backend/src/services/homeValueDigest.js
 *       node backend/src/services/homeValueDigest.js --dry
 *       node backend/src/services/homeValueDigest.js --email=x@y.z
 *
 * Cron: POST /api/cron/digest?mode=home-value&key=CRON_SECRET
 */
import 'dotenv/config';
import getPool from '../config/database.js';
import { sendEmail, smtpConfigured } from './emailer.js';
import { computeOurEstimate } from './sellerValueService.js';
import { notifyValueUpdate } from './notificationService.js';
import { getPrefFrequency } from './notificationPrefs.js';
import logger from '../utils/logger.js';

const SITE = 'https://saahomes.com';
const AGENT_PHONE = '(970) 999-1407';
const GOLD = '#CFB36E';

const fmt = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function digestHtml({
  firstName,
  address,
  mid,
  low,
  high,
  delta,
  label,
  manageUrl,
  unsubscribeUrl,
  myHomeUrl,
}) {
  const deltaLine =
    delta != null && delta !== 0
      ? delta > 0
        ? `<span style="color:#047857;font-weight:700">up ${fmt(delta)} vs last month</span>`
        : `<span style="color:#b45309;font-weight:700">down ${fmt(Math.abs(delta))} vs last month</span>`
      : `<span style="color:#6b7280">first monthly update</span>`;

  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111">
    <tr><td align="center" style="padding:24px 16px">
      <div style="color:${GOLD};font-size:20px;font-weight:800;letter-spacing:0.04em">SAA HOMES</div>
      <div style="color:#9ca3af;font-size:12px;margin-top:4px">Schwartz and Associates · Northern Colorado</div>
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <tr><td style="padding:28px 24px 8px">
          <p style="margin:0 0 12px;font-size:16px;line-height:1.5">${greeting}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#4b5563;line-height:1.5">
            Here&rsquo;s your monthly home value update for
            <strong style="color:#111">${escapeHtml(address)}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:8px 24px 20px">
          <div style="background:#111;border-radius:12px;padding:20px 18px;text-align:center">
            <div style="color:${GOLD};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Estimated value range</div>
            <div style="color:#fff;font-size:32px;font-weight:800;margin-top:8px;line-height:1.1">${fmt(mid)}</div>
            <div style="color:#d1d5db;font-size:14px;margin-top:6px">${fmt(low)} – ${fmt(high)}</div>
            <div style="margin-top:10px;font-size:13px">${deltaLine}</div>
          </div>
          <p style="margin:14px 0 0;font-size:12px;color:#6b7280;line-height:1.5">
            ${escapeHtml(label || 'Estimated range based on local sales data. Updated monthly. Not an appraisal.')}
          </p>
        </td></tr>
        <tr><td style="padding:4px 24px 8px">
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111">What would you like to do next?</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:0 0 10px">
              <a href="${myHomeUrl}" style="display:block;background:${GOLD};color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:14px 16px;border-radius:8px;text-align:center">
                View My Home Dashboard
              </a>
            </td></tr>
            <tr><td style="padding:0 0 10px">
              <a href="${SITE}/for-sellers/#market-report" style="display:block;background:#111;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 16px;border-radius:8px;text-align:center">
                Get My Full Market Analysis
              </a>
            </td></tr>
            <tr><td style="padding:0 0 10px">
              <a href="${SITE}/for-sellers/" style="display:block;border:2px solid #111;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 16px;border-radius:8px;text-align:center">
                Is Now the Right Time to Sell?
              </a>
            </td></tr>
            <tr><td style="padding:0 0 10px">
              <a href="tel:9709991407" style="display:block;border:1px solid #d1d5db;color:#111;text-decoration:none;font-weight:600;font-size:13px;padding:12px 16px;border-radius:8px;text-align:center">
                Talk to Adam &amp; Mandi — Free, No Pressure · ${AGENT_PHONE}
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px 28px;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5">
            Refinance curiosity? We&rsquo;ll connect you with a great local lender — we never advise rates.
            Questions about this home? Reply to this email or call ${AGENT_PHONE}.
          </p>
          <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;line-height:1.5">
            <a href="${manageUrl}" style="color:#6b7280">Manage preferences</a>
            &nbsp;·&nbsp;
            <a href="${unsubscribeUrl}" style="color:#6b7280">Unsubscribe from value updates</a>
            <br/>Schwartz and Associates · Fort Collins, CO · Estimates only, not appraisals.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Profiles due for a monthly value digest.
 * Rule: value_updates_enabled + never digested OR last_digest_at older than ~28 days.
 */
async function loadDueProfiles(pool, { onlyEmail = null, force = false } = {}) {
  const params = [];
  let emailClause = '';
  if (onlyEmail) {
    params.push(String(onlyEmail).toLowerCase());
    emailClause = ` AND LOWER(u.email) = $${params.length}`;
  }

  const dueClause = force
    ? 'TRUE'
    : `(hp.last_digest_at IS NULL OR hp.last_digest_at < NOW() - INTERVAL '28 days')`;

  const q = `
    SELECT hp.*, u.email AS user_email, u.name AS user_name, u.manage_token, u.status AS user_status
    FROM home_profiles hp
    JOIN users u ON u.id = hp.user_id
    WHERE hp.value_updates_enabled = TRUE
      AND u.status = 'active'
      AND ${dueClause}
      ${emailClause}
    ORDER BY hp.id
    LIMIT 200
  `;
  const r = await pool.query(q, params);
  return r.rows;
}

async function sendOne(profile, { dryRun = false } = {}) {
  const pool = getPool();

  // Account-level value_update cadence: 'off' skips entirely.
  // Digest remains monthly; immediate/daily/weekly/monthly all mean "on"
  // at the monthly cron cadence (honest — estimates update monthly).
  const valuePref = await getPrefFrequency(profile.user_id, 'value_update', pool);
  if (valuePref === 'off') {
    return { sent: false, skipped: 'pref_off' };
  }

  const our = await computeOurEstimate(profile, pool);
  if (our.mid == null) {
    return { sent: false, skipped: 'no_estimate' };
  }

  const prev = profile.last_digest_value != null ? Number(profile.last_digest_value) : null;
  const delta = prev != null ? our.mid - prev : null;

  const firstName = (profile.user_name || '').split(/\s+/)[0] || '';
  const address = [
    profile.address_line,
    profile.city,
    profile.state || 'CO',
    profile.postal_code,
  ].filter(Boolean).join(', ');

  const subject =
    delta != null && delta !== 0
      ? `Your home's estimated value: ${fmt(our.mid)} (${delta > 0 ? 'up' : 'down'} ${fmt(Math.abs(delta))} vs last month)`
      : `Your home's estimated value: ${fmt(our.mid)}`;

  const myHomeUrl = `${SITE}/my-home/?token=${profile.manage_token}`;
  const manageUrl = `${SITE}/my-home/?token=${profile.manage_token}`;
  const unsubscribeUrl = `${SITE}/my-home/?token=${profile.manage_token}&unsubscribe=1`;

  if (dryRun) {
    console.log(`[dry] → ${profile.user_email}: "${subject}"`);
    return { sent: false, dry: true, subject };
  }

  const html = digestHtml({
    firstName,
    address,
    mid: our.mid,
    low: our.low,
    high: our.high,
    delta,
    label: our.label,
    manageUrl,
    unsubscribeUrl,
    myHomeUrl,
  });

  // Prefer SMTP; fall back to outbox so cron never loses the send
  if (smtpConfigured()) {
    await sendEmail(profile.user_email, subject, html, 'Adam Schwartz, SAA Homes');
  } else {
    await pool.query(
      `INSERT INTO email_outbox (to_email, subject, html) VALUES ($1, $2, $3)`,
      [profile.user_email, subject, html]
    );
  }

  await pool.query(
    `UPDATE home_profiles SET
       last_digest_at = NOW(),
       last_digest_value = $1,
       our_estimate_low = $2,
       our_estimate_mid = $3,
       our_estimate_high = $4,
       our_estimate_label = $5,
       our_estimate_at = NOW(),
       updated_at = NOW()
     WHERE id = $6`,
    [our.mid, our.low, our.mid, our.high, our.label, profile.id]
  );

  await pool.query(
    `INSERT INTO email_log (user_id, search_id, type, to_email, subject, events)
     VALUES ($1, NULL, 'home_value_digest', $2, $3, 0)`,
    [profile.user_id, profile.user_email, subject]
  );

  // In-app notification center
  try {
    await notifyValueUpdate({
      userId: profile.user_id,
      address,
      mid: our.mid,
      delta,
      pool,
    });
  } catch (e) {
    logger.warn('homeValueDigest: notification insert failed', { message: e.message });
  }

  console.log(`✓ home-value → ${profile.user_email}: "${subject}"`);
  return { sent: true, subject, mid: our.mid, delta };
}

/**
 * Run monthly home-value digests.
 * @returns {{ sent: number, skipped: number, due: number }}
 */
export async function runHomeValueDigest({ dryRun = false, onlyEmail = null, force = false } = {}) {
  const pool = getPool();
  let due;
  try {
    due = await loadDueProfiles(pool, { onlyEmail, force });
  } catch (e) {
    // Table may not exist mid-deploy
    logger.warn('homeValueDigest: load failed', { message: e.message });
    return { sent: 0, skipped: 0, due: 0, error: e.message };
  }

  console.log(
    `homeValueDigest: ${due.length} profile(s) due${dryRun ? ' (DRY RUN)' : ''}${onlyEmail ? ` email=${onlyEmail}` : ''}`
  );

  let sent = 0;
  let skipped = 0;
  for (const p of due) {
    try {
      const result = await sendOne(p, { dryRun });
      if (result.sent) sent += 1;
      else skipped += 1;
    } catch (e) {
      skipped += 1;
      console.error(`home-value digest failed for profile ${p.id}:`, e.message);
    }
  }

  console.log(`homeValueDigest done: ${sent} sent, ${skipped} skipped.`);
  return { sent, skipped, due: due.length };
}

const isMain = process.argv[1]?.includes('homeValueDigest.js');
if (isMain) {
  const args = process.argv.slice(2);
  runHomeValueDigest({
    dryRun: args.includes('--dry'),
    onlyEmail: args.find((a) => a.startsWith('--email='))?.split('=')[1],
    force: args.includes('--force'),
  })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('homeValueDigest error:', e);
      process.exit(1);
    });
}
