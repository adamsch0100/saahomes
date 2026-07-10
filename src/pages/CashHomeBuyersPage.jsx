import React, { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { BUSINESS } from "../utils/seoConstants";

const CITIES = [
  { name: "Fort Collins", slug: "fort-collins", tag: "CSU and Old Town" },
  { name: "Loveland", slug: "loveland", tag: "Sweetheart City charm" },
  { name: "Windsor", slug: "windsor", tag: "Family-friendly lakes" },
  { name: "Greeley", slug: "greeley", tag: "Affordable Weld County" },
  { name: "Timnath", slug: "timnath", tag: "New construction hub" },
  { name: "Berthoud", slug: "berthoud", tag: "Small-town feel" },
  { name: "Johnstown", slug: "johnstown", tag: "Growing I-25 corridor" },
  { name: "Severance", slug: "severance", tag: "Semi-rural retreat" },
  { name: "Wellington", slug: "wellington", tag: "North end value" },
];

const COMPARISON_ROWS = [
  {
    factor: "Timeline to close",
    cash: "7–14 days",
    traditional: "30–60 days",
    winner: "cash",
  },
  {
    factor: "Repairs needed",
    cash: "None — sold as-is",
    traditional: "Often required for top dollar",
    winner: "cash",
  },
  {
    factor: "Showings / open houses",
    cash: "None",
    traditional: "Yes — full marketing process",
    winner: "cash",
  },
  {
    factor: "Sale price",
    cash: "Below market value (convenience premium)",
    traditional: "Full market value or above",
    winner: "traditional",
  },
  {
    factor: "Agent commission",
    cash: "None (buyer side covered by cash buyer)",
    traditional: "Standard commission",
    winner: "cash",
  },
  {
    factor: "Seller concessions",
    cash: "None",
    traditional: "Possible (rate buydowns, closing costs)",
    winner: "cash",
  },
  {
    factor: "Best for",
    cash: "Urgent sales, distressed properties, absentee owners",
    traditional: "Maximizing profit, home in good condition",
    winner: "depends",
  },
  {
    factor: "Certainty of close",
    cash: "Very high (no financing contingency)",
    traditional: "Moderate (financing/appraisal contingencies)",
    winner: "cash",
  },
];

function CashBuyerLeadForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "",
    city: "",
    message: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch("/api/cash-buyer-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, source: "cash-home-buyers-page" }),
    }).catch(() => {});
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📬</div>
        <h3 className="text-2xl font-serif font-bold mb-3">Thank You</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          We&rsquo;ve received your information and will reach out within 24 hours.
          Whether you&rsquo;re selling for cash or looking to invest in Northern Colorado,
          we&rsquo;ll help you find the right path forward.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">
          Name
        </label>
        <input
          type="text" required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="Your full name"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">
          Email
        </label>
        <input
          type="email" required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="your@email.com"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">
          Phone
        </label>
        <input
          type="tel" required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="(970) 555-1234"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">
          I am interested in
        </label>
        <select
          value={form.interest}
          onChange={(e) => setForm({ ...form, interest: e.target.value })}
          className="w-full bg-gray-900 border border-gray-600 rounded py-3 px-4 text-white focus:border-[#CFB36E] outline-none transition-colors"
        >
          <option value="">Select one</option>
          <option value="selling-for-cash">Selling my home — want a cash offer</option>
          <option value="investor-buying">I&rsquo;m a cash buyer looking for investment properties</option>
          <option value="flip-property">Looking for fix-and-flip opportunities</option>
          <option value="both">Selling one property and buying another</option>
          <option value="exploring">Just exploring my options</option>
        </select>
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">
          Preferred city / area
        </label>
        <select
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="w-full bg-gray-900 border border-gray-600 rounded py-3 px-4 text-white focus:border-[#CFB36E] outline-none transition-colors"
        >
          <option value="">Select a city</option>
          {CITIES.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
          <option value="other">Another city / not sure</option>
        </select>
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">
          Tell us about your property or what you&rsquo;re looking for
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors resize-none"
          placeholder="Address, condition, timeline, budget, or any details you&rsquo;d like to share..."
        />
      </div>
      <button
        type="submit"
        className="w-full bg-[#CFB36E] hover:bg-[#c0a55e] text-black font-bold py-4 px-6 rounded transition-colors"
      >
        Send — No Obligation
      </button>
    </form>
  );
}

function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-4 px-3 font-semibold text-gray-300">Factor</th>
            <th className="text-left py-4 px-3 font-semibold text-[#CFB36E]">Cash Sale</th>
            <th className="text-left py-4 px-3 font-semibold text-gray-300">Traditional Listing</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, i) => (
            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
              <td className="py-4 px-3 font-medium">{row.factor}</td>
              <td className={`py-4 px-3 ${row.winner === "cash" ? "text-green-400" : "text-gray-400"}`}>
                {row.cash}{row.winner === "cash" && <span className="ml-2">✓</span>}
              </td>
              <td className={`py-4 px-3 ${row.winner === "traditional" ? "text-green-400" : "text-gray-400"}`}>
                {row.traditional}{row.winner === "traditional" && <span className="ml-2">✓</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CashHomeBuyersPage() {
  return (
    <>
      <SEO
        exactTitle="Cash Home Buyers Northern Colorado | Sell Your House Fast for Cash | SAA Homes"
        description="Sell your Northern Colorado home for cash — close in as little as 7 days, no repairs needed, no agent commissions. Also serving cash buyers and investors looking for flip properties in Fort Collins, Loveland, Windsor, and Greeley."
        keywords="cash home buyers Northern Colorado, sell my house fast Fort Collins, we buy houses Fort Collins, cash for homes Loveland, sell house for cash Windsor, cash home buyers Greeley, Northern Colorado real estate investors, sell my home fast Colorado, cash offer Fort Collins, we buy ugly houses Northern Colorado"
        canonical="https://saahomes.com/cash-home-buyers/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How does selling my home for cash work?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "You submit your property details, receive a no-obligation cash offer within 24 hours, and can close in as little as 7–14 days. No repairs, no showings, no agent commissions. SAA Homes connects you with vetted cash buyers or helps you evaluate whether a traditional listing would net you more.",
                },
              },
              {
                "@type": "Question",
                name: "Will I get less selling for cash vs listing traditionally?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Cash offers are typically below full market value because the buyer takes on the risk and convenience of an as-is, no-contingency purchase. However, when you factor in avoided repairs, no carrying costs during a 30–60 day listing period, and zero commission, the net difference is often smaller than sellers expect. SAA Homes will show you both paths so you can choose what is right for your situation.",
                },
              },
              {
                "@type": "Question",
                name: "Can SAA Homes help me find flip properties as a cash buyer?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. SAA Homes works with cash buyers, real estate investors, and house flippers across Northern Colorado. We can set you up with off-market leads, connect you with fix-and-flip opportunities, and help you build a portfolio in Fort Collins, Loveland, Windsor, Greeley, and all 19 Front Range communities we serve.",
                },
              },
              {
                "@type": "Question",
                name: "What cities do you cover for cash home buying?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "We serve all of Northern Colorado including Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Berthoud, Johnstown, Severance, Firestone, Frederick, Longmont, Boulder, Eaton, Evans, Milliken, Mead, La Salle, and Niwot. Each area has its own market dynamics and cash buyer demand.",
                },
              },
              {
                "@type": "Question",
                name: "Do I have to sell for cash, or can I list with SAA Homes instead?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Both options are available. Many sellers come to us for a quick cash offer and end up choosing a traditional listing once they see what their home could command on the open market. There is no obligation either way — we will give you honest advice based on your home's condition, your timeline, and your financial goals.",
                },
              },
            ],
          },
        ]}
      />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-24">
        <div className="absolute inset-0 bg-[url('/images/Northern Colorado.webp')] bg-cover bg-center opacity-10" />
        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <span className="inline-block bg-[#CFB36E]/20 text-[#CFB36E] text-sm uppercase tracking-widest px-4 py-2 rounded-full mb-6 font-semibold">
            Cash Sales &bull; Investor Services
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 leading-tight">
            Sell Your Northern Colorado Home<br />
            <span className="text-[#CFB36E]">For Cash — Or Invest With Confidence</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed">
            Whether you need to sell fast and move on, or you&rsquo;re a cash buyer looking for
            your next investment property, SAA Homes bridges both sides of the table.
            Close in as little as 7 days with a cash offer, or leverage our market expertise
            to find flip-ready properties across Northern Colorado.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="#cash-offer-form"
              className="inline-block bg-[#CFB36E] hover:bg-[#c0a55e] text-black font-bold py-4 px-8 rounded transition-colors"
            >
              Get a Cash Offer
            </a>
            <Link
              to="/for-sellers/"
              className="inline-block border-2 border-[#CFB36E] text-[#CFB36E] hover:bg-[#CFB36E] hover:text-black font-bold py-4 px-8 rounded transition-colors"
            >
              Compare Traditional Listing
            </Link>
          </div>
        </div>
      </section>

      {/* Two-Sided Funnel Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">Two Ways to Win</h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16 text-lg">
            SAA Homes serves both sides of the cash buyer market — sellers who need speed and
            investors who need deals.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Side A — Sellers */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-serif font-bold mb-3">Selling for Cash?</h3>
              <p className="text-gray-400 mb-6">
                Need to sell fast? No problem. We&rsquo;ll connect you with vetted cash buyers
                who can close in 7&ndash;14 days, as-is, no repairs, no showings. Or let us show
                you what your home would fetch on the open market — sometimes the traditional
                route nets you more, even after commissions.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Cash offer in 24 hours — no obligation</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Sell as-is — no repairs, no cleaning, no staging</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Close in 7&ndash;14 days on your timeline</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Zero agent commission out of pocket</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Compare: cash offer vs. traditional listing — honest advice</span>
                </li>
              </ul>
              <a
                href="#cash-offer-form"
                className="inline-block w-full text-center bg-[#CFB36E] hover:bg-[#c0a55e] text-black font-bold py-3 px-6 rounded transition-colors"
              >
                Get Your Cash Offer
              </a>
            </div>

            {/* Side B — Investors */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700">
              <div className="text-4xl mb-4">🏠</div>
              <h3 className="text-2xl font-serif font-bold mb-3">Cash Buyer or Investor?</h3>
              <p className="text-gray-400 mb-6">
                Looking for flip properties, rentals, or your next deal? SAA Homes has boots
                on the ground across all 19 Northern Colorado markets. We&rsquo;ll help you
                find off-market leads, evaluate comps, and move fast when the right property
                comes up.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Off-market and pre-market property leads</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Fix-and-flip and buy-and-hold opportunities</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>City-by-city market data and comp analysis</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Multi-property portfolio building support</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Fast closings — we know the local lenders and title teams</span>
                </li>
              </ul>
              <a
                href="#cash-offer-form"
                className="inline-block w-full text-center border-2 border-[#CFB36E] text-[#CFB36E] hover:bg-[#CFB36E] hover:text-black font-bold py-3 px-6 rounded transition-colors"
              >
                Connect as an Investor
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Cash Sale vs Traditional Sale Comparison */}
      <section className="py-20 bg-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">
            Cash Sale vs. Traditional Listing
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12 text-lg">
            Both paths have their place. Here&rsquo;s how they compare — and why the right
            choice depends on your situation.
          </p>
          <ComparisonTable />
          <div className="text-center mt-10">
            <Link
              to="/for-sellers/"
              className="inline-block bg-[#CFB36E] hover:bg-[#c0a55e] text-black font-bold py-3 px-8 rounded transition-colors"
            >
              Learn More About Listing With SAA Homes
            </Link>
          </div>
        </div>
      </section>

      {/* City Coverage */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">
            Cash Buyer Markets We Cover
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12 text-lg">
            Active cash buyer demand exists across all of Northern Colorado. We serve every
            major market from Boulder County to the Weld County line.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {CITIES.map((city) => (
              <Link
                key={city.slug}
                to={`/northern-colorado-areas/${city.slug}/`}
                className="block bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-5 transition-colors group"
              >
                <h3 className="font-bold text-lg group-hover:text-[#CFB36E] transition-colors">
                  {city.name}
                </h3>
                <p className="text-sm text-gray-400 mt-1">{city.tag}</p>
                <span className="text-xs text-[#CFB36E] mt-2 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                  View area guide →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Form */}
      <section id="cash-offer-form" className="py-20 bg-gray-800">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 md:p-12 border border-gray-700">
            <h2 className="text-3xl font-serif font-bold text-center mb-3">
              Get Your Cash Offer or Connect as an Investor
            </h2>
            <p className="text-gray-400 text-center mb-10">
              No obligation. No pressure. Just straight answers about your options.
            </p>
            <CashBuyerLeadForm />
          </div>
          <p className="text-xs text-gray-500 text-center mt-6">
            {BUSINESS.name} &bull; {BUSINESS.address} &bull; {BUSINESS.phone} &bull; Fair Housing Equal Opportunity
          </p>
        </div>
      </section>

      {/* Foreclosure & Short Sale Help Section */}
      <section className="py-16 bg-gray-800 border-t border-gray-700">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <span className="inline-block bg-red-900/30 text-red-400 text-xs uppercase tracking-widest px-3 py-1 rounded-full mb-4 font-semibold">Distressed Seller Help</span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Facing Foreclosure or Need a Short Sale?
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              If you&rsquo;re behind on payments, facing a notice of default, or owe more than your
              home is worth — you have options. SAA Homes helps Northern Colorado homeowners
              navigate foreclosures, short sales, and pre-foreclosure sales so you can protect
              your credit and move forward.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="text-red-400 text-3xl mb-3">⚖️</div>
              <h3 className="text-xl font-bold mb-3">Pre-Foreclosure Sale</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Selling before the foreclosure auction gives you control. You set the terms,
                avoid a public trustee sale on your record, and may preserve some equity.
                We work with lenders to negotiate payoff amounts and timeline.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="text-red-400 text-3xl mb-3">📄</div>
              <h3 className="text-xl font-bold mb-3">Short Sale Assistance</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Owe more than the home is worth? A short sale lets you sell for less than
                the mortgage balance with the lender&rsquo;s approval. It&rsquo;s less damaging
                to your credit than a foreclosure, and we handle the lender negotiations.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="text-red-400 text-3xl mb-3">🏠</div>
              <h3 className="text-xl font-bold mb-3">Cash Offer Backup</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                If you need to sell fast to avoid foreclosure, a cash buyer can close in
                7&ndash;14 days — often faster than the foreclosure timeline. Cash buyers
                purchase as-is, meaning no repair costs before sale.
              </p>
            </div>
          </div>

          <div className="mt-10 bg-gray-900 rounded-xl p-6 md:p-8 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-center">Colorado Foreclosure Timeline — What to Expect</h3>
            <div className="space-y-4 text-sm text-gray-400">
              <div className="flex items-start gap-4">
                <span className="bg-red-900/40 text-red-400 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div>
                  <span className="text-white font-semibold">Notice of Filing (Rule 120)</span>
                  <p>The lender files a public notice with the county public trustee. You&rsquo;ll receive a summons. You have 20 days to respond.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="bg-red-900/40 text-red-400 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div>
                  <span className="text-white font-semibold">Notice of Sale</span>
                  <p>The public trustee records a sale date — typically 110-125 days after the initial filing. This notice is published in local newspapers.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="bg-red-900/40 text-red-400 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">3</span>
                <div>
                  <span className="text-white font-semibold">Public Trustee Sale (Auction)</span>
                  <p>If no resolution is reached, the property is auctioned at the county courthouse. The property can still be sold up to the day before the sale.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="bg-green-500/40 text-green-400 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">✓</span>
                <div>
                  <span className="text-white font-semibold">You have options at every stage</span>
                  <p>Whether you&rsquo;re at the first notice or days before auction, selling your home or negotiating a short sale can stop the process. Contact us — we&rsquo;ll walk through what&rsquo;s possible for your situation.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <a
              href="#cash-offer-form"
              className="inline-block px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors"
            >
              Get Help — Free Consultation
            </a>
            <p className="text-gray-500 text-sm mt-3">
              No judgment. No obligation. Just straight talk about your options.
            </p>
          </div>
        </div>
      </section>

      {/* About / Credentials */}
      <section className="py-16 bg-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-bold mb-4">
            Why Work With SAA Homes for Cash Transactions?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-left mt-10">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-[#CFB36E] text-3xl mb-3">01</div>
              <h3 className="font-bold mb-2">Both Sides of the Table</h3>
              <p className="text-sm text-gray-400">
                We work with sellers seeking cash offers AND investors looking for deals.
                That means we understand what makes a property attractive to cash buyers
                and what investors are looking for.
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-[#CFB36E] text-3xl mb-3">02</div>
              <h3 className="font-bold mb-2">19-City Coverage</h3>
              <p className="text-sm text-gray-400">
                From Boulder to Greeley, Fort Collins to Firestone — we know the comps,
                the demand patterns, and the off-market opportunities in every Northern
                Colorado market.
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-[#CFB36E] text-3xl mb-3">03</div>
              <h3 className="font-bold mb-2">Honest Path Guidance</h3>
              <p className="text-sm text-gray-400">
                We won&rsquo;t push you into a cash sale if a traditional listing makes
                more sense — or vice versa. Our job is to show you both numbers and let
                you decide what fits your goals.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
