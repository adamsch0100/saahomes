import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function JohnstownPage() {
  return (
    <>
      <AreaSEO slug="johnstown" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Johnstown-CO-Area-Guide.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Johnstown, Colorado</h1>
          <p className="mt-4 text-xl">Where History Meets Modern Living</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your Johnstown Area Guide</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Johnstown is a historic Colorado town that beautifully blends its rich past with modern development. Located between Loveland and Greeley, Johnstown offers residents a quiet, family-friendly lifestyle with convenient access to Northern Colorado's major cities and amenities.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            With its affordable housing, growing commercial district, and strong community spirit, Johnstown attracts families and individuals seeking quality of life without the higher costs of larger cities. The town's strategic location and continued growth make it an excellent place to call home.
          </p>
        </div>
      </section>

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in Johnstown</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in Johnstown, CO
          </p>
          <Link
            to="/properties/?location=Johnstown, CO"
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search Johnstown Homes
          </Link>
        </div>
      </section>

      {/* Economy Section */}
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
              loading="lazy"
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

      {/* Area Highlights */}
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

      <AreaFAQSection faqs={AREA_FAQS['johnstown']} city="Johnstown" />

    </>
  );
}

