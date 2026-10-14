/**
 * Stay in touch after closing.
 *
 * When an agent marks a client closed they record the closing facts (address,
 * close date, price, optional birthday, and whether the client agreed to stay
 * in touch). From those, the client gets, each in the brokerage's brand:
 *
 *   anniversary  every year on the closing date: value estimate and change,
 *                equity estimate (when loan facts are on file), neighborhood
 *                sales and the agent's note
 *   neighbor     a similar home nearby sold or listed (capped per month)
 *   birthday     the agent's approved birthday note
 *   tax          property tax season note, in the brokerage's chosen month
 *   rate         the published 30-year average reached the client's target
 *                (off unless a rate source is set up)
 *
 * The client can stop any one kind from the email footer or My Home; the
 * agent can turn any kind off per client and preview each one. The daily job
 * runs from the hourly scheduler's 9am Mountain tick (or the cron endpoint).
 */
import getPool from '../config/database.js';
import { denverToday } from '../controllers/tourController.js';
import { tenantById } from './tenantContext.js';
import { listingScope } from './feeds.js';
import { brandFor, isHomeTenant } from './brand.js';
import { sendEmail, emailSiteUrl } from './emailer.js';
import { computeOurEstimate, upsertHomeProfile } from './sellerValueService.js';
import { openToken, withOpenPixel } from './subjectVariants.js';
import {
  STAY_LABELS, anniversaryEmail, neighborEmail, birthdayEmail, taxEmail, rateEmail, DEFAULT_BIRTHDAY_TEMPLATE,
} from './stayEmails.js';

export const STAY_KINDS = ['anniversary', 'neighbor', 'birthday', 'tax', 'rate'];
export { STAY_LABELS };
export const NEIGHBOR_MONTHLY_CAP = 2;
export const STAY_HOUR_DENVER = 9;
const ANNIVERSARY_GRACE_DAYS = 7; // a missed run still sends within a week
const BIRTHDAY_GRACE_DAYS = 2;
const RATE_CACHE_HOURS = 12;

const KIND_HELP = {
  anniversary: 'Once a year on the closing date: value, equity, neighborhood sales and your note.',
  neighbor: `When a similar home nearby sells or lists, up to ${NEIGHBOR_MONTHLY_CAP} a month.`,
  birthday: 'Your approved birthday note, on their birthday.',
  tax: 'A short heads-up when county value notices go out. No tax advice.',
  rate: 'When the average 30-year rate reaches the target they gave you.',
};
export { KIND_HELP };

// ------------------------------------------------------------- dates

const pad = (n) => String(n).padStart(2, '0');

/** Denver wall-clock hour for a Date. */
export function denverHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', hourCycle: 'h23' }).format(now));
}
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 'YYYY-MM-DD' of month/day in year y (Feb 29 falls back to Feb 28). */
export function dayInYear(y, month, day) {
  const last = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return `${y}-${pad(month)}-${pad(Math.min(day, last))}`;
}

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const ymdOf = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/** Next month/day on or after today, as 'YYYY-MM-DD'. */
export function nextOccurrence(month, day, today) {
  const y = Number(today.slice(0, 4));
  const thisYear = dayInYear(y, month, day);
  return thisYear >= today ? thisYear : dayInYear(y + 1, month, day);
}

// ------------------------------------------------------------- settings

/**
 * A brokerage's stay-in-touch settings (tenants.settings.stay_in_touch).
 * Tax season month: SAA defaults to May (Colorado notices); other brokerages
 * choose theirs, and the note is off until they do.
 */
export function staySettings(tenant) {
  const s = (tenant?.settings && tenant.settings.stay_in_touch) || {};
  const home = isHomeTenant(tenant);
  const month = Number(s.tax_month ?? (home ? 5 : NaN));
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  return {
    tax_enabled: validMonth && s.tax_enabled !== false,
    tax_month: validMonth ? month : null,
  };
}

/** Which kinds apply to a closing: an owner gets all; a client who sold gets the personal ones. */
export function kindsForClosing(closing) {
  return closing?.side === 'seller' ? ['birthday', 'rate'] : STAY_KINDS;
}

/** Years since the closing as of today (whole years). */
export function yearsOwned(closeDate, today) {
  const c = ymdOf(closeDate);
  let years = Number(today.slice(0, 4)) - Number(c.slice(0, 4));
  if (today.slice(5) < c.slice(5)) years -= 1;
  return Math.max(0, years);
}

/**
 * Pure: which kinds are due to send today, with the key that makes each send
 * happen once. Neighbor alerts are found separately (they need a home).
 * state: { prefs: {kind: {agent_off, client_off}}, sent: Set('kind:period'),
 *          settings, rate: {rate}|null, templateApproved }
 */
export function dueKinds(closing, today, state) {
  const out = [];
  if (!closing?.stay_in_touch) return out;
  const kinds = kindsForClosing(closing);
  const on = (k) => kinds.includes(k) && !state.prefs?.[k]?.agent_off && !state.prefs?.[k]?.client_off;
  const notSent = (k, period) => !state.sent?.has(`${k}:${period}`);
  const y = Number(today.slice(0, 4));
  const close = ymdOf(closing.close_date);
  const [cm, cd] = [Number(close.slice(5, 7)), Number(close.slice(8, 10))];

  if (on('anniversary')) {
    for (const year of [y, y - 1]) {
      const day = dayInYear(year, cm, cd);
      if (year > Number(close.slice(0, 4)) && today >= day && today <= addDays(day, ANNIVERSARY_GRACE_DAYS) && notSent('anniversary', String(year))) {
        out.push({ kind: 'anniversary', period: String(year), years: year - Number(close.slice(0, 4)) });
        break;
      }
    }
  }
  if (on('birthday') && closing.birthday_month && closing.birthday_day && state.templateApproved) {
    for (const year of [y, y - 1]) {
      const day = dayInYear(year, closing.birthday_month, closing.birthday_day);
      if (today >= day && today <= addDays(day, BIRTHDAY_GRACE_DAYS) && notSent('birthday', String(year))) {
        out.push({ kind: 'birthday', period: String(year) });
        break;
      }
    }
  }
  if (on('tax') && state.settings?.tax_enabled && Number(today.slice(5, 7)) === state.settings.tax_month
    && close < dayInYear(y, state.settings.tax_month, 1) && notSent('tax', String(y))) {
    out.push({ kind: 'tax', period: String(y) });
  }
  const target = closing.target_rate != null ? Number(closing.target_rate) : null;
  if (on('rate') && target && state.rate?.rate != null && Number(state.rate.rate) <= target
    && notSent('rate', `target-${target.toFixed(3)}`)) {
    out.push({ kind: 'rate', period: `target-${target.toFixed(3)}` });
  }
  return out;
}

/**
 * Pure: what each kind will do next for one client, for the agent's list and
 * the client's settings. Each item: { kind, label, status, next_on, detail }.
 * status: scheduled | watching | off_by_agent | off_by_client | not_set_up | no_consent
 */
export function planFor(closing, today, state) {
  const kinds = kindsForClosing(closing);
  const close = ymdOf(closing.close_date);
  const [cm, cd] = [Number(close.slice(5, 7)), Number(close.slice(8, 10))];
  const lastSent = state.lastSent || {};
  return STAY_KINDS.filter((k) => kinds.includes(k)).map((kind) => {
    const item = { kind, label: STAY_LABELS[kind], help: KIND_HELP[kind], status: 'scheduled', next_on: null, detail: null, last_sent_at: lastSent[kind] || null };
    const pref = state.prefs?.[kind] || {};
    if (!closing.stay_in_touch) return { ...item, status: 'no_consent', detail: 'They have not agreed to stay in touch.' };
    if (pref.agent_off) return { ...item, status: 'off_by_agent', detail: 'You turned this off.' };
    if (pref.client_off) return { ...item, status: 'off_by_client', detail: 'They unsubscribed from this one.' };
    if (kind === 'anniversary') {
      let next = nextOccurrence(cm, cd, today);
      if (next.slice(0, 4) === close.slice(0, 4)) next = dayInYear(Number(close.slice(0, 4)) + 1, cm, cd);
      if (state.sent?.has(`anniversary:${next.slice(0, 4)}`)) next = dayInYear(Number(next.slice(0, 4)) + 1, cm, cd);
      const years = Number(next.slice(0, 4)) - Number(close.slice(0, 4));
      return { ...item, next_on: next, detail: `${years === 1 ? 'First' : `Year ${years}`} report` };
    }
    if (kind === 'birthday') {
      if (!closing.birthday_month || !closing.birthday_day) return { ...item, status: 'not_set_up', detail: 'No birthday on file.' };
      if (!state.templateApproved) return { ...item, status: 'not_set_up', detail: 'Approve your birthday note to start.' };
      let next = nextOccurrence(closing.birthday_month, closing.birthday_day, today);
      if (state.sent?.has(`birthday:${next.slice(0, 4)}`)) next = dayInYear(Number(next.slice(0, 4)) + 1, closing.birthday_month, closing.birthday_day);
      return { ...item, next_on: next };
    }
    if (kind === 'tax') {
      if (!state.settings?.tax_enabled) return { ...item, status: 'not_set_up', detail: 'Your brokerage has not picked a tax season month.' };
      let next = nextOccurrence(state.settings.tax_month, 1, today);
      if (state.sent?.has(`tax:${today.slice(0, 4)}`) && next.slice(0, 4) === today.slice(0, 4)) next = dayInYear(Number(today.slice(0, 4)) + 1, state.settings.tax_month, 1);
      if (Number(today.slice(5, 7)) === state.settings.tax_month && !state.sent?.has(`tax:${today.slice(0, 4)}`)) next = today;
      return { ...item, next_on: next };
    }
    if (kind === 'neighbor') {
      const n = state.neighborThisMonth || 0;
      return { ...item, status: 'watching', detail: `${n} of ${NEIGHBOR_MONTHLY_CAP} sent this month` };
    }
    // rate
    if (closing.target_rate == null) return { ...item, status: 'not_set_up', detail: 'No target rate yet.' };
    if (!state.rate) return { ...item, status: 'not_set_up', detail: 'No rate source connected.' };
    return {
      ...item,
      status: 'watching',
      detail: `Target ${Number(closing.target_rate).toFixed(2)}% · now ${Number(state.rate.rate).toFixed(2)}%`,
    };
  });
}

// ------------------------------------------------------------- rate source

/**
 * The latest published average 30-year fixed rate, or null when no source is
 * set up. FRED (series MORTGAGE30US, the Freddie Mac weekly survey) when
 * FRED_API_KEY is set; otherwise MORTGAGE_RATE_SOURCE_URL, a JSON endpoint
 * answering { rate, as_of }. Cached for 12 hours in app_settings.
 */
export function rateSourceConfigured() {
  return !!(process.env.FRED_API_KEY || process.env.MORTGAGE_RATE_SOURCE_URL);
}

export async function latestMortgageRate({ pool = getPool(), fetchImpl = fetch, now = new Date() } = {}) {
  if (!rateSourceConfigured()) return null;
  try {
    const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'mortgage_rate_latest'");
    const cached = rows[0]?.value;
    if (cached?.fetched_at && now - new Date(cached.fetched_at) < RATE_CACHE_HOURS * 3600000) return cached;
    let rate = null;
    let asOf = null;
    let source = null;
    if (process.env.FRED_API_KEY) {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&sort_order=desc&limit=1&file_type=json&api_key=${encodeURIComponent(process.env.FRED_API_KEY)}`;
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
      const d = await res.json();
      const obs = d?.observations?.[0];
      rate = obs ? Number(obs.value) : null;
      asOf = obs?.date || null;
      source = 'Freddie Mac weekly average, via FRED';
    } else {
      const res = await fetchImpl(process.env.MORTGAGE_RATE_SOURCE_URL, { signal: AbortSignal.timeout(8000) });
      const d = await res.json();
      rate = Number(d?.rate ?? d?.value ?? d?.['30yr']);
      asOf = d?.as_of || d?.date || null;
      source = d?.source ? String(d.source).slice(0, 80) : null;
    }
    if (!Number.isFinite(rate) || rate <= 0 || rate > 25) return cached || null;
    const value = { rate, as_of: asOf, source, fetched_at: now.toISOString() };
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ('mortgage_rate_latest', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(value)]
    );
    return value;
  } catch (e) {
    console.warn('[stay] rate source failed:', e.message);
    return null;
  }
}

// ------------------------------------------------------------- prefs + closings

/** { kind: { agent_off, client_off } } for one client. */
export async function loadPrefs(pool, userId) {
  const { rows } = await pool.query('SELECT kind, agent_off, client_off FROM stay_touch_prefs WHERE user_id = $1', [userId]);
  return Object.fromEntries(rows.map((r) => [r.kind, { agent_off: r.agent_off, client_off: r.client_off }]));
}

/** Turn one kind on or off for a client, as the agent or as the client. */
export async function setStayPref(pool, { tenantId, userId, kind, by, off }) {
  if (!STAY_KINDS.includes(kind)) throw Object.assign(new Error('Unknown email type.'), { status: 400 });
  const col = by === 'agent' ? 'agent_off' : 'client_off';
  await pool.query(
    `INSERT INTO stay_touch_prefs (tenant_id, user_id, kind, ${col}) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, kind) DO UPDATE SET ${col} = EXCLUDED.${col}, updated_at = NOW()`,
    [tenantId, userId, kind, !!off]
  );
  return loadPrefs(pool, userId);
}

const intOrNull = (v, min, max) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(String(v).replace(/[$,\s]/g, '')));
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const numOrNull = (v, min, max) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const str = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/** Validate closing facts from a request body. Returns { facts } or { error }. */
export function cleanClosingFacts(body = {}, today = denverToday()) {
  const address_line = str(body.address_line ?? body.address, 255);
  if (!address_line) return { error: 'Add the address of the home.' };
  const close_date = String(body.close_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(close_date) || Number.isNaN(Date.parse(`${close_date}T12:00:00Z`))) {
    return { error: 'Add the closing date.' };
  }
  if (close_date > addDays(today, 90)) return { error: 'The closing date looks too far ahead.' };
  const close_price = intOrNull(body.close_price, 1000, 100000000);
  const loan_amount = intOrNull(body.loan_amount, 0, 100000000);
  const loan_rate = numOrNull(body.loan_rate, 0, 25);
  const loan_years = intOrNull(body.loan_years, 5, 40);
  const target_rate = numOrNull(body.target_rate, 0.5, 25);
  if ([close_price, loan_amount, loan_rate, loan_years, target_rate].includes(undefined)) {
    return { error: 'Check the price, loan and rate numbers.' };
  }
  let birthday_month = null;
  let birthday_day = null;
  if (body.birthday) {
    const m = String(body.birthday).match(/^(?:\d{4}-)?(\d{1,2})-(\d{1,2})$/);
    if (!m) return { error: 'Birthday should be a month and day.' };
    birthday_month = Number(m[1]);
    birthday_day = Number(m[2]);
    if (birthday_month < 1 || birthday_month > 12 || birthday_day < 1 || birthday_day > Number(dayInYear(2024, birthday_month, 31).slice(8))) {
      return { error: 'Birthday should be a real month and day.' };
    }
  }
  return {
    facts: {
      side: body.side === 'seller' ? 'seller' : 'buyer',
      address_line,
      city: str(body.city, 100),
      state: str(body.state, 2)?.toUpperCase() || null,
      postal_code: str(body.postal_code ?? body.zip, 16),
      close_date,
      close_price,
      loan_amount,
      loan_rate,
      loan_years,
      birthday_month,
      birthday_day,
      stay_in_touch: body.stay_in_touch === true,
      target_rate,
      agent_note: str(body.agent_note, 2000),
    },
  };
}

/**
 * Save closing facts for a client (one record per client; saving again
 * updates it). A buyer's new home is added to their My Home. Consent to stay
 * in touch is logged in contact_consents.
 */
export async function saveClosing(pool, { client, agentId, facts }) {
  const { rows: [prev] } = await pool.query('SELECT * FROM client_closings WHERE user_id = $1', [client.id]);
  let homeProfileId = prev?.home_profile_id || null;
  if (facts.side === 'buyer') {
    try {
      const profile = await upsertHomeProfile(client.id, {
        ...(homeProfileId ? { id: homeProfileId } : {}),
        address_line: facts.address_line,
        city: facts.city,
        state: facts.state || undefined,
        postal_code: facts.postal_code,
      }, pool);
      homeProfileId = profile?.id || homeProfileId;
    } catch (e) {
      if (e.status !== 404) throw e;
      const profile = await upsertHomeProfile(client.id, {
        address_line: facts.address_line, city: facts.city, state: facts.state || undefined, postal_code: facts.postal_code,
      }, pool);
      homeProfileId = profile?.id || null;
    }
  }
  const cols = Object.keys(facts);
  const vals = cols.map((c) => facts[c]);
  const { rows: [saved] } = await pool.query(
    `INSERT INTO client_closings (tenant_id, user_id, agent_id, home_profile_id, consent_at, ${cols.join(', ')})
     VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN NOW() END, ${cols.map((_, i) => `$${i + 6}`).join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET
       agent_id = COALESCE(EXCLUDED.agent_id, client_closings.agent_id),
       home_profile_id = EXCLUDED.home_profile_id,
       consent_at = CASE WHEN EXCLUDED.stay_in_touch AND NOT client_closings.stay_in_touch THEN NOW()
                         WHEN NOT EXCLUDED.stay_in_touch THEN NULL ELSE client_closings.consent_at END,
       ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')},
       updated_at = NOW()
     RETURNING *`,
    [client.tenant_id, client.id, agentId || null, homeProfileId, facts.stay_in_touch, ...vals]
  );
  if (!!prev?.stay_in_touch !== facts.stay_in_touch) {
    await pool.query(
      `INSERT INTO contact_consents (tenant_id, user_id, channel, status, wording, source)
       VALUES ($1, $2, 'email', $3, $4, 'closing_facts')`,
      [client.tenant_id, client.id, facts.stay_in_touch ? 'granted' : 'revoked',
        'Agreed with their agent at closing to get occasional stay-in-touch emails (home anniversary, nearby sales, birthday, tax season, rate watch).']
    ).catch(() => {});
  }
  return saved;
}

/** Remaining loan balance after `months` payments (standard amortization). */
export function loanBalance(principal, ratePct, years, months) {
  const P = Number(principal);
  const n = Math.round(Number(years) * 12);
  if (!(P > 0) || !(n > 0)) return null;
  const k = Math.min(Math.max(0, months), n);
  const r = Number(ratePct) / 100 / 12;
  if (!(r > 0)) return Math.max(0, P - (P / n) * k);
  const pmt = (P * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  return Math.max(0, P * (1 + r) ** k - pmt * (((1 + r) ** k - 1) / r));
}

const monthsBetween = (fromYmd, toYmd) => {
  const [fy, fm] = [Number(fromYmd.slice(0, 4)), Number(fromYmd.slice(5, 7))];
  const [ty, tm] = [Number(toYmd.slice(0, 4)), Number(toYmd.slice(5, 7))];
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
};

function streetOf(row) {
  return row.address || [row.street_number, row.street_name, row.unit ? `#${row.unit}` : null].filter(Boolean).join(' ');
}

/** Sales in the client's ZIP (or city) over the last 12 months. */
export async function neighborhoodSales(pool, closing, today) {
  const since = addDays(today, -365);
  const byZip = !!closing.postal_code;
  const where = byZip ? 'postal_code = $1' : 'LOWER(city) = LOWER($1)';
  const key = byZip ? closing.postal_code : closing.city;
  if (!key) return { count: 0 };
  // Only sold data this brokerage's MLS lets it show.
  const { soldFeeds } = await listingScope(closing.tenant_id, { pool });
  const { rows: [agg] } = await pool.query(
    `SELECT COUNT(*)::int AS n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS median
     FROM sold_listings WHERE ${where} AND closed_date >= $2 AND sold_price > 0 AND feed = ANY($3::text[])`,
    [key, since, soldFeeds]
  );
  const { rows: recent } = await pool.query(
    `SELECT address, street_number, street_name, unit, sold_price, closed_date FROM sold_listings
     WHERE ${where} AND closed_date >= $2 AND sold_price > 0 AND feed = ANY($3::text[])
     ORDER BY closed_date DESC LIMIT 3`,
    [key, since, soldFeeds]
  );
  return {
    area: byZip ? `ZIP ${closing.postal_code}` : closing.city,
    count: agg?.n || 0,
    median: agg?.median != null ? Math.round(Number(agg.median)) : null,
    recent: recent.map((r) => ({ address: streetOf(r), price: Number(r.sold_price), date: ymdOf(r.closed_date) })),
  };
}

/** The anniversary report's numbers for one closing. */
export async function anniversaryData(pool, closing, today, years) {
  let profile = null;
  if (closing.home_profile_id) {
    const { rows } = await pool.query('SELECT * FROM home_profiles WHERE id = $1 AND user_id = $2', [closing.home_profile_id, closing.user_id]);
    profile = rows[0] || null;
  }
  const est = await computeOurEstimate(profile || closing, pool).catch(() => null);
  const value = est?.mid != null ? { low: est.low, mid: est.mid, high: est.high } : null;
  let equity = null;
  if (value && closing.loan_amount && closing.loan_rate != null && closing.loan_years) {
    const bal = loanBalance(closing.loan_amount, closing.loan_rate, closing.loan_years, monthsBetween(ymdOf(closing.close_date), today));
    if (bal != null) equity = Math.round(value.mid - bal);
  }
  return {
    years,
    value,
    closePrice: closing.close_price ? Number(closing.close_price) : null,
    equity,
    sales: await neighborhoodSales(pool, closing, today),
    note: closing.agent_note || null,
  };
}

/**
 * A similar nearby home that sold in the last 30 days or listed in the last
 * 14, not yet sent to this client. Similar: same ZIP (or city), beds within
 * one and size within 30% when those are known.
 */
export async function findNeighborHome(pool, closing, profile, sentKeys, today) {
  const zip = closing.postal_code || profile?.postal_code;
  const city = closing.city || profile?.city;
  if (!zip && !city) return null;
  const beds = profile?.beds != null ? Number(profile.beds) : null;
  const sqft = profile?.living_area != null ? Number(profile.living_area) : null;
  const ownStreet = String(closing.address_line || '').toLowerCase().split(/\s+/).slice(0, 2).join(' ');
  const similar = (r) => (beds == null || r.beds == null || Math.abs(Number(r.beds) - beds) <= 1)
    && (sqft == null || r.living_area == null || Math.abs(Number(r.living_area) - sqft) <= sqft * 0.3)
    && !(ownStreet && streetOf(r).toLowerCase().startsWith(ownStreet))
    && !sentKeys.has(String(r.listing_id));
  const where = zip ? 'postal_code = $1' : 'LOWER(city) = LOWER($1)';
  const { feeds, soldFeeds } = await listingScope(closing.tenant_id, { pool });
  const { rows: sold } = await pool.query(
    `SELECT listing_id, address, street_number, street_name, unit, beds, baths, living_area, sold_price, closed_date
     FROM sold_listings WHERE ${where} AND closed_date >= $2 AND sold_price > 0 AND feed = ANY($3::text[])
     ORDER BY closed_date DESC LIMIT 25`,
    [zip || city, addDays(today, -30), soldFeeds]
  );
  const s = sold.find(similar);
  if (s) {
    return { listing_id: String(s.listing_id), sold: true, address: streetOf(s), price: Number(s.sold_price), beds: s.beds, baths: s.baths, sqft: s.living_area != null ? Number(s.living_area) : null, date: ymdOf(s.closed_date) };
  }
  const { rows: listed } = await pool.query(
    `SELECT listing_id, street_number, street_name, unit, beds, baths, living_area, list_price, created_at
     FROM listings WHERE ${where} AND status = 'Active' AND is_active = TRUE AND list_price > 0
       AND (created_at >= $2::date OR days_on_market <= 14) AND feed = ANY($3::text[])
     ORDER BY created_at DESC LIMIT 25`,
    [zip || city, addDays(today, -14), feeds]
  );
  const l = listed.find(similar);
  if (l) {
    return { listing_id: String(l.listing_id), sold: false, address: streetOf(l), price: Number(l.list_price), beds: l.beds, baths: l.baths, sqft: l.living_area != null ? Number(l.living_area) : null, date: ymdOf(l.created_at || today) };
  }
  return null;
}

/** The agent's birthday template (approved or not); the default when none saved. */
export async function birthdayTemplate(pool, agentId) {
  if (agentId) {
    const { rows } = await pool.query("SELECT subject, body, approved_at FROM stay_touch_templates WHERE agent_id = $1 AND kind = 'birthday'", [agentId]);
    if (rows[0]) return { ...rows[0], approved: !!rows[0].approved_at, is_default: false };
  }
  return { ...DEFAULT_BIRTHDAY_TEMPLATE, approved_at: null, approved: false, is_default: true };
}

/** The agent on a closing (its agent, else the client's assigned agent), same brokerage only. */
async function closingAgent(pool, closing, client) {
  const id = closing.agent_id || client.assigned_agent_id;
  if (!id) return null;
  const { rows } = await pool.query(
    "SELECT id, name, email, phone FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin')",
    [id, client.tenant_id]
  );
  return rows[0] || null;
}

/** Everything an email needs about the sender and links. */
async function emailContext(pool, closing, client) {
  const tenant = await tenantById(client.tenant_id, { pool });
  const agent = await closingAgent(pool, closing, client);
  const brand = brandFor(tenant, { agent });
  const site = emailSiteUrl(tenant);
  const token = encodeURIComponent(client.manage_token || '');
  return {
    tenant,
    agent,
    brand,
    site,
    firstName: String(client.name || '').trim().split(/\s+/)[0] || '',
    address: [closing.address_line, closing.city].filter(Boolean).join(', '),
    myHomeUrl: `${site}/my-home/?token=${token}`,
    manageUrl: `${site}/my-home/?token=${token}#emails`,
    unsub: (kind) => `${site}/my-home/?token=${token}&stop=${kind}`,
  };
}

/**
 * Build one kind's email for a client. Returns { subject, html, meta } or
 * { skip: reason } when there is nothing honest to send (e.g. no nearby home).
 */
export async function buildStayEmail(pool, { closing, client, kind, today = denverToday(), years, rate, sentNeighborKeys = new Set(), preview = false }) {
  const ctx = await emailContext(pool, closing, client);
  const common = { brand: ctx.brand, site: ctx.site, firstName: ctx.firstName, agent: ctx.agent, unsubscribeUrl: ctx.unsub(kind), manageUrl: ctx.manageUrl };
  if (kind === 'anniversary') {
    const y = years || Math.max(1, yearsOwned(closing.close_date, today) || 1);
    const data = await anniversaryData(pool, closing, today, y);
    return { ...anniversaryEmail({ ...common, address: ctx.address, data, myHomeUrl: ctx.myHomeUrl }), ctx };
  }
  if (kind === 'neighbor') {
    let profile = null;
    if (closing.home_profile_id) {
      ({ rows: [profile] } = await pool.query('SELECT * FROM home_profiles WHERE id = $1', [closing.home_profile_id]));
    }
    let home = await findNeighborHome(pool, closing, profile, sentNeighborKeys, today);
    if (!home && preview) {
      home = { listing_id: 'preview', sold: true, address: 'A similar home nearby', price: closing.close_price || 500000, beds: profile?.beds, baths: profile?.baths, sqft: profile?.living_area, date: today };
    }
    if (!home) return { skip: 'no_nearby_home' };
    return { ...neighborEmail({ ...common, home, myHomeUrl: ctx.myHomeUrl }), meta: { listing_id: home.listing_id }, ctx };
  }
  if (kind === 'birthday') {
    const template = await birthdayTemplate(pool, ctx.agent?.id);
    if (!template.approved && !preview) return { skip: 'template_not_approved' };
    return { ...birthdayEmail({ ...common, template }), ctx };
  }
  if (kind === 'tax') {
    return { ...taxEmail({ ...common, address: ctx.address, myHomeUrl: ctx.myHomeUrl }), ctx };
  }
  if (kind === 'rate') {
    const r = rate || (preview ? { rate: closing.target_rate || 6, as_of: today, source: null } : null);
    if (!r || closing.target_rate == null) {
      if (!preview) return { skip: 'no_rate' };
    }
    return {
      ...rateEmail({
        ...common, rate: r.rate, target: closing.target_rate ?? r.rate, asOf: r.as_of, sourceLabel: r.source, myHomeUrl: ctx.myHomeUrl,
      }),
      ctx,
    };
  }
  return { skip: 'unknown_kind' };
}

/**
 * Claim and send one email. The claim row (unique per client, kind and
 * period) is written first, so two runs can never send the same email twice.
 */
async function deliverStay(pool, { client, kind, period, built, send, now = new Date() }) {
  const claim = await pool.query(
    `INSERT INTO stay_touch_sends (tenant_id, user_id, kind, period_key, subject, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, kind, period_key) DO NOTHING RETURNING id`,
    [client.tenant_id, client.id, kind, String(period).slice(0, 40), built.subject, now]
  );
  if (!claim.rows.length) return false;
  const tok = openToken();
  const html = withOpenPixel(built.html, built.ctx.site, tok);
  const fromName = built.ctx.brand.from_name || built.ctx.brand.name;
  const replyTo = built.ctx.agent?.email || built.ctx.brand.reply_to || built.ctx.brand.email || undefined;
  try {
    await send(client.email, built.subject, html, fromName, { tenantId: client.tenant_id, replyTo });
  } catch {
    await pool.query(
      'INSERT INTO email_outbox (to_email, subject, html, tenant_id, user_id, notification_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [client.email, built.subject, html, client.tenant_id, client.id, `stay_${kind}`]
    );
  }
  await pool.query('UPDATE stay_touch_sends SET open_token = $1 WHERE id = $2', [tok, claim.rows[0].id]);
  await pool.query(
    `INSERT INTO email_log (user_id, type, to_email, subject, events, open_token, tenant_id)
     VALUES ($1, $2, $3, $4, 0, $5, $6)`,
    [client.id, `stay_${kind}`, client.email, built.subject, tok, client.tenant_id]
  ).catch(() => {});
  return true;
}

/** Per-client state the pure planners need. */
export async function clientState(pool, closing, client, { today = denverToday(), rate = undefined } = {}) {
  const prefs = await loadPrefs(pool, client.id);
  const { rows: sends } = await pool.query(
    'SELECT kind, period_key, sent_at FROM stay_touch_sends WHERE user_id = $1 ORDER BY sent_at DESC',
    [client.id]
  );
  const sent = new Set(sends.map((s) => `${s.kind}:${s.period_key}`));
  const lastSent = {};
  for (const s of sends) if (!lastSent[s.kind]) lastSent[s.kind] = s.sent_at;
  const monthStart = `${today.slice(0, 7)}-01`;
  const neighborThisMonth = sends.filter((s) => s.kind === 'neighbor' && denverToday(new Date(s.sent_at)) >= monthStart).length;
  const neighborKeys = new Set(sends.filter((s) => s.kind === 'neighbor').map((s) => s.period_key));
  const tenant = await tenantById(client.tenant_id, { pool });
  const agentId = closing.agent_id || client.assigned_agent_id;
  const template = await birthdayTemplate(pool, agentId);
  return {
    prefs,
    sent,
    lastSent,
    neighborThisMonth,
    neighborKeys,
    settings: staySettings(tenant),
    rate: rate === undefined ? await latestMortgageRate({ pool }) : rate,
    templateApproved: template.approved,
  };
}

/**
 * The daily pass. Acts on the 9am Mountain tick unless forced. Sends what is
 * due for every past client who agreed to stay in touch, and refreshes
 * seller-intent scores. send: (to, subject, html, fromName, opts) for tests.
 */
export async function runStayInTouch({ now = new Date(), force = false, send = sendEmail, pool = getPool(), rate, fubPush } = {}) {
  if (!force && denverHour(now) !== STAY_HOUR_DENVER) return { skipped: 'not_stay_hour', sent: 0 };
  const today = denverToday(now);
  const latest = rate === undefined ? await latestMortgageRate({ pool, now }) : rate;
  const { rows: closings } = await pool.query(
    `SELECT c.*, u.email, u.name, u.manage_token, u.assigned_agent_id, u.status AS user_status
     FROM client_closings c JOIN users u ON u.id = c.user_id AND u.tenant_id = c.tenant_id
     WHERE c.stay_in_touch = TRUE AND u.status = 'active' AND u.email IS NOT NULL
     ORDER BY c.id`
  );
  const result = { sent: 0, by_kind: {}, skipped: 0, date: today };
  for (const row of closings) {
    const client = { id: row.user_id, tenant_id: row.tenant_id, email: row.email, name: row.name, manage_token: row.manage_token, assigned_agent_id: row.assigned_agent_id };
    try {
      const state = await clientState(pool, row, client, { today, rate: latest });
      const due = dueKinds(row, today, state);
      const neighborOn = kindsForClosing(row).includes('neighbor') && !state.prefs.neighbor?.agent_off && !state.prefs.neighbor?.client_off;
      if (neighborOn && state.neighborThisMonth < NEIGHBOR_MONTHLY_CAP) due.push({ kind: 'neighbor' });
      for (const d of due) {
        const built = await buildStayEmail(pool, { closing: row, client, kind: d.kind, today, years: d.years, rate: latest, sentNeighborKeys: state.neighborKeys });
        if (built.skip) {
          result.skipped += 1;
          continue;
        }
        const period = d.kind === 'neighbor' ? built.meta.listing_id : d.period;
        if (await deliverStay(pool, { client, kind: d.kind, period, built, send, now })) {
          result.sent += 1;
          result.by_kind[d.kind] = (result.by_kind[d.kind] || 0) + 1;
        }
      }
    } catch (e) {
      result.skipped += 1;
      console.error('[stay] client', row.user_id, 'failed:', e.message);
    }
  }
  try {
    const { refreshAllSellerIntent } = await import('./sellerSignals.js');
    result.signals = await refreshAllSellerIntent({ pool, now, fubPush });
  } catch (e) {
    console.error('[stay] seller signals failed:', e.message);
  }
  return result;
}
