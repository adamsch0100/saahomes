import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import agentRoutes from './routes/agent.js';
import { runMigrations } from './config/migrate.js';
import { startIresSyncScheduler } from './jobs/iresScheduler.js';

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

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const distPath = join(__dirname, '../../dist');

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://saahomes.com',
      'https://www.saahomes.com',
      process.env.FRONTEND_URL,
      process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null,
    ].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'saahomes-api',
  });
});

app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);

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
};

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
          ORDER BY slug`
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

  app.use(express.static(distPath, { index: false }));

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api')) return next();

    const normalized = req.path.replace(/\/$/, '') || '/';
    const prerenderedPath = normalized === '/'
      ? join(distPath, 'index.html')
      : join(distPath, normalized.slice(1), 'index.html');

    if (existsSync(prerenderedPath)) {
      return res.sendFile(prerenderedPath);
    }

    // Dynamic listing pages (/homes-for-sale/:slug/) have no prerendered
    // file. Fallback = dist/index.html (homepage copy) — which caused:
    //  (a) a visible FLASH of homepage text before React hydrates, and
    //  (b) an SEO bug: every listing page served the HOMEPAGE title +
    //      canonical to crawlers (29K pages all claiming to be /).
    // Serve a listing-aware shell instead: real title/canonical/OG from
    // the DB, minimal crawlable body. Falls back to a neutral generic
    // shell if the slug isn't found.
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
             FROM listings WHERE slug = $1 OR listing_id = $1 LIMIT 1`,
          [slug]
        );
        const listing = rows[0];
        const base = readFileSync(join(distPath, 'index.html'), 'utf8');
        if (listing) {
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
            .replace(/rel="canonical" href="[^"]*"/, `rel="canonical" href="${canonical}"`)
            .replace(/name="description" content="[^"]*"/, `name="description" content="${escapeHtml(description)}"`)
            .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${escapeHtml(title)}"`)
            .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${escapeHtml(description)}"`)
            .replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${canonical}"`)
            .replace('<div id="root"></div>', `<div id="root"><div class="prerendered-listing"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></div>`)
            .replace('</head>', `${schemaHtml}</head>`);
          return res.send(html);
        }
        // Slug not in DB — neutral generic shell (no homepage copy)
        let html = base
          .replace(/<title>[^<]*<\/title>/, '<title>Homes for Sale in Northern Colorado | SAA Homes</title>')
          .replace(/rel="canonical" href="[^"]*"/, `rel="canonical" href="${SITE_URL}${normalized}/"`)
          .replace('<div id="root"></div>', '<div id="root"></div>');
        return res.send(html);
      } catch (error) {
        console.error('listing fallback error:', error.message);
        // fall through to generic shell
      }
    }

    return res.sendFile(join(distPath, 'index.html'));
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

const startServer = async () => {
  app.listen(PORT, HOST, () => {
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
    console.error('Migration error on startup (API will still run):', error.message);
  }

  // MLS sync scheduler: incremental sync is now seconds-fast (watermark-based,
  // typically tens-to-hundreds of changed records), so the old reason for
  // disabling this — deploys killing 45-min full syncs — no longer applies.
  // Default ON so the listing/photo updates run on THIS service (the site),
  // not on an external cron box. Advisory lock 833711 prevents concurrent
  // cluster-wide runs. Opt out with IRES_SYNC_SCHEDULER=off.
  if (process.env.IRES_SYNC_SCHEDULER !== 'off') startIresSyncScheduler();
};

startServer();

export default app;
