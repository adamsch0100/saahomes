import React from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import PropertySearchEmbed from "../components/PropertySearchEmbed";

const CITIES = [
  { name: "Fort Collins", slug: "fort-collins", description: "Colorado State University's home, craft breweries, and mountain views — median ~$612K" },
  { name: "Loveland", slug: "loveland", description: "Lakefront living, sculpture parks, and easy I-25 access — median ~$507K" },
  { name: "Windsor", slug: "windsor", description: "Top-rated schools, new construction, Pelican Lakes — median ~$585K" },
  { name: "Greeley", slug: "greeley", description: "Most affordable entry point, growing job base, UNC — median ~$430K" },
  { name: "Timnath", slug: "timnath", description: "Newest master-planned communities on the I-25 corridor — median ~$625K" },
  { name: "Severance", slug: "severance", description: "Small-town feel with new construction — median ~$520K" },
  { name: "Berthoud", slug: "berthoud", description: "Historic charm at the foot of the mountains — median ~$575K" },
  { name: "Johnstown", slug: "johnstown", description: "Affordable I-25 corridor access — median ~$495K" },
  { name: "Wellington", slug: "wellington", description: "Quiet northern Larimer County living — median ~$510K" },
  { name: "Eaton", slug: "eaton", description: "Weld County small-town value — median ~$450K" },
];

export default function PropertiesPage() {
  const [searchParams] = useSearchParams();
  const location = searchParams.get('location') || '';

  const pageTitle = location
    ? `Homes for Sale in ${location} | Northern Colorado MLS Search | SAA Homes`
    : "Homes for Sale in Northern Colorado | Fort Collins, Loveland & Windsor MLS Search | SAA Homes";

  const pageDescription = location
    ? `Browse all homes for sale in ${location}, Colorado. Updated daily from IRES MLS. SAA Homes — your Northern Colorado real estate team. Call (970) 999-1407.`
    : "Search every home for sale across Northern Colorado — Fort Collins, Loveland, Windsor, Greeley, Timnath & more. Direct IRES MLS data. Schwartz and Associates at SAA Homes.";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How can I search for homes for sale in Northern Colorado?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Use the MLS search tool above to browse all active listings across Northern Colorado. Filter by city, price, bedrooms, property type, and more. You can search Fort Collins, Loveland, Windsor, Greeley, Timnath, and all surrounding communities. The data comes directly from IRES MLS — the same database local agents use."
        }
      },
      {
        "@type": "Question",
        "name": "What is the average home price in Northern Colorado?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Northern Colorado home prices vary significantly by city. As of mid-2026, the median home price in Fort Collins is approximately $612,000, Loveland around $507,000, Windsor near $585,000, and Greeley at roughly $430,000. Newer communities like Timnath and Severance have medians in the $520,000-$625,000 range."
        }
      },
      {
        "@type": "Question",
        "name": "Which Northern Colorado city is best for home buyers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The best city depends on your budget, commute, and lifestyle. Fort Collins offers the most amenities and job opportunities but has higher prices. Loveland provides lakefront living at a lower cost. Windsor has top-rated schools. Greeley offers the most affordable entry point. Timnath features brand-new construction. Contact SAA Homes at (970) 999-1407 for personalized guidance."
        }
      },
      {
        "@type": "Question",
        "name": "Does SAA Homes help with CHFA down payment assistance?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Schwartz and Associates helps Northern Colorado buyers navigate CHFA down payment assistance programs including FirstStep, SmartStep, Preferred, Schools To Home for educators, and the Colorado Champions program for first responders. Call (970) 999-1407 to speak with Adam or Mandi Schwartz."
        }
      },
      {
        "@type": "Question",
        "name": "How often are the MLS listings on this page updated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The property search is powered by IRES MLS and updates in real time. As soon as a listing is added, updated, or goes under contract in the MLS, it appears here. For the most accurate and current information, always use the MLS search tool above."
        }
      }
    ]
  };

  return (
    <>
      <SEO
        exactTitle={pageTitle}
        description={pageDescription}
        keywords="homes for sale Northern Colorado, Colorado MLS listings, Fort Collins real estate, Loveland homes for sale, Windsor CO properties, Greeley houses, Timnath new construction, Northern Colorado real estate search, IRES MLS Colorado, SAA Homes property search"
        canonical="https://saahomes.com/properties/"
        ogImage="https://saahomes.com/images/buyers-hero.jpg"
        includeWebsite={true}
        jsonLd={[faqSchema]}
      />

      {/* Visible heading for accessibility and search engines */}
      <section className="max-w-6xl mx-auto px-4 pt-8 pb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          {location
            ? `Homes for Sale in ${location}, Colorado`
            : "Homes for Sale in Northern Colorado — MLS Search"}
        </h1>
        <p className="text-lg text-gray-600 max-w-4xl">
          {location
            ? `Browse every active listing in ${location} directly from IRES MLS. Updated in real time — find your perfect home with Schwartz and Associates at SAA Homes.`
            : "Search every active listing across Fort Collins, Loveland, Windsor, Greeley, Timnath, and all Northern Colorado communities. Data feeds directly from IRES MLS — the same database local real estate agents use. Updated in real time."}
        </p>

        {/* City quick links */}
        <div className="flex flex-wrap gap-2 mt-4">
          {CITIES.map((city) => (
            <Link
              key={city.slug}
              to={`/northern-colorado-areas/${city.slug}/`}
              className="text-sm bg-gray-100 hover:bg-brand-gold hover:text-white px-3 py-1.5 rounded-full transition-colors text-gray-700"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>

      {/* MLS Search Iframe */}
      <section className="w-full px-4 pb-4">
        <div className="max-w-7xl mx-auto border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
            <span className="w-3 h-3 rounded-full bg-green-400"></span>
            <span className="ml-3 text-sm text-gray-500 font-mono">
              IRES MLS — Real-time Listings
            </span>
          </div>
          <div className="bg-white" style={{ minHeight: '700px' }}>
            <PropertySearchEmbed location={location} height="700px" />
          </div>
        </div>
      </section>

      {/* City-by-city guide */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Northern Colorado Real Estate by City</h2>
        <p className="text-gray-600 mb-8 max-w-3xl">
          Each Northern Colorado community offers a distinct lifestyle, price point, and market dynamic.
          Click any city below for a detailed neighborhood guide with schools, market data, and available listings.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CITIES.map((city) => (
            <Link
              key={city.slug}
              to={`/northern-colorado-areas/${city.slug}/`}
              className="block p-5 border border-gray-200 rounded-lg hover:border-brand-gold hover:shadow-md transition-all"
            >
              <h3 className="font-semibold text-gray-900 text-lg">{city.name}</h3>
              <p className="text-gray-600 text-sm mt-1">{city.description}</p>
              <span className="text-brand-gold text-sm font-medium mt-2 inline-block">
                Browse homes →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Buyer resources */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Northern Colorado Home Buyer Resources</h2>
          <p className="text-gray-600 mb-8 max-w-3xl">
            Buying a home in Northern Colorado? We've got you covered with expert guides, CHFA programs, and
            personalized support from Adam and Mandi Schwartz.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Link to="/for-buyers/" className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-brand-gold transition-all">
              <h3 className="font-semibold text-gray-900">📖 Complete Buyer Guide</h3>
              <p className="text-gray-600 text-sm mt-2">Step-by-step guide to buying a home in Northern Colorado — from pre-approval to closing.</p>
            </Link>
            <Link to="/chfa-down-payment-assistance/" className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-brand-gold transition-all">
              <h3 className="font-semibold text-gray-900">💰 CHFA Down Payment Help</h3>
              <p className="text-gray-600 text-sm mt-2">Up to $25,000+ in down payment assistance for qualified Northern Colorado buyers.</p>
            </Link>
            <Link to="/contact/" className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-brand-gold transition-all">
              <h3 className="font-semibold text-gray-900">📞 Talk to an Agent</h3>
              <p className="text-gray-600 text-sm mt-2">Call (970) 999-1407 for a free consultation with Adam or Mandi Schwartz.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* SEO body text */}
      <section className="max-w-4xl mx-auto px-4 py-12 text-gray-700 leading-relaxed">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Northern Colorado MLS Property Search</h2>
        <p className="mb-4">
          The property search tool above connects directly to IRES MLS — the same multiple listing service that
          real estate agents across Northern Colorado use to list and find homes. This means you are seeing the
          most accurate, up-to-date listing information available anywhere, including properties that may not
          appear on Zillow or Realtor.com for several hours.
        </p>
        <p className="mb-4">
          SAA Homes (Schwartz and Associates) serves home buyers and sellers across all of Northern Colorado,
          including <Link to="/northern-colorado-areas/fort-collins/" className="text-brand-gold hover:underline">Fort Collins</Link>,
          <Link to="/northern-colorado-areas/loveland/" className="text-brand-gold hover:underline"> Loveland</Link>,
          <Link to="/northern-colorado-areas/windsor/" className="text-brand-gold hover:underline"> Windsor</Link>,
          <Link to="/northern-colorado-areas/greeley/" className="text-brand-gold hover:underline"> Greeley</Link>,
          <Link to="/northern-colorado-areas/timnath/" className="text-brand-gold hover:underline"> Timnath</Link>, and all surrounding communities.
          Whether you are searching for a starter home, a luxury estate, a lakefront property, or a new-build
          in a master-planned community, our team has the local expertise to guide you.
        </p>
        <p>
          Call <strong className="text-gray-900">(970) 999-1407</strong> or visit our{" "}
          <Link to="/contact/" className="text-brand-gold hover:underline">contact page</Link> to schedule a
          confidential consultation with Adam or Mandi Schwartz. With over 20 years of combined experience
          in Northern Colorado real estate, we help buyers and sellers achieve their goals with integrity,
          market insight, and world-class service.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <p className="text-xs text-gray-400 leading-relaxed">
          IDX information is provided exclusively for personal, non-commercial use and may not be used for
          any purpose other than to identify prospective properties consumers may be interested in purchasing.
          All data is sourced from IRES MLS. Listing data is deemed reliable but not guaranteed. SAA Homes —
          Schwartz and Associates. Equal Housing Opportunity.
        </p>
      </section>
    </>
  );
}
