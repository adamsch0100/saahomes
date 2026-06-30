/** Google tag ID (install snippet). Stream measurement ID: G-BVWCZE025P */
export const GA4_MEASUREMENT_ID = 'G-CB5GL0P3EZ';

/** Custom event name — often registers in GA4 Admin faster than generate_lead alone */
export const SAA_LEAD_EVENT = 'saa_lead_submit';

export function getGaClientId() {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieMatch = document.cookie.match(/(?:^|; )_ga=GA1\.1\.(\d+\.\d+)/);
  if (cookieMatch?.[1]) {
    return cookieMatch[1];
  }

  try {
    const stored = sessionStorage.getItem('saa_ga_client_id');
    if (stored) {
      return stored;
    }
    const generated = `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
    sessionStorage.setItem('saa_ga_client_id', generated);
    return generated;
  } catch {
    return null;
  }
}

function sendGaEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', eventName, {
    send_to: GA4_MEASUREMENT_ID,
    transport_type: 'beacon',
    ...params,
  });
}

/** Updates URL so GA4 Admin can create a key event from page_view without waiting on custom events */
function syncLeadSubmittedUrl(leadType) {
  if (typeof window === 'undefined' || !window.history?.replaceState) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('lead_submitted', leadType);
  window.history.replaceState({ leadSubmitted: leadType }, '', url.toString());

  if (typeof window.gtag === 'function') {
    window.gtag('config', GA4_MEASUREMENT_ID, {
      page_path: url.pathname + url.search,
      page_location: url.href,
    });
  }
}

export function trackLeadConversion(leadType, metadata = {}) {
  const eventParams = {
    currency: 'USD',
    value: 1,
    lead_type: leadType,
    page_path: metadata.sourcePage || (typeof window !== 'undefined' ? window.location.pathname : ''),
    landing_page: metadata.landingPage || undefined,
    utm_source: metadata.utmSource || undefined,
    utm_medium: metadata.utmMedium || undefined,
    utm_campaign: metadata.utmCampaign || undefined,
  };

  sendGaEvent('generate_lead', eventParams);
  sendGaEvent(SAA_LEAD_EVENT, eventParams);
  syncLeadSubmittedUrl(leadType);
}

/** Add ?ga_debug=1 to any URL to verify events in GA4 DebugView */
export function initGaDebugMode(searchParams) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  if (searchParams?.get('ga_debug') === '1') {
    window.gtag('config', GA4_MEASUREMENT_ID, { debug_mode: true });
  }
}
