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

const GOLD = "#CFB36E";

export default function MillikenPage() {
  const area = getAreaSeo("milliken");

  return (
    <>
      <AreaSEO slug="milliken" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/milliken.png')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Milliken, Colorado</h1>
          <p className="mt-4 text-xl">{area.tagline}</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your Milliken Area Guide</h2>
          {area.introParagraphs?.map((p, i) => (
            <p key={i} className="text-lg text-gray-700 leading-relaxed mb-6">{p}</p>
          ))}
        </div>
      </section>

      <LatestMarketUpdateBanner variant="compact" cityName="Milliken" />

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in Milliken</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in Milliken, CO
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/properties/?location=Milliken, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search Milliken Homes
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

      {/* Economy Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Economy & Growth</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Milliken's economy benefits from its location between major employment centers. Many residents commute to Greeley, Loveland, or Fort Collins for work, while local businesses provide services to the community.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                The town is experiencing steady growth, with new residential developments and commercial projects underway. Milliken's affordable cost of living and housing make it attractive for young families and first-time homebuyers.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Local employment opportunities exist in retail, agriculture, and service industries, with continued development creating new jobs and economic opportunities.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Community Features</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Affordable housing options</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Friendly, welcoming community</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Growing infrastructure</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Easy access to larger cities</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Parks and recreation facilities</span>
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
              src="/images/milliken.png" 
              alt="Milliken Colorado small town community and parks" 
              className="w-full rounded-lg shadow-lg"
              loading="lazy" decoding="async"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Small-Town Living</h3>
              <p className="text-gray-700">
                Milliken offers a quiet, small-town lifestyle with friendly neighbors and a strong sense of community. Residents appreciate the slower pace and personal connections.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Outdoor Recreation</h3>
              <p className="text-gray-700">
                The town features parks and open spaces for outdoor activities. Nearby reservoirs and regional trails provide additional recreation opportunities.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Family-Friendly</h3>
              <p className="text-gray-700">
                Safe neighborhoods and community events make Milliken an ideal place for families. The town's welcoming atmosphere helps newcomers feel at home quickly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Education in Milliken</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Milliken is served by Weld County School District RE-5J, which operates schools in the area. The district is committed to providing quality education and offers programs from elementary through high school.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Schools in Milliken feature dedicated teachers and comprehensive academic programs. The district's focus on student success ensures children receive a solid educational foundation.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Proximity to Greeley and other Northern Colorado cities provides access to additional educational resources and higher education institutions.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Location & Accessibility</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Milliken is strategically located in Northern Colorado, approximately 10 miles southwest of Greeley and 15 miles east of Loveland. The town's location provides convenient access to multiple employment centers via I-25 and Highway 60.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Denver International Airport is about 65 miles south, roughly an hour's drive. Milliken's central location offers residents easy access to urban amenities while maintaining affordable small-town living.
          </p>
        </div>
      </section>

      {/* 10 Facts Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">10 Things to Know About Milliken</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">1. Affordable Housing</h3>
              <p className="text-gray-700">Some of the most affordable home prices in Northern Colorado.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. Growing Community</h3>
              <p className="text-gray-700">Steady population growth with new developments and infrastructure improvements.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Central Location</h3>
              <p className="text-gray-700">Easy access to Greeley, Loveland, and Fort Collins for work and shopping.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Small-Town Feel</h3>
              <p className="text-gray-700">Maintains a friendly, small-town atmosphere with personal connections.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Safe Community</h3>
              <p className="text-gray-700">Low crime rates and family-friendly environment.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Parks & Recreation</h3>
              <p className="text-gray-700">Community parks and open spaces for outdoor activities.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Commuter-Friendly</h3>
              <p className="text-gray-700">Convenient location for commuting to major employment centers.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Community Events</h3>
              <p className="text-gray-700">Local festivals and events bring residents together throughout the year.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. First-Time Buyer Friendly</h3>
              <p className="text-gray-700">Affordable entry point into homeownership in Northern Colorado.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">10. Welcoming Atmosphere</h3>
              <p className="text-gray-700">Friendly residents who welcome newcomers and foster community spirit.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Report CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Milliken, CO?</h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
          </p>
          <MarketReportForm areaName="Milliken, CO" />
        </div>
      </section>

      {/* CHFA First-Time Buyer Banner */}
      <section className="py-12 px-6 rounded-lg" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            First-time buyer in Milliken?
          </h2>
          <p className="text-gray-800 mb-6">
            Many Milliken buyers qualify for CHFA down payment assistance — grants and deferred loans up to $25,000 for down payment and closing costs.
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
          <NeighborhoodLinks citySlug="milliken" cityName="Milliken" />
        </div>
      </section>

      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Milliken Highlights</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Popular Neighborhoods</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Downtown Milliken - Historic area</li>
                <li>• New residential developments</li>
                <li>• Established subdivisions</li>
                <li>• Country properties with acreage</li>
                <li>• Affordable starter homes</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Local Attractions</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Community parks and playgrounds</li>
                <li>• Annual town festivals</li>
                <li>• Nearby Boyd Lake State Park</li>
                <li>• Easy access to regional attractions</li>
                <li>• Short drive to Greeley amenities</li>
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
            Milliken sits at the heart of Weld County with easy access to the region's top communities. Explore nearby cities to find your perfect fit.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/northern-colorado-areas/greeley/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Greeley →</h3>
              <p className="text-sm text-gray-600">Weld County hub, 10 min east</p>
            </Link>
            <Link to="/northern-colorado-areas/loveland/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Loveland →</h3>
              <p className="text-sm text-gray-600">Lake living and arts, 15 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/johnstown/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Johnstown →</h3>
              <p className="text-sm text-gray-600">I-25 corridor, 5 min south</p>
            </Link>
            <Link to="/northern-colorado-areas/fort-collins/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Fort Collins →</h3>
              <p className="text-sm text-gray-600">CSU and breweries, 20 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/windsor/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Windsor →</h3>
              <p className="text-sm text-gray-600">Family communities, 12 min north</p>
            </Link>
            <Link to="/northern-colorado-areas/eaton/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Eaton →</h3>
              <p className="text-sm text-gray-600">Rural schools community, 10 min north</p>
            </Link>
          </div>
        </div>
      </section>

      <RecentlySoldSection citySlug="milliken" />

      <AreaFAQSection faqs={AREA_FAQS['milliken']} city="Milliken" />

      <AreaEventsSection city="Milliken" slug="milliken" />

      {/* Final CTA */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Ready to buy or sell in Milliken?</h2>
          <p className="text-gray-300 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across Milliken and all of Northern Colorado.
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