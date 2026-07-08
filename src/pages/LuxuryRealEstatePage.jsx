import React, { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { BUSINESS } from "../utils/seoConstants";

function LuxuryLeadForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", preference: "", message: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Submit to API
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
        <div className="text-5xl mb-4">✉️</div>
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
          type="text" required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="Your full name"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">Email</label>
        <input
          type="email" required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full bg-transparent border-b border-gray-600 py-3 text-white placeholder-gray-500 focus:border-[#CFB36E] outline-none transition-colors"
          placeholder="your@email.com"
        />
      </div>
      <div>
        <label className="block text-sm uppercase tracking-widest text-gray-400 mb-2 font-semibold">Phone</label>
        <input
          type="tel" required
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
      <p className="text-xs text-gray-500 text-center">Your information is confidential and will not be shared.</p>
    </form>
  );
}

const LUXURY_CITIES = [
  {
    name: "Fort Collins",
    slug: "fort-collins",
    description: "Exclusive estates in Old Town, custom mountain-view homes west of town, and gated communities along the foothills.",
    price: "$1M – $3M+",
    image: "/images/Shwartz-CTA-Buyers.jpg",
  },
  {
    name: "Loveland",
    slug: "loveland",
    description: "Lakefront estates on Lake Loveland, custom homes in Mariana Butte, and luxury properties backing to open space.",
    price: "$850K – $2.5M+",
    image: "/images/Shwartz-CTA-Buyers.jpg",
  },
  {
    name: "Windsor",
    slug: "windsor",
    description: "Premier golf course communities, sprawling horse properties, and new custom construction in Windsor's finest neighborhoods.",
    price: "$750K – $2M+",
    image: "/images/Shwartz-CTA-Buyers.jpg",
  },
  {
    name: "Greeley",
    slug: "greeley",
    description: "Executive estates on acreage, historic properties, and newer custom homes in Greeley's most prestigious addresses.",
    price: "$650K – $1.5M+",
    image: "/images/Shwartz-CTA-Buyers.jpg",
  },
];

export default function LuxuryRealEstatePage() {
  return (
    <>
      <SEO
        exactTitle="Luxury Real Estate in Northern Colorado | SAA Homes — Schwartz and Associates"
        description="Discover exceptional luxury properties across Fort Collins, Loveland, Windsor, and Greeley. Private consultations, white-glove service, and exclusive listings from Schwartz and Associates."
        keywords="luxury real estate Northern Colorado, luxury homes Fort Collins, high-end real estate Loveland, luxury properties Windsor CO, luxury realtor Northern Colorado, premium homes Colorado, estate properties Fort Collins"
        canonical="https://saahomes.com/luxury-real-estate/"
        ogImage="https://saahomes.com/images/Northern Colorado.webp"
        jsonLd={[{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Luxury Real Estate — Northern Colorado",
          "description": "Premium luxury real estate services across Northern Colorado's finest communities.",
          "url": "https://saahomes.com/luxury-real-estate/",
          "provider": {
            "@type": "RealEstateAgent",
            "name": BUSINESS.name,
            "url": BUSINESS.url,
            "telephone": BUSINESS.telephone,
          },
        }]}
      />

      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] bg-cover bg-center flex items-end"
        style={{ backgroundImage: "url('/images/Northern Colorado.webp')" }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto px-8 pb-20 w-full">
          <p className="text-[#CFB36E] tracking-[0.3em] text-sm font-semibold uppercase mb-4">Schwartz and Associates</p>
          <h1 className="text-5xl sm:text-7xl font-serif font-bold text-white mb-4 leading-tight">
            Luxury Real Estate<br />
            <span className="text-[#CFB36E]">Northern Colorado</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl leading-relaxed">
            Discerning properties for discerning clients. White-glove service from consultation to closing.
          </p>
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
          <p className="text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
            Luxury real estate demands more than a standard approach. At Schwartz and Associates, we bring decades of 
            experience, an extensive network, and a discreet white-glove process to every high-end transaction. 
            Whether you are acquiring an estate in Fort Collins' prestigious west side or selling a custom property 
            in Windsor's most exclusive enclave, our approach is tailored, private, and uncompromising.
          </p>
        </div>
      </section>

      {/* By the Numbers */}
      <section className="py-20 px-8 bg-gray-950 text-white">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4 text-center">By the Numbers</p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-16 text-center">Northern Colorado Luxury Market</h2>
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-5xl font-serif font-bold text-[#CFB36E] mb-3">$1.2M+</div>
              <p className="text-gray-400 uppercase tracking-wider text-sm">Average Luxury Listing</p>
            </div>
            <div>
              <div className="text-5xl font-serif font-bold text-[#CFB36E] mb-3">19</div>
              <p className="text-gray-400 uppercase tracking-wider text-sm">Communities Served</p>
            </div>
            <div>
              <div className="text-5xl font-serif font-bold text-[#CFB36E] mb-3">100%</div>
              <p className="text-gray-400 uppercase tracking-wider text-sm">Private & Discreet</p>
            </div>
          </div>
        </div>
      </section>

      {/* Luxury Markets */}
      <section className="py-24 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4 text-center">Premium Markets</p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4 text-center text-gray-900">Explore Luxury by City</h2>
          <p className="text-gray-500 text-center mb-16 max-w-2xl mx-auto">
            Each Northern Colorado community offers unique luxury living. Find yours.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {LUXURY_CITIES.map((city) => (
              <Link
                key={city.slug}
                to={`/northern-colorado-areas/${city.slug}/`}
                className="group relative h-80 bg-cover bg-center overflow-hidden"
                style={{ backgroundImage: `url('${city.image}')` }}
              >
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <p className="text-[#CFB36E] text-sm font-semibold tracking-widest uppercase mb-1">{city.price}</p>
                  <h3 className="text-3xl font-serif font-bold text-white mb-2">{city.name}</h3>
                  <p className="text-gray-300 text-sm max-w-md">{city.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Concierge Section */}
      <section className="py-24 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4">Concierge Service</p>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-6 text-gray-900 leading-tight">
              A Private Client Experience
            </h2>
            <div className="w-12 h-0.5 bg-[#CFB36E] mb-8" />
            <ul className="space-y-6">
              {[
                { title: "Discrete Market Intelligence", desc: "Off-market listings and coming-soon access before they hit the public market." },
                { title: "Tailored Property Searches", desc: "Every search is curated to your specific criteria — no automated alerts, only human expertise." },
                { title: "White-Glove Negotiation", desc: "Strategic, experienced negotiation with your best interests as the sole priority." },
                { title: "Full-Service Concierge", desc: "From inspector selection to moving coordination, we handle every detail." },
              ].map((item) => (
                <li key={item.title}>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-900 p-10">
            <h3 className="text-2xl font-serif font-bold text-white mb-2">Schedule a Private Consultation</h3>
            <p className="text-gray-400 text-sm mb-8">One of our luxury specialists will reach out within 24 hours.</p>
            <LuxuryLeadForm />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-8 bg-gray-950 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#CFB36E] tracking-[0.2em] text-sm font-semibold uppercase mb-4">Inquire in Confidence</p>
          <h2 className="text-4xl sm:text-5xl font-serif font-bold mb-6 leading-tight">
            Experience the Difference
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Whether you are buying, selling, or simply exploring the market, our team is ready to assist with the utmost discretion and professionalism.
          </p>
          <a
            href="tel:9709991407"
            className="inline-block text-2xl font-bold text-[#CFB36E] hover:text-white transition-colors mb-4"
          >
            (970) 999-1407
          </a>
          <br />
          <Link
            to="/contact/"
            className="inline-block mt-4 px-10 py-4 border-2 border-[#CFB36E] text-[#CFB36E] font-bold tracking-wider hover:bg-[#CFB36E] hover:text-black transition-colors"
          >
            SEND PRIVATE INQUIRY
          </Link>
        </div>
      </section>
    </>
  );
}
