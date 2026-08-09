/**
 * Notification center API (It 14.1 + It 18 cadence prefs):
 *   GET    /api/notifications              — list (newest first) + unread_count
 *   POST   /api/notifications/:id/read     — mark one read
 *   POST   /api/notifications/read-all     — mark all read
 *   DELETE /api/notifications/:id          — soft-dismiss (dismissed_at)
 *   GET    /api/notifications/prefs        — cadence preferences
 *   PUT    /api/notifications/prefs        — upsert cadence preferences
 *
 * Auth: same cookie / manage_token pattern as savedHomesController.
 * Pref changes are NOT engagement signals (no lead-score / FUB writes).
 */
import getPool from '../config/database.js';
import { getUserPrefs, upsertUserPrefs } from '../services/notificationPrefs.js';

const COOKIE_NAME = 'saa_user_token';
const PAGE_SIZE = 20;

async function findUserByToken(token) {
  if (!token || token.length < 16 || token.length > 80) return null;
  const r = await getPool().query(
    "SELECT * FROM users WHERE manage_token = $1 AND status = 'active'",
    [String(token)]
  );
  return r.rows[0] || null;
}

async function resolveUser(req) {
  const qToken = req.query?.token;
  if (qToken) {
    const u = await findUserByToken(qToken);
    if (u) return u;
  }
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) return findUserByToken(cookieToken);
  const bodyToken = req.body?.token;
  if (bodyToken) return findUserByToken(bodyToken);
  return null;
}

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || null,
    link: row.link || null,
    image_url: row.image_url || null,
    read_at: row.read_at || null,
    dismissed_at: row.dismissed_at || null,
    created_at: row.created_at,
    unread: !row.read_at,
  };
}

/**
 * GET /api/notifications?page=1&filter=all|unread|price_drop|new_match|value_update|off_market
 */
export async function listNotifications(req, res) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in to view notifications.' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = String(req.query.filter || 'all').toLowerCase();
    const offset = (page - 1) * PAGE_SIZE;
    const pool = getPool();

    const params = [user.id];
    const where = ['user_id = $1', 'dismissed_at IS NULL'];

    if (filter === 'unread') {
      where.push('read_at IS NULL');
    } else if (['new_match', 'price_drop', 'value_update', 'off_market', 'showing_confirm'].includes(filter)) {
      params.push(filter);
      where.push(`type = $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const [listRes, unreadRes, totalRes] = await Promise.all([
      pool.query(
        `SELECT id, type, title, body, link, image_url, read_at, dismissed_at, created_at
         FROM notifications
         WHERE ${whereSql}
         ORDER BY created_at DESC
         LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM notifications
         WHERE user_id = $1 AND dismissed_at IS NULL AND read_at IS NULL`,
        [user.id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM notifications WHERE ${whereSql}`,
        params
      ),
    ]);

    return res.json({
      success: true,
      data: {
        notifications: listRes.rows.map(serialize),
        unread_count: unreadRes.rows[0]?.c ?? 0,
        total: totalRes.rows[0]?.c ?? 0,
        page,
        page_size: PAGE_SIZE,
        has_more: offset + listRes.rows.length < (totalRes.rows[0]?.c ?? 0),
      },
    });
  } catch (e) {
    console.error('listNotifications:', e.message);
    return res.status(500).json({ success: false, error: 'Could not load notifications.' });
  }
}

/**
 * POST /api/notifications/:id/read
 */
export async function markNotificationRead(req, res) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in required.' });
    }
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: 'Invalid notification id.' });
    }

    const r = await getPool().query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL
       RETURNING id, type, title, body, link, image_url, read_at, dismissed_at, created_at`,
      [id, user.id]
    );
    if (!r.rows.length) {
      return res.status(404).json({ success: false, error: 'Notification not found.' });
    }
    return res.json({ success: true, data: serialize(r.rows[0]) });
  } catch (e) {
    console.error('markNotificationRead:', e.message);
    return res.status(500).json({ success: false, error: 'Could not mark notification read.' });
  }
}

/**
 * POST /api/notifications/read-all
 */
export async function markAllNotificationsRead(req, res) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in required.' });
    }

    const r = await getPool().query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND dismissed_at IS NULL AND read_at IS NULL
       RETURNING id`,
      [user.id]
    );
    return res.json({
      success: true,
      data: { marked: r.rowCount || 0, unread_count: 0 },
    });
  } catch (e) {
    console.error('markAllNotificationsRead:', e.message);
    return res.status(500).json({ success: false, error: 'Could not mark all read.' });
  }
}

/**
 * DELETE /api/notifications/:id — soft dismiss
 */
export async function dismissNotification(req, res) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in required.' });
    }
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, error: 'Invalid notification id.' });
    }

    const r = await getPool().query(
      `UPDATE notifications
       SET dismissed_at = NOW(), read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL
       RETURNING id`,
      [id, user.id]
    );
    if (!r.rows.length) {
      return res.status(404).json({ success: false, error: 'Notification not found.' });
    }
    return res.json({ success: true, data: { id, dismissed: true } });
  } catch (e) {
    console.error('dismissNotification:', e.message);
    return res.status(500).json({ success: false, error: 'Could not dismiss notification.' });
  }
}

/**
 * POST /api/notifications/dismiss-all — soft dismiss all active
 */
export async function dismissAllNotifications(req, res) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in required.' });
    }

    const r = await getPool().query(
      `UPDATE notifications
       SET dismissed_at = NOW(), read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1 AND dismissed_at IS NULL
       RETURNING id`,
      [user.id]
    );
    return res.json({
      success: true,
      data: { dismissed: r.rowCount || 0, unread_count: 0 },
    });
  } catch (e) {
    console.error('dismissAllNotifications:', e.message);
    return res.status(500).json({ success: false, error: 'Could not dismiss all.' });
  }
}

/**
 * GET /api/notifications/prefs
 * Returns all pref types with frequency. is_default: true when no saved row
 * (defaults apply; never pretends a default is a user-saved choice).
 */
export async function getNotificationPrefs(req, res) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in to view notification preferences.' });
    }
    const prefs = await getUserPrefs(user.id);
    return res.json({
      success: true,
      data: {
        prefs,
        note: 'These controls apply to email and in-app notifications. Missing rows use code defaults.',
      },
    });
  } catch (e) {
    console.error('getNotificationPrefs:', e.message);
    return res.status(500).json({ success: false, error: 'Could not load preferences.' });
  }
}

/**
 * PUT /api/notifications/prefs
 * Body: { prefs: [{ type, frequency }] }
 * Upserts each valid row; 400 on unknown type or frequency.
 */
export async function putNotificationPrefs(req, res) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in required.' });
    }
    const prefs = req.body?.prefs;
    const result = await upsertUserPrefs(user.id, prefs);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      data: { prefs: result.prefs },
    });
  } catch (e) {
    console.error('putNotificationPrefs:', e.message);
    return res.status(500).json({ success: false, error: 'Could not save preferences.' });
  }
}
