import logger from '../utils/logger.js';

const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-CB5GL0P3EZ';
const API_SECRET = process.env.GA4_MEASUREMENT_API_SECRET;

function buildClientId(gaClientId) {
  if (gaClientId && /^\d+\.\d+$/.test(String(gaClientId))) {
    return String(gaClientId);
  }
  return `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
}

/**
 * Server-side GA4 event — reliable when browser tags are blocked or slow to register.
 * Requires GA4_MEASUREMENT_API_SECRET from Admin → Data streams → Measurement Protocol.
 */
export async function recordLeadConversion(leadType, metadata = {}) {
  if (!API_SECRET) {
    return;
  }

  const clientId = buildClientId(metadata.gaClientId);
  const pagePath = metadata.sourcePage || metadata.landingPage || '/';

  const eventParams = {
    currency: 'USD',
    value: 1,
    lead_type: leadType,
    page_path: pagePath,
    engagement_time_msec: 100,
  };

  if (metadata.landingPage) eventParams.landing_page = metadata.landingPage;
  if (metadata.utmSource) eventParams.utm_source = metadata.utmSource;
  if (metadata.utmMedium) eventParams.utm_medium = metadata.utmMedium;
  if (metadata.utmCampaign) eventParams.utm_campaign = metadata.utmCampaign;

  const payload = {
    client_id: clientId,
    events: [
      { name: 'generate_lead', params: eventParams },
      { name: 'saa_lead_submit', params: eventParams },
    ],
  };

  const url = new URL('https://www.google-analytics.com/mp/collect');
  url.searchParams.set('measurement_id', MEASUREMENT_ID);
  url.searchParams.set('api_secret', API_SECRET);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn('GA4 Measurement Protocol request failed', {
        status: response.status,
        leadType,
      });
    }
  } catch (error) {
    logger.warn('GA4 Measurement Protocol error (non-blocking)', {
      leadType,
      message: error.message,
    });
  }
}
