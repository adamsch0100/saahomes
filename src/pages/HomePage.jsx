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

export default function HomePage() {
  return (
    <>
      <SEO
        exactTitle="Fort Collins Real Estate Agents | SAA Homes - Schwartz and Associates"
        description="Schwartz and Associates at Coldwell Banker Realty — your trusted Fort Collins real estate agents serving Northern Colorado. Expert buyers and sellers agents in Fort Collins, Loveland, Windsor, and Greeley."
        keywords="Fort Collins real estate agents, SAA Homes, Schwartz and Associates, Northern Colorado real estate, Loveland realtor, Windsor homes, Greeley property, Coldwell Banker Fort Collins"
        canonical="https://saahomes.com/"
      />
      <Hero />
      <AboutSection />
      <CoffeeSection />
      <ServiceSection />
      <MapSection />
      <Testimonials />
      <SocialSection />
      <ContactCTA />

      {/* LocalBusiness Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          "name": "Schwartz And Associates",
          "image": "/images/White-Logo-AUTOx110.fit.png",
          "@id": "https://saahomes.com",
          "url": "https://saahomes.com",
          "telephone": "(970) 999-1407",
          "email": "info@saahomes.com",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "3665 John F Kennedy Parkway, Suite 210",
            "addressLocality": "Fort Collins",
            "addressRegion": "CO",
            "postalCode": "80525",
            "addressCountry": "US"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "40.5853",
            "longitude": "-105.0844"
          },
          "openingHoursSpecification": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday"
            ],
            "opens": "09:00",
            "closes": "17:00"
          },
          "priceRange": "$$",
          "areaServed": [
            {
              "@type": "City",
              "name": "Fort Collins"
            },
            {
              "@type": "City",
              "name": "Loveland"
            },
            {
              "@type": "City",
              "name": "Windsor"
            },
            {
              "@type": "City",
              "name": "Greeley"
            },
            {
              "@type": "City",
              "name": "Northern Colorado"
            }
          ],
          "sameAs": [
            "https://www.facebook.com/schwartzandassociateshomes",
            "https://twitter.com/saahomes",
            "https://youtube.com/@SAAHomes",
            "https://www.instagram.com/saa_homes/"
          ]
        })}
      </script>
    </>
  );
}

