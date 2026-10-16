import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import QualifyCta from "../components/QualifyCta";
import { BUSINESS } from "../utils/seoConstants";
import { buildFaqPageSchema } from "../data/moneyPageFaqs.js";
import { submitContactForm } from "../utils/api.js";
import { withLeadMetadata } from "../utils/leadTracking.js";
import { photoUrl } from "../utils/photoUrl.js";
import {
  getAssumableCity,
  getAssumableSearchPath,
  ASSUMABLE_CITIES_UPDATED,
} from "../data/assumableCities.js";

const GOLD = "var(--brand-accent)";
const SITE = "https://saahomes.com";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

/** First percentage near the assumption language in a listing's remarks. */
function rateFromRemarks(description) {
  const text = String(description || "");
  const idx = text.toLowerCase().indexOf("assum");
  const scope = idx === -1 ? text : text.slice(Math.max(0, idx - 80), idx + 120);
  const match = scope.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? `${match[1]}%` : null;
}

function LiveListingCard({ listing }) {
  const [imgFailed, setImgFailed] = useState(false);
  const address = [listing.street_number, listing.street_name].filter(Boolean).join(" ");
  const price = Number(listing.list_price);
  const rate = rateFromRemarks(listing.description);
  const beds = listing.beds != null ? `${Math.round(Number(listing.beds))} bd` : null;
  const baths = listing.baths != null ? `${Math.round(Number(listing.baths))} ba` : null;
  const sqft = listing.living_area != null ? `${Math.round(Number(listing.living_area)).toLocaleString()} sq ft` : null;

  return (
    <Link
      to={`/homes-for-sale/${listing.slug}/`}
      className="group block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-shadow"
    >
      <div className="relative aspect-[4/3] bg-[#1a1a1a] overflow-hidden">
        {imgFailed ? (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            Photo unavailable
          </div>
        ) : (
          <img
            src={photoUrl(listing.id, 0)}
            alt={address ? `${address}, Fort Collins, CO` : "Fort Collins home"}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        {rate && (
          <span
            className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: GOLD, color: "var(--brand-on-accent-ink)" }}
          >
            Assumable · {rate} in remarks
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold font-serif text-gray-900">{address || "Fort Collins listing"}</h3>
        <p className="text-sm text-gray-500 mb-2">
          {[listing.city, listing.postal_code].filter(Boolean).join(", ")}
        </p>
        <p className="text-2xl font-bold mb-2">{Number.isFinite(price) ? `$${price.toLocaleString()}` : "See listing"}</p>
        <p className="text-sm text-gray-600">
          {[beds, baths, sqft].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

function LeadForm({ cityName, source }) {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await submitContactForm(
        withLeadMetadata({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
          source,
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
      <div className="text-center py-10">
        <h3 className="text-2xl font-serif font-bold mb-3">Thank You</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          We have your information and will reach out within 24 hours to walk through
          whether assuming a loan works for your {cityName} purchase.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Your full name"
        className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[color:var(--brand-accent)] outline-none"
      />
      <input
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="your@email.com"
        className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[color:var(--brand-accent)] outline-none"
      />
      <input
        type="tel"
        required
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        placeholder="(970) 555-1234"
        className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[color:var(--brand-accent)] outline-none"
      />
      <textarea
        rows={3}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        placeholder={`Tell us which ${cityName} home or budget you are working with…`}
        className="w-full bg-white border border-gray-300 rounded-lg py-3 px-4 text-gray-900 placeholder-gray-400 focus:border-[color:var(--brand-accent)] outline-none"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-black text-white font-semibold py-3.5 px-6 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
      >
        {isSubmitting ? "Sending…" : "Talk to an agent about assuming a loan"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Schwartz and Associates · {BUSINESS.telephone} · We reply within 24 hours
      </p>
    </form>
  );
}

export default function AssumableCityPage({ slug }) {
  const city = getAssumableCity(slug);
  const [listings, setListings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    const params = new URLSearchParams({
      assumable: "true",
      city: city.city,
      limit: "20",
      sort: "newest",
    });
    fetch(`${API_BASE}/api/listings?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.data)) {
          setListings(data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [city]);

  if (!city) return null;

  const liveCount = listings ? listings.length : city.snapshot.fortCollinsActive;
  const searchPath = getAssumableSearchPath(city.city);
  const pageUrl = `${SITE}${city.path}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Assumable Mortgages", item: `${SITE}/assumable-mortgages/` },
      { "@type": "ListItem", position: 3, name: `Assumable Mortgages in ${city.city}`, item: pageUrl },
    ],
  };

  const faqSchema = buildFaqPageSchema(city.faqs);

  return (
    <>
      <SEO
        exactTitle={city.title}
        description={city.description}
        keywords={city.keywords}
        canonical={pageUrl}
        ogTitle={city.ogTitle}
        ogDescription={city.ogDescription}
        ogImage={`${SITE}${city.heroImage}`}
        ogUrl={pageUrl}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: `Assumable Mortgages in ${city.city}, Colorado`,
            description: city.description,
            url: pageUrl,
            serviceType: "Assumable mortgage (VA/FHA loan assumption) guidance",
            provider: {
              "@type": "RealEstateAgent",
              name: BUSINESS.name,
              url: BUSINESS.url,
              telephone: BUSINESS.telephone,
            },
            areaServed: `${city.city}, CO`,
            audience: { "@type": "Audience", audienceType: "Home buyers in Fort Collins, Colorado" },
          },
          breadcrumbSchema,
          faqSchema,
        ].filter(Boolean)}
      />

      {/* Hero */}
      <section
        className="relative bg-cover bg-center flex items-end sm:items-center justify-center pt-28 sm:pt-32 pb-16 sm:pb-20"
        style={{ backgroundImage: `url('${city.heroImage}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/50" />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: GOLD }} aria-hidden="true" />
        <div className="relative z-10 max-w-5xl mx-auto text-center text-white px-4 sm:px-6 w-full">
          <p
            className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase"
            style={{ backgroundColor: GOLD, color: "var(--brand-on-accent-ink)" }}
          >
            Schwartz and Associates · {city.city}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-tight">
            {city.h1}
          </h1>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-sans max-w-3xl mx-auto text-gray-100 leading-relaxed">
            {liveCount} active {city.city} listings whose MLS remarks mention an assumable VA or FHA
            loan, and what each one actually carries.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <a
              href="#assumable-city-lead-form"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation shadow-lg"
            >
              Get assumable mortgage help
            </a>
            <Link
              to={searchPath}
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              Search assumable homes
            </Link>
          </div>
        </div>
      </section>

      <QualifyCta
        program={`an assumable VA or FHA mortgage in ${city.city}`}
        headline={`Is assuming a loan the right move in ${city.city}?`}
        chatQuestion={`Hi! I'm looking at ${city.city} homes and wondering whether assuming a VA or FHA mortgage could save me money. Can you walk me through how it works?`}
        formAnchor="#assumable-city-lead-form"
        formLabel="Skip to the form"
      />

      {/* Answer-first + live inventory */}
      <section className="py-16 sm:py-20 px-6 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
            Live inventory
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center text-gray-900">
            {city.city} homes with an assumable loan right now
          </h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto text-center mb-4 leading-relaxed">
            {city.city} had {city.snapshot.fortCollinsActive} active homes whose public IRES MLS
            remarks mention an assumable VA or FHA loan on {city.snapshot.date}. Current {city.city}{" "}
            remarks carry rates from 2.25% to 5.56%. The count moves as homes go pending or new
            remarks hit the feed — this is a dated reading, not a standing inventory.
          </p>
          <p className="text-sm text-gray-500 max-w-3xl mx-auto text-center mb-10">
            IRES has no structured assumable-loan field, so we flag listings by their public remarks.
            Every flag still has to be confirmed with the lender. Listings shown update from the live
            feed; the rate shown is quoted from the listing&rsquo;s own remarks.
          </p>

          {listings && listings.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <LiveListingCard key={listing.id || listing.listing_id} listing={listing} />
              ))}
            </div>
          ) : loaded && listings && listings.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center rounded-xl border border-gray-200 bg-white p-8">
              <h3 className="text-xl font-bold font-serif text-gray-900 mb-2">
                No assumable {city.city} listings right now
              </h3>
              <p className="text-gray-700 leading-relaxed">
                The assumable flag comes and goes with the feed — it is not a standing inventory in one
                city. Save the live search with email and phone and we will alert you when a new{" "}
                {city.city} flag lands.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {city.examples.map((ex) => (
                <article key={ex.address} className="rounded-xl border border-gray-200 bg-white p-6">
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
                    {ex.loanType}
                    {ex.rate ? ` · ${ex.rate}` : ""}
                  </p>
                  <h3 className="text-lg font-bold font-serif text-gray-900 mb-1">{ex.address}</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {city.city}, CO {ex.zip} · Built {ex.year}
                  </p>
                  <p className="text-2xl font-bold mb-2">{ex.price}</p>
                  <p className="text-sm text-gray-600 mb-3">
                    {[ex.beds, ex.baths, ex.size].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{ex.note}</p>
                </article>
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              to={searchPath}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Open the live {city.city} assumable search
            </Link>
            <p className="text-xs text-gray-500 mt-3">
              {loaded && listings
                ? `Live feed read ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
                : `Snapshot from ${city.snapshot.date}. `}
              Confirm the loan with the servicer before you write.
            </p>
          </div>
        </div>
      </section>

      {/* Editorial sections */}
      <section className="py-16 sm:py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          {city.sections.map((section) => (
            <div key={section.heading} className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-4 text-gray-900">
                {section.heading}
              </h2>
              {section.paragraphs.map((p, i) => (
                <p key={i} className="text-lg text-gray-700 leading-relaxed mb-4">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Related links */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold font-serif mb-6 text-center text-gray-900">
            Keep going
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {city.relatedLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
              >
                <h3 className="font-bold text-gray-900 mb-1">{link.title}</h3>
                <p className="text-sm text-gray-600">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-12 text-center text-gray-900">
            {city.city} assumable loan questions
          </h2>
          <div className="space-y-6">
            {city.faqs.map((faq) => (
              <article key={faq.q} className="rounded-xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">{faq.q}</h3>
                <p className="text-gray-700 leading-relaxed">{faq.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section className="py-16 sm:py-20 px-6 bg-[#111] text-white" id="assumable-city-lead-form">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
              Get started
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
              See if an assumable mortgage fits your {city.city} purchase
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-6">
              Tell us the home you are considering. We will confirm whether it carries an assumable VA
              or FHA loan, connect you with a lender who can underwrite the assumption, and run the
              numbers honestly — the seller&rsquo;s rate versus a new loan at today&rsquo;s market.
            </p>
            <ul className="space-y-3 text-gray-200">
              <li className="flex items-start gap-3">
                <span style={{ color: GOLD }}>✓</span>
                Assumable-listing screening on every {city.city} search
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: GOLD }}>✓</span>
                VA-approved and FHA-experienced lender referrals
              </li>
              <li className="flex items-start gap-3">
                <span style={{ color: GOLD }}>✓</span>
                Remaining balance, term, and equity-gap math in writing
              </li>
            </ul>
            <p className="mt-8 text-gray-300">
              Prefer to talk? Call{" "}
              <a href={`tel:${BUSINESS.telephone.replace(/[^\d]/g, "")}`} className="font-semibold underline" style={{ color: GOLD }}>
                {BUSINESS.telephone}
              </a>
              . Updated {ASSUMABLE_CITIES_UPDATED} by Schwartz and Associates.
            </p>
          </div>
          <div className="bg-white text-gray-900 rounded-xl p-6 sm:p-8">
            <LeadForm cityName={city.city} source={`assumable-mortgages-${city.slug}`} />
          </div>
        </div>
      </section>
    </>
  );
}
