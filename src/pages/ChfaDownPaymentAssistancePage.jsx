import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import ChfaDpaLeadForm from "../components/ChfaDpaLeadForm";
import ChfaResourceHub from "../components/ChfaResourceHub";

const GOLD = "#CFB36E";

const chfaPrograms = [
  {
    name: "CHFA SmartStep & SmartStep Plus",
    loanType: "FHA, VA, or USDA-RD",
    dpa: "Grant or second mortgage",
    bestFor: "General homebuyers needing FHA/VA/USDA financing with flexible DPA options",
    highlight: "Grant available",
  },
  {
    name: "CHFA Preferred & Preferred Plus",
    loanType: "Conventional (HFA Preferred / HFA Advantage)",
    dpa: "Second mortgage only",
    bestFor: "Buyers who qualify for conventional financing at up to 97% LTV",
    highlight: "Conventional",
  },
  {
    name: "CHFA FirstStep & FirstStep Plus",
    loanType: "FHA only",
    dpa: "Second mortgage only",
    bestFor: "First-time homebuyers, qualified veterans, or buyers in targeted areas",
    highlight: "First-time buyers",
  },
  {
    name: "CHFA FirstGeneration & FirstGeneration Plus",
    loanType: "FHA only",
    dpa: "Up to $25,000 second mortgage",
    bestFor: "First-generation homebuyers whose parents/guardians never owned a home",
    highlight: "Up to $25K DPA",
  },
  {
    name: "Colorado HFA1 & HFA1 Plus",
    loanType: "FHA, VA, USDA, or Conventional",
    dpa: "Second mortgage only",
    bestFor: "Flexible loan type options with CHFA down payment assistance",
    highlight: "Multi-loan type",
  },
];

const dpaOptions = [
  {
    title: "CHFA DPA Grant",
    highlight: "No repayment",
    amount: "Up to $25,000 or 3% of your first mortgage",
    example: "On a $350,000 home, that could mean up to $10,500 toward your down payment.",
    detail: "Available with eligible CHFA first mortgage programs (such as SmartStep Plus). Does not require repayment. Higher interest rates may apply when using DPA.",
    programs: "SmartStep Plus and other eligible programs",
  },
  {
    title: "CHFA DPA Second Mortgage",
    highlight: "Up to 4% assistance",
    amount: "Up to $25,000 or 4% of your first mortgage",
    example: "First-generation buyers may qualify for up to $25,000 regardless of loan amount.",
    detail: "Zero monthly payments. Full repayment deferred until you pay off, sell, refinance, or move out of the home as your primary residence. Can cover down payment, closing costs, prepaids, and principal reduction.",
    programs: "Preferred Plus, SmartStep Plus, FirstStep Plus, FirstGeneration Plus, HFA1 Plus",
  },
];

const generalRequirements = [
  { label: "Credit score", value: "Minimum mid-score of 620 (some programs allow no credit score)" },
  { label: "Borrower contribution", value: "At least $1,000 toward the home purchase" },
  { label: "Homebuyer education", value: "Complete a CHFA-approved class before closing" },
  { label: "Income limits", value: "Household income must not exceed county-specific CHFA limits" },
  { label: "Purchase price limits", value: "Home price must fall within program limits for your county" },
  { label: "Debt-to-income", value: "50% DTI max (620–659 FICO) or 55% max (660+ FICO)" },
  { label: "Participating lender", value: "All CHFA loans are originated through approved lenders — not directly from CHFA" },
];

const northernColoradoLimits = [
  {
    county: "Larimer County",
    cities: "Fort Collins, Loveland, Wellington, Timnath",
    incomeNonTargeted: "~$130,000 – $156,000+",
    incomeTargeted: "Higher limits in designated targeted areas",
    purchasePrice: "Up to ~$664,000 – $812,000",
    areaLink: "/northern-colorado-areas/fort-collins/",
  },
  {
    county: "Weld County",
    cities: "Greeley, Windsor, Eaton, Milliken, La Salle, Mead",
    incomeNonTargeted: "~$153,600 – $179,200",
    incomeTargeted: "Higher limits in designated targeted areas",
    purchasePrice: "Up to ~$735,000",
    areaLink: "/northern-colorado-areas/greeley/",
  },
];

const specialtyPrograms = [
  {
    title: "G-HOPE Greeley (City Employees)",
    audience: "Full-time employees with Greeley-area employers",
    benefit: "Up to $8,000 forgivable down payment loan",
    link: "/greeley-g-hope-down-payment-assistance/",
    status: "Active now",
  },
  {
    title: "CHFA Schools To Home",
    audience: "Full-time Colorado public school employees",
    benefit: "Up to 25% down payment assistance",
    link: "/chfa-schools-to-home/",
    status: "Launching July 2026",
  },
  {
    title: "Colorado Champions Home Loan",
    audience: "First responders & their households",
    benefit: "110% income eligibility + standard CHFA DPA",
    link: "/colorado-champions-home-loan-program/",
    status: "Coming late 2026",
  },
];

const steps = [
  {
    step: "1",
    title: "Take homebuyer education early",
    description: "CHFA requires an approved homebuyer education class before closing. Taking it early helps you understand the process and prepare for lender conversations.",
    link: "https://www.chfainfo.com/homeownership/homebuyer-education",
    linkText: "Register for a class",
  },
  {
    step: "2",
    title: "Connect with a CHFA Participating Lender",
    description: "A participating lender determines which CHFA program fits your income, credit, and loan type. CHFA does not lend directly — your lender handles qualification and origination.",
    link: "https://www.chfainfo.com/homeownership/participating-lenders",
    linkText: "Find a CHFA lender",
  },
  {
    step: "3",
    title: "Work with a local buyer agent",
    description: "SAA Homes helps you find homes within CHFA purchase price limits, structure competitive offers, and coordinate with your lender through closing in Northern Colorado.",
    link: "#chfa-dpa-lead-form",
    linkText: "Request local guidance",
    internal: true,
  },
];

const faqs = [
  {
    q: "What is CHFA down payment assistance in Colorado?",
    a: "CHFA (Colorado Housing and Finance Authority) offers grants and deferred second mortgage loans to help eligible homebuyers with down payment and closing costs. Assistance is paired with a CHFA first mortgage through a participating lender — up to $25,000 or 3–4% of the loan amount depending on the program.",
  },
  {
    q: "Do I have to be a first-time homebuyer for CHFA?",
    a: "Not always. CHFA SmartStep and Preferred programs are available to repeat buyers. FirstStep requires first-time buyer status (or qualified veteran status) unless you purchase in a CHFA targeted area, where repeat buyers may also qualify with higher income limits.",
  },
  {
    q: "What is a first-generation homebuyer for CHFA?",
    a: "A first-generation homebuyer has never owned a home and whose parents or legal guardians have never owned a home. CHFA FirstGeneration programs offer specialized assistance, including up to $25,000 in down payment help regardless of first mortgage amount.",
  },
  {
    q: "How much down payment assistance can I get from CHFA?",
    a: "Most programs offer up to the lesser of $25,000 or 3% (grant) or 4% (second mortgage) of your first mortgage. First-generation and certain disability programs may access up to $25,000 regardless of loan size. Your lender confirms exact amounts.",
  },
  {
    q: "What credit score do I need for CHFA in Colorado?",
    a: "A minimum mid-credit score of 620 is required for most CHFA programs. Some FHA-based programs allow borrowers with no credit score. Lenders may have additional overlays.",
  },
  {
    q: "Can I use CHFA to buy a home in Fort Collins or Greeley?",
    a: "Yes. CHFA programs are available statewide, including Larimer County (Fort Collins, Loveland) and Weld County (Greeley, Windsor). Income and purchase price limits vary by county, household size, and whether the property is in a targeted area.",
  },
  {
    q: "Is CHFA down payment assistance a grant or a loan?",
    a: "CHFA offers both. Grants (up to 3% or $25,000) require no repayment but are limited to certain programs like SmartStep Plus. Second mortgage assistance (up to 4% or $25,000) has no monthly payments but must be repaid when you sell, refinance, pay off the first mortgage, or move out.",
  },
  {
    q: "Does CHFA down payment assistance cover closing costs?",
    a: "Yes. CHFA DPA funds can be used toward down payment, closing costs, prepaids, and in some cases principal reduction — depending on the program and lender approval.",
  },
  {
    q: "What is the difference between CHFA and CHAC in Colorado?",
    a: "CHFA (Colorado Housing and Finance Authority) and CHAC (Colorado Housing Assistance Corporation) are separate organizations serving Colorado homebuyers. CHFA is the state housing authority that sets program guidelines and provides first mortgage and down payment assistance programs like SmartStep, Preferred, and FirstStep. CHAC primarily offers down payment assistance grants (up to $17,500 in some counties) but does not originate first mortgages — you bring your own first mortgage from any lender. Many buyers compare CHFA vs CHAC to find the best down payment option for their situation. SAA Homes can help Northern Colorado buyers evaluate both programs and connect with lenders who participate in each. Call (970) 999-1407 for guidance.",
  },
  {
    q: "Can I combine multiple CHFA programs?",
    a: "Generally no. You typically use one CHFA first mortgage program paired with one DPA option. Specialty programs like Schools To Home and Champions cannot be combined with other CHFA programs. Your lender helps identify the best single program for your situation.",
  },
  {
    q: "What are the CHFA income limits for Colorado in 2026?",
    a: "CHFA income limits vary by county and household size. For Larimer County (Fort Collins, Loveland) the 2026 non-targeted income limit is approximately $130,000-$156,000 depending on household size, with higher limits in designated targeted areas. Weld County (Greeley, Windsor) limits are approximately $153,600-$179,200. Purchase price limits also apply: up to approximately $664,000-$812,000 in Larimer and $735,000 in Weld County. These limits are updated annually by CHFA. Contact SAA Homes at (970) 999-1407 for current limits specific to your situation.",
  },
  {
    q: "How do I apply for CHFA down payment assistance?",
    a: "Start by contacting a CHFA Participating Lender — not CHFA directly. Complete homebuyer education, get pre-approved, then work with a REALTOR® to find a home within program limits. SAA Homes can guide your Northern Colorado search while your lender handles CHFA program details.",
  },
];

const PAGE_URL = "https://saahomes.com/chfa-down-payment-assistance/";
const PAGE_TITLE = "CHFA Down Payment Assistance Colorado | First-Time Homebuyer Programs 2026 | SAA Homes";
const PAGE_DESCRIPTION =
  "Looking for CHFA down payment assistance in Colorado? Compare SmartStep, Preferred, FirstStep & FirstGeneration programs. Get up to $25K grants or 4% DPA second mortgage. Check your income limits & get started with SAA Homes.";

export default function ChfaDownPaymentAssistancePage() {
  return (
    <>
      <SEO
        exactTitle={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        keywords="CHFA down payment assistance, Colorado first time home buyer programs, CHFA grant Colorado, CHFA SmartStep, CHFA Preferred, CHFA FirstStep, CHFA FirstGeneration, down payment help Colorado, Fort Collins CHFA, Greeley first time home buyer, Larimer County CHFA income limits, Weld County down payment assistance, Northern Colorado homebuyer programs, Colorado Housing Finance Authority"
        canonical={PAGE_URL}
        ogTitle="CHFA Down Payment Assistance Colorado — First-Time Homebuyer Guide"
        ogDescription={PAGE_DESCRIPTION}
        ogImage="https://saahomes.com/images/Buyers-img-2.jpg"
        ogUrl={PAGE_URL}
      />

      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "CHFA Down Payment Assistance Colorado Guide",
          headline: "CHFA Down Payment Assistance for Colorado First-Time Homebuyers",
          description: PAGE_DESCRIPTION,
          url: PAGE_URL,
          inLanguage: "en-US",
          dateModified: "2026-06-24",
          isPartOf: { "@type": "WebSite", name: "SAA Homes", url: "https://saahomes.com/" },
          about: {
            "@type": "GovernmentService",
            name: "CHFA Down Payment Assistance",
            serviceType: "First-time homebuyer down payment assistance",
            areaServed: { "@type": "State", name: "Colorado" },
            provider: { "@type": "Organization", name: "Colorado Housing and Finance Authority", url: "https://www.chfainfo.com/" },
          },
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: [".chfa-dpa-hero-headline", ".chfa-dpa-intro-lead"],
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
            { "@type": "ListItem", position: 3, name: "CHFA Down Payment Assistance", item: PAGE_URL },
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
          name: "How to get CHFA down payment assistance in Colorado",
          description: "Steps for Colorado first-time homebuyers to access CHFA down payment and closing cost assistance.",
          step: steps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.title,
            text: s.description,
            url: s.internal ? `${PAGE_URL}${s.link}` : s.link,
          })),
        })}
      </script>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "CHFA Home Loan Programs",
          itemListElement: chfaPrograms.map((program, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: program.name,
            description: `${program.loanType}. ${program.dpa}. Best for: ${program.bestFor}`,
          })),
        })}
      </script>

      {/* Hero */}
      <section
        className="relative min-h-[min(100svh,720px)] sm:min-h-[560px] bg-cover bg-center flex items-end sm:items-center justify-center pt-28 sm:pt-32 pb-16 sm:pb-20"
        style={{ backgroundImage: "url('/images/Buyers-img-2.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/55" />
        <div className="relative z-10 max-w-5xl mx-auto text-center text-white px-4 sm:px-6 w-full">
          <span
            className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase"
            style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
          >
            Colorado Housing &amp; Finance Authority
          </span>
          <h1 className="chfa-dpa-hero-headline text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-tight">
            CHFA Down Payment Assistance
          </h1>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-sans max-w-3xl mx-auto text-gray-100 leading-relaxed">
            Grants and deferred loans up to $25,000 to help Colorado first-time homebuyers afford a home in Northern Colorado and beyond.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <a
              href="#chfa-dpa-lead-form"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation shadow-lg"
            >
              Free CHFA Consultation
            </a>
            <a
              href="#chfa-programs"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
            >
              Compare Programs
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-black text-white py-8 px-6 border-b border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {[
            { value: "$25K", label: "Maximum down payment assistance" },
            { value: "620+", label: "Minimum credit score" },
            { value: "$1,000", label: "Minimum borrower contribution" },
            { value: "Statewide", label: "Available through CHFA lenders" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl sm:text-4xl font-bold font-serif" style={{ color: GOLD }}>{stat.value}</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Intro + Form */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
              Colorado First-Time Homebuyer Guide
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              How CHFA helps Colorado homebuyers afford a down payment
            </h2>
            <p className="chfa-dpa-intro-lead text-lg text-gray-700 mb-4 leading-relaxed">
              The <strong>Colorado Housing and Finance Authority (CHFA)</strong> is the state&apos;s trusted partner for
              affordable homeownership. Through a statewide network of participating lenders, CHFA offers fixed-rate first
              mortgages paired with <strong>down payment grants</strong> or <strong>deferred second mortgage loans</strong> —
              helping buyers who might otherwise struggle to save a large down payment.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Whether you&apos;re buying your first home in{" "}
              <Link to="/northern-colorado-areas/fort-collins/" className="text-black font-semibold hover:underline">Fort Collins</Link>,{" "}
              <Link to="/northern-colorado-areas/loveland/" className="text-black font-semibold hover:underline">Loveland</Link>,{" "}
              <Link to="/northern-colorado-areas/windsor/" className="text-black font-semibold hover:underline">Windsor</Link>, or{" "}
              <Link to="/northern-colorado-areas/greeley/" className="text-black font-semibold hover:underline">Greeley</Link>,
              CHFA programs can significantly reduce your upfront cash needs. SAA Homes helps Northern Colorado buyers
              navigate program limits, find qualifying homes, and coordinate with CHFA lenders.
            </p>
            <p className="text-sm text-gray-500">
              Page last updated June 24, 2026. Program details subject to change — verify with CHFA or your lender.
            </p>
          </div>
          <div className="lg:col-span-2 lg:sticky lg:top-28 scroll-mt-28">
            <ChfaDpaLeadForm compact />
          </div>
        </div>
      </section>

      {/* DPA Options */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Two ways CHFA helps with your down payment</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Every CHFA buyer uses a participating lender. Your lender determines which DPA option pairs with your first mortgage program.
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
                <h3 className="text-2xl font-bold font-serif mb-3 pr-28">{option.title}</h3>
                <p className="text-xl font-semibold text-gray-900 mb-2">{option.amount}</p>
                <p className="text-sm text-gray-600 mb-4 italic">{option.example}</p>
                <p className="text-gray-700 leading-relaxed mb-4">{option.detail}</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Common programs: {option.programs}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600 mt-8 max-w-2xl mx-auto">
            Even if you contribute toward a down payment, you may still use CHFA assistance for remaining down payment and closing costs. Higher interest rates may apply when using DPA.
          </p>
        </div>
      </section>

      {/* CHFA Programs comparison */}
      <section id="chfa-programs" className="py-16 sm:py-20 px-6 scroll-mt-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">CHFA loan programs at a glance</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              CHFA offers multiple first mortgage programs. The right one depends on your buyer status, loan type preference, and income.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-5 py-4 font-semibold">Program</th>
                  <th className="px-5 py-4 font-semibold">Loan type</th>
                  <th className="px-5 py-4 font-semibold">DPA options</th>
                  <th className="px-5 py-4 font-semibold">Best for</th>
                </tr>
              </thead>
              <tbody>
                {chfaPrograms.map((program, i) => (
                  <tr key={program.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-gray-900 block">{program.name}</span>
                      <span
                        className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold"
                        style={{ backgroundColor: `${GOLD}33`, color: "#1a1a1a" }}
                      >
                        {program.highlight}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{program.loanType}</td>
                    <td className="px-5 py-4 text-gray-700">{program.dpa}</td>
                    <td className="px-5 py-4 text-gray-700">{program.bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 grid sm:grid-cols-2 gap-6">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
              <h3 className="font-bold font-serif text-lg mb-2">First-time homebuyer definition</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                Generally, you are a first-time buyer if you have not owned a principal residence in the past three years. Qualified veterans may be treated as first-time buyers under FHA guidelines.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
              <h3 className="font-bold font-serif text-lg mb-2">Targeted areas</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                In CHFA designated targeted areas, repeat buyers may qualify for programs like FirstStep — and income limits are often higher. Your lender can confirm if a specific address qualifies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">General CHFA requirements</h2>
            <p className="text-gray-300 mb-6 leading-relaxed">
              All CHFA purchase programs share core requirements. Individual programs may have additional rules your lender will review.
            </p>
            <a
              href="https://www.chfainfo.com/homeownership/how-to-get-a-chfa-program-loan"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 rounded-lg font-semibold transition-colors"
              style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
            >
              Official CHFA requirements →
            </a>
          </div>
          <div className="bg-gray-900/60 rounded-xl border border-gray-700 divide-y divide-gray-700">
            {generalRequirements.map((req) => (
              <div key={req.label} className="p-5">
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: GOLD }}>{req.label}</p>
                <p className="text-gray-200 mt-1 text-sm">{req.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Northern Colorado limits */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Northern Colorado CHFA income &amp; price limits</h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl">
            CHFA limits vary by county, household size, program, and targeted vs. non-targeted area. These are representative ranges effective mid-2026 — always confirm current limits for your household.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-6 py-4 font-semibold">County</th>
                  <th className="px-6 py-4 font-semibold">Communities</th>
                  <th className="px-6 py-4 font-semibold">Income limits</th>
                  <th className="px-6 py-4 font-semibold">Purchase price limits</th>
                </tr>
              </thead>
              <tbody>
                {northernColoradoLimits.map((row, i) => (
                  <tr key={row.county} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-6 py-5 font-semibold">
                      <Link to={row.areaLink} className="text-gray-900 hover:underline">{row.county}</Link>
                    </td>
                    <td className="px-6 py-5 text-gray-700 text-sm">{row.cities}</td>
                    <td className="px-6 py-5 text-gray-700">
                      {row.incomeNonTargeted}
                      <span className="block text-xs text-gray-500 mt-1">{row.incomeTargeted}</span>
                    </td>
                    <td className="px-6 py-5 text-gray-700">{row.purchasePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="https://www.chfainfo.com/homeownership/income-limits"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              CHFA Income Limits PDF
            </a>
            <a
              href="https://www.chfainfo.com/homeownership/participating-lenders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-white transition-colors"
            >
              Find a Participating Lender
            </a>
            <Link to="/mortgage-calculator/" className="inline-flex items-center px-6 py-3 text-black font-semibold hover:underline">
              Mortgage calculator →
            </Link>
          </div>
        </div>
      </section>

      {/* Specialty programs cross-link */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Specialty CHFA programs</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              In addition to standard programs, Colorado has expanded CHFA access for educators and first responders.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {specialtyPrograms.map((program) => (
              <Link
                key={program.title}
                to={program.link}
                className="group block bg-gray-50 rounded-xl p-8 border border-gray-100 hover:border-gray-300 hover:shadow-lg transition-all"
              >
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>{program.status}</span>
                <h3 className="text-xl font-bold font-serif mt-2 mb-2 group-hover:underline">{program.title}</h3>
                <p className="text-gray-600 text-sm mb-3">{program.audience}</p>
                <p className="text-gray-900 font-semibold">{program.benefit}</p>
                <span className="inline-block mt-4 text-black font-semibold text-sm">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Mid-page CTA */}
      <section className="py-12 px-6" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            Not sure which CHFA program is right for you?
          </h2>
          <p className="text-gray-800 mb-6 max-w-2xl mx-auto">
            We help Northern Colorado buyers understand CHFA options and find homes within program limits — at no cost to you as the buyer.
          </p>
          <a
            href="#chfa-dpa-lead-form"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors touch-manipulation"
          >
            Get Free Local Guidance
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-20 px-6 bg-gray-50 scroll-mt-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">How to get started with CHFA</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              CHFA does not lend directly. Follow these steps with a participating lender and a local buyer agent.
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
                  <a href={step.link} className="text-black font-semibold hover:underline text-sm">{step.linkText} →</a>
                ) : (
                  <a href={step.link} target="_blank" rel="noopener noreferrer" className="text-black font-semibold hover:underline text-sm">
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
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">CHFA down payment assistance FAQ</h2>
            <p className="text-gray-600">Answers to the most common questions about CHFA programs in Colorado.</p>
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
                <div className="px-6 pb-6 pt-0 text-gray-700 leading-relaxed border-t border-gray-50">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Lead form + trust */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              Your Northern Colorado CHFA home buying partner
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              SAA Homes is not a lender — we do not originate CHFA loans. What we do is help you find homes that fit CHFA
              purchase price limits, structure winning offers, and coordinate with your CHFA participating lender through
              closing. We have guided buyers across Fort Collins, Loveland, Windsor, and Greeley for over 20 years.
            </p>
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mb-6">
              <img
                src="/images/Buyers-CTA-1.jpg"
                alt="Adam and Mandi Schwartz — Northern Colorado REALTORS"
                className="rounded-lg w-full max-w-sm mb-4"
                loading="lazy"
              />
              <ul className="space-y-2 text-gray-700 text-sm">
                {[
                  "Help finding homes within CHFA purchase price limits",
                  "Expert negotiation and contract guidance",
                  "Coordination with your CHFA participating lender",
                  "Local market knowledge across Larimer & Weld counties",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="font-bold text-black mt-0.5">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <a href="tel:(970) 999-1407" className="block text-lg font-semibold hover:underline">Call (970) 999-1407</a>
              <Link to="/contact/" className="block text-lg font-semibold hover:underline">Contact form →</Link>
              <Link to="/for-buyers/" className="block text-gray-700 hover:underline">Buyer services →</Link>
            </div>
          </div>
          <ChfaDpaLeadForm />
        </div>
      </section>

      <ChfaResourceHub />

      {/* Disclaimer */}
      <section className="py-12 px-6 bg-gray-100 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-600 leading-relaxed">
            This page provides general information about CHFA down payment assistance programs based on publicly available CHFA
            resources as of June 2026. Program details, income limits, interest rates, and availability are subject to change.
            Always verify the latest requirements with{" "}
            <a href="https://www.chfainfo.com/homeownership" target="_blank" rel="noopener noreferrer" className="underline">CHFA</a>{" "}
            or a participating lender before making financial decisions. Schwartz and Associates is a real estate brokerage, not a
            lender, and does not originate CHFA loans.
          </p>
        </div>
      </section>
    </>
  );
}
