import React from "react";
import SEO from "../components/SEO";
import Hero from "../components/Hero";
import AboutSection from "../components/AboutSection";
import CoffeeSection from "../components/CoffeeSection";
import ServiceSection from "../components/ServiceSection";
import MapSection from "../components/MapSection";
import Testimonials from "../components/Testimonials";
import SocialSection from "../components/SocialSection";
import ContactCTA from "../components/ContactCTA";
import { BUSINESS } from "../utils/seoConstants.js";

const homePageSchema = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "name": BUSINESS.name,
  "image": BUSINESS.logo,
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
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "opens": "09:00",
    "closes": "17:00",
  },
  "priceRange": BUSINESS.priceRange,
  "areaServed": BUSINESS.areaServed.map((name) => ({
    "@type": name.includes("Colorado") ? "AdministrativeArea" : "City",
    "name": name.replace(", CO", ""),
  })),
  "sameAs": BUSINESS.sameAs,
};

export default function HomePage() {
  return (
    <>
      <SEO
        exactTitle="Fort Collins Real Estate Agents | SAA Homes - Northern Colorado"
        description="Schwartz and Associates — trusted Northern Colorado real estate agents in Fort Collins, Loveland, Windsor, Greeley, and across Colorado. Expert buyer and seller representation."
        keywords="Fort Collins real estate agents, Northern Colorado realtor, SAA Homes, Schwartz and Associates, Loveland homes for sale, Windsor CO real estate, Greeley realtor, Colorado real estate"
        canonical="https://saahomes.com/"
        ogImage="https://saahomes.com/images/White-Logo-AUTOx110.fit.png"
        includeWebsite={true}
        jsonLd={[homePageSchema]}
      />
      <Hero />
      <AboutSection />
      <CoffeeSection />
      <ServiceSection />
      <MapSection />
      <Testimonials />
      <SocialSection />
      <ContactCTA />
    </>
  );
}
