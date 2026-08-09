/**
 * Follow Up Boss CRM integration.
 *
 * - Lead forwarders push form leads via POST /v1/events (FUB dedupes by email/phone).
 * - Response body is the Person object — we store people.id as users.fub_person_id.
 * - Nurture signals (saved search, views, showing, market analysis) write back as
 *   events with source "saahomes.com" so Adam sees activity in FUB without our admin.
 *
 * Never double-push: FUB dedupes on create; when we have fub_person_id we include
 * person.id so events attach to the existing contact.
 *
 * When FOLLOW_UP_BOSS_API_KEY (and webhook) are absent, every call logs cleanly
 * and returns { success: false, reason: 'not_configured' } — never fakes a push.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import {
  enrichSubmissionFromHistory,
  noteIfDuplicateSubmission,
} from '../utils/emailQuality.js';
import dotenv from 'dotenv';

dotenv.config();

const FOLLOW_UP_BOSS_API_KEY = process.env.FOLLOW_UP_BOSS_API_KEY;
const FOLLOW_UP_BOSS_WEBHOOK_URL = process.env.FOLLOW_UP_BOSS_WEBHOOK_URL;
const FUB_EVENTS_URL = 'https://api.followupboss.com/v1/events';
const FUB_PEOPLE_URL = 'https://api.followupboss.com/v1/people';
const SYSTEM_NAME = 'SAA Homes Website';
/** Nurture-signal source tag — plan §3 / brief: source "saahomes.com" */
const NURTURE_SOURCE = 'saahomes.com';

export function isFollowUpBossConfigured() {
  return !!(FOLLOW_UP_BOSS_API_KEY || FOLLOW_UP_BOSS_WEBHOOK_URL);
}

const getAuthHeader = (apiKey) => {
  const encoded = Buffer.from(`${apiKey}:`).toString('base64');
  return `Basic ${encoded}`;
};

const buildAttributionLines = (submission) => {
  const lines = [];
  const sourcePage = submission.source_page || submission.sourcePage;
  const landingPage = submission.landing_page || submission.landingPage;
  const utmSource = submission.utm_source || submission.utmSource;
  const utmMedium = submission.utm_medium || submission.utmMedium;
  const utmCampaign = submission.utm_campaign || submission.utmCampaign;
  const referrer = submission.referrer;

  if (sourcePage) lines.push(`Source page: ${sourcePage}`);
  if (landingPage) lines.push(`Landing page: ${landingPage}`);
  if (utmSource) lines.push(`UTM source: ${utmSource}`);
  if (utmMedium) lines.push(`UTM medium: ${utmMedium}`);
  if (utmCampaign) lines.push(`UTM campaign: ${utmCampaign}`);
  if (referrer) lines.push(`Referrer: ${referrer}`);
  return lines;
};

/** Extract FUB people.id from an events (or people) API response. */
export function extractFubPersonId(result) {
  if (!result || typeof result !== 'object') return null;
  // Events response is nearly identical to people — id is the person id
  if (result.id != null && Number.isFinite(Number(result.id))) {
    return Number(result.id);
  }
  if (result.person?.id != null && Number.isFinite(Number(result.person.id))) {
    return Number(result.person.id);
  }
  return null;
}

/**
 * Persist FUB person id on our users row (by email). Idempotent — only writes
 * when the value is missing or different. Never invents IDs.
 */
export async function storeFubPersonId(email, personId, pool = getPool()) {
  const emailStr = String(email || '').trim().toLowerCase();
  const id = Number(personId);
  if (!emailStr.includes('@') || !Number.isFinite(id) || id <= 0) return false;
  try {
    const r = await pool.query(
      `UPDATE users SET fub_person_id = $1
       WHERE LOWER(email) = $2
         AND (fub_person_id IS NULL OR fub_person_id <> $1)
       RETURNING id, fub_person_id`,
      [id, emailStr]
    );
    if (r.rows[0]) {
      logger.info('Stored FUB person id', { email: emailStr, fub_person_id: id, user_id: r.rows[0].id });
      return true;
    }
    return false;
  } catch (err) {
    // Column may not exist mid-deploy — never block lead flow
    logger.warn('storeFubPersonId failed (non-blocking)', { message: err.message, email: emailStr });
    return false;
  }
}

/** Look up stored fub_person_id for an email (if any). */
export async function getFubPersonIdByEmail(email, pool = getPool()) {
  const emailStr = String(email || '').trim().toLowerCase();
  if (!emailStr.includes('@')) return null;
  try {
    const r = await pool.query(
      'SELECT fub_person_id FROM users WHERE LOWER(email) = $1 AND fub_person_id IS NOT NULL LIMIT 1',
      [emailStr]
    );
    return r.rows[0]?.fub_person_id ? Number(r.rows[0].fub_person_id) : null;
  } catch {
    return null;
  }
}

/**
 * Attach person.id when we already have it so FUB links to existing contact
 * (avoids accidental new-person creation on name/email mismatch).
 */
async function attachKnownPersonId(person) {
  if (!person || person.id) return person;
  const email = person.emails?.[0]?.value;
  if (!email) return person;
  const known = await getFubPersonIdByEmail(email);
  if (known) return { ...person, id: known };
  return person;
}

const postFollowUpBossEvent = async (eventData) => {
  if (!isFollowUpBossConfigured()) {
    throw new Error('Follow Up Boss not configured');
  }

  // Prefer linking to known person when possible
  if (eventData.person && !eventData.person.id) {
    eventData = {
      ...eventData,
      person: await attachKnownPersonId(eventData.person),
    };
  }

  let response;

  if (FOLLOW_UP_BOSS_WEBHOOK_URL) {
    response = await fetch(FOLLOW_UP_BOSS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(FOLLOW_UP_BOSS_API_KEY && { Authorization: getAuthHeader(FOLLOW_UP_BOSS_API_KEY) }),
      },
      body: JSON.stringify(eventData),
    });
  } else if (FOLLOW_UP_BOSS_API_KEY) {
    response = await fetch(FUB_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(FOLLOW_UP_BOSS_API_KEY),
      },
      body: JSON.stringify(eventData),
    });
  }

  // 204 = lead flow archived/ignored — treat as soft success, no person body
  if (response.status === 204) {
    logger.info('Follow Up Boss returned 204 (archived lead flow)', { source: eventData.source });
    return { success: true, status: 204 };
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Follow Up Boss API error', { status: response.status, error: errorText });
    throw new Error(`Follow Up Boss API returned ${response.status}: ${errorText}`);
  }

  // Some responses may be empty
  const text = await response.text();
  if (!text) return { success: true, status: response.status };
  try {
    return JSON.parse(text);
  } catch {
    return { success: true, status: response.status, raw: text };
  }
};

/**
 * After a successful FUB event, store people.id on our users row by email.
 * Fire-and-forget safe — never throws to callers that await it with catch.
 */
async function capturePersonIdFromResult(result, email) {
  const personId = extractFubPersonId(result);
  if (personId && email) {
    await storeFubPersonId(email, personId);
  }
  return personId;
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Home',
    lastName: parts.slice(1).join(' ') || 'Buyer',
  };
}

// ---------------------------------------------------------------------------
// Lead forwarders (existing 8 + person-ID capture)
// ---------------------------------------------------------------------------

/**
 * Best-effort enrich from prior submissions + duplicate observability.
 * Never blocks or delays the forward on failure.
 */
async function enrichForForward(submission, path) {
  try {
    const pool = getPool();
    const email = submission?.email || submission?.user?.email;
    noteIfDuplicateSubmission(pool, email, path).catch(() => {});
    return await enrichSubmissionFromHistory(pool, submission);
  } catch (err) {
    logger.warn('enrichForForward failed (non-blocking)', { message: err.message, path });
    return submission;
  }
}

export const forwardAlertSignupToFollowUpBoss = async (user, search) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping saved-search lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const enrichedUser = await enrichForForward(
    { email: user.email, name: user.name, phone: user.phone },
    'alert'
  );
  const userForPerson = {
    ...user,
    name: enrichedUser.name || user.name,
    phone: enrichedUser.phone || user.phone,
  };

  const filters = search.filters || {};
  const parts = [];
  if (filters.city) parts.push(`City: ${filters.city}`);
  if (filters.minPrice || filters.maxPrice) {
    parts.push(`Price: ${filters.minPrice ? `$${Number(filters.minPrice).toLocaleString()}` : '$0'}–${filters.maxPrice ? `$${Number(filters.maxPrice).toLocaleString()}` : 'Any'}`);
  }
  if (filters.beds) parts.push(`${filters.beds}+ beds`);
  if (filters.baths) parts.push(`${filters.baths}+ baths`);
  if (filters.type) parts.push(`Type: ${filters.type}`);
  const searchSummary = parts.join(' · ') || 'Anywhere';

  const { firstName, lastName } = splitName(userForPerson.name);

  const eventData = {
    source: 'Saved Search Alert',
    system: SYSTEM_NAME,
    type: 'Saved Property Search',
    message: [
      'New saved search from website — follow-up lead (nurture via nightly listing alerts).',
      `Search name: ${search.name || 'My Search'}`,
      `Criteria: ${searchSummary}`,
      `Manage alerts: https://saahomes.com/my-saved-searches/?token=${user.manage_token}`,
    ].join('\n'),
    person: {
      firstName,
      lastName,
      emails: userForPerson.email ? [{ value: userForPerson.email, type: 'work' }] : [],
      phones: userForPerson.phone ? [{ value: String(userForPerson.phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Website Lead', 'Saved Search', 'saahomes.com'],
    },
    propertySearch: {
      city: filters.city || undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      minBedrooms: filters.beds ? Number(filters.beds) : undefined,
      minBathrooms: filters.baths ? Number(filters.baths) : undefined,
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, userForPerson.email);
    logger.info('Saved-search lead forwarded to Follow Up Boss', {
      eventId: result.id,
      fub_person_id: fubPersonId,
    });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward saved-search lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardShowingRequestToFollowUpBoss = async (showing) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping showing lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const submission = await enrichForForward(showing, 'showing');
  const { firstName, lastName } = splitName(submission.name);

  const eventData = {
    source: 'Showing Request',
    system: SYSTEM_NAME,
    type: 'Property Inquiry',
    message: [
      'Showing request from website — schedule with the buyer.',
      `Home: ${submission.listing_address || submission.listing_slug || '—'}`,
      `Requested: ${submission.showing_date} at ${submission.showing_time}`,
      submission.message ? `Note: ${submission.message}` : null,
      submission.listing_slug ? `Listing: https://saahomes.com/homes-for-sale/${submission.listing_slug}/` : null,
    ].filter(Boolean).join('\n'),
    person: {
      firstName,
      lastName,
      emails: submission.email ? [{ value: submission.email, type: 'work' }] : [],
      phones: submission.phone ? [{ value: String(submission.phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Website Lead', 'Showing Request', 'saahomes.com'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, submission.email);
    logger.info('Showing request forwarded to Follow Up Boss', {
      eventId: result.id,
      fub_person_id: fubPersonId,
    });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward showing request to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardContactToFollowUpBoss = async (submissionIn) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const submission = await enrichForForward(submissionIn, 'contact');
  const { name, email, phone, interest, message, area } = submission;
  const { firstName, lastName } = splitName(name);

  const messageLines = [
    interest ? `Interest: ${interest}` : null,
    area ? `Area: ${area}` : null,
    message || null,
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'Website Contact Form',
    system: SYSTEM_NAME,
    type: 'General Inquiry',
    message: messageLines.join('\n') || 'New website contact form submission',
    person: {
      firstName,
      lastName,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: String(phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Website Lead', 'saahomes.com'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('Lead forwarded to Follow Up Boss', { eventId: result.id, fub_person_id: fubPersonId });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardChfaLeadToFollowUpBoss = async (submissionIn) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const submission = await enrichForForward(submissionIn, 'chfa');
  const { first_name, last_name, email, phone, school_employer, buying_timeline, message } = submission;

  const messageLines = [
    'CHFA Schools To Home lead from website',
    school_employer ? `School/District: ${school_employer}` : null,
    buying_timeline ? `Buying timeline: ${buying_timeline}` : null,
    message ? `Comments: ${message}` : null,
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'CHFA Schools To Home Landing Page',
    system: SYSTEM_NAME,
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: String(phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['CHFA Schools To Home', 'School Employee Lead', 'Website Lead', 'saahomes.com'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('CHFA lead forwarded to Follow Up Boss', { eventId: result.id, fub_person_id: fubPersonId });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward CHFA lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardChampionsLeadToFollowUpBoss = async (submissionIn) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const submission = await enrichForForward(submissionIn, 'champions');
  const {
    first_name, last_name, email, phone, responder_type, employer_agency, buying_timeline, message,
    responderType, employerAgency, buyingTimeline,
  } = submission;

  const resolvedType = responder_type || responderType;
  const resolvedAgency = employer_agency || employerAgency;
  const resolvedTimeline = buying_timeline || buyingTimeline;

  const messageLines = [
    'Colorado Champions Home Loan Program lead from website',
    resolvedType ? `Role: ${resolvedType}` : null,
    resolvedAgency ? `Employer/Agency: ${resolvedAgency}` : null,
    resolvedTimeline ? `Buying timeline: ${resolvedTimeline}` : null,
    message ? `Comments: ${message}` : null,
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'Champions Home Loan Landing Page',
    system: SYSTEM_NAME,
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: String(phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Champions Home Loan', 'First Responder Lead', 'Website Lead', 'saahomes.com'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('Champions lead forwarded to Follow Up Boss', { eventId: result.id, fub_person_id: fubPersonId });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward Champions lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardChfaDpaLeadToFollowUpBoss = async (submissionIn) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const submission = await enrichForForward(submissionIn, 'chfa-dpa');
  const {
    first_name, last_name, email, phone, buyer_status, target_county, buying_timeline, message,
    buyerStatus, targetCounty, buyingTimeline,
  } = submission;

  const resolvedStatus = buyer_status || buyerStatus;
  const resolvedCounty = target_county || targetCounty;
  const resolvedTimeline = buying_timeline || buyingTimeline;

  const messageLines = [
    'CHFA Down Payment Assistance lead from website',
    resolvedStatus ? `Buyer status: ${resolvedStatus}` : null,
    resolvedCounty ? `Target county: ${resolvedCounty}` : null,
    resolvedTimeline ? `Buying timeline: ${resolvedTimeline}` : null,
    message ? `Comments: ${message}` : null,
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'CHFA Down Payment Assistance Landing Page',
    system: SYSTEM_NAME,
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: String(phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['CHFA Down Payment Assistance', 'First Time Homebuyer Lead', 'Website Lead', 'saahomes.com'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('CHFA DPA lead forwarded to Follow Up Boss', { eventId: result.id, fub_person_id: fubPersonId });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward CHFA DPA lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardGhopeLeadToFollowUpBoss = async (submissionIn) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const submission = await enrichForForward(submissionIn, 'ghope');
  const {
    first_name, last_name, email, phone, employer_name, target_zone, buying_timeline, message,
    employerName, targetZone, buyingTimeline,
  } = submission;

  const resolvedEmployer = employer_name || employerName;
  const resolvedZone = target_zone || targetZone;
  const resolvedTimeline = buying_timeline || buyingTimeline;

  const messageLines = [
    'G-HOPE Greeley down payment assistance lead from website',
    resolvedEmployer ? `Employer: ${resolvedEmployer}` : null,
    resolvedZone ? `Target zone: ${resolvedZone}` : null,
    resolvedTimeline ? `Buying timeline: ${resolvedTimeline}` : null,
    message ? `Comments: ${message}` : null,
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'G-HOPE Greeley Landing Page',
    system: SYSTEM_NAME,
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: String(phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['G-HOPE Greeley', 'Greeley Down Payment Assistance', 'Website Lead', 'saahomes.com'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('G-HOPE lead forwarded to Follow Up Boss', { eventId: result.id, fub_person_id: fubPersonId });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward G-HOPE lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardMarketReportToFollowUpBoss = async (submissionIn) => {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const submission = await enrichForForward(submissionIn, 'market-report');
  const { firstName, lastName, email, phone, area, first_name, last_name } = submission;
  const resolvedFirstName = firstName || first_name;
  const resolvedLastName = lastName || last_name;

  const messageLines = [
    area ? `Market report requested for: ${area}` : 'Market report requested',
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'Website Market Report Request',
    system: SYSTEM_NAME,
    type: 'Seller Inquiry',
    message: messageLines.join('\n'),
    person: {
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: String(phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Market Report Request', 'saahomes.com'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('Market report lead forwarded to Follow Up Boss', {
      eventId: result.id,
      fub_person_id: fubPersonId,
    });
    return { success: true, eventId: result.id, fubPersonId };
  } catch (error) {
    logger.error('Failed to forward market report lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// Nurture-signal write-back (It 12) — activity Adam sees in FUB
// ---------------------------------------------------------------------------

/**
 * Map our internal signal keys → FUB event type + human message.
 * Only real signals — never fabricate activity.
 */
const NURTURE_SIGNAL_MAP = {
  saved_search: {
    type: 'Saved Property Search',
    label: 'Saved a property search on saahomes.com',
  },
  listing_view_2x: {
    type: 'Viewed Property',
    label: 'Viewed a listing 2+ times on saahomes.com',
  },
  showing_request: {
    type: 'Property Inquiry',
    label: 'Requested a showing on saahomes.com',
  },
  market_analysis: {
    type: 'Seller Inquiry',
    label: 'Requested a market analysis / home value on saahomes.com',
  },
  value_view_2x: {
    type: 'Visited Website',
    label: 'Viewed their home value 2+ times (seller heat) on saahomes.com',
  },
  seller_heat: {
    type: 'Seller Inquiry',
    label: 'Seller heat signal on saahomes.com',
  },
};

/**
 * Push a nurture signal as a FUB event with source "saahomes.com".
 * Dedupes: if we already have fub_person_id, include person.id.
 * Skips cleanly when FUB is not configured.
 *
 * @param {object} opts
 * @param {string} opts.signal — key in NURTURE_SIGNAL_MAP
 * @param {string} opts.email
 * @param {string} [opts.name]
 * @param {string} [opts.phone]
 * @param {string} [opts.message] — extra detail lines
 * @param {object} [opts.property] — optional FUB property object
 * @param {object} [opts.propertySearch] — optional FUB propertySearch object
 */
export async function pushNurtureSignalToFollowUpBoss(opts = {}) {
  if (!isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping nurture signal', { signal: opts.signal });
    return { success: false, reason: 'not_configured' };
  }

  const signalKey = String(opts.signal || '').trim();
  const mapped = NURTURE_SIGNAL_MAP[signalKey];
  if (!mapped) {
    logger.warn('Unknown nurture signal — not pushing to FUB', { signal: signalKey });
    return { success: false, reason: 'unknown_signal' };
  }

  const email = String(opts.email || '').trim().toLowerCase();
  if (!email.includes('@')) {
    return { success: false, reason: 'no_email' };
  }

  const { firstName, lastName } = splitName(opts.name);
  const knownId = opts.fubPersonId || (await getFubPersonIdByEmail(email));

  const detailLines = [
    mapped.label,
    opts.message || null,
  ].filter(Boolean);

  const eventData = {
    source: NURTURE_SOURCE,
    system: SYSTEM_NAME,
    type: mapped.type,
    message: detailLines.join('\n'),
    person: {
      ...(knownId ? { id: knownId } : {}),
      firstName,
      lastName,
      emails: [{ value: email, type: 'work' }],
      phones: opts.phone
        ? [{ value: String(opts.phone).replace(/\D/g, ''), type: 'mobile' }]
        : [],
      tags: ['saahomes.com', 'Nurture Signal'],
    },
  };
  if (opts.property && typeof opts.property === 'object') {
    eventData.property = opts.property;
  }
  if (opts.propertySearch && typeof opts.propertySearch === 'object') {
    eventData.propertySearch = opts.propertySearch;
  }

  try {
    const result = await postFollowUpBossEvent(eventData);
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('Nurture signal written to Follow Up Boss', {
      signal: signalKey,
      fub_person_id: fubPersonId || knownId,
      type: mapped.type,
    });
    return { success: true, fubPersonId: fubPersonId || knownId, signal: signalKey };
  } catch (error) {
    logger.error('Failed to push nurture signal to Follow Up Boss', {
      signal: signalKey,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Read-only health check: GET /v1/people?limit=1 — never creates a person.
 * Returns count metadata if key is present; soft-fails if not configured.
 */
export async function getFollowUpBossPeopleCount() {
  if (!FOLLOW_UP_BOSS_API_KEY) {
    return { configured: false, reason: 'not_configured' };
  }
  try {
    const url = `${FUB_PEOPLE_URL}?limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(FOLLOW_UP_BOSS_API_KEY),
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error('FUB people count failed', { status: response.status, error: text });
      return { configured: true, success: false, status: response.status };
    }
    const data = await response.json();
    // FUB list responses typically include _metadata.total or total
    const total = data?._metadata?.total ?? data?.total ?? data?.people?.length ?? null;
    return { configured: true, success: true, total, sample: data?.people?.[0]?.id || data?.[0]?.id || null };
  } catch (error) {
    logger.error('FUB people count error', { message: error.message });
    return { configured: true, success: false, error: error.message };
  }
}
