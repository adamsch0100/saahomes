/**
 * A/B subject-line engine for nurture emails (Phase D / It 19a).
 *
 * pickVariant is pure + deterministic: same (type, userId) always maps to the
 * same variant key so a user never sees different subjects for the same
 * email type. Every subject derives ONLY from ctx (real computed values) —
 * never invent counts, prices, or cities.
 *
 * Transport-agnostic: returns { key, subject }; callers pass them to their
 * own sender + email_log INSERT, and append openPixelHtml themselves.
 */
import crypto from 'crypto';

/** 32-bit FNV-1a — stable, no deps, good enough for 3-way bucketing. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Random hex token for the open-tracking pixel URL. */
export function openToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * 1×1 open-tracking pixel HTML. Append before </body> of the email.
 * @param {string} site  e.g. https://saahomes.com
 * @param {string} tok   open_token hex
 */
export function openPixelHtml(site, tok) {
  const src = `${String(site).replace(/\/$/, '')}/api/email/open/${tok}`;
  return `<img src="${src}" width="1" height="1" alt="" style="display:none" />`;
}

/** Append open pixel just before </body> (case-insensitive). */
export function withOpenPixel(html, site, tok) {
  const pixel = openPixelHtml(site, tok);
  if (!html) return pixel;
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return `${html}${pixel}`;
  return `${html.slice(0, idx)}${pixel}${html.slice(idx)}`;
}

function plural(n, one, many) {
  return Number(n) === 1 ? one : many;
}

/**
 * Build the 3-variant pool for a listing digest given real branch data.
 * Branches mirror the historical subject logic in alertDigest.js so content
 * always matches the email body.
 */
function digestPool(ctx) {
  const firstName = (ctx.firstName || '').trim() || null;
  const city = (ctx.cityLabel || 'Northern Colorado').trim() || 'Northern Colorado';
  const newCount = Number(ctx.newCount) || 0;
  const dropCount = Number(ctx.dropCount) || 0;
  const nameSuffix = firstName ? `, ${firstName}` : '';
  const namePrefix = firstName ? `${firstName} — ` : '';

  if (newCount > 0 && dropCount === 0) {
    const homes = plural(newCount, 'home', 'homes');
    return [
      {
        key: 'A',
        subject: `${namePrefix}${newCount} new ${homes} in ${city} match your search`,
      },
      {
        key: 'B',
        subject: `${newCount} ${city} ${homes} just for you${nameSuffix}`,
      },
      {
        key: 'C',
        subject: `${city} market update: ${newCount} new ${homes}`,
      },
    ];
  }

  if (dropCount > 0 && newCount === 0) {
    const drops = plural(dropCount, 'price drop', 'price drops');
    return [
      {
        key: 'A',
        subject: `${namePrefix}${dropCount} ${drops} in ${city}`,
      },
      {
        key: 'B',
        subject: `${dropCount} ${drops} in ${city}${nameSuffix}`,
      },
      {
        key: 'C',
        subject: `${city} market update: ${dropCount} ${drops}`,
      },
    ];
  }

  if (newCount > 0 && dropCount > 0) {
    const drops = plural(dropCount, 'price drop', 'price drops');
    return [
      {
        key: 'A',
        subject: `${namePrefix}${newCount} new, ${dropCount} ${drops} in ${city}`,
      },
      {
        key: 'B',
        subject: `${newCount} new + ${dropCount} ${drops} in ${city}${nameSuffix}`,
      },
      {
        key: 'C',
        subject: `${city} market update: ${newCount} new, ${dropCount} ${drops}`,
      },
    ];
  }

  // Status-change / no-new-no-drop branch — still honest about "update"
  return [
    {
      key: 'A',
      subject: firstName
        ? `${firstName} — an update on your ${city} home search`
        : `An update on your ${city} home search`,
    },
    {
      key: 'B',
      subject: `Your ${city} home search has new activity${nameSuffix}`,
    },
    {
      key: 'C',
      subject: `${city} home search update${nameSuffix}`,
    },
  ];
}

/**
 * Home-value digest pool. mid/delta must come from computeOurEstimate —
 * never invented. midFmt / deltaFmt are pre-formatted currency strings.
 */
function homeValuePool(ctx) {
  const city = (ctx.cityLabel || ctx.city || 'Northern Colorado').trim() || 'Northern Colorado';
  const midFmt = ctx.midFmt || ctx.mid || '';
  const delta = ctx.delta;
  const deltaFmt = ctx.deltaFmt || '';
  const hasDelta = delta != null && delta !== 0 && deltaFmt;

  const control = hasDelta
    ? `Your home's estimated value: ${midFmt} (${delta > 0 ? 'up' : 'down'} ${deltaFmt} vs last month)`
    : `Your home's estimated value: ${midFmt}`;

  return [
    { key: 'A', subject: control },
    { key: 'B', subject: `${city} prices moved — see your home's estimate` },
    { key: 'C', subject: `How much is your ${city} home worth now?` },
  ];
}

/**
 * Pick a subject variant for a nurture email type.
 *
 * @param {'digest'|'home_value'|'home_value_digest'} type
 * @param {number|string} userId  — used only for deterministic bucketing
 * @param {object} ctx  — real data the caller already computed
 * @returns {{ key: string, subject: string }}
 */
export function pickVariant(type, userId, ctx = {}) {
  const t = String(type || '').toLowerCase();
  let pool;
  if (t === 'digest') {
    pool = digestPool(ctx);
  } else if (t === 'home_value' || t === 'home_value_digest') {
    pool = homeValuePool(ctx);
  } else {
    // Unknown type — single control so callers never crash
    pool = [{ key: 'A', subject: ctx.subject || 'SAA Homes update' }];
  }

  const seed = `${t === 'home_value_digest' ? 'home_value' : t}:${userId ?? ''}`;
  const idx = fnv1a(seed) % pool.length;
  const picked = pool[idx] || pool[0];
  return { key: picked.key, subject: picked.subject };
}

export default { pickVariant, openToken, openPixelHtml, withOpenPixel, fnv1a };
