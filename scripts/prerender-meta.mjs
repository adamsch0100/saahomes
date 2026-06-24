import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { blogPosts } from '../src/data/blogPosts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');
const indexPath = join(distDir, 'index.html');

const routes = [
  {
    path: '/',
    title: 'Fort Collins Real Estate Agents | SAA Homes - Northern Colorado',
    description: 'Schwartz and Associates — trusted Northern Colorado real estate agents in Fort Collins, Loveland, Windsor, Greeley, and across Colorado.',
  },
  {
    path: '/for-buyers/',
    title: 'Colorado Home Buyers | Homes for Sale in Northern Colorado | SAA Homes',
    description: 'Search homes for sale in Fort Collins, Loveland, Windsor, and across Northern Colorado with expert buyer representation from SAA Homes.',
  },
  {
    path: '/for-sellers/',
    title: 'Sell Your Home in Northern Colorado | Free Market Analysis | SAA Homes',
    description: 'Sell your Northern Colorado home with expert marketing, pricing strategy, and negotiation from SAA Homes.',
  },
  {
    path: '/contact/',
    title: 'Contact SAA Homes | Northern Colorado Real Estate Agents',
    description: 'Contact SAA Homes in Fort Collins. Call (970) 999-1407 for buyer and seller representation across Northern Colorado.',
  },
  {
    path: '/properties/',
    title: 'Homes for Sale in Northern Colorado | Fort Collins, Loveland & Windsor | SAA Homes',
    description: 'Search homes for sale across Northern Colorado including Fort Collins, Loveland, Windsor, Greeley, and surrounding communities.',
  },
  {
    path: '/northern-colorado-areas/',
    title: 'Northern Colorado Communities & Neighborhoods | SAA Homes',
    description: 'Explore Northern Colorado communities including Fort Collins, Loveland, Windsor, Greeley, and more.',
  },
  {
    path: '/chfa-schools-to-home/',
    title: 'CHFA Schools To Home | Colorado Teacher Down Payment Assistance | SAA Homes',
    description: 'CHFA Schools To Home helps Colorado public school employees with up to 25% down payment assistance.',
  },
  {
    path: '/mortgage-calculator/',
    title: 'Colorado Mortgage Calculator | Northern Colorado Home Payments | SAA Homes',
    description: 'Estimate your monthly mortgage payment for Northern Colorado homes with our free calculator.',
  },
  {
    path: '/blog/',
    title: 'Northern Colorado Real Estate Blog & Guides | SAA Homes',
    description: 'Real estate tips, market updates, and neighborhood guides for Northern Colorado buyers and sellers.',
  },
  {
    path: '/testimonials/',
    title: 'Client Reviews | SAA Homes Fort Collins Real Estate',
    description: 'Read client reviews for SAA Homes — Northern Colorado real estate agents Adam and Mandi Schwartz.',
  },
  ...blogPosts.map((post) => ({
    path: `/blog/${post.slug}/`,
    title: `${post.title} | SAA Homes`,
    description: post.excerpt,
  })),
];

function injectMeta(html, { title, description, canonical }) {
  let output = html;

  output = output.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  output = output.replace(
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${description.replace(/"/g, '&quot;')}" />`
  );

  if (output.includes('rel="canonical"')) {
    output = output.replace(
      /<link rel="canonical" href=".*?" \/>/,
      `<link rel="canonical" href="${canonical}" />`
    );
  } else {
    output = output.replace(
      '</head>',
      `  <link rel="canonical" href="${canonical}" />\n  </head>`
    );
  }

  return output;
}

if (!existsSync(indexPath)) {
  console.error('dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const baseHtml = readFileSync(indexPath, 'utf8');

for (const route of routes) {
  const canonical = `https://saahomes.com${route.path}`;
  const html = injectMeta(baseHtml, {
    title: route.title,
    description: route.description,
    canonical,
  });

  const routeDir = join(distDir, route.path.replace(/^\//, '').replace(/\/$/, ''));
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, 'index.html'), html);
  console.log(`Prerendered meta for ${route.path}`);
}

console.log(`Prerendered ${routes.length} routes.`);
