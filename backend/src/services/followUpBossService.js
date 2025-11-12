import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const FOLLOW_UP_BOSS_API_KEY = process.env.FOLLOW_UP_BOSS_API_KEY;
const FOLLOW_UP_BOSS_WEBHOOK_URL = process.env.FOLLOW_UP_BOSS_WEBHOOK_URL;

// Helper function to create Basic Auth header
const getAuthHeader = (apiKey) => {
  // Follow Up Boss uses Basic Auth with API key as username and empty password
  const encoded = Buffer.from(`${apiKey}:`).toString('base64');
  return `Basic ${encoded}`;
};

export const forwardContactToFollowUpBoss = async (submission) => {
  // If no API credentials configured, skip silently
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const { name, email, phone, interest, message, area } = submission;

  // Split name into first and last
  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0] || name;
  const lastName = nameParts.slice(1).join(' ') || '';

  // Map form data to Follow Up Boss API format
  const personData = {
    firstName: firstName,
    lastName: lastName,
    emails: email ? [{ value: email, type: 'work' }] : [],
    phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
    source: 'Website Contact Form',
    tags: ['Website Lead'],
  };

  // Add notes if message exists
  if (message) {
    personData.notes = [{
      content: message,
      type: 'note',
    }];
  }

  // Add custom fields if available
  if (interest || area) {
    personData.customFields = {};
    if (interest) personData.customFields.interest = interest;
    if (area) personData.customFields.area = area;
  }

  try {
    let response;
    
    if (FOLLOW_UP_BOSS_WEBHOOK_URL) {
      // Use webhook URL if provided
      response = await fetch(FOLLOW_UP_BOSS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOLLOW_UP_BOSS_API_KEY && { 'Authorization': getAuthHeader(FOLLOW_UP_BOSS_API_KEY) }),
        },
        body: JSON.stringify(personData),
      });
    } else if (FOLLOW_UP_BOSS_API_KEY) {
      // Use Follow Up Boss API endpoint
      response = await fetch('https://api.followupboss.com/v1/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(FOLLOW_UP_BOSS_API_KEY),
        },
        body: JSON.stringify(personData),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Follow Up Boss API error', { status: response.status, error: errorText });
      throw new Error(`Follow Up Boss API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    logger.info('Lead forwarded to Follow Up Boss', { personId: result.id });
    return { success: true, personId: result.id };
  } catch (error) {
    logger.error('Failed to forward lead to Follow Up Boss', error);
    // Don't throw - we don't want to fail the submission if CRM forwarding fails
    return { success: false, error: error.message };
  }
};

export const forwardMarketReportToFollowUpBoss = async (submission) => {
  // If no API credentials configured, skip silently
  if (!FOLLOW_UP_BOSS_API_KEY && !FOLLOW_UP_BOSS_WEBHOOK_URL) {
    logger.info('Follow Up Boss not configured, skipping lead forwarding');
    return { success: false, reason: 'not_configured' };
  }

  const { firstName, lastName, email, phone, area } = submission;

  // Map form data to Follow Up Boss API format
  const personData = {
    firstName: firstName,
    lastName: lastName,
    emails: email ? [{ value: email, type: 'work' }] : [],
    phones: phone ? [{ value: phone.replace(/\D/g, ''), type: 'mobile' }] : [],
    source: 'Website Market Report Request',
    tags: ['Market Report Request'],
  };

  // Add custom fields if available
  if (area) {
    personData.customFields = { area };
  }

  try {
    let response;
    
    if (FOLLOW_UP_BOSS_WEBHOOK_URL) {
      response = await fetch(FOLLOW_UP_BOSS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(FOLLOW_UP_BOSS_API_KEY && { 'Authorization': getAuthHeader(FOLLOW_UP_BOSS_API_KEY) }),
        },
        body: JSON.stringify(personData),
      });
    } else if (FOLLOW_UP_BOSS_API_KEY) {
      response = await fetch('https://api.followupboss.com/v1/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(FOLLOW_UP_BOSS_API_KEY),
        },
        body: JSON.stringify(personData),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Follow Up Boss API error', { status: response.status, error: errorText });
      throw new Error(`Follow Up Boss API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    logger.info('Market report lead forwarded to Follow Up Boss', { personId: result.id });
    return { success: true, personId: result.id };
  } catch (error) {
    logger.error('Failed to forward market report lead to Follow Up Boss', error);
    return { success: false, error: error.message };
  }
};

