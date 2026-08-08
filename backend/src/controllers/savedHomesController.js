/**
 * Account-linked saved homes (hearts):
 *   GET    /api/saved-homes                      — list (newest first, hydrated)
 *   POST   /api/saved-homes                      — save { listing_key }
 *   DELETE /api/saved-homes/:listing_key         — unsave
 *   GET    /api/saved-homes/status?listing_keys= — batch heart state
 *
 * Auth required (session cookie or manage token). 401 when signed out.
 * Off-market listings still return denormalized snapshot + off_market flag.
 */
import getPool from '../config/database.js';
import { setAuthCookie } from './alertController.js';

const COOKIE_NAME = 'saa_user_token';

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

function formatAddress(row) {
  if (!row) return null;
  const street = [row.street_number, row.street_name, row.unit ? `#${row.unit}` : null]
    .filter(Boolean)
    .join(' ');
  const cityLine = [row.city, row.state].filter(Boolean).join(', ');
  if (street && cityLine) return `${street}, ${cityLine}`;
  return street || cityLine || null;
}

/**
 * Resolve a client-supplied key (IRES listing_id, slug, or serial id) to a listing row.
 */
async function findListing(pool, key) {
  const raw = String(key || '').trim();
  if (!raw || raw.length > 255) return null;

  // Prefer IRES listing_id (stable key we store)
  let r = await pool.query(
    `SELECT id, listing_id, slug, status, is_active, list_price, photos,
            street_number, street_name, unit, city, state, postal_code, beds, baths, living_area
     FROM listings WHERE listing_id = $1 LIMIT 1`,
    [raw]
  );
  if (r.rows.length) return r.rows[0];

  // Slug (legacy localStorage hearts stored slugs)
  r = await pool.query(
    `SELECT id, listing_id, slug, status, is_active, list_price, photos,
            street_number, street_name, unit, city, state, postal_code, beds, baths, living_area
     FROM listings WHERE slug = $1 LIMIT 1`,
    [raw]
  );
  if (r.rows.length) return r.rows[0];

  // Serial PK (photo proxy id)
  if (/^\d+$/.test(raw)) {
    r = await pool.query(
      `SELECT id, listing_id, slug, status, is_active, list_price, photos,
              street_number, street_name, unit, city, state, postal_code, beds, baths, living_area
       FROM listings WHERE id = $1 LIMIT 1`,
      [Number(raw)]
    );
    if (r.rows.length) return r.rows[0];
  }
  return null;
}

function isListingOnMarket(listing) {
  if (!listing) return false;
  if (listing.is_active === false) return false;
  const status = String(listing.status || '').toLowerCase();
  // Active / active under contract still "on market" for display; sold/withdrawn/expired = off
  if (['sold', 'withdrawn', 'expired', 'canceled', 'cancelled', 'closed'].includes(status)) {
    return false;
  }
  return true;
}

function snapshotFromListing(listing) {
  const address = formatAddress(listing);
  // Proxy path only — never store raw media.mlsgrid URLs
  const photoUrl = listing?.id ? `/api/photo/${listing.id}/0` : null;
  const price = listing?.list_price != null ? Math.round(Number(listing.list_price)) : null;
  return {
    listing_key: String(listing.listing_id),
    property_address: address,
    photo_url: photoUrl,
    list_price: Number.isFinite(price) ? price : null,
    slug: listing.slug || null,
  };
}

function hydrateRow(saved, listing) {
  const onMarket = isListingOnMarket(listing);
  const address = listing ? formatAddress(listing) : saved.property_address;
  const listPrice = listing?.list_price != null
    ? Math.round(Number(listing.list_price))
    : saved.list_price;
  const photoUrl = listing?.id
    ? `/api/photo/${listing.id}/0`
    : saved.photo_url || null;
  const slug = listing?.slug || saved.slug || null;

  return {
    id: saved.id,
    listing_key: saved.listing_key,
    property_address: address || saved.property_address,
    photo_url: photoUrl,
    list_price: listPrice != null ? Number(listPrice) : null,
    slug,
    saved_at: saved.saved_at,
    off_market: !onMarket,
    // Live fields when available (for cards)
    listing_id: listing?.listing_id || saved.listing_key,
    listing_db_id: listing?.id || null,
    status: listing?.status || (onMarket ? null : 'Off market'),
    beds: listing?.beds != null ? Number(listing.beds) : null,
    baths: listing?.baths != null ? Number(listing.baths) : null,
    living_area: listing?.living_area != null ? Number(listing.living_area) : null,
    city: listing?.city || null,
    state: listing?.state || null,
    street_number: listing?.street_number || null,
    street_name: listing?.street_name || null,
    unit: listing?.unit || null,
  };
}

/** GET /api/saved-homes — newest first, hydrated against listings cache */
export const listSavedHomes = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });
    if (req.query.token) setAuthCookie(res, user.manage_token);

    const pool = getPool();
    const saved = await pool.query(
      `SELECT id, user_id, listing_key, property_address, photo_url, list_price, slug, saved_at
       FROM saved_homes WHERE user_id = $1 ORDER BY saved_at DESC, id DESC`,
      [user.id]
    );

    if (!saved.rows.length) {
      return res.json({ success: true, data: { homes: [], email: user.email } });
    }

    const keys = saved.rows.map((r) => r.listing_key);
    const listings = await pool.query(
      `SELECT id, listing_id, slug, status, is_active, list_price, photos,
              street_number, street_name, unit, city, state, postal_code, beds, baths, living_area
       FROM listings WHERE listing_id = ANY($1::text[])`,
      [keys]
    );
    const byKey = new Map(listings.rows.map((l) => [String(l.listing_id), l]));

    const homes = saved.rows.map((row) => hydrateRow(row, byKey.get(String(row.listing_key)) || null));
    return res.json({ success: true, data: { homes, email: user.email } });
  } catch (error) {
    console.error('listSavedHomes error:', error);
    return res.status(500).json({ success: false, error: 'Could not load saved homes.' });
  }
};

/** POST /api/saved-homes — { listing_key } (IRES id, slug, or serial id) */
export const saveHome = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });

    const key = req.body?.listing_key || req.body?.listingKey || req.body?.listing_id || req.body?.slug;
    if (!key || !String(key).trim()) {
      return res.status(400).json({ success: false, error: 'listing_key is required.' });
    }

    const pool = getPool();
    const listing = await findListing(pool, key);
    if (!listing) {
      // Allow save of already-known keys that aged out? Prefer fail when never seen —
      // migration may pass dead slugs; skip those with 404.
      return res.status(404).json({
        success: false,
        error: 'That listing is no longer available. Try another home.',
      });
    }

    const snap = snapshotFromListing(listing);
    const inserted = await pool.query(
      `INSERT INTO saved_homes (user_id, listing_key, property_address, photo_url, list_price, slug, saved_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, listing_key) DO UPDATE SET
         property_address = EXCLUDED.property_address,
         photo_url = COALESCE(EXCLUDED.photo_url, saved_homes.photo_url),
         list_price = COALESCE(EXCLUDED.list_price, saved_homes.list_price),
         slug = COALESCE(EXCLUDED.slug, saved_homes.slug)
       RETURNING id, listing_key, property_address, photo_url, list_price, slug, saved_at`,
      [user.id, snap.listing_key, snap.property_address, snap.photo_url, snap.list_price, snap.slug]
    );

    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    return res.status(201).json({
      success: true,
      data: hydrateRow(inserted.rows[0], listing),
    });
  } catch (error) {
    console.error('saveHome error:', error);
    return res.status(500).json({ success: false, error: 'Could not save this home.' });
  }
};

/** DELETE /api/saved-homes/:listing_key */
export const unsaveHome = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });

    const raw = decodeURIComponent(String(req.params.listing_key || '')).trim();
    if (!raw) return res.status(400).json({ success: false, error: 'listing_key is required.' });

    const pool = getPool();
    // Resolve slug/id → canonical listing_key when possible
    const listing = await findListing(pool, raw);
    const listingKey = listing ? String(listing.listing_id) : raw;

    const deleted = await pool.query(
      `DELETE FROM saved_homes WHERE user_id = $1 AND listing_key = $2 RETURNING id, listing_key`,
      [user.id, listingKey]
    );

    // Also try raw key in case it was stored under a different form
    if (!deleted.rows.length && listingKey !== raw) {
      await pool.query(
        `DELETE FROM saved_homes WHERE user_id = $1 AND listing_key = $2`,
        [user.id, raw]
      );
    }

    return res.json({ success: true, data: { listing_key: listingKey, removed: true } });
  } catch (error) {
    console.error('unsaveHome error:', error);
    return res.status(500).json({ success: false, error: 'Could not remove this saved home.' });
  }
};

/**
 * GET /api/saved-homes/status?listing_keys=a,b,c
 * Batch heart state for search results — no N+1.
 * Accepts listing_id, slug, or serial id; returns map keyed by each input.
 */
export const savedHomesStatus = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in.' });
    if (req.query.token) setAuthCookie(res, user.manage_token);

    const raw = String(req.query.listing_keys || req.query.keys || '').trim();
    if (!raw) {
      return res.json({ success: true, data: { saved: {}, keys: [] } });
    }

    const inputs = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);

    if (!inputs.length) {
      return res.json({ success: true, data: { saved: {}, keys: [] } });
    }

    const pool = getPool();
    // Map each input → IRES listing_id when resolvable
    const listings = await pool.query(
      `SELECT id, listing_id, slug FROM listings
       WHERE listing_id = ANY($1::text[])
          OR slug = ANY($1::text[])
          OR (id::text = ANY($1::text[]))`,
      [inputs]
    );

    const inputToKey = new Map();
    for (const l of listings.rows) {
      const key = String(l.listing_id);
      inputToKey.set(String(l.listing_id), key);
      if (l.slug) inputToKey.set(String(l.slug), key);
      inputToKey.set(String(l.id), key);
    }
    // Inputs that look like listing keys but aren't in cache still match DB directly
    for (const inp of inputs) {
      if (!inputToKey.has(inp)) inputToKey.set(inp, inp);
    }

    const canonicalKeys = [...new Set([...inputToKey.values()])];
    const saved = await pool.query(
      `SELECT listing_key FROM saved_homes WHERE user_id = $1 AND listing_key = ANY($2::text[])`,
      [user.id, canonicalKeys]
    );
    const savedSet = new Set(saved.rows.map((r) => String(r.listing_key)));

    const map = {};
    for (const inp of inputs) {
      const key = inputToKey.get(inp) || inp;
      map[inp] = savedSet.has(key);
      // Also expose under canonical key for convenience
      if (key !== inp) map[key] = savedSet.has(key);
    }

    return res.json({
      success: true,
      data: {
        saved: map,
        keys: [...savedSet],
      },
    });
  } catch (error) {
    console.error('savedHomesStatus error:', error);
    return res.status(500).json({ success: false, error: 'Could not check saved status.' });
  }
};
