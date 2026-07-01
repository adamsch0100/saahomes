import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPrerenderRoutes, SITE_URL } from '../src/data/siteRoutes.js';
import { BUSINESS } from '../src/utils/seoConstants.js';
import { areaSeoPages, buildAreaPageSchemas } from '../src/data/areaSeo.js';
import { blogPosts } from '../src/data/blogPosts.js';
import { AREA_FAQS } from '../src/data/areaFaqs.js';
import { CHFA_PAGE_CONFIGS, CHFA_PROGRAMS, CHFA_DPA_OPTIONS, CHFA_REQUIREMENTS, CHFA_COUNTY_LIMITS, CHFA_SPECIALTY_PROGRAMS } from '../src/data/chfaData.js';

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

  // Build city-specific guide links (internal links to relevant blog posts)
  const CITY_BLOG_GUIDES = {
    'fort-collins': { title: 'Selling Your Home in Fort Collins', slug: 'selling-your-home-in-fort-collins', guideTitle: 'Fort Collins Realtor Guide', guideSlug: 'fort-collins-realtor' },
    'windsor': { title: 'Selling Your Home in Windsor, Colorado', slug: 'selling-your-home-in-windsor-colorado' },
  };
  let guidesHtml = '';
  const cityGuide = CITY_BLOG_GUIDES[area.slug];
  if (cityGuide) {
    let guideItems = `          <li><a href="${SITE_URL}/blog/${cityGuide.slug}/">${escapeHtml(cityGuide.title)}</a> &mdash; Pricing strategy, preparation tips & local market insights</li>\n`;
    if (cityGuide.guideSlug) {
      guideItems += `          <li><a href="${SITE_URL}/blog/${cityGuide.guideSlug}/">${escapeHtml(cityGuide.guideTitle)}</a> &mdash; Expert real estate guidance for ${city} buyers and sellers</li>\n`;
    }
    guidesHtml =
      `      <section class="prerendered-city-guides">\n` +
      `        <h2>${city} Real Estate Guides</h2>\n` +
      `        <p>Explore our detailed guides for ${city} home buyers and sellers:</p>\n` +
      `        <ul>\n` +
      guideItems +
      `        </ul>\n` +
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
    `${guidesHtml}\n` +
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
// Money page (P0) body content injection
// ---------------------------------------------------------------------------

const MONEY_PAGE_CONTENT = {
  '/for-sellers/': {
    sections: [
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
    ],
    cta: {
      title: 'Need Help Finding Your Perfect Home?',
      text: 'Contact SAA Homes at (970) 999-1407 for personalized home search assistance. Let our local experts help you find the right property in the right Northern Colorado neighborhood.',
    },
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
  const chfaPage = matchChfaPage(route.path);
  const moneyPage = matchMoneyPage(route.path);
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
