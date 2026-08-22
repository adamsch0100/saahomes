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

export default function EatonPage() {
  const area = getAreaSeo("eaton");

  return (
    <>
      <AreaSEO slug="eaton" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Eaton-CO-Area-Guide.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Eaton, Colorado</h1>
          <p className="mt-4 text-xl">{area.tagline}</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your Eaton Area Guide</h2>
          {area.introParagraphs?.map((p, i) => (
            <p key={i} className="text-lg text-gray-700 leading-relaxed mb-6">{p}</p>
          ))}
        </div>
      </section>

      <LatestMarketUpdateBanner variant="compact" cityName="Eaton" />

      {/* City Stats Band — quick info cards */}
      <div className="max-w-6xl mx-auto px-6 mt-8 mb-8">
        <CityStatsBand city="Eaton" />
      </div>

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in Eaton</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in Eaton, CO
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/properties/?location=Eaton, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search Eaton Homes
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

      {/* Why Buy in Eaton? */}
      {area.whyChoose?.length > 0 && (
        <section className="py-16 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold font-serif mb-8 text-center">Why Buy in Eaton?</h2>
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

      {/* Economy & Community */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Economy & Community</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Eaton's economy is rooted in agriculture, with farming and ranching playing significant roles in the community. Many residents work in agriculture-related industries or commute to nearby Greeley for employment.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                The town's small business community includes local shops, restaurants, and service providers that contribute to Eaton's close-knit atmosphere. The cost of living is affordable, making it attractive for families and retirees.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Eaton's strategic location provides convenient access to larger employment centers while offering the benefits of rural living.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Community Features</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Strong agricultural heritage</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Excellent school district (Eaton RE-2)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Affordable housing options</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Safe, family-friendly environment</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Active community involvement</span>
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
              src="/images/Eaton-CO-Area-Guide.jpg" 
              alt="Eaton Colorado rural community and agricultural heritage" 
              className="w-full rounded-lg shadow-lg"
              loading="lazy" decoding="async"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Rural Living</h3>
              <p className="text-gray-700">
                Eaton offers a peaceful rural lifestyle with open spaces, agricultural land, and beautiful views. Residents enjoy the slower pace and connection to the land.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Community Spirit</h3>
              <p className="text-gray-700">
                Strong sense of community with active involvement in schools, churches, and local events. Neighbors know each other and support one another.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Outdoor Activities</h3>
              <p className="text-gray-700">
                Surrounded by open spaces and agricultural land, Eaton provides opportunities for outdoor recreation. Nearby reservoirs and parks offer additional activities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Education in Eaton</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Eaton is served by Eaton School District RE-2, which is known for its excellent academic programs and dedicated teachers. The district operates Eaton Elementary, Eaton Middle School, and Eaton High School.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Eaton schools consistently rank among the top in the state, with strong academic performance, comprehensive extracurricular programs, and successful athletic teams. The district's commitment to student success is evident in its supportive learning environment.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Small class sizes and personalized attention ensure that each student receives the support they need to thrive academically and personally.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Location & Accessibility</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Eaton is located approximately 10 miles north of Greeley in Weld County. The town's location provides easy access to Greeley's amenities while maintaining a distinct rural character.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Denver International Airport is about 75 miles south, roughly an hour and a half drive. Eaton's location offers residents the perfect balance of rural living with convenient access to urban centers and outdoor recreation.
          </p>
        </div>
      </section>

      {/* 10 Facts Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">10 Things to Know About Eaton</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">1. Top-Rated Schools</h3>
              <p className="text-gray-700">Eaton School District consistently ranks among Colorado's best with excellent academic programs.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. Agricultural Heritage</h3>
              <p className="text-gray-700">Strong farming and ranching traditions that shape the community's identity.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Affordable Living</h3>
              <p className="text-gray-700">Lower cost of living and housing compared to larger Northern Colorado cities.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Small-Town Feel</h3>
              <p className="text-gray-700">Tight-knit community where everyone knows their neighbors.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Safe Community</h3>
              <p className="text-gray-700">Low crime rates and family-friendly environment ideal for raising children.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Close to Greeley</h3>
              <p className="text-gray-700">Just 10 minutes from Greeley for shopping, dining, and employment.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Open Spaces</h3>
              <p className="text-gray-700">Surrounded by agricultural land and open spaces with mountain views.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Community Events</h3>
              <p className="text-gray-700">Annual festivals, school events, and community gatherings bring residents together.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. Strong Athletics</h3>
              <p className="text-gray-700">Eaton High School is known for successful athletic programs and school spirit.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">10. Family Values</h3>
              <p className="text-gray-700">Community built on traditional values and strong family connections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Report CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Eaton, CO?</h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
          </p>
          <MarketReportForm areaName="Eaton, CO" />
        </div>
      </section>

      {/* CHFA First-Time Buyer Banner */}
      <section className="py-12 px-6 rounded-lg" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            First-time buyer in Eaton?
          </h2>
          <p className="text-gray-800 mb-6">
            Many Eaton buyers qualify for CHFA down payment assistance — grants and deferred loans up to $25,000 for down payment and closing costs.
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
          <NeighborhoodLinks citySlug="eaton" cityName="Eaton" />
        </div>
      </section>

      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Eaton Highlights</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Popular Neighborhoods</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Downtown Eaton - Historic charm</li>
                <li>• Residential subdivisions - Family homes</li>
                <li>• Country properties - Larger lots</li>
                <li>• New developments - Modern amenities</li>
                <li>• Rural estates - Agricultural living</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Local Attractions</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Eaton schools and athletic facilities</li>
                <li>• Community parks and recreation</li>
                <li>• Annual town festivals and events</li>
                <li>• Nearby Boyd Lake and reservoirs</li>
                <li>• Agricultural tours and farm visits</li>
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
            Eaton offers rural living just minutes from Greeley and other Northern Colorado cities. Explore surrounding communities.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/northern-colorado-areas/severance/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Severance →</h3>
              <p className="text-sm text-gray-600">Growing community, 10 min north</p>
            </Link>
            <Link to="/northern-colorado-areas/greeley/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Greeley →</h3>
              <p className="text-sm text-gray-600">Weld County hub, 10 min south</p>
            </Link>
            <Link to="/northern-colorado-areas/windsor/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Windsor →</h3>
              <p className="text-sm text-gray-600">Family communities, 15 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/fort-collins/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Fort Collins →</h3>
              <p className="text-sm text-gray-600">CSU and breweries, 20 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/milliken/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Milliken →</h3>
              <p className="text-sm text-gray-600">Affordable living, 12 min south</p>
            </Link>
            <Link to="/northern-colorado-areas/johnstown/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Johnstown →</h3>
              <p className="text-sm text-gray-600">I-25 corridor, 20 min south</p>
            </Link>
          </div>
        </div>
      </section>

      <RecentlySoldSection citySlug="eaton" />

      <AreaFAQSection faqs={AREA_FAQS['eaton']} city="Eaton" />

      <AreaEventsSection city="Eaton" slug="eaton" />

      {/* Final CTA */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Ready to buy or sell in Eaton?</h2>
          <p className="text-gray-300 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across Eaton and all of Northern Colorado.
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