import { blogPosts } from './blogPosts.js';
import { areaSeoPages, getAreaExactTitle } from './areaSeo.js';

export const SITE_URL = 'https://saahomes.com';

const staticPages = [
  { path: '/', priority: '1.0', changefreq: 'weekly', title: 'Schwartz and Associates | Northern Colorado Real Estate | Fort Collins, Loveland & Greeley', description: 'Schwartz and Associates, Coldwell Banker Realty — Northern Colorado real estate agents serving Fort Collins, Loveland, Windsor, Greeley, and 19+ Front Range communities.' },
  { path: '/about-us/', priority: '0.8', changefreq: 'monthly', title: 'About SAA Homes | Fort Collins Real Estate Experts | 20+ Years Experience', description: 'Meet Adam and Mandi Schwartz of SAA Homes — Fort Collins real estate experts with 20+ years of combined experience serving Northern Colorado.' },
  { path: '/for-buyers/', priority: '0.8', changefreq: 'monthly', title: 'Colorado Home Buyers | Homes for Sale in Northern Colorado | SAA Homes', description: 'Search homes for sale in Fort Collins, Loveland, Windsor, and across Northern Colorado with expert buyer representation from SAA Homes.' },
  { path: '/for-sellers/', priority: '0.8', changefreq: 'monthly', title: 'Sell Your Home in Northern Colorado | Free Market Analysis | SAA Homes', description: 'Sell your Northern Colorado home with expert marketing, pricing strategy, and negotiation from SAA Homes.' },
  { path: '/contact/', priority: '0.7', changefreq: 'monthly', title: 'Contact SAA Homes | Northern Colorado Real Estate Agents', description: 'Contact SAA Homes in Fort Collins. Call (970) 999-1407 for buyer and seller representation across Northern Colorado.' },
  { path: '/properties/', priority: '0.95', changefreq: 'daily', title: 'Homes for Sale in Northern Colorado | Fort Collins, Loveland & Windsor | SAA Homes', description: 'Search homes for sale across Northern Colorado including Fort Collins, Loveland, Windsor, Greeley, and surrounding communities.' },
  { path: '/northern-colorado-areas/', priority: '0.9', changefreq: 'weekly', title: 'Northern Colorado Communities & Neighborhoods | SAA Homes', description: 'Explore Northern Colorado communities including Fort Collins, Loveland, Windsor, Greeley, and more with SAA Homes area guides.' },
  { path: '/chfa-down-payment-assistance/', priority: '0.98', changefreq: 'weekly', title: 'CHFA Down Payment Assistance Colorado | First-Time Homebuyer Programs 2026 | SAA Homes', description: 'Complete guide to CHFA down payment assistance in Colorado. Grants up to $25K, SmartStep, Preferred, FirstStep & FirstGeneration programs for Northern Colorado buyers.' },
  { path: '/greeley-g-hope-down-payment-assistance/', priority: '0.96', changefreq: 'weekly', title: 'G-HOPE Greeley Down Payment Assistance | Zone Map & Employee Homebuyer Guide 2026 | Schwartz and Associates', description: 'Complete G-HOPE guide with zone map: $8K Zone 1 (east of 8th Ave), $6K Zone 2, $4K Zone 3, $2,500 Zone 4. Forgivable loans for Greeley-area employees east of 35th Avenue.' },
  { path: '/chfa-schools-to-home/', priority: '0.95', changefreq: 'weekly', title: 'CHFA Schools To Home | Colorado Teacher Down Payment Assistance | SAA Homes', description: 'CHFA Schools To Home helps Colorado public school employees with up to 25% down payment assistance. Free consultation from SAA Homes.' },
  { path: '/colorado-champions-home-loan-program/', priority: '0.95', changefreq: 'weekly', title: 'Colorado Champions Home Loan Program | CHFA First Responder Home Loans 2026 | SAA Homes', description: 'Colorado\'s new CHFA Champions Home Loan Program expands eligibility for police, firefighters, EMTs, and 911 dispatchers. Expected late 2026.' },
  { path: '/mortgage-calculator/', priority: '0.8', changefreq: 'monthly', title: 'Colorado Mortgage Calculator | Northern Colorado Home Payments | SAA Homes', description: 'Estimate your monthly mortgage payment for Northern Colorado homes with our free calculator.' },
  { path: '/blog/', priority: '0.9', changefreq: 'weekly', title: 'Northern Colorado Real Estate Blog & CHFA Homebuyer Guides | SAA Homes', description: 'CHFA down payment assistance guides, market updates, and home buying tips for Fort Collins, Loveland, Windsor, Greeley, and Northern Colorado.' },
  { path: '/testimonials/', priority: '0.7', changefreq: 'monthly', title: 'Client Reviews | SAA Homes Fort Collins Real Estate', description: 'Read client reviews for SAA Homes — Northern Colorado real estate agents Adam and Mandi Schwartz.' },
];

function blogPriority(slug) {
  if (slug.includes('chfa') || slug.includes('champions')) return '0.92';
  return '0.85';
}

export function getSitemapEntries(lastmod) {
  const date = lastmod || new Date().toISOString().slice(0, 10);

  return [
    ...staticPages.map((page) => ({ ...page, lastmod: date })),
    ...areaSeoPages.map((area) => ({
      path: `/northern-colorado-areas/${area.slug}/`,
      priority: area.sitemapPriority || '0.8',
      changefreq: 'monthly',
      lastmod: date,
      title: getAreaExactTitle(area),
      description: area.description,
    })),
    ...blogPosts.map((post) => ({
      path: `/blog/${post.slug}/`,
      priority: blogPriority(post.slug),
      changefreq: 'monthly',
      lastmod: post.date || date,
      title: `${post.title} | SAA Homes`,
      description: post.excerpt,
    })),
  ];
}

export function getPrerenderRoutes() {
  return getSitemapEntries().map(({ path, title, description }) => ({
    path,
    title,
    description,
  }));
}
