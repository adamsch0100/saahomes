import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import GHopeLeadForm from "../components/GHopeLeadForm";
import ChfaResourceHub from "../components/ChfaResourceHub";

const GOLD = "#CFB36E";
const PAGE_URL = "https://saahomes.com/greeley-g-hope-down-payment-assistance/";
const OFFICIAL_URL = "https://greeleyco.gov/residents/resources/housing-solutions/";
const ZONE_MAP = "/images/G-HOPE-Greeley-Zone-Map.png";

const incentiveZones = [
  {
    zone: "Zone 1",
    amount: "$8,000",
    headline: "East of 8th Avenue",
    boundaries: "Generally east of 8th Ave, north toward D St, extending toward US Hwy 85 and south toward E 18th St.",
    landmarks: "Jefferson High School area, eastern Greeley neighborhoods",
    highlight: true,
  },
  {
    zone: "Zone 2",
    amount: "$6,000",
    headline: "Between 8th & 14th Avenues",
    boundaries: "West of 8th Ave and east of 14th Ave — the central corridor north of US Hwy 34 toward D St.",
    landmarks: "University of Northern Colorado (UNC) campus, Greeley-Evans Alternative Program area",
  },
  {
    zone: "Zone 3",
    amount: "$4,000",
    headline: "West of 14th Avenue (to 23rd)",
    boundaries: "West of 14th Ave and east of 23rd Ave, from central Greeley south toward US Hwy 34.",
    landmarks: "North Colorado Medical Center, Heath Middle School, established residential blocks",
  },
  {
    zone: "Zone 4",
    amount: "$2,500",
    headline: "Outlying eligible areas",
    boundaries: "Three sections: northwest & southwest between 23rd & 35th Ave, plus southeast east of US Hwy 85.",
    landmarks: "Franklin Middle School, Brentwood Middle / Greeley West HS area, Balsam Sports Complex",
  },
];

const eligibilityRequirements = [
  {
    title: "Single-family homes only",
    detail: "The purchased property must be a single-family home — not a condo, townhome, or multi-unit rental investment.",
  },
  {
    title: "East of 35th Avenue in Greeley",
    detail: "The home must be located within the G-HOPE program area east of 35th Avenue inside Greeley city limits. Your exact incentive tier depends on which of the four zones the property falls in.",
  },
  {
    title: "Full-time employee at closing",
    detail: "You must be a full-time employee at the time of closing. Your employer must be based within the program's geographic boundaries.",
  },
  {
    title: "Primary residence only",
    detail: "The home must be your primary residence. You may not use the property as a rental or investment.",
  },
  {
    title: "Qualify for a mortgage",
    detail: "You must qualify for a conventional or government home loan through an approved lender.",
  },
  {
    title: "$1,000 minimum contribution",
    detail: "You must contribute at least $1,000 of your own funds toward the purchase.",
  },
  {
    title: "No first-time buyer requirement",
    detail: "Unlike many programs, G-HOPE does not require first-time homebuyer status.",
  },
  {
    title: "No income limits",
    detail: "There are no income limits on homebuyers for the G-HOPE program.",
  },
];

const forgivenessTimeline = [
  { year: 1, percent: "20%", cumulative: "20% forgiven", note: "End of year one as primary resident" },
  { year: 2, percent: "20%", cumulative: "40% forgiven", note: "Two full years of occupancy" },
  { year: 3, percent: "20%", cumulative: "60% forgiven", note: "Three full years of occupancy" },
  { year: 4, percent: "20%", cumulative: "80% forgiven", note: "Four full years of occupancy" },
  { year: 5, percent: "20%", cumulative: "100% forgiven", note: "Loan fully forgiven after five years" },
];

const programCompare = [
  { feature: "Administered by", ghope: "City of Greeley Housing Solutions", chfa: "Colorado Housing & Finance Authority" },
  { feature: "Maximum assistance", ghope: "Up to $8,000 (zone-based)", chfa: "Up to $25,000 grant or deferred loan" },
  { feature: "Income limits", ghope: "None", chfa: "County-specific limits apply" },
  { feature: "First-time buyer required", ghope: "No", chfa: "Often yes (varies by program)" },
  { feature: "Geographic focus", ghope: "Greeley east of 35th Ave", chfa: "Statewide (Weld & Larimer County)" },
  { feature: "Employer requirement", ghope: "Full-time Greeley-area employee", chfa: "None" },
  { feature: "Forgiveness", ghope: "20% per year over 5 years", chfa: "Grant: none; 2nd mortgage: deferred until sale/refi" },
];

const steps = [
  {
    step: "1",
    title: "Contact Housing Solutions",
    description: "Reach out to Greeley Housing Solutions to confirm your employment and property eligibility before you write an offer.",
    link: "mailto:housinginfo@greeleygov.com",
    linkText: "housinginfo@greeleygov.com",
    external: true,
  },
  {
    step: "2",
    title: "Get mortgage pre-approved",
    description: "Qualify for a conventional or government loan. Your lender will coordinate program paperwork at closing.",
    link: "/for-buyers/",
    linkText: "Buyer resources",
    internal: true,
  },
  {
    step: "3",
    title: "Shop within your target zone",
    description: "Use the zone map to focus your search. Higher incentives in Zone 1 (east of 8th) can meaningfully reduce your cash to close.",
    link: "#g-hope-zones",
    linkText: "View zone map",
    internal: true,
    anchor: true,
  },
  {
    step: "4",
    title: "Partner with a local REALTOR®",
    description: "SAA Homes helps you identify qualifying single-family listings, structure offers, and close — while the city administers the assistance.",
    link: "#g-hope-lead-form",
    linkText: "Request local guidance",
    internal: true,
    anchor: true,
  },
];

const faqs = [
  {
    q: "What is the G-HOPE program in Greeley?",
    a: "G-HOPE (Greeley Home Ownership Program for Employees) is a City of Greeley down payment assistance program for full-time employees whose employer is based within the program area. Assistance ranges from $2,500 to $8,000 depending on which of four geographic zones you purchase in — all east of 35th Avenue within Greeley.",
  },
  {
    q: "How much down payment help can I get in each zone?",
    a: "Zone 1 (east of 8th Avenue): up to $8,000. Zone 2 (between 8th and 14th Avenues): up to $6,000. Zone 3 (west of 14th Avenue): up to $4,000. Zone 4 (outlying eligible areas): up to $2,500. The city confirms your exact amount based on the property address.",
  },
  {
    q: "Do I have to be a first-time homebuyer for G-HOPE?",
    a: "No. G-HOPE does not require first-time buyer status and has no income limits — a significant advantage over many state and federal programs.",
  },
  {
    q: "How does the 5-year loan forgiveness work?",
    a: "G-HOPE provides a deferred down payment loan, not a grant. Each full year you occupy the home as your primary residence, 20% of the loan is forgiven. After five years, the entire assistance amount is forgiven if you remain eligible.",
  },
  {
    q: "What employers qualify for G-HOPE?",
    a: "You must be a full-time employee at closing, and your employer must be based within the program's geographic boundaries. This includes City of Greeley employees, UNC staff, healthcare workers at North Colorado Medical Center, and many other Greeley-area employers. Confirm with Housing Solutions.",
  },
  {
    q: "Can I combine G-HOPE with CHFA down payment assistance?",
    a: "Program stacking depends on lender guidelines and city rules. Many buyers explore G-HOPE, CHFA, or both with their loan officer. SAA Homes can help you understand options — final eligibility is determined by the city and your lender.",
  },
  {
    q: "Are there bonus incentives in redevelopment or university districts?",
    a: "Yes. The City of Greeley notes that additional funds may be available for purchases within established redevelopment and university districts. Contact Housing Solutions for current details.",
  },
  {
    q: "What is Housing for All?",
    a: "G-HOPE is a priority under Housing for All, a focus area of Greeley City Council's Community Vision 2037. The program supports workforce housing in central neighborhoods to reduce commute time and cost for people who work in Greeley.",
  },
  {
    q: "Who administers G-HOPE?",
    a: "Greeley's Housing Solutions Department administers G-HOPE and federal HUD grants including Community Development Block Grant (CDBG) and HOME Investment Partnership funds. SAA Homes is an independent real estate brokerage — we help buyers find qualifying homes and navigate the purchase.",
  },
];

export default function GHopeHomeLoanPage() {
  return (
    <>
      <SEO
        exactTitle="G-HOPE Greeley Down Payment Assistance | Zone Map & Employee Homebuyer Guide 2026 | Schwartz and Associates"
        description="Complete G-HOPE guide for Greeley employees: zone map with $8K, $6K, $4K & $2,500 incentives east of 35th Avenue. No income limits, no first-time buyer requirement. Free consultation from Schwartz and Associates."
        keywords="G-HOPE Greeley, G-HOPE zone map, Greeley down payment assistance, Greeley employee homebuyer program, Zone 1 8th Avenue Greeley, UNC employee home buying, Greeley Housing Solutions, City of Greeley G-HOPE, Weld County down payment help"
        canonical={PAGE_URL}
        ogImage={`https://saahomes.com${ZONE_MAP}`}
        ogUrl={PAGE_URL}
        includeLocalBusiness={true}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "G-HOPE Greeley Down Payment Assistance — Complete Zone Guide",
            description: "Guide to the City of Greeley G-HOPE employee home ownership down payment assistance program with zone map and eligibility details.",
            url: PAGE_URL,
            primaryImageOfPage: { "@type": "ImageObject", url: `https://saahomes.com${ZONE_MAP}` },
            about: {
              "@type": "GovernmentService",
              name: "Greeley Home Ownership Program for Employees (G-HOPE)",
              serviceArea: { "@type": "City", name: "Greeley, Colorado" },
              provider: { "@type": "GovernmentOrganization", name: "City of Greeley Housing Solutions" },
              url: OFFICIAL_URL,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "How to use the G-HOPE down payment assistance program in Greeley",
            description: "Steps for Greeley-area employees to access G-HOPE down payment loan assistance.",
            step: steps.map((s, i) => ({
              "@type": "HowToStep",
              position: i + 1,
              name: s.title,
              text: s.description,
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "G-HOPE Incentive Zones",
            itemListElement: incentiveZones.map((z, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${z.zone}: ${z.amount} — ${z.headline}`,
              description: z.boundaries,
            })),
          },
        ]}
      />

      {/* Hero */}
      <section
        className="relative min-h-[min(100svh,720px)] sm:min-h-[560px] bg-cover bg-center flex items-end sm:items-center justify-center pt-28 sm:pt-32 pb-16 sm:pb-20"
        style={{ backgroundImage: "url('/images/Area-Guide-for-Greeley-CO.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/55" />
        <div className="relative z-10 max-w-5xl mx-auto text-center text-white px-4 sm:px-6 w-full">
          <span
            className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase"
            style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
          >
            City of Greeley · Housing for All
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-tight">
            G-HOPE Down Payment Assistance
          </h1>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto text-gray-100 leading-relaxed">
            Up to <strong>$8,000</strong> in forgivable down payment help for full-time Greeley-area employees buying east of 35th Avenue.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <a
              href="#g-hope-lead-form"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation shadow-lg"
            >
              Free G-HOPE Consultation
            </a>
            <a
              href="#g-hope-zones"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
            >
              View Zone Map
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-black text-white py-8 px-6 border-b border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {[
            { value: "$8,000", label: "Maximum incentive (Zone 1)" },
            { value: "No limits", label: "Income limits on buyers" },
            { value: "$1,000", label: "Minimum buyer contribution" },
            { value: "5 years", label: "Full loan forgiveness timeline" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl sm:text-4xl font-bold font-serif" style={{ color: GOLD }}>{stat.value}</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Intro + form */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
              Greeley Employee Homebuyer Guide
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              What is G-HOPE?
            </h2>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              <strong>G-HOPE</strong> (Greeley Home Ownership Program for Employees) is administered by the{" "}
              <strong>City of Greeley Housing Solutions Department</strong> — the same team that manages federal HUD grants
              including Community Development Block Grant (CDBG) and HOME Investment Partnership funds.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              The program incentivizes home purchases in central Greeley neighborhoods <strong>east of 35th Avenue</strong>,
              helping workforce employees live closer to where they work. Assistance is structured as a{" "}
              <strong>deferred down payment loan</strong> from $2,500 to $8,000 depending on your purchase zone — forgiven
              at 20% per year over five years of primary residency.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              G-HOPE is a priority under <em>Housing for All</em>, part of Greeley City Council&apos;s Community Vision 2037.
              Whether you work for the city,{" "}
              <a href="https://www.unco.edu/" target="_blank" rel="noopener noreferrer" className="text-black font-semibold hover:underline">UNC</a>,
              healthcare, or another Greeley-area employer, this program can make buying in{" "}
              <Link to="/northern-colorado-areas/greeley/" className="text-black font-semibold hover:underline">Greeley</Link>{" "}
              significantly more affordable — especially compared to programs with strict income caps.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-sm text-gray-700">
              <p className="font-semibold text-gray-900 mb-1">Official program source</p>
              <p>
                Details summarized from the{" "}
                <a href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                  City of Greeley Housing Solutions
                </a>{" "}
                page. Eligibility and funding are determined solely by the city. Schwartz and Associates is not affiliated with the City of Greeley.
              </p>
            </div>
          </div>
          <div className="lg:col-span-2 lg:sticky lg:top-28 scroll-mt-28">
            <GHopeLeadForm compact />
          </div>
        </div>
      </section>

      {/* Zone map — centerpiece */}
      <section id="g-hope-zones" className="py-16 sm:py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
              G-HOPE Geographic Boundaries
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
              Four incentive zones east of 35th Avenue
            </h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              The map below shows the four eligible zones for the G-HOPE program. Your incentive amount depends on
              where within Greeley you buy — not just whether you qualify for the program overall.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-12">
            <div className="px-6 py-4 bg-gray-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="font-bold font-serif text-lg">Official G-HOPE zone map</h3>
              <p className="text-gray-400 text-sm">City of Greeley · Housing Solutions</p>
            </div>
            <div className="p-4 sm:p-6 bg-gray-100">
              <img
                src={ZONE_MAP}
                alt="G-HOPE geographic boundaries map showing Zone 1 through Zone 4 incentive areas in Greeley, Colorado east of 35th Avenue"
                className="w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                loading="eager"
              />
            </div>
            <p className="px-6 py-4 text-sm text-gray-600 border-t border-gray-100">
              Reference streets include 35th Ave, 23rd Ave, 17th Ave, 14th Ave, 11th Ave, 8th Ave, US Hwy 85, D St, and US Hwy 34.
              Confirm your property&apos;s zone with Housing Solutions before making an offer.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {incentiveZones.map((row) => (
              <article
                key={row.zone}
                id={row.zone.toLowerCase().replace(" ", "-")}
                className={`relative rounded-xl border overflow-hidden ${row.highlight ? "border-amber-300 shadow-lg" : "border-gray-200 shadow-sm bg-white"}`}
              >
                <div
                  className={`px-6 py-4 flex items-center justify-between ${row.highlight ? "bg-amber-500" : "bg-gray-900"} ${row.highlight ? "text-gray-900" : "text-white"}`}
                >
                  <h3 className="font-bold font-serif text-xl">{row.zone}</h3>
                  <span className="text-2xl font-bold font-serif">{row.amount}</span>
                </div>
                <div className="p-6 bg-white">
                  <p className="font-semibold text-gray-900 mb-2">{row.headline}</p>
                  <p className="text-gray-700 text-sm leading-relaxed mb-3">{row.boundaries}</p>
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-600">Nearby landmarks: </span>
                    {row.landmarks}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-5 py-4 font-semibold">Zone</th>
                  <th className="px-5 py-4 font-semibold">Incentive</th>
                  <th className="px-5 py-4 font-semibold">Geographic boundary (summary)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-amber-50">
                  <td className="px-5 py-4 font-semibold">Zone 1</td>
                  <td className="px-5 py-4 font-bold" style={{ color: "#92400e" }}>$8,000</td>
                  <td className="px-5 py-4 text-gray-700">East of 8th Avenue</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-5 py-4 font-semibold">Zone 2</td>
                  <td className="px-5 py-4 font-bold">$6,000</td>
                  <td className="px-5 py-4 text-gray-700">Between 14th and 17th Avenues and 8th Avenue</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-5 py-4 font-semibold">Zone 3</td>
                  <td className="px-5 py-4 font-bold">$4,000</td>
                  <td className="px-5 py-4 text-gray-700">West of 14th and 17th Avenues</td>
                </tr>
                <tr className="bg-white">
                  <td className="px-5 py-4 font-semibold">Zone 4</td>
                  <td className="px-5 py-4 font-bold">$2,500</td>
                  <td className="px-5 py-4 text-gray-700">Outlying eligible areas (see map — northwest, southwest & southeast sections)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-center text-sm text-gray-600 mt-8 max-w-2xl mx-auto">
            Additional incentive funds may be available for purchases within established redevelopment and university districts.
            Contact Housing Solutions for the most current zone verification.
          </p>
        </div>
      </section>

      {/* Eligibility */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">G-HOPE eligibility requirements</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              The city confirms all requirements at application. Below is a complete checklist based on official program guidelines.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {eligibilityRequirements.map((item) => (
              <div key={item.title} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-3" style={{ backgroundColor: GOLD, color: "#1a1a1a" }}>
                  ✓
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Forgiveness */}
      <section className="py-16 sm:py-20 px-6 bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">5-year loan forgiveness schedule</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              G-HOPE assistance is a deferred down payment loan — not a grant. Stay in the home as your primary residence and a portion is forgiven each year.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {forgivenessTimeline.map((item) => (
              <div key={item.year} className="text-center rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Year {item.year}</p>
                <p className="text-2xl font-bold font-serif mb-1" style={{ color: GOLD }}>{item.cumulative}</p>
                <p className="text-xs text-gray-400 leading-snug">{item.note}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">
            Example: $8,000 in Zone 1 assistance → $1,600 forgiven after year one, fully forgiven after five years of eligible occupancy.
          </p>
        </div>
      </section>

      {/* G-HOPE vs CHFA */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">G-HOPE vs. CHFA — which fits you?</h2>
            <p className="text-lg text-gray-700">
              Many Greeley buyers explore both. They are separate programs with different rules.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-5 py-4 font-semibold">Feature</th>
                  <th className="px-5 py-4 font-semibold">G-HOPE (Greeley)</th>
                  <th className="px-5 py-4 font-semibold">CHFA (Colorado)</th>
                </tr>
              </thead>
              <tbody>
                {programCompare.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-5 py-4 font-semibold text-gray-900">{row.feature}</td>
                    <td className="px-5 py-4 text-gray-700">{row.ghope}</td>
                    <td className="px-5 py-4 text-gray-700">{row.chfa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/chfa-down-payment-assistance/"
              className="inline-flex px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Explore CHFA programs →
            </Link>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-10 text-center">How to apply for G-HOPE</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4"
                  style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
                >
                  {item.step}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{item.description}</p>
                {item.internal ? (
                  item.anchor ? (
                    <a href={item.link} className="text-sm font-semibold hover:underline">{item.linkText} →</a>
                  ) : (
                    <Link to={item.link} className="text-sm font-semibold hover:underline">{item.linkText} →</Link>
                  )
                ) : (
                  <a href={item.link} className="text-sm font-semibold hover:underline" target="_blank" rel="noopener noreferrer">
                    {item.linkText} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-8 text-center">G-HOPE frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="group bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <summary className="cursor-pointer px-6 py-5 font-bold text-gray-900 list-none flex items-center justify-between gap-4">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform shrink-0">▾</span>
                </summary>
                <div className="px-6 pb-5 text-gray-700 text-sm leading-relaxed border-t border-gray-100 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Full form */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold font-serif mb-4">Ready to buy in Greeley?</h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Schwartz and Associates helps Greeley-area employees find qualifying single-family homes, evaluate zone incentives,
              and coordinate with lenders and the city. Start with a free consultation — we respond quickly.
            </p>
            <ul className="space-y-3 text-gray-700">
              {[
                "Identify listings in your target G-HOPE zone",
                "Structure competitive offers on qualifying homes",
                "Coordinate timing with Housing Solutions & your lender",
                "Navigate closing alongside CHFA options if applicable",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="font-bold" style={{ color: GOLD }}>→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <GHopeLeadForm />
        </div>
      </section>

      {/* City contact */}
      <section className="py-12 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold font-serif mb-2">Apply through the City of Greeley</h2>
          <p className="text-gray-400 mb-6">Housing Solutions · 1100 10th Street, Greeley, CO 80631 · Mon–Fri 8:00am–5:00pm</p>
          <a
            href="mailto:housinginfo@greeleygov.com"
            className="inline-flex text-lg font-semibold hover:underline mb-4"
            style={{ color: GOLD }}
          >
            housinginfo@greeleygov.com
          </a>
          <p className="text-sm text-gray-500">
            Questions or to apply directly →{" "}
            <a href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white underline">
              greeleyco.gov/residents/resources/housing-solutions
            </a>
          </p>
        </div>
      </section>

      <ChfaResourceHub />

      <section className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-600">
          <Link to="/northern-colorado-areas/greeley/" className="font-semibold text-gray-900 hover:underline">
            Greeley area guide
          </Link>
          {" · "}
          <Link to="/northern-colorado-areas/evans/" className="font-semibold text-gray-900 hover:underline">
            Evans area guide
          </Link>
          {" · "}
          <a
            href="https://www.realscout.com/search?agent_id=251929&location=Greeley,%20CO"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:underline"
          >
            Search Greeley homes
          </a>
        </div>
      </section>
    </>
  );
}
