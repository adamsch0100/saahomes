// Northern Colorado housing statistics — verified stat inventory for the
// citation hub at /resources/northern-colorado-housing-statistics-2026/.
//
// HARD RULE: every figure below passed the citation gate (live primary URL
// fetched, figure matches the source, date present and not stale). Quarantined
// rows (Freddie Mac PMMS rate — stale as-of date; CHFA Larimer/Weld rows — read
// via search rendering) are intentionally absent until they are re-fetched.
// Sources: bus/citation-hub/verified-stats-20260930.md and
// bus/citation-hub/citation-hub-file-20260930.md. Do not add an unverified
// number to this file.

export const CITATION_HUB_PATH = "/resources/northern-colorado-housing-statistics-2026/";
export const CITATION_HUB_URL = `https://saahomes.com${CITATION_HUB_PATH}`;
export const CITATION_HUB_TITLE =
  "Northern Colorado Housing Statistics 2026 | SAA Homes";
export const CITATION_HUB_DESCRIPTION =
  "Free, sourced, dated Northern Colorado housing statistics: CHFA income and purchase price limits by county plus U.S. Census figures for Fort Collins. Every number links to its primary source — ready to cite.";
export const CITATION_HUB_LAST_UPDATED = "2026-09-30";

const CHFA_SOURCE_ORG = "Colorado Housing and Finance Authority";
const CHFA_SOURCE_LABEL = "CHFA Income & Purchase Price Limits (PDF)";
const CHFA_SOURCE_URL =
  "https://www.chfainfo.com/getattachment/0d14dd17-fdaa-4cc8-8cb1-b1407d7beca9/CHFA-_Income_Limits.pdf";

const CENSUS_SOURCE_ORG = "U.S. Census Bureau";
const CENSUS_SOURCE_LABEL = "QuickFacts — Fort Collins city, Colorado";
const CENSUS_SOURCE_URL =
  "https://www.census.gov/quickfacts/fact/table/fortcollinscitycolorado/PST045224";

export const CITATION_HUB_LAYERS = [
  { id: "state", label: "Colorado / CHFA", blurb: "State program limits that decide what a Colorado buyer can afford." },
  { id: "local", label: "Fort Collins / Larimer County", blurb: "U.S. Census figures for the largest Northern Colorado market." },
];

export const CITATION_HUB_STATS = [
  {
    id: "stat-chfa-income-limits-boulder-2026",
    layer: "state",
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
    layer: "state",
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
    layer: "state",
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
    a: "CHFA income limits vary by county and household size and by whether the home is in a targeted area. Verified figures on this page include Boulder County at $150,000 (1–2 person) and $172,500 (3+ person), and Adams County at $144,000 / $165,600 non-targeted and $172,800 / $201,600 targeted, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority. Limits are updated periodically — confirm current figures with CHFA or a participating lender.",
  },
  {
    q: "What is the CHFA purchase price limit in Boulder County?",
    a: "The CHFA purchase price limit for Boulder County is $832,750, effective for locks on or after June 15, 2026. The same $832,750 limit applies to Adams County. Source: Colorado Housing and Finance Authority Income & Purchase Price Limits table.",
  },
  {
    q: "What is the median home value in Fort Collins, Colorado?",
    a: "The median value of owner-occupied housing units in Fort Collins, Colorado is $577,900, per the U.S. Census Bureau's American Community Survey 2020–2024 5-year estimates (QuickFacts). The median gross rent is $1,690 and median household income is $85,070.",
  },
  {
    q: "How often is this Northern Colorado housing statistics page updated?",
    a: "Each figure is re-verified against its primary source and the 'Last updated' date only changes when a real re-verification or addition lands. CHFA limits are re-checked when CHFA publishes new limits, and U.S. Census figures are re-checked when the Census Bureau releases new estimates.",
  },
  {
    q: "Can I cite these Northern Colorado housing statistics?",
    a: "Yes. Every figure on this page links to its primary source and shows the date it was verified. You may cite the figure and link to the source, or link to this page's stable anchor for the statistic (for example, #stat-fort-collins-median-home-value-2026).",
  },
];
