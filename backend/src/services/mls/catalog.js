/**
 * The MLS catalog: MLSs a brokerage can pick in "Connect your MLS".
 *
 * Only entries checked against a public source are listed, and each one
 * names its sources. What a source didn't confirm is listed in `unverified`
 * (most often the states, which come from the MLS's name or common
 * knowledge). Display rules are sensible defaults every brokerage confirms
 * against its own MLS's IDX rules before going live; they're never presented
 * as the MLS's official wording.
 *
 * Anyone whose MLS isn't here uses "My MLS isn't listed": they pick the
 * platform and enter the connection details themselves.
 *
 * Sources (checked October 2026):
 *   MLS_GRID  docs.mlsgrid.com API v2: the OriginatingSystemName table
 *             (system name, MLS name, local field and key prefixes).
 *   Others are named on each entry.
 */
import { PLATFORMS } from './platforms.js';

const MLS_GRID = 'https://docs.mlsgrid.com/api-documentation/api-version-2.0';

export const DEFAULT_DISCLAIMER = 'Listing information provided by {mls} through its IDX program and displayed by {brokerage}. Information is deemed reliable but not guaranteed and should be independently verified. Listing information last updated {updated}.';

/** Display rules every new MLS starts with until the owner or platform confirms the MLS's own. */
export const DEFAULT_DISPLAY = Object.freeze({
  courtesy_required: true, // NAR's IDX policy: show the listing firm on every listing
  sold_data_allowed: false, // off until the MLS's rules say sold data may be shown
  logo_required: false,
  verified: false,
});

// [system name, MLS name as MLS Grid lists it, short name, states, key prefix, unverified fields]
const GRID = [
  ['actris', 'ACTRIS MLS (Unlock MLS)', 'ACTRIS', ['TX'], 'ACT', ['states']],
  ['carolina', 'Canopy MLS', 'Canopy', ['NC', 'SC'], 'CAR', ['states']],
  ['eciar', 'East Central Iowa Multiple Listing Service', 'ECIAR', ['IA'], 'ECR', []],
  ['flinthills', 'Flint Hills MLS', 'Flint Hills', ['KS'], 'FHR', ['states']],
  ['scranton', 'Greater Scranton Board of REALTORS', 'Greater Scranton', ['PA'], 'GSB', ['states']],
  ['nira', 'Northwest Indiana REALTORS Association', 'NIRA', ['IN'], 'NRA', []],
  ['hmls', 'Heartland Multiple Listing Service', 'Heartland MLS', ['MO', 'KS'], 'HMS', ['states']],
  ['highland', 'Highland Lakes Association of REALTORS', 'Highland Lakes', ['TX'], 'HLM', ['states']],
  ['ires', 'IRES MLS', 'IRES', ['CO'], 'IRE', []],
  ['irmls', 'Indiana Regional MLS', 'IRMLS', ['IN'], 'IRM', []],
  ['lbor', 'Lawrence Board of REALTORS', 'Lawrence', ['KS'], 'LBR', ['states']],
  ['lsar', 'Lake Superior Area REALTORS', 'Lake Superior', ['MN', 'WI'], 'LSA', ['states']],
  ['lascruces', 'Southern New Mexico MLS', 'Southern NM MLS', ['NM'], 'LCN', []],
  ['maris2', 'MARIS MLS', 'MARIS', ['MO', 'IL'], 'MIS', ['states']],
  ['mfrmls', 'Stellar MLS (My Florida Regional MLS)', 'Stellar MLS', ['FL'], 'MFR', []],
  ['mibor', 'MIBOR REALTOR Association', 'MIBOR', ['IN'], 'MBR', ['states']],
  ['mlsok', 'MLSOK', 'MLSOK', ['OK'], 'OKC', ['states']],
  ['mred', 'MRED Midwest Real Estate Data', 'MRED', ['IL'], 'MRD', ['states']],
  ['neirbr', 'Northeast Iowa Regional Board of REALTORS', 'NEIRBR', ['IA'], 'NBR', []],
  ['nocoast', 'NoCoast MLS', 'NoCoast', ['IA'], 'NOC', ['states']],
  ['northstar', 'NorthstarMLS', 'NorthstarMLS', ['MN', 'WI'], 'NST', ['states']],
  ['nwmls', 'Northwest MLS', 'NWMLS', ['WA'], 'NWM', ['states']],
  ['onekey2', 'OneKey MLS', 'OneKey', ['NY'], 'KEY', ['states']],
  ['paar', 'Prescott Area Association of REALTORS', 'PAAR', ['AZ'], 'PAR', ['states']],
  ['pacmls', 'PACMLS', 'PACMLS', ['WA'], 'PAC', ['states']],
  ['pikewayne', 'Pike/Wayne Association of REALTORS', 'Pike/Wayne', ['PA'], 'PWB', ['states']],
  ['prairie', 'Mid-Kansas MLS (Prairie Land REALTORS)', 'Mid-Kansas MLS', ['KS'], 'PRA', []],
  ['ranw', 'REALTOR Association of Northeast Wisconsin', 'RANW', ['WI'], 'RAN', []],
  ['realtrac', 'RealTracs', 'RealTracs', ['TN'], 'RTC', ['states']],
  ['rmlsa', 'RMLS Alliance', 'RMLS Alliance', ['IL', 'IA'], 'RMA', ['states']],
  ['rrar', 'Reelfoot Regional Association of REALTORS', 'Reelfoot', ['TN'], 'RRA', ['states']],
  ['sarmls', 'Spokane Association of REALTORS', 'Spokane', ['WA'], 'SAR', ['states']],
  ['sckansas', 'South Central Kansas MLS', 'SCK MLS', ['KS'], 'SCK', []],
  ['somo', 'Southern Missouri Regional MLS (SOMO)', 'SOMO', ['MO'], 'SOM', []],
  ['spartanburg', 'Spartanburg Board of REALTORS', 'Spartanburg', ['SC'], 'SPN', ['states']],
  ['sunflower', 'Sunflower MLS', 'Sunflower', ['KS'], 'SUN', ['states']],
];

function gridEntry([system, name, short, states, prefix, unverified]) {
  return {
    id: system === 'maris2' ? 'maris' : system === 'onekey2' ? 'onekey' : system,
    name,
    short,
    states,
    platforms: [{ platform: 'mlsgrid', originating_system: system, key_prefix: prefix }],
    sources: [MLS_GRID],
    unverified,
  };
}

const ENTRIES = [
  ...GRID.map(gridEntry),
  {
    // MLS Grid still lists 'recolorado', but REcolorado's own data page says
    // Bridge is its exclusive delivery platform, so Bridge comes first.
    id: 'recolorado',
    name: 'REcolorado',
    short: 'REcolorado',
    states: ['CO'],
    platforms: [
      { platform: 'bridge', dataset_id: null },
      { platform: 'mlsgrid', originating_system: 'recolorado', key_prefix: 'REC' },
    ],
    sources: ['https://recolorado.com/data/', MLS_GRID],
    unverified: ['states', 'Bridge dataset ID'],
  },
  {
    id: 'fmls',
    name: 'FMLS (First Multiple Listing Service)',
    short: 'FMLS',
    states: ['GA'],
    platforms: [{ platform: 'bridge', dataset_id: null }],
    sources: ['https://www.fmls.com/marketplace-info'],
    unverified: ['states', 'Bridge dataset ID'],
  },
  {
    id: 'hicentral',
    name: 'HiCentral MLS',
    short: 'HiCentral',
    states: ['HI'],
    platforms: [{ platform: 'trestle' }],
    sources: ['https://members.hicentral.com/index.php/mls/mls-data'],
    unverified: [],
  },
  {
    id: 'mlsnow',
    name: 'MLS Now',
    short: 'MLS Now',
    states: ['OH'],
    platforms: [{ platform: 'trestle' }],
    sources: ['https://support.mlsnow.com/hc/en-us/articles/6974297500699-IDX-Setup-How-to-Display-MLS-Listings-on-Your-Website-Matrix-IDX-or-WebAPI-Trestle'],
    unverified: ['states'],
  },
  {
    id: 'mlssaz',
    name: 'Multiple Listing Service of Southern Arizona',
    short: 'MLSSAZ',
    states: ['AZ'],
    platforms: [{ platform: 'spark' }],
    sources: ['https://mlssaz.com/idxinfo/'],
    unverified: [],
  },
  {
    id: 'berkshire',
    name: 'Berkshire County MLS (BerkshireRealtors)',
    short: 'Berkshire MLS',
    states: ['MA'],
    platforms: [{ platform: 'spark' }],
    sources: ['https://berkshirerealtors.net/mls-technology/rets-data-use-website-options/'],
    unverified: [],
  },
];

// ACTRIS: Unlock MLS's data licensing page offers Trestle and Bridge as well.
ENTRIES.find((e) => e.id === 'actris').platforms.push({ platform: 'trestle' }, { platform: 'bridge', dataset_id: null });
ENTRIES.find((e) => e.id === 'actris').sources.push('https://www.unlockmls.com/data-licensing');
ENTRIES.find((e) => e.id === 'actris').aliases = ['Unlock MLS', 'Austin'];

export const CATALOG = ENTRIES.map((e) => Object.freeze({
  aliases: [],
  ...e,
  display: { ...DEFAULT_DISPLAY, disclaimer: DEFAULT_DISCLAIMER.replace('{mls}', e.short) },
}));

const byId = new Map(CATALOG.map((e) => [e.id, e]));

export function catalogEntry(id) {
  return byId.get(String(id || '').toLowerCase()) || null;
}

/** Feed key for a catalog entry: its id (IRES keeps 'ires'). */
export const feedKeyFor = (entry) => entry.id;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Search by name, short name, alias, MLS code or state ("co", "Colorado"
 * works through the state code only). Empty query lists everything.
 */
export function searchCatalog(q, { limit = 50 } = {}) {
  const needle = norm(q);
  const scored = [];
  for (const e of CATALOG) {
    if (!needle) { scored.push([1, e]); continue; }
    const hay = [e.name, e.short, e.id, ...(e.aliases || []), ...e.platforms.map((p) => p.originating_system || '')].map(norm);
    let score = 0;
    if (hay.some((h) => h === needle)) score = 100;
    else if (hay.some((h) => h.startsWith(needle))) score = 60;
    else if (hay.some((h) => h.includes(needle))) score = 30;
    if (needle.length === 2 && e.states.map((s) => s.toLowerCase()).includes(needle)) score = Math.max(score, 50);
    if (score) scored.push([score, e]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, e]) => publicEntry(e));
}

/** A catalog entry as the browser sees it. */
export function publicEntry(e) {
  return {
    id: e.id,
    name: e.name,
    short: e.short,
    states: e.states,
    aliases: e.aliases || [],
    platforms: e.platforms.map((p) => ({ ...p, platform_name: PLATFORMS[p.platform]?.name || p.platform })),
    sources: e.sources,
    unverified: e.unverified,
    display: e.display,
  };
}
