import React, { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { BUSINESS } from "../utils/seoConstants";
import {
  CITY_MARKET_CONTEXT,
  LUXURY_BUYER_PERSONAS,
  LUXURY_HUB_FAQS,
  LUXURY_THRESHOLDS,
  getLuxuryNeighborhoods,
  luxurySearchHref,
} from "../data/luxuryMarket.js";
import { buildFaqPageSchema } from "../data/moneyPageFaqs.js";

function LuxuryLeadForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", preference: "", message: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, interest: "luxury-real-estate", source: "luxury-page" }),
    }).catch(() => {});
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4" aria-hidden="true">✉️</div>
        <h3 className="text-2xl font-serif font-bold mb-3">Thank You</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          We will reach out within 24 hours to schedule your private consultation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">Name</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="Your full name"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">Email *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="your@email.com"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">Phone *</label>
        <input
          type="tel"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="(970) 555-1234"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">I am interested in</label>
        <select
          value={form.preference}
          onChange={(e) => setForm({ ...form, preference: e.target.value })}
          className="w-full bg-gray-900 border border-gray-600 rounded py-3 px-4 text-white focus:border-[#CFB36E] outline-none transition-colors"
        >
          <option value="">Select one</option>
          <option value="buying-luxury">Buying a luxury home</option>
          <option value="selling-luxury">Selling a luxury property</option>
          <option value="both">Both buying and selling</option>
          <option value="just-looking">Exploring the market</option>
        </select>
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">A little about what you are looking for</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors resize-none"
          placeholder="Location, price range, timeline..."
        />
      </div>
      <button
        type="submit"
        className="w-full py-4 bg-[#CFB36E] text-black font-bold text-lg tracking-wider hover:bg-[#C4A65A] transition-colors"
      >
        REQUEST PRIVATE CONSULTATION
      </button>
      <p className="text-xs text-gray-500 text-center">
        Private &amp; discreet. Email and phone required. Your information will not be shared.
      </p>
    </form>
  );
}

const LUXURY_CITIES = [
  {
    name: "Boulder",
    slug: "boulder",
    description:
      "Highest-end inventory in the region — Chautauqua, Mapleton Hill, Wonderland Lake, Flatirons estates, and Pine Brook Hills. Many properties list well above $2M.",
    price: LUXURY_THRESHOLDS.boulder.thresholdDisplay,
    image: "/images/Boulder.jpg",
  },
  {
    name: "Fort Collins",
    slug: "fort-collins",
    description:
      "Exclusive foothills estates west of town, custom mountain-view homes, Old Town historic prestige, and executive golf-course communities.",
    price: LUXURY_THRESHOLDS["fort-collins"].thresholdDisplay,
    image: "/images/Fort-Collins-CO-Area-Guide.jpg",
  },
  {
    name: "Loveland",
    slug: "loveland",
    description:
      "Lakefront estates on Lake Loveland, custom homes near Mariana Butte, Centerra, and luxury properties backing to open space.",
    price: LUXURY_THRESHOLDS.loveland.thresholdDisplay,
    image: "/images/Loveland-CO-Area-Guide.jpg",
  },
  {
    name: "Windsor",
    slug: "windsor",
    description:
      "Premier golf and lake communities — Water Valley, Pelican Lakes, RainDance — plus horse properties and new custom construction.",
    price: LUXURY_THRESHOLDS.windsor.thresholdDisplay,
    image: "/images/Windsor-CO-Area-Guide.jpg",
  },
  {
    name: "Greeley",
    slug: "greeley",
    description:
      "Executive estates on acreage, Pine Ridge Estates, historic Glenmere, and custom homes offering strong value per square foot.",
    price: LUXURY_THRESHOLDS.greeley.thresholdDisplay,
    image: "/images/Area-Guide-for-Greeley-CO.jpg",
  },
  {
    name: "Timnath",
    slug: "timnath",
    description:
      "New-construction luxury along the I-25 corridor — Bridle Ridge, Timnath Ranch executive homes, and lakeside communities.",
    price: LUXURY_THRESHOLDS.timnath.thresholdDisplay,
    image: "/images/Northern Colorado.webp",
  },
];

const GLANCE_CITIES = ["fort-collins", "loveland", "windsor", "greeley", "boulder"];

const HUB_NEIGHBORHOOD_CITIES = [
  { slug: "boulder", limit: 6 },
  { slug: "fort-collins", limit: 6 },
  { slug: "loveland", limit: 4 },
  { slug: "windsor", limit: 5 },
  { slug: "greeley", limit: 3 },
  { slug: "timnath", limit: 3 },
];

export default function LuxuryRealEstatePage() {
  const faqSchema = buildFaqPageSchema(LUXURY_HUB_FAQS);

  return (
    <>
      <SEO
        exactTitle="Luxury Real Estate in Northern Colorado | SAA Homes — Schwartz and Associates"
        description="Discover exceptional luxury properties across Boulder, Fort Collins, Loveland, Windsor, Greeley, and Timnath. Private consultations, white-glove service, and exclusive high-end home guidance from Schwartz and Associates — your Northern Colorado luxury real estate agent."
        keywords="luxury real estate Northern Colorado, luxury homes Fort Collins, luxury real estate agent Fort Collins, Boulder luxury homes, high-end real estate Loveland, luxury properties Windsor CO, luxury realtor Northern Colorado, million dollar homes Fort Collins, custom homes Northern Colorado, horse properties Colorado, golf course homes Windsor, lakefront homes Loveland, Chautauqua Boulder real estate, Mapleton Hill Boulder"
        canonical="https://saahomes.com/luxury-real-estate/"
        ogImage="https://saahomes.com/images/Northern Colorado.webp"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Luxury Real Estate — Northern Colorado",
            description:
              "Premium luxury real estate services across Northern Colorado's finest communities: Boulder, Fort Collins, Loveland, Windsor, Greeley, and Timnath.",
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
          faqSchema,
        ].filter(Boolean)}
      />

      {/* Hero */}
      <section
        className="relative h-[70vh] min-h-[500px] bg-cover bg-center flex items-end"
        style={{ backgroundImage: "url('/images/Northern Colorado.webp')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto px-8 pb-20 w-full">
          <p className="text-[#CFB36E] tracking-[0.3em] text-sm font-semibold uppercase mb-4">
            Schwartz and Associates · Private &amp; Discreet
          </p>
          <h1 className="text-5xl sm:text-7xl font-serif font-bold text-white mb-4 leading-tight">
            Luxury Real Estate
            <br />
            <span className="text-[#CFB36E]">Northern Colorado</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl leading-relaxed mb-8">
            Boulder to Fort Collins, Loveland, Windsor, Greeley, and the I-25 corridor. White-glove service from consultation to closing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#private-consultation"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#CFB36E] text-black font-bold tracking-wider hover:bg-[#C4A65A] transition-colors"
            >
              Schedule a Private Consultation
            </a>
            <a
              href="tel:9709991407"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-[#CFB36E] text-[#CFB36E] font-bold tracking-wider hover:bg-[#CFB36E] hover:text-black transition-colors"
            >
              (970) 999-1407
            </a>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="py-24 px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4">Beyond the Ordinary</p>
          <h2 className="text-4xl sm:text-5xl font-serif font-bold text-gray-900 mb-8 leading-tight">
            A Higher Standard of Real Estate
          </h2>
          <div className="w-16 h-0.5 bg-[#CFB36E] mx-auto mb-8" />
          <p className="text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto mb-6">
            Luxury real estate demands more than a standard approach. At Schwartz and Associates (SAA Homes), we bring
            decades of experience, an extensive network, and a discreet white-glove process to every high-end transaction.
            Whether you are acquiring a Flatirons-view estate in Boulder, a custom property west of Fort Collins, or
            selling lakefront in Windsor&apos;s Water Valley, our approach is tailored, private, and uncompromising.
          </p>
          <p className="text-base text-gray-500 max-w-2xl mx-auto">
            Explore our{" "}
            <Link to="/for-buyers/" className="text-gray-800 underline hover:text-[#CFB36E]">
              buyer services
            </Link>
            ,{" "}
            <Link to="/for-sellers/" className="text-gray-800 underline hover:text-[#CFB36E]">
              seller marketing
            </Link>
            , or the{" "}
            <Link
              to="/blog/luxury-home-buying-guide-northern-colorado/"
              className="text-gray-800 underline hover:text-[#CFB36E]"
            >
              Northern Colorado luxury buying guide
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Market at a Glance — REAL citywide medians + luxury thresholds only */}
      <section className="py-20 px-8 bg-gray-950 text-white" id="market-at-a-glance">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4 text-center">
            Market Context
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center">
            Northern Colorado Luxury Market at a Glance
          </h2>
          <p className="text-gray-400 text-center max-w-3xl mx-auto mb-12 text-sm leading-relaxed">
            Citywide medians below are from our published mid/July 2026 market notes (area guides &amp; FAQs) — not
            invented luxury averages. Luxury thresholds come from our luxury home buying guide. Live listing prices
            always supersede static snapshots.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {GLANCE_CITIES.map((slug) => {
              const c = CITY_MARKET_CONTEXT[slug];
              const t = LUXURY_THRESHOLDS[slug];
              return (
                <div key={slug} className="border border-gray-800 bg-gray-900/50 p-6 rounded-lg">
                  <Link
                    to={`/northern-colorado-areas/${slug}/#luxury-homes`}
                    className="text-xl font-serif font-bold text-white hover:text-[#CFB36E] transition-colors"
                  >
                    {c.city}
                  </Link>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mt-1 mb-4">{c.county}</p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider">Citywide median / range</p>
                      <p className="text-2xl font-serif font-bold text-[#CFB36E]">{c.medianDisplay}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider">Luxury tier (guide)</p>
                      <p className="text-lg font-semibold text-white">{t.thresholdDisplay}</p>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed">{c.premiumDom}</p>
                  </div>
                </div>
              );
            })}
            <div className="border border-[#CFB36E]/40 bg-gray-900/50 p-6 rounded-lg flex flex-col justify-center">
              <p className="text-[#CFB36E] text-xs uppercase tracking-wider mb-2">Concierge standard</p>
              <p className="text-3xl font-serif font-bold text-white mb-2">100%</p>
              <p className="text-gray-400 text-sm">Private &amp; discreet client process — email + phone required on every inquiry.</p>
              <a href="tel:9709991407" className="mt-4 text-[#CFB36E] font-bold hover:text-white transition-colors">
                (970) 999-1407
              </a>
            </div>
          </div>
          <p className="text-center text-gray-500 text-xs">
            Sources: areaSeo.js market blurbs, areaFaqs.js, blog luxury-home-buying-guide-northern-colorado. No fabricated luxury medians.
          </p>
        </div>
      </section>

      {/* Explore by City */}
      <section className="py-24 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4 text-center">
            Premium Markets
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-gray-900">
            Explore Luxury by City
          </h2>
          <p className="text-gray-500 text-center mb-16 max-w-2xl mx-auto">
            Each community offers a distinct luxury lifestyle. Jump to city guides with luxury sections, or search live inventory.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {LUXURY_CITIES.map((city) => (
              <div key={city.slug} className="group relative h-80 overflow-hidden bg-gray-900">
                <img
                  src={city.image}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <p className="text-[#CFB36E] text-sm font-semibold tracking-widest uppercase mb-1">
                    Luxury from {city.price}
                  </p>
                  <h3 className="text-3xl font-serif font-bold text-white mb-2">{city.name}</h3>
                  <p className="text-gray-300 text-sm max-w-md mb-4">{city.description}</p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/northern-colorado-areas/${city.slug}/#luxury-homes`}
                      className="text-sm font-semibold text-white underline underline-offset-4 hover:text-[#CFB36E]"
                    >
                      City luxury guide
                    </Link>
                    <Link
                      to={luxurySearchHref(city.name, LUXURY_THRESHOLDS[city.slug]?.threshold)}
                      className="text-sm font-semibold text-[#CFB36E] hover:text-white"
                    >
                      Live listings {city.price} →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Luxury neighborhoods grid */}
      <section className="py-24 px-8 bg-gray-50" id="luxury-neighborhoods">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4 text-center">
            Premier Addresses
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-gray-900">
            Luxury Neighborhoods Across Northern Colorado
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Price ranges from our verified neighborhood guides (neighborhoods.js). Linked to full neighborhood pages.
          </p>
          <div className="space-y-12">
            {HUB_NEIGHBORHOOD_CITIES.map(({ slug, limit }) => {
              const ctx = CITY_MARKET_CONTEXT[slug];
              const list = getLuxuryNeighborhoods(slug).slice(0, limit);
              if (!ctx || list.length === 0) return null;
              return (
                <div key={slug}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                    <h3 className="text-2xl font-serif font-bold text-gray-900">{ctx.city}</h3>
                    <Link
                      to={`/northern-colorado-areas/${slug}/#luxury-homes`}
                      className="text-sm font-semibold text-[#CFB36E] hover:underline"
                    >
                      All {ctx.city} luxury context →
                    </Link>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((n) => (
                      <Link
                        key={n.slug}
                        to={`/northern-colorado-areas/${slug}/${n.slug}/`}
                        className="block p-5 bg-white rounded-xl border border-gray-200 hover:border-[#CFB36E] hover:shadow-md transition-all"
                      >
                        <span className="font-bold font-serif text-lg text-gray-900">{n.name}</span>
                        <span className="block text-sm text-gray-600 mt-1">{n.priceHint}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Buyer personas */}
      <section className="py-24 px-8 bg-white" id="who-we-help">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4 text-center">
            Who We Serve
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-gray-900">
            Luxury Buyer Profiles
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Every high-end search is different. Here is how we typically partner with Northern Colorado luxury clients.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {LUXURY_BUYER_PERSONAS.map((p) => (
              <div key={p.title} className="border border-gray-200 p-8 rounded-xl bg-gray-50">
                <h3 className="text-xl font-serif font-bold text-gray-900 mb-3">{p.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Concierge + form */}
      <section className="py-24 px-8 bg-gray-50" id="private-consultation">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4">Concierge Service</p>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-6 text-gray-900 leading-tight">
              A Private Client Experience
            </h2>
            <div className="w-12 h-0.5 bg-[#CFB36E] mb-8" />
            <ul className="space-y-6">
              {[
                {
                  title: "Discrete Market Intelligence",
                  desc: "Off-market awareness and coming-soon access coordinated with local relationships — before the open market flood.",
                },
                {
                  title: "Tailored Property Searches",
                  desc: "Every search is curated to your criteria — human expertise, not generic automated alerts.",
                },
                {
                  title: "White-Glove Negotiation",
                  desc: "Strategic negotiation with your best interests as the sole priority at seven-figure stakes.",
                },
                {
                  title: "Full-Service Concierge",
                  desc: "From inspector selection to vendor coordination, we handle the details that protect your time and privacy.",
                },
              ].map((item) => (
                <li key={item.title}>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-900 p-10">
            <p className="text-[#CFB36E] text-xs uppercase tracking-widest font-semibold mb-2">Private &amp; Discreet</p>
            <h3 className="text-2xl font-serif font-bold text-white mb-2">Schedule a Private Consultation</h3>
            <p className="text-gray-400 text-sm mb-8">
              One of our luxury specialists will reach out within 24 hours. Email and phone required.
            </p>
            <LuxuryLeadForm />
          </div>
        </div>
      </section>

      {/* Guides & internal links */}
      <section className="py-16 px-8 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 text-center">Luxury Guides &amp; Resources</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/blog/luxury-home-buying-guide-northern-colorado/"
              className="p-5 border border-gray-200 rounded-xl hover:border-[#CFB36E] transition-colors"
            >
              <h3 className="font-bold text-gray-900 mb-1">Luxury Home Buying Guide</h3>
              <p className="text-sm text-gray-600">Regional price tiers &amp; city-by-city overview</p>
            </Link>
            <Link
              to="/blog/fort-collins-luxury-neighborhoods-guide/"
              className="p-5 border border-gray-200 rounded-xl hover:border-[#CFB36E] transition-colors"
            >
              <h3 className="font-bold text-gray-900 mb-1">Fort Collins Luxury Neighborhoods</h3>
              <p className="text-sm text-gray-600">Horsetooth, Old Town, and premier communities</p>
            </Link>
            <Link
              to="/for-buyers/"
              className="p-5 border border-gray-200 rounded-xl hover:border-[#CFB36E] transition-colors"
            >
              <h3 className="font-bold text-gray-900 mb-1">For Buyers</h3>
              <p className="text-sm text-gray-600">Representation, financing paths, and next steps</p>
            </Link>
            <Link
              to="/for-sellers/"
              className="p-5 border border-gray-200 rounded-xl hover:border-[#CFB36E] transition-colors"
            >
              <h3 className="font-bold text-gray-900 mb-1">For Sellers</h3>
              <p className="text-sm text-gray-600">Premium marketing for high-end listings</p>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ + FAQPage schema already in head */}
      <section className="py-24 px-8 bg-gray-50" id="luxury-faq">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4 text-center">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-gray-900">
            Luxury Real Estate Questions
          </h2>
          <p className="text-gray-500 text-center mb-12 text-sm">
            Answers grounded in our published market notes — never fabricated luxury sale comps.
          </p>
          <div className="space-y-4">
            {LUXURY_HUB_FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                  <h3 className="text-lg font-bold font-serif pr-4 text-gray-900">{faq.q}</h3>
                  <span
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white text-sm font-bold transition-transform duration-200 group-open:rotate-180"
                    style={{ backgroundColor: "#CFB36E" }}
                  >
                    ▼
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

      {/* Final CTA */}
      <section className="py-20 px-8 bg-gray-950 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4">Inquire in Confidence</p>
          <h2 className="text-4xl sm:text-5xl font-serif font-bold mb-6 leading-tight">
            Experience the Difference
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Whether you are buying, selling, or exploring, our team assists with discretion and professionalism across
            Boulder, Fort Collins, Loveland, Windsor, Greeley, Timnath, and the broader Front Range.
          </p>
          <a
            href="tel:9709991407"
            className="inline-block text-2xl font-bold text-[#CFB36E] hover:text-white transition-colors mb-4"
          >
            (970) 999-1407
          </a>
          <br />
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
            <a
              href="#private-consultation"
              className="inline-block px-10 py-4 bg-[#CFB36E] text-black font-bold tracking-wider hover:bg-[#C4A65A] transition-colors"
            >
              SCHEDULE PRIVATE CONSULTATION
            </a>
            <Link
              to="/contact/"
              className="inline-block px-10 py-4 border-2 border-[#CFB36E] text-[#CFB36E] font-bold tracking-wider hover:bg-[#CFB36E] hover:text-black transition-colors"
            >
              SEND PRIVATE INQUIRY
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
