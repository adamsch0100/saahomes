import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPrerenderRoutes, SITE_URL } from '../src/data/siteRoutes.js';
import {
  BUSINESS,
  buildListingsItemListSchema,
  buildAreaGuidesItemListSchema,
} from '../src/utils/seoConstants.js';
import { areaSeoPages, buildAreaPageSchemas } from '../src/data/areaSeo.js';
import { getReviewSchema } from '../src/data/reviews.js';
import { CITY_HOMES, getCityHomes, getCityHomesPath } from '../src/data/cityHomesData.js';
import { neighborhoods } from '../src/data/neighborhoods.js';
import { blogPosts } from '../src/data/blogPosts.js';
import { AREA_FAQS } from '../src/data/areaFaqs.js';
import { BUYER_FAQS, SELLER_FAQS } from '../src/data/buyerSellerFaqs.js';
import { CHFA_PAGE_CONFIGS, CHFA_PROGRAMS, CHFA_STEPS, CHFA_DPA_OPTIONS, CHFA_REQUIREMENTS, CHFA_COUNTY_LIMITS, CHFA_SPECIALTY_PROGRAMS } from '../src/data/chfaData.js';
import { getAllEvents, getCityDisplayName, getMonthNames, getEventsGuidePath, EVENTS_DATA_LAST_REVIEWED } from '../src/data/localEvents.js';
import { LUXURY_HUB_FAQS } from '../src/data/luxuryMarket.js';

// Live listings API for ItemList schema (real active MLS rows only — never fabricate).
// Prefer LISTINGS_API_BASE / VITE_API_URL when building against a non-prod environment.
const LISTINGS_API_BASE = (
  process.env.LISTINGS_API_BASE ||
  process.env.VITE_API_URL ||
  'https://saahomes.com'
).replace(/\/$/, '');

// FAQ data for pages not covered by existing FAQ data modules
// Used for GEO — FAQPage schema + visible FAQ body content
const PROPERTIES_FAQS = [
  { q: 'How can I search for homes for sale in Northern Colorado?',
    a: 'Use the MLS search tool on this page to browse all active listings across Northern Colorado. You can filter by city (Fort Collins, Loveland, Windsor, Greeley, Timnath, and more), price range, bedrooms, property type, and other features. The data comes directly from IRES MLS — the same database local real estate agents use — and updates in real time.' },
  { q: 'What is the average home price in Northern Colorado?',
    a: 'Northern Colorado home prices vary significantly by city. As of mid-2026, the median home price in Fort Collins is approximately $612,000, Loveland around $507,000, Windsor near $585,000, and Greeley at roughly $430,000. Newer communities like Timnath and Severance range from $520,000 to $625,000. Contact SAA Homes at (970) 999-1407 for current market data.' },
  { q: 'Which Northern Colorado city is best for home buyers?',
    a: 'The best city depends on your budget, commute needs, and lifestyle preferences. Fort Collins offers the most amenities and job opportunities with CSU and UCHealth. Loveland provides lakefront living at a lower cost. Windsor has top-rated schools and family neighborhoods. Greeley offers the most affordable entry point for first-time buyers. Timnath features brand-new construction. Contact Schwartz and Associates for personalized advice.' },
  { q: 'Does SAA Homes help with CHFA down payment assistance?',
    a: 'Yes. Schwartz and Associates helps Northern Colorado buyers navigate CHFA down payment assistance programs including FirstStep, SmartStep, Preferred, Schools To Home for educators, and the Colorado Champions program for first responders and veterans. Call (970) 999-1407 to speak with Adam or Mandi Schwartz about your eligibility.' },
  { q: 'How often are the MLS listings on this page updated?',
    a: 'The property search on this page is powered by IRES MLS and updates in real time. As soon as a listing is added, updated, or goes under contract in the MLS, it appears here. For the most accurate and current information, use the MLS search tool above or call SAA Homes at (970) 999-1407.' },
];
const CASH_BUYER_FAQS = [
  { q: 'How does selling my home for cash work?',
    a: 'You submit your property details, receive a no-obligation cash offer within 24 hours, and can close in as little as 7–14 days. No repairs, no showings, no agent commissions. SAA Homes connects you with vetted cash buyers or helps you evaluate whether a traditional listing would net you more.' },
  { q: 'Will I get less selling for cash vs listing traditionally?',
    a: 'Cash offers are typically below full market value because the buyer takes on the risk and convenience of an as-is, no-contingency purchase. However, when you factor in avoided repairs, no carrying costs during a 30–60 day listing period, and zero commission, the net difference is often smaller than sellers expect. SAA Homes will show you both paths so you can choose what is right for your situation.' },
  { q: 'What cities do you cover for cash home buying?',
    a: 'We serve all of Northern Colorado including Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Berthoud, Johnstown, Severance, Firestone, Frederick, Longmont, Boulder, Eaton, Evans, Milliken, Mead, La Salle, and Niwot. Each area has its own market dynamics and cash buyer demand.' },
  { q: 'Can SAA Homes help cash buyers find flip properties?',
    a: 'Yes. SAA Homes works with cash buyers, real estate investors, and house flippers across Northern Colorado. We can set you up with off-market leads, connect you with fix-and-flip opportunities, and help you build a portfolio in all 19 Front Range communities we serve.' },
  { q: 'Do I have to sell for cash, or can I list with SAA Homes instead?',
    a: 'Both options are available. Many sellers come to us for a quick cash offer and end up choosing a traditional listing once they see what their home could command on the open market. There is no obligation either way — we will give you honest advice based on your home\'s condition, your timeline, and your financial goals.' },
];

const LUXURY_FAQS = LUXURY_HUB_FAQS;

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');
const indexPath = join(distDir, 'index.html');

const routes = getPrerenderRoutes();

// ---------------------------------------------------------------------------
// Live listing fetch (ItemList GEO/AEO)
// ---------------------------------------------------------------------------

/**
 * Fetch real active listings from the live API for ItemList schema.
 * Returns [] on any failure so prerender never blocks on network.
 */
async function fetchListingsForItemList({ city, limit = 24 } = {}) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      sort: 'newest',
    });
    if (city) params.set('city', city);
    const url = `${LISTINGS_API_BASE}/api/listings?${params}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn(`  ItemList fetch ${res.status} for city=${city || '(default)'}`);
      return [];
    }
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.data)) return [];
    return data.data;
  } catch (err) {
    console.warn(`  ItemList fetch failed (${city || 'default'}): ${err.message}`);
    return [];
  }
}

/** City query for area page featured listings. */
function areaListingCity(area) {
  if (!area) return '';
  const raw = area.searchLocation || area.city || '';
  return String(raw).replace(/,?\s*CO\s*$/i, '').trim();
}

// ---------------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------------

function buildRealEstateAgentSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: BUSINESS.name,
    alternateName: BUSINESS.alternateName,
    url: BUSINESS.url,
    image: BUSINESS.logo,
    telephone: BUSINESS.telephone,
    email: BUSINESS.email,
    address: {
      '@type': 'PostalAddress',
      ...BUSINESS.address,
    },
    geo: {
      '@type': 'GeoCoordinates',
      ...BUSINESS.geo,
    },
    areaServed: BUSINESS.areaServed,
    priceRange: BUSINESS.priceRange,
    sameAs: BUSINESS.sameAs,
    ...(BUSINESS.googleBusinessProfile
      ? { hasMap: BUSINESS.googleBusinessProfile }
      : {}),
  };
}

function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BUSINESS.name,
    alternateName: 'SAA Homes',
    url: BUSINESS.url,
    description:
      'Northern Colorado real estate agents helping buyers and sellers in Fort Collins, Loveland, Windsor, Greeley, and across Colorado.',
    publisher: {
      '@type': 'RealEstateAgent',
      name: BUSINESS.name,
      url: BUSINESS.url,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BUSINESS.url}/properties/?location={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildWebPageSchema({ title, description, canonical }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical,
    inLanguage: 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: BUSINESS.name,
      url: SITE_URL,
    },
  };
}

function buildBreadcrumbList(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ---------------------------------------------------------------------------
// Route classification helpers
// ---------------------------------------------------------------------------

function matchAreaPage(path) {
  const match = path.match(/^\/northern-colorado-areas\/([^/]+)\/$/);
  if (!match) return null;
  return areaSeoPages.find((a) => a.slug === match[1]) || null;
}

function matchNeighborhoodPage(path) {
  // /northern-colorado-areas/{city}/{neighborhood}/
  const match = path.match(/^\/northern-colorado-areas\/([^/]+)\/([^/]+)\/$/);
  if (!match) return null;
  return (
    neighborhoods.find((n) => n.slug === match[2] && n.citySlug === match[1]) ||
    null
  );
}

function matchBlogPost(path) {
  const match = path.match(/^\/blog\/([^/]+)\/$/);
  if (!match) return null;
  return blogPosts.find((p) => p.slug === match[1]) || null;
}

function matchChfaPage(path) {
  return CHFA_PAGE_CONFIGS[path] || null;
}

function getOgImageForRoute(route) {
  if (route.ogImage) return route.ogImage;
  const area = matchAreaPage(route.path);
  if (area?.heroImage) {
    return area.heroImage.startsWith('http')
      ? area.heroImage
      : `${SITE_URL}${area.heroImage}`;
  }
  const post = matchBlogPost(route.path);
  if (post?.image) {
    return post.image.startsWith('http') ? post.image : `${SITE_URL}${post.image}`;
  }
  return BUSINESS.logo || undefined;
}

function getKeywordsForRoute(path) {
  const area = matchAreaPage(path);
  if (area && area.keywords) return area.keywords;
  return undefined;
}

// ---------------------------------------------------------------------------
// HTML injection helpers
// ---------------------------------------------------------------------------

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectMeta(html, { title, description, canonical, robots }) {
  let output = html;

  // --- Title ---
  output = output.replace(
    /<title>.*?<\/title>/,
    `<title>${escapeAttr(title)}</title>`
  );

  // --- Meta description ---
  output = output.replace(
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${escapeAttr(description)}" />`
  );

  // --- Robots (replace shell default so noindex pages aren't dual-tagged) ---
  if (robots) {
    if (/<meta name="robots" content=".*?"\s*\/?>/.test(output)) {
      output = output.replace(
        /<meta name="robots" content=".*?"\s*\/?>/,
        `<meta name="robots" content="${escapeAttr(robots)}" />`
      );
    } else {
      output = output.replace('</head>', `  <meta name="robots" content="${escapeAttr(robots)}" />\n  </head>`);
    }
  }

  // --- Canonical ---
  const canonicalTag = `  <link rel="canonical" href="${escapeAttr(canonical)}" />`;
  if (output.includes('rel="canonical"')) {
    output = output.replace(
      /<link rel="canonical" href=".*?" \/>/,
      canonicalTag
    );
  } else {
    output = output.replace('</head>', `${canonicalTag}\n  </head>`);
  }

  return output;
}

function injectJsonLd(html, schemas) {
  let output = html;
  const schemaScripts = schemas
    .map(
      (schema) =>
        `  <script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`
    )
    .join('\n');

  // Insert before </head>
  output = output.replace('</head>', `${schemaScripts}\n  </head>`);
  return output;
}

function injectMetaTags(html, tags) {
  let output = html;
  const tagHtml = tags.map((tag) => `  ${tag}`).join('\n');
  output = output.replace('</head>', `${tagHtml}\n  </head>`);
  return output;
}

// ---------------------------------------------------------------------------
// Body content injection for crawlers (visible content in <div id="root">)
// ---------------------------------------------------------------------------

// All 19 Northern Colorado city pages + key money pages — used to build a
// crawlable sitewide link graph. The React header/footer nav is rendered
// client-side, so without this block Google's crawler sees almost no internal
// links (homepage had 0 area links, city pages ~5). Injecting a static nav
// block into every prerendered page gives each page crawlable inbound/outbound
// link equity — the hub-and-spoke architecture the strategy requires.
const SITE_AREA_PAGES = [
  ['fort-collins', 'Fort Collins'],
  ['loveland', 'Loveland'],
  ['windsor', 'Windsor'],
  ['greeley', 'Greeley'],
  ['timnath', 'Timnath'],
  ['wellington', 'Wellington'],
  ['johnstown', 'Johnstown'],
  ['eaton', 'Eaton'],
  ['milliken', 'Milliken'],
  ['la-salle', 'La Salle'],
  ['mead', 'Mead'],
  ['longmont', 'Longmont'],
  ['boulder', 'Boulder'],
  ['berthoud', 'Berthoud'],
  ['firestone', 'Firestone'],
  ['frederick', 'Frederick'],
  ['evans', 'Evans'],
  ['severance', 'Severance'],
  ['niwot', 'Niwot'],
];

const SITE_MONEY_PAGES = [
  ['/', 'SAA Homes'],
  ['/for-buyers/', 'Colorado Home Buyers'],
  ['/for-sellers/', 'Sell Your Home'],
  ['/properties/', 'Homes for Sale'],
  ['/chfa-down-payment-assistance/', 'CHFA Down Payment Assistance'],
  ['/chfa-schools-to-home/', 'CHFA Schools to Home'],
  ['/colorado-champions-home-loan-program/', 'Colorado Champions Home Loan'],
  ['/contact/', 'Contact SAA Homes'],
];

function buildSitewideLinksHtml(currentPath) {
  const areaLinks = SITE_AREA_PAGES.map(
    ([slug, name]) =>
      `            <li><a href="${SITE_URL}/northern-colorado-areas/${slug}/">${name}, CO Real Estate</a></li>`
  ).join('\n');

  const moneyLinks = SITE_MONEY_PAGES.map(
    ([path, label]) =>
      `            <li><a href="${SITE_URL}${path}">${label}</a></li>`
  ).join('\n');

  return `\n  <nav class="prerendered-site-links" aria-label="Northern Colorado Communities">\n    <div class="prerendered-site-links-inner">\n      <h2>Explore Northern Colorado Real Estate</h2>\n      <p>Schwartz and Associates serves home buyers and sellers across all 27+ Northern Colorado communities. Choose a city to explore local real estate, neighborhoods, and market insights.</p>\n      <div class="prerendered-site-links-columns">\n        <div>\n          <h3>Cities We Serve</h3>\n          <ul>\n${areaLinks}\n          </ul>\n        </div>\n        <div>\n          <h3>Buying & Selling Resources</h3>\n          <ul>\n${moneyLinks}\n          </ul>\n        </div>\n      </div>\n      <p class="prerendered-site-links-cta">Ready to talk? Call <a href="tel:9709991407">(970) 999-1407</a> or <a href="${SITE_URL}/contact/">contact us</a>.</p>\n    </div>\n  </nav>\n`;
}

function injectSitewideLinks(html, currentPath) {
  const block = buildSitewideLinksHtml(currentPath);
  // Insert before </body> so it appears after the app root for crawlers
  return html.replace('</body>', `${block}\n  </body>`);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NEARBY_COMMUNITIES = {
  'fort-collins': [
    { name: 'Loveland', slug: 'loveland' },
    { name: 'Timnath', slug: 'timnath' },
    { name: 'Windsor', slug: 'windsor' },
    { name: 'Wellington', slug: 'wellington' },
    { name: 'Bellvue', slug: 'bellvue' },
    { name: 'Red Feather Lakes', slug: 'red-feather-lakes' },
    { name: 'Estes Park', slug: 'estes-park' },
  ],
  'loveland': [
    { name: 'Fort Collins', slug: 'fort-collins' },
    { name: 'Berthoud', slug: 'berthoud' },
    { name: 'Johnstown', slug: 'johnstown' },
    { name: 'Windsor', slug: 'windsor' },
  ],
  'windsor': [
    { name: 'Fort Collins', slug: 'fort-collins' },
    { name: 'Severance', slug: 'severance' },
    { name: 'Greeley', slug: 'greeley' },
    { name: 'Loveland', slug: 'loveland' },
  ],
  'greeley': [
    { name: 'Evans', slug: 'evans' },
    { name: 'Windsor', slug: 'windsor' },
    { name: 'Milliken', slug: 'milliken' },
    { name: 'Eaton', slug: 'eaton' },
    { name: 'Fort Lupton', slug: 'fort-lupton' },
    { name: 'Carbon Valley', slug: 'carbon-valley' },
  ],
  'timnath': [
    { name: 'Fort Collins', slug: 'fort-collins' },
    { name: 'Severance', slug: 'severance' },
    { name: 'Windsor', slug: 'windsor' },
    { name: 'Wellington', slug: 'wellington' },
  ],
  'wellington': [
    { name: 'Fort Collins', slug: 'fort-collins' },
    { name: 'Timnath', slug: 'timnath' },
    { name: 'Windsor', slug: 'windsor' },
  ],
  'johnstown': [
    { name: 'Milliken', slug: 'milliken' },
    { name: 'Loveland', slug: 'loveland' },
    { name: 'Mead', slug: 'mead' },
    { name: 'Berthoud', slug: 'berthoud' },
  ],
  'eaton': [
    { name: 'Greeley', slug: 'greeley' },
    { name: 'Windsor', slug: 'windsor' },
    { name: 'Severance', slug: 'severance' },
  ],
  'milliken': [
    { name: 'Johnstown', slug: 'johnstown' },
    { name: 'Evans', slug: 'evans' },
    { name: 'Greeley', slug: 'greeley' },
    { name: 'La Salle', slug: 'la-salle' },
  ],
  'la-salle': [
    { name: 'Evans', slug: 'evans' },
    { name: 'Greeley', slug: 'greeley' },
    { name: 'Milliken', slug: 'milliken' },
  ],
  'mead': [
    { name: 'Longmont', slug: 'longmont' },
    { name: 'Johnstown', slug: 'johnstown' },
    { name: 'Firestone', slug: 'firestone' },
    { name: 'Berthoud', slug: 'berthoud' },
  ],
  'longmont': [
    { name: 'Mead', slug: 'mead' },
    { name: 'Berthoud', slug: 'berthoud' },
    { name: 'Niwot', slug: 'niwot' },
    { name: 'Firestone', slug: 'firestone' },
  ],
  'boulder': [
    { name: 'Niwot', slug: 'niwot' },
    { name: 'Longmont', slug: 'longmont' },
    { name: 'Berthoud', slug: 'berthoud' },
  ],
  'berthoud': [
    { name: 'Longmont', slug: 'longmont' },
    { name: 'Loveland', slug: 'loveland' },
    { name: 'Mead', slug: 'mead' },
    { name: 'Johnstown', slug: 'johnstown' },
  ],
  'firestone': [
    { name: 'Frederick', slug: 'frederick' },
    { name: 'Mead', slug: 'mead' },
    { name: 'Longmont', slug: 'longmont' },
  ],
  'frederick': [
    { name: 'Firestone', slug: 'firestone' },
    { name: 'Longmont', slug: 'longmont' },
    { name: 'Mead', slug: 'mead' },
  ],
  'evans': [
    { name: 'Greeley', slug: 'greeley' },
    { name: 'La Salle', slug: 'la-salle' },
    { name: 'Milliken', slug: 'milliken' },
    { name: 'Windsor', slug: 'windsor' },
  ],
  'severance': [
    { name: 'Windsor', slug: 'windsor' },
    { name: 'Fort Collins', slug: 'fort-collins' },
    { name: 'Greeley', slug: 'greeley' },
    { name: 'Timnath', slug: 'timnath' },
  ],
  'niwot': [
    { name: 'Boulder', slug: 'boulder' },
    { name: 'Longmont', slug: 'longmont' },
  ],
};

// ---------------------------------------------------------------------------
// Section towns — nearby communities with dedicated writeups rendered on the
// client by <SectionTownsBand />. Mirrored here so crawlers (which do not
// execute JS) see the same content on city pages. Keyed by area slug.
// ---------------------------------------------------------------------------
const SECTION_TOWNS = {
  'fort-collins': {
    title: 'Nearby communities: LaPorte & Masonville',
    intro:
      'Smaller Larimer County communities shoppers often pair with a Fort Collins search. Market lines below are live from active IRES listings — not static snapshots.',
    towns: [
      {
        name: 'LaPorte',
        description: 'Unincorporated Larimer · north-northwest of Fort Collins',
        writeup:
          'LaPorte sits just outside Fort Collins toward the Poudre corridor — a small community mix of residential and land listings that appeals to buyers who want more space without a full mountain move. Inventory is limited compared with the city, so well-matched homes can draw attention quickly. Pair a LaPorte search with Fort Collins and Bellvue when you want options across the northwest edge of the market.',
      },
      {
        name: 'Masonville',
        description: 'Larimer foothills · southwest of Fort Collins / west of Loveland',
        writeup:
          'Masonville is a foothills hamlet with historically thin MLS inventory — some days there are zero active listings. When homes or land do appear, they tend to attract buyers seeking privacy, mountain access, and a quieter alternative to in-town Fort Collins or Loveland. Set a saved search with SAA Homes so you are notified the moment something hits the market.',
      },
    ],
  },
  'greeley': {
    title: 'Nearby communities: Ault, Pierce, Kersey & Briggsdale',
    intro:
      'Weld County towns shoppers often pair with a Greeley search. Active counts and median list prices are live from IRES MLS.',
    towns: [
      {
        name: 'Ault',
        description: 'Weld County · north of Greeley on US-85',
        writeup:
          'Ault is a classic small Weld County town north of Greeley with a mix of residential homes and some land. Buyers who want quieter streets and a short drive to Greeley employment often include Ault alongside Eaton and Severance. Inventory is modest, so pricing strategy and flexibility on condition matter.',
      },
      {
        name: 'Pierce',
        description: 'Weld County · north of Ault on the US-85 corridor',
        writeup:
          'Pierce offers an even smaller-town feel farther north on the Highway 85 corridor, often with more accessible list prices than larger NoCO cities. Expect a thin market — when the right home appears, act with solid pre-approval. SAA Homes can combine Pierce with Ault and Greeley in one search.',
      },
      {
        name: 'Kersey',
        description: 'Weld County · east of Greeley',
        writeup:
          'Kersey sits east of Greeley with a rural character and a small active inventory that can include larger properties and land. Medians can swing when high-end or acreage listings dominate a thin market — always read the live line in context and review individual comps with an agent.',
      },
      {
        name: 'Briggsdale',
        description: 'Weld County · northeast plains community',
        writeup:
          'Briggsdale is a remote plains community with very limited inventory and a true rural lifestyle. It is not a suburban substitute for west Greeley — it is for buyers who specifically want open country living. Set alerts early; the right listing may not last long among local farm and ranch buyers.',
      },
    ],
  },
};

function injectAreaBody(html, area) {
  const city = escapeHtml(area.city);
  const tagline = escapeHtml(area.tagline || '');
  const county = escapeHtml(area.county || '');
  const faqs = AREA_FAQS[area.slug] || [];
  const nearby = NEARBY_COMMUNITIES[area.slug] || [];

  // Build intro content
  let introHtml = '';
  if (area.introParagraphs && area.introParagraphs.length > 0) {
    introHtml = area.introParagraphs
      .map((p) => `      <p class="prerendered-intro">${escapeHtml(p)}</p>`)
      .join('\n');
  } else {
    introHtml = `      <p class="prerendered-intro">${escapeHtml(area.description)}</p>`;
  }

  // Build FAQ section — complements FAQPage JSON-LD and provides visible content
  let faqHtml = '';
  if (faqs.length > 0) {
    faqHtml =
      `      <section class="prerendered-faq">\n` +
      `        <h2>Frequently Asked Questions About ${city}, Colorado</h2>\n` +
      faqs
        .map(
          (faq) =>
            `        <div itemscope="" itemprop="mainEntity" itemtype="https://schema.org/Question">\n` +
            `          <h3 itemprop="name">${escapeHtml(faq.q)}</h3>\n` +
            `          <div itemscope="" itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n` +
            `            <p itemprop="text">${escapeHtml(faq.a)}</p>\n` +
            `          </div>\n` +
            `        </div>`
        )
        .join('\n') +
      `\n      </section>`;
  }

  // Build nearby communities cross-links
  let nearbyHtml = '';
  const validNearby = nearby.filter((c) => c.slug);
  if (validNearby.length > 0) {
    nearbyHtml =
      `      <section class="prerendered-nearby">\n` +
      `        <h2>Nearby Northern Colorado Communities</h2>\n` +
      `        <p>Explore real estate in the ${city} area:</p>\n` +
      `        <ul>\n` +
      validNearby
        .map(
          (c) =>
            `          <li><a href="${SITE_URL}/northern-colorado-areas/${c.slug}/">${escapeHtml(c.name)}, CO Real Estate</a></li>`
        )
        .join('\n') +
      `\n        </ul>\n` +
      `      </section>`;
  }

  // Build section towns — mirrors client-side <SectionTownsBand /> so crawlers
  // see the same nearby-community writeups without executing JS.
  let sectionTownsHtml = '';
  const sectionTowns = SECTION_TOWNS[area.slug];
  if (sectionTowns && sectionTowns.towns && sectionTowns.towns.length > 0) {
    sectionTownsHtml =
      `      <section class="prerendered-section-towns">\n` +
      `        <h2>${escapeHtml(sectionTowns.title)}</h2>\n` +
      `        <p>${escapeHtml(sectionTowns.intro || '')}</p>\n` +
      sectionTowns.towns
        .map(
          (t) =>
            `        <div class="prerendered-section-town">\n` +
            `          <h3>${escapeHtml(t.name)}</h3>\n` +
            `          <p><strong>${escapeHtml(t.description || '')}</strong></p>\n` +
            `          <p>${escapeHtml(t.writeup || '')}</p>\n` +
            `          <p><a href="${SITE_URL}/properties/?location=${encodeURIComponent(`${t.name}, CO`)}">Search homes for sale in ${escapeHtml(t.name)}, Colorado</a></p>\n` +
            `        </div>`
        )
        .join('\n') +
      `\n      </section>`;
  }

  // Build neighborhood links — mirrors client-side NeighborhoodLinks component
  // so crawlers see hub → neighborhood internal links (hub-and-spoke architecture)
  let neighborhoodHtml = '';
  const cityNeighborhoods = neighborhoods.filter((n) => n.citySlug === area.slug);
  if (cityNeighborhoods.length > 0) {
    neighborhoodHtml =
      `      <section class="prerendered-neighborhoods">\n` +
      `        <h2>${escapeHtml(area.city)} Neighborhoods & Subdivisions</h2>\n` +
      `        <p>Explore detailed guides for ${escapeHtml(area.city)} neighborhoods, subdivisions, and communities:</p>\n` +
      `        <ul>\n` +
      cityNeighborhoods
        .map(
          (n) =>
            `          <li><a href="${SITE_URL}/northern-colorado-areas/${area.slug}/${n.slug}/">${escapeHtml(n.name)}</a> &mdash; ${escapeHtml((n.description || '').slice(0, 160))}</li>`
        )
        .join('\n') +
      `\n        </ul>\n` +
      `      </section>`;
  }

  // Build city-specific guide links (internal links to relevant blog posts)
  const CITY_BLOG_GUIDES = {
    'fort-collins': [
      { title: 'Selling Your Home in Fort Collins', slug: 'selling-your-home-in-fort-collins', blurb: 'Pricing strategy, preparation tips & local market insights' },
      { title: 'Fort Collins Realtor Guide', slug: 'fort-collins-realtor', blurb: 'Expert real estate guidance for Fort Collins buyers and sellers' },
      { title: 'Fort Collins Housing Market — Mid-2026 Update', slug: 'fort-collins-housing-market-mid-2026', blurb: 'Median prices, days on market & inventory trends' },
    ],
    'greeley': [
      { title: 'Selling Your Home in Greeley, Colorado', slug: 'selling-a-home-in-greeley-colorado', blurb: 'Pricing strategy, preparation tips & local market insights' },
      { title: 'Buying a Home in Greeley', slug: 'buying-a-home-in-greeley', blurb: 'Neighborhoods, schools & market data for Greeley buyers' },
      { title: 'Greeley Housing Market — Mid-2026 Update', slug: 'greeley-housing-market-mid-2026', blurb: 'Median prices, days on market & inventory trends' },
    ],
    'windsor': [
      { title: 'Selling Your Home in Windsor, Colorado', slug: 'selling-your-home-in-windsor-colorado', blurb: 'Pricing strategy, preparation tips & local market insights' },
    ],
  };
  let guidesHtml = '';
  const cityGuides = CITY_BLOG_GUIDES[area.slug];
  if (cityGuides && cityGuides.length > 0) {
    const guideItems = cityGuides
      .map(
        (g) =>
          `          <li><a href="${SITE_URL}/blog/${g.slug}/">${escapeHtml(g.title)}</a> &mdash; ${escapeHtml(g.blurb)}</li>`
      )
      .join('\n');
    guidesHtml =
      `      <section class="prerendered-city-guides">\n` +
      `        <h2>${city} Real Estate Guides</h2>\n` +
      `        <p>Explore our detailed guides for ${city} home buyers and sellers:</p>\n` +
      `        <ul>\n` +
      guideItems +
      `\n        </ul>\n` +
      `      </section>`;
  }

  // CTA with phone number
  const ctaHtml =
    `      <section class="prerendered-cta">\n` +
    `        <h2>Work With Schwartz and Associates in ${city}</h2>\n` +
    `        <p>Ready to buy or sell in ${city}? Contact SAA Homes today at <strong>(970) 999-1407</strong> or visit our office at 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525. Let our local experts guide you through every step of your real estate journey in Northern Colorado.</p>\n` +
    `        <p>Schwartz and Associates, Coldwell Banker Realty — serving home buyers and sellers across all 27+ Northern Colorado communities including Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Johnstown, Eaton, Milliken, La Salle, Mead, Longmont, Boulder, Berthoud, Firestone, Frederick, Evans, Severance, Niwot, Erie, Brighton, Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue, and the Carbon Valley region.</p>\n` +
    `      </section>`;

  const bodyContent =
    `\n` +
    `    <div class="prerendered-area-content">\n` +
    `      <h1>${city}, Colorado Real Estate & Neighborhood Guide</h1>\n` +
    `      ${tagline ? `<p class="prerendered-tagline"><strong>${tagline}</strong></p>\n` : ''}` +
    `      ${county ? `<p class="prerendered-county">Serving ${county}</p>\n` : ''}` +
    `${introHtml}\n` +
    `${faqHtml}\n` +
    `${neighborhoodHtml}\n` +
    `${guidesHtml}\n` +
    `${nearbyHtml}\n` +
    `${sectionTownsHtml}\n` +
    `${ctaHtml}\n` +
    `    </div>\n  `;

  // Inject into <div id="root"> — visible to crawlers that do not execute JS
  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

function injectNeighborhoodBody(html, neighborhood) {
  const name = escapeHtml(neighborhood.name || '');
  const cityDisplay = escapeHtml(neighborhood.cityDisplay || '');
  const citySlug = neighborhood.citySlug || '';
  const county = escapeHtml(neighborhood.county || '');
  const type = escapeHtml(neighborhood.type || 'neighborhood');
  const description = neighborhood.description || '';
  const longDescription = neighborhood.longDescription || '';
  const priceRange = escapeHtml(neighborhood.priceRangeDescription || '');
  const schoolDistrict = escapeHtml(neighborhood.schoolDistrict || '');
  const homeStyles = neighborhood.homeStyles || [];
  const schools = neighborhood.schools || [];
  const features = neighborhood.features || [];
  const parks = neighborhood.parks || [];
  const hoa = escapeHtml(neighborhood.hoaDescription || '');
  const highlights = neighborhood.neighborhoodHighlights || [];
  const boundaries = escapeHtml(neighborhood.boundaries || '');

  // Intro paragraphs — longDescription first (richer), fall back to description
  const introParagraphs = [longDescription || description, description && longDescription ? description : null]
    .filter(Boolean);

  let introHtml = introParagraphs
    .map((p) => `      <p class="prerendered-intro">${escapeHtml(p)}</p>`)
    .join('\n');

  // Highlights grid
  let highlightsHtml = '';
  if (highlights.length > 0) {
    highlightsHtml =
      `      <section class="prerendered-highlights">\n` +
      `        <h2>Why Buyers Choose ${name}</h2>\n` +
      highlights
        .map(
          (h) =>
            `        <div class="prerendered-highlight">\n` +
            `          <h3>${escapeHtml(h.title)}</h3>\n` +
            `          <p>${escapeHtml(h.description)}</p>\n` +
            `        </div>`
        )
        .join('\n') +
      `\n      </section>`;
  }

  // Key facts list
  let factsHtml =
    `      <section class="prerendered-facts">\n` +
    `        <h2>${name} ${cityDisplay} Real Estate Facts</h2>\n` +
    `        <ul>\n` +
    (priceRange
      ? `          <li><strong>Price range:</strong> ${priceRange}</li>\n`
      : '') +
    (schoolDistrict
      ? `          <li><strong>School district:</strong> ${schoolDistrict}</li>\n`
      : '') +
    (boundaries
      ? `          <li><strong>Boundaries:</strong> ${boundaries}</li>\n`
      : '') +
    (hoa ? `          <li><strong>HOA:</strong> ${hoa}</li>\n` : '') +
    `        </ul>\n` +
    `      </section>`;

  // Home styles
  let stylesHtml = '';
  if (homeStyles.length > 0) {
    stylesHtml =
      `      <section class="prerendered-styles">\n` +
      `        <h2>Home Styles in ${name}</h2>\n` +
      `        <p>${homeStyles.map(escapeHtml).join(', ')}</p>\n` +
      `      </section>`;
  }

  // Schools
  let schoolsHtml = '';
  if (schools.length > 0) {
    schoolsHtml =
      `      <section class="prerendered-schools">\n` +
      `        <h2>Schools Serving ${name}</h2>\n` +
      `        <ul>\n` +
      schools
        .map(
          (s) =>
            `          <li>${escapeHtml(s.name)} (${escapeHtml(s.type)}${s.rating != null ? ', rating ' + escapeHtml(String(s.rating)) : ''})</li>`
        )
        .join('\n') +
      `\n        </ul>\n` +
      `      </section>`;
  }

  // Features
  let featuresHtml = '';
  if (features.length > 0) {
    featuresHtml =
      `      <section class="prerendered-features">\n` +
      `        <h2>What ${name} Offers</h2>\n` +
      `        <ul>\n` +
      features.map((f) => `          <li>${escapeHtml(f)}</li>`).join('\n') +
      `\n        </ul>\n` +
      `      </section>`;
  }

  // Parks
  let parksHtml = '';
  if (parks.length > 0) {
    parksHtml =
      `      <section class="prerendered-parks">\n` +
      `        <h2>Parks & Outdoor Spaces Near ${name}</h2>\n` +
      `        <ul>\n` +
      parks.map((p) => `          <li>${escapeHtml(p)}</li>`).join('\n') +
      `\n        </ul>\n` +
      `      </section>`;
  }

  // Nearby communities cross-link to the parent city page
  const cityLinkHtml = citySlug
    ? `      <section class="prerendered-city-link">\n` +
      `        <h2>${cityDisplay}, Colorado Real Estate</h2>\n` +
      `        <p><a href="${SITE_URL}/northern-colorado-areas/${citySlug}/">Explore homes for sale and the full neighborhood guide for ${cityDisplay}, Colorado</a> — including market trends, schools, and community information for the entire ${cityDisplay} area.</p>\n` +
      `      </section>`
    : '';

  // CTA with phone number
  const ctaHtml =
    `      <section class="prerendered-cta">\n` +
    `        <h2>Work With Schwartz and Associates in ${name}</h2>\n` +
    `        <p>Ready to buy or sell in ${name}? Contact SAA Homes today at <strong>(970) 999-1407</strong> or visit our office at 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525. Our local experts know ${name} and every neighborhood in Northern Colorado.</p>\n` +
    `        <p>Schwartz and Associates, Coldwell Banker Realty — serving home buyers and sellers across Fort Collins, Loveland, Windsor, Greeley, and all of Northern Colorado.</p>\n` +
    `      </section>`;

  const bodyContent =
    `\n` +
    `    <div class="prerendered-neighborhood-content">\n` +
    `      <h1>${name} — ${cityDisplay}, Colorado ${type === 'subdivision' ? 'Subdivision' : 'Neighborhood'} Guide</h1>\n` +
    `      ${county ? `<p class="prerendered-county">Serving ${county}</p>\n` : ''}` +
    `${introHtml}\n` +
    `${highlightsHtml}\n` +
    `${factsHtml}\n` +
    `${stylesHtml}\n` +
    `${schoolsHtml}\n` +
    `${featuresHtml}\n` +
    `${parksHtml}\n` +
    `${cityLinkHtml}\n` +
    `${ctaHtml}\n` +
    `    </div>\n  `;

  // Inject into <div id="root"> — visible to crawlers that do not execute JS
  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

function injectBlogBody(html, post) {
  const title = escapeHtml(post.title || '');
  const date = post.date || '';
  const category = escapeHtml(post.category || '');
  const readTime = post.readTime || '';
  const keywords = post.keywords || '';
  const faqs = post.faqs || [];

  // Build article header
  let headerHtml = `      <p class="prerendered-blog-meta">`;
  if (category) headerHtml += `<strong>${category}</strong>`;
  if (date) headerHtml += ` &mdash; ${date}`;
  if (readTime) headerHtml += ` &middot; ${readTime}`;
  headerHtml += `</p>\n`;

  // Build sections
  let sectionsHtml = '';
  if (post.sections && post.sections.length > 0) {
    sectionsHtml = post.sections.map((section) => {
      let html = `      <section class="prerendered-blog-section">\n`;
      if (section.heading) {
        html += `        <h2>${escapeHtml(section.heading)}</h2>\n`;
      }
      if (section.paragraphs) {
        html += section.paragraphs
          .map((p) => `        <p>${escapeHtml(p)}</p>`)
          .join('\n') + '\n';
      }
      if (section.list) {
        html += `        <ul>\n`;
        html += section.list
          .map((item) => `          <li>${escapeHtml(item)}</li>`)
          .join('\n') + '\n';
        html += `        </ul>\n`;
      }
      if (section.relatedLinks) {
        html += `        <ul class="prerendered-blog-links">\n`;
        html += section.relatedLinks
          .map((link) =>
            `          <li><a href="${escapeAttr(link.href)}">${escapeHtml(link.title)}</a>${link.description ? ` &mdash; ${escapeHtml(link.description)}` : ''}</li>`
          )
          .join('\n') + '\n';
        html += `        </ul>\n`;
      }
      html += `      </section>\n`;
      return html;
    }).join('');
  }

  // Build FAQ section
  let faqHtml = '';
  if (faqs.length > 0) {
    faqHtml =
      `      <section class="prerendered-faq">\n` +
      `        <h2>Frequently Asked Questions</h2>\n` +
      faqs.map((faq) =>
        `        <div itemscope="" itemprop="mainEntity" itemtype="https://schema.org/Question">\n` +
        `          <h3 itemprop="name">${escapeHtml(faq.q)}</h3>\n` +
        `          <div itemscope="" itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n` +
        `            <p itemprop="text">${escapeHtml(faq.a)}</p>\n` +
        `          </div>\n` +
        `        </div>`
      ).join('\n') + `\n      </section>\n`;
  }

  // Build related links section
  let relatedHtml = '';
  if (post.relatedLinks && post.relatedLinks.length > 0) {
    relatedHtml =
      `      <section class="prerendered-blog-related">\n` +
      `        <h3>Related Resources</h3>\n` +
      `        <ul>\n` +
      post.relatedLinks.map((link) =>
        `          <li><a href="${escapeAttr(link.href)}">${escapeHtml(link.title)}</a>${link.description ? ` &mdash; ${escapeHtml(link.description)}` : ''}</li>`
      ).join('\n') + `\n        </ul>\n` +
      `      </section>\n`;
  }

  // Build CTA section
  let ctaHtml = '';
  if (post.cta) {
    ctaHtml =
      `      <section class="prerendered-blog-cta">\n` +
      `        <h3>${escapeHtml(post.cta.title || '')}</h3>\n` +
      `        <p>${escapeHtml(post.cta.description || '')}</p>\n` +
      `        <p><a href="${escapeAttr(post.cta.primaryHref || '#')}" class="prerendered-cta-button">${escapeHtml(post.cta.primaryText || 'Learn More')}</a>` +
      (post.cta.secondaryHref ? ` | <a href="${escapeAttr(post.cta.secondaryHref)}">${escapeHtml(post.cta.secondaryText || '')}</a>` : '') +
      `</p>\n` +
      `      </section>\n`;
  }

  // Final CTA with phone
  const phoneCta =
    `      <section class="prerendered-cta">\n` +
    `        <h3>Work With Schwartz and Associates</h3>\n` +
    `        <p>Ready to buy or sell in Northern Colorado? Contact SAA Homes at <strong>(970) 999-1407</strong> or visit us at 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525. Let our local experts guide you through every step of your real estate journey.</p>\n` +
    `      </section>`;

  const bodyContent =
    `\n` +
    `    <article class="prerendered-blog-content">\n` +
    `      <h1>${title}</h1>\n` +
    `${headerHtml}` +
    `${sectionsHtml}` +
    `${faqHtml}` +
    `${relatedHtml}` +
    `${ctaHtml}` +
    `${phoneCta}` +
    `    </article>\n  `;

  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

function injectGenericBody(html, { title }) {
  const pageTitle = escapeHtml(title || '');
  const bodyContent =
    `\n` +
    `    <div class="prerendered-generic-content">\n` +
    `      <h1>${pageTitle}</h1>\n` +
    `    </div>\n  `;
  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

// ---------------------------------------------------------------------------
// City "homes for sale" pages — /{slug}-homes-for-sale/ (Tier S money pages)
// ---------------------------------------------------------------------------
function matchCityHomesPage(path) {
  const normalized = path.replace(/\/$/, '');
  if (!normalized.endsWith('-homes-for-sale')) return null;
  const slug = normalized.slice(0, -'-homes-for-sale'.length).split('/').pop();
  return getCityHomes(slug) || null;
}

function injectCityHomesBody(html, city) {
  const otherCities = CITY_HOMES.filter((c) => c.slug !== city.slug)
    .map((c) => `<a href="${SITE_URL}${getCityHomesPath(c.slug)}">${escapeHtml(c.city)} homes for sale</a>`)
    .join(' · ');
  const bodyContent =
    `\n` +
    `    <div class="prerendered-city-homes">\n` +
    `      <h1>${escapeHtml(city.city)} Homes for Sale</h1>\n` +
    `      <p>${escapeHtml(city.intro)}</p>\n` +
    `      <p><a href="${SITE_URL}/properties/?location=${encodeURIComponent(city.search)}">Open the full ${escapeHtml(city.city)} search with map</a> — live IRES MLS data, updated daily.</p>\n` +
    `      <h2>${escapeHtml(city.city)} Home Buying Resources</h2>\n` +
    `      <ul>\n` +
    `        <li><a href="${SITE_URL}${city.areaPath}">${escapeHtml(city.city)} Neighborhood Guide</a></li>\n` +
    `        <li><a href="${SITE_URL}/chfa-down-payment-assistance/">CHFA Down Payment Assistance</a></li>\n` +
    `        <li><a href="${SITE_URL}/for-buyers/">Northern Colorado Buyer Guide</a></li>\n` +
    `      </ul>\n` +
    `      <p>IDX information provided by IRES. ${escapeHtml(city.city)} listings update daily. Contact Schwartz and Associates at (970) 999-1407.</p>\n` +
    `      <p>${otherCities}</p>\n` +
    `    </div>\n  `;
  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

// ---------------------------------------------------------------------------
// Money page (P0) body content injection
// ---------------------------------------------------------------------------

const MONEY_PAGE_CONTENT = {
  '/for-sellers/': {
    sections: [
      {
        heading: 'Free Home Valuation — Know What Your Home Is Worth',
        paragraphs: [
          'Request a free, no-obligation home valuation for your Northern Colorado home. Our team prepares a detailed market analysis using current MLS comps and recent closed sales in your specific neighborhood.',
          'Call (970) 999-1407 or submit the home valuation form on this page to get your personalized estimate — no strings attached.',
        ],
      },
      {
        heading: 'Sell Your Northern Colorado Home With Confidence',
        paragraphs: [
          'Selling your home in Northern Colorado requires local market knowledge, strategic pricing, and a marketing plan that reaches the right buyers. Schwartz and Associates brings years of experience across Fort Collins, Loveland, Windsor, Greeley, and all 19 communities in our service area.',
          'From first-time sellers to those who have sold multiple properties, our team provides a comprehensive process: a free market analysis using current Northern Colorado comps, professional staging guidance, premium photography and virtual tours, MLS and digital marketing, and skilled negotiation through closing.',
        ],
      },
      {
        heading: 'Our Seller Process',
        paragraphs: [
          'Every Northern Colorado home sale starts with a no-obligation consultation where we review your home, discuss your timeline, and create a customized marketing plan. We price your home competitively based on real-time market data from your specific neighborhood and comparable recent sales.',
          'Once listed, your home reaches buyers through MLS syndication, social media campaigns, targeted digital advertising, and our network of real estate professionals. We hold open houses, provide regular market feedback, and guide you through offers, inspections, and closing with clarity and communication.',
        ],
      },
      {
        heading: 'Marketing That Gets Results',
        list: [
          'Professional photography and virtual tours for every listing',
          'MLS syndication to 500+ real estate websites including Zillow, Realtor.com, and Redfin',
          'Social media marketing across Facebook, Instagram, and YouTube',
          'Targeted digital advertising to Northern Colorado home buyers',
          'Email campaigns to our network of qualified buyer agents',
        ],
      },
    ],
    cta: {
      title: 'Start Your Home Sale Today',
      text: 'Contact SAA Homes at (970) 999-1407 for your free, no-obligation home valuation. Let us show you how we maximize value and minimize stress when selling your Northern Colorado home.',
    },
    faqs: SELLER_FAQS,
    testimonials: [
      { name: 'Andy Witt', text: 'Adam and Mandi were absolutely phenomenal! Walked me through every step of the process and constantly checked in.', rating: 5 },
      { name: 'Kylie Graff', text: 'We just bought our first home, and could not have done it without the knowledge and guidance from the Schwartz team.', rating: 5 },
      { name: 'Kevin Freestone', text: 'The right people to help you get a home. Very responsive, respectful, and professional.', rating: 5 },
    ],
  },
  '/for-buyers/': {
    sections: [
      {
        heading: 'Buy Your Dream Home in Northern Colorado',
        paragraphs: [
          'Whether you are searching for a starter home in Fort Collins, a family house in Windsor, new construction in Timnath, or an affordable property in Greeley, Schwartz and Associates helps buyers navigate the Northern Colorado market with confidence.',
          'Our buyer representation includes personalized home searches, neighborhood guidance, school district research, and expert negotiation. We also guide qualified buyers through CHFA down payment assistance programs that can make homeownership more accessible with grants up to $25,000 or deferred loans at 0% interest.',
        ],
      },
      {
        heading: 'How We Help You Buy',
        paragraphs: [
          'The home buying process starts with understanding your needs, budget, and timeline. We pre-approve you with trusted local lenders who know Northern Colorado programs including CHFA, FHA, VA, and conventional financing options. Then we search active listings across all 19 communities to find homes that match your criteria.',
          'When we find the right home, we conduct a comparative market analysis to determine a strong offer price, guide you through the negotiation and inspection process, and stay with you through closing. Our goal is a smooth, transparent experience from first showing to keys in hand.',
        ],
      },
      {
        heading: 'Popular Buyer Programs',
        list: [
          'CHFA down payment assistance — grants and deferred loans for qualified first-time buyers',
          'CHFA Schools To Home — up to 25% down payment help for Colorado public school employees',
          'Colorado Champions Home Loan — expanded CHFA eligibility for first responders (police, firefighters, EMTs)',
          'FHA and VA loans with low down payment options',
          'Conventional financing with competitive rates from local lenders',
        ],
      },
    ],
    cta: {
      title: 'Start Your Home Search',
      text: 'Contact SAA Homes at (970) 999-1407 or visit our office at 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525. Let us help you find the perfect home in Northern Colorado.',
    },
    faqs: BUYER_FAQS,
    testimonials: [
      { name: 'Andy Witt', text: 'Adam and Mandi were absolutely phenomenal! Walked me through every step of the process and constantly checked in.', rating: 5 },
      { name: 'Kylie Graff', text: 'We just bought our first home, and could not have done it without the knowledge and guidance from the Schwartz team.', rating: 5 },
      { name: 'Daen Manriquez', text: 'Adam is a pleasure to work with. His friendly demeanor and dedication to client satisfaction set him apart.', rating: 5 },
    ],
  },
  '/contact/': {
    sections: [
      {
        heading: 'Get In Touch With Schwartz and Associates',
        paragraphs: [
          'Ready to buy or sell a home in Northern Colorado? We are here to help. Whether you have questions about the market, want to schedule a consultation, or need guidance on CHFA programs, our team is just a phone call or message away.',
          'We serve buyers and sellers across all 19 Northern Colorado communities: Fort Collins, Loveland, Windsor, Greeley, Timnath, Severance, Wellington, Berthoud, Johnstown, Milliken, Eaton, La Salle, Mead, Longmont, Boulder, Firestone, Frederick, Evans, and Niwot.',
        ],
      },
    ],
    cta: {
      title: 'We Look Forward To Hearing From You',
      text: 'Call (970) 999-1407, email us, or stop by 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525. Let Schwartz and Associates guide your Northern Colorado real estate journey.',
    },
  },
  '/properties/': {
    sections: [
      {
        heading: 'Homes for Sale Across Northern Colorado',
        paragraphs: [
          'Browse active listings across Fort Collins, Loveland, Windsor, Greeley, and all 19 communities we serve. Our property search includes homes for sale in every price range — from starter homes and townhomes to luxury properties and new construction.',
          'Use the search tools below to filter by city, price, bedrooms, and property type. Each listing includes detailed information, professional photos, and direct contact options to schedule a showing with a Schwartz and Associates agent.',
        ],
      },
      {
        heading: 'Homes for Sale by Northern Colorado City',
        paragraphs: [
          'Each community offers a distinct lifestyle and price point. Browse the full city guide for market data, neighborhoods, schools, and available listings:',
        ],
        list: [
          'Fort Collins — CSU, Old Town, and the largest housing market in Northern Colorado',
          'Loveland — the Sweetheart City with lakefront living along I-25',
          'Windsor — top-rated schools and family neighborhoods near Windsor Lake',
          'Greeley — the most affordable major market in the region, home to UNC',
          'Timnath — new construction and master-planned communities',
          'Wellington, Berthoud, Johnstown, Severance, Eaton, Milliken & more',
        ],
      },
    ],
    cta: {
      title: 'Need Help Finding Your Perfect Home?',
      text: 'Contact SAA Homes at (970) 999-1407 for personalized home search assistance. Let our local experts help you find the right property in the right Northern Colorado neighborhood.',
    },
    faqs: PROPERTIES_FAQS,
  },
  '/mortgage-calculator/': {
    sections: [
      {
        heading: 'Estimate Your Northern Colorado Mortgage Payment',
        paragraphs: [
          'Use our mortgage calculator to estimate monthly payments for homes in Fort Collins, Loveland, Windsor, and across Northern Colorado. Enter the home price, down payment, interest rate, and loan term to see your estimated principal, interest, taxes, and insurance costs.',
          'Keep in mind that Northern Colorado buyers may qualify for CHFA down payment assistance programs that reduce the upfront costs of homeownership. Contact SAA Homes to learn more about your financing options.',
        ],
      },
    ],
    cta: {
      title: 'Ready To Explore Your Options?',
      text: 'Call (970) 999-1407 to speak with a Schwartz and Associates agent about financing, CHFA programs, and finding the right home for your budget in Northern Colorado.',
    },
  },
  '/about-us/': {
    sections: [
      {
        heading: 'Meet Adam and Mandi Schwartz',
        paragraphs: [
          'Schwartz and Associates (SAA Homes) is a Northern Colorado real estate team serving home buyers and sellers under Coldwell Banker Realty in Fort Collins. With years of combined experience, Adam and Mandi Schwartz bring deep local market knowledge, integrity, and a client-first approach to every transaction.',
          'Our team covers all 19 Northern Colorado communities — from Fort Collins and Loveland to Windsor, Greeley, Timnath, Berthoud, and beyond. We specialize in first-time homebuyers, CHFA program guidance, move-up buyers, sellers preparing for their next chapter, and new construction in growing communities.',
        ],
      },
    ],
    cta: {
      title: 'Work With Schwartz and Associates',
      text: 'Contact us at (970) 999-1407 or visit 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525. Let us put our Northern Colorado real estate expertise to work for you.',
    },
  },
  '/': {
    sections: [
      {
        heading: 'Your Northern Colorado Real Estate Experts',
        paragraphs: [
          'Schwartz and Associates (SAA Homes) is a trusted Northern Colorado real estate team serving home buyers and sellers across all 19 communities in Larimer and Weld counties. From Fort Collins and Loveland to Windsor, Greeley, Timnath, and beyond, our local expertise helps clients make confident real estate decisions.',
          'Whether you are buying your first home, selling to move up or downsize, or exploring CHFA down payment assistance programs, Adam and Mandi Schwartz bring personalized service, market knowledge, and a commitment to your success. We represent clients under Coldwell Banker Realty from our Fort Collins office at 3665 John F Kennedy Parkway, Suite 210.',
        ],
      },
      {
        heading: 'Explore Northern Colorado Communities',
        paragraphs: [
          'Each Northern Colorado community offers a unique lifestyle — from Fort Collins\' craft breweries and CSU culture to Loveland\'s arts scene, Windsor\'s family neighborhoods, Greeley\'s affordable value, and Timnath\'s new construction. Our area guides help you find the perfect place to call home.',
        ],
      },
    ],
    cta: {
      title: 'Start Your Northern Colorado Real Estate Journey',
      text: 'Contact SAA Homes at (970) 999-1407 for expert buyer and seller representation across all 19 Northern Colorado communities.',
    },
  },
  '/cash-home-buyers/': {
    sections: [
      {
        heading: 'Sell Your Home Fast for Cash in Northern Colorado',
        paragraphs: [
          'If you need to sell your home quickly in Northern Colorado, a cash sale can close in as little as 7-14 days with no repairs, no showings, and no agent commissions. SAA Homes connects sellers with vetted cash buyers or helps you evaluate whether a traditional listing would net you more.',
          'Cash buyers purchase properties as-is — meaning you do not need to make any repairs, upgrades, or even clean out the property. This makes cash sales ideal for distressed properties, inherited homes, relocations, or any situation where speed and certainty matter more than maximizing the sale price.',
        ],
      },
      {
        heading: 'Cash Home Buying vs. Traditional Listing',
        paragraphs: [
          'Cash offers are typically below full market value because the buyer takes on the risk and convenience of an as-is, no-contingency purchase. However, when you factor in avoided repairs, no carrying costs during a 30-60 day listing period, and zero commission, the net difference is often smaller than sellers expect.',
          'SAA Homes will show you both paths with a free consultation so you can choose what is right for your situation. We represent sellers across all 19 Northern Colorado communities including Fort Collins, Loveland, Windsor, Greeley, Timnath, Berthoud, and more.',
        ],
      },
    ],
    cta: {
      title: 'Get Your Cash Offer Today',
      text: 'Contact SAA Homes at (970) 999-1407 for a no-obligation cash offer on your Northern Colorado home. Whether you sell for cash or list traditionally, we will help you find the right path forward.',
    },
    faqs: CASH_BUYER_FAQS,
  },
  '/luxury-real-estate/': {
    sections: [
      {
        heading: 'The $1M+ Market, Mastered.',
        paragraphs: [
          'For buyers and sellers of Northern Colorado’s most significant homes — the $1 million and above tier — representation is a matter of discretion, market command, and execution. Adam and Mandi Schwartz work this market directly: one call, no handoffs.',
          'Boulder’s true luxury sits well above $2 million. Fort Collins estates run to $2 million and beyond. Windsor concentrates much of the region’s $1M+ inventory in Water Valley and Pelican Lakes. We work the tier as it actually exists, using published market notes and live IRES listings — never a fabricated luxury median.',
        ],
      },
      {
        heading: 'Where $1 million and above actually lives',
        paragraphs: [
          'Citywide medians are not luxury averages. Fort Collins sat near $610,000 in July 2026; Loveland about $510,000; Windsor about $588,000; Greeley about $432,000. Boulder single-family typically ranges $900,000 to well over $2 million. $1M+ concentrates in Horsetooth and the Foothills, Water Valley and Pelican Lakes, Centerra and Lake Loveland, and Boulder’s Flatirons, Mapleton Hill, Chautauqua, and Pine Brook Hills.',
          'Homes above $750,000 in Fort Collins typically take 55–70 days on market; Windsor properties above $750,000 routinely take 65+ days. Quiet listings, off-market conversations, and correct pricing matter more in this band than volume marketing.',
        ],
      },
    ],
    cta: {
      title: 'Private Consultation',
      text: 'Enquire in confidence. Call Schwartz and Associates at (970) 999-1407 — Adam or Mandi replies personally. Email and phone are required on every inquiry.',
    },
    faqs: LUXURY_FAQS,
  },
  '/assumable-mortgages/': {
    sections: [
      {
        heading: 'Assumable Mortgages in Colorado — Keep the Seller\'s Lower Rate',
        paragraphs: [
          'An assumable mortgage lets a qualified buyer take over the seller\'s existing home loan — including its interest rate, remaining balance, and remaining term — instead of originating a new mortgage. VA and FHA loans are assumable by qualified buyers; most conventional loans are not. In a higher-rate market, assuming a lower-rate VA or FHA loan can mean a meaningfully lower monthly payment.',
          'Schwartz and Associates flags listings in Fort Collins, Loveland, Windsor, and Greeley where an assumable VA or FHA loan may be in play, connects buyers with lenders who can underwrite the assumption, and negotiates the contract around the assumption timeline. Call (970) 999-1407 to talk through whether assumption makes sense for your purchase.',
        ],
      },
      {
        heading: 'How VA loan assumption works',
        paragraphs: [
          'A buyer assumes the seller\'s VA-backed loan by applying with the lender that services it. The VA charges a one-time assumption funding fee (currently 0.5% of the loan balance for most buyers — confirm the current rate with the VA or the lender, as it can change). The lender reviews the buyer\'s credit and income and must approve the assumption. The seller\'s VA entitlement is typically restored for their next VA loan.',
          'Any qualified buyer can assume a VA-backed loan — veteran or not — because the VA guarantee stays with the loan. Non-veterans pay the VA assumption fee; veterans with remaining entitlement may have different rules. We never promise a sale will close on assumption alone — the buyer must qualify.',
        ],
      },
      {
        heading: 'How FHA loan assumption works',
        paragraphs: [
          'FHA loans are assumable by qualified buyers who meet FHA credit and income requirements, with lender approval. The buyer steps into the seller\'s FHA rate and remaining term, which can be significantly below today\'s rates. A small processing fee may apply, and the buyer typically pays closing costs unless negotiated otherwise.',
          'Conventional loans generally contain a due-on-sale clause and cannot be assumed. USDA Rural Development loans can sometimes be assumed with RD approval. We itemize every cost in writing before you commit — we do not invent savings figures, and we confirm all fees with the lender holding the loan before you write an offer.',
        ],
      },
      {
        heading: 'Buying or selling with an assumable loan in Northern Colorado',
        paragraphs: [
          'For buyers, we screen every search for assumable inventory, connect you with VA-approved and FHA-experienced lenders, and run the numbers honestly: assumed rate vs. a new loan at today\'s market. For sellers, a below-market assumable rate can be a genuine marketing advantage — we position it accurately in the listing and qualify interested buyers early so the assumption path is clear.',
          'We serve buyers and sellers across all 19 Northern Colorado communities, including Fort Collins, Loveland, Windsor, Greeley, Timnath, Severance, and Berthoud. Contact Schwartz and Associates at (970) 999-1407 to check whether an assumable mortgage fits your purchase or sale.',
        ],
      },
    ],
    cta: {
      title: 'See If an Assumable Mortgage Fits Your Purchase',
      text: 'Contact SAA Homes at (970) 999-1407 for assumable-listing screening, lender referrals, and an honest rate comparison. We reply within 24 hours.',
    },
    faqs: [
      { q: 'What is an assumable mortgage in Colorado?', a: 'An assumable mortgage lets a qualified buyer take over the seller\'s existing home loan — including its interest rate, remaining balance, and remaining term — instead of originating a new mortgage. VA and FHA loans are assumable by qualified buyers; most conventional loans are not. The buyer must still qualify with the lender that holds the loan, and the lender must approve the assumption.' },
      { q: 'How does a VA loan assumption work?', a: 'A buyer assumes the seller\'s VA-backed loan by applying with the lender that services it. The VA charges a one-time assumption funding fee (currently 0.5% of the loan balance for most buyers — confirm the current rate, as it can change). The lender reviews the buyer\'s credit and income and must approve the assumption. The seller\'s VA entitlement is typically restored for their next VA loan.' },
      { q: 'Do I need to be a veteran to assume a VA loan?', a: 'No. Any qualified buyer can assume a VA-backed loan — veteran or not — because the VA guarantee stays with the loan. Non-veterans pay the VA assumption fee (0.5% of the remaining balance, subject to change), and veterans with remaining entitlement may have different rules. The lender still underwrites the buyer\'s credit and income.' },
      { q: 'Are FHA loans assumable?', a: 'Yes, FHA loans are assumable by qualified buyers, subject to lender approval. The buyer must meet FHA credit and income requirements, and the lender reviews the assumption like a new application. The interest rate on an assumed FHA loan is the seller\'s original rate, which can be attractive when rates have risen since the loan was originated.' },
      { q: 'How can SAA Homes help me buy with an assumable mortgage?', a: 'Schwartz and Associates flags listings where an assumable VA or FHA loan may be in play, connects you with VA-approved and FHA-experienced lenders who can underwrite the assumption, and negotiates the contract around the assumption timeline. Call (970) 999-1407.' },
    ],
  },
  '/veterans/': {
    sections: [
      {
        heading: 'Honoring Those Who Served — 0.5% Back to Every Veteran',
        paragraphs: [
          'VA loans, military relocation, and local expertise across Fort Collins, Loveland, Windsor, and Greeley.',
          'Schwartz and Associates gives 0.5% of the purchase price back to veterans, applied however you choose: home warranty, closing costs, or price reduction.',
          'This is a real offer from Adam and Mandi Schwartz — not an “up to” teaser. On a $500,000 home, 0.5% is $2,500. On a $600,000 home, 0.5% is $3,000. You tell us how to apply it.',
        ],
      },
      {
        heading: 'How a VA loan actually works',
        paragraphs: [
          'Facts from VA.gov. We do not invent rates, funding-fee charts, or closing timelines. Your VA-approved lender confirms the numbers on your file.',
          'VA does not require a down payment on a purchase loan. A lender may still ask for one in some cases — we help you confirm that with a VA-approved lender before you write an offer.',
          'VA-backed loans do not require private mortgage insurance. That is a real monthly savings versus most low-down conventional or FHA loans.',
        ],
      },
    ],
    cta: {
      title: 'Get your 0.5% veteran benefit + VA loan guidance',
      text: 'Adam and Mandi Schwartz — Schwartz and Associates, Coldwell Banker Realty. Call (970) 999-1407.',
    },
    faqs: [
      { q: "Can I use a VA loan in Fort Collins?", a: "Yes. A VA-backed purchase loan can be used on an eligible primary residence in Fort Collins and throughout Northern Colorado — including Loveland, Windsor, and Greeley — if you have a Certificate of Eligibility and you and the property meet VA and lender requirements. The home must be your primary residence. Confirm property eligibility (including condos on the VA-approved list) with a VA-approved lender." },
      { q: "What does 0.5% back actually mean for me?", a: "Schwartz and Associates gives 0.5% of the purchase price back to veterans who buy with us. On a $500,000 purchase, 0.5% is $2,500. On a $600,000 purchase, 0.5% is $3,000. You choose how it is applied: a home warranty, a credit toward closing costs, or a price reduction. It is disclosed in writing at closing, as Colorado requires for commission rebates. It is not an 'up to' offer and it is not a lender credit." },
      { q: "Do I need a down payment with a VA loan?", a: "VA does not require a down payment. Some lenders may still ask for one depending on credit, residual income, or the specific file. You will usually pay closing costs unless the seller or lender covers some of them. We help you compare a true 0% down path with any lender conditions before you write an offer." },
      { q: "Can my spouse co-borrow?", a: "A spouse can typically be on a VA loan with you. Adding a non-spouse co-borrower is more limited and depends on VA and lender rules. Surviving spouses may have a separate VA home-loan benefit. Confirm occupancy, entitlement, and who can be on the note with a VA-approved lender — we will introduce you to one." },
      { q: "What's the Colorado disabled veteran property tax exemption?", a: "Colorado's disabled-veteran property tax exemption typically exempts 50% of the first $200,000 of actual value on a qualifying primary residence. The core eligibility on the state veterans site is a 100% permanent and total service-connected disability rating from the VA; Gold Star spouses may also qualify. File with your county assessor and confirm current rules with the Colorado Department of Revenue or vets.colorado.gov — we do not invent tax numbers or file the exemption for you." },
      { q: "How fast can I close with a VA loan?", a: "A VA purchase often closes on a similar 30–45 day timeline to other loan types once your Certificate of Eligibility, VA appraisal, and underwriting are in place. PCS orders, a delayed appraisal, or a condo approval can add time. We build the contract around your report date rather than promising a number we cannot control. Confirm current timelines with your lender." },
    ],
  },
};

function matchMoneyPage(path) {
  return MONEY_PAGE_CONTENT[path] || null;
}

function injectMoneyPageBody(html, route, content) {
  const pageTitle = escapeHtml(route.title || '');
  const phoneHtml = '<strong>(970) 999-1407</strong>';

  let sectionsHtml = '';
  if (content.sections) {
    sectionsHtml = content.sections.map((section) => {
      let html = `      <section class="prerendered-money-section">\n`;
      if (section.heading) {
        html += `        <h2>${escapeHtml(section.heading)}</h2>\n`;
      }
      if (section.paragraphs) {
        html += section.paragraphs.map((p) => `        <p>${escapeHtml(p)}</p>`).join('\n') + '\n';
      }
      if (section.list) {
        html += `        <ul>\n`;
        html += section.list.map((item) => `          <li>${escapeHtml(item)}</li>`).join('\n') + '\n';
        html += `        </ul>\n`;
      }
      html += `      </section>\n`;
      return html;
    }).join('');
  }

  // Build FAQ section for money pages with FAQ data
  let faqHtml = '';
  if (content.faqs && content.faqs.length > 0) {
    faqHtml =
      `      <section class="prerendered-faq">\n` +
      `        <h2>Frequently Asked Questions</h2>\n` +
      content.faqs.map((faq) =>
        `        <div itemscope="" itemprop="mainEntity" itemtype="https://schema.org/Question">\n` +
        `          <h3 itemprop="name">${escapeHtml(faq.q)}</h3>\n` +
        `          <div itemscope="" itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n` +
        `            <p itemprop="text">${escapeHtml(faq.a)}</p>\n` +
        `          </div>\n` +
        `        </div>`
      ).join('\n') + `\n      </section>\n`;
  }

  // Build testimonials section for money pages
  let testimonialsHtml = '';
  if (content.testimonials && content.testimonials.length > 0) {
    testimonialsHtml =
      `      <section class="prerendered-testimonials">\n` +
      `        <h2>Success Stories</h2>\n` +
      content.testimonials.map((t) =>
        `        <div class="prerendered-testimonial">\n` +
        `          <p>"${escapeHtml(t.text)}"</p>\n` +
        `          <p>— ${escapeHtml(t.name)}</p>\n` +
        `        </div>`
      ).join('\n') + `\n      </section>\n`;
  }

  let ctaHtml = '';
  if (content.cta) {
    ctaHtml =
      `      <section class="prerendered-cta">\n` +
      `        <h2>${escapeHtml(content.cta.title)}</h2>\n` +
      `        <p>${escapeHtml(content.cta.text).replace('(970) 999-1407', phoneHtml)}</p>\n` +
      `      </section>\n`;
  }

  const bodyContent =
    `\n` +
    `    <div class="prerendered-money-content">\n` +
    `      <h1>${pageTitle}</h1>\n` +
    `${sectionsHtml}` +
    `${faqHtml}` +
    `${testimonialsHtml}` +
    `${ctaHtml}` +
    `    </div>\n  `;

  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

// ---------------------------------------------------------------------------
// CHFA body content injection
// ---------------------------------------------------------------------------

function injectChfaBody(html, config) {
  const title = escapeHtml(config.title || '');
  const tagline = escapeHtml(config.tagline || '');
  const introHtml = (config.introParagraphs || [])
    .map((p) => `      <p class="prerendered-intro">${escapeHtml(p)}</p>`)
    .join('\n');

  // CHFA Programs table
  let programsHtml = '';
  if (config.programs && CHFA_PROGRAMS && CHFA_PROGRAMS.length > 0) {
    programsHtml =
      `      <section class="prerendered-chfa-section">\n` +
      `        <h2>CHFA Loan Programs at a Glance</h2>\n` +
      `        <p>CHFA offers multiple first mortgage programs. The right one depends on your buyer status, loan type preference, and income.</p>\n` +
      `        <table class="prerendered-table">\n` +
      `          <thead><tr><th>Program</th><th>Loan type</th><th>DPA options</th><th>Best for</th></tr></thead>\n` +
      `          <tbody>\n` +
      CHFA_PROGRAMS.map((p) =>
        `            <tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.loanType)}</td><td>${escapeHtml(p.dpa)}</td><td>${escapeHtml(p.bestFor)}</td></tr>`
      ).join('\n') +
      `\n          </tbody>\n` +
      `        </table>\n` +
      `      </section>\n`;
  }

  // DPA Options
  let dpaHtml = '';
  if (config.dpaOptions) {
    dpaHtml =
      `      <section class="prerendered-chfa-section">\n` +
      `        <h2>Two Ways CHFA Helps With Your Down Payment</h2>\n` +
      `        <div class="prerendered-dpa-grid">\n` +
      (CHFA_DPA_OPTIONS || []).map((opt) =>
        `          <div class="prerendered-dpa-card">\n` +
        `            <h3>${escapeHtml(opt.title)}</h3>\n` +
        `            <p><strong>${escapeHtml(opt.amount)}</strong></p>\n` +
        `            <p>${escapeHtml(opt.detail)}</p>\n` +
        `          </div>`
      ).join('\n') +
      `\n        </div>\n` +
      `      </section>\n`;
  }

  // Requirements
  let reqHtml = '';
  if (config.requirements) {
    reqHtml =
      `      <section class="prerendered-chfa-section">\n` +
      `        <h2>General CHFA Requirements</h2>\n` +
      `        <ul>\n` +
      (CHFA_REQUIREMENTS || []).map((r) =>
        `          <li><strong>${escapeHtml(r.label)}:</strong> ${escapeHtml(r.value)}</li>`
      ).join('\n') +
      `\n        </ul>\n` +
      `      </section>\n`;
  }

  // County limits
  let countyHtml = '';
  if (config.countyLimits) {
    countyHtml =
      `      <section class="prerendered-chfa-section">\n` +
      `        <h2>Northern Colorado CHFA Income & Price Limits</h2>\n` +
      `        <table class="prerendered-table">\n` +
      `          <thead><tr><th>County</th><th>Communities</th><th>Income range</th><th>Price limit</th></tr></thead>\n` +
      `          <tbody>\n` +
      (CHFA_COUNTY_LIMITS || []).map((c) =>
        `            <tr><td><strong>${escapeHtml(c.county)}</strong></td><td>${escapeHtml(c.cities)}</td><td>${escapeHtml(c.incomeRange)}</td><td>${escapeHtml(c.priceRange)}</td></tr>`
      ).join('\n') +
      `\n          </tbody>\n` +
      `        </table>\n` +
      `      </section>\n`;
  }

  // Specialty programs
  let specialtyHtml = '';
  if (config.specialtyPrograms) {
    specialtyHtml =
      `      <section class="prerendered-chfa-section">\n` +
      `        <h2>Specialty CHFA Programs</h2>\n` +
      `        <ul>\n` +
      (CHFA_SPECIALTY_PROGRAMS || []).map((s) =>
        `          <li><strong>${escapeHtml(s.title)}</strong> — ${escapeHtml(s.audience)}: ${escapeHtml(s.benefit)}</li>`
      ).join('\n') +
      `\n        </ul>\n` +
      `      </section>\n`;
  }

  // Steps (HowTo) — visible steps matching HowTo JSON-LD
  let stepsHtml = '';
  if (config.steps && CHFA_STEPS && CHFA_STEPS.length > 0) {
    stepsHtml =
      `      <section class="prerendered-chfa-section">\n` +
      `        <h2>How to Get CHFA Down Payment Assistance</h2>\n` +
      `        <ol class="prerendered-steps">\n` +
      CHFA_STEPS.map((s) =>
        `          <li><strong>${escapeHtml(s.title)}:</strong> ${escapeHtml(s.description)}</li>`
      ).join('\n') +
      `\n        </ol>\n` +
      `      </section>\n`;
  }

  // FAQ section
  let faqHtml = '';
  if (config.faqs && config.faqs.length > 0) {
    faqHtml =
      `      <section class="prerendered-faq">\n` +
      `        <h2>Frequently Asked Questions About CHFA Down Payment Assistance</h2>\n` +
      config.faqs.map((faq) =>
        `        <div itemscope="" itemprop="mainEntity" itemtype="https://schema.org/Question">\n` +
        `          <h3 itemprop="name">${escapeHtml(faq.q)}</h3>\n` +
        `          <div itemscope="" itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n` +
        `            <p itemprop="text">${escapeHtml(faq.a)}</p>\n` +
        `          </div>\n` +
        `        </div>`
      ).join('\n') +
      `\n      </section>\n`;
  }

  // CTA
  const ctaHtml =
    `      <section class="prerendered-cta">\n` +
    `        <h2>Work With Schwartz and Associates</h2>\n` +
    `        <p>${escapeHtml(config.contactCta || '')}</p>\n` +
    `      </section>\n`;

  const bodyContent =
    `\n` +
    `    <div class="prerendered-chfa-content">\n` +
    `      <h1>${title}</h1>\n` +
    `      ${tagline ? `<p class="prerendered-tagline"><strong>${tagline}</strong></p>\n` : ''}` +
    `${introHtml}\n` +
    `${programsHtml}` +
    `${dpaHtml}` +
    `${reqHtml}` +
    `${countyHtml}` +
    `${specialtyHtml}` +
    `${stepsHtml}` +
    `${faqHtml}` +
    `${ctaHtml}` +
    `    </div>\n  `;

  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

// ---------------------------------------------------------------------------

function buildRouteSchemas(route) {
  const { path, title, description } = route;
  const canonical = `${SITE_URL}${path}`;
  const schemas = [];

  // Every page gets RealEstateAgent + WebSite + WebPage
  schemas.push(buildRealEstateAgentSchema());
  schemas.push(buildWebsiteSchema());
  schemas.push(buildWebPageSchema({ title, description, canonical }));

  // Trust schema — AggregateRating + Review must be crawler-visible on the
  // trust pages (GEO review 2026-08-07: was Helmet/client-only → invisible).
  if (['/', '/about-us/', '/testimonials/', '/contact/'].includes(route.path)) {
    const reviewSchema = getReviewSchema();
    if (reviewSchema) schemas.push(reviewSchema);
  }

  // Area pages get Place, BreadcrumbList, and full area schemas
  const area = matchAreaPage(path);
  if (area) {
    const areaSchemas = buildAreaPageSchemas(area);
    // buildAreaPageSchemas returns WebPage + BreadcrumbList + RealEstateAgent
    // which partially overlaps with what we already added.  Deduplicate by
    // taking only the non-duplicate schemas (Place info is inside WebPage in
    // the area version; the RealEstateAgent and BreadcrumbList from area
    // are richer, so we prefer those).
    areaSchemas.forEach((s) => {
      // Replace our generic WebPage if area has one
      if (s['@type'] === 'WebPage') {
        const idx = schemas.findIndex((x) => x['@type'] === 'WebPage');
        if (idx !== -1) schemas[idx] = s;
        else schemas.push(s);
      }
      // Replace our generic RealEstateAgent if area has one
      else if (s['@type'] === 'RealEstateAgent') {
        const idx = schemas.findIndex((x) => x['@type'] === 'RealEstateAgent');
        if (idx !== -1) schemas[idx] = s;
        else schemas.push(s);
      }
      // BreadcrumbList from area is richer – add it
      else if (s['@type'] === 'BreadcrumbList') {
        const idx = schemas.findIndex((x) => x['@type'] === 'BreadcrumbList');
        if (idx !== -1) schemas[idx] = s;
        else schemas.push(s);
      }
      // Place / other area-specific schemas
      else {
        schemas.push(s);
      }
    });
  }

  // CHFA pages – mark as AboutPage for richer eligibility
  if (
    path.startsWith('/chfa-') ||
    path === '/chfa-down-payment-assistance/' ||
    path === '/chfa-schools-to-home/' ||
    path === '/colorado-champions-home-loan-program/' ||
    path === '/greeley-g-hope-down-payment-assistance/'
  ) {
    const aboutSchema = schemas.find((s) => s['@type'] === 'WebPage');
    if (aboutSchema) {
      aboutSchema['@type'] = 'AboutPage';
    }
  }

  // Money pages with FAQ data – add FAQPage schema
  const moneyPage = matchMoneyPage(path);
  if (moneyPage && moneyPage.faqs && moneyPage.faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: moneyPage.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    });
  }

  // CHFA pages with FAQ data – add FAQPage schema (for AI answer visibility)
  const chfaConfig = matchChfaPage(path);
  if (chfaConfig && chfaConfig.faqs && chfaConfig.faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: chfaConfig.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    });
  }

  // CHFA pages with steps – add HowTo schema (AI uses for step-by-step answers)
  if (chfaConfig && chfaConfig.steps && CHFA_STEPS && CHFA_STEPS.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to get CHFA down payment assistance in Colorado',
      description:
        'Steps for Colorado first-time homebuyers to access CHFA down payment and closing cost assistance.',
      step: CHFA_STEPS.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.title,
        text: s.description,
      })),
    });
  }

  // CHFA pages with programs – add ItemList schema (AI uses for list-based comparisons)
  if (chfaConfig && chfaConfig.programs && CHFA_PROGRAMS && CHFA_PROGRAMS.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'CHFA Home Loan Programs',
      itemListElement: CHFA_PROGRAMS.map((program, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: program.name,
        description: `${program.loanType}. ${program.dpa}. Best for: ${program.bestFor}`,
      })),
    });
  }

  // Blog posts with FAQ data – add FAQPage schema for AI answer visibility
  const blogPost = matchBlogPost(path);
  if (blogPost && blogPost.faqs && blogPost.faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: blogPost.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    });
  }

  // Cash Home Buyers, Luxury, and Veterans pages are handled via MONEY_PAGE_CONTENT faqs above

  return schemas;
}

function buildRouteMetaTags(route) {
  const { path, title, description } = route;
  const canonical = `${SITE_URL}${path}`;
  const tags = [];

  const ogTitle = route.ogTitle || title;
  const ogDescription = route.ogDescription || description;
  const ogImage = getOgImageForRoute(route);
  const ogImageAlt = route.ogImageAlt || ogTitle;
  const keywords = getKeywordsForRoute(path);

  // Standard meta
  if (keywords) {
    tags.push(`<meta name="keywords" content="${escapeAttr(keywords)}" />`);
  }
  // robots for noindex pages is applied in injectMeta (replaces shell default)
  tags.push(`<meta name="author" content="${escapeAttr(BUSINESS.name)}" />`);
  tags.push(`<meta name="geo.region" content="US-CO" />`);
  tags.push(`<meta name="geo.placename" content="Fort Collins, Colorado" />`);

  // Open Graph — iMessage, Facebook, LinkedIn read these from static HTML
  tags.push(`<meta property="og:type" content="website" />`);
  tags.push(`<meta property="og:site_name" content="Schwartz and Associates" />`);
  tags.push(`<meta property="og:locale" content="en_US" />`);
  tags.push(`<meta property="og:title" content="${escapeAttr(ogTitle)}" />`);
  tags.push(
    `<meta property="og:description" content="${escapeAttr(ogDescription)}" />`
  );
  if (ogImage) {
    tags.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
    tags.push(`<meta property="og:image:secure_url" content="${escapeAttr(ogImage)}" />`);
    tags.push(`<meta property="og:image:alt" content="${escapeAttr(ogImageAlt)}" />`);
    tags.push(`<meta property="og:image:width" content="1200" />`);
    tags.push(`<meta property="og:image:height" content="630" />`);
  }
  tags.push(`<meta property="og:url" content="${escapeAttr(canonical)}" />`);

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  tags.push(`<meta name="twitter:site" content="@saahomes" />`);
  tags.push(`<meta name="twitter:title" content="${escapeAttr(ogTitle)}" />`);
  tags.push(
    `<meta name="twitter:description" content="${escapeAttr(ogDescription)}" />`
  );
  if (ogImage) {
    tags.push(
      `<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`
    );
    tags.push(
      `<meta name="twitter:image:alt" content="${escapeAttr(ogImageAlt)}" />`
    );
  }
  tags.push(`<meta name="twitter:url" content="${escapeAttr(canonical)}" />`);

  return tags;
}

// ---------------------------------------------------------------------------
// Events calendar page body (crawler-visible events list)
// ---------------------------------------------------------------------------

function injectEventsBody(html) {
  const events = getAllEvents();
  const monthNames = getMonthNames();
  const reviewedLabel = new Date(EVENTS_DATA_LAST_REVIEWED).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

  // Group events by month so crawlers see a real calendar structure
  const byMonth = monthNames.map((_, idx) => ({
    idx,
    name: monthNames[idx],
    events: events
      .filter((e) => e.months.includes(idx))
      .sort((a, b) => a.cityName.localeCompare(b.cityName)),
  }));

  let bodyHtml = '';
  for (const group of byMonth) {
    if (!group.events.length) continue;
    const items = group.events
      .map((e) => {
        const cityLink = e.isRegional
          ? `<span class="prerendered-event-city">${escapeHtml(e.cityName)}</span>`
          : `<a href="${SITE_URL}/northern-colorado-areas/${e.citySlug}/">${escapeHtml(e.cityName)} area guide</a>`;
        const official = e.officialUrl
          ? ` <a href="${escapeHtml(e.officialUrl)}" rel="noopener">official site</a>`
          : '';
        const when = e.dates || e.typicalMonths || 'Dates vary';
        return (
          `          <li class="prerendered-event">` +
          `<strong>${escapeHtml(e.name)}</strong> &mdash; ${escapeHtml(e.cityName)} &middot; ${escapeHtml(e.season)}` +
          ` &middot; <strong>${escapeHtml(when)}</strong>. ${escapeHtml(e.description)} ${cityLink}.${official}</li>`
        );
      })
      .join('\n');
    bodyHtml +=
      `      <section class="prerendered-events-month">\n` +
      `        <h2>${group.name} Events in Northern Colorado</h2>\n` +
      `        <ul>\n${items}\n        </ul>\n` +
      `      </section>\n`;
  }

  const guidePath = getEventsGuidePath();
  const bodyContent =
    `\n` +
    `    <div class="prerendered-events-content">\n` +
    `      <h1>Northern Colorado Events & Happenings Calendar</h1>\n` +
    `      <p>Browse festivals, farmers markets, rodeos, and community celebrations across 19 Front Range communities — Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Johnstown, Eaton, Milliken, La Salle, Mead, Longmont, Boulder, Berthoud, Firestone, Frederick, Evans, Severance, and Niwot. Filter the interactive calendar by month or city on this page. Data reviewed ${escapeHtml(reviewedLabel)}.</p>\n` +
    `      ${bodyHtml}\n` +
    `      <section class="prerendered-events-cta">\n` +
    `        <h2>Find a Home Near the Events You Love</h2>\n` +
    `        <p>Northern Colorado community events are a big part of why buyers choose this area. Explore homes for sale in any of our 19 communities, or get a free home valuation. Contact Schwartz and Associates at <strong>(970) 999-1407</strong>.</p>\n` +
    `        <p><a href="${SITE_URL}/properties/">Search Northern Colorado Homes</a> &middot; <a href="${SITE_URL}/for-buyers/">Buyers Guide</a> &middot; <a href="${SITE_URL}/for-sellers/">Get My Home Value</a> &middot; <a href="${SITE_URL}${guidePath}">Read the Full Events Guide</a></p>\n` +
    `      </section>\n` +
    `    </div>\n  `;

  return html.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(indexPath)) {
    console.error('dist/index.html not found. Run vite build first.');
    process.exit(1);
  }

  const baseHtml = readFileSync(indexPath, 'utf8');

  // Prefetch live listings for ItemList schemas (real MLS data only).
  // /properties/ → first page of NoCO results (max 24)
  // each area page → featured listings for that city (max 12)
  console.log(`Fetching listings for ItemList schema from ${LISTINGS_API_BASE}…`);
  const [propertiesListings, ...areaListingPairs] = await Promise.all([
    fetchListingsForItemList({ city: '__noco__', limit: 24 }),
    ...areaSeoPages.map(async (area) => {
      const city = areaListingCity(area);
      if (!city) return [area.slug, []];
      const rows = await fetchListingsForItemList({ city, limit: 12 });
      return [area.slug, rows];
    }),
  ]);
  const areaListingsBySlug = Object.fromEntries(areaListingPairs);
  console.log(
    `  ItemList data: ${propertiesListings.length} properties listings; ` +
      `${Object.values(areaListingsBySlug).filter((r) => r.length).length}/${areaSeoPages.length} areas with listings`
  );

  for (const route of routes) {
    const canonical = `${SITE_URL}${route.path}`;

    // 1. Start from base (pristine index.html each time)
    let html = injectMeta(baseHtml, {
      title: route.title,
      description: route.description,
      canonical,
      robots: route.robots,
    });

    // 2. Inject JSON-LD schemas
    const schemas = buildRouteSchemas(route);
    const cityHomes = matchCityHomesPage(route.path);
    if (cityHomes) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Homes for Sale', item: `${SITE_URL}/properties/` },
          { '@type': 'ListItem', position: 3, name: `${cityHomes.city} Homes for Sale`, item: canonical },
        ],
      });
    }

    // GEO ItemList: /properties/ first page of NoCO listings (max 24)
    if (route.path === '/properties/' || route.path === '/properties') {
      const itemList = buildListingsItemListSchema(propertiesListings, {
        name: 'Homes for Sale in Northern Colorado',
        description:
          'Active IRES MLS listings across Fort Collins, Loveland, Windsor, Greeley, and Northern Colorado.',
        maxItems: 24,
      });
      if (itemList) {
        schemas.push(itemList);
        console.log(`  ItemList: ${itemList.itemListElement.length} listings on /properties/`);
      }
    }

    // GEO ItemList: area pages — featured active listings for that city (max 12)
    const area = matchAreaPage(route.path);
    if (area) {
      const featured = areaListingsBySlug[area.slug] || [];
      const itemList = buildListingsItemListSchema(featured, {
        name: `Homes for Sale in ${area.city}, CO`,
        description: `Featured active listings in ${area.city}, Colorado from IRES MLS.`,
        maxItems: 12,
      });
      if (itemList) {
        schemas.push(itemList);
        console.log(
          `  ItemList: ${itemList.itemListElement.length} featured listings for ${area.slug}`
        );
      }
    }

    // GEO ItemList: hub page — all area guides (machine-enumerable coverage)
    if (
      route.path === '/northern-colorado-areas/' ||
      route.path === '/northern-colorado-areas'
    ) {
      const guidesList = buildAreaGuidesItemListSchema(areaSeoPages);
      if (guidesList) {
        schemas.push(guidesList);
        console.log(`  ItemList: ${guidesList.itemListElement.length} area guides on hub`);
      }
    }

    html = injectJsonLd(html, schemas);

    // 3. Inject OG / Twitter / meta tags
    const metaTags = buildRouteMetaTags(route);
    html = injectMetaTags(html, metaTags);

    // 4. Inject visible body content into <div id="root"> for crawlers
    const neighborhoodPage = matchNeighborhoodPage(route.path);
    const blogPost = matchBlogPost(route.path);
    const chfaPage = matchChfaPage(route.path);
    const moneyPage = matchMoneyPage(route.path);
    if (route.path === '/events/' || route.path === '/events') {
      html = injectEventsBody(html);
      console.log('  Body: injected events calendar with monthly groupings + CTA');
    } else if (area) {
      html = injectAreaBody(html, area);
      console.log(
        `  Body: injected ${AREA_FAQS[area.slug]?.length || 0} FAQ items + nearby communities + CTA`
      );
    } else if (neighborhoodPage) {
      html = injectNeighborhoodBody(html, neighborhoodPage);
      console.log(
        `  Body: injected neighborhood "${neighborhoodPage.slug}" with highlights + schools + features + CTA`
      );
    } else if (blogPost) {
      html = injectBlogBody(html, blogPost);
      console.log(
        `  Body: injected blog "${blogPost.slug}" with ${blogPost.sections?.length || 0} sections + ${blogPost.faqs?.length || 0} FAQs + CTA`
      );
    } else if (chfaPage) {
      html = injectChfaBody(html, chfaPage);
      console.log(
        `  Body: injected CHFA page "${chfaPage.slug}" with ${chfaPage.faqs?.length || 0} FAQs + programs + requirements + CTA`
      );
    } else if (moneyPage) {
      html = injectMoneyPageBody(html, route, moneyPage);
      console.log(
        `  Body: injected money page "${route.path}" with ${moneyPage.sections?.length || 0} content sections + CTA`
      );
    } else if (cityHomes) {
      html = injectCityHomesBody(html, cityHomes);
      console.log(`  Body: injected city homes-for-sale page "${cityHomes.city}" with intro + links + attribution`);
    } else {
      html = injectGenericBody(html, route);
    }

    // 5. Inject crawlable sitewide links block (all 19 cities + money pages) —
    //    the React nav/footer is client-side rendered, so without this the
    //    crawler sees almost no internal links. This builds the hub-and-spoke
    //    link graph on every page.
    html = injectSitewideLinks(html, route.path);

    // Write out
    const routeDir = join(
      distDir,
      route.path.replace(/^\//, '').replace(/\/$/, '')
    );
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, 'index.html'), html);
    console.log(
      `Prerendered ${route.path} (${schemas.length} schemas, ${metaTags.length} meta tags)`
    );
  }

  console.log(`Prerendered ${routes.length} routes with full schema + OG + Twitter.`);
}

main().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
