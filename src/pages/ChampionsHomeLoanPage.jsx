import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import ChampionsLeadForm from "../components/ChampionsLeadForm";
import ChfaResourceHub from "../components/ChfaResourceHub";

const GOLD = "#CFB36E";

const responderCategories = [
  { label: "Peace Officers", detail: "Police, sheriff, corrections, deputies, wildlife & port of entry" },
  { label: "Firefighters", detail: "Career and volunteer departments statewide" },
  { label: "EMTs & Paramedics", detail: "Emergency medical services personnel" },
  { label: "911 Dispatch", detail: "Emergency communications specialists" },
];

const qualifyingRoles = [
  "Peace officers — including corrections officers, non-certified deputy sheriffs, wildlife officers, and port of entry officers",
  "Firefighters serving Colorado communities",
  "Emergency medical technicians (EMTs) and paramedics",
  "911 emergency communications specialists",
  "Household members of qualifying first responders",
];

const keyBenefits = [
  {
    title: "110% income eligibility",
    description: "Qualifying households may earn up to 110% of CHFA's standard income limits — opening doors for more first responder families.",
  },
  {
    title: "Fixed-rate CHFA mortgages",
    description: "Competitive fixed-rate first mortgage options originated through CHFA's statewide network of participating lenders.",
  },
  {
    title: "Down payment assistance",
    description: "Grant up to $25,000 or 3% of the loan, or a deferred second mortgage up to $25,000 or 4% — usable toward down payment and closing costs.",
  },
  {
    title: "Live where you serve",
    description: "Build equity and put down roots in Northern Colorado — Fort Collins, Loveland, Windsor, Greeley, Wellington, and beyond.",
  },
];

const timeline = [
  { date: "April 17, 2026", label: "Signed into law", detail: "SB26-053 passed the Colorado legislature and was signed into law." },
  { date: "August 12, 2026", label: "Effective date", detail: "Program authority takes effect under CHFA." },
  { date: "Late 2026", label: "CHFA launch expected", detail: "Final guidelines and lender availability anticipated." },
];

const borrowerRequirements = [
  { label: "Credit score", value: "Minimum mid-score of 620" },
  { label: "Borrower contribution", value: "At least $1,000 toward the home purchase" },
  { label: "Homebuyer education", value: "Complete a CHFA-approved homebuyer education class" },
  { label: "Lender approval", value: "Qualify through a CHFA Participating Lender" },
  { label: "Purchase price limits", value: "County-specific limits still apply (see Northern Colorado examples below)" },
];

const northernColoradoLimits = [
  {
    county: "Weld County",
    cities: "Greeley, Windsor, Eaton, Milliken, La Salle, Mead",
    income: "$153,600 – $179,200",
    incomeNote: "Varies by household size & program",
    purchasePrice: "Up to ~$735,000",
    areaLink: "/northern-colorado-areas/greeley/",
  },
  {
    county: "Larimer County",
    cities: "Fort Collins, Loveland, Wellington, Timnath",
    income: "$130,000 – $156,000+",
    incomeNote: "Varies by program & targeted area",
    purchasePrice: "Up to ~$664,000 – $812,000",
    areaLink: "/northern-colorado-areas/fort-collins/",
  },
];

const dpaOptions = [
  {
    title: "Grant — no repayment",
    highlight: "Lowest upfront cost",
    amount: "Up to $25,000 or 3% of the first mortgage",
    detail: "Can significantly reduce or eliminate your down payment depending on loan size, purchase price, and other factors.",
  },
  {
    title: "Deferred second mortgage",
    highlight: "Higher assistance amount",
    amount: "Up to $25,000 or 4% of the first mortgage",
    detail: "No monthly payments. Repayment deferred until payoff, sale, refinance, or the home is no longer your primary residence.",
  },
];

const steps = [
  {
    step: "1",
    title: "Confirm eligibility",
    description: "Review your first responder role and household income with a CHFA Participating Lender. Many first responders may already qualify under existing CHFA programs today.",
    link: "https://www.chfainfo.com/homeownership/participating-lenders",
    linkText: "Find a CHFA lender",
  },
  {
    step: "2",
    title: "Complete homebuyer education",
    description: "CHFA requires approved homebuyer education for all borrowers. Start early so you're ready when the Champions program launches.",
    link: "https://www.chfainfo.com/homeownership",
    linkText: "CHFA homeownership resources",
  },
  {
    step: "3",
    title: "Partner with a local REALTOR®",
    description: "Work with SAA Homes for your Northern Colorado home search, offer strategy, and closing — while your lender handles CHFA program details.",
    link: "#champions-lead-form",
    linkText: "Request local guidance",
    internal: true,
  },
];

const faqs = [
  {
    q: "What is the Colorado Champions Home Loan Program?",
    a: "It is a CHFA initiative created by SB26-053 that expands access to affordable home financing for Colorado first responders and their households by raising income eligibility to 110% of standard CHFA limits and pairing with down payment assistance.",
  },
  {
    q: "Is this a brand-new loan product?",
    a: "No. The program expands eligibility within CHFA's existing first mortgage and down payment assistance programs — it does not create an entirely separate loan product.",
  },
  {
    q: "Does the program offer zero-down financing?",
    a: "Down payment assistance grants can make upfront costs very low or zero in many cases, depending on loan size, purchase price, and other factors. Standard CHFA requirements still apply, including a minimum $1,000 borrower contribution.",
  },
  {
    q: "Who counts as a first responder under SB26-053?",
    a: "Peace officers (including corrections officers, 911 specialists, wildlife officers, and more), firefighters, and EMTs — plus their households. The bill includes a broad definition of peace officer beyond sworn patrol roles.",
  },
  {
    q: "When will I be able to apply for CHFA Champions in Colorado?",
    a: "CHFA anticipates launching the program in late 2026. The law is effective August 12, 2026, but final guidelines and lender availability are still being developed. Sign up on this page for updates.",
  },
  {
    q: "Do purchase price limits still apply?",
    a: "Yes. County-specific purchase price and income limits still apply and vary by CHFA program (Preferred, FirstStep, etc.). The 110% income threshold raises eligibility above standard caps but does not remove all limits.",
  },
  {
    q: "Can Fort Collins and Greeley first responders apply?",
    a: "Yes. The program is statewide. First responders in Larimer County (Fort Collins, Loveland, Wellington) and Weld County (Greeley, Windsor) will access it through CHFA participating lenders serving Northern Colorado.",
  },
  {
    q: "Can I get started before the Champions program launches?",
    a: "Yes. Many first responder households may already qualify under existing CHFA programs, especially moderate-income households. A participating lender can review your options now.",
  },
];

const PAGE_URL = "https://saahomes.com/colorado-champions-home-loan-program/";
const PAGE_TITLE = "Colorado Champions Home Loan Program | CHFA First Responder Home Loans 2026 | SAA Homes";
const PAGE_DESCRIPTION =
  "Colorado's new CHFA Champions Home Loan Program expands eligibility for police, firefighters, EMTs, and 911 dispatchers. 110% income limits, up to $25K down payment help, and Northern Colorado guidance from SAA Homes. Expected late 2026.";

export default function ChampionsHomeLoanPage() {
  return (
    <>
      <SEO
        exactTitle={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        keywords="Colorado Champions Home Loan Program, CHFA first responders home loans, first responder housing Colorado, police officer home loan Colorado, firefighter mortgage Colorado, EMT home buying Colorado, CHFA down payment assistance first responders, Northern Colorado first responder homeownership, SB26-053, Weld County CHFA, Larimer County CHFA, Fort Collins first responder home loan, Greeley police officer mortgage, Loveland firefighter home buying, Windsor CHFA loan"
        canonical={PAGE_URL}
        ogTitle="Colorado Champions Home Loan Program — CHFA First Responder Home Loans"
        ogDescription={PAGE_DESCRIPTION}
        ogImage="https://saahomes.com/images/Shwartz-CTA-Buyers.jpg"
        ogUrl={PAGE_URL}
      />

      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Colorado Champions Home Loan Program for First Responders",
          headline: "Colorado Champions Home Loan Program — CHFA First Responder Home Loans",
          description: PAGE_DESCRIPTION,
          url: PAGE_URL,
          inLanguage: "en-US",
          dateModified: "2026-06-24",
          isPartOf: { "@type": "WebSite", name: "SAA Homes", url: "https://saahomes.com/" },
          about: {
            "@type": "GovernmentService",
            name: "Colorado Champions Home Loan Program",
            serviceType: "First responder homeownership assistance",
            areaServed: { "@type": "State", name: "Colorado" },
            provider: { "@type": "Organization", name: "Colorado Housing and Finance Authority", url: "https://www.chfainfo.com/" },
          },
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: [".champions-hero-headline", ".champions-intro-lead"],
          },
        })}
      </script>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
            { "@type": "ListItem", position: 2, name: "Colorado Home Buyers", item: "https://saahomes.com/for-buyers/" },
            { "@type": "ListItem", position: 3, name: "Colorado Champions Home Loan Program", item: PAGE_URL },
          ],
        })}
      </script>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: { "@type": "Answer", text: faq.a },
          })),
        })}
      </script>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to prepare for the Colorado Champions Home Loan Program",
          description: "Steps for Colorado first responders to prepare for CHFA Champions homeownership assistance.",
          step: steps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.title,
            text: s.description,
            url: s.internal ? `${PAGE_URL}${s.link}` : s.link,
          })),
        })}
      </script>

      {/* Hero */}
      <section
        className="relative min-h-[min(100svh,720px)] sm:min-h-[560px] bg-cover bg-center flex items-end sm:items-center justify-center pt-28 sm:pt-32 pb-16 sm:pb-20"
        style={{ backgroundImage: "url('/images/Shwartz-CTA-Buyers.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/50" />
        <div className="relative z-10 max-w-5xl mx-auto text-center text-white px-4 sm:px-6 w-full">
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            {["Police", "Fire", "EMS", "911 Dispatch"].map((role) => (
              <span
                key={role}
                className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide border border-white/30 bg-white/10 backdrop-blur-sm"
              >
                {role}
              </span>
            ))}
          </div>
          <span
            className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase"
            style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
          >
            Coming Late 2026 · Effective Aug 12, 2026
          </span>
          <h1 className="champions-hero-headline text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-tight">
            Colorado Champions Home Loan Program
          </h1>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-sans max-w-3xl mx-auto text-gray-100 leading-relaxed">
            CHFA home loans and down payment assistance for first responders — so you can own a home in the communities you protect.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <a
              href="#champions-lead-form"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation shadow-lg"
            >
              Get Program Updates
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
            >
              How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-black text-white py-8 px-6 border-b border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {[
            { value: "110%", label: "Income eligibility vs. standard CHFA caps" },
            { value: "$25K", label: "Maximum down payment assistance" },
            { value: "620+", label: "Minimum credit score required" },
            { value: "Late '26", label: "Expected CHFA program launch" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl sm:text-4xl font-bold font-serif" style={{ color: GOLD }}>{stat.value}</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Intro + Lead Form */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
              SB26-053 · CHFA Homeownership
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              Affordable home financing for Colorado&apos;s public safety professionals
            </h2>
            <p className="champions-intro-lead text-lg text-gray-700 mb-4 leading-relaxed">
              In April 2026, Colorado lawmakers passed <strong>SB26-053</strong>, creating the{" "}
              <strong>Colorado Champions Home Loan Program</strong> through the Colorado Housing and Finance Authority
              (CHFA). This bipartisan initiative expands access to affordable home financing for first responders — so
              they can live where they work and protect.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              The program raises CHFA income limits to <strong>110% of standard guidelines</strong> for qualifying
              households and pairs with down payment assistance options. CHFA is still developing full implementation
              (anticipated late 2026), but this is excellent news for public safety professionals across{" "}
              <Link to="/northern-colorado-areas/fort-collins/" className="text-black font-semibold hover:underline">Fort Collins</Link>,{" "}
              <Link to="/northern-colorado-areas/loveland/" className="text-black font-semibold hover:underline">Loveland</Link>,{" "}
              <Link to="/northern-colorado-areas/windsor/" className="text-black font-semibold hover:underline">Windsor</Link>,{" "}
              <Link to="/northern-colorado-areas/greeley/" className="text-black font-semibold hover:underline">Greeley</Link>, and{" "}
              <Link to="/northern-colorado-areas/wellington/" className="text-black font-semibold hover:underline">Wellington</Link>.
            </p>
            <p className="text-sm text-gray-500">
              Page last updated June 24, 2026 — we refresh this guide when CHFA releases final program guidelines.
            </p>
          </div>
          <div className="lg:col-span-2 lg:sticky lg:top-28 scroll-mt-28">
            <ChampionsLeadForm compact />
          </div>
        </div>
      </section>

      {/* Responder categories */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Built for those who serve</h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              The Champions program recognizes the broad range of public safety roles that keep Colorado communities safe.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {responderCategories.map((cat) => (
              <div
                key={cat.label}
                className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-black font-bold text-lg"
                  style={{ backgroundColor: GOLD }}
                >
                  {cat.label.charAt(0)}
                </div>
                <h3 className="text-lg font-bold font-serif mb-2">{cat.label}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{cat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Qualifies */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">Who qualifies?</h2>
              <p className="text-lg text-gray-700 mb-6">
                The program expands CHFA eligibility for first responders as defined in SB26-053, including their households:
              </p>
              <ul className="space-y-3">
                {qualifyingRoles.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-black text-white text-xs flex items-center justify-center">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-600 mt-6 bg-amber-50 border border-amber-100 rounded-lg p-4">
                Many first responder households may already qualify under existing CHFA programs today — you don&apos;t have to wait for launch to start exploring options with a participating lender.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <h3 className="text-2xl font-bold font-serif mb-6">Borrower requirements</h3>
              <dl className="space-y-4">
                {borrowerRequirements.map(({ label, value }) => (
                  <div key={label} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <dt className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</dt>
                    <dd className="text-gray-800 mt-1">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Key program benefits</h2>
            <p className="text-gray-300 max-w-3xl mx-auto">
              The Champions program opens the door to CHFA&apos;s proven homeownership tools with expanded income eligibility for those who serve our communities.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {keyBenefits.map((benefit) => (
              <div key={benefit.title} className="rounded-xl p-6 border border-gray-700 bg-gray-900/50">
                <h3 className="text-lg font-bold font-serif mb-3" style={{ color: GOLD }}>{benefit.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DPA Options */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Down payment assistance options</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              When paired with a CHFA first mortgage through a participating lender, eligible borrowers may access:
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {dpaOptions.map((option) => (
              <div key={option.title} className="relative bg-white rounded-xl p-8 shadow-lg border border-gray-100 overflow-hidden">
                <span
                  className="absolute top-0 right-0 px-4 py-1.5 text-xs font-bold uppercase tracking-wide rounded-bl-lg"
                  style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
                >
                  {option.highlight}
                </span>
                <h3 className="text-2xl font-bold font-serif mb-3 pr-24">{option.title}</h3>
                <p className="text-xl font-semibold text-gray-900 mb-4">{option.amount}</p>
                <p className="text-gray-700 leading-relaxed">{option.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Northern Colorado Limits */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Northern Colorado income &amp; price limits</h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl">
            Current CHFA limits (effective June 15, 2026) vary by county, household size, and program. The Champions 110% threshold will open the door for more first responder households above these caps when the program launches.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-6 py-4 font-semibold">County</th>
                  <th className="px-6 py-4 font-semibold">Communities</th>
                  <th className="px-6 py-4 font-semibold">Income limits (1–2 person)</th>
                  <th className="px-6 py-4 font-semibold">Purchase price limits</th>
                </tr>
              </thead>
              <tbody>
                {northernColoradoLimits.map((row, i) => (
                  <tr key={row.county} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-6 py-5 font-semibold text-gray-900">
                      <Link to={row.areaLink} className="hover:underline">{row.county}</Link>
                    </td>
                    <td className="px-6 py-5 text-gray-700 text-sm">{row.cities}</td>
                    <td className="px-6 py-5 text-gray-700">
                      {row.income}
                      <span className="block text-xs text-gray-500 mt-1">{row.incomeNote}</span>
                    </td>
                    <td className="px-6 py-5 text-gray-700">{row.purchasePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            At 110% eligibility, qualifying first responder households may earn above these standard caps. Always confirm current limits with CHFA or your lender.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="https://www.chfainfo.com/homeownership"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              CHFA Homeownership
            </a>
            <a
              href="https://www.chfainfo.com/homeownership/participating-lenders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-white transition-colors"
            >
              Find a Participating Lender
            </a>
            <Link
              to="/chfa-down-payment-assistance/"
              className="inline-flex items-center px-6 py-3 text-black font-semibold hover:underline"
            >
              General CHFA down payment assistance →
            </Link>
            <Link
              to="/chfa-schools-to-home/"
              className="inline-flex items-center px-6 py-3 text-black font-semibold hover:underline"
            >
              CHFA Schools To Home for educators →
            </Link>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Program timeline</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              The law is in place — CHFA is building the final guidelines and lender rollout.
            </p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-0.5 bg-gray-200" aria-hidden="true" />
            <div className="grid md:grid-cols-3 gap-8">
              {timeline.map((item, i) => (
                <div key={item.date} className="relative text-center">
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-black font-bold text-lg border-4 border-white shadow-md relative z-10"
                    style={{ backgroundColor: GOLD }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{item.date}</p>
                  <h3 className="text-xl font-bold font-serif mt-2 mb-2">{item.label}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mid-page CTA */}
      <section className="py-12 px-6" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            First responder looking to buy in Northern Colorado?
          </h2>
          <p className="text-gray-800 mb-6 max-w-2xl mx-auto">
            Get on our list for program updates and free local home buying guidance from SAA Homes — no obligation.
          </p>
          <a
            href="#champions-lead-form"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
          >
            Sign Up for Updates
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 sm:py-20 px-6 scroll-mt-28 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">How it works &amp; next steps</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Start preparing now — many first responders can explore existing CHFA options while waiting for Champions to launch.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.step} className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-black font-bold mb-4"
                  style={{ backgroundColor: GOLD }}
                >
                  {step.step}
                </span>
                <h3 className="text-xl font-bold font-serif mb-3">{step.title}</h3>
                <p className="text-gray-700 mb-5 text-sm leading-relaxed">{step.description}</p>
                {step.internal ? (
                  <a href={step.link} className="text-black font-semibold hover:underline text-sm">
                    {step.linkText} →
                  </a>
                ) : (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black font-semibold hover:underline text-sm"
                  >
                    {step.linkText} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Frequently asked questions</h2>
            <p className="text-gray-600">Common questions about CHFA Champions for Colorado first responders.</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <summary className="flex items-center justify-between gap-4 cursor-pointer p-6 font-bold font-serif text-gray-900 list-none [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 group-open:bg-black group-open:text-white flex items-center justify-center text-lg transition-colors">
                    +
                  </span>
                </summary>
                <div className="px-6 pb-6 pt-0 text-gray-700 leading-relaxed border-t border-gray-50">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Form + CTA */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              Local guidance from Northern Colorado buyer agents
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              SAA Homes helps first responders navigate the home buying process — from understanding CHFA programs to finding the right neighborhood and negotiating your offer. We&apos;re not a lender, but we work alongside CHFA participating lenders every day.
            </p>
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mb-6">
              <img
                src="/images/Buyers-CTA-1.jpg"
                alt="Adam and Mandi Schwartz — Northern Colorado real estate agents"
                className="rounded-lg w-full max-w-sm mb-4"
                loading="lazy"
              />
              <p className="text-gray-700 text-sm">
                Adam and Mandi Schwartz have helped hundreds of Colorado families buy and sell homes across Fort Collins, Loveland, Windsor, and Greeley.
              </p>
            </div>
            <div className="space-y-3">
              <a href="tel:(970) 999-1407" className="block text-lg font-semibold hover:underline">
                Call (970) 999-1407
              </a>
              <Link to="/contact/" className="block text-lg font-semibold hover:underline">
                Contact form →
              </Link>
              <Link to="/for-buyers/" className="block text-gray-700 hover:underline">
                Buyer resources →
              </Link>
              <a
                href="https://leg.colorado.gov/bills/SB26-053"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-gray-600 hover:underline text-sm"
              >
                Official bill: SB26-053 →
              </a>
            </div>
          </div>
          <ChampionsLeadForm />
        </div>
      </section>

      <ChfaResourceHub />

      {/* Disclaimer */}
      <section className="py-12 px-6 bg-gray-100 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-600 leading-relaxed">
            This page provides general information about the Colorado Champions Home Loan Program based on SB26-053 and CHFA resources as of June 2026. Program details, income limits, and availability are subject to change. Always verify the latest requirements directly with{" "}
            <a href="https://www.chfainfo.com/homeownership" target="_blank" rel="noopener noreferrer" className="underline">
              CHFA
            </a>{" "}
            or a participating lender. Schwartz and Associates is not a lender and does not originate CHFA loans.
          </p>
        </div>
      </section>
    </>
  );
}
