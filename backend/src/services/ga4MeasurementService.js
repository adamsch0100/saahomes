import logger from '../utils/logger.js';

/** Same stream as src/utils/analytics.js — GA4_MEASUREMENT_ID can override. */
const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-CB5GL0P3EZ';
/** Railway saahomes env: GA4 Admin → Data streams → Measurement Protocol secrets. */
const API_SECRET = process.env.GA4_API_SECRET || process.env.GA4_MEASUREMENT_API_SECRET;

function buildClientId(gaClientId) {
  if (gaClientId && /^\d+\.\d+$/.test(String(gaClientId))) {
    return String(gaClientId);
  }
  return `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
}

/**
 * Server-side GA4 event — reliable when browser tags are blocked or slow to register.
 * Requires GA4_API_SECRET from Admin → Data streams → Measurement Protocol.
 *
 * @returns {Promise<{fired: boolean, skipped?: boolean, status?: number, reason?: string, error?: string, clientId?: string}>}
 *   Never throws. `fired: true` means Google accepted the batch (HTTP 2xx/204).
 *   `clientId` is the GA4 client_id the events were sent under, so the submit
 *   log keeps a handle to find them in GA4 DebugView.
 */
export async function recordLeadConversion(leadType, metadata = {}) {
  if (!API_SECRET) {
    return { fired: false, skipped: true, reason: 'no_api_secret' };
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
      return {
        fired: false,
        status: response.status,
        clientId,
        error: `GA4 Measurement Protocol returned ${response.status}`,
      };
    }
    return { fired: true, status: response.status, clientId };
  } catch (error) {
    logger.warn('GA4 Measurement Protocol error (non-blocking)', {
      leadType,
      message: error.message,
    });
    return { fired: false, clientId, error: error.message };
  }
}
