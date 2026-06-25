export const GA4_MEASUREMENT_ID = 'G-CB5GL0P3EZ';

export function trackLeadConversion(leadType, metadata = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', 'generate_lead', {
    currency: 'USD',
    value: 1,
    lead_type: leadType,
    page_path: metadata.sourcePage || window.location.pathname,
    landing_page: metadata.landingPage || undefined,
    utm_source: metadata.utmSource || undefined,
    utm_medium: metadata.utmMedium || undefined,
    utm_campaign: metadata.utmCampaign || undefined,
  });
}
