import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPrerenderRoutes, SITE_URL } from '../src/data/siteRoutes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');
const indexPath = join(distDir, 'index.html');

const routes = getPrerenderRoutes();

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
  const canonical = `${SITE_URL}${route.path}`;
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
