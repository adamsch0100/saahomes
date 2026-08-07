import React, { useEffect } from "react";
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
  { name: "Longmont", slug: "longmont", description: "Boulder County access, historic downtown", price: "~$560K", label: "Median" },
  { name: "Boulder", slug: "boulder", description: "Mountain backdrop, tech & outdoor lifestyle", price: "~$950K", label: "Median" },
  { name: "Firestone", slug: "firestone", description: "Carbon Valley growth corridor", price: "~$520K", label: "Median" },
  { name: "Frederick", slug: "frederick", description: "Family-friendly Carbon Valley living", price: "~$530K", label: "Median" },
  { name: "Evans", slug: "evans", description: "Affordable Greeley neighbor", price: "~$400K", label: "Median" },
  { name: "Mead", slug: "mead", description: "Quiet Weld County growth", price: "~$540K", label: "Median" },
  { name: "Milliken", slug: "milliken", description: "Small-town Weld County value", price: "~$460K", label: "Median" },
  { name: "La Salle", slug: "la-salle", description: "Affordable Weld County living", price: "~$420K", label: "Median" },
  { name: "Niwot", slug: "niwot", description: "Boutique Boulder County village", price: "~$850K", label: "Median" },
];

/**
 * Full-screen Zillow-style search app for /properties/.
 * Page body never scrolls — only the results list (and map) scroll inside.
 * H1, city links, FAQ schema, and body copy stay in the DOM for crawlers
 * via a visually-hidden SEO layer (still crawlable HTML).
 */
export default function PropertiesPage() {
  const [searchParams] = useSearchParams();
  const location = searchParams.get("location") || "";

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("properties-search-page");
    body.classList.add("properties-search-page");
    // Lock document scroll; restore on leave
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      html.classList.remove("properties-search-page");
      body.classList.remove("properties-search-page");
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const pageTitle = location
    ? `Homes for Sale in ${location} | Northern Colorado MLS Search | SAA Homes`
    : "Homes for Sale in Northern Colorado | Fort Collins, Loveland & Windsor MLS Search | SAA Homes";

  const pageDescription = location
    ? `Browse all homes for sale in ${location}, Colorado. Updated daily from IRES MLS. SAA Homes — your Northern Colorado real estate team. Call (970) 999-1407.`
    : "Search every home for sale across Northern Colorado — Fort Collins, Loveland, Windsor, Greeley, Timnath & more. Direct IRES MLS data. Schwartz and Associates at SAA Homes.";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How can I search for homes for sale in Northern Colorado?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Use the MLS search tool above to browse all active listings across Northern Colorado. Filter by city, price, bedrooms, property type, and more. You can search Fort Collins, Loveland, Windsor, Greeley, Timnath, and all surrounding communities. The data comes directly from IRES MLS — the same database local agents use.",
        },
      },
      {
        "@type": "Question",
        name: "What is the average home price in Northern Colorado?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Northern Colorado home prices vary significantly by city. As of mid-2026, the median home price in Fort Collins is approximately $612,000, Loveland around $507,000, Windsor near $585,000, and Greeley at roughly $430,000. Newer communities like Timnath and Severance have medians in the $520,000-$625,000 range.",
        },
      },
      {
        "@type": "Question",
        name: "Which Northern Colorado city is best for home buyers?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The best city depends on your budget, commute, and lifestyle. Fort Collins offers the most amenities and job opportunities but has higher prices. Loveland provides lakefront living at a lower cost. Windsor has top-rated schools. Greeley offers the most affordable entry point. Timnath features brand-new construction. Contact SAA Homes at (970) 999-1407 for personalized guidance.",
        },
      },
      {
        "@type": "Question",
        name: "Does SAA Homes help with CHFA down payment assistance?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Schwartz and Associates helps Northern Colorado buyers navigate CHFA down payment assistance programs including FirstStep, SmartStep, Preferred, Schools To Home for educators, and the Colorado Champions program for first responders. Call (970) 999-1407 to speak with Adam or Mandi Schwartz.",
        },
      },
      {
        "@type": "Question",
        name: "How often are the MLS listings on this page updated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The property search is powered by IRES MLS and updates in real time. As soon as a listing is added, updated, or goes under contract in the MLS, it appears here. For the most accurate and current information, always use the MLS search tool above.",
        },
      },
    ],
  };

  const h1Text = location
    ? `Homes for Sale in ${location}, Colorado`
    : "Homes for Sale in Northern Colorado";

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

      {/*
        SEO crawl layer — stays in the DOM for Google/Bing (H1, city links,
        buyer resources, body copy). Visually removed from layout so the
        page never scrolls outside the full-screen search. Crawlers still
        index the text and links; FAQPage JSON-LD is in <head> via <SEO>.
      */}
      <div className="seo-crawl-layer" data-seo-layer="properties">
        <h1>{h1Text}</h1>
        <p>
          {location
            ? `Every active listing in ${location} — live from IRES MLS.`
            : "Fort Collins · Loveland · Windsor · Greeley · Timnath + all Northern Colorado communities — live from IRES MLS."}
        </p>

        <section id="cities">
          <h2>Northern Colorado Communities</h2>
          <p>
            Each community offers a distinct lifestyle and price point. Click any city below for a detailed
            neighborhood guide with schools, market data, and available listings.
          </p>
          <ul>
            {CITIES.map((city) => (
              <li key={city.slug}>
                <Link to={`/northern-colorado-areas/${city.slug}/`}>
                  {city.name} — {city.description}. {city.label} {city.price}.
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Home Buyer Resources</h2>
          <p>
            Buying a home in Northern Colorado? We&apos;ve got you covered with expert guides, CHFA programs, and
            personalized support from Adam and Mandi Schwartz.
          </p>
          <ul>
            <li>
              <Link to="/for-buyers/">Complete Buyer Guide</Link> — Step-by-step guide to buying a home in Northern Colorado — from pre-approval to closing.
            </li>
            <li>
              <Link to="/chfa-down-payment-assistance/">CHFA Down Payment Help</Link> — Up to $25,000+ in down payment assistance for qualified Northern Colorado buyers.
            </li>
            <li>
              <Link to="/contact/">Talk to an Agent</Link> — Call (970) 999-1407 for a free consultation with Adam or Mandi Schwartz.
            </li>
          </ul>
        </section>

        <section>
          <h2>About This Northern Colorado MLS Property Search</h2>
          <p>
            The property search tool on this page connects directly to <strong>IRES MLS</strong> — the same multiple listing service that
            real estate agents across Northern Colorado use to list and find homes. This means you are seeing the
            most accurate, up-to-date listing information available anywhere, including properties that may not
            appear on Zillow or Realtor.com for several hours.
          </p>
          <p>
            <strong>SAA Homes (Schwartz and Associates)</strong> serves home buyers and sellers across all of Northern Colorado,
            including{" "}
            <Link to="/northern-colorado-areas/fort-collins/">Fort Collins</Link>,{" "}
            <Link to="/northern-colorado-areas/loveland/">Loveland</Link>,{" "}
            <Link to="/northern-colorado-areas/windsor/">Windsor</Link>,{" "}
            <Link to="/northern-colorado-areas/greeley/">Greeley</Link>,{" "}
            <Link to="/northern-colorado-areas/timnath/">Timnath</Link>, and all surrounding communities.
            Whether you are searching for a starter home, a luxury estate, a lakefront property, or a new-build
            in a master-planned community, our team has the local expertise to guide you.
          </p>
          <p>
            Call <strong>(970) 999-1407</strong> or visit our{" "}
            <Link to="/contact/">contact page</Link> to schedule a confidential consultation with Adam or Mandi Schwartz.
          </p>
        </section>

        <p>
          IDX information is provided exclusively for personal, non-commercial use and may not be used for
          any purpose other than to identify prospective properties consumers may be interested in purchasing.
          All data is sourced from IRES MLS. Listing data is deemed reliable but not guaranteed. SAA Homes —
          Schwartz and Associates. Equal Housing Opportunity.
        </p>
      </div>

      {/* Full-viewport search — fills everything below the fixed header.
          Document scroll is locked; only the results list scrolls. */}
      <section
        id="search-tool"
        className="properties-search-app fixed inset-x-0 bottom-0 z-10 flex flex-col bg-white"
        style={{ top: "var(--saa-header-h, 3.5rem)" }}
        aria-label="Property search"
      >
        <div className="flex-1 min-h-0 w-full">
          <ListingSearch location={location} height="100%" />
        </div>
      </section>
    </>
  );
}
