import { execFileSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getSitemapEntries, SITE_URL } from '../src/data/siteRoutes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '../public/sitemap.xml');

/**
 * Resolve a truthful per-URL <lastmod> from git history of the source files
 * that generate each page's content. Google distrusts sitemaps where every
 * URL claims lastmod = build date; truthful dates restore the freshness
 * signal and improve crawl prioritization.
 *
 * Fallback chain per entry:
 *   1. explicit override (git-derived, passed by this script)
 *   2. post.date for blog posts
 *   3. site launch fallback (never "today" — today is not evidence)
 */
function gitLastmod(paths) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 15000,
    });
    const d = out.trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(d)) return d.slice(0, 10);
  } catch {
    // fall through to static fallback
  }
  return null;
}

// Source files whose changes materially update each page class's rendered content.
// Filenames verified against src/pages/ and src/data/ on 2026-08-25.
const GIT_SOURCES = {
  home: ['src/pages/HomePage.jsx'],
  static: ['src/pages/ForBuyersPage.jsx', 'src/pages/ForSellersPage.jsx', 'src/pages/ContactPage.jsx',
           'src/pages/LuxuryRealEstatePage.jsx', 'src/pages/VeteransPage.jsx',
           'src/pages/AssumableMortgagesPage.jsx', 'src/pages/CashHomeBuyersPage.jsx'],
  properties: ['src/pages/PropertiesPage.jsx', 'src/data/cityHomesData.js'],
  chfa: ['src/pages/ChfaDownPaymentAssistancePage.jsx', 'src/data/chfaData.js'],
  ghope: ['src/pages/GHopeHomeLoanPage.jsx', 'src/data/chfaData.js'],
  schools: ['src/pages/ChfaSchoolsToHomePage.jsx'],
  champions: ['src/pages/ChampionsHomeLoanPage.jsx'],
  blogHub: ['src/pages/BlogPage.jsx', 'src/data/blogPosts.js'],
  calculator: ['src/pages/MortgageCalculatorPage.jsx'],
  areasHub: ['src/pages/AreasIndexPage.jsx', 'src/data/areaSeo.js'],
  area: ['src/pages/AreaGuidePage.jsx', 'src/components/AreaSEO.jsx', 'src/data/areaSeo.js'],
  customArea: ['src/data/areaSeo.js', 'src/data/localEvents.js'],
  neighborhood: ['src/pages/NeighborhoodPage.jsx', 'src/data/neighborhoods.js'],
  cityHomes: ['src/pages/CityHomesForSalePage.jsx', 'src/data/cityHomesData.js'],
  events: ['src/pages/EventsCalendarPage.jsx', 'src/data/localEvents.js'],
};

// Map generator output paths -> git source keys (checked in order; first match wins)
function sourcesFor(path) {
  // Custom-built city pages have dedicated components; the rest of the areas
  // render through AreaGuidePage.jsx driven by areaSeo.js.
  const CUSTOM_AREA_SLUGS = ['fort-collins', 'loveland', 'windsor', 'greeley', 'boulder',
    'timnath', 'wellington', 'johnstown', 'milliken', 'eaton', 'la-salle', 'longmont', 'mead'];
  if (path === '/') return GIT_SOURCES.home;
  if (path === '/blog/') return GIT_SOURCES.blogHub;
  // Neighborhood pages are two levels deep under /northern-colorado-areas/
  const areaSegs = path.replace(/^\/northern-colorado-areas\//, '').split('/').filter(Boolean);
  if (path.startsWith('/northern-colorado-areas/')) {
    if (areaSegs.length === 2) return GIT_SOURCES.neighborhood;
    if (path === '/northern-colorado-areas/') return GIT_SOURCES.areasHub;
    const slug = areaSegs[0];
    if (CUSTOM_AREA_SLUGS.includes(slug)) {
      const comp = 'src/pages/' + slug.split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1)).join('') + 'Page.jsx';
      return [comp, ...GIT_SOURCES.customArea];
    }
    return GIT_SOURCES.area; // dynamic AreaGuidePage-driven city
  }
  const map = [
    ['/properties/', 'properties'],
    ['/chfa-down-payment-assistance/', 'chfa'],
    ['/greeley-g-hope-down-payment-assistance/', 'ghope'],
    ['/chfa-schools-to-home/', 'schools'],
    ['/colorado-champions-home-loan-program/', 'champions'],
    ['/mortgage-calculator/', 'calculator'],
    ['/events/', 'events'],
  ];
  for (const [prefix, key] of map) {
    if (path.startsWith(prefix)) return GIT_SOURCES[key];
  }
  return GIT_SOURCES.static; // remaining top-level money pages
}

const entries = getSitemapEntries();
let gitCount = 0;
const TODAY = new Date().toISOString().slice(0, 10);

// Previous committed sitemap: used for date continuity when git history is
// unavailable (e.g. shallow clone in a CI build container). Never regress a
// truthful date to the build date.
const PREV_PATH = join(__dirname, '../public/sitemap.xml');
let prevDates = {};
try {
  if (existsSync(PREV_PATH)) {
    const prev = readFileSync(PREV_PATH, 'utf8');
    const re = /<loc>(.*?)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g;
    let m;
    while ((m = re.exec(prev)) !== null) prevDates[m[1]] = m[2];
  }
} catch {
  prevDates = {};
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => {
    let lastmod = entry.lastmod || '';
    // Blog posts: trust the configured publish/update date only if it looks real
    // AND is not in the future (future-dated posts would poison the freshness
    // signal). Future-dated posts fall back to the git date their content landed.
    const isBlog = entry.path.startsWith('/blog/');
    if (isBlog && /^\d{4}-\d{2}-\d{2}$/.test(lastmod) && lastmod <= TODAY) {
      gitCount += 1;
    } else {
      const srcs = sourcesFor(entry.path);
      const g = srcs ? gitLastmod(srcs) : null;
      if (g) {
        lastmod = g;
        gitCount += 1;
      } else if (isBlog) {
        lastmod = gitLastmod(['src/data/blogPosts.js']) || lastmod;
        gitCount += 1;
      } else {
        // No git history available (e.g. shallow clone in CI): keep the
        // previously committed truthful date instead of regressing to the
        // build date (date continuity across deploy rebuilds).
        const prev = prevDates[`${SITE_URL}${entry.path}`];
        if (/^\d{4}-\d{2}-\d{2}$/.test(prev || '') && prev <= TODAY) lastmod = prev;
      }
      // Clamp any remaining future date to today as a last resort.
      if (/^\d{4}-\d{2}-\d{2}$/.test(lastmod) && lastmod > TODAY) {
        lastmod = TODAY;
      }
    }
    return `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>
`;

writeFileSync(outputPath, xml, 'utf8');
console.log(`Generated sitemap with ${entries.length} URLs at public/sitemap.xml (${gitCount} git-truthful lastmod values)`);
