import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, sep } from 'path';
import { existsSync, readFileSync } from 'fs';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import agentRoutes from './routes/agent.js';
import accountRoutes from './routes/account.js';
import platformRoutes from './routes/platform.js';
import mlsConnectRoutes from './routes/mlsConnect.js';
import clientLifeRoutes from './routes/clientLife.js';
import ownCrmPublicRoutes from './routes/ownCrm.js';
import {
  publicRoutes as plugAndPlayPublicRoutes,
  adminRoutes as plugAndPlayAdminRoutes,
  embedPages,
  rawWebhooks,
} from './routes/plugAndPlay.js';
import { runMigrations } from './config/migrate.js';
import { startIresSyncScheduler } from './jobs/iresScheduler.js';
import { startMlsScheduler } from './jobs/mlsScheduler.js';
import { checkCredentialsKey } from './services/mls/secrets.js';
import { NOCO_CITIES } from './config/nocoCities.js';
import { tenantMiddleware, resolveTenantForHost, DEFAULT_TENANT_ID, pausedForBilling } from './services/tenantContext.js';
import { corsOptionsFor, OPEN_CORS_PATHS } from './services/corsPolicy.js';
import { startBillingScheduler } from './services/billing.js';
import { brandFor, isHomeTenant } from './services/brand.js';
import {
  platformSite, platformShellBrand, platformIdentityScript,
} from './services/platformSite.js';
import { platformIdentity } from './services/platform.js';
import { feedsFor } from './services/feeds.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Site base URL for canonical/OG links (listing fallback uses it).
const SITE_URL = process.env.SITE_URL || 'https://saahomes.com';

// Minimal HTML escaping for dynamic prerendered content.
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// ---- Another brokerage's site: its own page shell, manifest and icon ----
// SAA's prerendered pages (title, meta, JSON-LD and body text) are SAA's. On a
// brokerage's host the app gets the bare SPA shell with that brokerage's head.

/** The brokerage whose host this is, or null on SAA's own and unknown hosts. */
async function brokerageForHost(req) {
  try {
    const tenant = await resolveTenantForHost(req.hostname);
    return isHomeTenant(tenant) ? null : tenant;
  } catch {
    return null;
  }
}

/** Up to two initials from a brand name ("Peak Realty" → "PR"). */
export function brandInitials(name) {
  const words = String(name || '').split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return letters || 'H';
}

/** Black or white, whichever reads on the given background color. */
function textColorOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

/** A plain square icon: the brand's initials on its primary color. */
export function renderBrandIconSvg(brand) {
  const bg = /^#[0-9a-f]{6}$/i.test(brand?.primary_color || '') ? brand.primary_color : '#111111';
  const initials = escapeHtml(brandInitials(brand?.name));
  const size = initials.length > 1 ? 220 : 280;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' +
    `<rect width="512" height="512" rx="96" fill="${bg}"/>` +
    `<text x="256" y="256" dy="0.35em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size}" fill="${textColorOn(bg)}">${initials}</text>` +
    '</svg>';
}

/** The brokerage's own icon when it set one (never SAA's /icons/), else null. */
function brandIconUrl(brand) {
  const url = String(brand?.icon_url || '').trim();
  if (!url || url.startsWith('/icons/')) return null;
  return /^https:\/\//i.test(url) || url.startsWith('/') ? url : null;
}

/** The installable-app manifest for a brokerage's site. */
export function buildBrokerageManifest(brand) {
  const name = String(brand?.name || 'Home Search');
  const shortName = name.length <= 12 ? name : name.split(/\s+/)[0].slice(0, 12);
  const color = /^#[0-9a-f]{6}$/i.test(brand?.primary_color || '') ? brand.primary_color : '#111111';
  const own = brandIconUrl(brand);
  const icons = [
    ...(own ? [
      { src: own, sizes: '192x192', purpose: 'any' },
      { src: own, sizes: '512x512', purpose: 'any' },
    ] : []),
    { src: '/brand-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ];
  const shortcutIcon = [{ src: own || '/brand-icon.svg', sizes: own ? '192x192' : 'any' }];
  return {
    name,
    short_name: shortName,
    description: brand?.tagline
      || (brand?.market_name
        ? `Search ${brand.market_name} homes for sale and get instant alerts for new matches and price drops.`
        : 'Search homes for sale and get instant alerts for new matches and price drops.'),
    id: '/',
    start_url: '/properties/?src=app',
    scope: '/',
    display: 'standalone',
    background_color: color,
    theme_color: color,
    icons,
    shortcuts: [
      { name: 'Search homes', url: '/properties/?src=app', icons: shortcutIcon },
      { name: 'My saved searches', url: '/my-saved-searches/?src=app', icons: shortcutIcon },
      { name: 'Notifications', url: '/notifications/?src=app', icons: shortcutIcon },
    ],
  };
}

/** Head tags of the built shell that carry no brand: charset, viewport, app assets, fonts. */
function isNeutralHeadTag(tag) {
  if (/^<meta\s+charset=/i.test(tag)) return true;
  if (/^<meta\s+name="(viewport|mobile-web-app-capable|apple-mobile-web-app-capable|apple-mobile-web-app-status-bar-style)"/i.test(tag)) return true;
  if (/\s(?:src|href)="\/assets\//i.test(tag)) return true;
  if (/^<link\b/i.test(tag) && /\shref="https:\/\/fonts\.(googleapis|gstatic)\.com[/"]/i.test(tag)) return true;
  return false;
}

/**
 * The SPA shell (dist/index.html) with a brokerage's head: its title,
 * description, theme color and icon, noindex, and nothing of SAA's
 * (canonical, OG/Twitter tags, JSON-LD, analytics, prerendered body text).
 * The head is rebuilt from an allowlist, so tags added to SAA's head later
 * never leak onto another brokerage's site.
 */
// Pages a brokerage's own domain serves (mirrors src/components/brokerage/BrokerageRouteGuard.jsx);
// every other path gets the shell with a 404 so SAA-only pages are never indexed there.
const BROKERAGE_PATHS = [
  /^\/$/, /^\/contact$/, /^\/properties$/, /^\/homes-for-sale\/[^/]+$/, /^\/alerts\/manage$/,
  /^\/my-saved-searches$/, /^\/my-home$/, /^\/notifications$/, /^\/board$/, /^\/mortgage-calculator$/,
  /^\/admin$/, /^\/agent$/, /^\/reset-password$/,
  /^\/embed\/(search|listings|listing)$/, /^\/embed\/listing\/[^/]+$/,
];

/**
 * opts.platformHost (the request's hostname) marks a platform page (/start,
 * a console on the platform's own site): the platform's identity rides along
 * for the app to read. opts.robots replaces the default noindex.
 */
export function renderBrokerageShell(indexHtml, brand, path = '/', opts = {}) {
  const html = String(indexHtml || '');
  const name = String(brand?.name || 'Home Search');
  const title = /^\/properties(\/|$)/.test(path) ? `${name} — Homes for Sale` : name;
  const description = brand?.tagline
    || (brand?.market_name ? `Search ${brand.market_name} homes for sale with ${name}.` : `Search homes for sale with ${name}.`);
  const theme = /^#[0-9a-f]{6}$/i.test(brand?.primary_color || '') ? brand.primary_color : '#111111';
  const icon = brandIconUrl(brand);

  const headStart = html.search(/<head\b[^>]*>/i);
  const headEnd = html.search(/<\/head>/i);
  const rawHead = headStart >= 0 && headEnd > headStart ? html.slice(headStart, headEnd) : '';
  const head = rawHead
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<title\b[\s\S]*?<\/title>/gi, '');
  const kept = [];
  const tagRe = /<script\b[^>]*>[\s\S]*?<\/script>|<(?:meta|link)\b[^>]*>/gi;
  for (const m of head.matchAll(tagRe)) {
    const tag = m[0];
    const open = tag.match(/^<[^>]*>/)[0];
    if (/^<script/i.test(tag)) {
      // Only the app's own bundle; inline scripts (analytics) and JSON-LD go.
      if (/\ssrc="\/assets\//i.test(open)) kept.push(tag);
    } else if (isNeutralHeadTag(tag)) {
      kept.push(tag);
    }
  }

  const bodyOpen = (html.match(/<body\b[^>]*>/i) || ['<body>'])[0];
  const bodyStart = html.search(/<body\b[^>]*>/i);
  const bodyScripts = bodyStart >= 0
    ? [...html.slice(bodyStart).matchAll(/<script\b[^>]*\ssrc="\/assets\/[^"]*"[^>]*>\s*<\/script>/gi)].map((m) => m[0])
    : [];
  const htmlOpen = (html.match(/<html\b[^>]*>/i) || ['<html lang="en">'])[0];

  return [
    '<!DOCTYPE html>',
    htmlOpen,
    '<head>',
    ...kept.map((t) => `    ${t}`),
    `    <title>${escapeHtml(title)}</title>`,
    `    <meta name="description" content="${escapeHtml(description)}" />`,
    `    <meta name="robots" content="${escapeHtml(opts.robots || 'noindex')}" />`,
    `    <meta name="theme-color" content="${theme}" />`,
    `    <meta name="apple-mobile-web-app-title" content="${escapeHtml(name)}" />`,
    '    <link rel="manifest" href="/manifest.webmanifest" />',
    `    <link rel="icon" href="${escapeHtml(icon || '/brand-icon.svg')}" />`,
    `    <link rel="apple-touch-icon" href="${escapeHtml(icon || '/brand-icon.svg')}" />`,
    // The app may call gtag(); keep it defined, but nothing is sent anywhere.
    '    <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}</script>',
    ...(opts.platformHost !== undefined ? [`    ${platformIdentityScript(opts.platformHost)}`] : []),
    '</head>',
    `  ${bodyOpen}`,
    '    <div id="root"></div>',
    ...bodyScripts.map((t) => `    ${t}`),
    '  </body>',
    '</html>',
  ].join('\n');
}

const app = express();
app.set('trust proxy', 1);
// Serve HTML, CSS, JS, JSON and SVG gzip-compressed when the client asks for
// it (perf-text-compression). `compression` skips already-compressed types
// (images, fonts) and streams, so the static pages and hashed assets get the
// smaller body without changing a byte of what the route sends.
app.use(compression());
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const distPath = join(__dirname, '../../dist');

// Security headers. No Content-Security-Policy: the pages carry inline
// scripts, Google Fonts, Maps, YouTube, Stripe and analytics, and a policy
// would break them. Photos and widgets are loaded from other sites, so
// resources stay cross-origin. HSTS without includeSubDomains: brokerages
// point their own domains here, and their other subdomains (mail, older
// hosts) are not ours to force onto https. The referrer policy is the
// browsers' own default, so outbound links behave as before.
const helmetOptions = {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
};
const securityHeaders = helmet(helmetOptions);
// The widgets are iframed into other sites: no X-Frame-Options there.
const widgetSecurityHeaders = helmet({ ...helmetOptions, frameguard: false });
app.use((req, res, next) => (OPEN_CORS_PATHS.test(req.path) ? widgetSecurityHeaders : securityHeaders)(req, res, next));

// Browsers on our own hosts (the site, every brokerage's domains, the
// platform's) may call the API with cookies; the widgets answer any origin
// without them; everything else gets no allow header. See corsPolicy.js.
app.use((req, res, next) => {
  corsOptionsFor(req)
    .then((options) => {
      // Caches keep answers for different origins apart, allowed or not.
      if (options.origin !== '*' && req.get('origin')) res.vary('Origin');
      cors(options)(req, res, next);
    })
    .catch((error) => {
      console.error('CORS policy error:', error.message);
      cors({ origin: false })(req, res, next);
    });
});
// Stripe and Follow Up Boss sign the exact bytes they send: these routes get
// the raw body, so they come before the JSON parser.
app.use(rawWebhooks);
// Inbound email, lead sources and plan unsubscribes: raw bodies, found by each brokerage's key.
app.use(ownCrmPublicRoutes);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', tenantMiddleware);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'saahomes-api',
  });
});

// The board's page watch records the route paths a shipped job names, but the
// extractor drops the `/api` mount prefix the app serves under, so it checks
// /notify-health and /mail-test at the site root while the handlers live at
// /api/notify-health and /api/mail-test (inc-8d926c93; same extractor bug as
// inc-b3ab4e41). Alias the watched root paths to their canonical endpoints so
// the watch reads the real reading instead of a 404. The `/api` paths are
// unchanged; this only adds redirects.
app.get('/notify-health', (req, res) => res.redirect(302, '/api/notify-health'));
app.get('/mail-test', (req, res) => res.redirect(302, '/api/mail-test'));

app.use('/api', plugAndPlayPublicRoutes);
app.use('/api/admin', plugAndPlayAdminRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/admin', mlsConnectRoutes.owner);
app.use('/api/platform', mlsConnectRoutes.platform);
app.use('/api', clientLifeRoutes.client);
app.use('/api/agent', clientLifeRoutes.staff);

const canonicalRedirects = {
  '/g-hope-greeley': '/greeley-g-hope-down-payment-assistance/',
  '/g-hope-home-loan': '/greeley-g-hope-down-payment-assistance/',
  '/g-hope': '/greeley-g-hope-down-payment-assistance/',
  '/colorado-hope': '/greeley-g-hope-down-payment-assistance/',
  '/colorado-g-hope': '/greeley-g-hope-down-payment-assistance/',
  '/greeley-g-hope': '/greeley-g-hope-down-payment-assistance/',
  '/chfa-dpa': '/chfa-down-payment-assistance/',
  '/colorado-chfa-down-payment-assistance': '/chfa-down-payment-assistance/',
  '/chfa-programs': '/chfa-down-payment-assistance/',
  '/champions-home-loan': '/colorado-champions-home-loan-program/',
  '/chfa': '/chfa-schools-to-home/',
  '/buyers': '/for-buyers/',
  '/first-time-home-buyer': '/for-buyers/',
  '/first-time-buyer': '/for-buyers/',
  '/sellers': '/for-sellers/',
  '/featured-areas': '/northern-colorado-areas/',
  '/helpful-guides': '/blog/',
  '/home-valuation': '/for-sellers/',
  '/whats-my-home-worth': '/for-sellers/',
  // Legacy buy/sell/listing aliases (pre-routing-era paths). These fell
  // through to the SPA shell with a homepage canonical (soft-404), wasting
  // crawl budget. 301 → the canonical money pages (flagged by indexation
  // patrol + daily ranking strike 2026-09-13/14/15).
  '/homes-for-sale': '/properties/',
  '/listings': '/properties/',
  '/for-sale': '/properties/',
  '/sell': '/for-sellers/',
  '/sell-home': '/for-sellers/',
  '/buy': '/for-buyers/',
  '/buy-a-home': '/for-buyers/',
  // Blog consolidation 2026-09-10: duplicate Windsor realtor post merged into
  // the canonical /blog/windsor-co-real-estate-agent/ (cannibalization fix).
  '/blog/windsor-colorado-real-estate-agent': '/blog/windsor-co-real-estate-agent/',
  // Legacy city URLs (pre-June-2026 routing era). These used to serve the
  // area pages at /{city}/ — now they fall through to the SPA shell with a
  // homepage canonical, wasting crawl budget and splitting city-page signals.
  // 301 → canonical /northern-colorado-areas/{slug}/ (all 27 entities).
  '/fort-collins': '/northern-colorado-areas/fort-collins/',
  '/loveland': '/northern-colorado-areas/loveland/',
  '/windsor': '/northern-colorado-areas/windsor/',
  '/greeley': '/northern-colorado-areas/greeley/',
  '/timnath': '/northern-colorado-areas/timnath/',
  '/wellington': '/northern-colorado-areas/wellington/',
  '/johnstown': '/northern-colorado-areas/johnstown/',
  '/eaton': '/northern-colorado-areas/eaton/',
  '/milliken': '/northern-colorado-areas/milliken/',
  '/la-salle': '/northern-colorado-areas/la-salle/',
  '/mead': '/northern-colorado-areas/mead/',
  '/longmont': '/northern-colorado-areas/longmont/',
  '/boulder': '/northern-colorado-areas/boulder/',
  '/berthoud': '/northern-colorado-areas/berthoud/',
  '/firestone': '/northern-colorado-areas/firestone/',
  '/frederick': '/northern-colorado-areas/frederick/',
  '/evans': '/northern-colorado-areas/evans/',
  '/severance': '/northern-colorado-areas/severance/',
  '/niwot': '/northern-colorado-areas/niwot/',
  '/erie': '/northern-colorado-areas/erie/',
  '/brighton': '/northern-colorado-areas/brighton/',
  '/carbon-valley': '/northern-colorado-areas/carbon-valley/',
  '/fort-lupton': '/northern-colorado-areas/fort-lupton/',
  '/estes-park': '/northern-colorado-areas/estes-park/',
  '/red-feather-lakes': '/northern-colorado-areas/red-feather-lakes/',
  '/lyons': '/northern-colorado-areas/lyons/',
  '/bellvue': '/northern-colorado-areas/bellvue/',
  // Legacy neighborhood slug variant (pre-slug-cleanup). rain-dance-windsor
  // fell through to the SPA shell with a homepage canonical (soft-404).
  // 301 → the canonical RainDance neighborhood page.
  '/northern-colorado-areas/windsor/rain-dance-windsor': '/northern-colorado-areas/windsor/raindance/',
  // Windsor seller path (fix-61141-39). /windsor/sell fell through to the SPA
  // shell with a homepage canonical (soft-404) and ate the Windsor work.
  // 301 → the canonical Windsor area page, which carries the seller CTA and
  // the market-report ask.
  '/windsor/sell': '/northern-colorado-areas/windsor/',
  '/northern-colorado-areas/windsor/sell': '/northern-colorado-areas/windsor/',
};

// The platform's own marketing domain: its product page, its app pages and
// files, and a 404 for everything else. Every other host passes through.
app.use(platformSite({ distPath, renderShell: renderBrokerageShell, renderIcon: renderBrandIconSvg }));
// The platform's icon, for its pages on any host (/start, consoles).
app.get('/platform-icon.svg', (req, res) => {
  const id = platformIdentity();
  res.setHeader('Cache-Control', 'no-cache');
  return res.type('image/svg+xml').send(renderBrandIconSvg({ name: id.short_name, primary_color: id.primary_color }));
});

// Widgets brokerages paste into their own websites (any host, any env).
app.use(embedPages);

// On a brokerage's host: no SAA sitemaps, robots disallow all (its own SEO
// comes later), and its own manifest and icon. SAA's hosts fall through.
const BROKERAGE_SITE_FILES = new Set([
  '/robots.txt', '/sitemap.xml', '/sitemap-index.xml', '/sitemap-listings.xml',
  '/manifest.webmanifest', '/brand-icon.svg', '/favicon.svg', '/favicon.ico',
]);
app.use(async (req, res, next) => {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !BROKERAGE_SITE_FILES.has(req.path)) return next();
  const tenant = await brokerageForHost(req);
  if (!tenant) return next();
  const brand = brandFor(tenant);
  res.setHeader('Cache-Control', 'no-cache');
  switch (req.path) {
    case '/robots.txt':
      return res.type('text/plain').send('User-agent: *\nDisallow: /\n');
    case '/manifest.webmanifest':
      return res.type('application/manifest+json').send(JSON.stringify(buildBrokerageManifest(brand), null, 2));
    case '/brand-icon.svg':
    case '/favicon.svg':
    case '/favicon.ico':
      return res.type('image/svg+xml').send(renderBrandIconSvg(brand));
    default:
      return res.status(404).type('text/plain').send('Not found');
  }
});

// ---- Listing sitemap (Active-only, generated from DB, cached 15 min) ----
let listingsSitemapCache = { xml: null, at: 0 };
const LISTINGS_SITEMAP_TTL = 15 * 60 * 1000;

app.get('/sitemap-listings.xml', async (req, res) => {
  try {
    if (!listingsSitemapCache.xml || Date.now() - listingsSitemapCache.at > LISTINGS_SITEMAP_TTL) {
      const { default: getPool } = await import('./config/database.js');
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT slug, updated_at FROM listings
          WHERE is_active = TRUE AND slug IS NOT NULL
            AND city = ANY($1::text[]) AND feed = ANY($2::text[])
          ORDER BY slug`,
        [NOCO_CITIES, await feedsFor(DEFAULT_TENANT_ID, { pool })]
      );
      const urls = rows.map((r) => {
        const lastmod = r.updated_at
          ? new Date(r.updated_at).toISOString().slice(0, 10) : undefined;
        return `  <url><loc>${SITE_URL}/homes-for-sale/${r.slug}/</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
      }).join('\n');
      listingsSitemapCache = {
        xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
        at: Date.now(),
      };
    }
    res.type('application/xml').send(listingsSitemapCache.xml);
  } catch (error) {
    console.error('sitemap-listings error:', error.message);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

// Sitemap index: static build sitemap + dynamic listings sitemap
app.get('/sitemap-index.xml', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE_URL}/sitemap.xml</loc></sitemap>
  <sitemap><loc>${SITE_URL}/sitemap-listings.xml</loc></sitemap>
</sitemapindex>`;
  res.type('application/xml').send(xml);
});

if (process.env.NODE_ENV === 'production' && existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const key = req.path.replace(/\/$/, '') || '/';
    const target = canonicalRedirects[key];
    if (target) {
      return res.redirect(301, target);
    }
    return next();
  });

  // A brokerage's pages: the SPA shell with its own head, never SAA's
  // prerendered pages. Built assets (/assets, /icons, images) serve as usual.
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    const ext = req.path.match(/\.([a-z0-9]+)$/i);
    if (ext && ext[1].toLowerCase() !== 'html') return next();
    const tenant = await brokerageForHost(req);
    if (!tenant) return next();
    const brand = brandFor(tenant);
    res.setHeader('Cache-Control', 'no-cache');
    // Paused for an unpaid bill: the owner can still sign in and pay.
    const billingOpen = pausedForBilling(tenant) && /^\/(admin|reset-password)\/?$/.test(req.path);
    if (tenant.status !== 'active' && !billingOpen) {
      return res.status(503).type('html').send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${escapeHtml(brand.name)}</title></head>` +
        '<body><p>This site is paused. Please contact the brokerage.</p></body></html>'
      );
    }
    try {
      const base = readFileSync(join(distPath, 'index.html'), 'utf8');
      const known = BROKERAGE_PATHS.some((re) => re.test(req.path.length > 1 ? req.path.replace(/\/$/, '') : req.path));
      return res.status(known ? 200 : 404).type('html').send(renderBrokerageShell(base, brand, req.path));
    } catch (error) {
      console.error('brokerage shell error:', error.message);
      return res.status(500).type('text/plain').send('Something went wrong.');
    }
  });

  // The platform's signup page (/start) on its own host: a clean shell with
  // the product's name, not one of SAA's prerendered pages. A brokerage's
  // host never gets here (its allowlist above answers 404). So is a
  // brokerage's console opened here with ?brokerage= (it has no address yet):
  // the platform's shell, not SAA's.
  app.get(['/start', '/start/', '/admin', '/admin/', '/agent', '/agent/', '/reset-password', '/reset-password/'], (req, res, next) => {
    const start = /^\/start\/?$/.test(req.path);
    if (!start && !/^[a-z0-9-]{1,64}$/.test(String(req.query.brokerage || ''))) return next();
    try {
      const base = readFileSync(join(distPath, 'index.html'), 'utf8');
      res.setHeader('Cache-Control', 'no-cache');
      return res.type('html').send(renderBrokerageShell(base, platformShellBrand(), req.path, { platformHost: req.hostname }));
    } catch (error) {
      console.error('platform page error:', error.message);
      return res.status(500).type('text/plain').send('Something went wrong.');
    }
  });

  // Vite names the files in dist/assets by their content hash, so browsers
  // can keep them for good; a deploy changes the name, not the file. Pages
  // always revalidate, and everything else (images, icons) for an hour.
  const hashedAssetsPath = join(distPath, 'assets') + sep;
  app.use(express.static(distPath, {
    index: false,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.startsWith(hashedAssetsPath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      // The service worker and manifest must update with each deploy.
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
      if (filePath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // Serve the branded 404 shell with an HTTP 404 status. Falls back to a
  // minimal inline shell if the prerendered /404/index.html isn't on disk
  // (e.g. an older build). Also injects `noindex, follow` even into the
  // fallback so Google doesn't index a "not found" page.
  const send404 = (res) => {
    const notFoundPath = join(distPath, '404', 'index.html');
    if (existsSync(notFoundPath)) {
      return res.status(404).sendFile(notFoundPath);
    }
    return res
      .status(404)
      .type('html')
      .send(
        '<!doctype html><html lang="en"><head>' +
          '<meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<meta name="robots" content="noindex, follow">' +
          '<title>Page Not Found (404) | SAA Homes</title>' +
          '<link rel="canonical" href="https://saahomes.com/404/">' +
          '</head><body>' +
          '<h1>Page Not Found</h1>' +
          '<p>The page you\'re looking for isn\'t here. ' +
          '<a href="https://saahomes.com/">Return to the SAA Homes homepage</a> ' +
          'or <a href="https://saahomes.com/properties/">search Northern Colorado homes for sale</a>.</p>' +
          '</body></html>'
      );
  };

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api')) return next();

    const normalized = req.path.replace(/\/$/, '') || '/';
    const prerenderedPath = normalized === '/'
      ? join(distPath, 'index.html')
      : join(distPath, normalized.slice(1), 'index.html');

    if (existsSync(prerenderedPath)) {
      return res.sendFile(prerenderedPath);
    }

    // Legacy listing URLs (/listing/{source}/{listing_id}/{city}/{slug}/) from
    // the pre-Aug-2026 routing era. They used to serve the SPA shell with a
    // homepage canonical (soft-404). 301 → the canonical /homes-for-sale/{slug}/
    // URL when the listing still exists, else 404 (drop from index).
    const legacyListingMatch = normalized.match(
      /^\/listing\/[^/]+\/([^/]+)(?:\/.*)?$/
    );
    if (legacyListingMatch) {
      try {
        const { default: getPool } = await import('./config/database.js');
        const pool = getPool();
        const listingId = legacyListingMatch[1];
        const { rows } = await pool.query(
          `SELECT slug FROM listings WHERE listing_id = $1 AND feed = ANY($2::text[]) LIMIT 1`,
          [listingId, await feedsFor(DEFAULT_TENANT_ID, { pool })]
        );
        const legacyListings = rows[0];
        if (legacyListings && legacyListings.slug) {
          return res.redirect(301, `${SITE_URL}/homes-for-sale/${legacyListings.slug}/`);
        }
        // Listing no longer in feed — send 404 so Google drops the soft-404 URL
        return send404(res);
      } catch (error) {
        console.error('legacy listing redirect error:', error.message);
        return send404(res);
      }
    }

    // Dynamic listing pages (/homes-for-sale/:slug/) have no prerendered file.
    // Serve a listing-aware shell with real title/canonical/OG from the DB,
    // plus a `noindex, follow` robots directive — these thin IDX/MLS pages
    // were drowning the site's crawl budget (21K+ listing URLs vs 131
    // editorial pages), so we let Google discover their outbound links but
    // stop indexing them.
    const listingMatch = normalized.match(/^\/homes-for-sale\/([^/]+)$/);
    if (listingMatch) {
      try {
        const { default: getPool } = await import('./config/database.js');
        const pool = getPool();
        const slug = listingMatch[1];
        const { rows } = await pool.query(
          `SELECT listing_id, slug, street_number, street_name, unit, city,
                  list_price, beds, baths, living_area, status,
                  latitude, longitude, property_type, description,
                  updated_at
             FROM listings WHERE (slug = $1 OR listing_id = $1) AND feed = ANY($2::text[]) LIMIT 1`,
          [slug, await feedsFor(DEFAULT_TENANT_ID, { pool })]
        );
        const listing = rows[0];
        if (listing) {
          const base = readFileSync(join(distPath, 'index.html'), 'utf8');
          const address = [listing.street_number, listing.street_name, listing.unit]
            .filter(Boolean).join(' ');
          const price = listing.list_price
            ? `$${Number(listing.list_price).toLocaleString('en-US')}` : '';
          const title = `${address}, ${listing.city} CO — ${price} | SAA Homes`;
          const description = `${address}, ${listing.city}, CO — ${price || ''} · ${listing.beds ?? '—'} bd / ${listing.baths ?? '—'} ba / ${listing.living_area ? Number(listing.living_area).toLocaleString() + ' sqft' : ''}. Live IRES MLS listing. Adam & Mandi Schwartz — (970) 999-1407.`;
          const canonical = `${SITE_URL}/homes-for-sale/${listing.slug}/`;
          // Real availability from MLS status (matches frontend ListingDetailPage)
          const availabilityByStatus = {
            Active: 'https://schema.org/InStock',
            'Active Under Contract': 'https://schema.org/LimitedAvailability',
            Pending: 'https://schema.org/OutOfStock',
            Sold: 'https://schema.org/Discontinued',
            Withdrawn: 'https://schema.org/OutOfStock',
            Expired: 'https://schema.org/OutOfStock',
          };
          const availability = availabilityByStatus[listing.status] || 'https://schema.org/InStock';
          const listingSchema = {
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            name: title,
            url: canonical,
            description: description,
            ...(listing.updated_at ? { dateModified: listing.updated_at } : {}),
            image: `https://saahomes.com/api/photo/${listing.listing_id}/0`,
            address: {
              '@type': 'PostalAddress',
              streetAddress: address || undefined,
              addressLocality: listing.city || undefined,
              addressRegion: 'CO',
            },
            ...(listing.latitude && listing.longitude
              ? { geo: { '@type': 'GeoCoordinates', latitude: Number(listing.latitude), longitude: Number(listing.longitude) } }
              : {}),
            ...(listing.beds != null ? { numberOfRooms: Number(listing.beds) } : {}),
            ...(listing.baths != null ? { numberOfBathroomsTotal: Number(listing.baths) } : {}),
            offers: {
              '@type': 'Offer',
              price: listing.list_price != null ? Number(listing.list_price) : undefined,
              priceCurrency: 'USD',
              availability,
            },
          };
          const schemaHtml = `<script type="application/ld+json">${JSON.stringify(listingSchema)}</script>`;
          let html = base
            .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
            .replace(/<meta name="robots" content="[^"]*"\s*\/?>/, '<meta name="robots" content="noindex, follow" />')
            .replace(/rel="canonical" href="[^"]*"/, `rel="canonical" href="${canonical}"`)
            .replace(/name="description" content="[^"]*"/, `name="description" content="${escapeHtml(description)}"`)
            .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${escapeHtml(title)}"`)
            .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${escapeHtml(description)}"`)
            .replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${canonical}"`)
            .replace('<div id="root"></div>', `<div id="root"><div class="prerendered-listing"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></div>`)
            .replace('</head>', `${schemaHtml}</head>`);
          return res.send(html);
        }
        // Slug not in DB — this is a genuine 404. Was previously served
        // as a 200 with a generic shell, which meant Google saw millions
        // of dead listing URLs as real pages and burned crawl budget on
        // them. Now returns proper 404 so those URLs age out of the index.
        return send404(res);
      } catch (error) {
        console.error('listing fallback error:', error.message);
        return send404(res);
      }
    }

    // No route, no prerendered file, not a listing — HTTP 404. Previously
    // this fell through to serving dist/index.html with 200, which told
    // Google every URL on the domain was a real page (root cause of the
    // ~22K bogus URLs indexed for saahomes.com).
    return send404(res);
  });
}

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

let httpServer = null;

const startServer = async () => {
  httpServer = app.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (existsSync(distPath)) {
      console.log('Serving frontend from dist/');
    }
  });

  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set — API forms will not persist submissions');
    return;
  }

  try {
    await runMigrations();
  } catch (error) {
    // MIGRATIONS_STRICT=1: a failed step stops the boot instead of serving a
    // half-migrated schema. Off by default (see migrate.js).
    if (process.env.MIGRATIONS_STRICT === '1') {
      console.error('Migration error on startup, exiting (MIGRATIONS_STRICT=1):', error.message);
      process.exit(1);
    }
    console.error('Migration error on startup (API will still run):', error.message);
  }

  // MLS sync scheduler: incremental sync is now seconds-fast (watermark-based,
  // typically tens-to-hundreds of changed records), so the old reason for
  // disabling this — deploys killing 45-min full syncs — no longer applies.
  // Default ON so the listing/photo updates run on THIS service (the site),
  // not on an external cron box. Advisory lock 833711 prevents concurrent
  // cluster-wide runs. Opt out with IRES_SYNC_SCHEDULER=off.
  if (process.env.IRES_SYNC_SCHEDULER !== 'off') startIresSyncScheduler();
  // Every other connected MLS (mls/engine.js), each on its own cadence and
  // advisory lock. Opt out with MLS_SYNC_SCHEDULER=off.
  checkCredentialsKey();
  if (process.env.MLS_SYNC_SCHEDULER !== 'off') startMlsScheduler();
  // Task reminders, text alerts for saved searches and tour reminders.
  import('./services/crmService.js').then(({ startCrmScheduler }) => startCrmScheduler()).catch((e) => console.error('CRM scheduler failed to start:', e.message));
  // Action plans: emails, texts and tasks on their day (every minute).
  import('./services/actionPlans.js').then(({ startActionPlanScheduler }) => startActionPlanScheduler()).catch((e) => console.error('Action plan scheduler failed to start:', e.message));
  // Trials, grace periods and pausing unpaid brokerages (hourly).
  if (process.env.BILLING_SCHEDULER !== 'off') startBillingScheduler();
  // Stripe from STRIPE_SECRET_KEY alone: plan prices and the webhook, in the background.
  import('./services/stripeSetup.js').then(({ syncStripeOnBoot }) => syncStripeOnBoot()).catch((e) => console.error('Stripe setup skipped:', e.message));
};

// A rejected promise nobody awaited used to crash the process (Node's
// default), taking every request in flight with it. Log it and keep serving;
// a genuine programming error still shows up loud in the logs.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason instanceof Error ? reason.stack : reason);
});

// Railway sends SIGTERM on every deploy. Stop taking new connections, let
// in-flight requests finish, then exit; a hard exit after 10s if something hangs.
function shutdown(signal) {
  console.log(`${signal} received: shutting down`);
  const exit = (code) => process.exit(code);
  if (!httpServer) return exit(0);
  const timer = setTimeout(() => {
    console.error('Shutdown timed out, exiting');
    exit(1);
  }, 10_000);
  timer.unref();
  httpServer.close(() => exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Tests import the app without binding a port or starting the MLS scheduler.
if (process.env.SAA_SERVER_NO_START !== '1') startServer();

export default app;
