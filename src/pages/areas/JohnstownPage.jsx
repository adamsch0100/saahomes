import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import AreaFAQSection from "../../components/AreaFAQSection.jsx";
import RecentlySoldSection from "../../components/RecentlySoldSection.jsx";
import { AREA_FAQS } from "../../data/areaFaqs.js";
import { getAreaSeo } from "../../data/areaSeo.js";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";
import NeighborhoodLinks from "../../components/NeighborhoodLinks.jsx";
import LatestMarketUpdateBanner from "../../components/LatestMarketUpdateBanner.jsx";
import AreaEventsSection from "../../components/AreaEventsSection.jsx";
import CityStatsBand from "../../components/CityStatsBand.jsx";

const GOLD = "#CFB36E";

export default function JohnstownPage() {
  const area = getAreaSeo("johnstown");

  return (
    <>
      <AreaSEO slug="johnstown" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Johnstown-CO-Area-Guide.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Johnstown, Colorado</h1>
          <p className="mt-4 text-xl">{area.tagline}</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your Johnstown Area Guide</h2>
          {area.introParagraphs?.map((p, i) => (
            <p key={i} className="text-lg text-gray-700 leading-relaxed mb-6">{p}</p>
          ))}
        </div>
      </section>

      <LatestMarketUpdateBanner variant="compact" cityName="Johnstown" />

      {/* City Stats Band — quick info cards */}
      <div className="max-w-6xl mx-auto px-6 mt-8 mb-8">
        <CityStatsBand city="Johnstown" />
      </div>

      {/* Why Buy in Johnstown? */}
      {area.whyChoose?.length > 0 && (
        <section className="py-16 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold font-serif mb-8 text-center">Why Buy in Johnstown?</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {area.whyChoose.map((item) => (
                <div key={item.title} className="bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in Johnstown</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in Johnstown, CO
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/properties/?location=Johnstown, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search Johnstown Homes
            </Link>
            <Link
              to="/contact/"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
            >
              Talk to an Agent
            </Link>
          </div>
        </div>
      </section>

      {/* Economy & Growth */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Economy & Growth</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Johnstown's economy benefits from its location between major employment centers. Many residents commute to Loveland, Fort Collins, or Greeley for work, while the town itself is developing its own commercial base.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                The town has seen steady growth in recent years, with new businesses, retail centers, and residential developments opening regularly. Johnstown's business-friendly environment and affordable operating costs attract entrepreneurs and established companies alike.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Local employment opportunities exist in retail, healthcare, education, and service industries, with continued economic development creating new jobs.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Community Features</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Historic downtown district</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Affordable housing options</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Growing retail and dining</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Parks and recreation facilities</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Strong community engagement</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Culture & Lifestyle */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Culture & Lifestyle</h2>
          <div className="mb-8">
            <img 
              src="/images/Johnstown-CO-Area-Guide.jpg" 
              alt="Johnstown Colorado historic downtown and community" 
              className="w-full rounded-lg shadow-lg"
              loading="lazy" decoding="async"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Historic Charm</h3>
              <p className="text-gray-700">
                Johnstown's historic downtown preserves the town's heritage while new developments bring modern amenities. This blend creates a unique character that residents appreciate.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Outdoor Recreation</h3>
              <p className="text-gray-700">
                The town offers multiple parks, trails, and open spaces for outdoor activities. Nearby reservoirs and natural areas provide additional recreation opportunities.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Family-Friendly</h3>
              <p className="text-gray-700">
                Safe neighborhoods, good schools, and community events make Johnstown an ideal place for families. The town's welcoming atmosphere fosters lasting connections.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Education in Johnstown</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Johnstown is served by Thompson School District, which operates several schools in the area. The district is committed to providing quality education and offers comprehensive programs from elementary through high school.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Schools in Johnstown feature dedicated teachers, strong academic programs, and numerous extracurricular activities. The district's focus on student success ensures children receive a well-rounded education.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Proximity to Loveland, Fort Collins, and Greeley provides access to additional educational resources and higher education institutions.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Location & Accessibility</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Johnstown is strategically located in Northern Colorado, approximately halfway between Loveland and Greeley along I-25. This central position provides easy access to multiple employment centers and amenities.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Denver International Airport is about 60 miles south, roughly an hour's drive. The town's location offers residents the convenience of nearby cities while maintaining a quieter, more affordable lifestyle.
          </p>
        </div>
      </section>

      {/* 10 Facts Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">10 Things to Know About Johnstown</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">1. Historic Town</h3>
              <p className="text-gray-700">Rich history dating back to the late 1800s with preserved historic buildings.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. Affordable Living</h3>
              <p className="text-gray-700">More affordable housing compared to nearby Loveland and Fort Collins.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Central Location</h3>
              <p className="text-gray-700">Easy access to Loveland, Greeley, and Fort Collins via I-25.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Growing Community</h3>
              <p className="text-gray-700">Steady growth with new residential and commercial developments.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Good Schools</h3>
              <p className="text-gray-700">Part of Thompson School District with quality educational programs.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Parks & Recreation</h3>
              <p className="text-gray-700">Multiple parks, trails, and recreation facilities for all ages.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Small-Town Feel</h3>
              <p className="text-gray-700">Maintains a friendly, small-town atmosphere despite growth.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Retail Growth</h3>
              <p className="text-gray-700">New shopping centers and restaurants opening regularly.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. Community Events</h3>
              <p className="text-gray-700">Annual festivals and events bring residents together throughout the year.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">10. Safe Neighborhoods</h3>
              <p className="text-gray-700">Low crime rates and family-friendly environment.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Report CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Johnstown, CO?</h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
          </p>
          <MarketReportForm areaName="Johnstown, CO" />
        </div>
      </section>

      {/* CHFA First-Time Buyer Banner */}
      <section className="py-12 px-6 rounded-lg" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            First-time buyer in Johnstown?
          </h2>
          <p className="text-gray-800 mb-6">
            Many Johnstown buyers qualify for CHFA down payment assistance — grants and deferred loans up to $25,000 for down payment and closing costs.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/chfa-down-payment-assistance/#chfa-dpa-lead-form"
              className="inline-flex px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Free CHFA Consultation
            </Link>
            <Link
              to="/chfa-down-payment-assistance/"
              className="inline-flex px-6 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              CHFA program guide →
            </Link>
          </div>
        </div>
      </section>

      {/* Area Highlights */}
            {/* Neighborhood Guides */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <NeighborhoodLinks citySlug="johnstown" cityName="Johnstown" />
        </div>
      </section>

      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Johnstown Highlights</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Popular Neighborhoods</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Downtown Johnstown - Historic area</li>
                <li>• Parish - Master-planned community</li>
                <li>• Johnstown Farms - New construction</li>
                <li>• Colliers Hill - Growing development</li>
                <li>• Established subdivisions - Family homes</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Local Attractions</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Historic downtown district</li>
                <li>• Community parks and playgrounds</li>
                <li>• Annual town festivals and events</li>
                <li>• Nearby Boyd Lake State Park</li>
                <li>• Easy access to regional attractions</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Nearby Northern Colorado Communities */}
      <section className="py-8 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Nearby Northern Colorado Communities</h2>
          <p className="text-gray-700 text-center mb-6">
            Johnstown sits at the I-25 corridor crossroads between Loveland and Greeley. Explore nearby communities to find your perfect fit.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/northern-colorado-areas/fort-collins/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Fort Collins →</h3>
              <p className="text-sm text-gray-600">CSU and breweries, 20 min north</p>
            </Link>
            <Link to="/northern-colorado-areas/loveland/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Loveland →</h3>
              <p className="text-sm text-gray-600">Sweetheart City, 10 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/greeley/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Greeley →</h3>
              <p className="text-sm text-gray-600">Weld County value, 12 min east</p>
            </Link>
            <Link to="/northern-colorado-areas/windsor/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Windsor →</h3>
              <p className="text-sm text-gray-600">Family communities, 15 min north</p>
            </Link>
            <Link to="/northern-colorado-areas/milliken/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Milliken →</h3>
              <p className="text-sm text-gray-600">Affordable living, 5 min east</p>
            </Link>
            <Link to="/northern-colorado-areas/longmont/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Longmont →</h3>
              <p className="text-sm text-gray-600">Boulder County value, 18 min south</p>
            </Link>
          </div>
        </div>
      </section>

      <RecentlySoldSection citySlug="johnstown" />

      <AreaFAQSection faqs={AREA_FAQS['johnstown']} city="Johnstown" />

      <AreaEventsSection city="Johnstown" slug="johnstown" />

      {/* Final CTA */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Ready to buy or sell in Johnstown?</h2>
          <p className="text-gray-300 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across Johnstown and all of Northern Colorado.
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