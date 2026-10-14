/**
 * Account-linked saved homes (hearts):
 *   GET    /api/saved-homes                      — list (newest first, hydrated)
 *   POST   /api/saved-homes                      — save { listing_key }
 *   DELETE /api/saved-homes/:listing_key         — unsave
 *   GET    /api/saved-homes/status?listing_keys= — batch heart state
 *
 * Auth required (session cookie or manage token). 401 when signed out.
 * Off-market listings still return denormalized snapshot + off_market flag.
 * On save: FUB nurture event + lead score bump (non-blocking).
 */
import { recordEvent as recordStreamEvent } from '../services/events.js';
import getPool from '../config/database.js';
import { setAuthCookie } from './alertController.js';
import { computeAndStoreLeadScore } from '../services/leadScore.js';
import { invalidateTaste } from '../services/tasteProfile.js';
import { courtesyLine, feedCatalog, listingScope } from '../services/feeds.js';

import { resolveUser } from '../services/buyerSession.js';

// Re-exported: compsController, householdController, reactionsController and
// tourController import resolveUser from here.
export { resolveUser };

function formatAddress(row) {
  if (!row) return null;
  const street = [row.street_number, row.street_name, row.unit ? `#${row.unit}` : null]
    .filter(Boolean)
    .join(' ');
  const cityLine = [row.city, row.state].filter(Boolean).join(', ');
  if (street && cityLine) return `${street}, ${cityLine}`;
  return street || cityLine || null;
}

const LISTING_COLS = `id, listing_id, slug, status, is_active, list_price, photos, feed, list_office_name,
            street_number, street_name, unit, city, state, postal_code, beds, baths, living_area`;

/**
 * Resolve a client-supplied key (IRES listing_id, slug, or serial id) to a
 * listing row, among the feeds this brokerage may show (the current
 * request's brokerage unless feeds are given).
 */
export async function findListing(pool, key, { feeds } = {}) {
  const raw = String(key || '').trim();
  if (!raw || raw.length > 255) return null;
  const inFeeds = feeds || (await listingScope(null, { pool })).feeds;

  // Prefer IRES listing_id (stable key we store)
  let r = await pool.query(
    `SELECT ${LISTING_COLS}
     FROM listings WHERE listing_id = $1 AND feed = ANY($2::text[]) LIMIT 1`,
    [raw, inFeeds]
  );
  if (r.rows.length) return r.rows[0];

  // Slug (legacy localStorage hearts stored slugs)
  r = await pool.query(
    `SELECT ${LISTING_COLS}
     FROM listings WHERE slug = $1 AND feed = ANY($2::text[]) LIMIT 1`,
    [raw, inFeeds]
  );
  if (r.rows.length) return r.rows[0];

  // Serial PK (photo proxy id)
  if (/^\d+$/.test(raw)) {
    r = await pool.query(
      `SELECT ${LISTING_COLS}
       FROM listings WHERE id = $1 AND feed = ANY($2::text[]) LIMIT 1`,
      [Number(raw), inFeeds]
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

function hydrateRow(saved, listing, catalog = null) {
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
    sample: listing?.feed === 'demo',
    courtesy: listing && catalog ? courtesyLine(listing, catalog) : null,
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
    // Homes outside this brokerage's feeds now (a feed switched or
    // suspended) show as no longer available, from the saved snapshot.
    const { feeds } = await listingScope(req.tenant, { pool });
    const listings = await pool.query(
      `SELECT ${LISTING_COLS}
       FROM listings WHERE listing_id = ANY($1::text[]) AND feed = ANY($2::text[])`,
      [keys, feeds]
    );
    const byKey = new Map(listings.rows.map((l) => [String(l.listing_id), l]));
    const catalog = await feedCatalog({ pool });

    const homes = saved.rows.map((row) => hydrateRow(row, byKey.get(String(row.listing_key)) || null, catalog));
    return res.json({ success: true, data: { homes, email: user.email } });
  } catch (error) {
    console.error('listSavedHomes error:', error);
    return res.status(500).json({ success: false, error: 'Could not load saved homes.' });
  }
};

/**
 * Put a home on a buyer's saved list. First saves also tell the agent:
 * cockpit timeline, event stream, lead score and a Follow Up Boss event.
 * Shared by the heart and by Love / Maybe reactions.
 */
export async function saveHomeForUser(user, listing, pool = getPool(), { via = null } = {}) {
  const snap = snapshotFromListing(listing);

  // Detect first-time save vs re-save (idempotent heart) for FUB/events
  const prior = await pool.query(
    `SELECT id FROM saved_homes WHERE user_id = $1 AND listing_key = $2 LIMIT 1`,
    [user.id, snap.listing_key]
  );
  const isNewSave = !prior.rows.length;

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

  // Agent cockpit heat: FUB event + lead score + user_events (new saves only)
  if (isNewSave) {
    const priceLabel =
      snap.list_price != null
        ? `$${Number(snap.list_price).toLocaleString('en-US')}`
        : null;
    const detailParts = [
      via === 'love' ? 'Loved it' : via === 'maybe' ? 'Marked it a maybe' : null,
      snap.property_address || null,
      priceLabel,
      snap.listing_key ? `MLS ${snap.listing_key}` : null,
    ].filter(Boolean);

    // user_events for cockpit timeline
    pool
      .query(
        `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'saved_home', $2::jsonb)`,
        [
          user.id,
          JSON.stringify({
            listing_key: snap.listing_key,
            property_address: snap.property_address,
            list_price: snap.list_price,
            slug: snap.slug,
          }),
        ]
      )
      .catch(() => {});

    recordStreamEvent({
      type: 'home_saved',
      userId: user.id,
      listingId: snap.listing_key,
      meta: { slug: snap.slug, list_price: snap.list_price },
    });

    // Lead score (+20 has-saved-home pattern) — recompute from real signals
    computeAndStoreLeadScore(user.id, pool).catch((e) => {
      console.error('lead score on saved home failed:', e.message);
    });

    // FUB: person + "Saved a home" nurture event (source: the brokerage's site)
    import('../services/followUpBossService.js')
      .then(({ pushNurtureSignalToFollowUpBoss }) =>
        pushNurtureSignalToFollowUpBoss({
          signal: 'saved_home',
          tenantId: user.tenant_id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          message: detailParts.join(' · '),
          property: {
            street: snap.property_address || undefined,
            mlsNumber: snap.listing_key || undefined,
            price: snap.list_price != null ? Number(snap.list_price) : undefined,
          },
        })
      )
      .catch(() => {});

    try {
      const { refreshLeadLifecycle } = await import('../services/agentCockpit.js');
      refreshLeadLifecycle(user.id, pool).catch(() => {});
    } catch {
      /* noop */
    }
  }

  invalidateTaste(user.id);
  return { row: inserted.rows[0], isNewSave };
}

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

    const { row } = await saveHomeForUser(user, listing, pool);
    // A heart outranks an earlier Not for me.
    await pool.query(
      `UPDATE home_reactions SET reaction = NULL, updated_at = NOW()
       WHERE user_id = $1 AND listing_key = $2 AND reaction = 'pass'`,
      [user.id, row.listing_key]
    );

    return res.status(201).json({
      success: true,
      data: hydrateRow(row, listing, await feedCatalog({ pool })),
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

    // Unsaving takes back a Love or Maybe; the private note stays.
    await pool.query(
      `UPDATE home_reactions SET reaction = NULL, updated_at = NOW()
       WHERE user_id = $1 AND listing_key = ANY($2::text[]) AND reaction IN ('love', 'maybe')`,
      [user.id, [listingKey, raw]]
    );
    invalidateTaste(user.id);

    recordStreamEvent({ type: 'home_unsaved', userId: user.id, listingId: listingKey });
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
    const { feeds } = await listingScope(req.tenant, { pool });
    const listings = await pool.query(
      `SELECT id, listing_id, slug FROM listings
       WHERE (listing_id = ANY($1::text[])
          OR slug = ANY($1::text[])
          OR (id::text = ANY($1::text[])))
         AND feed = ANY($2::text[])`,
      [inputs, feeds]
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
