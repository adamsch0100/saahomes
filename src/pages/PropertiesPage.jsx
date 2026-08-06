import React from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import ListingSearch from "../components/ListingSearch";

const CITIES = [
  { name: "Fort Collins", slug: "fort-collins", description: "CSU, craft breweries, mountain views", price: "~$612K", label: "Median" },
  { name: "Loveland", slug: "loveland", description: "Lakefront living, arts scene, I-25 access", price: "~$507K", label: "Median" },
  { name: "Windsor", slug: "windsor", description: "Top schools, new construction, golf", price: "~$585K", label: "Median" },
  { name: "Greeley", slug: "greeley", description: "Most affordable, growing job base", price: "~$430K", label: "Median" },
  { name: "Timnath", slug: "timnath", description: "New master-planned I-25 corridor", price: "~$625K", label: "Median" },
  { name: "Severance", slug: "severance", description: "Small-town feel, new construction", price: "~$520K", label: "Median" },
  { name: "Berthoud", slug: "berthoud", description: "Historic charm at the foothills", price: "~$575K", label: "Median" },
  { name: "Johnstown", slug: "johnstown", description: "Affordable I-25 corridor access", price: "~$495K", label: "Median" },
  { name: "Wellington", slug: "wellington", description: "Quiet Larimer County living", price: "~$510K", label: "Median" },
  { name: "Eaton", slug: "eaton", description: "Weld County small-town value", price: "~$450K", label: "Median" },
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

      {/* Compact title strip — search is the star, H1 stays for SEO */}
      <section className="bg-white border-b border-gray-200 pt-24 sm:pt-28">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-serif">
            {location ? `Homes for Sale in ${location}, Colorado` : "Homes for Sale in Northern Colorado"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {location
              ? `Every active listing in ${location} — live from IRES MLS.`
              : "Fort Collins · Loveland · Windsor · Greeley · Timnath + all Northern Colorado communities — live from IRES MLS."}
          </p>
        </div>
      </section>

      {/* MLS Search — immersive Zillow-style split view, the whole page */}
      <section id="search-tool" className="w-full bg-white">
        <div className="max-w-[1600px] mx-auto">
          <div className="border-t border-gray-200" style={{ height: "calc(100vh - 130px)", minHeight: "560px" }}>
            <ListingSearch location={location} height="100%" />
          </div>
        </div>
      </section>

      {/* City-by-city guide */}
      <section id="cities" className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Northern Colorado Communities</h2>
        <p className="text-gray-600 mb-8 max-w-3xl">
          Each community offers a distinct lifestyle and price point. Click any city below for a detailed
          neighborhood guide with schools, market data, and available listings.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {CITIES.map((city) => (
            <Link
              key={city.slug}
              to={`/northern-colorado-areas/${city.slug}/`}
              className="block p-5 border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition-all bg-white"
            >
              <h3 className="font-semibold text-gray-900">{city.name}</h3>
              <p className="text-gray-500 text-sm mt-1 leading-snug">{city.description}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-lg font-bold text-gray-900">{city.price}</span>
                <span className="text-xs text-gray-400">{city.label}</span>
              </div>
              <span className="text-[#CFB36E] text-sm font-medium mt-2 inline-block hover:underline">
                Browse homes &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Buyer resources */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Home Buyer Resources</h2>
          <p className="text-gray-600 mb-8 max-w-3xl">
            Buying a home in Northern Colorado? We've got you covered with expert guides, CHFA programs, and
            personalized support from Adam and Mandi Schwartz.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link to="/for-buyers/" className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition-all">
              <div className="text-3xl mb-3">📖</div>
              <h3 className="font-semibold text-gray-900 text-lg">Complete Buyer Guide</h3>
              <p className="text-gray-600 text-sm mt-2">Step-by-step guide to buying a home in Northern Colorado — from pre-approval to closing.</p>
            </Link>
            <Link to="/chfa-down-payment-assistance/" className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition-all">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="font-semibold text-gray-900 text-lg">CHFA Down Payment Help</h3>
              <p className="text-gray-600 text-sm mt-2">Up to $25,000+ in down payment assistance for qualified Northern Colorado buyers.</p>
            </Link>
            <Link to="/contact/" className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition-all">
              <div className="text-3xl mb-3">📞</div>
              <h3 className="font-semibold text-gray-900 text-lg">Talk to an Agent</h3>
              <p className="text-gray-600 text-sm mt-2">Call (970) 999-1407 for a free consultation with Adam or Mandi Schwartz.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* SEO body text */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-gray-700 leading-relaxed">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">About This Northern Colorado MLS Property Search</h2>
        <p className="mb-4">
          The property search tool on this page connects directly to <strong>IRES MLS</strong> — the same multiple listing service that
          real estate agents across Northern Colorado use to list and find homes. This means you are seeing the
          most accurate, up-to-date listing information available anywhere, including properties that may not
          appear on Zillow or Realtor.com for several hours.
        </p>
        <p className="mb-4">
          <strong>SAA Homes (Schwartz and Associates)</strong> serves home buyers and sellers across all of Northern Colorado,
          including{" "}
          <Link to="/northern-colorado-areas/fort-collins/" className="text-[#CFB36E] hover:underline">Fort Collins</Link>,{" "}
          <Link to="/northern-colorado-areas/loveland/" className="text-[#CFB36E] hover:underline">Loveland</Link>,{" "}
          <Link to="/northern-colorado-areas/windsor/" className="text-[#CFB36E] hover:underline">Windsor</Link>,{" "}
          <Link to="/northern-colorado-areas/greeley/" className="text-[#CFB36E] hover:underline">Greeley</Link>,{" "}
          <Link to="/northern-colorado-areas/timnath/" className="text-[#CFB36E] hover:underline">Timnath</Link>, and all surrounding communities.
          Whether you are searching for a starter home, a luxury estate, a lakefront property, or a new-build
          in a master-planned community, our team has the local expertise to guide you.
        </p>
        <p>
          Call <strong className="text-gray-900">(970) 999-1407</strong> or visit our{" "}
          <Link to="/contact/" className="text-[#CFB36E] hover:underline">contact page</Link> to schedule a
          confidential consultation with Adam or Mandi Schwartz.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
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
