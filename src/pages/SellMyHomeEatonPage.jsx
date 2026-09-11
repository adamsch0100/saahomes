import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import AreaFAQSection from "../components/AreaFAQSection.jsx";
import { BUSINESS, formatBusinessAddress } from "../utils/seoConstants";

const EATON_SELL_FAQS = [
  {
    q: "How do I sell my home in Eaton, CO?",
    a: "Start with a free, no-obligation home valuation. Schwartz and Associates (SAA Homes) prices your Eaton home against live Weld County comparable sales, prepares professional photography and marketing, and negotiates the contract through closing. Call (970) 999-1407 to get started.",
  },
  {
    q: "What is my Eaton home worth right now?",
    a: "The best way to know is a free market analysis from a local agent. We pull recent Eaton-area comps and active inventory to give you a realistic price range — not an automated estimate. Request yours at /for-sellers/#home-valuation or call (970) 999-1407.",
  },
  {
    q: "How long does it take to sell a home in Eaton?",
    a: "Timeline depends on price, condition, and current buyer demand in the Eaton and greater Weld County market. A well-priced home that is properly marketed typically moves faster. We show you current days-on-market data for Eaton so your expectations are grounded in today's market.",
  },
  {
    q: "Do I need to make repairs before selling in Eaton?",
    a: "Not always. Some homes sell as-is, and many buyers expect only minor updates. We walk through which repairs add real value versus which you can skip, based on what today's Eaton buyers are actually willing to pay for.",
  },
  {
    q: "What does Schwartz and Associates charge to sell my Eaton home?",
    a: "Commission is set when you list and disclosed in writing. We provide full-service representation — pricing, photography, digital marketing, showings, negotiation, and closing coordination. Call (970) 999-1407 for a straightforward conversation about what listing with SAA Homes looks like.",
  },
];

export default function SellMyHomeEatonPage() {
  return (
    <>
      <SEO
        exactTitle="Sell My Home Eaton CO | Eaton Realtors & Free Home Valuation | SAA Homes"
        description="Sell your Eaton, Colorado home with Schwartz and Associates. Free home valuation, local Weld County pricing strategy, professional marketing, and expert negotiation. Call (970) 999-1407."
        keywords="sell my home Eaton CO, sell my house Eaton Colorado, Eaton realtor, Eaton real estate agent, Eaton home value, Weld County home selling, sell house fast Eaton, Eaton listing agent"
        canonical="https://saahomes.com/sell-my-home-eaton/"
        geoPlacename="Eaton, Colorado"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: EATON_SELL_FAQS.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.a,
              },
            })),
          },
        ]}
      />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-24">
        <div className="absolute inset-0 bg-[url('/images/Eaton-CO-Area-Guide.jpg')] bg-cover bg-center opacity-10" />
        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <span className="inline-block bg-[#CFB36E]/20 text-[#CFB36E] text-sm uppercase tracking-widest px-4 py-2 rounded-full mb-6 font-semibold">
            Eaton Seller Services
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 leading-tight">
            Sell Your Home in Eaton, Colorado
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
            Eaton sellers get a free, no-obligation home valuation and local Weld County pricing
            strategy from Schwartz and Associates. We know what makes an Eaton home sell — and what
            today&rsquo;s buyers are willing to pay.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/for-sellers/#home-valuation"
              className="inline-block bg-[#CFB36E] hover:bg-[#c0a55e] text-black font-bold py-4 px-8 rounded transition-colors"
            >
              Get a Free Home Valuation
            </Link>
            <a
              href="tel:(970) 999-1407"
              className="inline-block border-2 border-[#CFB36E] text-[#CFB36E] hover:bg-[#CFB36E] hover:text-black font-bold py-4 px-8 rounded transition-colors"
            >
              Call (970) 999-1407
            </a>
          </div>
        </div>
      </section>

      {/* Why list with SAA Homes */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">
            What You Get When You List With SAA Homes
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16 text-lg">
            Adam and Mandi Schwartz bring 20+ years of combined Northern Colorado experience to every
            Eaton listing.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-bold mb-3">Local Pricing Strategy</h3>
              <p className="text-gray-400">
                We price your Eaton home against live Weld County comps and current inventory — never
                an automated estimate — so it sells for what it is worth.
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="text-4xl mb-4">📸</div>
              <h3 className="text-xl font-bold mb-3">Professional Marketing</h3>
              <p className="text-gray-400">
                Photography, listing syndication, and digital marketing that puts your Eaton home in
                front of active buyers across the Front Range.
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-bold mb-3">Full Negotiation to Close</h3>
              <p className="text-gray-400">
                From first offer through inspection, appraisal, and closing, we handle the details so
                you can focus on your move.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Home valuation CTA band */}
      <section className="py-16 px-6 bg-[#CFB36E]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif text-gray-900 mb-4">
            Curious What Your Eaton Home Is Worth?
          </h2>
          <p className="text-gray-800 text-lg mb-8">
            Get a free, no-obligation market analysis from Schwartz and Associates. No pressure — just
            a realistic picture of your home&rsquo;s value in today&rsquo;s market.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/for-sellers/#home-valuation"
              className="inline-flex px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get My Free Home Valuation
            </Link>
            <a
              href="tel:(970) 999-1407"
              className="inline-flex px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Call (970) 999-1407
            </a>
          </div>
        </div>
      </section>

      {/* Explore Eaton */}
      <section className="py-16 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif text-white mb-6">Explore Eaton Before You Sell</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/northern-colorado-areas/eaton/"
              className="inline-flex px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Eaton Area Guide
            </Link>
            <Link
              to="/properties/?location=Eaton, CO"
              className="inline-flex px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors"
            >
              See Eaton Listings
            </Link>
          </div>
        </div>
      </section>

      <AreaFAQSection faqs={EATON_SELL_FAQS} city="Eaton" />

      {/* Final CTA */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Ready to Sell Your Eaton Home?</h2>
          <p className="text-gray-300 mb-8">
            Talk to Adam or Mandi Schwartz about listing your Eaton home. Call{" "}
            <a href="tel:(970) 999-1407" className="text-white font-semibold underline underline-offset-2 hover:text-[#CFB36E]">
              (970) 999-1407
            </a>{" "}
            or start with a free home valuation.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/for-sellers/#home-valuation"
              className="inline-block px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Free Home Valuation
            </Link>
            <Link
              to="/contact/"
              className="inline-block px-8 py-3 border-2 border-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors"
            >
              Contact SAA Homes
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-8">
            {BUSINESS.name} &bull; {formatBusinessAddress()} &bull; {BUSINESS.phone} &bull; Fair Housing Equal Opportunity
          </p>
        </div>
      </section>
    </>
  );
}
