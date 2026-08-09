/**
 * Notification cadence preferences (It 18 / Phase D).
 *
 * Real table: notification_prefs (user_id, type, frequency).
 * Missing row = explicit code default — never pretend a default is a saved choice.
 *
 * Pref types (UI rows):
 *   listing_alert    — saved-search email digests (per-search frequency remains master)
 *   search_activity  — in-app new matches / price drops / off-market
 *   value_update     — monthly home-value digest
 *
 * Agent messages (showing_confirm, shared_home) are always immediate — no pref row.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';

export const PREF_TYPES = ['listing_alert', 'search_activity', 'value_update'];

/** Allowed frequency values stored in notification_prefs.frequency */
export const FREQUENCIES = ['immediate', 'daily', 'weekly', 'monthly', 'off'];

/**
 * Defaults when no row exists. Honest and explicit in every reader.
 * listing_alert → daily (matches typical saved-search default)
 * search_activity → immediate (in-app surfaces as soon as events fire)
 * value_update → monthly (home-value digest cron is monthly)
 */
export const DEFAULT_FREQUENCY = {
  listing_alert: 'daily',
  search_activity: 'immediate',
  value_update: 'monthly',
};

/**
 * Map an in-app notification `type` to a preference type.
 * Returns null for always-immediate agent types (not user-configurable).
 */
export function prefTypeForNotification(notifType) {
  const t = String(notifType || '').slice(0, 32);
  if (t === 'value_update') return 'value_update';
  if (t === 'showing_confirm' || t === 'shared_home') return null;
  if (t === 'new_match' || t === 'price_drop' || t === 'off_market') return 'search_activity';
  // Unknown nurture types fall under search activity
  if (t) return 'search_activity';
  return null;
}

export function isValidPrefType(type) {
  return PREF_TYPES.includes(String(type || ''));
}

export function isValidFrequency(freq) {
  return FREQUENCIES.includes(String(freq || ''));
}

/**
 * Resolve frequency for a user+pref type.
 * @returns {Promise<string>} one of FREQUENCIES
 */
export async function getPrefFrequency(userId, prefType, pool = null) {
  if (!userId || !isValidPrefType(prefType)) {
    return DEFAULT_FREQUENCY[prefType] || 'immediate';
  }
  const db = pool || getPool();
  try {
    const r = await db.query(
      `SELECT frequency FROM notification_prefs
       WHERE user_id = $1 AND type = $2
       LIMIT 1`,
      [Number(userId), String(prefType)]
    );
    const freq = r.rows[0]?.frequency;
    if (freq && isValidFrequency(freq)) return freq;
  } catch (e) {
    // Table may not exist mid-migrate — fall through to default
    logger.warn('notificationPrefs.getPrefFrequency failed', { message: e.message });
  }
  return DEFAULT_FREQUENCY[prefType] || 'immediate';
}

/**
 * Batch-load prefs for a user. Returns map type → frequency (defaults filled).
 * Each entry includes `is_default: true` when no saved row exists.
 */
export async function getUserPrefs(userId, pool = null) {
  const db = pool || getPool();
  const byType = {};
  for (const t of PREF_TYPES) {
    byType[t] = {
      type: t,
      frequency: DEFAULT_FREQUENCY[t],
      is_default: true,
      updated_at: null,
    };
  }
  if (!userId) return Object.values(byType);

  try {
    const r = await db.query(
      `SELECT type, frequency, updated_at
       FROM notification_prefs
       WHERE user_id = $1`,
      [Number(userId)]
    );
    for (const row of r.rows) {
      if (!isValidPrefType(row.type)) continue;
      const freq = isValidFrequency(row.frequency)
        ? row.frequency
        : DEFAULT_FREQUENCY[row.type];
      byType[row.type] = {
        type: row.type,
        frequency: freq,
        is_default: false,
        updated_at: row.updated_at || null,
      };
    }
  } catch (e) {
    logger.warn('notificationPrefs.getUserPrefs failed', { message: e.message });
  }
  return Object.values(byType);
}

/**
 * Upsert preference rows. Validates types + frequencies.
 * @param {number} userId
 * @param {{ type: string, frequency: string }[]} prefs
 * @returns {{ ok: true, prefs } | { ok: false, error: string }}
 */
export async function upsertUserPrefs(userId, prefs, pool = null) {
  if (!userId) return { ok: false, error: 'User required.' };
  if (!Array.isArray(prefs) || prefs.length === 0) {
    return { ok: false, error: 'prefs must be a non-empty array.' };
  }
  if (prefs.length > 20) {
    return { ok: false, error: 'Too many pref rows.' };
  }

  const db = pool || getPool();
  const cleaned = [];
  for (const p of prefs) {
    const type = String(p?.type || '').slice(0, 32);
    const frequency = String(p?.frequency || '').slice(0, 16);
    if (!isValidPrefType(type)) {
      return { ok: false, error: `Invalid notification type: ${type}` };
    }
    if (!isValidFrequency(frequency)) {
      return {
        ok: false,
        error: `Invalid frequency for ${type}: ${frequency}. Use immediate, daily, weekly, monthly, or off.`,
      };
    }
    cleaned.push({ type, frequency });
  }

  try {
    for (const { type, frequency } of cleaned) {
      await db.query(
        `INSERT INTO notification_prefs (user_id, type, frequency, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, type)
         DO UPDATE SET frequency = EXCLUDED.frequency, updated_at = NOW()`,
        [Number(userId), type, frequency]
      );
    }
    const saved = await getUserPrefs(userId, db);
    return { ok: true, prefs: saved };
  } catch (e) {
    logger.warn('notificationPrefs.upsertUserPrefs failed', { message: e.message });
    return { ok: false, error: 'Could not save preferences.' };
  }
}

/**
 * Next due_at for a queued email based on frequency (Mountain Time windows).
 * daily → next 06:00 MT (or tomorrow if past)
 * weekly → next Monday 06:00 MT
 * monthly → 1st of next month 06:00 MT
 * immediate → null (send ASAP)
 */
export function nextDueAt(frequency) {
  const freq = String(frequency || 'immediate');
  if (freq === 'immediate' || freq === 'off') return null;

  // Compute in America/Denver roughly via UTC offset is fragile; use local
  // Date math with a fixed 6am window stamp and advance by calendar days.
  const now = new Date();
  const due = new Date(now);

  if (freq === 'daily') {
    // Due at next 12:00 UTC (~6am MT during MDT) — simple fixed window
    due.setUTCHours(12, 0, 0, 0);
    if (due <= now) due.setUTCDate(due.getUTCDate() + 1);
    return due;
  }

  if (freq === 'weekly') {
    due.setUTCHours(12, 0, 0, 0);
    // Advance to next Monday (UTC weekday 1)
    const day = due.getUTCDay();
    let add = (1 - day + 7) % 7;
    if (add === 0 && due <= now) add = 7;
    due.setUTCDate(due.getUTCDate() + add);
    if (due <= now) due.setUTCDate(due.getUTCDate() + 7);
    return due;
  }

  if (freq === 'monthly') {
    due.setUTCHours(12, 0, 0, 0);
    due.setUTCDate(1);
    due.setUTCMonth(due.getUTCMonth() + 1);
    return due;
  }

  return null;
}
