/**
 * In-app notification center helpers (It 14.1 + It 18 cadence prefs).
 *
 * Creates lightweight rows for signed-in users when nurture events fire:
 * new_match, price_drop, value_update, off_market, showing_confirm.
 *
 * Cadence: looks up notification_prefs before insert.
 *   - frequency 'off' → skip in-app insert ({ skipped: true, reason: 'pref_off' })
 *   - missing row → default (search_activity/immediate, value_update/monthly)
 *   - agent types (showing_confirm, shared_home) always insert
 * In-app is always immediate when not off; email cadence is owned by
 * alertDigest / homeValueDigest (they honor the same prefs — no double email).
 *
 * Titles/bodies use only verified listing/search data — never fabricated values.
 * image_url is always a photo proxy path (/api/photo/{id}/0), never raw MLS media.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  getPrefFrequency,
  prefTypeForNotification,
} from './notificationPrefs.js';

const fmtPrice = (n) =>
  n == null || !Number.isFinite(Number(n))
    ? null
    : `$${Math.round(Number(n)).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function formatAddress(listing) {
  if (!listing) return null;
  const street = [listing.street_number, listing.street_name, listing.unit ? `#${listing.unit}` : null]
    .filter(Boolean)
    .join(' ');
  const city = listing.city || null;
  if (street && city) return `${street}, ${city}`;
  return street || city || null;
}

function listingLink(listing) {
  if (listing?.slug) return `/homes-for-sale/${listing.slug}/`;
  return '/my-saved-searches/?tab=homes';
}

function photoProxy(listing) {
  if (listing?.id) return `/api/photo/${listing.id}/0`;
  return null;
}

/**
 * Insert a single notification. Failures are logged, never thrown —
 * nurture email paths must not break if the notifications table is mid-migrate.
 *
 * Honors cadence prefs: 'off' skips insert. Callers that only check truthiness
 * still work (skipped → null-like via skipped flag on object; prefer checking
 * result?.skipped or result?.id).
 *
 * @param {object} opts
 * @param {number} [opts.dedupeDays] — if set with link, skip when same user+type+link
 *   already exists within this many days (avoids digest re-run spam)
 * @param {boolean} [opts.skipPrefCheck] — admin/forced inserts bypass prefs
 */
export async function createNotification({
  userId,
  type,
  title,
  body = null,
  link = null,
  imageUrl = null,
  dedupeDays = null,
  pool = null,
  skipPrefCheck = false,
} = {}) {
  if (!userId || !type || !title) return null;
  const db = pool || getPool();
  try {
    // Cadence gate: configurable types respect 'off'
    if (!skipPrefCheck) {
      const prefType = prefTypeForNotification(type);
      if (prefType) {
        const freq = await getPrefFrequency(userId, prefType, db);
        if (freq === 'off') {
          return { skipped: true, reason: 'pref_off', type: String(type).slice(0, 32) };
        }
      }
    }

    if (dedupeDays && link) {
      const days = Math.max(1, Math.min(90, Number(dedupeDays) || 7));
      const existing = await db.query(
        `SELECT id FROM notifications
         WHERE user_id = $1 AND type = $2 AND link = $3
           AND created_at > NOW() - ($4 * INTERVAL '1 day')
         LIMIT 1`,
        [Number(userId), String(type).slice(0, 32), String(link).slice(0, 500), days]
      );
      if (existing.rows.length) return null;
    }

    const r = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, link, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        Number(userId),
        String(type).slice(0, 32),
        String(title).slice(0, 500),
        body != null ? String(body).slice(0, 2000) : null,
        link != null ? String(link).slice(0, 500) : null,
        imageUrl != null ? String(imageUrl).slice(0, 500) : null,
      ]
    );
    return r.rows[0] || null;
  } catch (e) {
    logger.warn('notificationService.createNotification failed', {
      message: e.message,
      type,
      userId,
    });
    return null;
  }
}

/**
 * New listing matches a saved search → new_match notifications (capped).
 * @param {{ userId: number, searchName?: string, listings: object[] }} opts
 */
export async function notifyNewMatches({ userId, searchName, listings = [], pool = null } = {}) {
  if (!userId || !listings.length) return 0;
  const db = pool || getPool();
  const name = searchName ? String(searchName).trim() : 'your saved search';
  let created = 0;
  // Cap so one huge digest doesn't flood the center
  for (const listing of listings.slice(0, 10)) {
    const addr = formatAddress(listing) || 'a new home';
    const price = fmtPrice(listing.list_price);
    const title = `New match: ${addr}`;
    const body = [
      price ? `Listed at ${price}` : null,
      name ? `Matches “${name}”` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const row = await createNotification({
      userId,
      type: 'new_match',
      title,
      body: body || null,
      link: listingLink(listing),
      imageUrl: photoProxy(listing),
      dedupeDays: 7,
      pool: db,
    });
    if (row?.id) created += 1;
  }
  return created;
}

/**
 * Price drop on a listing the user is watching (saved search or saved home).
 */
export async function notifyPriceDrop({
  userId,
  listing,
  oldPrice = null,
  pool = null,
} = {}) {
  if (!userId || !listing) return null;
  const addr = formatAddress(listing) || 'A saved home';
  const newP = fmtPrice(listing.list_price);
  const oldP = fmtPrice(oldPrice);
  let body = null;
  if (newP && oldP) body = `Price dropped from ${oldP} to ${newP}`;
  else if (newP) body = `Now listed at ${newP}`;
  else body = 'Price was reduced';

  return createNotification({
    userId,
    type: 'price_drop',
    title: `Price drop: ${addr}`,
    body,
    link: listingLink(listing),
    imageUrl: photoProxy(listing),
    dedupeDays: 14,
    pool,
  });
}

/**
 * Monthly home-value digest → value_update notification.
 * mid/delta come from computeOurEstimate / last_digest_value only.
 */
export async function notifyValueUpdate({
  userId,
  address,
  mid,
  delta = null,
  pool = null,
} = {}) {
  if (!userId) return null;
  const addr = address || 'your home';
  const midLabel = fmtPrice(mid);
  const title = midLabel
    ? `Home value update: ${midLabel}`
    : 'Your monthly home value update is ready';
  let body = `Estimated value for ${addr}`;
  if (delta != null && Number(delta) !== 0 && midLabel) {
    const d = Number(delta);
    const dir = d > 0 ? 'up' : 'down';
    body = `${addr}: ${midLabel} (${dir} ${fmtPrice(Math.abs(d))} vs last month)`;
  } else if (midLabel) {
    body = `${addr}: estimated ${midLabel}`;
  }
  return createNotification({
    userId,
    type: 'value_update',
    title,
    body,
    link: '/my-home/',
    imageUrl: null,
    dedupeDays: 20,
    pool,
  });
}

/**
 * Saved home went sold/withdrawn/expired → off_market.
 */
export async function notifyOffMarket({ userId, listing, pool = null } = {}) {
  if (!userId || !listing) return null;
  const addr = formatAddress(listing) || listing.property_address || 'A saved home';
  const status = String(listing.status || 'off market').toLowerCase();
  const statusLabel =
    status === 'sold' || status === 'closed'
      ? 'sold'
      : status === 'withdrawn'
        ? 'withdrawn'
        : status === 'expired'
          ? 'expired'
          : 'no longer on the market';
  return createNotification({
    userId,
    type: 'off_market',
    title: `Off market: ${addr}`,
    body: `This home is ${statusLabel}.`,
    link: listing?.slug ? `/homes-for-sale/${listing.slug}/` : '/my-saved-searches/?tab=homes',
    imageUrl: photoProxy(listing) || listing.photo_url || null,
    pool,
  });
}

const OFF_MARKET_STATUSES = new Set([
  'sold',
  'withdrawn',
  'expired',
  'canceled',
  'cancelled',
  'closed',
]);

/**
 * Scan saved homes for price drops and off-market status changes.
 * Updates denormalized list_price on saved_homes when price changes.
 * Idempotent enough for hourly digest: only fires when price decreases or
 * listing becomes off-market relative to the last stored snapshot price/status.
 *
 * @returns {{ priceDrops: number, offMarket: number }}
 */
export async function scanSavedHomesForNotifications({ pool = null } = {}) {
  const db = pool || getPool();
  const result = { priceDrops: 0, offMarket: 0 };
  try {
    const r = await db.query(`
      SELECT sh.id AS saved_id, sh.user_id, sh.listing_key, sh.list_price AS saved_price,
             sh.property_address, sh.photo_url, sh.slug AS saved_slug,
             l.id AS listing_db_id, l.listing_id, l.slug, l.list_price, l.status, l.is_active,
             l.street_number, l.street_name, l.unit, l.city, l.state
      FROM saved_homes sh
      LEFT JOIN listings l ON l.listing_id = sh.listing_key
      ORDER BY sh.id
      LIMIT 2000
    `);

    for (const row of r.rows) {
      if (!row.listing_db_id) continue;

      const listing = {
        id: row.listing_db_id,
        listing_id: row.listing_id,
        slug: row.slug || row.saved_slug,
        list_price: row.list_price,
        status: row.status,
        is_active: row.is_active,
        street_number: row.street_number,
        street_name: row.street_name,
        unit: row.unit,
        city: row.city,
        state: row.state,
        property_address: row.property_address,
        photo_url: row.photo_url,
      };

      const status = String(row.status || '').toLowerCase();
      const offMarket =
        row.is_active === false || OFF_MARKET_STATUSES.has(status);

      if (offMarket) {
        // Only notify once: when saved_price is still set (we null it after notify)
        // OR when we still have a positive saved_price as "was on market" marker.
        // Simpler: check for a recent off_market notification for this user+link.
        const recent = await db.query(
          `SELECT id FROM notifications
           WHERE user_id = $1 AND type = 'off_market'
             AND link = $2
             AND created_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [row.user_id, listingLink(listing)]
        );
        if (!recent.rows.length) {
          const n = await notifyOffMarket({ userId: row.user_id, listing, pool: db });
          if (n?.id) result.offMarket += 1;
        }
        continue;
      }

      const current = row.list_price != null ? Math.round(Number(row.list_price)) : null;
      const saved = row.saved_price != null ? Math.round(Number(row.saved_price)) : null;

      if (current != null && saved != null && current < saved) {
        const n = await notifyPriceDrop({
          userId: row.user_id,
          listing,
          oldPrice: saved,
          pool: db,
        });
        if (n?.id) result.priceDrops += 1;
        await db.query(`UPDATE saved_homes SET list_price = $1 WHERE id = $2`, [
          current,
          row.saved_id,
        ]);
      } else if (current != null && saved !== current) {
        // Keep denormalized price in sync without notifying on increases
        await db.query(`UPDATE saved_homes SET list_price = $1 WHERE id = $2`, [
          current,
          row.saved_id,
        ]);
      }
    }
  } catch (e) {
    logger.warn('notificationService.scanSavedHomesForNotifications failed', {
      message: e.message,
    });
  }
  return result;
}
