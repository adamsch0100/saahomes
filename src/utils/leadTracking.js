const STORAGE_KEY = 'saa_lead_attribution';

export function captureLeadAttribution() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');

  const attribution = {
    utmSource: params.get('utm_source') || stored.utmSource || null,
    utmMedium: params.get('utm_medium') || stored.utmMedium || null,
    utmCampaign: params.get('utm_campaign') || stored.utmCampaign || null,
    landingPage: stored.landingPage || window.location.pathname,
    referrer: stored.referrer || document.referrer || null,
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  return attribution;
}

export function getLeadMetadata(sourcePage = '') {
  const attribution = captureLeadAttribution();

  return {
    sourcePage: sourcePage || (typeof window !== 'undefined' ? window.location.pathname : ''),
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    landingPage: attribution.landingPage,
    referrer: attribution.referrer,
  };
}

export function withLeadMetadata(formData, sourcePage = '') {
  const metadata = getLeadMetadata(sourcePage);
  return { ...formData, ...metadata };
}
