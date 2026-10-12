/**
 * Love / Maybe / Not for me, private notes, and "why this home":
 *   GET /api/reactions                 — every reaction, newest first (hidden homes list)
 *   GET /api/reactions?listing_keys=   — batch state for result cards
 *   GET /api/reactions/:listing_key    — one home: reaction, note, saved, match reasons
 *   PUT /api/reactions/:listing_key    — { reaction: love|maybe|pass|null, note? }
 *   GET /api/taste                     — what we've learned, in plain terms
 *
 * Love and Maybe keep the home on the saved list; Not for me takes it off and
 * hides it from results and alerts. Clearing a Love or Maybe unsaves it.
 */
import getPool from '../config/database.js';
import { recordEvent as recordStreamEvent } from '../services/events.js';
import {
  REACTIONS,
  describeProfile,
  getTasteProfile,
  invalidateTaste,
  scoreListing,
} from '../services/tasteProfile.js';
import { findListing, resolveUser, saveHomeForUser } from './savedHomesController.js';

const MAX_NOTE = 1000;

const unauthorized = (res) => res.status(401).json({ success: false, error: 'Sign in to react to homes.' });

async function homeFacts(pool, listingKey) {
  const { rows } = await pool.query(
    `SELECT listing_id, list_price, beds, living_area, city, home_type, year_built, garage_spaces, lot_size_acres
     FROM listings WHERE listing_id = $1`,
    [listingKey]
  );
  return rows[0] || null;
}

/** GET /api/reactions[?listing_keys=a,b] */
export const listReactions = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const pool = getPool();
    const raw = String(req.query.listing_keys || '').trim();
    if (raw) {
      const keys = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
      const { rows } = await pool.query(
        `SELECT listing_key, reaction, note FROM home_reactions
         WHERE user_id = $1 AND listing_key = ANY($2::text[])`,
        [user.id, keys]
      );
      const map = {};
      for (const r of rows) map[r.listing_key] = { reaction: r.reaction, note: r.note };
      return res.json({ success: true, data: { reactions: map } });
    }
    const { rows } = await pool.query(
      `SELECT r.listing_key, r.reaction, r.note, r.updated_at, l.slug, l.list_price, l.city,
              l.street_number, l.street_name, l.unit, l.id AS listing_db_id
       FROM home_reactions r LEFT JOIN listings l ON l.listing_id = r.listing_key
       WHERE r.user_id = $1 AND (r.reaction IS NOT NULL OR r.note IS NOT NULL)
       ORDER BY r.updated_at DESC LIMIT 500`,
      [user.id]
    );
    const homes = rows.map((r) => ({
      listing_key: r.listing_key,
      reaction: r.reaction,
      note: r.note,
      updated_at: r.updated_at,
      slug: r.slug,
      list_price: r.list_price != null ? Number(r.list_price) : null,
      address: [[r.street_number, r.street_name, r.unit ? `#${r.unit}` : null].filter(Boolean).join(' '), r.city]
        .filter(Boolean).join(', ') || null,
      photo_url: r.listing_db_id ? `/api/photo/${r.listing_db_id}/0` : null,
    }));
    return res.json({ success: true, data: { homes } });
  } catch (error) {
    console.error('listReactions error:', error);
    return res.status(500).json({ success: false, error: 'Could not load your reactions.' });
  }
};

/** GET /api/reactions/:listing_key — everything the detail page needs about "you and this home". */
export const getReaction = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const pool = getPool();
    const listing = await findListing(pool, decodeURIComponent(String(req.params.listing_key || '')));
    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found.' });
    const key = String(listing.listing_id);
    const [reaction, saved, profile, facts] = await Promise.all([
      pool.query('SELECT reaction, note FROM home_reactions WHERE user_id = $1 AND listing_key = $2', [user.id, key]),
      pool.query('SELECT 1 FROM saved_homes WHERE user_id = $1 AND listing_key = $2', [user.id, key]),
      getTasteProfile(user.id, pool),
      homeFacts(pool, key),
    ]);
    res.set('Cache-Control', 'private, no-store');
    return res.json({
      success: true,
      data: {
        listing_key: key,
        reaction: reaction.rows[0]?.reaction || null,
        note: reaction.rows[0]?.note || null,
        saved: saved.rows.length > 0,
        taste_ready: Boolean(profile?.ready),
        match: scoreListing(facts, profile),
      },
    });
  } catch (error) {
    console.error('getReaction error:', error);
    return res.status(500).json({ success: false, error: 'Could not load this home.' });
  }
};

/** PUT /api/reactions/:listing_key — { reaction, note } */
export const setReaction = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);

    const body = req.body || {};
    const reaction = body.reaction == null || body.reaction === '' ? null : String(body.reaction);
    if (reaction && !REACTIONS.includes(reaction)) {
      return res.status(400).json({ success: false, error: 'Reaction must be love, maybe or pass.' });
    }
    const hasNote = Object.prototype.hasOwnProperty.call(body, 'note');
    if (hasNote && body.note != null && typeof body.note !== 'string') {
      return res.status(400).json({ success: false, error: 'Note must be text.' });
    }
    const note = hasNote ? (String(body.note || '').trim().slice(0, MAX_NOTE) || null) : undefined;

    const pool = getPool();
    const listing = await findListing(pool, decodeURIComponent(String(req.params.listing_key || '')));
    if (!listing) return res.status(404).json({ success: false, error: 'That listing is no longer available.' });
    const key = String(listing.listing_id);

    const prior = await pool.query(
      'SELECT reaction, note FROM home_reactions WHERE user_id = $1 AND listing_key = $2',
      [user.id, key]
    );
    const before = prior.rows[0] || null;
    const nextNote = note === undefined ? before?.note ?? null : note;

    if (!reaction && !nextNote) {
      await pool.query('DELETE FROM home_reactions WHERE user_id = $1 AND listing_key = $2', [user.id, key]);
    } else {
      await pool.query(
        `INSERT INTO home_reactions (user_id, listing_key, reaction, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, listing_key) DO UPDATE SET
           reaction = EXCLUDED.reaction, note = EXCLUDED.note, updated_at = NOW()`,
        [user.id, key, reaction, nextNote]
      );
    }

    // Keep the saved list in step with the reaction.
    let saved;
    if (reaction === 'love' || reaction === 'maybe') {
      await saveHomeForUser(user, listing, pool, { via: reaction });
      saved = true;
    } else if (reaction === 'pass' || (!reaction && ['love', 'maybe'].includes(before?.reaction))) {
      await pool.query('DELETE FROM saved_homes WHERE user_id = $1 AND listing_key = $2', [user.id, key]);
      saved = false;
    } else {
      saved = (await pool.query('SELECT 1 FROM saved_homes WHERE user_id = $1 AND listing_key = $2', [user.id, key]))
        .rows.length > 0;
    }

    if (reaction !== (before?.reaction || null)) {
      recordStreamEvent({
        type: 'home_reaction',
        userId: user.id,
        listingId: key,
        meta: { reaction, previous: before?.reaction || null, has_note: Boolean(nextNote) },
      });
    }
    invalidateTaste(user.id);

    return res.json({ success: true, data: { listing_key: key, reaction, note: nextNote, saved } });
  } catch (error) {
    console.error('setReaction error:', error);
    return res.status(500).json({ success: false, error: 'Could not save your reaction.' });
  }
};

/** GET /api/taste — the buyer's profile, for "what we've learned about you". */
export const getTaste = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const profile = await getTasteProfile(user.id, getPool(), { fresh: true });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: describeProfile(profile) });
  } catch (error) {
    console.error('getTaste error:', error);
    return res.status(500).json({ success: false, error: 'Could not load your profile.' });
  }
};
