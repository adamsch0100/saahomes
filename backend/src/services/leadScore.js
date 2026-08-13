/**
 * Lead score ("Scout Score"-style) + saved-search match helpers.
 * Score is computed only from real events we store — never fabricated.
 *
 * Points (capped model):
 *   +20  has at least one saved search
 *   +20  has at least one saved home (heart)
 *   +25  has scheduled a showing
 *   +15  opened chat (Nadia) while signed in
 *   +10  submitted a contact form
 *   +5   per listing-view session (distinct listing per calendar day), cap +20
 *   −10  no engagement in the last 30 days
 */
import getPool from '../config/database.js';

/** Build WHERE for saved-search filters against the listings table. */
export function buildWhere(filters) {
  const where = ['is_active = TRUE', "status = 'Active'"];
  const params = [];
  let i = 1;
  const f = filters || {};
  // Multi-city / multi-zip (parity with listing search + alert digests)
  const cityRaw = f.city ? String(f.city) : '';
  const zipRaw = f.postal_code || f.postalCode || f.zip || f.zipCode || f.zips || '';
  const cityList = cityRaw && cityRaw !== '__noco__' && cityRaw !== '__all__'
    ? cityRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const zipList = zipRaw
    ? String(zipRaw).split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const locParts = [];
  if (cityList.length === 1) {
    locParts.push(`LOWER(city) = LOWER($${i})`);
    params.push(cityList[0]);
    i += 1;
  } else if (cityList.length > 1) {
    locParts.push(`LOWER(city) = ANY($${i}::text[])`);
    params.push(cityList.map((c) => c.toLowerCase()));
    i += 1;
  }
  if (zipList.length === 1) {
    locParts.push(`postal_code = $${i}`);
    params.push(zipList[0]);
    i += 1;
  } else if (zipList.length > 1) {
    locParts.push(`postal_code = ANY($${i}::text[])`);
    params.push(zipList);
    i += 1;
  }
  if (locParts.length === 1) where.push(locParts[0]);
  else if (locParts.length > 1) where.push(`(${locParts.join(' OR ')})`);
  if (f.minPrice) { where.push(`list_price >= $${i++}`); params.push(Number(f.minPrice)); }
  if (f.maxPrice) { where.push(`list_price <= $${i++}`); params.push(Number(f.maxPrice)); }
  if (f.beds) { where.push(`beds >= $${i++}`); params.push(Number(f.beds)); }
  if (f.baths) { where.push(`baths >= $${i++}`); params.push(Number(f.baths)); }
  if (f.type && ['detached', 'attached', 'land', 'commercial', 'other'].includes(f.type)) {
    where.push(`home_type = $${i++}`);
    params.push(f.type);
  }
  if (f.q) {
    where.push(`(LOWER(city) LIKE $${i} OR LOWER(street_name) LIKE $${i} OR LOWER(description) LIKE $${i})`);
    params.push(`%${String(f.q).toLowerCase()}%`);
    i += 1;
  }
  if (f.minSqft) { where.push(`living_area >= $${i++}`); params.push(Number(f.minSqft)); }
  if (f.minYear) { where.push(`year_built >= $${i++}`); params.push(Number(f.minYear)); }
  if (f.maxHoa) { where.push(`hoa_fee <= $${i++}`); params.push(Number(f.maxHoa)); }
  if (f.garage === 'true' || f.garage === true) where.push('garage_spaces > 0');
  if (f.basement === 'true' || f.basement === true) {
    where.push(`COALESCE(features->>'basement','') NOT ILIKE '%none%' AND COALESCE(features->>'basement','') <> ''`);
  }
  if (f.fireplace === 'true' || f.fireplace === true) {
    where.push(`COALESCE(features->>'fireplaces','') <> ''`);
  }
  if (f.pool === 'true' || f.pool === true) {
    where.push(`COALESCE(features->>'pool','') NOT ILIKE 'n%' AND COALESCE(features->>'pool','') <> ''`);
  }
  if (f.newConstruction === 'true' || f.newConstruction === true) {
    where.push(`features->>'new_construction' = 'true'`);
  }
  if (f.waterfront === 'true' || f.waterfront === true) {
    where.push(`features->>'waterfront' = 'true'`);
  }
  if (f.assumable === 'true' || f.assumable === true || f.assumable === '1') {
    where.push('assumable = TRUE');
  }
  if (f.newDays) { where.push(`days_on_market <= $${i++}`); params.push(Number(f.newDays)); }
  return { whereSql: where.join(' AND '), params };
}

/**
 * Live match count + most recently updated matching listing for a filters object.
 * Returns { match_count, preview } — preview may be null.
 */
export async function getSearchMatchMeta(filters, pool = getPool()) {
  try {
    const { whereSql, params } = buildWhere(filters);
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM listings WHERE ${whereSql}`,
      params
    );
    const matchCount = countRes.rows[0]?.n || 0;
    let preview = null;
    if (matchCount > 0) {
      const prevRes = await pool.query(
        `SELECT id, listing_id, slug, street_number, street_name, unit, city, state,
                postal_code, list_price, beds, baths, living_area, home_type
         FROM listings WHERE ${whereSql}
         ORDER BY updated_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        params
      );
      if (prevRes.rows[0]) {
        const l = prevRes.rows[0];
        preview = {
          id: l.id,
          listing_id: l.listing_id,
          slug: l.slug,
          address: [l.street_number, l.street_name, l.unit ? `#${l.unit}` : null, l.city]
            .filter(Boolean).join(' '),
          city: l.city,
          list_price: l.list_price != null ? Number(l.list_price) : null,
          beds: l.beds,
          baths: l.baths,
          living_area: l.living_area,
          home_type: l.home_type,
        };
      }
    }
    return { match_count: matchCount, preview };
  } catch (err) {
    console.error('getSearchMatchMeta error:', err.message);
    return { match_count: 0, preview: null };
  }
}

/**
 * Compute lead score from real DB signals and persist to users.lead_score.
 * Returns { score, breakdown }.
 */
export async function computeAndStoreLeadScore(userId, pool = getPool()) {
  const userRes = await pool.query(
    'SELECT id, email, last_active_at, created_at FROM users WHERE id = $1',
    [userId]
  );
  if (!userRes.rows[0]) return { score: 0, breakdown: {} };
  const user = userRes.rows[0];
  const email = (user.email || '').toLowerCase();
  const breakdown = {
    saved_search: 0,
    saved_home: 0,
    showing: 0,
    chat: 0,
    contact: 0,
    listing_views: 0,
    inactivity: 0,
  };

  const safeCount = async (sql, params) => {
    try {
      const r = await pool.query(sql, params);
      return r.rows[0]?.n || r.rows[0]?.sessions || 0;
    } catch (e) {
      // Table may not exist mid-deploy; never invent points from a failed query
      return 0;
    }
  };

  // +20 save-search
  if ((await safeCount('SELECT COUNT(*)::int AS n FROM saved_searches WHERE user_id = $1', [userId])) > 0) {
    breakdown.saved_search = 20;
  }

  // +20 saved home (heart)
  if ((await safeCount('SELECT COUNT(*)::int AS n FROM saved_homes WHERE user_id = $1', [userId])) > 0) {
    breakdown.saved_home = 20;
  }

  // +25 schedule showing
  if (email) {
    if ((await safeCount('SELECT COUNT(*)::int AS n FROM showing_requests WHERE LOWER(email) = $1', [email])) > 0) {
      breakdown.showing = 25;
    }
  }

  // +15 chat opened
  if ((await safeCount(
    `SELECT COUNT(*)::int AS n FROM user_events WHERE user_id = $1 AND event_type = 'chat_opened'`,
    [userId]
  )) > 0) {
    breakdown.chat = 15;
  }

  // +10 contact form
  if (email) {
    if ((await safeCount(
      'SELECT COUNT(*)::int AS n FROM contact_submissions WHERE LOWER(email) = $1',
      [email]
    )) > 0) {
      breakdown.contact = 10;
    }
  }

  // +5 per listing view session (distinct listing_id per calendar day), cap 20
  const sessionCount = await safeCount(
    `SELECT COUNT(*)::int AS sessions FROM (
       SELECT listing_id, (viewed_at AT TIME ZONE 'America/Denver')::date AS d
       FROM property_views
       WHERE user_id = $1
       GROUP BY listing_id, (viewed_at AT TIME ZONE 'America/Denver')::date
     ) s`,
    [userId]
  );
  breakdown.listing_views = Math.min(20, sessionCount * 5);

  // −10 if no engagement in 30 days
  try {
    const lastEng = await pool.query(
      `SELECT GREATEST(
         (SELECT MAX(viewed_at) FROM property_views WHERE user_id = $1),
         (SELECT MAX(created_at) FROM user_events WHERE user_id = $1),
         (SELECT MAX(updated_at) FROM saved_searches WHERE user_id = $1),
         (SELECT MAX(created_at) FROM saved_searches WHERE user_id = $1),
         (SELECT MAX(last_email_at) FROM saved_searches WHERE user_id = $1),
         (SELECT MAX(saved_at) FROM saved_homes WHERE user_id = $1),
         $2::timestamp
       ) AS last_at`,
      [userId, user.last_active_at || user.created_at]
    );
    const lastAt = lastEng.rows[0]?.last_at ? new Date(lastEng.rows[0].last_at) : null;
    if (lastAt) {
      const days = (Date.now() - lastAt.getTime()) / (1000 * 60 * 60 * 24);
      if (days > 30) breakdown.inactivity = -10;
    }
  } catch {
    // ignore — no penalty without verified last-engagement data
  }

  const score = Math.max(
    0,
    breakdown.saved_search +
      breakdown.saved_home +
      breakdown.showing +
      breakdown.chat +
      breakdown.contact +
      breakdown.listing_views +
      breakdown.inactivity
  );

  await pool.query(
    `UPDATE users SET lead_score = $1, lead_score_updated_at = NOW(), last_active_at = COALESCE(last_active_at, NOW())
     WHERE id = $2`,
    [score, userId]
  );

  return { score, breakdown };
}

/**
 * Record a property view for a signed-in user.
 * Dedupes within a short window so rapid reloads don't inflate sessions.
 * listingKey: MLS listing_id or internal numeric id.
 */
export async function recordPropertyView(userId, listingKey, pool = getPool()) {
  const key = String(listingKey || '').trim();
  if (!key) return null;

  // Resolve to MLS listing_id when possible
  let listingId = key;
  const byId = await pool.query(
    `SELECT listing_id FROM listings
     WHERE listing_id = $1 OR id::text = $1 OR slug = $1
     LIMIT 1`,
    [key]
  );
  if (byId.rows[0]?.listing_id) listingId = byId.rows[0].listing_id;

  // Dedupe: same user + listing within 30 minutes counts as one view event
  const recent = await pool.query(
    `SELECT id FROM property_views
     WHERE user_id = $1 AND listing_id = $2 AND viewed_at > NOW() - INTERVAL '30 minutes'
     LIMIT 1`,
    [userId, listingId]
  );
  let inserted = false;
  if (!recent.rows.length) {
    await pool.query(
      'INSERT INTO property_views (user_id, listing_id) VALUES ($1, $2)',
      [userId, listingId]
    );
    inserted = true;
  }

  await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [userId]);
  const { score, breakdown } = await computeAndStoreLeadScore(userId, pool);

  // Nurture signal → FUB when a listing is viewed 2+ times (real signal only)
  if (inserted) {
    try {
      const viewCount = await pool.query(
        `SELECT COUNT(*)::int AS n FROM property_views
         WHERE user_id = $1 AND listing_id = $2`,
        [userId, listingId]
      );
      if (viewCount.rows[0]?.n === 2) {
        const userRow = await pool.query(
          'SELECT email, name, phone FROM users WHERE id = $1',
          [userId]
        );
        const u = userRow.rows[0];
        if (u?.email) {
          const { pushNurtureSignalToFollowUpBoss } = await import('./followUpBossService.js');
          pushNurtureSignalToFollowUpBoss({
            signal: 'listing_view_2x',
            email: u.email,
            name: u.name,
            phone: u.phone,
            message: `Listing: ${listingId}`,
            property: { mlsNumber: listingId },
          }).catch(() => {});
          await pool.query(
            `INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, 'listing_view_2x', $2::jsonb)`,
            [userId, JSON.stringify({ listing_id: listingId })]
          ).catch(() => {});
        }
      }
    } catch {
      // FUB write-back is non-blocking
    }
    try {
      const { refreshLeadLifecycle } = await import('./agentCockpit.js');
      refreshLeadLifecycle(userId, pool).catch(() => {});
    } catch { /* noop */ }
  }

  return { listing_id: listingId, lead_score: score, breakdown };
}

/**
 * Record a named user event (e.g. chat_opened). Dedupes chat_opened to once/day.
 */
export async function recordUserEvent(userId, eventType, meta = null, pool = getPool()) {
  const type = String(eventType || '').slice(0, 32);
  if (!type) return null;

  if (type === 'chat_opened') {
    const recent = await pool.query(
      `SELECT id FROM user_events
       WHERE user_id = $1 AND event_type = 'chat_opened'
         AND created_at > NOW() - INTERVAL '1 day'
       LIMIT 1`,
      [userId]
    );
    if (!recent.rows.length) {
      await pool.query(
        'INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, $2, $3)',
        [userId, type, meta ? JSON.stringify(meta) : null]
      );
    }
  } else {
    await pool.query(
      'INSERT INTO user_events (user_id, event_type, meta) VALUES ($1, $2, $3)',
      [userId, type, meta ? JSON.stringify(meta) : null]
    );
  }

  await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [userId]);
  const { score, breakdown } = await computeAndStoreLeadScore(userId, pool);
  return { event_type: type, lead_score: score, breakdown };
}

/** Recent property views with listing details (for digest personalization). */
export async function getRecentViews(userId, limit = 5, pool = getPool()) {
  const res = await pool.query(
    `SELECT DISTINCT ON (pv.listing_id)
       pv.listing_id, pv.viewed_at,
       l.slug, l.street_number, l.street_name, l.city, l.list_price, l.beds, l.home_type
     FROM property_views pv
     LEFT JOIN listings l ON l.listing_id = pv.listing_id
     WHERE pv.user_id = $1
     ORDER BY pv.listing_id, pv.viewed_at DESC`,
    [userId]
  );
  // Re-sort by most recent view and limit
  return res.rows
    .sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at))
    .slice(0, limit)
    .map((r) => ({
      listing_id: r.listing_id,
      slug: r.slug,
      address: [r.street_number, r.street_name, r.city].filter(Boolean).join(' '),
      street: [r.street_number, r.street_name].filter(Boolean).join(' '),
      city: r.city,
      list_price: r.list_price != null ? Number(r.list_price) : null,
      beds: r.beds,
      home_type: r.home_type,
      viewed_at: r.viewed_at,
    }));
}

/** Deep-link path for a saved search's filters. */
export function filtersToSearchPath(filters = {}) {
  const params = new URLSearchParams();
  const keys = [
    'city', 'minPrice', 'maxPrice', 'beds', 'baths', 'type', 'sort', 'q',
    'minSqft', 'minYear', 'maxHoa', 'garage', 'basement', 'fireplace', 'pool',
    'newConstruction', 'waterfront', 'newDays', 'assumable',
  ];
  for (const k of keys) {
    if (filters[k] !== undefined && filters[k] !== null && filters[k] !== '') {
      params.set(k, String(filters[k]));
    }
  }
  const qs = params.toString();
  return qs ? `/properties/?${qs}` : '/properties/';
}
