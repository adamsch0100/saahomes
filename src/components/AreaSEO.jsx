import React, { useEffect, useState } from 'react';
import SEO from './SEO.jsx';
import { buildAreaPageSchemas, getAreaExactTitle, getAreaKeywords, getAreaPageUrl, getAreaSeo } from '../data/areaSeo.js';
import { getShareMetaForPath } from '../data/siteRoutes.js';
import { buildListingsItemListSchema } from '../utils/seoConstants.js';

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return '';
})();

/** City string for /api/listings — strip trailing ", CO" if present. */
function listingSearchCity(area) {
  if (!area) return '';
  const raw = area.searchLocation || area.city || '';
  return String(raw).replace(/,?\s*CO\s*$/i, '').trim();
}

/**
 * Area page SEO + schemas.
 * Adds an ItemList of featured active listings (live IRES) for GEO/AEO
 * so AI systems can enumerate homes in this city. Max 12 items.
 */
export default function AreaSEO({ slug }) {
  const area = getAreaSeo(slug);
  const [featuredListings, setFeaturedListings] = useState([]);

  useEffect(() => {
    if (!area) return undefined;
    const city = listingSearchCity(area);
    if (!city) return undefined;

    let cancelled = false;
    const params = new URLSearchParams({
      city,
      limit: '12',
      sort: 'newest',
    });

    fetch(`${API_BASE}/api/listings?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        setFeaturedListings(Array.isArray(data.data) ? data.data : []);
      })
      .catch(() => {
        /* schema is additive — silent fail leaves base schemas intact */
      });

    return () => {
      cancelled = true;
    };
  }, [area]);

  if (!area) return null;

  const pageUrl = getAreaPageUrl(slug);
  const imageUrl = area.heroImage.startsWith('http') ? area.heroImage : `https://saahomes.com${area.heroImage}`;
  const shareMeta = getShareMetaForPath(pageUrl);

  const baseSchemas = buildAreaPageSchemas(area);
  const listingsItemList = buildListingsItemListSchema(featuredListings, {
    name: `Homes for Sale in ${area.city}, CO`,
    description: `Featured active listings in ${area.city}, Colorado from IRES MLS.`,
    maxItems: 12,
  });
  const jsonLd = listingsItemList ? [...baseSchemas, listingsItemList] : baseSchemas;

  return (
    <SEO
      exactTitle={getAreaExactTitle(area)}
      description={area.description}
      keywords={getAreaKeywords(area)}
      canonical={pageUrl}
      ogTitle={shareMeta?.ogTitle || getAreaExactTitle(area)}
      ogDescription={shareMeta?.ogDescription || area.description}
      ogImage={shareMeta?.ogImage || imageUrl}
      ogImageAlt={shareMeta?.ogImageAlt || `${area.city}, Colorado real estate guide`}
      ogUrl={pageUrl}
      jsonLd={jsonLd}
      includeWebsite={true}
    />
  );
}
