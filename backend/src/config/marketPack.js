/**
 * Market content pack v1 — Northern Colorado (NoCO).
 *
 * Plain data/config only: no logic, no I/O, no side effects.
 * Nurture emails and backend copy read from this module so a future
 * market pack (Denver, etc.) can swap in by replacing this one file.
 *
 * Productization track P-4: engine = market-agnostic; local depth + brand
 * live here as a swappable content pack.
 */
export const marketPack = {
  market: {
    name: 'Northern Colorado',
    tagline: 'Local depth for Larimer, Weld & Boulder County real estate',
    phone: '(970) 999-1407',
    tel: 'tel:+19709991407',
    brand: 'SAA Homes',
    brokerage: 'Schwartz and Associates',
    siteUrl: 'https://saahomes.com',
  },

  /** Display names for the 27 city/region hubs (from src/data/areaSeo.js). */
  cities: [
    'Fort Collins',
    'Loveland',
    'Windsor',
    'Greeley',
    'Timnath',
    'Wellington',
    'Johnstown',
    'Eaton',
    'Milliken',
    'La Salle',
    'Mead',
    'Longmont',
    'Boulder',
    'Berthoud',
    'Firestone',
    'Frederick',
    'Evans',
    'Severance',
    'Niwot',
    'Erie',
    'Brighton',
    'Carbon Valley',
    'Estes Park',
    'Red Feather Lakes',
    'Fort Lupton',
    'Lyons',
    'Bellvue',
  ],

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
    hubUrl: 'https://saahomes.com/chfa-down-payment-assistance/',
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
