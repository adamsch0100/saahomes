/**
 * Web push for the installable app: instant alerts on the client's phone.
 *
 *   - VAPID keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or are
 *     generated once and kept in app_settings, so push works with no setup.
 *   - Subscriptions belong to a signed-in client; only real push services
 *     are accepted as endpoints (the server POSTs to them).
 *   - runPushPass() turns fresh listings into new-match notifications for
 *     clients who turned push on, then delivers pending notifications: one
 *     bundled push per person per pass, nothing overnight (9pm–8am Mountain),
 *     at most DAILY_PUSH_CAP pushes in any 24 hours. Everything still lands in the
 *     in-app notification center and the email digest.
 */
import webpush from 'web-push';
import getPool from '../config/database.js';
import { marketPack } from '../config/marketPack.js';
import { buildSavedSearchWhere } from './listingFilters.js';
import { notifyNewMatches, scanSavedHomesForNotifications } from './notificationService.js';
import { getPrefFrequency } from './notificationPrefs.js';
import { recordConsent } from './consent.js';

const SITE = marketPack.market.siteUrl || 'https://saahomes.com';
const MT_TZ = 'America/Denver';
export const QUIET_START_HOUR = 21; // 9pm Mountain
export const QUIET_END_HOUR = 8; // 8am Mountain
export const DAILY_PUSH_CAP = 4;
const PUSH_TYPES = ['new_match', 'price_drop', 'off_market', 'showing_confirm', 'shared_home'];
const NEW_LISTING_DAYS = 7;

export const PUSH_CONSENT_WORDING =
  'Send instant alerts to this device when new homes match my searches or saved homes change price.';

/** Hosts of the browser push services (Chrome/Android, Firefox, Safari/iOS, Edge). */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isPushEndpoint(endpoint) {
  try {
    const u = new URL(String(endpoint));
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname)) && u.href.length <= 1000;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------ VAPID keys
let vapid = null;
export async function getVapidKeys(pool = getPool()) {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return vapid;
  }
  const fresh = webpush.generateVAPIDKeys();
  // First writer wins, so every instance ends up with the same pair.
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('vapid_keys', $1) ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(fresh)]
  );
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'vapid_keys'`);
  vapid = { publicKey: rows[0].value.publicKey, privateKey: rows[0].value.privateKey };
  return vapid;
}

function vapidSubject() {
  return process.env.VAPID_SUBJECT || SITE;
}

/** Real delivery. Tests pass their own `send`. */
export async function deliverPush(subscription, payload) {
  const keys = await getVapidKeys();
  return webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    JSON.stringify(payload),
    {
      TTL: 6 * 3600,
      urgency: 'normal',
      vapidDetails: { subject: vapidSubject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
    }
  );
}

// ------------------------------------------------------------ subscriptions
export async function saveSubscription({ userId, subscription, req, pool = getPool() }) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!isPushEndpoint(endpoint) || !p256dh || !auth || String(p256dh).length > 200 || String(auth).length > 100) {
    return { ok: false, error: 'invalid_subscription' };
  }
  const ua = String(req?.headers?.['user-agent'] || '').slice(0, 500) || null;
  // A device moves to whoever signed in on it last.
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent, disabled_at = NULL, last_error = NULL,
       created_at = CASE WHEN push_subscriptions.user_id = EXCLUDED.user_id
                         THEN push_subscriptions.created_at ELSE NOW() END`,
    [userId, endpoint, p256dh, auth, ua]
  );
  await recordConsent({ userId, channel: 'push', granted: true, wording: PUSH_CONSENT_WORDING, source: 'push_opt_in', req })
    .catch((e) => console.error('push consent record failed:', e.message));
  return { ok: true };
}

export async function removeSubscription({ userId, endpoint, req, pool = getPool() }) {
  await pool.query(
    'UPDATE push_subscriptions SET disabled_at = NOW() WHERE user_id = $1 AND endpoint = $2 AND disabled_at IS NULL',
    [userId, String(endpoint || '')]
  );
  const left = await pool.query(
    'SELECT 1 FROM push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL LIMIT 1', [userId]
  );
  if (!left.rows.length) {
    await recordConsent({ userId, channel: 'push', granted: false, wording: 'Turned off instant alerts.', source: 'push_opt_out', req })
      .catch((e) => console.error('push consent record failed:', e.message));
  }
  return { ok: true };
}

export async function activeDeviceCount(userId, pool = getPool()) {
  const r = await pool.query(
    'SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL', [userId]
  );
  return r.rows[0].n;
}

// ------------------------------------------------------------ the pass
function mtParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MT_TZ, hour: '2-digit', hour12: false,
  }).formatToParts(date);
  return { hour: Number(parts.find((p) => p.type === 'hour')?.value) % 24 };
}

export function isQuietHour(date = new Date()) {
  const { hour } = mtParts(date);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** Fresh listings for saved searches whose owner has push on → new_match rows. */
async function queueNewMatches(pool) {
  const { rows: searches } = await pool.query(
    `SELECT s.id, s.user_id, s.name, s.filters, s.push_cursor_at
     FROM saved_searches s JOIN users u ON u.id = s.user_id
     WHERE s.is_active = TRUE AND u.status = 'active'
       AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = s.user_id AND p.disabled_at IS NULL)`
  );
  let queued = 0;
  for (const s of searches) {
    const { rows: [{ now }] } = await pool.query('SELECT NOW()::timestamp AS now');
    if (!s.push_cursor_at) {
      // First pass after push was turned on: start watching from now.
      await pool.query('UPDATE saved_searches SET push_cursor_at = $1 WHERE id = $2', [now, s.id]);
      continue;
    }
    if (await getPrefFrequency(s.user_id, 'search_activity', pool) === 'off') {
      await pool.query('UPDATE saved_searches SET push_cursor_at = $1 WHERE id = $2', [now, s.id]);
      continue;
    }
    const { whereSql, params } = buildSavedSearchWhere(s.filters || {});
    const n = params.length;
    const { rows: fresh } = await pool.query(
      `SELECT id, listing_id, slug, street_number, street_name, unit, city, list_price, photos
       FROM listings
       WHERE ${whereSql} AND created_at > $${n + 1} AND created_at <= $${n + 2}
         AND (days_on_market IS NULL OR days_on_market <= ${NEW_LISTING_DAYS})
       ORDER BY created_at DESC LIMIT 10`,
      [...params, s.push_cursor_at, now]
    );
    if (fresh.length) {
      queued += await notifyNewMatches({ userId: s.user_id, searchName: s.name, listings: fresh, pool });
    }
    await pool.query('UPDATE saved_searches SET push_cursor_at = $1 WHERE id = $2', [now, s.id]);
  }
  return queued;
}

function absolute(url) {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function withSource(url) {
  const abs = absolute(url || '/notifications/');
  return `${abs}${abs.includes('?') ? '&' : '?'}src=push`;
}

/** One push for everything pending for a person. */
export function bundlePayload(items) {
  if (items.length === 1) {
    const n = items[0];
    return {
      title: n.title,
      body: n.body || '',
      url: withSource(n.link),
      image: absolute(n.image_url),
      tag: `n-${n.id}`,
    };
  }
  const matches = items.filter((n) => n.type === 'new_match').length;
  const drops = items.filter((n) => n.type === 'price_drop').length;
  const bits = [];
  if (matches) bits.push(`${matches} new match${matches === 1 ? '' : 'es'}`);
  if (drops) bits.push(`${drops} price drop${drops === 1 ? '' : 's'}`);
  const other = items.length - matches - drops;
  if (other) bits.push(`${other} more update${other === 1 ? '' : 's'}`);
  return {
    title: bits.join(', ').replace(/^./, (c) => c.toUpperCase()),
    body: items.slice(0, 2).map((n) => n.title).join(' · '),
    url: withSource('/notifications/'),
    image: absolute(items.find((n) => n.image_url)?.image_url),
    tag: 'saa-updates',
  };
}

/**
 * @param {object} opts
 * @param {Date}     [opts.now]  clock, for quiet hours and the daily cap
 * @param {Function} [opts.send] (subscription, payload) => Promise
 * @param {boolean}  [opts.scanSavedHomes] refresh saved-home drops first
 */
export async function runPushPass({ now = new Date(), send = deliverPush, scanSavedHomes = true, pool = getPool() } = {}) {
  const result = { queued: 0, pushed: 0, capped: 0, quiet: false, disabled: 0 };
  if (scanSavedHomes) await scanSavedHomesForNotifications({ pool });
  result.queued = await queueNewMatches(pool);

  if (isQuietHour(now)) {
    result.quiet = true;
    return result;
  }

  const { rows: pending } = await pool.query(
    `SELECT n.id, n.user_id, n.type, n.title, n.body, n.link, n.image_url
     FROM notifications n
     WHERE n.pushed_at IS NULL AND n.type = ANY($1)
       AND n.created_at > NOW() - INTERVAL '24 hours'
       AND n.read_at IS NULL AND n.dismissed_at IS NULL
       AND EXISTS (SELECT 1 FROM push_subscriptions p
                   WHERE p.user_id = n.user_id AND p.disabled_at IS NULL
                     AND p.created_at <= n.created_at + INTERVAL '5 minutes')
     ORDER BY n.user_id, n.created_at`,
    [PUSH_TYPES]
  );
  const byUser = new Map();
  for (const n of pending) {
    if (!byUser.has(n.user_id)) byUser.set(n.user_id, []);
    byUser.get(n.user_id).push(n);
  }

  for (const [userId, items] of byUser) {
    const ids = items.map((n) => n.id);
    const { rows: [{ n: sentToday }] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM push_log
       WHERE user_id = $1 AND delivered > 0 AND sent_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    if (sentToday >= DAILY_PUSH_CAP) {
      await pool.query(`UPDATE notifications SET pushed_at = NOW(), push_status = 'capped' WHERE id = ANY($1)`, [ids]);
      result.capped += items.length;
      continue;
    }

    const payload = bundlePayload(items);
    const { rows: subs } = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL', [userId]
    );
    let delivered = 0;
    for (const sub of subs) {
      try {
        await send(sub, payload);
        delivered += 1;
        await pool.query('UPDATE push_subscriptions SET last_success_at = NOW(), last_error = NULL WHERE id = $1', [sub.id]);
      } catch (e) {
        const gone = e?.statusCode === 404 || e?.statusCode === 410;
        await pool.query(
          `UPDATE push_subscriptions SET last_error = $2, disabled_at = CASE WHEN $3 THEN NOW() ELSE disabled_at END WHERE id = $1`,
          [sub.id, String(e?.statusCode || e?.message || 'error').slice(0, 200), gone]
        );
        if (gone) result.disabled += 1;
      }
    }
    await pool.query(
      `UPDATE notifications SET pushed_at = NOW(), push_status = $2 WHERE id = ANY($1)`,
      [ids, delivered ? 'sent' : 'failed']
    );
    await pool.query(
      'INSERT INTO push_log (user_id, notification_ids, title, delivered) VALUES ($1, $2, $3, $4)',
      [userId, ids, payload.title, delivered]
    );
    if (delivered) {
      result.pushed += 1;
    }
  }
  return result;
}
