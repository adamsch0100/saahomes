import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPrerenderRoutes, SITE_URL } from '../src/data/siteRoutes.js';
import { BUSINESS } from '../src/utils/seoConstants.js';
import { areaSeoPages, buildAreaPageSchemas } from '../src/data/areaSeo.js';
import { blogPosts } from '../src/data/blogPosts.js';
import { AREA_FAQS } from '../src/data/areaFaqs.js';

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
// Body content injection for crawlers (visible content in <div id="root">)
// ---------------------------------------------------------------------------

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

  // CTA with phone number
  const ctaHtml =
    `      <section class="prerendered-cta">\n` +
    `        <h2>Work With Schwartz and Associates in ${city}</h2>\n` +
    `        <p>Ready to buy or sell in ${city}? Contact SAA Homes today at <strong>(970) 999-1407</strong> or visit our office at 3665 John F Kennedy Parkway, Suite 210, Fort Collins, CO 80525. Let our local experts guide you through every step of your real estate journey in Northern Colorado.</p>\n` +
    `        <p>Schwartz and Associates, Coldwell Banker Realty — serving home buyers and sellers across all 19 Northern Colorado communities including Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Johnstown, Eaton, Milliken, La Salle, Mead, Longmont, Boulder, Berthoud, Firestone, Frederick, Evans, Severance, and Niwot.</p>\n` +
    `      </section>`;

  const bodyContent =
    `\n` +
    `    <div class="prerendered-area-content">\n` +
    `      <h1>${city}, Colorado Real Estate & Neighborhood Guide</h1>\n` +
    `      ${tagline ? `<p class="prerendered-tagline"><strong>${tagline}</strong></p>\n` : ''}` +
    `      ${county ? `<p class="prerendered-county">Serving ${county}</p>\n` : ''}` +
    `${introHtml}\n` +
    `${faqHtml}\n` +
    `${nearbyHtml}\n` +
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
    path === '/colorado-champions-home-loan-program/' ||
    path === '/greeley-g-hope-down-payment-assistance/'
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

  const ogTitle = route.ogTitle || title;
  const ogDescription = route.ogDescription || description;
  const ogImage = getOgImageForRoute(route);
  const ogImageAlt = route.ogImageAlt || ogTitle;
  const keywords = getKeywordsForRoute(path);

  // Standard meta
  if (keywords) {
    tags.push(`<meta name="keywords" content="${escapeAttr(keywords)}" />`);
  }
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

  // 4. Inject visible body content into <div id="root"> for crawlers
  const area = matchAreaPage(route.path);
  const blogPost = matchBlogPost(route.path);
  if (area) {
    html = injectAreaBody(html, area);
    console.log(
      `  Body: injected ${AREA_FAQS[area.slug]?.length || 0} FAQ items + nearby communities + CTA`
    );
  } else if (blogPost) {
    html = injectBlogBody(html, blogPost);
    console.log(
      `  Body: injected blog "${blogPost.slug}" with ${blogPost.sections?.length || 0} sections + ${blogPost.faqs?.length || 0} FAQs + CTA`
    );
  } else {
    html = injectGenericBody(html, route);
  }

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
