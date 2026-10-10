/**
 * One event stream for every contact and visitor.
 *
 * Search, Nadia and (later) the CRM all read the same `events` table, so any
 * feature that learns something about a person writes it here through
 * recordEvent(). Anonymous visitors are tracked by a first-party visitor id
 * (cookie saa_vid) and stitched to the contact when they sign up, so a lead's
 * history includes what they looked at before they gave us their email.
 *
 * recordEvent never throws: tracking must not break the request that calls it.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';

export const DEFAULT_TENANT_ID = 1;
export const VISITOR_COOKIE = 'saa_vid';
const VISITOR_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

/** Every event type the platform records. Unknown types are rejected. */
export const EVENT_TYPES = new Set([
  'page_view',
  'search',
  'listing_view',
  'search_saved',
  'home_saved',
  'home_unsaved',
  'showing_request',
  'form_submit',
  'home_value_view',
  'chat_opened',
  'signup',
  'sign_in',
  'alert_sent',
  'alert_open',
  'alert_click',
  'consent_changed',
]);

/** Types a browser may send on its own (everything else is recorded server-side). */
export const PUBLIC_EVENT_TYPES = new Set(['page_view', 'search']);

const VISITOR_RE = /^[a-f0-9]{32}$/;

export function isValidVisitorId(v) {
  return typeof v === 'string' && VISITOR_RE.test(v);
}

/**
 * Read the visitor id from the request, minting and setting one if missing.
 * Only tracking endpoints call this, so cacheable responses (photos, listing
 * search) never carry a Set-Cookie header.
 */
export function ensureVisitorId(req, res) {
  const existing = req.cookies?.[VISITOR_COOKIE];
  if (isValidVisitorId(existing)) return existing;
  const id = crypto.randomBytes(16).toString('hex');
  if (res && !res.headersSent) {
    res.cookie(VISITOR_COOKIE, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: VISITOR_MAX_AGE,
      path: '/',
    });
  }
  if (req.cookies) req.cookies[VISITOR_COOKIE] = id;
  return id;
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const json = JSON.stringify(meta);
  if (json.length > 4000) return { truncated: true };
  return meta;
}

/**
 * Record one event. Needs a userId or a visitorId.
 * @returns {Promise<object|null>} the stored row, or null when skipped/failed
 */
export async function recordEvent({
  type,
  userId = null,
  visitorId = null,
  listingId = null,
  searchId = null,
  source = 'web',
  meta = null,
  tenantId = DEFAULT_TENANT_ID,
  occurredAt = null,
  dedupeMinutes = 0,
} = {}, pool = getPool()) {
  try {
    if (!EVENT_TYPES.has(type)) return null;
    const vid = isValidVisitorId(visitorId) ? visitorId : null;
    const uid = Number.isInteger(Number(userId)) && Number(userId) > 0 ? Number(userId) : null;
    if (!uid && !vid) return null;
    const metaJson = JSON.stringify(cleanMeta(meta));

    if (dedupeMinutes > 0) {
      const dup = await pool.query(
        `SELECT id FROM events
          WHERE type = $1
            AND ${uid ? 'user_id = $2' : 'visitor_id = $2'}
            AND COALESCE(listing_id, '') = COALESCE($3, '')
            AND meta = $4::jsonb
            AND occurred_at > NOW() - make_interval(mins => $5)
          LIMIT 1`,
        [type, uid || vid, listingId ? String(listingId) : null, metaJson, dedupeMinutes]
      );
      if (dup.rows.length) return null;
    }

    const { rows } = await pool.query(
      `INSERT INTO events (tenant_id, user_id, visitor_id, type, listing_id, search_id, source, meta, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, COALESCE($9, NOW()))
       RETURNING *`,
      [
        tenantId,
        uid,
        vid,
        type,
        listingId ? String(listingId).slice(0, 64) : null,
        searchId || null,
        String(source || 'web').slice(0, 32),
        metaJson,
        occurredAt,
      ]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('recordEvent failed:', type, err.message);
    return null;
  }
}

/**
 * Attach a visitor's anonymous history to a contact. Safe to call often:
 * only rows without a user are touched.
 * @returns {Promise<number>} rows stitched
 */
export async function stitchVisitor(visitorId, userId, pool = getPool()) {
  try {
    if (!isValidVisitorId(visitorId) || !userId) return 0;
    const r = await pool.query(
      'UPDATE events SET user_id = $2 WHERE visitor_id = $1 AND user_id IS NULL',
      [visitorId, userId]
    );
    return r.rowCount || 0;
  } catch (err) {
    console.error('stitchVisitor failed:', err.message);
    return 0;
  }
}

/** Stitch the current request's visitor id to a contact who just identified. */
export function stitchRequestVisitor(req, userId, pool = getPool()) {
  return stitchVisitor(req?.cookies?.[VISITOR_COOKIE], userId, pool);
}

/** A contact's history, newest first. */
export async function getTimeline(userId, { limit = 50, before = null } = {}, pool = getPool()) {
  const { rows } = await pool.query(
    `SELECT id, type, listing_id, search_id, source, meta, occurred_at
       FROM events
      WHERE user_id = $1 AND ($2::timestamptz IS NULL OR occurred_at < $2)
      ORDER BY occurred_at DESC, id DESC
      LIMIT $3`,
    [userId, before, Math.min(Math.max(1, limit), 200)]
  );
  return rows;
}

/**
 * Call when a request proves who it is (signup, password login, own session).
 * Stitches the browser's anonymous history to the contact and records the
 * signup or sign-in. Never call it for a request that only typed an email.
 */
export async function onIdentified(req, userId, { isNew = false, via = 'unknown' } = {}, pool = getPool()) {
  if (!userId) return;
  const visitorId = req?.cookies?.[VISITOR_COOKIE];
  const stitched = await stitchVisitor(visitorId, userId, pool);
  if (stitched > 0) {
    // Give the signup's own FUB event a head start so FUB has the person
    // before the history arrives.
    const delay = Number(process.env.FUB_HISTORY_DELAY_MS ?? 15000);
    setTimeout(() => {
      import('./followUpBossService.js')
        .then(({ syncVisitorHistoryToFollowUpBoss }) => syncVisitorHistoryToFollowUpBoss(userId))
        .catch((e) => console.error('FUB history sync failed:', e.message));
    }, delay).unref?.();
  }
  await recordEvent({
    type: isNew ? 'signup' : 'sign_in',
    userId,
    visitorId,
    meta: { via },
  }, pool);
}

/** The signed-in contact's id from the session cookie, or null. */
export async function sessionUserId(req, pool = getPool()) {
  try {
    const token = req?.cookies?.saa_user_token;
    if (!token) return null;
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE manage_token = $1 AND status = 'active' LIMIT 1",
      [token]
    );
    return rows[0]?.id || null;
  } catch {
    return null;
  }
}
