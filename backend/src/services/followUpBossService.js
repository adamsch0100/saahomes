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
import crypto from 'crypto';
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

/**
 * POST /v1/events (or brokerage webhook).
 * @param {object} eventData
 * @param {{ apiKey?: string }} [opts] — per-agent key override (P-3b webform).
 *   When set, always hits FUB Events API with that key (not the brokerage webhook).
 *   Site-native forwarders omit opts → unchanged env/webhook path.
 */
const postFollowUpBossEvent = async (eventData, opts = {}) => {
  const overrideKey = resolveFubApiKey(opts.apiKey);
  const hasOverride = !!(opts.apiKey != null && String(opts.apiKey).trim());

  if (!hasOverride && !isFollowUpBossConfigured()) {
    throw new Error('Follow Up Boss not configured');
  }
  if (hasOverride && !overrideKey) {
    throw new Error('Follow Up Boss API key missing');
  }

  // Prefer linking to known person when possible
  if (eventData.person && !eventData.person.id) {
    eventData = {
      ...eventData,
      person: await attachKnownPersonId(eventData.person),
    };
  }

  let response;

  if (hasOverride) {
    // Per-agent key → Events API only (agent's own FUB account)
    response = await fetch(FUB_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(overrideKey),
      },
      body: JSON.stringify(eventData),
    });
  } else if (FOLLOW_UP_BOSS_WEBHOOK_URL) {
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

  if (!response) {
    throw new Error('Follow Up Boss not configured');
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

/**
 * Forward a contact / webform lead to FUB.
 * @param {object} submissionIn
 * @param {{ apiKey?: string, eventSource?: string, tags?: string[], path?: string }} [opts]
 *   apiKey — per-agent FUB key (P-3b). When omitted, uses brokerage env/webhook (site-native).
 */
export const forwardContactToFollowUpBoss = async (submissionIn, opts = {}) => {
  const overrideKey = opts.apiKey != null ? String(opts.apiKey).trim() : '';
  if (!overrideKey && !isFollowUpBossConfigured()) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }
  if (opts.apiKey != null && !overrideKey) {
    return { success: false, reason: 'not_configured' };
  }

  const path = opts.path || 'contact';
  const submission = await enrichForForward(submissionIn, path);
  const { name, email, phone, interest, message, area } = submission;
  const { firstName, lastName } = splitName(name);

  const messageLines = [
    interest ? `Interest: ${interest}` : null,
    area ? `Area: ${area}` : null,
    message || null,
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const tags = Array.isArray(opts.tags) && opts.tags.length
    ? opts.tags
    : ['Website Lead', 'saahomes.com'];

  const eventData = {
    source: opts.eventSource || 'Website Contact Form',
    system: SYSTEM_NAME,
    type: 'General Inquiry',
    message: messageLines.join('\n') || 'New website contact form submission',
    person: {
      firstName,
      lastName,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: String(phone).replace(/\D/g, ''), type: 'mobile' }] : [],
      tags,
    },
  };

  try {
    const result = await postFollowUpBossEvent(
      eventData,
      overrideKey ? { apiKey: overrideKey } : {}
    );
    const fubPersonId = await capturePersonIdFromResult(result, email);
    logger.info('Lead forwarded to Follow Up Boss', {
      eventId: result.id,
      fub_person_id: fubPersonId,
      path,
      perAgentKey: !!overrideKey,
    });
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
  saved_home: {
    type: 'Saved Property',
    label: 'Saved a home (heart) on saahomes.com',
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
  // Agent-initiated share (It 16 / P5) — Adam shares a home + note with a client
  shared_home: {
    type: 'Property Inquiry',
    label: 'Adam shared a home with them on saahomes.com',
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
 * Resolve API key: explicit override first, else brokerage env key.
 * Site-native forwarders omit override (env only). P-3a import + P-3b webform
 * pass the agent's connected key when present.
 */
export function resolveFubApiKey(override) {
  const key = override != null ? String(override).trim() : '';
  if (key) return key;
  return FOLLOW_UP_BOSS_API_KEY || null;
}

/** Mask API key for client responses — never return full key. */
export function maskFubApiKey(apiKey) {
  const s = String(apiKey || '');
  if (s.length < 4) return s ? '••••' : null;
  return `••••${s.slice(-4)}`;
}

/**
 * Read-only health check: GET /v1/people?limit=1 — never creates a person.
 * Returns count metadata if key is present; soft-fails if not configured.
 * @param {{ apiKey?: string }} [opts] — optional per-agent key override
 */
export async function getFollowUpBossPeopleCount(opts = {}) {
  const apiKey = resolveFubApiKey(opts.apiKey);
  if (!apiKey) {
    return { configured: false, reason: 'not_configured' };
  }
  try {
    const url = `${FUB_PEOPLE_URL}?limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(apiKey),
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error('FUB people count failed', { status: response.status, error: text?.slice?.(0, 200) || text });
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

/**
 * Verify a candidate FUB API key with a read-only people list call.
 * Never stores the key — caller decides. Never logs the raw key.
 * @param {string} apiKey
 * @returns {Promise<{ success: boolean, total?: number|null, status?: number, error?: string }>}
 */
export async function verifyFollowUpBossApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) {
    return { success: false, error: 'API key is required' };
  }
  try {
    const url = `${FUB_PEOPLE_URL}?limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(key),
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const status = response.status;
      logger.warn('FUB API key verify failed', { status });
      if (status === 401 || status === 403) {
        return { success: false, status, error: 'Invalid Follow Up Boss API key' };
      }
      return { success: false, status, error: `Follow Up Boss rejected the key (HTTP ${status})` };
    }
    const data = await response.json();
    const total = data?._metadata?.total ?? data?.total ?? null;
    return { success: true, total: total != null ? Number(total) : null };
  } catch (error) {
    logger.error('FUB API key verify error', { message: error.message });
    return { success: false, error: 'Could not reach Follow Up Boss — try again' };
  }
}

/**
 * Paginated people list (read-only). FUB supports limit (max 100) + offset.
 * @param {{ apiKey?: string, limit?: number, offset?: number }} opts
 */
export async function listFollowUpBossPeople(opts = {}) {
  const apiKey = resolveFubApiKey(opts.apiKey);
  if (!apiKey) {
    return { success: false, reason: 'not_configured', people: [], total: null };
  }
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 100, 1), 100);
  const offset = Math.max(parseInt(opts.offset, 10) || 0, 0);
  try {
    const url = `${FUB_PEOPLE_URL}?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(apiKey),
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const status = response.status;
      logger.error('FUB people list failed', { status, offset, limit });
      return {
        success: false,
        status,
        error: status === 401 || status === 403
          ? 'Follow Up Boss API key is invalid or revoked'
          : `FUB API ${status}`,
        people: [],
        total: null,
      };
    }
    const data = await response.json();
    const people = Array.isArray(data?.people)
      ? data.people
      : Array.isArray(data)
        ? data
        : [];
    const total = data?._metadata?.total ?? data?.total ?? null;
    return {
      success: true,
      people,
      total: total != null && Number.isFinite(Number(total)) ? Number(total) : null,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('FUB people list error', { message: error.message });
    return { success: false, error: error.message, people: [], total: null };
  }
}

/** Digits-only phone for dedupe (empty → null). */
function normalizePhoneDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  // US: strip leading 1 when 11 digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

/**
 * Extract importable fields from a FUB person payload — real data only.
 * @returns {{ personId: number|null, email: string|null, phone: string|null, name: string|null, tags: string[] }|null}
 */
export function extractFubPersonForImport(person) {
  if (!person || typeof person !== 'object') return null;
  const personIdRaw = person.id != null ? Number(person.id) : null;
  const personId = Number.isFinite(personIdRaw) && personIdRaw > 0 ? personIdRaw : null;

  const emails = Array.isArray(person.emails) ? person.emails : [];
  let email = null;
  const primaryEmail = emails.find((e) => e && (e.isPrimary || e.primary));
  const emailCandidates = primaryEmail ? [primaryEmail, ...emails] : emails;
  for (const e of emailCandidates) {
    const v = String(e?.value || e || '').trim().toLowerCase();
    if (v.includes('@')) {
      email = v;
      break;
    }
  }

  const phones = Array.isArray(person.phones) ? person.phones : [];
  let phone = null;
  const primaryPhone = phones.find((p) => p && (p.isPrimary || p.primary));
  const phoneCandidates = primaryPhone ? [primaryPhone, ...phones] : phones;
  for (const p of phoneCandidates) {
    const digits = normalizePhoneDigits(p?.value || p);
    if (digits) {
      phone = digits;
      break;
    }
  }

  let name = null;
  if (person.name && String(person.name).trim()) {
    name = String(person.name).trim().slice(0, 255);
  } else {
    const parts = [person.firstName, person.lastName]
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter(Boolean);
    if (parts.length) name = parts.join(' ').slice(0, 255);
  }

  const tags = Array.isArray(person.tags)
    ? person.tags.map((t) => String(t)).filter(Boolean)
    : [];

  return { personId, email, phone, name, tags };
}

/**
 * Import contacts from FUB into users (clients). Idempotent: re-run adds zero
 * duplicates (email / phone / fub_person_id). Cap: maxPages × pageSize (default 25×100).
 * Never clobbers lifecycle_stage_manual. Invalid mid-import key → partial result.
 *
 * @param {{ apiKey: string, agentUserId: number, pool?: object, maxPages?: number, pageSize?: number }} opts
 * @returns {Promise<{ imported: number, duplicates: number, failed: number, total: number|null, pagesFetched: number, truncated: boolean, error?: string }>}
 */
export async function importFollowUpBossContacts(opts = {}) {
  const apiKey = resolveFubApiKey(opts.apiKey);
  const agentUserId = Number(opts.agentUserId);
  const pool = opts.pool || getPool();
  const maxPages = Math.min(Math.max(parseInt(opts.maxPages, 10) || 25, 1), 25);
  const pageSize = Math.min(Math.max(parseInt(opts.pageSize, 10) || 100, 1), 100);

  if (!apiKey) {
    return {
      imported: 0,
      duplicates: 0,
      failed: 0,
      total: null,
      pagesFetched: 0,
      truncated: false,
      error: 'not_configured',
    };
  }
  if (!Number.isFinite(agentUserId) || agentUserId <= 0) {
    return {
      imported: 0,
      duplicates: 0,
      failed: 0,
      total: null,
      pagesFetched: 0,
      truncated: false,
      error: 'agent_required',
    };
  }

  let imported = 0;
  let duplicates = 0;
  let failed = 0;
  let total = null;
  let pagesFetched = 0;
  let offset = 0;
  let truncated = false;
  let midError = null;

  while (pagesFetched < maxPages) {
    const page = await listFollowUpBossPeople({ apiKey, limit: pageSize, offset });
    if (!page.success) {
      midError = page.error || page.reason || 'list_failed';
      // Auth failure on first page = hard fail; mid-import = partial
      if (pagesFetched === 0) {
        return {
          imported: 0,
          duplicates: 0,
          failed: 0,
          total: null,
          pagesFetched: 0,
          truncated: false,
          error: midError,
        };
      }
      break;
    }
    if (total == null && page.total != null) total = page.total;
    const people = page.people || [];
    if (!people.length) break;

    for (const person of people) {
      try {
        const result = await upsertFubImportedContact(person, agentUserId, pool);
        if (result === 'imported') imported += 1;
        else if (result === 'duplicate') duplicates += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        logger.warn('FUB import person failed', { message: err.message });
      }
    }

    pagesFetched += 1;
    offset += people.length;
    if (people.length < pageSize) break;
    if (total != null && offset >= total) break;
  }

  if (pagesFetched >= maxPages && total != null && offset < total) {
    truncated = true;
  } else if (pagesFetched >= maxPages && total == null) {
    // Unknown total but hit page cap — may have more
    truncated = true;
  }

  try {
    await pool.query(
      'UPDATE users SET fub_last_import_at = NOW() WHERE id = $1',
      [agentUserId]
    );
  } catch (err) {
    logger.warn('fub_last_import_at update failed', { message: err.message });
  }

  const resultTotal = total != null ? total : imported + duplicates + failed;
  logger.info('FUB contact import finished', {
    agentUserId,
    imported,
    duplicates,
    failed,
    total: resultTotal,
    pagesFetched,
    truncated,
    midError: midError || null,
  });

  return {
    imported,
    duplicates,
    failed,
    total: resultTotal,
    pagesFetched,
    truncated,
    ...(midError ? { error: midError, partial: true } : {}),
  };
}

/**
 * Upsert one FUB person into users as a client contact.
 * @returns {'imported'|'duplicate'|'skipped'}
 */
async function upsertFubImportedContact(person, agentUserId, pool) {
  const fields = extractFubPersonForImport(person);
  if (!fields) return 'skipped';

  const { personId, email, phone, name, tags } = fields;
  // Need email or phone to identity-match; prefer email for new rows
  if (!email && !phone && !personId) return 'skipped';

  // Find existing client by fub_person_id → email → phone (never match agents)
  let existing = null;
  if (personId) {
    const r = await pool.query(
      `SELECT * FROM users
       WHERE fub_person_id = $1 AND COALESCE(role, 'client') = 'client'
       LIMIT 1`,
      [personId]
    );
    existing = r.rows[0] || null;
  }
  if (!existing && email) {
    const r = await pool.query(
      `SELECT * FROM users
       WHERE LOWER(email) = $1 AND COALESCE(role, 'client') = 'client'
       LIMIT 1`,
      [email]
    );
    existing = r.rows[0] || null;
  }
  if (!existing && phone) {
    // Compare digit-normalized phone (stored may have formatting)
    const r = await pool.query(
      `SELECT * FROM users
       WHERE COALESCE(role, 'client') = 'client'
         AND phone IS NOT NULL AND TRIM(phone) <> ''
         AND regexp_replace(phone, '\\D', '', 'g') IN ($1, $2)
       LIMIT 1`,
      [phone, phone.length === 10 ? `1${phone}` : phone]
    );
    existing = r.rows[0] || null;
  }

  const { stage: mappedStage } = mapFubTagsToLifecycle(tags);

  if (existing) {
    // Idempotent re-import: enrich missing fields only; never clobber manual lifecycle
    const updates = [];
    const params = [];
    let i = 1;

    if (personId && !existing.fub_person_id) {
      updates.push(`fub_person_id = $${i++}`);
      params.push(personId);
    }
    if (phone && !existing.phone) {
      updates.push(`phone = $${i++}`);
      params.push(phone);
    }
    if (name && !existing.name) {
      updates.push(`name = $${i++}`);
      params.push(name);
    }
    if (!existing.source) {
      updates.push(`source = $${i++}`);
      params.push('fub-import');
    }
    if (
      mappedStage &&
      !existing.lifecycle_stage_manual &&
      existing.lifecycle_stage !== mappedStage
    ) {
      updates.push(`lifecycle_stage = $${i++}`);
      params.push(mappedStage);
    }
    // Claim unassigned pool contact for the importing agent
    if (existing.assigned_agent_id == null && agentUserId) {
      updates.push(`assigned_agent_id = $${i++}`);
      params.push(agentUserId);
    }

    if (updates.length) {
      params.push(existing.id);
      await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
        params
      );
    }
    return 'duplicate';
  }

  // New contact — require email (users.email is the identity key for the product)
  if (!email) return 'skipped';

  // Guard: if email belongs to an agent/admin, never demote
  const staff = await pool.query(
    `SELECT id FROM users WHERE LOWER(email) = $1 AND role IN ('agent', 'admin') LIMIT 1`,
    [email]
  );
  if (staff.rows[0]) return 'skipped';

  const manageToken = crypto.randomBytes(24).toString('hex');
  const lifecycle = mappedStage || 'new';

  await pool.query(
    `INSERT INTO users (
       email, name, phone, manage_token, role, status,
       fub_person_id, source, lifecycle_stage, lifecycle_stage_manual,
       assigned_agent_id, last_active_at
     ) VALUES (
       $1, $2, $3, $4, 'client', 'active',
       $5, 'fub-import', $6, FALSE,
       $7, NOW()
     )`,
    [
      email,
      name || null,
      phone || null,
      manageToken,
      personId,
      lifecycle,
      agentUserId,
    ]
  );
  return 'imported';
}

/**
 * Map FUB free-form tags → our LIFECYCLE_STAGES vocabulary.
 * Only tags in this map change stage; unknown tags are reported but never force a stage.
 * Keys are lowercase; matching is case-insensitive.
 */
export const FUB_TAG_TO_LIFECYCLE = {
  'new lead': 'new',
  'new': 'new',
  'nurturing': 'nurturing',
  'nurture': 'nurturing',
  'showing': 'showing',
  'active buyer': 'active',
  'active seller': 'active',
  'active': 'active',
  'closed': 'closed',
  'under contract': 'closed',
  'sold': 'closed',
  'lost': 'lost',
  'do not contact': 'lost',
  'dnc': 'lost',
};

/**
 * Resolve FUB tags array → a single lifecycle stage (or null if none map).
 * Later tags win when multiple map (agent's most recent tags typically last).
 * Returns { stage, mappedTags, unmappedTags } — never fabricates a stage.
 */
export function mapFubTagsToLifecycle(tags) {
  const list = Array.isArray(tags) ? tags : [];
  const mappedTags = [];
  const unmappedTags = [];
  let stage = null;
  for (const raw of list) {
    const tag = String(raw || '').trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    const mapped = FUB_TAG_TO_LIFECYCLE[key];
    if (mapped) {
      stage = mapped;
      mappedTags.push(tag);
    } else {
      unmappedTags.push(tag);
    }
  }
  return { stage, mappedTags, unmappedTags };
}

/**
 * Normalize FUB person payload → { personId, tags } from real API data only.
 */
function extractPersonFields(person) {
  if (!person || typeof person !== 'object') return null;
  const personId = person.id != null ? String(person.id) : null;
  const tags = Array.isArray(person.tags)
    ? person.tags.map((t) => String(t)).filter(Boolean)
    : [];
  return { personId, tags, raw: person };
}

/**
 * Pull a person from Follow Up Boss (read-only) by fub_person_id or email search.
 * Clean-skips when API key is missing — never fabricates tags/person.
 *
 * @param {object} opts
 * @param {string} [opts.email]
 * @param {string|number} [opts.fubPersonId]
 * @param {string} [opts.apiKey] — optional per-agent key; default = env key
 * @returns {Promise<{configured:boolean, found?:boolean, personId?:string|null, tags?:string[], reason?:string, error?:string}>}
 */
export async function pullFollowUpBossPerson({ email, fubPersonId, apiKey: apiKeyOverride } = {}) {
  const apiKey = resolveFubApiKey(apiKeyOverride);
  if (!apiKey) {
    return { configured: false, reason: 'not_configured' };
  }

  const id = fubPersonId != null && String(fubPersonId).trim()
    ? String(fubPersonId).trim()
    : null;
  const emailNorm = email != null ? String(email).trim().toLowerCase() : '';

  if (!id && !emailNorm.includes('@')) {
    return { configured: true, found: false, reason: 'no_lookup_key' };
  }

  try {
    let person = null;

    if (id) {
      const url = `${FUB_PEOPLE_URL}/${encodeURIComponent(id)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: getAuthHeader(apiKey),
          Accept: 'application/json',
        },
      });
      if (response.status === 404) {
        // Fall through to email search if we have one
        person = null;
        logger.info('FUB person by id not found', { fub_person_id: id });
      } else if (!response.ok) {
        const text = await response.text();
        logger.error('FUB person fetch by id failed', {
          status: response.status,
          fub_person_id: id,
          error: text?.slice?.(0, 200) || text,
        });
        return {
          configured: true,
          found: false,
          success: false,
          status: response.status,
          error: `FUB API ${response.status}`,
        };
      } else {
        const data = await response.json();
        person = data?.person || data;
      }
    }

    if (!person && emailNorm.includes('@')) {
      const url = `${FUB_PEOPLE_URL}?search=${encodeURIComponent(emailNorm)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: getAuthHeader(apiKey),
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        const text = await response.text();
        logger.error('FUB people search failed', {
          status: response.status,
          email: emailNorm,
          error: text?.slice?.(0, 200) || text,
        });
        return {
          configured: true,
          found: false,
          success: false,
          status: response.status,
          error: `FUB API ${response.status}`,
        };
      }
      const data = await response.json();
      const people = Array.isArray(data?.people)
        ? data.people
        : Array.isArray(data)
          ? data
          : [];
      // Prefer exact email match when present; else first result (FUB search order)
      const lower = emailNorm;
      person =
        people.find((p) => {
          const emails = Array.isArray(p?.emails) ? p.emails : [];
          return emails.some(
            (e) => String(e?.value || e || '').trim().toLowerCase() === lower
          );
        }) || people[0] || null;
    }

    if (!person) {
      return { configured: true, found: false, personId: null, tags: [] };
    }

    const extracted = extractPersonFields(person);
    if (!extracted) {
      return { configured: true, found: false, personId: null, tags: [] };
    }

    logger.info('FUB person pulled', {
      personId: extracted.personId,
      tagCount: extracted.tags.length,
    });

    return {
      configured: true,
      found: true,
      success: true,
      personId: extracted.personId,
      tags: extracted.tags,
    };
  } catch (error) {
    logger.error('FUB person pull error', { message: error.message });
    return {
      configured: true,
      found: false,
      success: false,
      error: error.message,
    };
  }
}
