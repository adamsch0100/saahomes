import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPrerenderRoutes, SITE_URL } from '../src/data/siteRoutes.js';
import { BUSINESS } from '../src/utils/seoConstants.js';
import { areaSeoPages, buildAreaPageSchemas } from '../src/data/areaSeo.js';
import { blogPosts } from '../src/data/blogPosts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');
const indexPath = join(distDir, 'index.html');

const routes = getPrerenderRoutes();

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

function matchBlogPost(path) {
  const match = path.match(/^\/blog\/([^/]+)\/$/);
  if (!match) return null;
  return blogPosts.find((p) => p.slug === match[1]) || null;
}

function getOgImageForRoute(path) {
  // Area pages use their hero image
  const area = matchAreaPage(path);
  if (area && area.heroImage) {
    return area.heroImage.startsWith('http')
      ? area.heroImage
      : `${SITE_URL}${area.heroImage}`;
  }
  // Blog posts use their featured image
  const post = matchBlogPost(path);
  if (post && post.image) {
    return post.image.startsWith('http') ? post.image : `${SITE_URL}${post.image}`;
  }
  // Default to business logo (BUSINESS.logo is already absolute)
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

function injectMeta(html, { title, description, canonical }) {
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
// Per-route schema & meta computation
// ---------------------------------------------------------------------------

function buildRouteSchemas(route) {
  const { path, title, description } = route;
  const canonical = `${SITE_URL}${path}`;
  const schemas = [];

  // Every page gets RealEstateAgent + WebSite + WebPage
  schemas.push(buildRealEstateAgentSchema());
  schemas.push(buildWebsiteSchema());
  schemas.push(buildWebPageSchema({ title, description, canonical }));

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
    path === '/colorado-champions-home-loan-program/'
  ) {
    const aboutSchema = schemas.find((s) => s['@type'] === 'WebPage');
    if (aboutSchema) {
      aboutSchema['@type'] = 'AboutPage';
    }
  }

  return schemas;
}

function buildRouteMetaTags(route) {
  const { path, title, description } = route;
  const canonical = `${SITE_URL}${path}`;
  const tags = [];

  const ogImage = getOgImageForRoute(path);
  const keywords = getKeywordsForRoute(path);

  // Standard meta
  if (keywords) {
    tags.push(`<meta name="keywords" content="${escapeAttr(keywords)}" />`);
  }
  tags.push(`<meta name="author" content="${escapeAttr(BUSINESS.name)}" />`);
  tags.push(`<meta name="geo.region" content="US-CO" />`);
  tags.push(`<meta name="geo.placename" content="Fort Collins, Colorado" />`);

  // Open Graph
  tags.push(`<meta property="og:type" content="website" />`);
  tags.push(`<meta property="og:site_name" content="SAA Homes" />`);
  tags.push(`<meta property="og:locale" content="en_US" />`);
  tags.push(`<meta property="og:title" content="${escapeAttr(title)}" />`);
  tags.push(
    `<meta property="og:description" content="${escapeAttr(description)}" />`
  );
  if (ogImage) {
    tags.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
  }
  tags.push(`<meta property="og:url" content="${escapeAttr(canonical)}" />`);

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  tags.push(`<meta name="twitter:site" content="@saahomes" />`);
  tags.push(`<meta name="twitter:title" content="${escapeAttr(title)}" />`);
  tags.push(
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`
  );
  if (ogImage) {
    tags.push(
      `<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`
    );
  }
  tags.push(`<meta name="twitter:url" content="${escapeAttr(canonical)}" />`);

  return tags;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(indexPath)) {
  console.error('dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const baseHtml = readFileSync(indexPath, 'utf8');

for (const route of routes) {
  const canonical = `${SITE_URL}${route.path}`;

  // 1. Start from base (pristine index.html each time)
  let html = injectMeta(baseHtml, {
    title: route.title,
    description: route.description,
    canonical,
  });

  // 2. Inject JSON-LD schemas
  const schemas = buildRouteSchemas(route);
  html = injectJsonLd(html, schemas);

  // 3. Inject OG / Twitter / meta tags
  const metaTags = buildRouteMetaTags(route);
  html = injectMetaTags(html, metaTags);

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
