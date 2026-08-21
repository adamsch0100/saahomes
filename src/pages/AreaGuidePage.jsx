import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import AreaSEO from "../components/AreaSEO.jsx";
import MarketReportForm from "../components/MarketReportForm.jsx";
import AreaFAQSection from "../components/AreaFAQSection.jsx";
import RecentlySoldSection from "../components/RecentlySoldSection.jsx";
import NeighborhoodLinks from "../components/NeighborhoodLinks.jsx";
import { getAreaSeo } from "../data/areaSeo.js";
import { AREA_FAQS } from "../data/areaFaqs.js";
import LatestMarketUpdateBanner from "../components/LatestMarketUpdateBanner.jsx";
import AreaEventsSection from "../components/AreaEventsSection.jsx";
import TopRatedSchools from "../components/TopRatedSchools.jsx";
import CityStatsBand from "../components/CityStatsBand.jsx";
import SectionTownsBand from "../components/SectionTownsBand.jsx";

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
    { name: 'Carbon Valley', slug: 'carbon-valley', description: 'Regional hub for Firestone / Frederick / Dacono' },
    { name: 'Fort Collins', slug: 'fort-collins', description: '30 miles north on I-25' },
  ],
  frederick: [
    { name: 'Firestone', slug: 'firestone', description: 'Adjacent to Frederick' },
    { name: 'Longmont', slug: 'longmont', description: '10 miles west of Frederick' },
    { name: 'Mead', slug: 'mead', description: '6 miles north of Frederick' },
    { name: 'Carbon Valley', slug: 'carbon-valley', description: 'Regional hub for Carbon Valley towns' },
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
    { name: 'Lyons', slug: 'lyons', description: '12 miles northwest of Niwot' },
    { name: 'Mead', slug: 'mead', description: '12 miles northeast of Niwot' },
  ],
  windsor: [
    { name: 'Fort Collins', slug: 'fort-collins', description: '10 miles west via CO-392' },
    { name: 'Loveland', slug: 'loveland', description: '8 miles south via I-25' },
    { name: 'Greeley', slug: 'greeley', description: '12 miles east via US-85' },
    { name: 'Timnath', slug: 'timnath', description: '5 miles south via I-25' },
    { name: 'Severance', slug: 'severance', description: '5 miles east of Windsor' },
    { name: 'Johnstown', slug: 'johnstown', description: '8 miles south via I-25' },
  ],
  erie: [
    { name: 'Longmont', slug: 'longmont', description: '10 miles north of Erie' },
    { name: 'Boulder', slug: 'boulder', description: '15 miles southwest of Erie' },
    { name: 'Carbon Valley', slug: 'carbon-valley', description: 'Firestone / Frederick / Dacono corridor' },
    { name: 'Brighton', slug: 'brighton', description: 'I-76 corridor south of Erie' },
    { name: 'Niwot', slug: 'niwot', description: 'West toward Boulder County' },
  ],
  brighton: [
    { name: 'Fort Lupton', slug: 'fort-lupton', description: 'North on US-85' },
    { name: 'Erie', slug: 'erie', description: 'Northwest toward Boulder County' },
    { name: 'Carbon Valley', slug: 'carbon-valley', description: 'I-25 growth corridor north' },
    { name: 'Greeley', slug: 'greeley', description: 'North on US-85 toward Weld County' },
  ],
  'carbon-valley': [
    { name: 'Firestone', slug: 'firestone', description: 'Carbon Valley family hub' },
    { name: 'Frederick', slug: 'frederick', description: 'Affordable Carbon Valley living' },
    { name: 'Mead', slug: 'mead', description: 'North of the valley core' },
    { name: 'Fort Lupton', slug: 'fort-lupton', description: 'US-85 Weld County value' },
    { name: 'Erie', slug: 'erie', description: 'Denver-exurb growth west' },
    { name: 'Longmont', slug: 'longmont', description: 'West toward Boulder County' },
  ],
  'estes-park': [
    { name: 'Lyons', slug: 'lyons', description: 'Foothills gateway south of Estes' },
    { name: 'Loveland', slug: 'loveland', description: 'US-34 corridor toward the park' },
    { name: 'Fort Collins', slug: 'fort-collins', description: 'Larimer County base city' },
    { name: 'Bellvue', slug: 'bellvue', description: 'Poudre Canyon access from Fort Collins' },
  ],
  'red-feather-lakes': [
    { name: 'Fort Collins', slug: 'fort-collins', description: 'Primary services ~45–60 min southeast' },
    { name: 'Bellvue', slug: 'bellvue', description: 'Poudre Canyon corridor' },
    { name: 'Wellington', slug: 'wellington', description: 'Northern Larimer plains access' },
    { name: 'Estes Park', slug: 'estes-park', description: 'RMNP mountain market south' },
  ],
  'fort-lupton': [
    { name: 'Brighton', slug: 'brighton', description: 'South on US-85 / I-76 corridor' },
    { name: 'Carbon Valley', slug: 'carbon-valley', description: 'West toward Firestone / Frederick' },
    { name: 'Greeley', slug: 'greeley', description: 'North on US-85' },
    { name: 'Platteville', slug: 'carbon-valley', description: 'Nearby Weld County small town (hub section)' },
  ],
  lyons: [
    { name: 'Boulder', slug: 'boulder', description: 'South via US-36 corridor' },
    { name: 'Longmont', slug: 'longmont', description: 'East toward the plains' },
    { name: 'Estes Park', slug: 'estes-park', description: 'Mountain route via US-36' },
    { name: 'Niwot', slug: 'niwot', description: 'Southeast Boulder County village' },
  ],
  bellvue: [
    { name: 'Fort Collins', slug: 'fort-collins', description: 'Minutes southeast into town' },
    { name: 'Red Feather Lakes', slug: 'red-feather-lakes', description: 'Northwest mountain cabin market' },
    { name: 'Estes Park', slug: 'estes-park', description: 'RMNP via mountain routes' },
    { name: 'Loveland', slug: 'loveland', description: 'South Larimer County' },
  ],
};

export default function AreaGuidePage() {
  const { slug } = useParams();
  const area = getAreaSeo(slug);

  if (!area) {
    return <Navigate to="/northern-colorado-areas/" replace />;
  }

  const searchCity = area.searchLocation || `${area.city}, CO`;
  const searchLocation = encodeURIComponent(searchCity);
  const searchLink = `/properties/?location=${searchLocation}`;
  const intro = area.introParagraphs || [area.description];
  const whyChoose = area.whyChoose || [];
  const highlights = area.highlights || { neighborhoods: [], attractions: [] };
  const hubSections = area.hubSections || [];
  const hubCrossLinks = area.hubCrossLinks || [];

  const isGreeleyArea = area.slug === 'greeley' || area.slug === 'evans';
  const nearby = nearbyCommunities[area.slug];
  const statsCity = area.skipCityStats ? null : area.city;

  return (
    <>
      <AreaSEO slug={area.slug} />

      <section
        className="relative min-h-[22rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8"
        style={{ backgroundImage: `url('${area.heroImage}')` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center text-white px-6 w-full max-w-3xl mx-auto">
          <p className="text-sm uppercase tracking-widest mb-2" style={{ color: GOLD }}>{area.county}</p>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold font-serif">{area.city}, Colorado</h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-100">{area.tagline}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to={searchLink}
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation shadow-lg"
            >
              Search {area.city} Homes
            </Link>
            <a
              href="/for-sellers/#home-valuation"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
            >
              Get My Home Value
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-200">
            Questions? Call{" "}
            <a href="tel:(970) 999-1407" className="font-semibold text-white underline hover:text-gray-100">
              (970) 999-1407
            </a>{" "}
            — Schwartz and Associates, serving {area.city} and all of Northern Colorado
          </p>
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
          {statsCity && (
            <div className="mt-8 mb-6">
              <CityStatsBand city={statsCity} />
            </div>
          )}
          <LatestMarketUpdateBanner variant="compact" cityName={area.city} />
        </div>
      </section>

      {hubSections.length > 0 && (
        <SectionTownsBand
          title={`${area.city} communities with live market data`}
          intro="Each section below uses live active-listing counts and median list prices from IRES MLS — never static marketing numbers. Jump to a town or search homes directly."
          towns={hubSections.map((s) => ({
            id: s.id,
            name: s.name,
            searchCity: s.searchCity || s.name,
            description: s.description,
            writeup: s.writeup,
            href: s.href || undefined,
          }))}
        />
      )}

      {hubCrossLinks.length > 0 && (
        <section className="py-12 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6 text-center">
              Full Carbon Valley & corridor guides
            </h2>
            <p className="text-gray-700 text-center mb-8 max-w-2xl mx-auto">
              Dedicated area pages for towns that already have full guides — cross-linked so you can compare the corridor without thin duplicate content.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {hubCrossLinks.map((community) => (
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
            <Link
              to={searchLink}
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search {area.city} Homes
            </Link>
            <Link
              to="/contact/"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Talk to an Agent
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Selling Your {area.city} Home?</h2>
          <p className="text-lg mb-6 text-gray-700">
            Need to sell fast — or want to know what your home is really worth before you decide? Compare a no-obligation cash offer against a full market valuation, and learn exactly how fast homes sell in {area.city}.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/cash-home-buyers/"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Get a Cash Offer
            </Link>
            <Link
              to="/blog/cash-home-buyers-fort-collins-northern-colorado/"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Cash Buyer Guide
            </Link>
            <Link
              to="/for-sellers/#home-valuation"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Free Home Valuation
            </Link>
          </div>
        </div>
      </section>

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
            {isGreeleyArea && " Greeley-area employees may also qualify for the city G-HOPE program ($2,500–$8,000 by zone)."}
            {area.slug === "estes-park" && " Estes Valley workforce buyers may also qualify for EVWHA (up to 3.5% / $15K)."}
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
            {area.slug === "estes-park" && (
              <Link
                to="/chfa-down-payment-assistance/#estes-park-evwha"
                className="inline-flex px-6 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
              >
                Estes Park EVWHA →
              </Link>
            )}
            <Link to="/chfa-down-payment-assistance/" className="inline-flex px-6 py-3 font-semibold hover:underline">
              CHFA program guide →
            </Link>
          </div>
        </div>
      </section>

      {/* Top-rated schools (GreatSchools Rating 1–10) — hides if cache empty */}
      <TopRatedSchools city={area.city} citySlug={area.slug} limit={8} />

      {/* Neighborhood Guides */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <NeighborhoodLinks citySlug={area.slug} cityName={area.city} />
        </div>
      </section>

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

      <RecentlySoldSection citySlug={area.slug} />

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

      {/* City Video at bottom */}
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
    </>
  );
}
