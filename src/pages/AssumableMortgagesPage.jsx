import React, { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import QualifyCta from "../components/QualifyCta";
import { BUSINESS } from "../utils/seoConstants";
import { buildFaqPageSchema } from "../data/moneyPageFaqs.js";
import { submitContactForm } from "../utils/api.js";
import { withLeadMetadata } from "../utils/leadTracking.js";

const GOLD = "#CFB36E";
const PAGE_URL = "https://saahomes.com/assumable-mortgages/";
const PAGE_TITLE =
  "Assumable Mortgages in Colorado | VA & FHA Loan Assumption | SAA Homes";
const PAGE_DESCRIPTION =
  "Learn how assumable mortgages work in Northern Colorado. VA and FHA loan assumption can mean a lower-rate payment for buyers — Schwartz and Associates flags assumable listings in Fort Collins, Loveland, Windsor, and Greeley. Call (970) 999-1407.";

const howItWorks = [
  {
    step: "1",
    title: "Find a listing with an assumable loan",
    description:
      "Not every home has an assumable mortgage. VA and FHA loans are assumable by qualified buyers; conventional loans generally are not. We flag listings in Northern Colorado where an assumable VA or FHA loan may be in play.",
  },
  {
    step: "2",
    title: "Qualify with the assumptor's lender",
    description:
      "The buyer still goes through credit and income qualification with the lender that holds the loan. The lender must approve the assumption — you are not bypassing underwriting, you are stepping into the seller's remaining loan terms.",
  },
  {
    step: "3",
    title: "Compare the assumed rate to today's market",
    description:
      "The payoff is a monthly payment based on the seller's original rate and remaining balance. In a higher-rate market, assuming a lower-rate VA or FHA loan can mean a meaningfully lower payment than originating a new loan at today's rates.",
  },
];

const assumableFaqs = [
  {
    q: "What is an assumable mortgage in Colorado?",
    a: "An assumable mortgage lets a qualified buyer take over the seller's existing home loan — including its interest rate, remaining balance, and remaining term — instead of originating a new mortgage. VA and FHA loans are assumable by qualified buyers; most conventional loans are not. The buyer must still qualify with the lender that holds the loan, and the lender must approve the assumption. In Northern Colorado, assumable VA loans are most common in military-adjacent markets like Fort Collins and Windsor, where PCS moves bring homes with VA financing onto the market.",
  },
  {
    q: "How does a VA loan assumption work?",
    a: "A buyer assumes the seller's VA-backed loan by applying with the lender that services it. The VA charges a one-time assumption funding fee (currently 0.5% of the loan balance for most buyers — confirm the current rate with the VA or the lender, as it can change). The lender reviews the buyer's credit and income, and must approve the assumption. The seller's VA entitlement is typically restored for their next VA loan. Sellers with a VA loan can use assumption as a marketing advantage, but the buyer must qualify — we never promise a sale will close on assumption alone.",
  },
  {
    q: "Do I need to be a veteran to assume a VA loan?",
    a: "No. Any qualified buyer can assume a VA-backed loan — veteran or not — because the VA guarantee stays with the loan. Non-veterans pay the VA assumption fee (0.5% of the remaining balance, subject to change), and veterans with remaining entitlement may have different rules. The lender still underwrites the buyer's credit and income. If you are buying a home with an assumable VA loan in Fort Collins, Loveland, Windsor, or Greeley, we will connect you with a VA-approved lender to confirm the numbers on your specific file.",
  },
  {
    q: "Are FHA loans assumable?",
    a: "Yes, FHA loans are assumable by qualified buyers, subject to lender approval. The buyer must meet FHA credit and income requirements, and the lender reviews the assumption like a new application. FHA assumptions do not require the buyer to be a first-time buyer or meet FHA occupancy rules the same way a new FHA purchase does — confirm current FHA requirements with the lender. The interest rate on an assumed FHA loan is the seller's original rate, which can be attractive when rates have risen since the loan was originated.",
  },
  {
    q: "What are the costs of assuming a mortgage?",
    a: "Costs vary by loan type. VA assumptions carry a one-time funding fee (0.5% of the loan balance for most buyers — verify with the VA, as rates change). FHA assumptions may have a small processing fee charged by the lender, and the buyer typically pays closing costs unless negotiated otherwise. You will also pay for title work and any new appraisal the lender requires. We itemize every cost in writing before you commit — we do not invent savings figures. Confirm all fees with the lender holding the loan before you write an offer.",
  },
  {
    q: "How can SAA Homes help me buy with an assumable mortgage?",
    a: "Schwartz and Associates flags listings where an assumable VA or FHA loan may be in play, connects you with VA-approved and FHA-experienced lenders who can underwrite the assumption, and negotiates the contract around the assumption timeline. We serve buyers across Fort Collins, Loveland, Windsor, Greeley, Timnath, and all 27 Northern Colorado communities. Call (970) 999-1407 to talk through whether assumption makes sense for your purchase.",
  },
];

const faqSchema = buildFaqPageSchema(assumableFaqs);

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
    { "@type": "ListItem", position: 2, name: "Colorado Home Buyers", item: "https://saahomes.com/for-buyers/" },
    { "@type": "ListItem", position: 3, name: "Assumable Mortgages", item: PAGE_URL },
  ],
};

const cities = [
  { name: "Fort Collins", href: "/northern-colorado-areas/fort-collins/", note: "CSU, Old Town, Poudre School District" },
  { name: "Loveland", href: "/northern-colorado-areas/loveland/", note: "Lakes, Thompson schools, VA Clinic on Byrd Drive" },
  { name: "Windsor", href: "/northern-colorado-areas/windsor/", note: "I-25 corridor, newer housing, family communities" },
  { name: "Greeley", href: "/northern-colorado-areas/greeley/", note: "More accessible prices, Weld County inventory" },
  { name: "Timnath", href: "/northern-colorado-areas/timnath/", note: "New construction along I-25" },
  { name: "Severance", href: "/northern-colorado-areas/severance/", note: "Family-friendly Weld County growth" },
];

function AssumableLeadForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    loanType: "",
    city: "",
    message: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const details = [
      form.loanType ? `Loan type: ${form.loanType}` : null,
      form.city ? `City of interest: ${form.city}` : null,
      form.message || null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await submitContactForm(
        withLeadMetadata({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: details,
          source: "assumable-mortgages-page",
        })
      );
    } catch (_err) {
      // Lead capture is best-effort; never block the visitor
    }
    setIsSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🏡</div>
        <h3 className="text-2xl font-serif font-bold mb-3">Thank You</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          We&rsquo;ve received your information and will reach out within 24 hours.
          Whether you&rsquo;re buying with an assumed loan or selling a home with an
          assumable VA or FHA mortgage, we&rsquo;ll help you find the right path forward.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-600 mb-2 font-semibold">
          Name
        </label>
        <input
          type="text" required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="Your full name"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-600 mb-2 font-semibold">
          Email
        </label>
        <input
          type="email" required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="your@email.com"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-600 mb-2 font-semibold">
          Phone
        </label>
        <input
          type="tel" required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="(970) 555-1234"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-600 mb-2 font-semibold">
          I am interested in
        </label>
        <select
          value={form.loanType}
          onChange={(e) => setForm({ ...form, loanType: e.target.value })}
          className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 focus:border-[#CFB36E] outline-none transition-colors"
        >
          <option value="">Select one…</option>
          <option value="Buying — assume a VA loan">Buying — assume a VA loan</option>
          <option value="Buying — assume an FHA loan">Buying — assume an FHA loan</option>
          <option value="Selling — market my assumable loan">Selling — market my assumable loan</option>
          <option value="Not sure — help me understand">Not sure — help me understand</option>
        </select>
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-600 mb-2 font-semibold">
          City of interest
        </label>
        <input
          type="text"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="Fort Collins, Windsor, Loveland…"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-600 mb-2 font-semibold">
          Questions
        </label>
        <textarea
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="Tell us about the home you're considering…"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-black text-white font-semibold py-3.5 px-6 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
      >
        {isSubmitting ? "Sending…" : "Get assumable mortgage help"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Schwartz and Associates · (970) 999-1407 · We reply within 24 hours
      </p>
    </form>
  );
}

export default function AssumableMortgagesPage() {
  return (
    <>
      <SEO
        exactTitle={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        keywords="assumable mortgage Colorado, VA loan assumption, FHA loan assumption, assumable VA loan Fort Collins, how do assumable mortgages work, assumable mortgage Northern Colorado, buy a home with assumable loan, low rate mortgage assumption, assumable homes for sale Fort Collins, assumable mortgage Loveland, Windsor assumable VA loan, Greeley assumable mortgage"
        canonical={PAGE_URL}
        ogTitle="Assumable Mortgages in Colorado — VA & FHA Loan Assumption"
        ogDescription={PAGE_DESCRIPTION}
        ogImage="https://saahomes.com/images/Fort-Collins-CO-Area-Guide.jpg"
        ogUrl={PAGE_URL}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Assumable Mortgage Guidance — VA & FHA Loan Assumption",
            description: PAGE_DESCRIPTION,
            url: PAGE_URL,
            provider: {
              "@type": "RealEstateAgent",
              name: BUSINESS.name,
              url: BUSINESS.url,
              telephone: BUSINESS.telephone,
            },
            areaServed: [
              "Fort Collins, CO",
              "Loveland, CO",
              "Windsor, CO",
              "Greeley, CO",
              "Timnath, CO",
              "Northern Colorado",
            ],
          },
          breadcrumbSchema,
          faqSchema,
        ].filter(Boolean)}
      />

      {/* Hero */}
      <section
        className="relative min-h-[min(100svh,680px)] sm:min-h-[540px] bg-cover bg-center flex items-end sm:items-center justify-center pt-28 sm:pt-32 pb-16 sm:pb-20"
        style={{ backgroundImage: "url('/images/Fort-Collins-CO-Area-Guide.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/50" />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: GOLD }} aria-hidden="true" />
        <div className="relative z-10 max-w-5xl mx-auto text-center text-white px-4 sm:px-6 w-full">
          <p
            className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase"
            style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
          >
            Schwartz and Associates · Northern Colorado
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-tight">
            Assumable Mortgages in Colorado — Keep the Seller's Lower Rate
          </h1>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-sans max-w-3xl mx-auto text-gray-100 leading-relaxed">
            VA and FHA loan assumption explained for Fort Collins, Loveland, Windsor, and Greeley buyers and sellers.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <a
              href="#assumable-lead-form"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation shadow-lg"
            >
              Check if assumption fits you
            </a>
            <a
              href="tel:9709991407"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              (970) 999-1407
            </a>
          </div>
        </div>
      </section>

      <QualifyCta
        program="an assumable VA or FHA mortgage"
        headline="Not sure if assuming a mortgage makes sense for you?"
        chatQuestion="Hi! I'm looking at Northern Colorado homes and wondering whether assuming a VA or FHA mortgage could save me money. Can you walk me through how it works?"
        formAnchor="#assumable-lead-form"
        formLabel="Get assumable mortgage help instead"
      />

      {/* How it works */}
      <section className="py-16 sm:py-20 px-6 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center text-gray-900">
            Three steps to a lower-rate mortgage
          </h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto text-center mb-12 leading-relaxed">
            Assumption is not a workaround — it is a specific financing path with lender approval, VA or FHA rules, and real savings when rates have risen since the seller's loan was originated.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {howItWorks.map((item) => (
              <article key={item.step} className="rounded-xl border border-gray-200 p-6 bg-white">
                <p className="text-sm font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
                  Step {item.step}
                </p>
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-700 leading-relaxed">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Loan types */}
      <section className="py-16 sm:py-20 px-6 bg-white" id="loan-types">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
            Loan types
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center text-gray-900">
            Which mortgages can be assumed?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <article className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">VA loans — assumable by any qualified buyer</h3>
              <p className="text-gray-700 leading-relaxed">
                VA-backed loans are assumable by qualified buyers, veteran or not. The VA guarantee stays with the loan, so a non-veteran can assume it (a VA assumption funding fee applies — 0.5% of the remaining balance for most buyers; confirm the current rate with the VA or lender). The buyer must be approved by the lender servicing the loan, and the seller's VA entitlement is typically restored for their next VA purchase. In Northern Colorado, PCS moves in Fort Collins and Windsor frequently put homes with assumable VA loans on the market.
              </p>
            </article>
            <article className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">FHA loans — assumable with lender approval</h3>
              <p className="text-gray-700 leading-relaxed">
                FHA loans are assumable by qualified buyers who meet FHA credit and income requirements, with lender approval. The buyer steps into the seller's FHA rate and remaining term, which can be significantly below today's rates. A small processing fee may apply. Confirm current FHA assumption requirements and fees with the lender holding the loan — rules can change and we do not invent them.
              </p>
            </article>
            <article className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">Conventional loans — generally NOT assumable</h3>
              <p className="text-gray-700 leading-relaxed">
                Most conventional loans contain a due-on-sale clause, which means the full balance comes due when the property transfers — so they cannot be assumed. If a listing advertises an assumable conventional mortgage, read the terms carefully and have the lender confirm in writing before you build an offer around it.
              </p>
            </article>
            <article className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">USDA loans — assumable in some cases</h3>
              <p className="text-gray-700 leading-relaxed">
                USDA Rural Development loans can sometimes be assumed by buyers who meet income and occupancy requirements, with RD approval. These are less common in Northern Colorado's urban corridor, but if a property qualifies, the assumption path can carry the same lower-rate benefit. Confirm eligibility with the RD servicing office.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50" id="cities">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
            Northern Colorado
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center text-gray-900">
            Where we flag assumable listings
          </h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto text-center mb-12 leading-relaxed">
            Schwartz and Associates serves buyers and sellers across all 27 Northern Colorado communities. These are the markets where assumable VA and FHA inventory most often appears.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cities.map((city) => (
              <Link
                key={city.name}
                to={city.href}
                className="rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-2">{city.name}, Colorado</h3>
                <p className="text-gray-700 leading-relaxed">{city.note}</p>
                <p className="mt-3 font-semibold underline">Explore {city.name} →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-6 bg-white" id="faqs">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
            FAQ
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-12 text-center text-gray-900">
            Assumable mortgage questions, answered straight
          </h2>
          <div className="space-y-6">
            {assumableFaqs.map((faq) => (
              <article key={faq.q} className="rounded-xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">{faq.q}</h3>
                <p className="text-gray-700 leading-relaxed">{faq.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section className="py-16 sm:py-20 px-6 bg-[#111] text-white" id="assumable-lead-form">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
              Get started
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              See if an assumable mortgage fits your purchase
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-6">
              Tell us the home you are considering. We will check whether the listing carries an assumable VA or FHA loan, connect you with a lender who can underwrite the assumption, and run the numbers honestly — assumed rate vs. new loan at today's market.
            </p>
            <ul className="space-y-3 text-gray-200">
              <li className="flex items-start gap-3">
                <span style={{ color: GOLD }}>✓</span>
                Assumable-listing screening on every search
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: GOLD }}>✓</span>
                VA-approved and FHA-experienced lender referrals
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: GOLD }}>✓</span>
                Honest rate comparison — no invented savings
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: GOLD }}>✓</span>
                Sellers: marketing your assumable loan as a buyer draw
              </li>
            </ul>
            <p className="mt-8 text-gray-300">
              Prefer to talk? Call{" "}
              <a href="tel:9709991407" className="font-semibold underline" style={{ color: GOLD }}>
                (970) 999-1407
              </a>
              .
            </p>
          </div>
          <div className="bg-white text-gray-900 rounded-xl p-6 sm:p-8">
            <AssumableLeadForm />
          </div>
        </div>
      </section>
    </>
  );
}
