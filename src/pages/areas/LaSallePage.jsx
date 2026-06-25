import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function LaSallePage() {
  return (
    <>
      <AreaSEO slug="la-salle" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/la-salle.png')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">La Salle, Colorado</h1>
          <p className="mt-4 text-xl">Historic Charm, Modern Opportunities</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your La Salle Area Guide</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            La Salle is a historic community in Northern Colorado that offers affordable living, strong schools, and a welcoming small-town atmosphere. Located in Weld County, La Salle provides residents with a peaceful lifestyle while maintaining easy access to Greeley and other Northern Colorado cities.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            With its rich history, affordable housing, and strong sense of community, La Salle attracts families and individuals seeking quality of life at reasonable prices. The town's excellent schools and safe neighborhoods make it an ideal place to raise a family.
          </p>
        </div>
      </section>

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in La Salle</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in La Salle, CO
          </p>
          <Link
            to="/properties/?location=La Salle, CO"
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search La Salle Homes
          </Link>
        </div>
      </section>

      {/* Economy Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Economy & Community</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                La Salle's economy benefits from its proximity to Greeley, where many residents commute for work. The town itself supports local businesses including shops, restaurants, and service providers that serve the community.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                The cost of living in La Salle is affordable, making it attractive for families, first-time homebuyers, and retirees. The town's strategic location provides convenient access to employment centers while offering lower housing costs.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                La Salle's community-focused atmosphere and affordable lifestyle continue to attract new residents seeking value and quality of life.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Community Features</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Historic community character</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Affordable cost of living</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Excellent schools (Eaton RE-2)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Safe, family-friendly environment</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Close-knit community</span>
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
              src="/images/la-salle.png" 
              alt="La Salle Colorado historic community and small town charm" 
              className="w-full rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Historic Heritage</h3>
              <p className="text-gray-700">
                La Salle's historic character is evident in its architecture and community traditions. Residents take pride in preserving the town's heritage while embracing modern improvements.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Small-Town Living</h3>
              <p className="text-gray-700">
                Enjoy a peaceful, small-town lifestyle with friendly neighbors and a strong sense of community. La Salle offers the personal connections that larger cities often lack.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Family-Oriented</h3>
              <p className="text-gray-700">
                Safe neighborhoods, excellent schools, and community events make La Salle an ideal place for families. The town's supportive atmosphere helps children thrive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Education in La Salle</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            La Salle is served by Eaton School District RE-2, one of Colorado's top-rated school districts. Students attend schools in nearby Eaton, which are known for their excellent academic programs and dedicated teachers.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            The district offers comprehensive education from elementary through high school, with strong academic performance, extensive extracurricular activities, and successful athletic programs. Small class sizes ensure personalized attention for each student.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Proximity to Greeley provides access to the University of Northern Colorado and other higher education opportunities.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Location & Accessibility</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            La Salle is located approximately 8 miles southwest of Greeley in Weld County. The town's location provides easy access to Greeley's amenities, employment opportunities, and services while maintaining a distinct small-town character.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Denver International Airport is about 70 miles south, roughly an hour and fifteen minutes drive. La Salle's location offers residents affordable living with convenient access to urban centers and outdoor recreation.
          </p>
        </div>
      </section>

      {/* 10 Facts Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">10 Things to Know About La Salle</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">1. Historic Community</h3>
              <p className="text-gray-700">Rich history and heritage preserved in the town's character and architecture.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. Affordable Living</h3>
              <p className="text-gray-700">Lower cost of living and housing compared to larger Northern Colorado cities.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Excellent Schools</h3>
              <p className="text-gray-700">Part of top-rated Eaton School District with strong academic programs.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Small-Town Feel</h3>
              <p className="text-gray-700">Tight-knit community where neighbors know and support each other.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Close to Greeley</h3>
              <p className="text-gray-700">Just 8 miles from Greeley for shopping, dining, and employment.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Safe Community</h3>
              <p className="text-gray-700">Low crime rates and family-friendly environment ideal for raising children.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Community Pride</h3>
              <p className="text-gray-700">Residents take pride in their town and actively participate in community events.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Outdoor Access</h3>
              <p className="text-gray-700">Easy access to parks, trails, and nearby reservoirs for recreation.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. Family Values</h3>
              <p className="text-gray-700">Community built on traditional values and strong family connections.</p>
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
          <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for La Salle, CO?</h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
          </p>
          <MarketReportForm areaName="La Salle, CO" />
        </div>
      </section>

      {/* Area Highlights */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">La Salle Highlights</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Popular Neighborhoods</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Downtown La Salle - Historic charm</li>
                <li>• Residential subdivisions - Family homes</li>
                <li>• Established neighborhoods - Mature trees</li>
                <li>• Affordable starter homes</li>
                <li>• Country properties - Larger lots</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Local Attractions</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Community parks and recreation</li>
                <li>• Annual town festivals and events</li>
                <li>• Nearby Eaton schools and facilities</li>
                <li>• Short drive to Greeley amenities</li>
                <li>• Access to regional outdoor recreation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <AreaFAQSection faqs={AREA_FAQS['la-salle']} city="La Salle" />

    </>
  );
}

