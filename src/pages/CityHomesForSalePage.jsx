import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { photoUrl } from "../utils/photoUrl.js";
import SEO from "../components/SEO";
import { CITY_HOMES, getCityHomes, getCityHomesPath } from "../data/cityHomesData";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const fmtPrice = (n) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const fmtCompact = (n) =>
  n == null ? "—" : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.00$/, "")}M` : `$${Math.round(n / 1000)}K`;

function Card({ listing }) {
  return (
    <Link
      to={`/homes-for-sale/${listing.slug}/`}
      className="group block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-shadow"
    >
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        <img src={photoUrl(listing.id, 0)} alt={`${listing.street_name || "Home"} in ${listing.city}, CO`} loading="lazy"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/images/buyers-hero.jpg"; }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <span className="absolute bottom-2 left-2 bg-black/75 text-white text-sm font-bold px-3 py-1 rounded-lg">
          {fmtPrice(listing.list_price)}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
          <span>{listing.beds != null ? `${listing.beds} bd` : "— bd"}</span>
          <span>{listing.baths != null ? `${listing.baths} ba` : "— ba"}</span>
          <span>{listing.living_area != null ? `${Math.round(listing.living_area).toLocaleString()} sqft` : ""}</span>
        </div>
        <p className="mt-1.5 text-gray-900 font-semibold truncate">
          {[listing.street_number, listing.street_name].filter(Boolean).join(" ")}
        </p>
        <p className="text-gray-500 text-sm truncate">
          {listing.city}, CO {listing.postal_code || ""}
        </p>
      </div>
    </Link>
  );
}

function CityFaqs({ city }) {
  const faqs = [
    {
      q: `How many homes are for sale in ${city} right now?`,
      a: `The number of active listings in ${city} changes daily as homes come on the market and go under contract. This page pulls live counts straight from IRES MLS — the same database local agents use — so the total you see is current. Call SAA Homes at (970) 999-1407 for a personalized update on ${city}.`,
    },
    {
      q: `What is the median home price in ${city}?`,
      a: `The median home price in ${city} is shown live on this page, calculated from every active IRES MLS listing in the city. Medians move with the market, so check the stat above for today's number — or ask Adam and Mandi Schwartz for a neighborhood-level breakdown.`,
    },
    {
      q: `How often are the ${city} homes for sale updated?`,
      a: `Every listing on this page syncs directly from IRES MLS. As soon as a home is listed, priced, or goes under contract in the MLS, the change appears here. For the most accurate, real-time status, contact SAA Homes — we track ${city} daily.`,
    },
    {
      q: `Can SAA Homes help me buy a home in ${city}?`,
      a: `Yes. Adam and Mandi Schwartz are local agents who represent buyers across ${city} and all of Northern Colorado. We'll help you search, negotiate, and close — including navigating CHFA down payment assistance programs. Call (970) 999-1407 or visit our contact page to get started.`,
    },
    {
      q: `Can I use CHFA down payment assistance on a home in ${city}?`,
      a: `Yes — most Colorado first-time buyers in ${city} qualify for CHFA down payment assistance, including programs for teachers, first responders, and other eligible buyers. The assistance is entirely separate from the listing price. See our CHFA down payment assistance guide or call (970) 999-1407 to check your eligibility.`,
    },
  ];
  return (
    <section className="max-w-4xl mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{city} Homes for Sale — Buyer Questions</h2>
      <div className="space-y-4">
        {faqs.map((f) => (
          <details key={f.q} className="group border border-gray-200 rounded-xl bg-white p-5">
            <summary className="cursor-pointer font-semibold text-gray-900 list-none flex justify-between items-center">
              {f.q}
              <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl">+</span>
            </summary>
            <p className="mt-3 text-gray-600 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function CityHomesForSalePage() {
  const { slug } = useParams();
  const city = getCityHomes(slug);
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    const q = encodeURIComponent(city.search);
    Promise.all([
      fetch(`${API_BASE}/api/listings/stats?city=${q}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/listings?city=${q}&limit=24&sort=newest`).then((r) => r.json()),
    ])
      .then(([s, l]) => {
        setStats(s.success ? s.data : null);
        setListings(l.success ? l.data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [city]);

  if (!city) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Link to="/properties/" className="text-black underline">View all Northern Colorado homes for sale</Link>
      </div>
    );
  }

  const canonical = `https://saahomes.com${getCityHomesPath(city.slug)}`;
  const pageTitle = `${city.city} Homes for Sale | Live IRES MLS Listings | SAA Homes`;
  const pageDesc = `Browse every active home for sale in ${city.city}, ${city.county}. Live IRES MLS listings updated daily — houses, condos, townhomes & new construction. Schwartz and Associates at SAA Homes. Call (970) 999-1407.`;
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: `How many homes are for sale in ${city.city}?`, acceptedAnswer: { "@type": "Answer", text: `Active listings in ${city.city} change daily. This page pulls live counts from IRES MLS, the same database local agents use. Call SAA Homes at (970) 999-1407 for a personalized update.` } },
      { "@type": "Question", name: `What is the median home price in ${city.city}?`, acceptedAnswer: { "@type": "Answer", text: `The median home price in ${city.city} is calculated live from every active IRES MLS listing and shown on this page.` } },
      { "@type": "Question", name: `Can I use CHFA down payment assistance in ${city.city}?`, acceptedAnswer: { "@type": "Answer", text: `Yes — most first-time buyers in ${city.city} qualify for CHFA down payment assistance, including programs for teachers and first responders. See the CHFA guide on saahomes.com.` } },
    ],
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
      { "@type": "ListItem", position: 2, name: "Homes for Sale", item: "https://saahomes.com/properties/" },
      { "@type": "ListItem", position: 3, name: `${city.city} Homes for Sale`, item: canonical },
    ],
  };

  const total = stats?.total ?? listings.length;

  return (
    <>
      <SEO
        exactTitle={pageTitle}
        description={pageDesc}
        keywords={`${city.city} homes for sale, ${city.city} CO real estate, ${city.city} houses for sale, ${city.city} MLS listings, homes for sale ${city.county}, new construction ${city.city}, ${city.city} realtor`}
        canonical={canonical}
        ogImage="https://saahomes.com/images/buyers-hero.jpg"
        includeWebsite={false}
        jsonLd={[faqSchema, breadcrumbSchema]}
      />

      {/* Hero */}
      <section className="relative bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-12"
        style={{ backgroundImage: "url('/images/buyers-hero.jpg')" }}>
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 text-center text-white px-6 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight">
            {city.city} Homes for Sale
          </h1>
          <p className="mt-4 text-lg text-gray-200 max-w-3xl mx-auto">{city.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <a href={`/properties/?location=${encodeURIComponent(city.search)}`}
              className="inline-flex items-center px-6 py-3 bg-[#CFB36E] text-black font-semibold rounded-lg hover:bg-[#bd9f5a] transition-colors">
              Open Full Search & Map
            </a>
            <a href={city.areaPath}
              className="inline-flex items-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors">
              {city.city} Neighborhood Guide
            </a>
          </div>
        </div>
      </section>

      {/* Live stats strip */}
      {stats && (
        <section className="border-b border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Active listings in {city.city}</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{fmtPrice(stats.median_price)}</p>
              <p className="text-sm text-gray-500">Median list price</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {fmtCompact(stats.min_price)} – {fmtCompact(stats.max_price)}
              </p>
              <p className="text-sm text-gray-500">Price range</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.condo_townhome.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Condos & townhomes</p>
            </div>
          </div>
        </section>
      )}

      {/* Listing grid */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {loading ? "Loading listings…" : `${total.toLocaleString()} Active ${city.city} Homes for Sale`}
            </h2>
            <p className="text-gray-500 mt-1">Updated daily from IRES MLS · IDX information provided by IRES</p>
          </div>
          <a href={`/properties/?location=${encodeURIComponent(city.search)}`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-black transition-colors">
            View all {city.city} listings on the map →
          </a>
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((l) => <Card key={l.listing_id} listing={l} />)}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <p className="text-gray-700 font-semibold text-lg">
              {loading ? "Loading the latest listings…" : "No active listings right now"}
            </p>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Listings change daily — call{" "}
              <a href="tel:+19709991407" className="underline">(970) 999-1407</a>{" "}
              and we'll find homes the moment they hit the market.
            </p>
          </div>
        )}
      </section>

      {/* CHFA cross-link band */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold">Buying in {city.city}? Don't leave down payment help on the table.</h2>
            <p className="text-gray-300 mt-2 max-w-2xl">
              CHFA down payment assistance can cover up to $25,000 for eligible Colorado buyers — stack it with a
              seller concession and buy with minimal cash out of pocket. We're CHFA specialists in {city.city}.
            </p>
          </div>
          <a href="/chfa-down-payment-assistance/"
            className="shrink-0 px-6 py-3 bg-[#CFB36E] text-black font-semibold rounded-lg hover:bg-[#bd9f5a] transition-colors">
            See CHFA Programs
          </a>
        </div>
      </section>

      {/* Other cities hub-and-spoke */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Homes for Sale Across Northern Colorado</h2>
        <div className="flex flex-wrap gap-2">
          {CITY_HOMES.filter((c) => c.slug !== city.slug).map((c) => (
            <Link key={c.slug} to={getCityHomesPath(c.slug)}
              className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm hover:border-black hover:bg-gray-50 transition-colors">
              {c.city} homes for sale
            </Link>
          ))}
        </div>
      </section>

      <CityFaqs city={city.city} />
    </>
  );
}
