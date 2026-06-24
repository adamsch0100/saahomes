import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import PropertySearchEmbed from "../components/PropertySearchEmbed";

export default function PropertiesPage() {
  const [searchParams] = useSearchParams();
  const location = searchParams.get('location') || '';

  // Scroll to top when component mounts or location changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    // Also try to scroll the iframe content if possible
    // Note: This may not work due to cross-origin restrictions, but we'll try
    const iframe = document.querySelector('iframe[title="Property Search"]');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.scrollTo(0, 0);
      } catch (e) {
        // Cross-origin restriction - this is expected for external iframes
      }
    }
  }, [location]);

  return (
    <>
      <SEO
        exactTitle={location
          ? `Homes for Sale in ${location} | Northern Colorado | SAA Homes`
          : "Homes for Sale in Northern Colorado | Fort Collins, Loveland & Windsor | SAA Homes"}
        description={location
          ? `Search homes for sale in ${location}, Colorado. Browse Northern Colorado listings with SAA Homes — expert buyer agents serving Fort Collins, Loveland, Windsor, Greeley, and beyond.`
          : "Search homes for sale across Northern Colorado. Browse Fort Collins, Loveland, Windsor, Greeley, Timnath, and surrounding Colorado communities with SAA Homes."}
        keywords="homes for sale Northern Colorado, Colorado property search, Fort Collins homes for sale, Loveland real estate listings, Windsor CO homes, Greeley houses for sale, Colorado MLS search"
        canonical="https://saahomes.com/properties/"
        ogImage="https://saahomes.com/images/buyers-hero.jpg"
      />

      <section className="sr-only">
        <h1>
          {location
            ? `Homes for Sale in ${location}, Colorado`
            : "Homes for Sale in Northern Colorado"}
        </h1>
        <p>
          Search available homes for sale across Northern Colorado including Fort Collins, Loveland, Windsor, Greeley, and surrounding communities.
        </p>
      </section>
      
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

