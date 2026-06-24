import React from 'react';
import SEO from './SEO.jsx';
import { buildAreaPageSchemas, getAreaPageUrl, getAreaSeo } from '../data/areaSeo.js';

export default function AreaSEO({ slug }) {
  const area = getAreaSeo(slug);

  if (!area) return null;

  const pageUrl = getAreaPageUrl(slug);
  const imageUrl = area.heroImage.startsWith('http') ? area.heroImage : `https://saahomes.com${area.heroImage}`;

  return (
    <SEO
      exactTitle={area.exactTitle}
      description={area.description}
      keywords={area.keywords}
      canonical={pageUrl}
      ogTitle={`${area.city}, CO Real Estate Guide | SAA Homes`}
      ogDescription={area.description}
      ogImage={imageUrl}
      ogUrl={pageUrl}
      jsonLd={buildAreaPageSchemas(area)}
    />
  );
}
