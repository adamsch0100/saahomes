// Northern Colorado housing statistics — verified stat inventory for the
// citation hub at /resources/northern-colorado-housing-statistics-2026/.
//
// HARD RULE: every figure below passed the citation gate (live primary URL
// fetched, figure matches the source, date present and not stale). Sources:
// bus/citation-hub/verified-stats-20260930.md and
// bus/evidence/citation-hub-refresh-20261001.md. Do not add an unverified
// number to this file.

export const CITATION_HUB_PATH = "/resources/northern-colorado-housing-statistics-2026/";
export const CITATION_HUB_URL = `https://saahomes.com${CITATION_HUB_PATH}`;
export const CITATION_HUB_TITLE =
  "Northern Colorado Housing Statistics 2026 | SAA Homes";
export const CITATION_HUB_DESCRIPTION =
  "Free, sourced, dated Northern Colorado housing statistics: the national mortgage-rate context, CHFA income and purchase price limits for Larimer and Weld counties, and U.S. Census figures for Fort Collins and Windsor. Every number links to its primary source — ready to cite.";
export const CITATION_HUB_LAST_UPDATED = "2026-10-01";

const CHFA_SOURCE_ORG = "Colorado Housing and Finance Authority";
const CHFA_SOURCE_LABEL = "CHFA Income & Purchase Price Limits (PDF)";
const CHFA_SOURCE_URL =
  "https://www.chfainfo.com/getattachment/0d14dd17-fdaa-4cc8-8cb1-b1407d7beca9/CHFA-_Income_Limits.pdf";

const CENSUS_SOURCE_ORG = "U.S. Census Bureau";
const CENSUS_SOURCE_LABEL = "QuickFacts — Fort Collins city, Colorado";
const CENSUS_SOURCE_URL =
  "https://www.census.gov/quickfacts/fact/table/fortcollinscitycolorado/PST045224";

const WINDSOR_CENSUS_SOURCE_LABEL = "QuickFacts — Windsor town, Colorado";
const WINDSOR_CENSUS_SOURCE_URL =
  "https://www.census.gov/quickfacts/fact/table/windsortowncolorado/PST045224";

const PMMS_SOURCE_ORG = "Freddie Mac";
const PMMS_SOURCE_LABEL = "Primary Mortgage Market Survey (PMMS)";
const PMMS_SOURCE_URL = "https://www.freddiemac.com/pmms";

const FRED_SOURCE_ORG = "Realtor.com via FRED";
const FRED_SOURCE_LABEL = "Median Listing Price, Fort Collins (MEDLISPRI22660)";
const FRED_SOURCE_URL = "https://fred.stlouisfed.org/series/MEDLISPRI22660";

export const CITATION_HUB_LAYERS = [
  {
    id: "national",
    label: "National context",
    blurb: "The mortgage-rate backdrop that sets what a monthly payment costs anywhere in Colorado.",
  },
  {
    id: "state",
    label: "Colorado / CHFA",
    blurb: "State program limits that decide what a Colorado buyer can afford.",
  },
  {
    id: "local",
    label: "Larimer & Weld counties",
    blurb: "CHFA limits and market figures for the counties Schwartz and Associates serves — Fort Collins, Windsor, and Greeley.",
  },
  {
    id: "outside",
    label: "Other Colorado counties",
    blurb: "Additional CHFA county rows, kept for reference. Also verified and ready to cite.",
  },
];


export const CITATION_HUB_STATS = [
  {
    id: "stat-national-mortgage-rate-2026",
    layer: "national",
    claim:
      "The 30-year fixed mortgage rate averaged 6.67% as of August 13, 2026, down from 6.69% the prior week and up from 6.58% a year earlier.",
    figures: [
      { label: "30-year fixed, week of Aug 13, 2026", value: "6.67%" },
      { label: "Prior week", value: "6.69%" },
      { label: "A year earlier", value: "6.58%" },
    ],
    asOf: "Week ending 2026-08-13",
    sourceOrg: PMMS_SOURCE_ORG,
    sourceLabel: PMMS_SOURCE_LABEL,
    sourceUrl: PMMS_SOURCE_URL,
    verified: "2026-10-01",
    cite:
      "The 30-year fixed mortgage rate averaged 6.67% the week of August 13, 2026 (6.69% prior week; 6.58% a year earlier). Source: Freddie Mac Primary Mortgage Market Survey.",
    moneyLinks: [
      { to: "/mortgage-calculator/", label: "Mortgage Calculator" },
      { to: "/for-buyers/", label: "Northern Colorado Buyer Guide" },
    ],
  },
  {
    id: "stat-chfa-dpa-grant-2026",
    layer: "state",
    claim:
      "CHFA down payment assistance is a grant up to the lesser of $25,000 or 3% of the first mortgage (no repayment), with a second mortgage up to the lesser of $25,000 or 4% (deferred).",
    figures: [
      { label: "Grant (no repayment)", value: "≤ $25,000 or 3%" },
      { label: "Second mortgage (deferred)", value: "≤ $25,000 or 4%" },
    ],
    asOf: "2026 program terms",
    note: "Permanent-disability and first-generation buyers may receive up to $25,000 regardless of loan amount.",
    sourceOrg: CHFA_SOURCE_ORG,
    sourceLabel: "CHFA Down Payment Assistance",
    sourceUrl: "https://www.chfainfo.com/homeownership/down-payment-assistance",
    verified: "2026-10-01",
    cite:
      "CHFA down payment assistance: grant up to the lesser of $25,000 or 3% of the first mortgage; a second mortgage up to the lesser of $25,000 or 4%. Source: Colorado Housing and Finance Authority.",
    moneyLinks: [
      { to: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
    ],
  },
  {
    id: "stat-chfa-loan-cap-2026",
    layer: "state",
    claim:
      "The CHFA 2026 maximum total loan limit is $832,750, effective for locks on or after June 15, 2026.",
    figures: [{ label: "Maximum total loan limit", value: "$832,750" }],
    asOf: "Effective for locks on or after 2026-06-15",
    note: "Also the FirstStep and FirstGeneration purchase-price cap.",
    sourceOrg: CHFA_SOURCE_ORG,
    sourceLabel: CHFA_SOURCE_LABEL,
    sourceUrl: CHFA_SOURCE_URL,
    verified: "2026-10-01",
    cite:
      "The CHFA 2026 maximum total loan limit is $832,750, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
    moneyLinks: [
      { to: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
      { to: "/colorado-champions-home-loan-program/", label: "Colorado Champions Home Loan" },
    ],
  },
  {
    id: "stat-chfa-income-limits-larimer-2026",
    layer: "local",
    claim:
      "CHFA income limits for Larimer County are $130,400 (1–2 person) and $149,960 (3+ person) in non-targeted areas, and $156,480 / $182,560 in targeted areas. The purchase price limit is $664,190 non-targeted / $811,790 targeted.",
    figures: [
      { label: "Non-targeted, 1–2 person", value: "$130,400" },
      { label: "Non-targeted, 3+ person", value: "$149,960" },
      { label: "Targeted, 1–2 person", value: "$156,480" },
      { label: "Targeted, 3+ person", value: "$182,560" },
    ],
    asOf: "Effective for locks on or after 2026-06-15",
    sourceOrg: CHFA_SOURCE_ORG,
    sourceLabel: CHFA_SOURCE_LABEL,
    sourceUrl: CHFA_SOURCE_URL,
    verified: "2026-10-01",
    cite:
      "CHFA 2026 limits, Larimer County: income $130,400 (1–2) / $149,960 (3+) non-targeted and $156,480 / $182,560 targeted; purchase price $664,190 non-targeted / $811,790 targeted, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
    moneyLinks: [
      { to: "/resources/colorado-chfa-income-limits-2026/", label: "CHFA Limits by County 2026" },
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
    ],
  },
  {
    id: "stat-chfa-income-limits-weld-2026",
    layer: "local",
    claim:
      "CHFA income limits for Weld County are $153,600 (1–2 person) and $179,200 (3+ person), the same in targeted and non-targeted areas. The purchase price limit is $735,320.",
    figures: [
      { label: "1–2 person household", value: "$153,600" },
      { label: "3+ person household", value: "$179,200" },
      { label: "Purchase price limit", value: "$735,320" },
    ],
    asOf: "Effective for locks on or after 2026-06-15",
    sourceOrg: CHFA_SOURCE_ORG,
    sourceLabel: CHFA_SOURCE_LABEL,
    sourceUrl: CHFA_SOURCE_URL,
    verified: "2026-10-01",
    cite:
      "CHFA 2026 limits, Weld County: income $153,600 (1–2) / $179,200 (3+), targeted and non-targeted alike; purchase price $735,320, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
    moneyLinks: [
      { to: "/resources/colorado-chfa-income-limits-2026/", label: "CHFA Limits by County 2026" },
      { to: "/northern-colorado-areas/greeley/", label: "Greeley Real Estate Guide" },
    ],
  },
  {
    id: "stat-fort-collins-median-list-price-2026",
    layer: "local",
    claim:
      "The median listing price in Fort Collins was $575,000 in August 2026, down from $595,000 in April.",
    figures: [
      { label: "August 2026", value: "$575,000" },
      { label: "July 2026", value: "$577,225" },
      { label: "April 2026", value: "$595,000" },
    ],
    asOf: "August 2026",
    sourceOrg: FRED_SOURCE_ORG,
    sourceLabel: FRED_SOURCE_LABEL,
    sourceUrl: FRED_SOURCE_URL,
    verified: "2026-10-01",
    cite:
      "Median listing price in Fort Collins, Colorado: $575,000 in August 2026 (from $595,000 in April 2026). Source: Realtor.com via FRED series MEDLISPRI22660.",
    moneyLinks: [
      { to: "/resources/colorado-chfa-income-limits-2026/", label: "CHFA Limits by County 2026" },
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
    ],
  },
  {
    id: "stat-windsor-housing-2026",
    layer: "local",
    claim:
      "In Windsor, Colorado, the median value of owner-occupied homes is $604,000, the owner-occupied rate is 77.6%, and population is 43,840 (July 1, 2025 estimate).",
    figures: [
      { label: "Median owner-occupied home value", value: "$604,000" },
      { label: "Owner-occupied rate", value: "77.6%" },
      { label: "Median gross rent", value: "$1,793" },
      { label: "Population (Jul 1, 2025 est.)", value: "43,840" },
    ],
    asOf: "ACS 2020–2024 5-year estimates; population July 1, 2025 estimate",
    sourceOrg: CENSUS_SOURCE_ORG,
    sourceLabel: WINDSOR_CENSUS_SOURCE_LABEL,
    sourceUrl: WINDSOR_CENSUS_SOURCE_URL,
    verified: "2026-10-01",
    cite:
      "Windsor, Colorado: median owner-occupied home value $604,000; owner-occupied rate 77.6%; population 43,840 (U.S. Census Bureau, ACS 2020–2024 / QuickFacts).",
    moneyLinks: [
      { to: "/northern-colorado-areas/windsor/", label: "Windsor Real Estate Guide" },
    ],
  },
  {
    id: "stat-chfa-income-limits-boulder-2026",
    layer: "outside",
    claim:
      "CHFA income limits for Boulder County are $150,000 for 1–2 person households and $172,500 for 3+ person households.",
    figures: [
      { label: "1–2 person household", value: "$150,000" },
      { label: "3+ person household", value: "$172,500" },
    ],
    asOf: "Effective for locks on or after 2026-06-15",
    note: "Per the CHFA limits table, the Boulder County figures are the same for non-targeted and targeted areas.",
    sourceOrg: CHFA_SOURCE_ORG,
    sourceLabel: CHFA_SOURCE_LABEL,
    sourceUrl: CHFA_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "CHFA income limits, Boulder County: $150,000 (1–2 person) / $172,500 (3+ person), effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
    moneyLinks: [
      { to: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
      { to: "/colorado-champions-home-loan-program/", label: "Colorado Champions Home Loan" },
    ],
  },
  {
    id: "stat-chfa-income-limits-adams-2026",
    layer: "outside",
    claim:
      "CHFA income limits for Adams County are $144,000 (1–2 person) and $165,600 (3+ person) in non-targeted areas, and $172,800 / $201,600 in targeted areas.",
    figures: [
      { label: "Non-targeted, 1–2 person", value: "$144,000" },
      { label: "Non-targeted, 3+ person", value: "$165,600" },
      { label: "Targeted, 1–2 person", value: "$172,800" },
      { label: "Targeted, 3+ person", value: "$201,600" },
    ],
    asOf: "Effective for locks on or after 2026-06-15",
    sourceOrg: CHFA_SOURCE_ORG,
    sourceLabel: CHFA_SOURCE_LABEL,
    sourceUrl: CHFA_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "CHFA income limits, Adams County: $144,000 / $165,600 non-targeted; $172,800 / $201,600 targeted, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
    moneyLinks: [
      { to: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
    ],
  },
  {
    id: "stat-chfa-purchase-price-limits-2026",
    layer: "outside",
    claim:
      "The CHFA purchase price limit is $832,750 for both Boulder County and Adams County.",
    figures: [
      { label: "Boulder County", value: "$832,750" },
      { label: "Adams County", value: "$832,750" },
    ],
    asOf: "Effective for locks on or after 2026-06-15",
    note: "The same limit applies to non-targeted and targeted areas in both counties.",
    sourceOrg: CHFA_SOURCE_ORG,
    sourceLabel: CHFA_SOURCE_LABEL,
    sourceUrl: CHFA_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "CHFA purchase price limit, Boulder and Adams counties: $832,750, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
    moneyLinks: [
      { to: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
      { to: "/colorado-champions-home-loan-program/", label: "Colorado Champions Home Loan" },
    ],
  },
  {
    id: "stat-fort-collins-median-home-value-2026",
    layer: "local",
    claim:
      "The median value of owner-occupied housing units in Fort Collins, Colorado is $577,900.",
    figures: [{ label: "Median owner-occupied home value", value: "$577,900" }],
    asOf: "ACS 2020–2024 5-year estimates",
    sourceOrg: CENSUS_SOURCE_ORG,
    sourceLabel: CENSUS_SOURCE_LABEL,
    sourceUrl: CENSUS_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "Median value of owner-occupied housing units in Fort Collins, Colorado: $577,900 (U.S. Census Bureau, ACS 2020–2024).",
    moneyLinks: [
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
      { to: "/for-buyers/", label: "Northern Colorado Buyer Guide" },
    ],
  },
  {
    id: "stat-fort-collins-median-rent-2026",
    layer: "local",
    claim: "Median gross rent in Fort Collins, Colorado is $1,690.",
    figures: [{ label: "Median gross rent", value: "$1,690" }],
    asOf: "ACS 2020–2024 5-year estimates",
    sourceOrg: CENSUS_SOURCE_ORG,
    sourceLabel: CENSUS_SOURCE_LABEL,
    sourceUrl: CENSUS_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "Median gross rent in Fort Collins, Colorado: $1,690 (U.S. Census Bureau, ACS 2020–2024).",
    moneyLinks: [
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
    ],
  },
  {
    id: "stat-fort-collins-owner-occupied-rate-2026",
    layer: "local",
    claim:
      "The owner-occupied housing unit rate in Fort Collins, Colorado is 51.6%.",
    figures: [{ label: "Owner-occupied housing unit rate", value: "51.6%" }],
    asOf: "ACS 2020–2024 5-year estimates",
    sourceOrg: CENSUS_SOURCE_ORG,
    sourceLabel: CENSUS_SOURCE_LABEL,
    sourceUrl: CENSUS_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "Owner-occupied housing unit rate in Fort Collins, Colorado: 51.6% (U.S. Census Bureau, ACS 2020–2024).",
    moneyLinks: [
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
    ],
  },
  {
    id: "stat-fort-collins-owner-costs-2026",
    layer: "local",
    claim:
      "Median monthly owner costs with a mortgage in Fort Collins, Colorado are $2,287.",
    figures: [{ label: "Median monthly owner costs, with a mortgage", value: "$2,287" }],
    asOf: "ACS 2020–2024 5-year estimates",
    sourceOrg: CENSUS_SOURCE_ORG,
    sourceLabel: CENSUS_SOURCE_LABEL,
    sourceUrl: CENSUS_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "Median monthly owner costs with a mortgage in Fort Collins, Colorado: $2,287 (U.S. Census Bureau, ACS 2020–2024).",
    moneyLinks: [
      { to: "/mortgage-calculator/", label: "Mortgage Calculator" },
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
    ],
  },
  {
    id: "stat-fort-collins-household-income-2026",
    layer: "local",
    claim:
      "Median household income in Fort Collins, Colorado is $85,070 (2024 dollars).",
    figures: [{ label: "Median household income (2024 dollars)", value: "$85,070" }],
    asOf: "ACS 2020–2024 5-year estimates",
    sourceOrg: CENSUS_SOURCE_ORG,
    sourceLabel: CENSUS_SOURCE_LABEL,
    sourceUrl: CENSUS_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "Median household income in Fort Collins, Colorado: $85,070 in 2024 dollars (U.S. Census Bureau, ACS 2020–2024).",
    moneyLinks: [
      { to: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
    ],
  },
  {
    id: "stat-fort-collins-population-2026",
    layer: "local",
    claim:
      "The population of Fort Collins, Colorado was estimated at 171,500 on July 1, 2025.",
    figures: [{ label: "Population (July 1, 2025 estimate)", value: "171,500" }],
    asOf: "July 1, 2025 estimate",
    sourceOrg: CENSUS_SOURCE_ORG,
    sourceLabel: CENSUS_SOURCE_LABEL,
    sourceUrl: CENSUS_SOURCE_URL,
    verified: "2026-09-30",
    cite:
      "Population of Fort Collins, Colorado: 171,500 as of July 1, 2025 (U.S. Census Bureau QuickFacts).",
    moneyLinks: [
      { to: "/northern-colorado-areas/fort-collins/", label: "Fort Collins Real Estate Guide" },
    ],
  },
];

export const CITATION_HUB_FAQS = [
  {
    q: "What are the CHFA income limits in Colorado for 2026?",
    a: "CHFA income limits vary by county and household size and by whether the home is in a targeted area. Verified figures on this page include Larimer County at $130,400 (1–2 person) and $149,960 (3+ person) non-targeted and $156,480 / $182,560 targeted, Weld County at $153,600 / $179,200, Boulder County at $150,000 / $172,500, and Adams County at $144,000 / $165,600 non-targeted and $172,800 / $201,600 targeted, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority. Limits are updated periodically — confirm current figures with CHFA or a participating lender.",
  },
  {
    q: "What is the CHFA maximum loan limit for 2026?",
    a: "The CHFA 2026 maximum total loan limit is $832,750, effective for locks on or after June 15, 2026. It is also the purchase-price cap for the CHFA FirstStep and FirstGeneration programs. Source: Colorado Housing and Finance Authority Income & Purchase Price Limits table.",
  },
  {
    q: "What is the median home value in Fort Collins, Colorado?",
    a: "The median value of owner-occupied housing units in Fort Collins, Colorado is $577,900, per the U.S. Census Bureau's American Community Survey 2020–2024 5-year estimates (QuickFacts). The median gross rent is $1,690 and median household income is $85,070. The median listing price was $575,000 in August 2026 (Realtor.com via FRED).",
  },
  {
    q: "What are the housing statistics for Windsor, Colorado?",
    a: "In Windsor, Colorado, the median value of owner-occupied homes is $604,000, the owner-occupied rate is 77.6%, median gross rent is $1,793, and population was estimated at 43,840 on July 1, 2025, per the U.S. Census Bureau (ACS 2020–2024 and QuickFacts).",
  },
  {
    q: "How often is this Northern Colorado housing statistics page updated?",
    a: "Each figure is re-verified against its primary source and the 'Last updated' date only changes when a real re-verification or addition lands. CHFA limits are re-checked when CHFA publishes new limits, the mortgage rate is re-checked on Freddie Mac's weekly release, and U.S. Census figures are re-checked when the Census Bureau releases new estimates.",
  },
  {
    q: "Can I cite these Northern Colorado housing statistics?",
    a: "Yes. Every figure on this page links to its primary source and shows the date it was verified. You may cite the figure and link to the source, or link to this page's stable anchor for the statistic (for example, #stat-chfa-income-limits-larimer-2026).",
  },
];
