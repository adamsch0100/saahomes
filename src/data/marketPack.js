/**
 * Market content pack v1 — Northern Colorado (NoCO).
 *
 * Frontend twin of backend/src/config/marketPack.js.
 * Plain data/config only: no logic, no I/O, no side effects.
 * Same shape as the backend pack so a future market is a drop-in swap.
 *
 * Derives phone/brand/cities from seoConstants + areaSeo to avoid
 * inventing a second source of truth on the frontend.
 */
import { BUSINESS, SITE_NAME, SITE_URL } from '../utils/seoConstants.js';
import { areaSeoPages } from './areaSeo.js';

export const marketPack = {
  market: {
    name: 'Northern Colorado',
    tagline: 'Local depth for Larimer, Weld & Boulder County real estate',
    phone: BUSINESS.telephone,
    tel: `tel:${String(BUSINESS.telephone || '').replace(/\D/g, '')}`,
    brand: SITE_NAME,
    brokerage: BUSINESS.name,
    siteUrl: SITE_URL,
  },

  /** Display names for the 27 city/region hubs (from areaSeo.js). */
  cities: areaSeoPages.map((a) => a.city),

  sources: {
    ires: 'live IRES MLS feed',
    iresIdx:
      'IDX information provided by IRES. Listing data is believed reliable but not guaranteed.',
    greatschools: 'GreatSchools',
    greatschoolsUrl: 'https://www.greatschools.org',
    avmZillow: 'Zillow (via licensed API)',
    avmRealtor: 'Realtor.com AVMs (via licensed API)',
    saaMls: 'SAA Homes MLS data',
  },

  honestLabels: {
    estimate: 'Estimated range. Updated monthly. Not an appraisal.',
    estimateFallback:
      'Estimated range based on local sales data. Updated monthly. Not an appraisal.',
    listingCount: 'from the live IRES MLS feed',
    schoolRating: 'Ratings from GreatSchools',
    notAppraisal: 'Estimates only, not appraisals.',
  },

  dpa: {
    chfaLine:
      'CHFA down payment assistance programs may be available for qualified Colorado buyers — ask us how they work in Northern Colorado.',
    hubPath: '/chfa-down-payment-assistance/',
    hubUrl: `${SITE_URL}/chfa-down-payment-assistance/`,
  },

  fairHousing: 'Equal Housing Opportunity',

  footer: {
    depthLine:
      'Live listings for 27+ Northern Colorado cities from the live IRES MLS feed.',
    headerSubline: 'Schwartz and Associates · Northern Colorado Real Estate',
    brandLine: 'Schwartz and Associates · Fort Collins, CO',
  },

  /**
   * Default agent-voice for unassigned nurture (SAA).
   * Per-agent brand/voice is resolved server-side; this is the console fallback.
   */
  agentVoice: {
    defaultFromName: 'Adam Schwartz, SAA Homes',
    defaultSignOff: 'Adam & Mandi Schwartz',
    defaultVoice: 'warm',
    voiceStyles: ['warm', 'professional', 'short'],
  },
};

/**
 * Resolve tenant brand for UI (agent console / brand preview).
 * Mirrors backend getAgentBrand fallbacks — no invented data.
 *
 * @param {{ brand_name?: string|null, brokerage_name?: string|null, brand_phone?: string|null, phone?: string|null, name?: string|null, voice_style?: string|null, brand?: object }} agent
 */
export function resolveTenantBrand(agent) {
  const market = marketPack.market;
  const footer = marketPack.footer;
  if (!agent) {
    return {
      brandName: market.brand,
      brokerage: market.brokerage,
      phone: market.phone,
      tel: market.tel,
      voiceStyle: marketPack.agentVoice.defaultVoice,
      agentName: null,
      fromName: marketPack.agentVoice.defaultFromName,
      headerSubline: footer.headerSubline,
      brandLine: footer.brandLine,
      isCustom: false,
    };
  }
  // Prefer server-resolved brand object when present
  if (agent.brand && agent.brand.brandName) {
    return {
      brandName: agent.brand.brandName,
      brokerage: agent.brand.brokerage,
      phone: agent.brand.phone,
      tel: agent.brand.tel || market.tel,
      voiceStyle: agent.brand.voiceStyle || marketPack.agentVoice.defaultVoice,
      agentName: agent.name || null,
      fromName: agent.brand.fromName,
      headerSubline: agent.brand.headerSubline || footer.headerSubline,
      brandLine: agent.brand.brandLine || footer.brandLine,
      isCustom: !!agent.brand.isCustom,
    };
  }
  const brandName = (agent.brand_name || market.brand || '').trim() || market.brand;
  const brokerage = (agent.brokerage_name || market.brokerage || '').trim() || market.brokerage;
  const phone = (agent.brand_phone || agent.phone || market.phone || '').trim() || market.phone;
  const agentName = (agent.name || '').trim() || null;
  const voiceStyle = ['warm', 'professional', 'short'].includes(
    String(agent.voice_style || '').toLowerCase()
  )
    ? String(agent.voice_style).toLowerCase()
    : 'warm';
  return {
    brandName,
    brokerage,
    phone,
    tel: `tel:${String(phone).replace(/\D/g, '')}`,
    voiceStyle,
    agentName,
    fromName: agentName ? `${agentName} — ${brandName}` : marketPack.agentVoice.defaultFromName,
    headerSubline: `${brokerage} · ${market.name} Real Estate`,
    brandLine: `${brokerage} · Fort Collins, CO`,
    isCustom: !!(agent.brand_name || agent.brokerage_name || agent.brand_phone),
  };
}

export default marketPack;
