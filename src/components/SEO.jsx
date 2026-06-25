import React from "react";
import { Helmet } from "react-helmet-async";
import { BUSINESS, SITE_TITLE_SUFFIX, toAbsoluteUrl } from "../utils/seoConstants.js";

const BRAND_MARKERS = ['SAA Homes', 'Schwartz And Associates', 'Schwartz and Associates'];

function buildTitle(title, exactTitle) {
  if (exactTitle) return exactTitle;
  if (!title) return SITE_TITLE_SUFFIX;
  const hasBrand = BRAND_MARKERS.some((marker) => title.includes(marker));
  if (hasBrand) return title;
  return `${title} | ${SITE_TITLE_SUFFIX}`;
}

function buildLocalBusinessSchema(description) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": BUSINESS.name,
    "image": BUSINESS.logo,
    "description": description,
    "@id": BUSINESS.url,
    "url": BUSINESS.url,
    "telephone": BUSINESS.telephone,
    "email": BUSINESS.email,
    "address": {
      "@type": "PostalAddress",
      ...BUSINESS.address,
    },
    "geo": {
      "@type": "GeoCoordinates",
      ...BUSINESS.geo,
    },
    "areaServed": BUSINESS.areaServed,
    "priceRange": BUSINESS.priceRange,
    "alternateName": BUSINESS.alternateName,
    "sameAs": BUSINESS.sameAs,
    ...(BUSINESS.googleBusinessProfile ? { hasMap: BUSINESS.googleBusinessProfile } : {}),
  };
}

function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": BUSINESS.name,
    "alternateName": "SAA Homes",
    "url": BUSINESS.url,
    "description": "Northern Colorado real estate agents helping buyers and sellers in Fort Collins, Loveland, Windsor, Greeley, and across Colorado.",
    "publisher": {
      "@type": "RealEstateAgent",
      "name": BUSINESS.name,
      "url": BUSINESS.url,
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${BUSINESS.url}/properties/?location={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export default function SEO({
  title,
  exactTitle,
  description,
  keywords,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  ogImageAlt,
  type = "website",
  image = "/images/White-Logo-AUTOx110.fit.png",
  robots,
  includeLocalBusiness = false,
  includeWebsite = false,
  jsonLd = [],
}) {
  const fullTitle = buildTitle(title, exactTitle);
  const finalOgTitle = ogTitle || fullTitle;
  const finalOgDescription = ogDescription || description;
  const finalOgImage = toAbsoluteUrl(ogImage || image);
  const finalOgUrl = ogUrl || canonical;
  const finalOgImageAlt = ogImageAlt || finalOgTitle;
  const robotsContent = robots || "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  const schemas = [
    ...(includeWebsite ? [buildWebsiteSchema()] : []),
    ...(includeLocalBusiness ? [buildLocalBusinessSchema(description)] : []),
    ...jsonLd,
  ];

  return (
    <Helmet htmlAttributes={{ lang: 'en' }}>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={robotsContent} />
      <meta name="author" content={BUSINESS.name} />
      <meta name="geo.region" content="US-CO" />
      <meta name="geo.placename" content="Fort Collins, Colorado" />
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Schwartz and Associates" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={finalOgTitle} />
      <meta property="og:description" content={finalOgDescription} />
      {finalOgImage && <meta property="og:image" content={finalOgImage} />}
      {finalOgImage && <meta property="og:image:secure_url" content={finalOgImage} />}
      {finalOgImage && <meta property="og:image:alt" content={finalOgImageAlt} />}
      {finalOgImage && <meta property="og:image:width" content="1200" />}
      {finalOgImage && <meta property="og:image:height" content="630" />}
      {finalOgUrl && <meta property="og:url" content={finalOgUrl} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@saahomes" />
      <meta name="twitter:title" content={finalOgTitle} />
      <meta name="twitter:description" content={finalOgDescription} />
      {finalOgImage && <meta name="twitter:image" content={finalOgImage} />}
      {finalOgImage && <meta name="twitter:image:alt" content={finalOgImageAlt} />}
      {finalOgUrl && <meta name="twitter:url" content={finalOgUrl} />}

      {schemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
