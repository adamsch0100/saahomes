/**
 * Follow Up Boss, the way buyers' agents already work: FUB owns contacts and
 * who they're assigned to; we add what we know. Only the public API
 * (https://docs.followupboss.com) is used:
 *
 * - Tags and custom fields on a person: PUT /v1/people/{id}?mergeTags=true
 *   ("Active searcher", "Hot: 3+ views"), so existing tags are kept.
 * - A note on the person (POST /v1/notes) the first time a buyer views the
 *   same home three times (once per home per person, fub_view_notes).
 * - A contact added in FUB gets home alerts automatically: when a brokerage
 *   connects its key we register a peopleCreated webhook (POST /v1/webhooks,
 *   which needs a registered system: FUB_SYSTEM_NAME / FUB_SYSTEM_KEY). Each
 *   delivery is checked against FUB-Signature (HMAC-SHA256 of the base64 of
 *   the raw body, keyed with the system key), the person is fetched, and a
 *   starter saved search is created with a welcome email in the brokerage's
 *   brand.
 *
 * FUB's limits are a sliding 10-second window (some contexts, like notes,
 * allow 10). Calls per API key go one at a time with a small gap, and a 429
 * waits for Retry-After. Nothing here is ever awaited by a buyer's request.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  DEFAULT_TENANT_ID, clearTenantCache, tenantById, runWithTenant,
} from './tenantContext.js';
import { sanitizeSavedFilters, savedSearchPath } from './listingFilters.js';
import { recordEvent } from './events.js';

const FUB_API = 'https://api.followupboss.com/v1';
const MIN_GAP_MS = 250;
const MAX_RETRY_WAIT_MS = 10000;
const TIMEOUT_MS = 10000;
export const TAG_ACTIVE_SEARCHER = 'Active searcher';
export const TAG_HOT_VIEWS = 'Hot: 3+ views';
export const REPEAT_VIEW_THRESHOLD = 3;

export const fubSystem = () => {
  const name = String(process.env.FUB_SYSTEM_NAME || '').trim();
  const key = String(process.env.FUB_SYSTEM_KEY || '').trim();
  return name && key ? { name, key } : null;
};

const basic = (apiKey) => `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const queues = new Map(); // api key hash → { tail, last }

/** One FUB API call, serialized per key, honoring 429 Retry-After. */
export async function fubFetch(apiKey, method, path, body) {
  const id = crypto.createHash('sha256').update(String(apiKey)).digest('hex').slice(0, 16);
  const q = queues.get(id) || { tail: Promise.resolve(), last: 0 };
  queues.set(id, q);
  const run = async () => {
    const wait = q.last + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    const system = fubSystem();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      q.last = Date.now();
      const res = await fetch(`${FUB_API}${path}`, {
        method,
        headers: {
          Authorization: basic(apiKey),
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(system ? { 'X-System': system.name, 'X-System-Key': system.key } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 && attempt < 2) {
        const after = Number(res.headers.get('retry-after'));
        await sleep(Math.min(MAX_RETRY_WAIT_MS, Number.isFinite(after) && after > 0 ? after * 1000 : 2000));
        continue;
      }
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) {
        const err = new Error(`Follow Up Boss returned ${res.status}`);
        err.status = res.status;
        err.body = text?.slice?.(0, 300);
        throw err;
      }
      return data;
    }
    throw new Error('Follow Up Boss is busy');
  };
  const p = q.tail.then(run, run);
  q.tail = p.catch(() => {});
  return p;
}

/** The FUB key a tenant's contacts live under (its own key; SAA's env key). */
async function keyFor(tenantId, { agentUserId, email } = {}) {
  const { fubRouteFor } = await import('./followUpBossService.js');
  const route = await fubRouteFor({ tenantId, agentUserId, email });
  return route?.key || null;
}

/** Add tags (kept alongside existing ones) and optional custom fields to a FUB person. */
export async function tagFubPerson(apiKey, personId, tags = [], customFields = {}) {
  const fields = {};
  for (const [k, v] of Object.entries(customFields || {})) {
    if (/^custom[A-Za-z0-9]+$/.test(k) && v !== undefined && v !== null && v !== '') fields[k] = v;
  }
  if (!tags.length && !Object.keys(fields).length) return null;
  return fubFetch(apiKey, 'PUT', `/people/${Number(personId)}?mergeTags=true`, {
    ...(tags.length ? { tags } : {}),
    ...fields,
  });
}

const fmtPrice = (n) => (n == null ? null : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

/**
 * A buyer viewed the same home for the third time (or more): note it on
 * their FUB person and tag them "Hot: 3+ views", once per home per person.
 * Skips quietly until FUB is connected and the person is linked.
 */
export async function noteRepeatHomeView(userId, listingId, viewCount, { pool = getPool() } = {}) {
  if (viewCount < REPEAT_VIEW_THRESHOLD) return { skipped: 'below_threshold' };
  const { rows: [u] } = await pool.query(
    'SELECT id, email, name, fub_person_id, tenant_id, assigned_agent_id FROM users WHERE id = $1',
    [userId]
  );
  if (!u?.fub_person_id) return { skipped: 'not_linked' };
  const apiKey = await keyFor(u.tenant_id, { agentUserId: u.assigned_agent_id, email: u.email });
  if (!apiKey) return { skipped: 'not_configured' };

  const claim = await pool.query(
    `INSERT INTO fub_view_notes (tenant_id, user_id, listing_id) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, listing_id) DO NOTHING RETURNING user_id`,
    [u.tenant_id, u.id, String(listingId)]
  );
  if (!claim.rows[0]) return { skipped: 'already_noted' };

  try {
    const { rows: [l] } = await pool.query(
      `SELECT listing_id, slug, street_number, street_name, unit, city, list_price, beds, baths
       FROM listings WHERE listing_id = $1 LIMIT 1`,
      [String(listingId)]
    );
    const tenant = await tenantById(u.tenant_id, { pool });
    const { brandFor } = await import('./brand.js');
    const brand = brandFor(tenant);
    const street = l ? [l.street_number, l.street_name, l.unit ? `#${l.unit}` : null].filter(Boolean).join(' ') : '';
    const where = l ? [street, l.city].filter(Boolean).join(', ') : `listing ${listingId}`;
    const facts = l ? [fmtPrice(l.list_price), l.beds != null ? `${l.beds} bd` : null, l.baths != null ? `${l.baths} ba` : null].filter(Boolean).join(' · ') : '';
    const url = l?.slug ? `${brand.site_url.replace(/\/$/, '')}/homes-for-sale/${l.slug}/` : null;
    const first = String(u.name || '').trim().split(/\s+/)[0] || 'This buyer';
    await fubFetch(apiKey, 'POST', '/notes', {
      personId: Number(u.fub_person_id),
      subject: `Viewed the same home ${viewCount} times`,
      body: [
        `${first} has looked at ${where} ${viewCount} times on ${brand.name}'s site.`,
        facts || null,
        url,
        'A good moment to reach out.',
      ].filter(Boolean).join('\n'),
      isHtml: false,
    });
    await tagFubPerson(apiKey, u.fub_person_id, [TAG_HOT_VIEWS]).catch((e) => {
      logger.warn('FUB hot tag failed', { message: e.message });
    });
    logger.info('FUB repeat-view note added', { user_id: u.id, listing_id: listingId });
    return { ok: true };
  } catch (e) {
    // Let a later view try again.
    await pool.query('DELETE FROM fub_view_notes WHERE user_id = $1 AND listing_id = $2', [u.id, String(listingId)]).catch(() => {});
    logger.warn('FUB repeat-view note failed', { message: e.message, status: e.status });
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------- webhooks

/** FUB-Signature check: hex HMAC-SHA256 of base64(raw body), keyed with the system key. */
export function verifyFubSignature(rawBody, signature, systemKey = fubSystem()?.key) {
  if (!systemKey || !signature) return false;
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  const expected = crypto.createHmac('sha256', systemKey).update(raw.toString('base64')).digest('hex');
  const got = Buffer.from(String(signature).trim().toLowerCase(), 'utf8');
  const exp = Buffer.from(expected, 'utf8');
  return got.length === exp.length && crypto.timingSafeEqual(got, exp);
}

/** Sign a body as FUB does (tests and local tools). */
export function signFubPayload(rawBody, systemKey) {
  return crypto.createHmac('sha256', systemKey).update(Buffer.from(String(rawBody), 'utf8').toString('base64')).digest('hex');
}

function webhookBase() {
  return String(process.env.PUBLIC_API_URL || process.env.SITE_URL || 'https://saahomes.com').replace(/\/$/, '');
}

async function writeWebhookState(pool, tenantId, state) {
  await pool.query(
    "UPDATE tenants SET settings = jsonb_set(settings, '{fub_webhook}', $1::jsonb) WHERE id = $2",
    [JSON.stringify(state), tenantId]
  );
  clearTenantCache();
}

/**
 * After a brokerage connects (or changes) its FUB key: register the
 * peopleCreated webhook under that key. Removing the key removes it.
 * Without a registered FUB system the brokerage is told it's not available yet.
 */
export async function syncFubWebhook(tenantId, { pool = getPool() } = {}) {
  if (Number(tenantId) === DEFAULT_TENANT_ID) return { skipped: 'home' };
  const r = await pool.query("SELECT settings->>'fub_api_key' AS key, settings->'fub_webhook' AS hook FROM tenants WHERE id = $1", [tenantId]);
  const apiKey = String(r.rows[0]?.key || '').trim();
  const hook = r.rows[0]?.hook || {};
  const keyId = apiKey ? crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12) : null;

  if (!apiKey) {
    if (hook.id && hook.key_id) {
      // The old key is gone with the settings; FUB stops when its key is revoked.
      logger.info('FUB key removed; webhook left to lapse', { tenant_id: tenantId });
    }
    await writeWebhookState(pool, tenantId, { status: 'off' });
    return { status: 'off' };
  }
  if (hook.status === 'active' && hook.key_id === keyId) return { status: 'active' };
  if (!fubSystem()) {
    await writeWebhookState(pool, tenantId, { status: 'needs_system', key_id: keyId });
    return { status: 'needs_system' };
  }
  const token = hook.token || crypto.randomBytes(18).toString('base64url');
  const url = `${webhookBase()}/api/fub/webhook/${Number(tenantId)}/${token}`;
  try {
    const created = await fubFetch(apiKey, 'POST', '/webhooks', { event: 'peopleCreated', url });
    const state = { status: 'active', id: created?.id || null, token, key_id: keyId, registered_at: new Date().toISOString() };
    await writeWebhookState(pool, tenantId, state);
    logger.info('FUB peopleCreated webhook registered', { tenant_id: tenantId });
    return { status: 'active' };
  } catch (e) {
    // Only the FUB account owner can create webhooks.
    const status = e.status === 401 || e.status === 403 ? 'needs_owner_key' : 'failed';
    await writeWebhookState(pool, tenantId, { status, token, key_id: keyId, error_at: new Date().toISOString() });
    logger.warn('FUB webhook registration failed', { tenant_id: tenantId, status: e.status });
    return { status };
  }
}

/** Plain words for the brokerage about its new-contact alerts. */
export function fubWebhookStatusText(state) {
  switch (state?.status) {
    case 'active': return 'On: every contact you add in Follow Up Boss gets home alerts from your site.';
    case 'needs_owner_key': return 'Needs the Follow Up Boss account owner’s API key to turn on.';
    case 'needs_system': return 'Coming soon: we’re finishing our Follow Up Boss registration.';
    case 'failed': return 'Couldn’t turn on yet. We’ll try again when you reconnect.';
    default: return 'Connect Follow Up Boss to turn this on.';
  }
}

const CITY_RE = /^[A-Za-z .'-]{2,60}$/;

/** A starter search from what FUB knows about the person, or a broad one. */
export function starterFiltersFromPerson(person = {}) {
  const raw = {};
  const custom = Object.entries(person || {}).filter(([k]) => /^custom/i.test(k));
  const customCity = custom.find(([k, v]) => /(city|town|area)/i.test(k) && typeof v === 'string' && CITY_RE.test(v.trim()));
  const addressCity = (person.addresses || []).map((a) => a?.city).find((c) => typeof c === 'string' && CITY_RE.test(c.trim()));
  const city = (customCity?.[1] || addressCity || '').trim();
  if (city) raw.city = city;
  const price = Number(person.price);
  if (Number.isFinite(price) && price >= 50000 && price < 1e8) {
    raw.minPrice = Math.round((price * 0.8) / 5000) * 5000;
    raw.maxPrice = Math.round((price * 1.1) / 5000) * 5000;
  }
  const beds = custom.map(([k, v]) => (/bed/i.test(k) ? Number(v) : NaN)).find((n) => Number.isInteger(n) && n >= 1 && n <= 9);
  if (beds) raw.beds = beds;
  return sanitizeSavedFilters(raw);
}

function searchName(filters) {
  if (filters.city) return `Homes in ${filters.city}`;
  return 'New homes for you';
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendWelcome(pool, user, filters) {
  const {
    emailBrandForUser, emailSiteUrl, sendEmail, smtpConfigured, textOnAccent, contactLine,
  } = await import('./emailer.js');
  const { tenant, brand } = await emailBrandForUser(user, { pool });
  const site = emailSiteUrl(tenant);
  const searchUrl = `${site}${savedSearchPath(filters)}`;
  const manageUrl = `${site}/my-saved-searches/?token=${user.manage_token}`;
  const unsubscribeUrl = `${site}/api/alerts/unsubscribe?token=${user.manage_token}`;
  const first = String(user.name || '').trim().split(/\s+/)[0];
  const accent = brand.accent_color || '#2563eb';
  const parts = [];
  if (filters.city) parts.push(filters.city);
  if (filters.minPrice || filters.maxPrice) parts.push(`${fmtPrice(filters.minPrice) || '$0'}–${fmtPrice(filters.maxPrice) || 'any price'}`);
  if (filters.beds) parts.push(`${filters.beds}+ beds`);
  const criteria = parts.join(' · ') || `every new home${brand.market_name ? ` in ${brand.market_name}` : ''}`;
  const subject = `Your home alerts from ${brand.name} are on`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <div style="border-bottom:3px solid ${esc(accent)};padding:16px 0">${brand.logo_url
    ? `<img src="${esc(brand.logo_url)}" alt="${esc(brand.name)}" style="max-height:48px;max-width:220px">`
    : `<strong style="font-size:20px">${esc(brand.name)}</strong>`}</div>
  <p>${first ? `Hi ${esc(first)},` : 'Hi,'}</p>
  <p>${esc(brand.agent_name || brand.name)} set you up with home alerts, so you hear about new listings and price drops first.</p>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280">You'll get homes matching</p>
  <p style="margin:0 0 20px;font-weight:bold">${esc(criteria)}</p>
  <p style="margin:24px 0"><a href="${esc(searchUrl)}" style="background:${esc(accent)};color:${textOnAccent(accent)};padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">See the homes</a></p>
  <p style="font-size:14px">Want a different area, price or size? <a href="${esc(manageUrl)}">Change your alerts</a> any time.</p>
  <p style="font-size:12px;color:#6b7280;margin-top:28px">${esc(contactLine(brand, site))}<br>
  <a href="${esc(manageUrl)}" style="color:#6b7280">Manage your alerts</a> · <a href="${esc(unsubscribeUrl)}" style="color:#6b7280">Unsubscribe</a></p>
</div>`;
  const queue = () => pool.query('INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)', [user.email, subject, html, user.tenant_id]);
  try {
    if (smtpConfigured()) await sendEmail(user.email, subject, html, brand.from_name || brand.name, { tenantId: user.tenant_id, replyTo: brand.reply_to || brand.email || null });
    else await queue();
  } catch (e) {
    logger.warn('welcome email send failed, queuing', { message: e.message });
    await queue();
  }
}

/**
 * One person FUB says was created: fetch them with this brokerage's key and,
 * if they're new to us, start a saved search and send the welcome email.
 * Returns what happened.
 */
export async function startAlertForFubPerson(tenantId, personId, { pool = getPool() } = {}) {
  const tenant = await tenantById(tenantId, { pool });
  if (!tenant || tenant.id !== Number(tenantId) || tenant.status !== 'active') return { skipped: 'tenant' };
  const apiKey = await keyFor(tenant.id);
  if (!apiKey) return { skipped: 'not_configured' };
  const person = await fubFetch(apiKey, 'GET', `/people/${Number(personId)}?fields=allFields`);
  const email = String((person?.emails || []).find((e) => e?.value)?.value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { skipped: 'no_email' };

  const existing = await pool.query('SELECT id, role FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 LIMIT 1', [tenant.id, email]);
  const found = existing.rows[0];
  if (found && found.role && found.role !== 'client') return { skipped: 'staff' };
  if (found) {
    const has = await pool.query('SELECT 1 FROM saved_searches WHERE user_id = $1 LIMIT 1', [found.id]);
    if (has.rows[0]) {
      await pool.query('UPDATE users SET fub_person_id = COALESCE(fub_person_id, $1) WHERE id = $2', [Number(personId), found.id]);
      return { skipped: 'has_search' };
    }
  }

  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.name || null;
  const phone = String((person.phones || []).find((p) => p?.value)?.value || '').replace(/\D/g, '') || null;
  const filters = starterFiltersFromPerson(person);
  const client = await pool.connect();
  let user;
  let search;
  try {
    await client.query('BEGIN');
    if (found) {
      user = (await client.query(
        `UPDATE users SET fub_person_id = $1, name = COALESCE(name, $2), phone = COALESCE(phone, $3)
         WHERE id = $4 AND tenant_id = $5 RETURNING *`,
        [Number(personId), name, phone && phone.length >= 7 ? phone : null, found.id, tenant.id]
      )).rows[0];
    } else {
      user = (await client.query(
        `INSERT INTO users (email, name, phone, manage_token, tenant_id, fub_person_id)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING *`,
        [email, name, phone && phone.length >= 7 ? phone : null, crypto.randomBytes(24).toString('hex'), tenant.id, Number(personId)]
      )).rows[0];
    }
    if (!user) {
      await client.query('ROLLBACK');
      return { skipped: 'race' };
    }
    search = (await client.query(
      `INSERT INTO saved_searches (user_id, name, filters, is_active, frequency, send_time, send_day)
       VALUES ($1, $2, $3, TRUE, 'daily', '06:00', 'Monday') RETURNING *`,
      [user.id, searchName(filters), JSON.stringify(filters)]
    )).rows[0];
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  await runWithTenant(tenant, () => recordEvent({
    type: 'search_saved', userId: user.id, searchId: search.id, source: 'fub', meta: { filters, via: 'fub_people_created' }, tenantId: tenant.id,
  }, pool));
  await sendWelcome(pool, user, filters).catch((e) => logger.warn('welcome email failed', { message: e.message }));

  const { brandFor } = await import('./brand.js');
  const site = brandFor(tenant).site_url.replace(/\/$/, '');
  const linkField = String(process.env.FUB_ALERTS_LINK_FIELD || '').trim();
  try {
    await fubFetch(apiKey, 'POST', '/notes', {
      personId: Number(personId),
      subject: 'Home alerts started',
      body: `Home alerts are on: ${search.name}. They get new matches and price drops by email.\n${site}${savedSearchPath(filters)}`,
      isHtml: false,
    });
    await tagFubPerson(apiKey, personId, [TAG_ACTIVE_SEARCHER], linkField ? { [linkField]: `${site}${savedSearchPath(filters)}` } : {});
  } catch (e) {
    logger.warn('FUB note/tag after starter alert failed', { message: e.message });
  }
  logger.info('starter alert created from FUB contact', { tenant_id: tenant.id, user_id: user.id });
  return { created: true, user_id: user.id, search_id: search.id };
}

/**
 * A verified peopleCreated delivery for one brokerage. Each FUB event id is
 * handled once; each person is handled on their own so one failure doesn't
 * stop the rest.
 */
export async function handlePeopleCreated(tenantId, payload, { pool = getPool() } = {}) {
  if (payload?.event !== 'peopleCreated') return { ignored: payload?.event || 'unknown' };
  const eventId = String(payload.eventId || '').slice(0, 64);
  if (eventId) {
    const fresh = await pool.query(
      `INSERT INTO fub_webhook_events (tenant_id, event_id, event) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING event_id`,
      [tenantId, eventId, 'peopleCreated']
    );
    if (!fresh.rows[0]) return { duplicate: true };
  }
  const ids = (Array.isArray(payload.resourceIds) ? payload.resourceIds : [])
    .map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 25);
  const results = [];
  for (const id of ids) {
    try {
      results.push(await startAlertForFubPerson(tenantId, id, { pool }));
    } catch (e) {
      logger.warn('starter alert failed', { tenant_id: tenantId, person: id, message: e.message });
      results.push({ error: e.message });
    }
  }
  return { results };
}
