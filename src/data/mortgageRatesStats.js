// U.S. mortgage rate statistics — verified weekly inventory for the national
// citation magnet at /resources/mortgage-rates-statistics/.
//
// HARD RULE: every figure below is Freddie Mac's Primary Mortgage Market
// Survey (PMMS), the industry-standard weekly national average, retrieved from
// the Federal Reserve Bank of St. Louis (FRED) series MORTGAGE30US and
// MORTGAGE15US on 2026-10-08. Do not add an unverified number to this file.
// Refresh: re-pull the FRED CSV after each Thursday PMMS release and append the
// new week; only then bump MORTGAGE_RATES_LAST_UPDATED.

export const MORTGAGE_RATES_PATH = "/resources/mortgage-rates-statistics/";
export const MORTGAGE_RATES_URL = `https://saahomes.com${MORTGAGE_RATES_PATH}`;
export const MORTGAGE_RATES_TITLE =
  "Mortgage Rates 2026: 30 & 15-Year Fixed Averages | SAA Homes";
export const MORTGAGE_RATES_DESCRIPTION =
  "Current 30-year and 15-year fixed mortgage rates and every weekly national average since January 2026, sourced to Freddie Mac's PMMS and refreshed weekly.";
export const MORTGAGE_RATES_LAST_UPDATED = "2026-10-08";

export const MORTGAGE_RATES_SOURCE_ORG = "Freddie Mac";
export const MORTGAGE_RATES_SOURCE_LABEL =
  "Primary Mortgage Market Survey (PMMS)";
export const MORTGAGE_RATES_SOURCE_URL = "https://www.freddiemac.com/pmms";

// Same series, as published for download by the Federal Reserve Bank of
// St. Louis (FRED) — the machine-readable table behind the rows below.
export const MORTGAGE_RATES_FRED_SOURCES = [
  {
    label: "30-year fixed (MORTGAGE30US)",
    url: "https://fred.stlouisfed.org/series/MORTGAGE30US",
  },
  {
    label: "15-year fixed (MORTGAGE15US)",
    url: "https://fred.stlouisfed.org/series/MORTGAGE15US",
  },
];

// One year earlier than the latest week, from the same PMMS series. Used for
// the year-over-year comparison; kept explicit so the page never computes it
// from a guessed trend.
export const MORTGAGE_RATES_YEAR_AGO = {
  date: "2025-10-09",
  thirty: 6.30,
  fifteen: 5.53,
};

// Weekly PMMS national averages, 2026 year to date. Date is the Thursday the
// survey was published (average of loan rates offered the prior Thursday
// through Wednesday). Newest week last.
export const MORTGAGE_RATES_WEEKLY = [
  { date: "2026-01-08", thirty: 6.16, fifteen: 5.46 },
  { date: "2026-01-15", thirty: 6.06, fifteen: 5.38 },
  { date: "2026-01-22", thirty: 6.09, fifteen: 5.44 },
  { date: "2026-01-29", thirty: 6.10, fifteen: 5.49 },
  { date: "2026-02-05", thirty: 6.11, fifteen: 5.50 },
  { date: "2026-02-12", thirty: 6.09, fifteen: 5.44 },
  { date: "2026-02-19", thirty: 6.01, fifteen: 5.35 },
  { date: "2026-02-26", thirty: 5.98, fifteen: 5.44 },
  { date: "2026-03-05", thirty: 6.00, fifteen: 5.43 },
  { date: "2026-03-12", thirty: 6.11, fifteen: 5.50 },
  { date: "2026-03-19", thirty: 6.22, fifteen: 5.54 },
  { date: "2026-03-26", thirty: 6.38, fifteen: 5.75 },
  { date: "2026-04-02", thirty: 6.46, fifteen: 5.77 },
  { date: "2026-04-09", thirty: 6.37, fifteen: 5.74 },
  { date: "2026-04-16", thirty: 6.30, fifteen: 5.65 },
  { date: "2026-04-23", thirty: 6.23, fifteen: 5.58 },
  { date: "2026-04-30", thirty: 6.30, fifteen: 5.64 },
  { date: "2026-05-07", thirty: 6.37, fifteen: 5.72 },
  { date: "2026-05-14", thirty: 6.36, fifteen: 5.71 },
  { date: "2026-05-21", thirty: 6.51, fifteen: 5.85 },
  { date: "2026-05-28", thirty: 6.53, fifteen: 5.87 },
  { date: "2026-06-04", thirty: 6.48, fifteen: 5.79 },
  { date: "2026-06-11", thirty: 6.52, fifteen: 5.84 },
  { date: "2026-06-18", thirty: 6.47, fifteen: 5.81 },
  { date: "2026-06-25", thirty: 6.49, fifteen: 5.84 },
  { date: "2026-07-02", thirty: 6.43, fifteen: 5.79 },
  { date: "2026-07-09", thirty: 6.49, fifteen: 5.82 },
  { date: "2026-07-16", thirty: 6.55, fifteen: 5.93 },
  { date: "2026-07-23", thirty: 6.58, fifteen: 5.96 },
  { date: "2026-07-30", thirty: 6.66, fifteen: 6.04 },
  { date: "2026-08-06", thirty: 6.69, fifteen: 6.01 },
  { date: "2026-08-13", thirty: 6.67, fifteen: 5.96 },
  { date: "2026-08-20", thirty: 6.65, fifteen: 5.95 },
  { date: "2026-08-27", thirty: 6.66, fifteen: 5.98 },
  { date: "2026-09-03", thirty: 6.71, fifteen: 6.04 },
  { date: "2026-09-10", thirty: 6.76, fifteen: 6.09 },
  { date: "2026-09-17", thirty: 6.95, fifteen: 6.26 },
  { date: "2026-09-24", thirty: 7.03, fifteen: 6.42 },
  { date: "2026-10-01", thirty: 7.28, fifteen: 6.60 },
  { date: "2026-10-08", thirty: 7.40, fifteen: 6.73 },
];

// Latest week's figures, kept as a single object so the current-rate cards and
// the cite line never drift from the table.
const latest = MORTGAGE_RATES_WEEKLY[MORTGAGE_RATES_WEEKLY.length - 1];
const prior = MORTGAGE_RATES_WEEKLY[MORTGAGE_RATES_WEEKLY.length - 2];

export const MORTGAGE_RATES_CURRENT = {
  date: latest.date,
  thirty: latest.thirty,
  fifteen: latest.fifteen,
  thirtyPrior: prior.thirty,
  fifteenPrior: prior.fifteen,
};

export const MORTGAGE_RATES_CITE =
  `The 30-year fixed mortgage rate averaged ${latest.thirty.toFixed(2)}% the week of ` +
  `October 8, 2026, up from ${prior.thirty.toFixed(2)}% the prior week and ` +
  `6.30% a year earlier. The 15-year fixed averaged ${latest.fifteen.toFixed(2)}%, ` +
  `up from ${prior.fifteen.toFixed(2)}% and 5.53% a year earlier. ` +
  `Source: Freddie Mac Primary Mortgage Market Survey.`;

export const MORTGAGE_RATES_FAQS = [
  {
    q: "What is the 30-year fixed mortgage rate this week?",
    a: "The 30-year fixed mortgage rate averaged 7.40% the week of October 8, 2026, up from 7.28% the week before and 6.30% a year earlier. Source: Freddie Mac Primary Mortgage Market Survey.",
  },
  {
    q: "What is the 15-year fixed mortgage rate this week?",
    a: "The 15-year fixed mortgage rate averaged 6.73% the week of October 8, 2026, up from 6.60% the week before and 5.53% a year earlier. Source: Freddie Mac Primary Mortgage Market Survey.",
  },
  {
    q: "Where did mortgage rates start in 2026 and how have they moved?",
    a: "The 30-year fixed rate began 2026 at 6.16% (week of January 8) and reached 7.40% by October 8. The 15-year fixed went from 5.46% to 6.73% over the same weeks. The 2026 low for the 30-year was 5.98% (week of February 26); for the 15-year it was 5.35% (week of February 19). Source: Freddie Mac Primary Mortgage Market Survey.",
  },
  {
    q: "How often is this page updated?",
    a: "Weekly. Freddie Mac publishes the PMMS every Thursday at 12 p.m. ET (Wednesday when a holiday falls on Thursday), and this page is refreshed after each release. The 'Last updated' date changes only when the new week's figures are added.",
  },
  {
    q: "Where does this mortgage rate data come from?",
    a: "Freddie Mac's Primary Mortgage Market Survey (PMMS), the industry-standard weekly national average, retrieved through the Federal Reserve Bank of St. Louis (FRED) series MORTGAGE30US and MORTGAGE15US. Each row links to its primary source.",
  },
  {
    q: "Can I cite these mortgage rate figures?",
    a: "Yes. Each weekly figure links to its primary source. Cite the rate, the week it applies to, and Freddie Mac's Primary Mortgage Market Survey, or link to this page and the week's anchor.",
  },
];
