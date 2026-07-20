import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import ChfaLeadForm from "../components/ChfaLeadForm";
import ChfaResourceHub from "../components/ChfaResourceHub";

const eligibilityItems = [
  "Public school",
  "School district",
  "Charter school",
  "Institute charter school",
  "Board of cooperative educational services (BOCES)",
  "Innovation zone",
];

const borrowerRequirements = [
  { label: "Credit score", value: "Minimum mid-score of 620" },
  { label: "Household income", value: "At or below $178,920" },
  { label: "Your contribution", value: "At least $1,000 toward the home purchase" },
  { label: "Homebuyer education", value: "Complete a CHFA-approved homebuyer education class" },
  { label: "Financial commitment course", value: 'Complete CHFA\'s required "Understanding Your Financial Commitment" course' },
  { label: "Lender approval", value: "Qualify through a CHFA Participating Lender" },
];

const programFeatures = [
  {
    title: "Fixed-Rate First Mortgage",
    description:
      "A fixed interest rate first mortgage loan through Fannie Mae (DU = HFA Preferred, Approve/Eligible result required). Interest rate buydowns are not allowed.",
  },
  {
    title: "Up to 25% Down Payment Assistance",
    description:
      "A CHFA DPA second mortgage for up to 25% of your first mortgage amount — usable toward down payment, closing costs, prepaids, and/or principal reduction. You don't have to use the full amount.",
  },
  {
    title: "No Monthly DPA Payments",
    description:
      "The second mortgage has no monthly payments and no prepayment penalty if paid off early. Full repayment is deferred until a maturity event.",
  },
  {
    title: "Shared Appreciation",
    description:
      "When you sell, refinance, pay off the loan, or no longer use the home as your primary residence, you repay the DPA plus a share of any home appreciation with the Public School Permanent Fund (PSPF).",
  },
];

const repaymentTriggers = [
  "Payoff of the first mortgage loan",
  "Sale or refinance of the home",
  "Home is no longer your primary residence",
];

const exampleScenarios = [
  {
    dpa: "25%",
    dpaAmount: "$87,500",
    homeValue: "$480,000",
    appreciation: "$42,500",
    sharedAppreciation: "$8,500",
    totalOwed: "$96,000",
    remainingEquity: "$34,000",
  },
  {
    dpa: "15%",
    dpaAmount: "$52,500",
    homeValue: "$500,000",
    appreciation: "$62,500",
    sharedAppreciation: "$7,500",
    totalOwed: "$60,000",
    remainingEquity: "$90,000",
  },
  {
    dpa: "20%",
    dpaAmount: "$70,000",
    homeValue: "$437,500",
    appreciation: "$0",
    sharedAppreciation: "$0",
    totalOwed: "$70,000",
    remainingEquity: "$17,500",
  },
];

const steps = [
  {
    step: "1",
    title: "Verify your eligibility",
    description:
      "Confirm you are a full-time public school employee and your employer is listed with the Colorado Department of Education.",
    link: "https://www.cde.state.co.us/schoolview/explore/welcome",
    linkText: "Verify at CDE →",
  },
  {
    step: "2",
    title: "Complete required education",
    description:
      "Take a CHFA-approved homebuyer education class and CHFA's \"Understanding Your Financial Commitment\" course before closing.",
    link: "https://www.chfainfo.com/single-family-participating-lenders/chfa-schools-to-home-program",
    linkText: "CHFA program page →",
  },
  {
    step: "3",
    title: "Connect with us",
    description:
      "Work with SAA Homes and a CHFA Participating Lender to get pre-approved, find your home, and navigate the program from contract to closing.",
    link: "#chfa-lead-form",
    linkText: "Request a consultation →",
    internal: true,
  },
];

export default function ChfaSchoolsToHomePage() {
  return (
    <>
      <SEO
        exactTitle="CHFA Schools To Home | Colorado Teacher & Educator Down Payment Assistance 2026"
        description="Colorado teachers & public school employees: qualify for up to 25% down payment assistance through CHFA Schools To Home. Check eligibility, income limits & how much you could receive toward your home purchase. Free consultation with SAA Homes today."
        keywords="CHFA Schools To Home, Colorado teacher home loan, educator down payment assistance Colorado, CHFA DPA Colorado, public school employee home buying, Colorado first time home buyer program, teacher mortgage Colorado, Fort Collins teacher home loan, Denver educator homeownership, CHFA down payment assistance 2026, shared appreciation mortgage Colorado"
        canonical="https://saahomes.com/chfa-schools-to-home/"
        ogTitle="CHFA Schools To Home — Colorado Educator Down Payment Assistance"
        ogDescription="Full-time Colorado public school employees may qualify for up to 25% down payment help. SAA Homes helps educators across Colorado understand and use the CHFA Schools To Home program."
        ogImage="https://saahomes.com/images/buyers-hero.jpg"
        ogUrl="https://saahomes.com/chfa-schools-to-home/"
      />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "CHFA Schools To Home Program for Colorado Educators",
          "description": "Down payment assistance program for full-time Colorado public school employees through CHFA Schools To Home.",
          "url": "https://saahomes.com/chfa-schools-to-home/",
          "inLanguage": "en-US",
          "isPartOf": {
            "@type": "WebSite",
            "name": "SAA Homes",
            "url": "https://saahomes.com/"
          },
          "about": {
            "@type": "Service",
            "name": "CHFA Schools To Home Home Buying Assistance",
            "areaServed": {
              "@type": "State",
              "name": "Colorado"
            },
            "provider": {
              "@type": "RealEstateAgent",
              "name": "Schwartz And Associates",
              "url": "https://saahomes.com/"
            }
          }
        })}
      </script>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://saahomes.com/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Colorado Home Buyers",
              "item": "https://saahomes.com/for-buyers/"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": "CHFA Schools To Home Program",
              "item": "https://saahomes.com/chfa-schools-to-home/"
            }
          ]
        })}
      </script>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Who qualifies for CHFA Schools To Home in Colorado?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "At least one borrower must be a full-time employee of a Colorado pre-K through 12 public school, school district, charter school, institute charter school, BOCES, or innovation zone. You must be designated as full-time by your employer at application and closing."
              }
            },
            {
              "@type": "Question",
              "name": "How much down payment assistance does CHFA Schools To Home offer?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Eligible borrowers may receive a CHFA DPA second mortgage for up to 25% of the first mortgage loan amount. It can be used toward down payment, closing costs, prepaids, and/or principal reduction."
              }
            },
            {
              "@type": "Question",
              "name": "What is shared appreciation in CHFA Schools To Home?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "When you sell, refinance, pay off the loan, or no longer use the home as your primary residence, you repay the DPA plus a share of any home appreciation. The share is calculated by dividing the original DPA amount by the original purchase price, then multiplying by the appreciation amount."
              }
            },
            {
              "@type": "Question",
              "name": "When does the CHFA Schools To Home program launch?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "CHFA Schools To Home is expected to launch in July 2026. Program details are subject to change; refer to CHFA's official program page for the latest information."
              }
            },
            {
              "@type": "Question",
              "name": "What are the income and credit requirements for CHFA Schools To Home?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Borrowers need a minimum mid-credit score of 620, household income at or below $178,920, at least $1,000 toward the purchase, CHFA-approved homebuyer education, and completion of CHFA's Understanding Your Financial Commitment course."
              }
            },
            {
              "@type": "Question",
              "name": "Can CHFA Schools To Home be combined with other CHFA programs?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "No. CHFA Schools To Home cannot be combined with any other CHFA program."
              }
            }
          ]
        })}
      </script>

      {/* Hero */}
      <section
        className="relative min-h-[min(100svh,680px)] sm:min-h-[520px] bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-24 sm:pb-16"
        style={{ backgroundImage: "url('/images/buyers-hero.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative z-10 max-w-5xl mx-auto text-center text-white px-4 sm:px-6">
          <span className="inline-block mb-4 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide uppercase" style={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}>
            Launching July 2026
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-tight">
            CHFA Schools To Home
          </h1>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-sans max-w-3xl mx-auto text-gray-100 leading-relaxed">
            Down payment assistance for full-time Colorado public school employees — so you can live in the community you serve.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <a
              href="#chfa-lead-form"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation"
            >
              Get Free Consultation
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
            >
              How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Intro + Lead Form */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-3">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              Homeownership for the educators who shape our communities
            </h2>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              The Colorado General Assembly authorized CHFA to develop a shared appreciation down payment assistance program for public school employees, funded by the Public School Permanent Fund (PSPF).{" "}
              <strong>CHFA Schools To Home</strong> helps Colorado educators purchase homes and build roots in the communities where they work.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              As your Northern Colorado real estate team, SAA Homes can guide you through eligibility, home search, and working with a CHFA Participating Lender — so you understand the program before you commit.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                <p className="text-3xl font-bold font-serif" style={{ color: "#CFB36E" }}>25%</p>
                <p className="text-gray-700 mt-1">Maximum DPA as a second mortgage</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                <p className="text-3xl font-bold font-serif" style={{ color: "#CFB36E" }}>$178,920</p>
                <p className="text-gray-700 mt-1">Maximum household income limit</p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 lg:sticky lg:top-28 scroll-mt-28">
            <ChfaLeadForm compact />
          </div>
        </div>
      </section>

      {/* Who Qualifies */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">Who qualifies?</h2>
              <p className="text-lg text-gray-700 mb-6">
                At least one borrower on the loan must be a <strong>full-time employee</strong> of a Colorado pre-K through 12:
              </p>
              <ul className="space-y-3">
                {eligibilityItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <span className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-black text-white text-xs flex items-center justify-center">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-600 mt-6">
                You must be designated as full-time by your employer at the time of application and loan closing. If multiple borrowers are on the loan, only one needs to meet this requirement.
              </p>
              <a
                href="https://www.cde.state.co.us/schoolview/explore/welcome"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-6 text-black font-semibold hover:underline"
              >
                Verify your school or district at CDE →
              </a>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-8">
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

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">How the program works</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              CHFA Schools To Home combines a first mortgage with down payment assistance and a shared appreciation component. It cannot be combined with any other CHFA program.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {programFeatures.map((feature) => (
              <div key={feature.title} className="bg-white border border-gray-100 rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-xl font-bold font-serif mb-3">{feature.title}</h3>
                <p className="text-gray-700">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shared Appreciation */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">Understanding shared appreciation</h2>
              <p className="text-gray-300 mb-6 leading-relaxed">
                When you repay the DPA second mortgage — at sale, refinance, payoff, or if the home is no longer your primary residence — you also share a portion of any appreciation with the PSPF. This keeps the program funded for future educators.
              </p>
              <ol className="space-y-4 text-gray-200">
                <li className="flex gap-3">
                  <span className="font-bold text-white">1.</span>
                  <span><strong className="text-white">Determine appreciation:</strong> Current value minus original purchase price (negative appreciation is treated as 0%).</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-white">2.</span>
                  <span><strong className="text-white">Calculate your share percentage:</strong> DPA loan amount ÷ original purchase price.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-white">3.</span>
                  <span><strong className="text-white">Shared appreciation owed:</strong> Appreciation × your share percentage.</span>
                </li>
              </ol>
              <p className="text-sm text-gray-400 mt-6">
                Total repayment = DPA second mortgage balance + shared appreciation. Appreciation is not guaranteed.
              </p>
            </div>

            <div className="rounded-lg p-8" style={{ backgroundColor: "#1f1f1f" }}>
              <h3 className="text-xl font-bold font-serif mb-6" style={{ color: "#CFB36E" }}>
                Example scenario
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Purchase price</span>
                  <span>$437,500</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">CHFA first mortgage (80%)</span>
                  <span>$350,000</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">DPA second mortgage (25%)</span>
                  <span>$87,500</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Home value at sale</span>
                  <span>$480,000</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Appreciation</span>
                  <span>$42,500</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Share percentage (87,500 ÷ 437,500)</span>
                  <span>20%</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Shared appreciation owed</span>
                  <span>$8,500</span>
                </div>
                <div className="flex justify-between pt-2 font-bold text-lg">
                  <span>Total owed at repayment</span>
                  <span style={{ color: "#CFB36E" }}>$96,000</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Remaining borrower equity</span>
                  <span>$34,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* More Examples Table */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold font-serif mb-4 text-center">More repayment examples</h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto text-sm">
            Based on a $437,500 purchase price and $350,000 first mortgage. For illustrative purposes only.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-sm text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-4 py-3 text-left font-semibold">DPA %</th>
                  <th className="px-4 py-3 text-left font-semibold">DPA Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Home Value</th>
                  <th className="px-4 py-3 text-left font-semibold">Appreciation</th>
                  <th className="px-4 py-3 text-left font-semibold">Shared Appreciation</th>
                  <th className="px-4 py-3 text-left font-semibold">Total Owed</th>
                  <th className="px-4 py-3 text-left font-semibold">Your Equity</th>
                </tr>
              </thead>
              <tbody>
                {exampleScenarios.map((row, i) => (
                  <tr key={row.dpa} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-3 font-medium">{row.dpa}</td>
                    <td className="px-4 py-3">{row.dpaAmount}</td>
                    <td className="px-4 py-3">{row.homeValue}</td>
                    <td className="px-4 py-3">{row.appreciation}</td>
                    <td className="px-4 py-3">{row.sharedAppreciation}</td>
                    <td className="px-4 py-3 font-semibold">{row.totalOwed}</td>
                    <td className="px-4 py-3">{row.remainingEquity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* When Repayment Is Due */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-6">When is repayment due?</h2>
          <p className="text-lg text-gray-700 mb-8">
            The DPA second mortgage and shared appreciation are deferred — no monthly payments — until one of these events:
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {repaymentTriggers.map((trigger) => (
              <div key={trigger} className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                <p className="text-gray-800 font-medium">{trigger}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-8">
            When ready, contact CHFA for payoff guidance. They will calculate your total repayment including shared appreciation.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 px-6" style={{ backgroundColor: "#CFB36E" }}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-12 text-center text-gray-900">
            Your path to homeownership
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(({ step, title, description, link, linkText, internal }) => (
              <div key={step} className="bg-white rounded-lg p-8 shadow-lg">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black text-white font-bold mb-4">
                  {step}
                </span>
                <h3 className="text-xl font-bold font-serif mb-3">{title}</h3>
                <p className="text-gray-700 mb-4">{description}</p>
                {internal ? (
                  <a href={link} className="text-black font-semibold hover:underline">
                    {linkText}
                  </a>
                ) : (
                  <a
                    href={link}
                    target={link.startsWith("http") ? "_blank" : undefined}
                    rel={link.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-black font-semibold hover:underline"
                  >
                    {linkText}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why SAA Homes */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <img
              src="/images/Buyers-CTA-1.jpg"
              alt="Adam and Mandi Schwartz - Northern Colorado Real Estate"
              className="rounded-lg shadow-xl w-full"
            />
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              Why work with SAA Homes?
            </h2>
            <p className="text-lg text-gray-700 mb-4">
              Navigating a new assistance program takes local expertise. We help Colorado educators understand their options, search homes across Northern Colorado, and coordinate with CHFA Participating Lenders from pre-approval through closing.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Personalized home search in Fort Collins, Loveland, Windsor, Greeley & beyond",
                "Expert negotiation to protect your interests",
                "Guidance on program requirements and timing",
                "Trusted network of lenders and professionals",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-gray-700">
                  <span className="text-black font-bold">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/for-buyers/"
              className="inline-block px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors mr-3 mb-3"
            >
              Explore Buyer Services
            </Link>
            <Link
              to="/chfa-down-payment-assistance/"
              className="inline-block px-6 py-3 text-black font-semibold hover:underline mb-3"
            >
              General CHFA down payment assistance →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <details className="bg-gray-50 rounded-lg p-6 border border-gray-100 group">
              <summary className="font-semibold text-lg cursor-pointer list-none flex justify-between items-center">
                Who qualifies for CHFA Schools To Home in Colorado?
                <span className="text-gray-400 group-open:rotate-45 transition-transform text-2xl">+</span>
              </summary>
              <p className="text-gray-700 mt-4 leading-relaxed">
                At least one borrower must be a full-time employee of a Colorado pre-K through 12 public school, school district, charter school, institute charter school, BOCES, or innovation zone. Verify your employer on the{" "}
                <a href="https://www.cde.state.co.us/schoolview/explore/welcome" target="_blank" rel="noopener noreferrer" className="underline">Colorado Department of Education website</a>.
              </p>
            </details>
            <details className="bg-gray-50 rounded-lg p-6 border border-gray-100 group">
              <summary className="font-semibold text-lg cursor-pointer list-none flex justify-between items-center">
                How much down payment assistance can Colorado educators receive?
                <span className="text-gray-400 group-open:rotate-45 transition-transform text-2xl">+</span>
              </summary>
              <p className="text-gray-700 mt-4 leading-relaxed">
                Up to 25% of your first mortgage loan amount as a second mortgage — usable for down payment, closing costs, prepaids, or principal reduction. You are not required to use the full 25%.
              </p>
            </details>
            <details className="bg-gray-50 rounded-lg p-6 border border-gray-100 group">
              <summary className="font-semibold text-lg cursor-pointer list-none flex justify-between items-center">
                What is shared appreciation and when do I repay?
                <span className="text-gray-400 group-open:rotate-45 transition-transform text-2xl">+</span>
              </summary>
              <p className="text-gray-700 mt-4 leading-relaxed">
                Repayment is deferred until you sell, refinance, pay off the loan, or move out of the home as your primary residence. At that time you repay the DPA balance plus your share of any appreciation. If the home has not appreciated, shared appreciation is $0.
              </p>
            </details>
            <details className="bg-gray-50 rounded-lg p-6 border border-gray-100 group">
              <summary className="font-semibold text-lg cursor-pointer list-none flex justify-between items-center">
                What income and credit score do I need?
                <span className="text-gray-400 group-open:rotate-45 transition-transform text-2xl">+</span>
              </summary>
              <p className="text-gray-700 mt-4 leading-relaxed">
                Household income must be at or below $178,920, with a minimum mid-credit score of 620. You must also contribute at least $1,000 toward the purchase and complete required homebuyer education courses.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Bottom Lead Form */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <ChfaLeadForm />
        </div>
      </section>

      <ChfaResourceHub />

      {/* Disclaimer */}
      <section className="py-8 px-6 border-t border-gray-200">
        <div className="max-w-4xl mx-auto text-xs text-gray-500 leading-relaxed">
          <p className="mb-2">
            <strong>Disclaimer:</strong> Information on this page is for educational purposes and based on CHFA program materials. Program details, income limits, and availability are subject to change. CHFA Schools To Home is expected to launch in July 2026. For official program guidelines, visit{" "}
            <a
              href="https://www.chfainfo.com/single-family-participating-lenders/chfa-schools-to-home-program"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              CHFA's Schools To Home program page
            </a>
            . SAA Homes is not a lender and does not originate CHFA loans. Shared appreciation examples are illustrative only; appreciation is not guaranteed.
          </p>
          <p>
            Equal Housing Opportunity. Schwartz and Associates is an independent real estate brokerage serving Northern Colorado.
          </p>
        </div>
      </section>
    </>
  );
}
