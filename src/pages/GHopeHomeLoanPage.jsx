import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import GHopeLeadForm from "../components/GHopeLeadForm";
import ChfaResourceHub from "../components/ChfaResourceHub";

const GOLD = "#CFB36E";
const OFFICIAL_URL = "https://greeleyco.gov/residents/resources/housing-solutions/";

const incentiveZones = [
  {
    zone: "Zone 1",
    area: "East of 8th Avenue",
    amount: "Up to $8,000",
    highlight: true,
  },
  {
    zone: "Zone 2",
    area: "Between 14th–17th & 8th Avenues",
    amount: "Up to $6,000",
  },
  {
    zone: "Zone 3",
    area: "West of 14th & 17th Avenues",
    amount: "Up to $4,000",
  },
  {
    zone: "Zone 4",
    area: "Eligible G-HOPE area",
    amount: "Up to $2,500",
  },
];

const eligibility = [
  { label: "Property type", value: "Single-family homes only" },
  { label: "Location", value: "Purchase east of 35th Avenue within Greeley (see zone map on official site)" },
  { label: "Employment", value: "Full-time employee at closing; employer based within program geographic boundaries" },
  { label: "Occupancy", value: "Must be your primary residence — no rental use" },
  { label: "Financing", value: "Qualify for a conventional or government home loan" },
  { label: "Buyer contribution", value: "At least $1,000 of your own funds toward the purchase" },
  { label: "First-time buyer", value: "Not required — no income limits on homebuyers" },
];

const forgivenessSteps = [
  { year: "Year 1", forgiven: "20%" },
  { year: "Year 2", forgiven: "40% cumulative" },
  { year: "Year 3", forgiven: "60% cumulative" },
  { year: "Year 4", forgiven: "80% cumulative" },
  { year: "Year 5", forgiven: "100% — loan fully forgiven" },
];

const steps = [
  {
    step: "1",
    title: "Confirm G-HOPE eligibility",
    description: "Review employment, property location (east of 35th Avenue), and loan qualification with Greeley Housing Solutions.",
    link: "mailto:housinginfo@greeleygov.com",
    linkText: "Email Housing Solutions",
    external: true,
  },
  {
    step: "2",
    title: "Get pre-approved with a lender",
    description: "You must qualify for a conventional or government mortgage. Your lender coordinates closing requirements alongside the city assistance.",
    link: "/for-buyers/",
    linkText: "Buyer resources",
    internal: true,
  },
  {
    step: "3",
    title: "Search Greeley homes with a local agent",
    description: "SAA Homes helps you find qualifying single-family homes in the right G-HOPE zones and structure a competitive offer.",
    link: "#g-hope-lead-form",
    linkText: "Request local guidance",
    internal: true,
  },
];

const faqs = [
  {
    q: "What is the G-HOPE program in Greeley?",
    a: "G-HOPE (Greeley Home Ownership Program for Employees) offers down payment loan assistance to full-time employees whose employer is based within the program area. Incentive amounts range from $2,500 to $8,000 depending on where you buy within eligible zones east of 35th Avenue.",
  },
  {
    q: "Do I have to be a first-time homebuyer?",
    a: "No. Unlike many state programs, G-HOPE does not require first-time buyer status and has no income limits on homebuyers.",
  },
  {
    q: "How does the down payment loan forgiveness work?",
    a: "The assistance is a deferred down payment loan forgiven at 20% per full year you live in the home as your primary residence. After five years, the loan is 100% forgiven if you remain eligible.",
  },
  {
    q: "Can I combine G-HOPE with CHFA down payment assistance?",
    a: "Stacking programs depends on lender and city guidelines. Many buyers explore one or both options with their loan officer. We can help you understand what may be possible for your situation.",
  },
  {
    q: "Who administers G-HOPE?",
    a: "The City of Greeley Housing Solutions Department administers G-HOPE along with federal HUD grants (CDBG and HOME). SAA Homes is an independent real estate brokerage — we help buyers find homes and navigate the purchase process.",
  },
  {
    q: "What areas of Greeley qualify?",
    a: "Purchases must be east of 35th Avenue within Greeley. Additional incentive funds may be available in established redevelopment and university districts. See the official zone map on the city website.",
  },
];

export default function GHopeHomeLoanPage() {
  return (
    <>
      <SEO
        exactTitle="G-HOPE Greeley Down Payment Assistance | City Employee Homebuyer Program | Schwartz and Associates"
        description="G-HOPE helps full-time Greeley-area employees with up to $8,000 in down payment assistance on homes east of 35th Avenue. No first-time buyer requirement. Free consultation from Schwartz and Associates."
        keywords="G-HOPE Greeley, Greeley down payment assistance, Greeley employee homebuyer program, Greeley Housing Solutions, Greeley real estate, City of Greeley home ownership, Weld County down payment help, Schwartz and Associates Greeley"
        canonical="https://saahomes.com/greeley-g-hope-down-payment-assistance/"
        ogImage="https://saahomes.com/images/Area-Guide-for-Greeley-CO.jpg"
        ogUrl="https://saahomes.com/greeley-g-hope-down-payment-assistance/"
        includeLocalBusiness={true}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "G-HOPE Greeley Down Payment Assistance Program Guide",
            description: "Guide to the City of Greeley G-HOPE employee home ownership down payment assistance program.",
            url: "https://saahomes.com/greeley-g-hope-down-payment-assistance/",
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
        ]}
      />

      <section
        className="relative min-h-[20rem] sm:min-h-[28rem] bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-12 px-6"
        style={{ backgroundImage: "url('/images/Area-Guide-for-Greeley-CO.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 max-w-4xl mx-auto text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            City of Greeley · Housing Solutions
          </p>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold font-serif mb-4">
            G-HOPE Down Payment Assistance in Greeley
          </h1>
          <p className="text-lg sm:text-xl text-gray-100 max-w-2xl mx-auto mb-8">
            Full-time Greeley-area employees may qualify for up to <strong>$8,000</strong> in forgivable down payment help on single-family homes east of 35th Avenue.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="#g-hope-lead-form"
              className="inline-flex px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Free Consultation
            </a>
            <a
              href={OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex px-8 py-3 border-2 border-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors"
            >
              Official City Program →
            </a>
          </div>
        </div>
      </section>

      <section className="py-12 px-6 bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-600">
          <p>
            Program information summarized from the{" "}
            <a href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              City of Greeley Housing Solutions
            </a>{" "}
            page. Eligibility and funding are determined solely by the city. Schwartz and Associates is not affiliated with the City of Greeley.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">What is G-HOPE?</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              <strong>G-HOPE</strong> (Greeley Home Ownership Program for Employees) is a City of Greeley initiative under the{" "}
              <em>Housing for All</em> priority. It helps full-time employees buy single-family homes in central Greeley neighborhoods east of 35th Avenue — reducing commute time and cost for people who work in the community.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Assistance comes as a <strong>down payment loan</strong> from $2,500 to $8,000 depending on the purchase zone. The loan is forgiven at <strong>20% per year</strong> of primary residency — fully forgiven after five years.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Unlike CHFA programs, G-HOPE has <strong>no income limits</strong> and does <strong>not require first-time buyer status</strong> — making it especially valuable for move-up buyers and Greeley workforce employees.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-black text-white">
              <h3 className="font-bold font-serif text-xl">Incentive zones (east of 35th Ave.)</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {incentiveZones.map((row) => (
                <div
                  key={row.zone}
                  className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${row.highlight ? "bg-amber-50" : ""}`}
                >
                  <div>
                    <p className="font-bold">{row.zone}</p>
                    <p className="text-sm text-gray-600">{row.area}</p>
                  </div>
                  <p className="font-bold font-serif text-lg" style={{ color: row.highlight ? "#92400e" : "#111" }}>
                    {row.amount}
                  </p>
                </div>
              ))}
            </div>
            <p className="px-6 py-4 text-xs text-gray-500 bg-gray-50">
              Additional funds may be available in redevelopment and university districts. See the official zone map on the city website.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold font-serif mb-8 text-center">Eligibility requirements</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {eligibility.map((item) => (
              <div key={item.label} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{item.label}</p>
                <p className="text-gray-900 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold font-serif mb-6 text-center">5-year loan forgiveness</h2>
          <p className="text-center text-gray-600 mb-8">
            Live in the home as your primary residence. Each full year, 20% of the assistance is forgiven.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {forgivenessSteps.map((item) => (
              <div key={item.year} className="text-center px-5 py-4 rounded-xl border-2 border-gray-200 min-w-[7rem]">
                <p className="text-sm text-gray-500">{item.year}</p>
                <p className="text-xl font-bold font-serif">{item.forgiven}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            Also exploring state programs?
          </h2>
          <p className="text-gray-800 mb-6">
            Many Greeley buyers also qualify for{" "}
            <Link to="/chfa-down-payment-assistance/" className="font-semibold underline">
              CHFA down payment assistance
            </Link>{" "}
            — grants and deferred loans up to $25,000 for qualifying Weld County buyers.
          </p>
          <Link
            to="/chfa-down-payment-assistance/#chfa-dpa-lead-form"
            className="inline-flex px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            CHFA program guide →
          </Link>
        </div>
      </section>

      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold font-serif mb-10 text-center">How to get started</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4"
                  style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
                >
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{item.description}</p>
                {item.internal ? (
                  <Link to={item.link} className="text-sm font-semibold hover:underline">
                    {item.linkText} →
                  </Link>
                ) : (
                  <a href={item.link} className="text-sm font-semibold hover:underline" target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}>
                    {item.linkText} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold font-serif mb-8 text-center">Common questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-lg mb-2">{faq.q}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <GHopeLeadForm />
        </div>
      </section>

      <section className="py-12 px-6 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold font-serif mb-4">City of Greeley contact</h2>
          <p className="text-gray-300 mb-4">
            Housing Solutions · 1100 10th Street, Greeley, CO 80631 · Mon–Fri 8am–5pm
          </p>
          <a href="mailto:housinginfo@greeleygov.com" className="text-lg font-semibold hover:underline" style={{ color: GOLD }}>
            housinginfo@greeleygov.com
          </a>
        </div>
      </section>

      <ChfaResourceHub />

      <section className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center">
          <Link to="/northern-colorado-areas/greeley/" className="font-semibold hover:underline">
            Explore Greeley real estate →
          </Link>
          {" · "}
          <Link to="/properties/" className="font-semibold hover:underline">
            Search Greeley homes for sale →
          </Link>
        </div>
      </section>
    </>
  );
}
