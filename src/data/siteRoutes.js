import { blogPosts } from './blogPosts.js';
import { areaSeoPages, getAreaExactTitle } from './areaSeo.js';
import { neighborhoods } from './neighborhoods.js';
import { CITY_HOMES, getCityHomesPath } from './cityHomesData.js';

export const SITE_URL = 'https://saahomes.com';

const DEFAULT_OG_IMAGE = '/images/White-Logo-AUTOx110.fit.png';

function absoluteImage(path) {
  if (!path) return `${SITE_URL}${DEFAULT_OG_IMAGE}`;
  if (path.startsWith('http')) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function withShareMeta(page) {
  return {
    ...page,
    ogTitle: page.ogTitle || page.title,
    ogDescription: page.ogDescription || page.description,
    ogImage: absoluteImage(page.ogImage || DEFAULT_OG_IMAGE),
    ogImageAlt: page.ogImageAlt || page.ogTitle || page.title,
  };
}

const staticPages = [
  {
    path: '/',
    priority: '1.0',
    changefreq: 'weekly',
    title: 'Schwartz and Associates | Northern Colorado Real Estate | Fort Collins, Loveland & Greeley',
    description: 'Schwartz and Associates, Coldwell Banker Realty — Northern Colorado real estate agents serving Fort Collins, Loveland, Windsor, Greeley, and 27+ Front Range communities.',
    ogTitle: 'Schwartz and Associates | Northern Colorado Real Estate',
    ogDescription: 'Expert real estate agents in Fort Collins, Loveland, Windsor, Greeley & 27+ Northern Colorado communities.',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'Schwartz and Associates — Northern Colorado real estate',
  },
  {
    path: '/about-us/',
    priority: '0.8',
    changefreq: 'monthly',
    title: 'About SAA Homes | Fort Collins Real Estate Experts | 20+ Years Experience',
    description: 'Meet Adam and Mandi Schwartz of SAA Homes — Fort Collins real estate experts with 20+ years of combined experience serving Northern Colorado.',
    ogTitle: 'About Schwartz and Associates | Northern Colorado Realtors',
    ogDescription: 'Meet Adam and Mandi Schwartz — 20+ years helping buyers and sellers across Northern Colorado.',
    ogImage: '/images/6-1.jpg',
    ogImageAlt: 'Adam and Mandi Schwartz — SAA Homes real estate agents',
  },
  {
    path: '/for-buyers/',
    priority: '0.8',
    changefreq: 'monthly',
    title: 'Colorado Home Buyers | Homes for Sale in Northern Colorado | SAA Homes',
    description: 'Search homes for sale in Fort Collins, Loveland, Windsor, and across Northern Colorado with expert buyer representation from SAA Homes.',
    ogTitle: 'Northern Colorado Home Buyers | Expert Buyer Agents',
    ogDescription: 'Search Fort Collins, Loveland, Windsor & Greeley homes with CHFA and down payment program guidance.',
    ogImage: '/images/buyers-hero.jpg',
    ogImageAlt: 'Northern Colorado home buyers guide',
  },
  {
    path: '/for-sellers/',
    priority: '0.8',
    changefreq: 'monthly',
    title: 'Sell Your Home in Northern Colorado | Free Market Analysis | SAA Homes',
    description: 'Sell your Northern Colorado home with expert marketing, pricing strategy, and negotiation from SAA Homes.',
    ogTitle: 'Sell Your Northern Colorado Home | Free Market Analysis',
    ogDescription: 'Expert listing strategy, pricing, and negotiation for Fort Collins, Loveland, Windsor & Greeley sellers.',
    ogImage: '/images/6-1.jpg',
    ogImageAlt: 'Sell your home in Northern Colorado',
  },
  {
    path: '/luxury-real-estate/',
    priority: '0.8',
    changefreq: 'weekly',
    title: 'Luxury Real Estate in Northern Colorado | $1M+ Homes | SAA Homes',
    description: 'Private representation for Northern Colorado’s $1 million and above homes — Boulder, Fort Collins, Windsor, and Loveland. Discretion and direct service from Schwartz and Associates.',
    ogTitle: 'The $1M+ Market, Mastered. | Luxury Real Estate Northern Colorado',
    ogDescription: "Private estates, exceptional homes, discreet service across Boulder, Fort Collins, Windsor, and Loveland. Adam and Mandi Schwartz — SAA Homes.",
    ogImage: '/images/Boulder.jpg',
    ogImageAlt: 'Luxury real estate in Northern Colorado — $1M+ homes',
  },
  {
    path: '/cash-home-buyers/',
    priority: '0.8',
    changefreq: 'weekly',
    title: 'Cash Home Buyers Northern Colorado | Sell Your House Fast for Cash | SAA Homes',
    description: 'Sell your Northern Colorado home for cash — close in as little as 7 days, no repairs, no commissions. Also serving cash buyers and investors looking for flip properties in Fort Collins, Loveland, Windsor, and Greeley.',
    ogTitle: 'Cash Home Buyers Northern Colorado | Fast Cash Offers',
    ogDescription: 'Sell your home for cash in 7-14 days as-is, or connect with Northern Colorado investment opportunities. SAA Homes serves both sellers and cash buyers.',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'Cash home buyers in Northern Colorado',
  },
  {
    path: '/contact/',
    priority: '0.7',
    changefreq: 'monthly',
    title: 'Contact SAA Homes | Northern Colorado Real Estate Agents',
    description: 'Contact SAA Homes in Fort Collins. Call (970) 999-1407 for buyer and seller representation across Northern Colorado.',
    ogTitle: 'Contact Schwartz and Associates | (970) 999-1407',
    ogDescription: 'Reach Adam and Mandi Schwartz for Northern Colorado buyer and seller representation.',
    ogImage: '/images/6-1.jpg',
    ogImageAlt: 'Contact SAA Homes Fort Collins real estate',
  },
  {
    path: '/properties/',
    priority: '0.95',
    changefreq: 'daily',
    title: 'Homes for Sale in Northern Colorado | Fort Collins, Loveland & Windsor | SAA Homes',
    description: 'Search homes for sale across Northern Colorado including Fort Collins, Loveland, Windsor, Greeley, and surrounding communities.',
    ogTitle: 'Homes for Sale in Northern Colorado',
    ogDescription: 'Search Fort Collins, Loveland, Windsor, Greeley & surrounding communities.',
    ogImage: '/images/buyers-hero.jpg',
    ogImageAlt: 'Homes for sale in Northern Colorado',
  },
  {
    // Logged-in saved-search dashboard — noindex (session page)
    path: '/my-saved-searches/',
    priority: '0.1',
    changefreq: 'monthly',
    title: 'My Saved Searches | SAA Homes',
    description: 'Manage your saved home searches, live match counts, and email alerts for Northern Colorado.',
    ogTitle: 'My Saved Searches | SAA Homes',
    ogDescription: 'Manage saved home searches and alerts.',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'SAA Homes saved searches',
    robots: 'noindex, nofollow',
  },
  {
    // Seller home-value dashboard — noindex (account page)
    path: '/my-home/',
    priority: '0.1',
    changefreq: 'monthly',
    title: 'My Home Value | SAA Homes',
    description: 'Private home value dashboard with multi-source estimates and seller tools from SAA Homes.',
    ogTitle: 'My Home Value | SAA Homes',
    ogDescription: 'Your home value estimate and seller dashboard.',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'SAA Homes my home',
    robots: 'noindex, nofollow',
  },
  {
    // In-app notification center — noindex (session page)
    path: '/notifications/',
    priority: '0.1',
    changefreq: 'monthly',
    title: 'Notifications | SAA Homes',
    description: 'Your home search alerts, price drops, and value updates from SAA Homes.',
    ogTitle: 'Notifications | SAA Homes',
    ogDescription: 'Home search alerts and price drops.',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'SAA Homes notifications',
    robots: 'noindex, nofollow',
  },
  {
    // Legacy manage URL — same dashboard, noindex
    path: '/alerts/manage/',
    priority: '0.1',
    changefreq: 'monthly',
    title: 'Manage Home Search Alerts | SAA Homes',
    description: 'View, pause, or delete your saved home searches and email alerts for Northern Colorado.',
    ogTitle: 'Manage Alerts | SAA Homes',
    ogDescription: 'Manage saved home search alerts.',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'SAA Homes alerts',
    robots: 'noindex, nofollow',
  },
  {
    path: '/northern-colorado-areas/',
    priority: '0.9',
    changefreq: 'weekly',
    title: 'Northern Colorado Communities & Neighborhoods | SAA Homes',
    description: 'Explore Northern Colorado communities including Fort Collins, Loveland, Windsor, Greeley, and more with SAA Homes area guides.',
    ogTitle: 'Northern Colorado Area Guides | 27+ Communities',
    ogDescription: 'Explore Fort Collins, Loveland, Windsor, Greeley, Erie, Brighton, Carbon Valley, Estes Park & more with local real estate guides.',
    ogImage: '/images/Northern Colorado.webp',
    ogImageAlt: 'Northern Colorado communities and neighborhoods',
  },
  {
    path: '/chfa-down-payment-assistance/',
    priority: '0.98',
    changefreq: 'weekly',
    title: 'CHFA Down Payment Assistance Colorado | First-Time Homebuyer Programs 2026 | SAA Homes',
    description: 'Complete guide to CHFA down payment assistance in Colorado. Grants up to $25K, SmartStep, Preferred, FirstStep & FirstGeneration programs for Northern Colorado buyers.',
    ogTitle: 'CHFA Down Payment Assistance Colorado | Up to $25K',
    ogDescription: 'Grants & deferred loans up to $25,000 for Colorado first-time homebuyers. SmartStep, Preferred, FirstStep & FirstGeneration programs.',
    ogImage: '/images/Buyers-img-2.jpg',
    ogImageAlt: 'CHFA down payment assistance for Colorado homebuyers',
  },
  {
    path: '/greeley-g-hope-down-payment-assistance/',
    priority: '0.96',
    changefreq: 'weekly',
    title: 'G-HOPE Greeley Down Payment Assistance | Zone Map & Employee Homebuyer Guide 2026 | Schwartz and Associates',
    description: 'Complete G-HOPE guide with zone map: $8K Zone 1 (east of 8th Ave), $6K Zone 2, $4K Zone 3, $2,500 Zone 4. Forgivable loans for Greeley-area employees east of 35th Avenue.',
    ogTitle: 'G-HOPE Greeley | Up to $8,000 Down Payment Help',
    ogDescription: 'City of Greeley employee program with zone map. $8K–$2.5K forgivable down payment loans east of 35th Ave. No income limits.',
    ogImage: '/images/G-HOPE-Greeley-Zone-Map.png',
    ogImageAlt: 'G-HOPE geographic zone map — Greeley, Colorado down payment assistance',
  },
  {
    path: '/chfa-schools-to-home/',
    priority: '0.95',
    changefreq: 'weekly',
    title: 'CHFA Schools To Home 2026: 25% Down Payment for CO Teachers',
    description: 'CO teachers & public school staff: CHFA Schools To Home provides up to 25% down payment assistance with no monthly payment. Check eligibility and income limits. Free consult: (970) 999-1407.',
    ogTitle: 'CHFA Schools To Home 2026: 25% Down Payment for CO Teachers',
    ogDescription: 'Colorado teachers & public school employees may qualify for up to 25% down payment help through CHFA Schools To Home — with no monthly DPA payment. SAA Homes helps educators across Northern Colorado use the program. Free consult: (970) 999-1407.',
    ogImage: '/images/buyers-hero.jpg',
    ogImageAlt: 'CHFA Schools To Home for Colorado educators',
  },
  {
    path: '/colorado-champions-home-loan-program/',
    priority: '0.95',
    changefreq: 'weekly',
    title: 'Colorado Champions Home Loan Program | CHFA First Responder Home Loans 2026 | SAA Homes',
    description: 'Colorado\'s new CHFA Champions Home Loan Program expands eligibility for police, firefighters, EMTs, and 911 dispatchers. Expected late 2026.',
    ogTitle: 'Colorado Champions Home Loan | First Responder CHFA Program',
    ogDescription: 'Expanded CHFA eligibility for police, firefighters, EMTs & 911 dispatchers. 110% income limits + down payment help.',
    ogImage: '/images/Shwartz-CTA-Buyers.jpg',
    ogImageAlt: 'Colorado Champions Home Loan for first responders',
  },
  {
    path: '/mortgage-calculator/',
    priority: '0.8',
    changefreq: 'monthly',
    title: 'Colorado Mortgage Calculator | Northern Colorado Home Payments | SAA Homes',
    description: 'Estimate your monthly mortgage payment for Northern Colorado homes with our free calculator.',
    ogTitle: 'Northern Colorado Mortgage Calculator',
    ogDescription: 'Estimate monthly payments for Fort Collins, Loveland, Windsor & Greeley homes.',
    ogImage: '/images/buyers-hero.jpg',
    ogImageAlt: 'Colorado mortgage payment calculator',
  },
  {
    path: '/blog/',
    priority: '0.9',
    changefreq: 'weekly',
    title: 'Northern Colorado Real Estate Blog & CHFA Homebuyer Guides | SAA Homes',
    description: 'CHFA down payment assistance guides, market updates, and home buying tips for Fort Collins, Loveland, Windsor, Greeley, and Northern Colorado.',
    ogTitle: 'Northern Colorado Real Estate Blog & CHFA Guides',
    ogDescription: 'CHFA guides, market updates, and home buying tips for Northern Colorado.',
    ogImage: '/images/Northern Colorado.webp',
    ogImageAlt: 'Northern Colorado real estate blog',
  },
  {
    path: '/testimonials/',
    priority: '0.7',
    changefreq: 'monthly',
    title: 'Client Reviews | SAA Homes Fort Collins Real Estate',
    description: 'Read client reviews for SAA Homes — Northern Colorado real estate agents Adam and Mandi Schwartz.',
    ogTitle: 'Client Reviews | Schwartz and Associates',
    ogDescription: 'Read reviews from Northern Colorado buyers and sellers.',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'SAA Homes client reviews',
  },
  {
    path: '/events/',
    priority: '0.8',
    changefreq: 'monthly',
    title: 'Northern Colorado Events Calendar 2026 | Festivals & Things to Do | SAA Homes',
    description: 'Browse Northern Colorado events by month or city — festivals, farmers markets, rodeos, and community celebrations across Fort Collins, Loveland, Windsor, Greeley, and 27+ Front Range communities.',
    ogTitle: 'Northern Colorado Events Calendar | SAA Homes',
    ogDescription: 'Find festivals, farmers markets, and community events across Northern Colorado — filter by month or city.',
    ogImage: '/images/Northern Colorado.webp',
    ogImageAlt: 'Northern Colorado events calendar',
  },
].map(withShareMeta);

function blogPriority(slug) {
  if (slug.includes('chfa') || slug.includes('champions')) return '0.92';
  return '0.85';
}

export function getSitemapEntries(lastmod) {
  const date = lastmod || new Date().toISOString().slice(0, 10);

  return [
    ...staticPages.map((page) => ({ ...page, lastmod: date })),
    ...areaSeoPages.map((area) =>
      withShareMeta({
        path: `/northern-colorado-areas/${area.slug}/`,
        priority: area.sitemapPriority || '0.8',
        changefreq: 'monthly',
        lastmod: date,
        title: getAreaExactTitle(area),
        description: area.description,
        ogTitle: `${area.city} Real Estate | Schwartz and Associates`,
        ogDescription: area.description,
        ogImage: area.heroImage,
        ogImageAlt: `${area.city}, Colorado real estate guide`,
      })
    ),
    ...blogPosts.map((post) =>
      withShareMeta({
        path: `/blog/${post.slug}/`,
        priority: blogPriority(post.slug),
        changefreq: 'monthly',
        lastmod: post.date || date,
        title: `${post.title} | SAA Homes`,
        description: post.excerpt,
        ogTitle: post.title,
        ogDescription: post.excerpt,
        ogImage: post.image,
        ogImageAlt: post.title,
      })
    ),
    ...neighborhoods.map((n) =>
      withShareMeta({
        path: `/northern-colorado-areas/${n.citySlug}/${n.slug}/`,
        priority: '0.7',
        changefreq: 'monthly',
        lastmod: date,
        title: `${n.name}, ${n.cityDisplay} — Neighborhood Guide | SAA Homes`,
        description: n.description,
        ogTitle: `${n.name} ${n.cityDisplay} Neighborhood Guide`,
        ogDescription: n.description,
        ogImage: n.image || '/images/Northern Colorado.webp',
        ogImageAlt: `${n.name} neighborhood in ${n.cityDisplay}, Colorado`,
      })
    ),
    // City "homes for sale" pages — Tier S money pages (daily freshness)
    ...CITY_HOMES.map((c) =>
      withShareMeta({
        path: getCityHomesPath(c.slug),
        priority: '0.9',
        changefreq: 'daily',
        lastmod: date,
        title: `${c.city} Homes for Sale | Live IRES MLS Listings | SAA Homes`,
        description: `Browse every active home for sale in ${c.city}, ${c.county}. Live IRES MLS listings — houses, condos, townhomes & new construction. Schwartz and Associates at SAA Homes. Call (970) 999-1407.`,
        ogTitle: `${c.city} Homes for Sale | SAA Homes`,
        ogDescription: `Live IRES MLS listings in ${c.city}, Colorado — updated daily.`,
        ogImage: '/images/buyers-hero.jpg',
        ogImageAlt: `${c.city}, Colorado homes for sale`,
      })
    ),
  ];
}

export function getPrerenderRoutes() {
  return getSitemapEntries().map(
    ({ path, title, description, ogTitle, ogDescription, ogImage, ogImageAlt, robots }) => ({
      path,
      title,
      description,
      ogTitle,
      ogDescription,
      ogImage,
      ogImageAlt,
      robots,
    })
  );
}

export function getShareMetaForPath(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const entry = getSitemapEntries().find((page) => page.path === normalized);
  if (!entry) return null;
  return {
    title: entry.title,
    description: entry.description,
    ogTitle: entry.ogTitle,
    ogDescription: entry.ogDescription,
    ogImage: entry.ogImage,
    ogImageAlt: entry.ogImageAlt,
    canonical: `${SITE_URL}${entry.path}`,
  };
}
