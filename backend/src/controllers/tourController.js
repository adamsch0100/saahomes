/**
 * Tour planner:
 *   POST /api/tours/plan              — { listing_keys } → driving order + time estimate
 *   POST /api/tours                   — { listing_keys, windows[1–3], note?, phone? } → one request to the agent
 *   GET  /api/tours/:id/calendar.ics  — a tentative calendar hold for the first window
 *
 * One tour becomes one showing request (cockpit + Follow Up Boss) carrying
 * the whole route, instead of a separate request per home.
 */
import getPool from '../config/database.js';
import { recordEvent as recordStreamEvent } from '../services/events.js';
import { forwardShowingRequestToFollowUpBoss } from '../services/followUpBossService.js';
import { createNotification } from '../services/notificationService.js';
import {
  DAY_PARTS,
  MAX_TOUR_HOMES,
  describeRoute,
  planRoute,
  tourCalendar,
} from '../services/tourPlanner.js';
import { resolveUser } from './savedHomesController.js';
import { reportLeadToBoard } from '../services/boardLeadCount.js';
import { tenantIdOf, siteUrlFor } from '../services/tenantContext.js';
import { brandFor, isHomeTenant } from '../services/brand.js';
import { listingScope } from '../services/feeds.js';
import { notifyAgent } from '../services/agentNotice.js';

const SITE = (process.env.SITE_URL || 'https://saahomes.com').replace(/\/$/, '');
const MAX_WINDOWS = 3;
const MAX_DAYS_AHEAD = 60;

const unauthorized = (res) => res.status(401).json({ success: false, error: 'Sign in to plan a tour.' });

/** Today's date in Mountain time, as YYYY-MM-DD. */
export function denverToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now);
}

function cleanKeys(raw) {
  if (!Array.isArray(raw)) return null;
  const keys = [...new Set(raw.map((k) => String(k || '').trim()).filter(Boolean))];
  return keys.length >= 1 && keys.length <= MAX_TOUR_HOMES && keys.every((k) => k.length <= 64) ? keys : null;
}

export function cleanWindows(raw, now = new Date()) {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_WINDOWS) return null;
  const today = denverToday(now);
  const last = denverToday(new Date(now.getTime() + MAX_DAYS_AHEAD * 86400000));
  const out = [];
  for (const w of raw) {
    const date = String(w?.date || '');
    const part = String(w?.part || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DAY_PARTS[part]) return null;
    if (Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || date < today || date > last) return null;
    if (!out.some((o) => o.date === date && o.part === part)) out.push({ date, part });
  }
  return out;
}

async function loadStops(pool, keys) {
  const { feeds } = await listingScope(null, { pool });
  const { rows } = await pool.query(
    `SELECT id, listing_id, slug, list_price, street_number, street_name, unit, city, latitude, longitude, status
     FROM listings WHERE listing_id = ANY($1::text[]) AND feed = ANY($2::text[])`,
    [keys, feeds]
  );
  const byKey = new Map(rows.map((r) => [String(r.listing_id), r]));
  return keys.filter((k) => byKey.has(k)).map((k) => {
    const l = byKey.get(k);
    const street = [l.street_number, l.street_name, l.unit ? `#${l.unit}` : null].filter(Boolean).join(' ');
    return {
      listing_key: k,
      slug: l.slug,
      address: [street, l.city].filter(Boolean).join(', '),
      list_price: l.list_price != null ? Number(l.list_price) : null,
      status: l.status,
      photo_url: `/api/photo/${l.id}/0`,
      lat: l.latitude != null ? Number(l.latitude) : NaN,
      lng: l.longitude != null ? Number(l.longitude) : NaN,
    };
  });
}

/** Optional person joining the tour: { name, email }. null when absent, false when invalid. */
export function cleanCoBuyer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 120) || null;
  const email = String(raw.email || '').trim().toLowerCase().slice(0, 255) || null;
  if (!name && !email) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return { name, email };
}

const publicPlan = (plan) => ({
  ...plan,
  stops: plan.stops.map(({ lat, lng, ...s }) => s),
});

/** POST /api/tours/plan */
export const previewTour = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const keys = cleanKeys(req.body?.listing_keys);
    if (!keys) return res.status(400).json({ success: false, error: `Pick between 1 and ${MAX_TOUR_HOMES} homes.` });
    const stops = await loadStops(getPool(), keys);
    if (!stops.length) return res.status(404).json({ success: false, error: 'Those homes are no longer available.' });
    return res.json({ success: true, data: publicPlan(planRoute(stops)) });
  } catch (error) {
    console.error('previewTour error:', error);
    return res.status(500).json({ success: false, error: 'Could not plan that tour.' });
  }
};

/** POST /api/tours */
export const requestTour = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const keys = cleanKeys(req.body?.listing_keys);
    if (!keys) return res.status(400).json({ success: false, error: `Pick between 1 and ${MAX_TOUR_HOMES} homes.` });
    const windows = cleanWindows(req.body?.windows);
    if (!windows) {
      return res.status(400).json({ success: false, error: `Pick 1 to ${MAX_WINDOWS} times in the next ${MAX_DAYS_AHEAD} days.` });
    }
    const phoneDigits = String(req.body?.phone || user.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({ success: false, error: 'Add a phone number so your agent can confirm the tour.' });
    }
    const note = String(req.body?.note || '').trim().slice(0, 1000) || null;
    const coBuyer = cleanCoBuyer(req.body?.co_buyer);
    if (coBuyer === false) return res.status(400).json({ success: false, error: 'Check the email of the person coming with you.' });

    const pool = getPool();
    const stops = await loadStops(pool, keys);
    if (!stops.length) return res.status(404).json({ success: false, error: 'Those homes are no longer available.' });
    const plan = planRoute(stops);
    const route = describeRoute(plan);

    if (!user.phone) await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [phoneDigits, user.id]);

    const windowText = windows.map((w) => `${w.date} ${DAY_PARTS[w.part].label}`).join('; ');
    const message = [
      `Tour request for ${plan.stops.length} home${plan.stops.length === 1 ? '' : 's'}, in driving order:`,
      route,
      `Estimated ${plan.total_minutes} minutes including about ${plan.drive_minutes} minutes of driving.`,
      `Times that work: ${windowText}`,
      note ? `Note from the buyer: ${note}` : null,
      coBuyer ? `Coming along: ${[coBuyer.name, coBuyer.email].filter(Boolean).join(', ')}` : null,
    ].filter(Boolean).join('\n');
    const summary = `Tour of ${plan.stops.length} home${plan.stops.length === 1 ? '' : 's'}: ${plan.stops.map((s) => s.address.split(',')[0]).join(' → ')}`;

    const showing = await pool.query(
      `INSERT INTO showing_requests (name, email, phone, showing_date, showing_time, message, listing_slug, listing_address, source_page, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '/board/', $9) RETURNING id`,
      [user.name || user.email, user.email, phoneDigits, windows[0].date, windows[0].part, message,
        plan.stops[0].slug, summary.slice(0, 255), tenantIdOf(req)]
    );
    const { rows: [tour] } = await pool.query(
      `INSERT INTO tour_requests (tenant_id, user_id, household_id, listing_keys, windows, note, est_minutes, showing_request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
      [user.tenant_id || 1, user.id, user.household_id || null, plan.stops.map((s) => s.listing_key),
        JSON.stringify(windows), note, plan.total_minutes, showing.rows[0].id]
    );
    if (coBuyer) {
      await pool.query('UPDATE tour_requests SET co_buyer = $1::jsonb WHERE id = $2', [JSON.stringify(coBuyer), tour.id]).catch(() => {});
    }

    recordStreamEvent({
      type: 'tour_request',
      userId: user.id,
      meta: { tour_id: tour.id, homes: plan.stops.length, first_window: windows[0] },
    });
    reportLeadToBoard('tour request');
    forwardShowingRequestToFollowUpBoss({
      name: user.name || user.email,
      email: user.email,
      phone: phoneDigits,
      showing_date: windows[0].date,
      showing_time: DAY_PARTS[windows[0].part].label,
      message,
      listing_slug: plan.stops[0].slug,
      listing_address: summary,
    }).catch(() => {});
    import('../services/agentCockpit.js')
      .then(({ refreshLeadLifecycle }) => refreshLeadLifecycle(user.id, pool))
      .catch(() => {});
    // The agent hears about it right away (email, and a text once texting is set up).
    notifyAgent({
      client: user,
      kind: 'tour_request',
      title: `${user.name || user.email} asked for a tour`,
      lines: [summary, `Times that work: ${windowText}`, note ? `Note: ${note}` : null,
        coBuyer ? `Coming along: ${[coBuyer.name, coBuyer.email].filter(Boolean).join(', ')}` : null, `Phone: ${phoneDigits}`],
      dueNow: true,
      pool,
    }).catch(() => {});

    if (user.household_id) {
      const { rows: others } = await pool.query(
        "SELECT id FROM users WHERE household_id = $1 AND id <> $2 AND status = 'active'",
        [user.household_id, user.id]
      );
      const who = (user.name || '').trim().split(/\s+/)[0] || 'Your co-buyer';
      for (const o of others) {
        createNotification({
          userId: o.id,
          type: 'board',
          title: `${who} asked for a tour of ${plan.stops.length} home${plan.stops.length === 1 ? '' : 's'}`,
          body: windowText,
          link: '/board/',
          pool,
        }).catch(() => {});
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        id: tour.id,
        plan: publicPlan(plan),
        windows,
        calendar_url: `/api/tours/${tour.id}/calendar.ics`,
      },
    });
  } catch (error) {
    console.error('requestTour error:', error);
    const { phone } = brandFor(req.tenant);
    return res.status(500).json({
      success: false,
      error: phone
        ? `Could not send your tour request. Call ${phone} and we will set it up.`
        : 'Could not send your tour request. Please try again in a moment.',
    });
  }
};

/** GET /api/tours/:id/calendar.ics — the requester or anyone on their board. */
export const tourCalendarFile = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return unauthorized(res);
    const pool = getPool();
    const { rows: [tour] } = await pool.query('SELECT * FROM tour_requests WHERE id = $1', [Number(req.params.id) || 0]);
    const allowed = tour && (tour.user_id === user.id || (tour.household_id && tour.household_id === user.household_id));
    if (!allowed) return res.status(404).json({ success: false, error: 'Tour not found.' });
    const plan = planRoute(await loadStops(pool, tour.listing_keys));
    // Another brokerage's calendar file carries its own name and site.
    const home = isHomeTenant(req.tenant);
    const site = home ? SITE : siteUrlFor(req.tenant);
    const ics = home
      ? tourCalendar({ id: tour.id, plan, window: tour.windows[0], site: SITE })
      : tourCalendar({
        id: tour.id, plan, window: tour.windows[0], site, brandName: brandFor(req.tenant).name, uidHost: site.replace(/^https?:\/\//, ''),
      });
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${home ? 'saa-' : ''}home-tour-${tour.id}.ics"`);
    res.set('Cache-Control', 'private, no-store');
    return res.send(ics);
  } catch (error) {
    console.error('tourCalendarFile error:', error);
    return res.status(500).json({ success: false, error: 'Could not build the calendar file.' });
  }
};
