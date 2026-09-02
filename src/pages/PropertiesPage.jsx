import React, { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import SEO from "../components/SEO";
import ListingSearch from "../components/ListingSearch";
import { useTenant } from "../context/TenantContext.jsx";

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
  { name: "Estes Park", slug: "estes-park", description: "Rocky Mountain National Park gateway — second homes and full-time living" },
  { name: "Lyons", slug: "lyons", description: "Boulder foothills mountain town on the St. Vrain" },
  { name: "Bellvue", slug: "bellvue", description: "Poudre Canyon and acreage living northwest of Fort Collins" },
  { name: "Red Feather Lakes", slug: "red-feather-lakes", description: "Cabin and lake living — affordable mountain entry northwest of Fort Collins" },
  { name: "Erie", slug: "erie", description: "Denver-exurb growth between Boulder and Longmont" },
  { name: "Brighton", slug: "brighton", description: "North Denver / I-76 corridor living" },
  { name: "Fort Lupton", slug: "fort-lupton", description: "Affordable Weld County small-town living" },
  { name: "Carbon Valley", slug: "carbon-valley", description: "Firestone, Frederick, Dacono & surrounding communities" },
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
  const { tenant } = useTenant();
  const tenantTitle = tenant?.brand?.brandName
    ? `${tenant.brand.brandName} — ${
        location ? `Homes for Sale in ${location}` : "Homes for Sale in Northern Colorado"
      }`
    : null;

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
      {tenantTitle ? (
        <Helmet>
          <title>{tenantTitle}</title>
        </Helmet>
      ) : null}

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
                  {city.name} — {city.description}
                  {city.price ? `. ${city.label} ${city.price}` : ""}.
                </Link>
              </li>
            ))}
          </ul>
          <p>
            <Link to="/properties/?city=__all__">Search all of Colorado</Link>
            {" "}— browse live MLS listings statewide (Denver, Aurora, Colorado Springs, and every city in our IRES feed), while our neighborhood guides stay focused on Northern Colorado.
          </p>
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

        <section>
          <h2>Northern Colorado Market Overview — Summer 2026</h2>
          <p>
            Northern Colorado&apos;s real estate market spans Larimer, Weld, and Boulder counties, each with distinct
            price points and dynamics. Fort Collins remains the region&apos;s most expensive major market with a July 2026
            median of approximately $610,000 for single-family homes, while Greeley offers the most affordable entry at
            roughly $432,000. Loveland and Windsor sit in between — around $510,000 and $588,000 respectively — making
            them popular mid-range options for buyers relocating from the Denver metro area.
          </p>
          <p>
            Across all cities, inventory has grown roughly 12&ndash;15% compared to summer 2025, giving buyers more
            choices than they&apos;ve had since early 2022. The &ldquo;sweet spot&rdquo; price range of
            $400,000&ndash;$550,000 remains the most competitive, especially in Greeley, Loveland, and Windsor. Homes
            in this range with good condition and location typically go under contract within 15&ndash;25 days, while
            luxury properties above $750,000 can take 55&ndash;70 days on market.
          </p>
          <p>
            First-time buyers should explore{' '}
            <Link to="/chfa-down-payment-assistance/">CHFA down payment assistance</Link>{' '}
            programs, which cap purchase prices at $500,000 in Larimer County and $475,000 in Weld County as of 2026.
            Educators can access the{' '}
            <Link to="/chfa-schools-to-home/">Schools to Home</Link> program with
            reduced interest rates, and first responders, military members, and healthcare workers may qualify for the{' '}
            <Link to="/colorado-champions-home-loan-program/">Colorado Champions</Link> program with
            significant rate discounts.
          </p>
        </section>

        <section>
          <h2>Why Work With Schwartz and Associates for Your Home Search</h2>
          <p>
            Adam and Mandi Schwartz have spent over 20 years helping families buy and sell homes across Fort Collins,
            Loveland, Windsor, Greeley, and the entire Northern Colorado region. Unlike large corporate real estate teams
            where you talk to a different person every time, Schwartz and Associates gives you direct access to the same
            husband-and-wife team from first conversation through closing day.
          </p>
          <p>
            Every buyer who works with us gets a personalized home search strategy, access to off-market and coming-soon
            listings before they hit the public feeds, and expert guidance through CHFA down payment assistance, VA loans,
            and conventional financing. We know every school boundary, HOA policy, and neighborhood character in the
            27 communities we serve — because we visit them regularly and represent buyers and sellers in each one.
          </p>
          <p>
            Ready to start your Northern Colorado home search? Call <strong>(970) 999-1407</strong> to speak with Adam
            or Mandi directly, or fill out our{' '}
            <Link to="/contact/">contact form</Link> and we will reach out within one business day.
          </p>
        </section>

        <section>
          <h2>City-by-City Comparison: Northern Colorado Home Prices &amp; Market Stats</h2>
          <table>
            <thead>
              <tr>
                <th>City</th>
                <th>County</th>
                <th>July 2026 Median Price</th>
                <th>YoY Change</th>
                <th>Avg Days on Market</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Fort Collins</td><td>Larimer</td><td>$610,000</td><td>+2.5%</td><td>40</td></tr>
              <tr><td>Loveland</td><td>Larimer</td><td>$510,000</td><td>+3.6%</td><td>22</td></tr>
              <tr><td>Windsor</td><td>Weld / Larimer</td><td>$588,000</td><td>+2.1%</td><td>25-35</td></tr>
              <tr><td>Greeley</td><td>Weld</td><td>$432,000</td><td>flat</td><td>10-14</td></tr>
              <tr><td>Timnath</td><td>Larimer / Weld</td><td>$625,000</td><td>+3.8%</td><td>30-45</td></tr>
              <tr><td>Severance</td><td>Weld</td><td>$520,000</td><td>+4.2%</td><td>20-30</td></tr>
              <tr><td>Berthoud</td><td>Larimer</td><td>$575,000</td><td>+2.8%</td><td>25-35</td></tr>
              <tr><td>Johnstown</td><td>Weld</td><td>$495,000</td><td>+3.0%</td><td>25-35</td></tr>
              <tr><td>Wellington</td><td>Larimer</td><td>$510,000</td><td>+2.5%</td><td>30-40</td></tr>
              <tr><td>Eaton</td><td>Weld</td><td>$450,000</td><td>+3.8%</td><td>20-30</td></tr>
              <tr><td>Longmont</td><td>Boulder</td><td>$560,000</td><td>+1.5%</td><td>30-40</td></tr>
              <tr><td>Boulder</td><td>Boulder</td><td>$950,000</td><td>+2.0%</td><td>45-60</td></tr>
              <tr><td>Firestone</td><td>Weld</td><td>$520,000</td><td>+3.5%</td><td>20-30</td></tr>
              <tr><td>Frederick</td><td>Weld</td><td>$530,000</td><td>+4.0%</td><td>20-30</td></tr>
              <tr><td>Evans</td><td>Weld</td><td>$400,000</td><td>+2.0%</td><td>15-25</td></tr>
              <tr><td>Milliken</td><td>Weld</td><td>$460,000</td><td>+3.0%</td><td>20-30</td></tr>
              <tr><td>Mead</td><td>Weld</td><td>$540,000</td><td>+3.2%</td><td>25-35</td></tr>
            </tbody>
          </table>
          <p>
            Prices are approximate July 2026 medians for single-family homes. Days on market vary by price range, condition, and location within each city. Contact SAA Homes at <strong>(970) 999-1407</strong> for current market data tailored to your specific neighborhood and price point.
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
