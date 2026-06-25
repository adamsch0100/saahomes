import React from 'react';
import SEO from './SEO.jsx';
import { buildAreaPageSchemas, getAreaExactTitle, getAreaKeywords, getAreaPageUrl, getAreaSeo } from '../data/areaSeo.js';

export default function AreaSEO({ slug }) {
  const area = getAreaSeo(slug);

  if (!area) return null;

  const pageUrl = getAreaPageUrl(slug);
  const imageUrl = area.heroImage.startsWith('http') ? area.heroImage : `https://saahomes.com${area.heroImage}`;

  return (
    <SEO
      exactTitle={getAreaExactTitle(area)}
      description={area.description}
      keywords={getAreaKeywords(area)}
      canonical={pageUrl}
      ogTitle={`${area.city} Real Estate | Schwartz and Associates`}
      ogDescription={area.description}
      ogImage={imageUrl}
      ogUrl={pageUrl}
      jsonLd={buildAreaPageSchemas(area)}
    />
  );
}
