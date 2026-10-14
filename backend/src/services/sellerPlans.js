/**
 * The seller dashboard: one plan per client who is selling with us.
 *
 * The client sees it on My Home (seller mode): their market analysis (CMA)
 * request, a prep checklist (fix or skip, which the agent can edit), the
 * listing timeline with dates the agent sets, and once listed the showings,
 * showing feedback and offers side by side, then a closing checklist.
 *
 * Only that client and the brokerage's staff who can see the client ever read
 * a plan. Showings come from the existing showing and tour requests, without
 * the buyers' names or contact details.
 */

import { listingScope } from './feeds.js';

export const PLAN_STATUSES = ['preparing', 'listed', 'under_contract', 'closed', 'withdrawn'];
export const STATUS_LABELS = {
  preparing: 'Getting ready',
  listed: 'On the market',
  under_contract: 'Under contract',
  closed: 'Sold',
  withdrawn: 'Paused',
};
export const OFFER_STATUSES = ['active', 'countered', 'accepted', 'declined', 'withdrawn'];

const item = (id, title, decision, hint) => ({ id, title, decision, hint, done: false, note: null });

export const DEFAULT_CHECKLIST = [
  item('paint', 'Touch up paint in the main rooms', 'fix', 'Neutral colors photograph well and cost little.'),
  item('repairs', 'Fix drips, running toilets, sticky doors and loose handles', 'fix', 'Small fixes keep buyers from wondering what else is wrong.'),
  item('lights', 'Replace burned-out bulbs and match bulb colors', 'fix', null),
  item('clean', 'Deep clean, including windows and carpets', 'fix', null),
  item('declutter', 'Declutter and pack away personal photos', 'fix', 'Rooms look bigger, and buyers can picture their own things.'),
  item('curb', 'Trim the yard and freshen the entry', 'fix', 'The first photo is usually the front of the home.'),
  item('hvac', 'Service the furnace and air conditioning', 'consider', 'Keep the receipt to show buyers.'),
  item('inspection', 'Pre-listing inspection', 'consider', 'Can surface surprises before a buyer’s inspector does.'),
  item('floors', 'New flooring', 'consider', 'Talk it through with your agent first.'),
  item('kitchen', 'Full kitchen remodel', 'skip', 'Rarely pays for itself right before a sale.'),
];

export const DEFAULT_TIMELINE = [
  { key: 'cma', label: 'Pricing talk (market analysis)', date: null, done: false },
  { key: 'prep', label: 'Prep and repairs finished', date: null, done: false },
  { key: 'photos', label: 'Photos and video', date: null, done: false },
  { key: 'list', label: 'Live on the market', date: null, done: false },
  { key: 'offers', label: 'Offer review', date: null, done: false },
  { key: 'contract', label: 'Under contract', date: null, done: false },
  { key: 'close', label: 'Closing day', date: null, done: false },
];

export const DEFAULT_CLOSING_CHECKLIST = [
  item('inspection', 'Buyer’s inspection and any repair requests', 'fix', null),
  item('appraisal', 'Appraisal', 'fix', null),
  item('title', 'Title work and payoff of your loan', 'fix', null),
  item('docs', 'Sign seller documents', 'fix', null),
  item('utilities', 'Schedule utilities to transfer on closing day', 'fix', null),
  item('move', 'Move out and leave the home broom clean', 'fix', null),
  item('keys', 'Gather keys, garage openers and manuals', 'fix', null),
  item('walkthrough', 'Buyer’s final walk-through', 'fix', null),
];

const str = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Clean an edited checklist (agent): up to 40 items. Returns null when invalid. */
export function cleanChecklist(list) {
  if (!Array.isArray(list) || list.length > 40) return null;
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const title = str(raw?.title, 140);
    if (!title) continue;
    let id = str(raw?.id, 40) || `item-${out.length + 1}`;
    while (seen.has(id)) id = `${id}-x`;
    seen.add(id);
    out.push({
      id,
      title,
      decision: ['fix', 'skip', 'consider'].includes(raw?.decision) ? raw.decision : 'fix',
      hint: str(raw?.hint, 240),
      note: str(raw?.note, 400),
      done: raw?.done === true,
    });
  }
  return out;
}

/** Clean an edited timeline (agent). */
export function cleanTimeline(list) {
  if (!Array.isArray(list) || list.length > 20) return null;
  return list.map((raw, i) => ({
    key: str(raw?.key, 40) || `step-${i + 1}`,
    label: str(raw?.label, 120) || `Step ${i + 1}`,
    date: DATE_RE.test(String(raw?.date || '')) ? String(raw.date) : null,
    done: raw?.done === true,
  }));
}

/** Clean one offer summary typed by the agent. Returns { offer } or { error }. */
export function cleanOffer(body = {}) {
  const num = (v, min, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[$,%\s]/g, ''));
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  };
  const price = num(body.price, 1000, 100000000);
  if (!price) return { error: 'Add the offer price.' };
  const down = num(body.down_payment_pct, 0, 100);
  const earnest = num(body.earnest_money, 0, 10000000);
  const credit = num(body.seller_credit, 0, 10000000);
  if ([down, earnest, credit].includes(undefined)) return { error: 'Check the offer numbers.' };
  const closeDate = body.close_date && DATE_RE.test(String(body.close_date)) ? String(body.close_date) : null;
  let expires = null;
  if (body.expires_at) {
    const d = new Date(body.expires_at);
    if (Number.isNaN(d.getTime())) return { error: 'Check when the offer expires.' };
    expires = d.toISOString();
  }
  const status = OFFER_STATUSES.includes(body.status) ? body.status : 'active';
  return {
    offer: {
      label: str(body.label, 80),
      price: Math.round(price),
      financing: str(body.financing, 40),
      down_payment_pct: down,
      earnest_money: earnest != null ? Math.round(earnest) : null,
      seller_credit: credit != null ? Math.round(credit) : null,
      close_date: closeDate,
      contingencies: str(body.contingencies, 600),
      note: str(body.note, 1000),
      expires_at: expires,
      status,
    },
  };
}

/** The plan row for a client in their brokerage, or null. */
export async function planForClient(pool, userId, tenantId) {
  const { rows } = await pool.query('SELECT * FROM seller_plans WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
  return rows[0] || null;
}

/**
 * Start (or restart) a plan for a client. Keeps everything they did as a
 * buyer; only adds the plan. Uses their home on My Home when there is one.
 */
export async function startPlan(pool, { client, agentId = null, origin = 'client', homeProfileId = null, address = null }) {
  const existing = await planForClient(pool, client.id, client.tenant_id);
  if (existing && existing.status !== 'withdrawn') return { plan: existing, created: false };
  let home = null;
  if (homeProfileId) {
    ({ rows: [home] } = await pool.query('SELECT * FROM home_profiles WHERE id = $1 AND user_id = $2', [homeProfileId, client.id]));
  }
  if (!home) {
    ({ rows: [home] } = await pool.query('SELECT * FROM home_profiles WHERE user_id = $1 ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1', [client.id]));
  }
  if (!home) {
    const { rows: [closing] } = await pool.query("SELECT * FROM client_closings WHERE user_id = $1 AND side = 'buyer'", [client.id]);
    if (closing) home = { id: closing.home_profile_id, address_line: closing.address_line, city: closing.city, postal_code: closing.postal_code };
  }
  const addr = {
    address_line: str(address?.address_line, 255) || home?.address_line || null,
    city: str(address?.city, 100) || home?.city || null,
    postal_code: str(address?.postal_code, 16) || home?.postal_code || null,
  };
  const { rows: [plan] } = await pool.query(
    `INSERT INTO seller_plans (tenant_id, user_id, agent_id, home_profile_id, origin, status, address_line, city, postal_code,
                               checklist, timeline, closing_checklist)
     VALUES ($1, $2, $3, $4, $5, 'preparing', $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET status = 'preparing', origin = EXCLUDED.origin,
       agent_id = COALESCE(EXCLUDED.agent_id, seller_plans.agent_id),
       home_profile_id = COALESCE(EXCLUDED.home_profile_id, seller_plans.home_profile_id),
       address_line = COALESCE(EXCLUDED.address_line, seller_plans.address_line),
       city = COALESCE(EXCLUDED.city, seller_plans.city),
       postal_code = COALESCE(EXCLUDED.postal_code, seller_plans.postal_code),
       updated_at = NOW()
     RETURNING *`,
    [client.tenant_id, client.id, agentId || client.assigned_agent_id || null, home?.id || null, origin === 'agent' ? 'agent' : 'client',
      addr.address_line, addr.city, addr.postal_code,
      JSON.stringify(DEFAULT_CHECKLIST), JSON.stringify(DEFAULT_TIMELINE), JSON.stringify(DEFAULT_CLOSING_CHECKLIST)]
  );
  // Selling too, not instead: a buyer keeps their buyer side.
  await pool.query(
    `UPDATE users SET intent = CASE WHEN intent IN ('buying', 'both') THEN 'both' ELSE 'selling' END WHERE id = $1 AND tenant_id = $2`,
    [client.id, client.tenant_id]
  );
  return { plan, created: true };
}

/**
 * Showings of the listed home from the existing request flows, without who
 * asked: dates and times only.
 */
export async function planShowings(pool, plan) {
  if (!plan?.listing_key) return [];
  const { feeds } = await listingScope(plan.tenant_id, { pool });
  const { rows: [listing] } = await pool.query(
    'SELECT listing_id, slug FROM listings WHERE (listing_id = $1 OR slug = $1) AND feed = ANY($2::text[]) LIMIT 1',
    [plan.listing_key, feeds]
  );
  const key = listing?.listing_id || plan.listing_key;
  const slug = listing?.slug || plan.listing_key;
  const { rows: showings } = await pool.query(
    `SELECT id, showing_date, showing_time, created_at FROM showing_requests
     WHERE tenant_id = $1 AND listing_slug = $2 AND COALESCE(source_page, '') <> '/board/'
     ORDER BY showing_date DESC, id DESC LIMIT 50`,
    [plan.tenant_id, slug]
  );
  const { rows: tours } = await pool.query(
    `SELECT id, windows, created_at FROM tour_requests
     WHERE tenant_id = $1 AND $2 = ANY(listing_keys) ORDER BY created_at DESC LIMIT 50`,
    [plan.tenant_id, key]
  ).catch(() => ({ rows: [] }));
  const out = [
    ...showings.map((s) => ({ kind: 'showing', date: s.showing_date ? new Date(s.showing_date).toISOString().slice(0, 10) : null, time: s.showing_time, requested_at: s.created_at })),
    ...tours.map((t) => ({ kind: 'tour', date: t.windows?.[0]?.date || null, time: t.windows?.[0]?.part || null, requested_at: t.created_at })),
  ];
  return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

const publicOffer = (o) => ({
  id: o.id,
  label: o.label,
  price: o.price,
  financing: o.financing,
  down_payment_pct: o.down_payment_pct != null ? Number(o.down_payment_pct) : null,
  earnest_money: o.earnest_money,
  seller_credit: o.seller_credit,
  close_date: o.close_date ? new Date(o.close_date).toISOString().slice(0, 10) : null,
  contingencies: o.contingencies,
  note: o.note,
  expires_at: o.expires_at,
  status: o.status,
  created_at: o.created_at,
});

/** Everything the dashboard shows for one plan. Offers and feedback are read by plan id within the plan's brokerage only. */
export async function planView(pool, plan, { forStaff = false } = {}) {
  const { rows: feedback } = await pool.query(
    `SELECT id, shown_on, interest, feedback, created_at FROM seller_showing_feedback
     WHERE plan_id = $1 AND tenant_id = $2 ORDER BY COALESCE(shown_on, created_at::date) DESC, id DESC`,
    [plan.id, plan.tenant_id]
  );
  const { rows: offers } = await pool.query(
    'SELECT * FROM seller_offers WHERE plan_id = $1 AND tenant_id = $2 ORDER BY price DESC, id',
    [plan.id, plan.tenant_id]
  );
  let listing = null;
  if (plan.listing_key) {
    const { rows } = await pool.query(
      `SELECT id, listing_id, slug, list_price, status, days_on_market, street_number, street_name, city
       FROM listings WHERE (listing_id = $1 OR slug = $1) AND feed = ANY($2::text[]) LIMIT 1`,
      [plan.listing_key, (await listingScope(plan.tenant_id, { pool })).feeds]
    );
    if (rows[0]) {
      listing = {
        listing_id: rows[0].listing_id,
        slug: rows[0].slug,
        list_price: rows[0].list_price != null ? Number(rows[0].list_price) : null,
        status: rows[0].status,
        days_on_market: rows[0].days_on_market,
        photo_url: `/api/photo/${rows[0].id}/0`,
      };
    }
  }
  const { rows: [agent] } = plan.agent_id
    ? await pool.query("SELECT id, name, email, phone FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin')", [plan.agent_id, plan.tenant_id])
    : { rows: [] };
  return {
    id: plan.id,
    status: plan.status,
    status_label: STATUS_LABELS[plan.status] || plan.status,
    origin: plan.origin,
    address_line: plan.address_line,
    city: plan.city,
    postal_code: plan.postal_code,
    home_profile_id: plan.home_profile_id,
    listing_key: plan.listing_key,
    list_price: plan.list_price,
    listing,
    cma: {
      requested_at: plan.cma_requested_at,
      note: plan.cma_note,
      ready_at: plan.cma_ready_at,
      summary: plan.cma_summary,
    },
    checklist: plan.checklist || [],
    timeline: plan.timeline || [],
    closing_checklist: plan.closing_checklist || [],
    showings: await planShowings(pool, plan),
    feedback: feedback.map((f) => ({ ...f, shown_on: f.shown_on ? new Date(f.shown_on).toISOString().slice(0, 10) : null })),
    offers: offers.map(publicOffer),
    agent: agent ? { name: agent.name, email: agent.email, phone: agent.phone } : null,
    ...(forStaff ? { user_id: plan.user_id, agent_id: plan.agent_id } : {}),
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}
