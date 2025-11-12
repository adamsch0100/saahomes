import React from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import PropertySearchEmbed from "../components/PropertySearchEmbed";

export default function PropertiesPage() {
  const [searchParams] = useSearchParams();
  const location = searchParams.get('location') || '';

  // Build SEO title and description based on location
  const locationText = location ? ` in ${location}` : '';
  const title = location 
    ? `Property Search${locationText} | Schwartz And Associates`
    : "Property Search - Find Your Perfect Home | Schwartz And Associates";
  const description = location
    ? `Search for homes for sale${locationText}. Browse available properties and find your perfect home.`
    : "Search for homes for sale in Northern Colorado. Browse properties in Fort Collins, Loveland, Windsor, Greeley, and surrounding areas.";

  return (
    <>
      <SEO 
        title={title}
        description={description}
        keywords="property search, homes for sale, Northern Colorado real estate, Fort Collins homes, Loveland properties, real estate search"
        canonical="https://saahomes.com/properties/"
      />
      
      {/* Hero Section */}
      <section className="relative h-[120px] bg-black pt-32"></section>

      {/* Embedded Property Search */}
      <section className="py-6 px-6 bg-gray-50 relative" style={{ minHeight: 'calc(100vh - 200px)', paddingBottom: '600px', zIndex: 1 }}>
        <div className="max-w-full mx-auto" style={{ height: 'calc(100vh - 200px)' }}>
          <PropertySearchEmbed location={location} height="100%" />
        </div>
      </section>
    </>
  );
}

