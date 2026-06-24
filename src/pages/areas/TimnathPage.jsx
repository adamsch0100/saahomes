import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function TimnathPage() {
  return (
    <>
      <AreaSEO slug="timnath" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/timnath.png')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Timnath, Colorado</h1>
          <p className="mt-4 text-xl">A Rapidly Growing Community</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your Timnath Area Guide</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Timnath is one of Northern Colorado's fastest-growing communities, offering modern homes, excellent schools, and a strong sense of community. Located just minutes from Fort Collins, Timnath provides small-town charm with easy access to big-city amenities.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            With its new developments, parks, and family-friendly atmosphere, Timnath is attracting young families and professionals seeking quality of life in a welcoming community. The town's strategic location and modern infrastructure make it an ideal place to call home.
          </p>
        </div>
      </section>

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in Timnath</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in Timnath, CO
          </p>
          <Link
            to="/properties/?location=Timnath, CO"
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search Timnath Homes
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
                Timnath's economy is experiencing rapid growth, with new businesses and commercial developments opening regularly. The town's proximity to Fort Collins and I-25 makes it attractive for commuters and businesses alike.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Many residents work in Fort Collins, Loveland, or Greeley, benefiting from Timnath's central location. The town itself is developing its own commercial base, with retail, dining, and service businesses establishing roots.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Timnath's business-friendly environment and modern infrastructure continue to attract new investment and create local job opportunities.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Community Features</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>New residential developments</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Modern schools and facilities</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Growing commercial district</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Parks and recreation areas</span>
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
              src="/images/timnath.png" 
              alt="Timnath Colorado community and new developments" 
              className="w-full rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Family-Friendly</h3>
              <p className="text-gray-700">
                Timnath is designed with families in mind, featuring safe neighborhoods, excellent schools, and numerous parks and playgrounds for children of all ages.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Outdoor Recreation</h3>
              <p className="text-gray-700">
                The town offers multiple parks, trails, and open spaces. Residents enjoy easy access to regional trails and nearby natural areas for hiking and biking.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Community Events</h3>
              <p className="text-gray-700">
                Timnath hosts regular community events, farmers markets, and festivals that bring neighbors together and foster a strong sense of belonging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Education in Timnath</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Timnath is served by Poudre School District, one of Colorado's top-rated school districts. The town is home to several modern schools, including Timnath Elementary and Timnath Middle-High School.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            These schools feature state-of-the-art facilities and offer comprehensive academic programs, extracurricular activities, and athletic opportunities. The district's commitment to excellence ensures students receive a high-quality education.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Proximity to Fort Collins provides access to Colorado State University and other higher education institutions.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Location & Accessibility</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Timnath is ideally located in Northern Colorado, just 10 miles southeast of Fort Collins and with easy access to I-25. This strategic position makes commuting to Fort Collins, Loveland, or Greeley quick and convenient.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Denver International Airport is approximately 75 miles south, about an hour's drive. The town's location provides the perfect balance of small-town living with access to urban amenities and outdoor recreation.
          </p>
        </div>
      </section>

      {/* 10 Facts Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">10 Things to Know About Timnath</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">1. Rapid Growth</h3>
              <p className="text-gray-700">One of Colorado's fastest-growing towns with modern infrastructure and new developments.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. New Construction</h3>
              <p className="text-gray-700">Abundant new home options with modern designs and energy-efficient features.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Excellent Schools</h3>
              <p className="text-gray-700">Part of highly-rated Poudre School District with brand-new school facilities.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Small-Town Feel</h3>
              <p className="text-gray-700">Maintains a close-knit community atmosphere despite rapid growth.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Strategic Location</h3>
              <p className="text-gray-700">Minutes from Fort Collins with easy I-25 access for commuting.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Parks & Trails</h3>
              <p className="text-gray-700">Multiple parks, playgrounds, and trail systems for outdoor recreation.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Family-Oriented</h3>
              <p className="text-gray-700">Designed with families in mind, featuring safe neighborhoods and kid-friendly amenities.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Growing Retail</h3>
              <p className="text-gray-700">New shopping and dining options opening regularly in the commercial district.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. Community Events</h3>
              <p className="text-gray-700">Regular town events, farmers markets, and festivals foster community connections.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">10. Modern Infrastructure</h3>
              <p className="text-gray-700">New roads, utilities, and facilities built to support continued growth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Report CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Timnath, CO?</h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
          </p>
          <MarketReportForm areaName="Timnath, CO" />
        </div>
      </section>

      {/* Area Highlights */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Timnath Highlights</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Popular Neighborhoods</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Timnath Ranch - Master-planned community</li>
                <li>• Timnath Trail - New construction homes</li>
                <li>• Harvest Village - Family-friendly development</li>
                <li>• Riverbend - Modern townhomes and single-family</li>
                <li>• Downtown Timnath - Historic area with character</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Local Attractions</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Timnath Reservoir - Fishing and water activities</li>
                <li>• Community parks and playgrounds</li>
                <li>• Farmers markets and local events</li>
                <li>• Nearby Poudre River Trail access</li>
                <li>• Short drive to Fort Collins attractions</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

