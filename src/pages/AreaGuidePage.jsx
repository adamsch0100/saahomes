import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import AreaSEO from "../components/AreaSEO.jsx";
import MarketReportForm from "../components/MarketReportForm.jsx";
import AreaFAQSection from "../components/AreaFAQSection.jsx";
import NeighborhoodLinks from "../components/NeighborhoodLinks.jsx";
import { getAreaSeo } from "../data/areaSeo.js";
import { AREA_FAQS } from "../data/areaFaqs.js";
import LatestMarketUpdateBanner from "../components/LatestMarketUpdateBanner.jsx";
import AreaEventsSection from "../components/AreaEventsSection.jsx";

const GOLD = "#CFB36E";

const nearbyCommunities = {
  berthoud: [
    { name: 'Loveland', slug: 'loveland', description: '8 miles north of Berthoud' },
    { name: 'Longmont', slug: 'longmont', description: '10 miles south of Berthoud' },
    { name: 'Fort Collins', slug: 'fort-collins', description: '22 miles north of Berthoud' },
    { name: 'Firestone', slug: 'firestone', description: '12 miles east of Berthoud' },
  ],
  firestone: [
    { name: 'Longmont', slug: 'longmont', description: '8 miles west of Firestone' },
    { name: 'Frederick', slug: 'frederick', description: 'Adjacent to Firestone' },
    { name: 'Mead', slug: 'mead', description: '5 miles north of Firestone' },
    { name: 'Fort Collins', slug: 'fort-collins', description: '30 miles north on I-25' },
  ],
  frederick: [
    { name: 'Firestone', slug: 'firestone', description: 'Adjacent to Frederick' },
    { name: 'Longmont', slug: 'longmont', description: '10 miles west of Frederick' },
    { name: 'Mead', slug: 'mead', description: '6 miles north of Frederick' },
    { name: 'Fort Collins', slug: 'fort-collins', description: '30 miles north on I-25' },
  ],
  evans: [
    { name: 'Greeley', slug: 'greeley', description: 'Immediately adjacent to Evans' },
    { name: 'La Salle', slug: 'la-salle', description: '4 miles south of Evans' },
    { name: 'Windsor', slug: 'windsor', description: '10 miles west of Evans' },
    { name: 'Milliken', slug: 'milliken', description: '8 miles southwest of Evans' },
  ],
  severance: [
    { name: 'Windsor', slug: 'windsor', description: '5 miles west of Severance' },
    { name: 'Greeley', slug: 'greeley', description: '8 miles east of Severance' },
    { name: 'Eaton', slug: 'eaton', description: '5 miles north of Severance' },
    { name: 'Fort Collins', slug: 'fort-collins', description: '15 miles west via Weld County Road' },
  ],
  niwot: [
    { name: 'Longmont', slug: 'longmont', description: '4 miles east of Niwot' },
    { name: 'Boulder', slug: 'boulder', description: '10 miles south of Niwot' },
    { name: 'Fort Collins', slug: 'fort-collins', description: '40 miles north on I-25' },
    { name: 'Mead', slug: 'mead', description: '12 miles northeast of Niwot' },
  ],
};

export default function AreaGuidePage() {
  const { slug } = useParams();
  const area = getAreaSeo(slug);

  if (!area) {
    return <Navigate to="/northern-colorado-areas/" replace />;
  }

  const searchLocation = encodeURIComponent(`${area.city}, CO`);
  const realscoutLink = `https://www.realscout.com/search?agent_id=251929&location=${searchLocation}`;
  const intro = area.introParagraphs || [area.description];
  const whyChoose = area.whyChoose || [];
  const highlights = area.highlights || { neighborhoods: [], attractions: [] };

  const isGreeleyArea = area.slug === 'greeley' || area.slug === 'evans';
  const nearby = nearbyCommunities[area.slug];

  return (
    <>
      <AreaSEO slug={area.slug} />

      <section
        className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8"
        style={{ backgroundImage: `url('${area.heroImage}')` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center text-white px-6">
          <p className="text-sm uppercase tracking-widest mb-2" style={{ color: GOLD }}>{area.county}</p>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold font-serif">{area.city}, Colorado</h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-100">{area.tagline}</p>
        </div>
      </section>

      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6 text-center">
            Your {area.city} Real Estate Guide
          </h2>
          {intro.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="text-lg text-gray-700 leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}
          <LatestMarketUpdateBanner variant="compact" cityName={area.city} />
        </div>
      </section>

      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-4 text-center">
          {[
            { label: "County", value: area.county },
            { label: "Homes for sale", value: `${area.city}, CO` },
            { label: "Expert agents", value: "SAA Homes" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
              <p className="text-lg font-bold font-serif mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Search Homes in {area.city}</h2>
          <p className="text-lg mb-6 text-gray-700">Explore available properties in {area.city}, Colorado.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={realscoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search {area.city} Homes
            </a>
            <Link
              to="/contact/"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Talk to an Agent
            </Link>
          </div>
        </div>
      </section>

      {whyChoose.length > 0 && (
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold font-serif mb-8 text-center">Why Buy in {area.city}?</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {whyChoose.map((item) => (
                <div key={item.title} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12 px-6" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            First-time buyer in {area.city}?
          </h2>
          <p className="text-gray-800 mb-6">
            Many {area.city} buyers qualify for CHFA down payment assistance — grants and deferred loans up to $25,000.
            {isGreeleyArea && " Greeley-area employees may also qualify for the city G-HOPE program (up to $8,000)."}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/chfa-down-payment-assistance/#chfa-dpa-lead-form"
              className="inline-flex px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Free CHFA Consultation
            </Link>
            {isGreeleyArea && (
              <Link
                to="/greeley-g-hope-down-payment-assistance/#g-hope-lead-form"
                className="inline-flex px-6 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
              >
                G-HOPE for Greeley employees
              </Link>
            )}
            <Link to="/chfa-down-payment-assistance/" className="inline-flex px-6 py-3 font-semibold hover:underline">
              CHFA program guide →
            </Link>
          </div>
        </div>
      </section>

      {/* Neighborhood Guides */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <NeighborhoodLinks citySlug={area.slug} cityName={area.city} />
        </div>
      </section>

      {/* City Video */}
      {area.youtubeId && (
        <section className="py-12 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6 text-center">
              {area.city} Video Guide
            </h2>
            <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${area.youtubeId}`}
                title={`${area.city} real estate guide - SAA Homes`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </section>
      )}

      {nearby && (
        <section className="py-16 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6 text-center">
              Nearby Northern Colorado Communities
            </h2>
            <p className="text-gray-700 text-center mb-8 max-w-2xl mx-auto">
              {area.city} is part of a network of Northern Colorado communities along the I-25 and Highway 85 corridors. Each nearby city offers its own lifestyle, pricing, and market conditions — explore what fits your home search.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {nearby.map((community) => (
                <Link
                  key={community.slug}
                  to={`/northern-colorado-areas/${community.slug}/`}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-100 transition-all group"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 group-hover:underline">{community.name}</h3>
                    <p className="text-sm text-gray-600">{community.description}</p>
                  </div>
                  <span className="text-gray-400 group-hover:text-gray-700">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold font-serif mb-4 text-center">
            Free {area.city} market report
          </h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            Get instant access to the latest sales trends and market data for {area.city}, CO.
          </p>
          <MarketReportForm areaName={`${area.city}, CO`} />
        </div>
      </section>

      <AreaEventsSection city={area.city} slug={area.slug} />

      {(highlights.neighborhoods?.length > 0 || highlights.attractions?.length > 0) && (
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10">
            {highlights.neighborhoods?.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold font-serif mb-4">Popular Areas</h3>
                <ul className="space-y-2 text-gray-700">
                  {highlights.neighborhoods.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="font-bold">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {highlights.attractions?.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold font-serif mb-4">Local Highlights</h3>
                <ul className="space-y-2 text-gray-700">
                  {highlights.attractions.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="font-bold">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <AreaFAQSection faqs={AREA_FAQS[area.slug]} city={area.city} />

      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Ready to buy or sell in {area.city}?</h2>
          <p className="text-gray-300 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across {area.city} and all of Northern Colorado.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/contact/" className="inline-block px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Contact SAA Homes
            </Link>
            <a href="tel:(970) 999-1407" className="inline-block px-8 py-3 border-2 border-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors">
              Call (970) 999-1407
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
