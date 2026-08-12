import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import ListingPhotoFallback from "../components/ListingPhotoFallback.jsx";
import { BUSINESS } from "../utils/seoConstants";
import { photoUrl } from "../utils/photoUrl.js";
import {
  formatPrice,
  isLandListing,
  listingAddress,
  listingStatsLine,
} from "../utils/listingHelpers.js";
import {
  CITY_MARKET_CONTEXT,
  LUXURY_CLIENT_PROMISES,
  LUXURY_HUB_FAQS,
  MILLION_PLUS_DISPLAY,
  MILLION_PLUS_FEATURED_SLUGS,
  MILLION_PLUS_LABEL,
  MILLION_PLUS_PRICE,
  getFeaturedMillionPlusCities,
  getMillionPlusNeighborhoods,
  millionPlusSearchHref,
} from "../data/luxuryMarket.js";
import { buildFaqPageSchema } from "../data/moneyPageFaqs.js";

const HERO_FALLBACK = "/images/Boulder.jpg";
const CITY_FALLBACK = {
  boulder: "/images/Boulder.jpg",
  "fort-collins": "/images/buyers-hero.jpg",
  windsor: "/images/buyers-hero.jpg",
  loveland: "/images/sell-hero-1.jpg",
};

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const FEATURED_CITY_QUERY = "Boulder,Fort Collins,Windsor,Loveland";

function isResidentialMillionPlus(listing) {
  if (!listing) return false;
  if (Number(listing.list_price) < MILLION_PLUS_PRICE) return false;
  if (isLandListing(listing)) return false;
  const beds = Number(listing.beds);
  if (!Number.isFinite(beds) || beds <= 0) return false;
  return true;
}

function citySlugFromListing(listing) {
  const city = (listing?.city || "").toLowerCase();
  if (city === "fort collins") return "fort-collins";
  if (city === "boulder") return "boulder";
  if (city === "windsor") return "windsor";
  if (city === "loveland") return "loveland";
  return "";
}

function LuxuryLeadForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    preference: "",
    message: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        interest: "luxury-real-estate",
        source: "luxury-page",
      }),
    }).catch(() => {});
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-10">
        <p className="text-[#CFB36E] text-xs uppercase tracking-[0.28em] mb-4">Received</p>
        <h3 className="text-2xl font-serif text-white mb-3">We have your note.</h3>
        <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
          Adam or Mandi will reply privately. If the matter is time-sensitive, call{" "}
          <a href="tel:9709991407" className="text-[#CFB36E] hover:text-white">
            (970) 999-1407
          </a>
          .
        </p>
      </div>
    );
  }

  const fieldClass =
    "w-full bg-transparent border-b border-white/20 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[11px] uppercase tracking-[0.22em] text-gray-400 mb-2">Name</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={fieldClass}
          placeholder="Full name"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.22em] text-gray-400 mb-2">Email *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={fieldClass}
          placeholder="private@email.com"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.22em] text-gray-400 mb-2">Phone *</label>
        <input
          type="tel"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={fieldClass}
          placeholder="(970) 999-1407"
          autoComplete="tel"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.22em] text-gray-400 mb-2">I am</label>
        <select
          value={form.preference}
          onChange={(e) => setForm({ ...form, preference: e.target.value })}
          className="w-full bg-[#141414] border border-white/15 py-3 px-3 text-white focus:border-[#CFB36E] outline-none"
        >
          <option value="">Select one</option>
          <option value="buying-luxury">Acquiring a $1M+ home</option>
          <option value="selling-luxury">Selling a $1M+ property</option>
          <option value="both">Both</option>
          <option value="just-looking">Exploring the $1M+ market</option>
        </select>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-[0.22em] text-gray-400 mb-2">
          What should we know
        </label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className={`${fieldClass} resize-none`}
          placeholder="Location, property, or timing"
        />
      </div>
      <button
        type="submit"
        className="w-full py-3.5 border border-[#CFB36E] text-[#CFB36E] text-sm tracking-[0.22em] uppercase hover:bg-[#CFB36E] hover:text-black transition-colors"
      >
        Enquire
      </button>
      <p className="text-xs text-gray-500 text-center leading-relaxed">
        Private and discreet. Email and phone required. Your information is not shared.
      </p>
    </form>
  );
}

function ListingImage({ listingId, alt, className, fallbackSrc }) {
  const [failed, setFailed] = useState(false);
  if (!listingId || failed) {
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          className={className}
          loading="lazy"
          decoding="async"
        />
      );
    }
    return <ListingPhotoFallback className={`${className} absolute inset-0`} />;
  }
  return (
    <img
      src={photoUrl(listingId, 0)}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export default function LuxuryRealEstatePage() {
  const faqSchema = buildFaqPageSchema(LUXURY_HUB_FAQS);
  const featured = getFeaturedMillionPlusCities();
  const [listings, setListings] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams({
      city: FEATURED_CITY_QUERY,
      minPrice: String(MILLION_PLUS_PRICE),
      type: "house",
      limit: "24",
      sort: "price-desc",
    });
    fetch(`${API_BASE}/api/listings?${params.toString()}`)
      .then((r) => r.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setListings(rows.filter(isResidentialMillionPlus));
      })
      .catch(() => setListings([]));
  }, []);

  const listingsByCity = useMemo(() => {
    const map = {};
    for (const listing of listings) {
      const slug = citySlugFromListing(listing);
      if (!slug || map[slug]) continue;
      map[slug] = listing;
    }
    return map;
  }, [listings]);

  const selectedResidences = useMemo(() => {
    const seen = new Set();
    const picked = [];
    for (const listing of listings) {
      const key = listing.id || listing.slug;
      if (!key || seen.has(key)) continue;
      if (!listing.slug) continue;
      seen.add(key);
      picked.push(listing);
      if (picked.length >= 6) break;
    }
    return picked;
  }, [listings]);

  const heroListing = listingsByCity.boulder || listings[0] || null;
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Luxury Real Estate",
        item: "https://saahomes.com/luxury-real-estate/",
      },
    ],
  };

  return (
    <>
      <SEO
        exactTitle="Luxury Real Estate in Northern Colorado | $1M+ Homes | SAA Homes — Schwartz and Associates"
        description="Private representation for Northern Colorado’s $1 million and above homes — Boulder, Fort Collins, Windsor, and Loveland. Discretion, off-market access, and direct service from Adam and Mandi Schwartz at SAA Homes. Call (970) 999-1407."
        keywords="luxury real estate Northern Colorado, $1 million homes Fort Collins, million dollar homes Boulder, luxury real estate agent Fort Collins, Boulder luxury homes, Windsor luxury homes, high-end real estate Loveland, luxury realtor Northern Colorado, off-market luxury homes Colorado, private estates Northern Colorado"
        canonical="https://saahomes.com/luxury-real-estate/"
        ogImage="https://saahomes.com/images/Boulder.jpg"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Luxury Real Estate — $1M+ Northern Colorado",
            description:
              "Private-client representation for Northern Colorado homes at $1 million and above, across Boulder, Fort Collins, Loveland, Windsor, and the Front Range corridor.",
            url: "https://saahomes.com/luxury-real-estate/",
            provider: {
              "@type": "RealEstateAgent",
              name: BUSINESS.name,
              url: BUSINESS.url,
              telephone: BUSINESS.telephone,
            },
            areaServed: [
              "Boulder, CO",
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
      <section className="relative h-[70vh] min-h-[520px] bg-cover bg-center flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-[#111]" aria-hidden="true" />
        {heroListing ? (
          <ListingImage
            listingId={heroListing.id}
            fallbackSrc={HERO_FALLBACK}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={HERO_FALLBACK}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 pb-16 sm:pb-20 w-full">
          <p className="text-[#CFB36E] tracking-[0.28em] text-[11px] sm:text-xs uppercase mb-5">
            Schwartz and Associates · {MILLION_PLUS_LABEL}
          </p>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif font-bold text-white mb-5 leading-[1.05]">
            The $1M+ Market, Mastered.
          </h1>
          <p className="text-lg sm:text-xl text-gray-200 max-w-2xl leading-relaxed mb-8 font-serif">
            Private estates, exceptional homes, discreet service.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <a
              href="#private-consultation"
              className="inline-flex items-center justify-center px-8 py-3.5 border border-[#CFB36E] text-[#CFB36E] text-sm tracking-[0.18em] uppercase hover:bg-[#CFB36E] hover:text-black transition-colors"
            >
              Private Consultation
            </a>
            <a
              href="tel:9709991407"
              className="inline-flex items-center justify-center px-8 py-3.5 text-white text-sm tracking-[0.12em] hover:text-[#CFB36E] transition-colors"
            >
              (970) 999-1407
            </a>
          </div>
        </div>
      </section>

      {/* Opening narrative */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-[#FAF7F2]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[#CFB36E] tracking-[0.24em] text-[11px] uppercase mb-5">
            For this buyer. For this seller.
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1a1a1a] mb-8 leading-tight">
            Northern Colorado&apos;s most significant homes.
          </h2>
          <div className="w-12 h-px bg-[#CFB36E] mx-auto mb-8" />
          <p className="text-lg text-[#3a3a3a] leading-relaxed mb-5">
            For buyers and sellers of Northern Colorado&apos;s most significant homes — the{" "}
            {MILLION_PLUS_LABEL} tier — representation is a matter of discretion, market command,
            and execution. Adam and Mandi Schwartz work this market directly: one call, no
            handoffs, no theatrics.
          </p>
          <p className="text-base text-[#5a5a5a] leading-relaxed mb-8">
            Boulder&apos;s true luxury sits well above $2 million. Fort Collins estates run to $2
            million and beyond. Windsor concentrates much of the region&apos;s {MILLION_PLUS_DISPLAY}{" "}
            inventory in Water Valley and Pelican Lakes. We work the tier as it actually exists.
          </p>
          <p className="text-sm text-[#6a6a6a]">
            <Link to="/for-buyers/" className="underline underline-offset-4 hover:text-[#1a1a1a]">
              Buyer representation
            </Link>
            <span className="mx-2 text-[#CFB36E]">·</span>
            <Link to="/for-sellers/" className="underline underline-offset-4 hover:text-[#1a1a1a]">
              Seller representation
            </Link>
            <span className="mx-2 text-[#CFB36E]">·</span>
            <Link
              to="/blog/luxury-home-buying-guide-northern-colorado/"
              className="underline underline-offset-4 hover:text-[#1a1a1a]"
            >
              Luxury buying guide
            </Link>
          </p>
        </div>
      </section>

      {/* $1M+ by city */}
      <section className="py-20 sm:py-24 px-5 sm:px-8 bg-white" id="market-at-a-glance">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.24em] text-[11px] uppercase mb-4 text-center">
            The {MILLION_PLUS_DISPLAY} tier
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-[#1a1a1a]">
            Where $1 million and above actually lives
          </h2>
          <p className="text-[#6a6a6a] text-center max-w-2xl mx-auto mb-14 text-sm leading-relaxed">
            Citywide medians are not luxury averages. Each line below is the $1M+ reality in that
            city, drawn from our published market notes. Live asking prices come from IRES.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {featured.map(({ slug, context, threshold }) => {
              const listing = listingsByCity[slug];
              return (
                <article key={slug} className="group relative min-h-[22rem] sm:min-h-[26rem] overflow-hidden bg-[#111]">
                  <ListingImage
                    listingId={listing?.id}
                    fallbackSrc={CITY_FALLBACK[slug] || HERO_FALLBACK}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
                  <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end">
                    <p className="text-[#CFB36E] text-[11px] tracking-[0.22em] uppercase mb-2">
                      {MILLION_PLUS_DISPLAY} · {context.county}
                    </p>
                    <h3 className="text-3xl font-serif font-bold text-white mb-3">{context.city}</h3>
                    <p className="text-gray-200 text-sm leading-relaxed max-w-md mb-5">
                      {threshold.millionPlusReality}
                    </p>
                    <p className="text-gray-400 text-xs mb-5">
                      Citywide median / range: {context.medianDisplay}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      <Link
                        to={`/northern-colorado-areas/${slug}/#luxury-homes`}
                        className="text-sm text-white underline underline-offset-4 hover:text-[#CFB36E]"
                      >
                        City guide
                      </Link>
                      <Link
                        to={millionPlusSearchHref(context.city)}
                        className="text-sm text-[#CFB36E] hover:text-white"
                      >
                        Live {MILLION_PLUS_DISPLAY} listings
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-center text-[#8a8a8a] text-xs mt-10 leading-relaxed">
            Also in this corridor:{" "}
            <Link to="/northern-colorado-areas/timnath/#luxury-homes" className="underline hover:text-[#1a1a1a]">
              Timnath
            </Link>{" "}
            (Bridle Ridge, Timnath Ranch) ·{" "}
            <Link to="/northern-colorado-areas/greeley/#luxury-homes" className="underline hover:text-[#1a1a1a]">
              Greeley
            </Link>{" "}
            (Pine Ridge Estates, west-side acreage). Citywide medians from mid/July 2026 area notes.
          </p>
        </div>
      </section>

      {/* Selected residences — live $1M+ via photoUrl proxy */}
      {selectedResidences.length > 0 && (
        <section className="py-20 sm:py-24 px-5 sm:px-8 bg-[#111] text-white" id="selected-residences">
          <div className="max-w-6xl mx-auto">
            <p className="text-[#CFB36E] tracking-[0.24em] text-[11px] uppercase mb-4 text-center">
              Selected residences
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center">
              On the market at {MILLION_PLUS_DISPLAY}
            </h2>
            <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12 text-sm leading-relaxed">
              Live IRES inventory in Boulder, Fort Collins, Windsor, and Loveland. Photographs are
              the listing&apos;s own — served through our photo proxy.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectedResidences.map((listing) => {
                const addr = listingAddress(listing);
                const stats = listingStatsLine(listing);
                return (
                  <Link
                    key={listing.id || listing.slug}
                    to={`/homes-for-sale/${listing.slug}/`}
                    className="group block bg-[#1a1a1a] overflow-hidden"
                  >
                    <div className="relative aspect-[4/3] bg-black overflow-hidden">
                      <ListingImage
                        listingId={listing.id}
                        fallbackSrc={HERO_FALLBACK}
                        alt={addr ? `${addr} in ${listing.city}` : `Residence in ${listing.city}`}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                      <span className="absolute bottom-3 left-3 text-white text-sm font-serif tracking-wide">
                        {formatPrice(listing.list_price)}
                      </span>
                    </div>
                    <div className="p-5">
                      <p className="text-[#CFB36E] text-[11px] tracking-[0.18em] uppercase mb-1">
                        {listing.city}
                      </p>
                      <p className="text-white font-serif text-lg truncate">{addr || listing.city}</p>
                      {stats ? <p className="text-gray-400 text-sm mt-1">{stats}</p> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="text-center mt-10">
              <Link
                to={millionPlusSearchHref("")}
                className="inline-flex items-center justify-center px-8 py-3 border border-[#CFB36E] text-[#CFB36E] text-sm tracking-[0.18em] uppercase hover:bg-[#CFB36E] hover:text-black transition-colors"
              >
                All {MILLION_PLUS_DISPLAY} listings
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Neighborhoods */}
      <section className="py-20 sm:py-24 px-5 sm:px-8 bg-[#FAF7F2]" id="luxury-neighborhoods">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.24em] text-[11px] uppercase mb-4 text-center">
            Addresses
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-[#1a1a1a]">
            Neighborhoods where {MILLION_PLUS_DISPLAY} concentrates
          </h2>
          <p className="text-[#6a6a6a] text-center mb-14 max-w-2xl mx-auto text-sm">
            Published neighborhood ranges from our guides. Only communities whose range reaches $1
            million and above.
          </p>
          <div className="space-y-12">
            {MILLION_PLUS_FEATURED_SLUGS.map((slug) => {
              const ctx = CITY_MARKET_CONTEXT[slug];
              const list = getMillionPlusNeighborhoods(slug).slice(0, 6);
              if (!ctx || list.length === 0) return null;
              return (
                <div key={slug}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                    <h3 className="text-2xl font-serif font-bold text-[#1a1a1a]">{ctx.city}</h3>
                    <Link
                      to={`/northern-colorado-areas/${slug}/#luxury-homes`}
                      className="text-sm text-[#1a1a1a] underline underline-offset-4 hover:text-[#CFB36E]"
                    >
                      {ctx.city} luxury context
                    </Link>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map((n) => (
                      <Link
                        key={n.slug}
                        to={`/northern-colorado-areas/${slug}/${n.slug}/`}
                        className="block p-5 bg-white border border-black/5 hover:border-[#CFB36E] transition-colors"
                      >
                        <span className="font-serif text-lg text-[#1a1a1a]">{n.name}</span>
                        <span className="block text-sm text-[#6a6a6a] mt-1">{n.priceHint}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Private client promise + form */}
      <section className="py-20 sm:py-24 px-5 sm:px-8 bg-white" id="private-consultation">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 lg:gap-20 items-start">
          <div>
            <p className="text-[#CFB36E] tracking-[0.24em] text-[11px] uppercase mb-4">
              Private client
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-6 text-[#1a1a1a] leading-tight">
              How we work at this level
            </h2>
            <div className="w-12 h-px bg-[#CFB36E] mb-10" />
            <ul className="space-y-8">
              {LUXURY_CLIENT_PROMISES.map((item) => (
                <li key={item.title}>
                  <h3 className="font-serif text-xl text-[#1a1a1a] mb-2">{item.title}</h3>
                  <p className="text-[#4a4a4a] text-sm leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#111] p-8 sm:p-10 border-t border-[#CFB36E]">
            <p className="text-[#CFB36E] text-[11px] uppercase tracking-[0.24em] mb-3">
              Private consultation
            </p>
            <h3 className="text-2xl font-serif text-white mb-3">Enquire in confidence</h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              A brief note is enough. Adam or Mandi replies personally. Email and phone required.
            </p>
            <LuxuryLeadForm />
          </div>
        </div>
      </section>

      {/* Guides */}
      <section className="py-16 px-5 sm:px-8 bg-[#FAF7F2] border-t border-black/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-[#1a1a1a] mb-8 text-center">
            Guides
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                to: "/blog/luxury-home-buying-guide-northern-colorado/",
                title: "Luxury Home Buying Guide",
                desc: "Regional price tiers, city by city",
              },
              {
                to: "/blog/fort-collins-luxury-neighborhoods-guide/",
                title: "Fort Collins Luxury Neighborhoods",
                desc: "Horsetooth, Old Town, premier communities",
              },
              {
                to: "/for-buyers/",
                title: "For Buyers",
                desc: "Representation at every price tier",
              },
              {
                to: "/for-sellers/",
                title: "For Sellers",
                desc: "Pricing and marketing for significant homes",
              },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="p-5 bg-white border border-black/5 hover:border-[#CFB36E] transition-colors"
              >
                <h3 className="font-serif text-lg text-[#1a1a1a] mb-1">{item.title}</h3>
                <p className="text-sm text-[#6a6a6a]">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-24 px-5 sm:px-8 bg-white" id="luxury-faq">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.24em] text-[11px] uppercase mb-4 text-center">
            Questions
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-[#1a1a1a]">
            The $1M+ conversation
          </h2>
          <p className="text-[#6a6a6a] text-center mb-12 text-sm">
            Answers from published market notes and how we actually work. No invented luxury comps.
          </p>
          <div className="space-y-3">
            {LUXURY_HUB_FAQS.map((faq) => (
              <details key={faq.q} className="group border border-black/10 bg-[#FAF7F2]">
                <summary className="flex items-center justify-between px-5 sm:px-6 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base sm:text-lg font-serif pr-4 text-[#1a1a1a]">{faq.q}</h3>
                  <span
                    className="flex-shrink-0 text-[#CFB36E] text-lg leading-none transition-transform duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <div className="px-5 sm:px-6 pb-5 text-[#3a3a3a] text-sm sm:text-base leading-relaxed border-t border-black/5 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="py-20 px-5 sm:px-8 bg-[#111] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.24em] text-[11px] uppercase mb-4">
            Direct access
          </p>
          <h2 className="text-3xl sm:text-5xl font-serif font-bold mb-6 leading-tight">
            One call.
          </h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Boulder, Fort Collins, Loveland, Windsor, and the corridor beyond. Adam and Mandi
            Schwartz — Schwartz and Associates, SAA Homes.
          </p>
          <a
            href="tel:9709991407"
            className="inline-block text-2xl sm:text-3xl font-serif text-[#CFB36E] hover:text-white transition-colors mb-8"
          >
            (970) 999-1407
          </a>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#private-consultation"
              className="inline-block px-8 py-3.5 border border-[#CFB36E] text-[#CFB36E] text-sm tracking-[0.18em] uppercase hover:bg-[#CFB36E] hover:text-black transition-colors"
            >
              Private Consultation
            </a>
            <Link
              to="/contact/"
              className="inline-block px-8 py-3.5 text-white text-sm tracking-[0.12em] hover:text-[#CFB36E] transition-colors"
            >
              Write to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
