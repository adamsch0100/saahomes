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
};

export default marketPack;
