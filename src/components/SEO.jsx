import React from "react";
import { Helmet } from "react-helmet-async";

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
  type = "website",
  image = "/images/White-Logo-AUTOx110.fit.png"
}) {
  const siteTitle = "Schwartz And Associates | Northern Colorado Real Estate";
  const fullTitle = exactTitle || (title ? `${title} | ${siteTitle}` : siteTitle);
  const finalOgTitle = ogTitle || fullTitle;
  const finalOgDescription = ogDescription || description;
  const finalOgImage = ogImage || image;
  const finalOgUrl = ogUrl || canonical;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="SAA Homes" />
      <meta property="og:title" content={finalOgTitle} />
      <meta property="og:description" content={finalOgDescription} />
      {finalOgImage && <meta property="og:image" content={finalOgImage} />}
      {finalOgUrl && <meta property="og:url" content={finalOgUrl} />}
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:title" content={finalOgTitle} />
      <meta property="twitter:description" content={finalOgDescription} />
      {finalOgImage && <meta property="twitter:image" content={finalOgImage} />}
      
      {/* Structured Data for Local Business */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          "name": "Schwartz And Associates",
          "image": image,
          "description": description,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "3665 John F Kennedy Parkway, Suite 210",
            "addressLocality": "Fort Collins",
            "addressRegion": "CO",
            "postalCode": "80525",
            "addressCountry": "US"
          },
          "telephone": "(970) 999-1407",
          "email": "info@saahomes.com",
          "areaServed": [
            "Fort Collins, CO",
            "Loveland, CO",
            "Windsor, CO",
            "Greeley, CO",
            "Northern Colorado"
          ],
          "priceRange": "$$"
        })}
      </script>
    </Helmet>
  );
}

