// CHFA 2026 income and purchase price limits by county — verified stat
// inventory for the companion page at
// /resources/colorado-chfa-income-limits-2026/.
//
// HARD RULE: every figure below passed the citation gate (live primary URL
// fetched, figure matches the source, date present and not stale). Counties
// whose rows could not be read directly from the CHFA table are intentionally
// absent. Sources: CHFA Income & Purchase Price Limits table (effective for
// locks on or after 2026-06-15), read and filed 2026-10-01 in
// bus/handoffs/citation-hub-filework-20261001.md. Do not add an unverified
// number to this file.

export const CHFA_COUNTY_LIMITS_PATH = "/resources/colorado-chfa-income-limits-2026/";
export const CHFA_COUNTY_LIMITS_URL = `https://saahomes.com${CHFA_COUNTY_LIMITS_PATH}`;
export const CHFA_COUNTY_LIMITS_TITLE =
  "CHFA Income & Purchase Price Limits 2026 by County | SAA Homes";
export const CHFA_COUNTY_LIMITS_DESCRIPTION =
  "CHFA income and purchase price limits for 2026 by county — Larimer, Weld, Boulder, and Adams — effective for locks on or after June 15, 2026. Sourced to the official CHFA limits table and ready to cite.";
export const CHFA_COUNTY_LIMITS_LAST_UPDATED = "2026-10-01";
export const CHFA_COUNTY_LIMITS_EFFECTIVE = "2026-06-15";

export const CHFA_COUNTY_SOURCE_ORG = "Colorado Housing and Finance Authority";
export const CHFA_COUNTY_SOURCE_LABEL = "CHFA Income & Purchase Price Limits (PDF)";
export const CHFA_COUNTY_SOURCE_URL =
  "https://www.chfainfo.com/getattachment/0d14dd17-fdaa-4cc8-8cb1-b1407d7beca9/CHFA-_Income_Limits.pdf";

export const CHFA_COUNTY_LIMITS = [
  {
    id: "larimer-county",
    county: "Larimer County",
    incomeNonTargeted: "$130,400 (1–2) / $149,960 (3+)",
    incomeTargeted: "$156,480 (1–2) / $182,560 (3+)",
    purchasePrice: "$664,190 non-targeted / $811,790 targeted",
    areaPath: "/northern-colorado-areas/fort-collins/",
    areaLabel: "Fort Collins area guide",
    cite:
      "CHFA 2026 limits, Larimer County: income $130,400 (1–2) / $149,960 (3+) non-targeted and $156,480 / $182,560 targeted; purchase price $664,190 non-targeted / $811,790 targeted, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
  },
  {
    id: "weld-county",
    county: "Weld County",
    incomeNonTargeted: "$153,600 (1–2) / $179,200 (3+)",
    incomeTargeted: "Same as non-targeted",
    purchasePrice: "$735,320",
    areaPath: "/northern-colorado-areas/greeley/",
    areaLabel: "Greeley area guide",
    cite:
      "CHFA 2026 limits, Weld County: income $153,600 (1–2) / $179,200 (3+), targeted and non-targeted alike; purchase price $735,320, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
  },
  {
    id: "boulder-county",
    county: "Boulder County",
    incomeNonTargeted: "$150,000 (1–2) / $172,500 (3+)",
    incomeTargeted: "Same as non-targeted",
    purchasePrice: "$832,750",
    areaPath: "/northern-colorado-areas/boulder/",
    areaLabel: "Boulder area guide",
    cite:
      "CHFA 2026 limits, Boulder County: income $150,000 (1–2) / $172,500 (3+), targeted and non-targeted alike; purchase price $832,750, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
  },
  {
    id: "adams-county",
    county: "Adams County",
    incomeNonTargeted: "$144,000 (1–2) / $165,600 (3+)",
    incomeTargeted: "$172,800 (1–2) / $201,600 (3+)",
    purchasePrice: "$832,750",
    areaPath: "/northern-colorado-areas/brighton/",
    areaLabel: "Brighton area guide",
    cite:
      "CHFA 2026 limits, Adams County: income $144,000 (1–2) / $165,600 (3+) non-targeted and $172,800 / $201,600 targeted; purchase price $832,750, effective for locks on or after June 15, 2026. Source: Colorado Housing and Finance Authority.",
  },
];

export const CHFA_COUNTY_FAQS = [
  {
    q: "What is the CHFA maximum loan limit for 2026?",
    a: "The CHFA maximum total loan limit for 2026 is $832,750, effective for locks on or after June 15, 2026. It is also the purchase-price cap for the CHFA FirstStep and FirstGeneration programs. Source: Colorado Housing and Finance Authority Income & Purchase Price Limits table.",
  },
  {
    q: "How is a CHFA targeted area defined?",
    a: "A targeted area is a geographic area CHFA designates where income limits are higher and program rules are more flexible, usually to encourage lending in areas that need it most. Whether a home is in a targeted area changes which income row applies — check the property address against CHFA's current targeted-area list before you rely on a row.",
  },
  {
    q: "What are the CHFA income limits for Larimer and Weld counties in 2026?",
    a: "For 2026, Larimer County income limits are $130,400 (1–2 person) and $149,960 (3+ person) in non-targeted areas, and $156,480 / $182,560 in targeted areas. Weld County is $153,600 / $179,200, the same in targeted and non-targeted areas. Source: Colorado Housing and Finance Authority.",
  },
  {
    q: "How often do CHFA income limits change?",
    a: "CHFA publishes new income and purchase price limits periodically, and the figures here are the ones effective for locks on or after June 15, 2026, verified 2026-10-01. Confirm current limits with CHFA or a participating lender before you rely on them.",
  },
  {
    q: "Can I cite a row from this page?",
    a: "Yes. Every row links to the official CHFA limits table and shows the date it was verified. You can cite a row directly from the 'Cite a county row' section, or link to this page's stable anchor for that county (for example, #stat-larimer-county-2026).",
  },
];
