// /resources/ index — the hub that links every sourced stat page, so the
// citation pages have a parent URL and a second internal path in.

import {
  CITATION_HUB_PATH,
  CITATION_HUB_DESCRIPTION,
  CITATION_HUB_LAST_UPDATED,
} from "./citationHubStats.js";
import {
  CHFA_COUNTY_LIMITS_PATH,
  CHFA_COUNTY_LIMITS_DESCRIPTION,
  CHFA_COUNTY_LIMITS_LAST_UPDATED,
} from "./chfaCountyLimits.js";
import {
  MORTGAGE_RATES_PATH,
  MORTGAGE_RATES_DESCRIPTION,
  MORTGAGE_RATES_LAST_UPDATED,
} from "./mortgageRatesStats.js";

export const RESOURCES_PATH = "/resources/";
export const RESOURCES_URL = `https://saahomes.com${RESOURCES_PATH}`;
export const RESOURCES_TITLE =
  "Northern Colorado Housing Data & Statistics to Cite | SAA Homes";
export const RESOURCES_DESCRIPTION =
  "Free, sourced and dated housing statistics for Northern Colorado and the U.S.: mortgage rates, CHFA income and purchase price limits, and local market figures. Every number links to its primary source and is ready to cite.";

export const RESOURCE_PAGES = [
  {
    path: CITATION_HUB_PATH,
    title: "Northern Colorado Housing Statistics 2026",
    description: CITATION_HUB_DESCRIPTION,
    updated: CITATION_HUB_LAST_UPDATED,
  },
  {
    path: MORTGAGE_RATES_PATH,
    title: "Mortgage Rates 2026: Weekly 30 & 15-Year Fixed Averages",
    description: MORTGAGE_RATES_DESCRIPTION,
    updated: MORTGAGE_RATES_LAST_UPDATED,
  },
  {
    path: CHFA_COUNTY_LIMITS_PATH,
    title: "CHFA Income & Purchase Price Limits 2026 by County",
    description: CHFA_COUNTY_LIMITS_DESCRIPTION,
    updated: CHFA_COUNTY_LIMITS_LAST_UPDATED,
  },
];
