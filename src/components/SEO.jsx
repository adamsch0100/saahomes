import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { BUSINESS, SITE_TITLE_SUFFIX, toAbsoluteUrl } from "../utils/seoConstants.js";
import { useBrokerageBrand } from "../context/TenantContext.jsx";

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

/**
 * Drop JSON-LD schemas that already exist in the prerendered <head> so React Helmet
 * does not re-inject the same entity on hydration (fixes the 4-of-5 type duplication
 * where the SSR/prerender layer and react-helmet-async both emit schemas).
 */
function dedupeJsonLd(schemas) {
  if (typeof document === "undefined") return schemas;
  let existing;
  try {
    existing = new Set();
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const parsed = JSON.parse(el.textContent || "");
        if (parsed && parsed["@type"]) {
          existing.add(parsed["@id"] ? `@id:${parsed["@id"]}` : `@type:${parsed["@type"]}`);
        }
      } catch {
        /* skip malformed pre-existing script */
      }
    });
  } catch {
    return schemas;
  }
  return schemas.filter((schema) => {
    if (!schema || !schema["@type"]) return true;
    const key = schema["@id"] ? `@id:${schema["@id"]}` : `@type:${schema["@type"]}`;
    return !existing.has(key);
  });
}

/*
 * Another brokerage's own domain: pages it shares with SAA (search, listings,
 * saved searches, …) still pass SAA's titles and copy. Swap SAA's name, phone,
 * email and market for the brokerage's, point URLs at this domain, and drop
 * anything that still names SAA's people or company.
 */
const SAA_ORIGIN_RE = /^https?:\/\/(www\.)?saahomes\.com/i;
const SAA_LEFTOVER_RE = /\bAdam\b|\bMandi\b|Schwartz|saahomes|\bSAA\b|Coldwell/i;

function brokerageText(text, bb) {
  if (!text) return text;
  return String(text)
    .replace(/Schwartz [Aa]nd Associates|SAA Homes/g, bb.name || "")
    .replace(/\(970\) 999-1407/g, bb.phone || "")
    .replace(/info@saahomes\.com/g, bb.email || "")
    .replace(/Northern Colorado/g, bb.market || "")
    .replace(/\bIRES MLS\b/g, "MLS")
    .replace(/(\|\s*){2,}/g, "| ")
    .replace(/^[\s|·—-]+|[\s|·—-]+$/g, "")
    .replace(/\s{2,}/g, " ");
}

function brokerageUrl(url) {
  if (!url || typeof window === "undefined") return url;
  return String(url).replace(SAA_ORIGIN_RE, window.location.origin);
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
  geoPlacename = "Fort Collins, Colorado",
}) {
  const location = useLocation();
  const bb = useBrokerageBrand();
  if (bb) {
    return (
      <BrokerageSEO
        bb={bb}
        title={title}
        exactTitle={exactTitle}
        description={description}
        canonical={canonical}
        type={type}
        robots={robots}
        jsonLd={jsonLd}
        pathname={location.pathname}
      />
    );
  }
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

  const visibleSchemas = dedupeJsonLd(schemas);

  return (
    <Helmet htmlAttributes={{ lang: 'en' }}>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={robotsContent} />
      <meta name="author" content={BUSINESS.name} />
      <meta name="geo.region" content="US-CO" />
      <meta name="geo.placename" content={geoPlacename} />
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

      {visibleSchemas.map((schema, index) => (
        <script key={`${location.pathname}-${schema['@type']}-${index}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

/** Head tags on another brokerage's domain: its name, its domain, nothing of SAA's. */
function BrokerageSEO({ bb, title, exactTitle, description, canonical, type, robots, jsonLd, pathname }) {
  const name = bb.name || "";
  let fullTitle = brokerageText(exactTitle || title || "", bb);
  if (fullTitle && !exactTitle && name && !fullTitle.includes(name)) fullTitle = `${fullTitle} | ${name}`;
  if (!fullTitle || SAA_LEFTOVER_RE.test(fullTitle)) fullTitle = name || "Homes for Sale";

  let desc = brokerageText(description || "", bb);
  if (!desc || SAA_LEFTOVER_RE.test(desc)) {
    desc = bb.tagline || `Homes for sale${bb.market ? ` in ${bb.market}` : ""}${name ? ` from ${name}` : ""}.`;
  }

  const url = canonical ? brokerageUrl(canonical) : null;
  const ogImage = bb.logoUrl
    ? (bb.logoUrl.startsWith("http") || typeof window === "undefined" ? bb.logoUrl : `${window.location.origin}${bb.logoUrl}`)
    : null;
  const schemas = (jsonLd || [])
    .map((schema) => {
      try {
        const text = JSON.stringify(schema).replace(/https?:\/\/(www\.)?saahomes\.com/gi, typeof window === "undefined" ? "" : window.location.origin);
        return SAA_LEFTOVER_RE.test(text) ? null : JSON.parse(text);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return (
    <Helmet htmlAttributes={{ lang: 'en' }}>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={robots || "index, follow, max-image-preview:large"} />
      {name ? <meta name="author" content={name} /> : null}
      {url && <link rel="canonical" href={url} />}
      <meta property="og:type" content={type} />
      {name ? <meta property="og:site_name" content={name} /> : null}
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      {schemas.map((schema, index) => (
        <script key={`${pathname}-${schema['@type']}-${index}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
