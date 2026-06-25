import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const FOLLOW_UP_BOSS_API_KEY = process.env.FOLLOW_UP_BOSS_API_KEY;
const FOLLOW_UP_BOSS_WEBHOOK_URL = process.env.FOLLOW_UP_BOSS_WEBHOOK_URL;

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

const postFollowUpBossEvent = async (eventData) => {
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
    response = await fetch('https://api.followupboss.com/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(FOLLOW_UP_BOSS_API_KEY),
      },
      body: JSON.stringify(eventData),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Follow Up Boss API error', { status: response.status, error: errorText });
    throw new Error(`Follow Up Boss API returned ${response.status}: ${errorText}`);
  }

  return response.json();
};

export const forwardContactToFollowUpBoss = async (submission) => {
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const { name, email, phone, interest, message, area } = submission;

  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0] || name;
  const lastName = nameParts.slice(1).join(' ') || '';

  const messageLines = [
    interest ? `Interest: ${interest}` : null,
    area ? `Area: ${area}` : null,
    message || null,
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'Website Contact Form',
    system: 'SAA Homes Website',
    type: 'General Inquiry',
    message: messageLines.join('\n') || 'New website contact form submission',
    person: {
      firstName,
      lastName,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Website Lead'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    logger.info('Lead forwarded to Follow Up Boss', { eventId: result.id });
    return { success: true, eventId: result.id };
  } catch (error) {
    logger.error('Failed to forward lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardChfaLeadToFollowUpBoss = async (submission) => {
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

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
    system: 'SAA Homes Website',
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['CHFA Schools To Home', 'School Employee Lead', 'Website Lead'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    logger.info('CHFA lead forwarded to Follow Up Boss', { eventId: result.id });
    return { success: true, eventId: result.id };
  } catch (error) {
    logger.error('Failed to forward CHFA lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardChampionsLeadToFollowUpBoss = async (submission) => {
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

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
    system: 'SAA Homes Website',
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Champions Home Loan', 'First Responder Lead', 'Website Lead'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    logger.info('Champions lead forwarded to Follow Up Boss', { eventId: result.id });
    return { success: true, eventId: result.id };
  } catch (error) {
    logger.error('Failed to forward Champions lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardChfaDpaLeadToFollowUpBoss = async (submission) => {
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

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
    system: 'SAA Homes Website',
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['CHFA Down Payment Assistance', 'First Time Homebuyer Lead', 'Website Lead'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    logger.info('CHFA DPA lead forwarded to Follow Up Boss', { eventId: result.id });
    return { success: true, eventId: result.id };
  } catch (error) {
    logger.error('Failed to forward CHFA DPA lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardGhopeLeadToFollowUpBoss = async (submission) => {
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

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
    system: 'SAA Homes Website',
    type: 'Registration',
    message: messageLines.join('\n'),
    person: {
      firstName: first_name,
      lastName: last_name,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['G-HOPE Greeley', 'Greeley Down Payment Assistance', 'Website Lead'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    logger.info('G-HOPE lead forwarded to Follow Up Boss', { eventId: result.id });
    return { success: true, eventId: result.id };
  } catch (error) {
    logger.error('Failed to forward G-HOPE lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

export const forwardMarketReportToFollowUpBoss = async (submission) => {
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const { firstName, lastName, email, phone, area, first_name, last_name } = submission;
  const resolvedFirstName = firstName || first_name;
  const resolvedLastName = lastName || last_name;

  const messageLines = [
    area ? `Market report requested for: ${area}` : 'Market report requested',
    ...buildAttributionLines(submission),
  ].filter(Boolean);

  const eventData = {
    source: 'Website Market Report Request',
    system: 'SAA Homes Website',
    type: 'Property Inquiry',
    message: messageLines.join('\n'),
    person: {
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      emails: email ? [{ value: email, type: 'work' }] : [],
      phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
      tags: ['Market Report Request'],
    },
  };

  try {
    const result = await postFollowUpBossEvent(eventData);
    logger.info('Market report lead forwarded to Follow Up Boss', { eventId: result.id });
    return { success: true, eventId: result.id };
  } catch (error) {
    logger.error('Failed to forward market report lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};
