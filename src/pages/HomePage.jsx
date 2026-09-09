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
import LatestMarketUpdateBanner from "../components/LatestMarketUpdateBanner.jsx";
import AreaFAQSection from "../components/AreaFAQSection.jsx";
import { BUSINESS } from "../utils/seoConstants.js";
import { getReviewSchema } from "../data/reviews.js";

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
  "alternateName": BUSINESS.alternateName,
  "areaServed": BUSINESS.areaServed.map((name) => ({
    "@type": name.includes("Colorado") ? "AdministrativeArea" : "City",
    "name": name.replace(", CO", ""),
  })),
  "sameAs": BUSINESS.sameAs,
};

const HOME_FAQS = [
  {
    q: "Who are Adam and Mandi Schwartz?",
    a: "Adam and Mandi Schwartz are the team behind Schwartz and Associates (SAA Homes), a Coldwell Banker Realty team serving Northern Colorado. Together they bring over 20 years of combined real estate experience, helping buyers and sellers across Fort Collins, Loveland, Windsor, Greeley, and 27+ Front Range communities. They specialize in CHFA down payment assistance, first-time homebuyer programs, and relocation to Northern Colorado.",
  },
  {
    q: "What areas do Schwartz and Associates serve?",
    a: "SAA Homes serves the entire Northern Colorado Front Range corridor including Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Johnstown, Berthoud, Longmont, Boulder, Mead, Firestone, Frederick, Erie, Evans, Severance, Milliken, La Salle, Eaton, and Niwot. We also serve Larimer County, Weld County, and Boulder County clients. Call (970) 999-1407 to discuss your specific area.",
  },
  {
    q: "Do you help with CHFA down payment assistance?",
    a: "Yes. Adam and Mandi Schwartz are experienced with Colorado CHFA down payment assistance programs including SmartStep, Preferred, FirstStep, FirstGeneration, and the Schools To Home program for educators. They help buyers navigate income limits, purchase price caps, lender coordination, and stacking assistance with seller concessions. See our CHFA guide at saahomes.com/chfa-down-payment-assistance/ or call (970) 999-1407.",
  },
  {
    q: "How do I start the home buying or selling process?",
    a: "Getting started is simple. Call (970) 999-1407 or visit our contact page at saahomes.com/contact/ to schedule a free consultation. For buyers, we'll discuss your budget, preferred areas, and CHFA eligibility if applicable. For sellers, we'll prepare a free comparative market analysis (CMA) covering your home's value and a customized marketing plan. No obligation, no pressure.",
  },
  {
    q: "Is Schwartz and Associates the right real estate team for me?",
    a: "Whether you are a first-time homebuyer, relocating to Northern Colorado, or selling a home you've lived in for decades, Schwartz and Associates provides white-glove service backed by Coldwell Banker Realty. Clients choose us for our deep local market knowledge, responsiveness, CHFA expertise, and commitment to making the process smooth. Read our verified Google reviews on our testimonials page.",
  },
];

const faqPageSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function HomePage() {
  return (
    <>
      <SEO
        exactTitle="Schwartz and Associates | Northern Colorado Real Estate | Fort Collins, Loveland & Greeley"
        description="Schwartz and Associates, Coldwell Banker Realty — Northern Colorado real estate agents serving Fort Collins, Loveland, Windsor, Greeley, and 27+ Front Range communities. Expert buyer and seller representation."
        keywords="Schwartz and Associates, Northern Colorado real estate, Fort Collins real estate, Loveland real estate, Greeley real estate, Windsor real estate, Northern Colorado realtor, Coldwell Banker Fort Collins, SAA Homes, Colorado homes for sale"
        canonical="https://saahomes.com/"
        ogImage="https://saahomes.com/images/White-Logo-AUTOx110.fit.png"
        includeWebsite={true}
        jsonLd={[homePageSchema, getReviewSchema(), faqPageSchema]}
      />
      <Hero />
      <AboutSection />
      <CoffeeSection />
      <ServiceSection />
      <LatestMarketUpdateBanner />
      <AreaFAQSection faqs={HOME_FAQS} city="Northern Colorado" />
      <MapSection />
      <Testimonials />
      <SocialSection />
      <ContactCTA />
    </>
  );
}