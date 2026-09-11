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

export default function LaSallePage() {
  const area = getAreaSeo("la-salle");

  return (
    <>
      <AreaSEO slug="la-salle" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/la-salle.png')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">La Salle, Colorado</h1>
          <p className="mt-4 text-xl">{area.tagline}</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your La Salle Area Guide</h2>
          {area.introParagraphs?.map((p, i) => (
            <p key={i} className="text-lg text-gray-700 leading-relaxed mb-6">{p}</p>
          ))}
        </div>
      </section>

      <LatestMarketUpdateBanner variant="compact" cityName="La Salle" />

      {/* City Stats Band — quick info cards */}
      <div className="max-w-6xl mx-auto px-6 mt-8 mb-8">
        <CityStatsBand city="La Salle" />
      </div>

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in La Salle</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in La Salle, CO
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/properties/?location=La Salle, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search La Salle Homes
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

      {/* Sell Your Home in La Salle */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-6">Sell Your Home in La Salle</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Thinking about selling in La Salle? Get a free, no-obligation market analysis and see
            what your Weld County home is worth in today&rsquo;s market. Schwartz and Associates
            brings local pricing strategy, professional marketing, and responsive service to every
            La Salle listing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/for-sellers/#home-valuation"
              className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Free Market Analysis
            </Link>
            <a
              href="tel:(970) 999-1407"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Call (970) 999-1407
            </a>
          </div>
        </div>
      </section>


      {/* Why Buy in La Salle? */}
      {area.whyChoose?.length > 0 && (
        <section className="py-16 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold font-serif mb-8 text-center">Why Buy in La Salle?</h2>
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
                  <span>Weld County School District RE-1</span>
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
              loading="lazy" decoding="async"
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
            La Salle is served by Weld County School District RE-1, which operates schools across La Salle, Gilcrest, and Platteville. Students in town attend Pete Mirich Elementary School (PreK–6) and North Valley Middle School, then continue to Valley High School in nearby Gilcrest.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            The district emphasizes strong academic programs, dedicated teachers, and extracurricular activities from elementary through high school. Smaller class sizes help ensure personalized attention for each student.
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
              <h3 className="text-xl font-bold mb-2">1. Small-Town Population</h3>
              <p className="text-gray-700">La Salle counted 2,359 residents in the 2020 U.S. Census — a quiet, close-knit Weld County community.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. ZIP Code 80645</h3>
              <p className="text-gray-700">The town sits in Weld County&rsquo;s 80645 ZIP code, south of Greeley along the South Platte River valley.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Weld County School District RE-1</h3>
              <p className="text-gray-700">Students attend Pete Mirich Elementary School and North Valley Middle School in La Salle, then Valley High School in nearby Gilcrest.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Median Age ~35</h3>
              <p className="text-gray-700">A median age in the mid-30s reflects a community of young families and working residents.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Close to Greeley</h3>
              <p className="text-gray-700">Roughly 8 miles southwest of Greeley for shopping, dining, healthcare, and the University of Northern Colorado.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Agricultural Heritage</h3>
              <p className="text-gray-700">Farming and ranching remain central to the town&rsquo;s identity and surrounding South Platte valley landscape.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Affordable Living</h3>
              <p className="text-gray-700">Among the most affordable entry points in the Greeley metro, attractive to first-time buyers.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Small-Town Feel</h3>
              <p className="text-gray-700">A tight-knit community where neighbors know and support one another.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. Outdoor Access</h3>
              <p className="text-gray-700">Easy access to the South Platte River, regional trails, and nearby reservoirs for recreation.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">10. Commuter-Friendly</h3>
              <p className="text-gray-700">A short drive to Greeley, Evans, and Milliken — and about 70 miles from Denver International Airport.</p>
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

      {/* CHFA First-Time Buyer Banner */}
      <section className="py-12 px-6 rounded-lg" style={{ backgroundColor: GOLD }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
            First-time buyer in La Salle?
          </h2>
          <p className="text-gray-800 mb-6">
            Many La Salle buyers qualify for CHFA down payment assistance — grants and deferred loans up to $25,000 for down payment and closing costs.
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
          <NeighborhoodLinks citySlug="la-salle" cityName="La Salle" />
        </div>
      </section>

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

      {/* Nearby Northern Colorado Communities */}
      <section className="py-8 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Nearby Northern Colorado Communities</h2>
          <p className="text-gray-700 text-center mb-6">
            La Salle offers quiet Weld County living minutes south of Greeley. Explore nearby communities to find your perfect fit.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/northern-colorado-areas/greeley/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Greeley →</h3>
              <p className="text-sm text-gray-600">Weld County hub, 8 min north</p>
            </Link>
            <Link to="/northern-colorado-areas/evans/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Evans →</h3>
              <p className="text-sm text-gray-600">Weld neighbor, 5 min north</p>
            </Link>
            <Link to="/northern-colorado-areas/milliken/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Milliken →</h3>
              <p className="text-sm text-gray-600">Affordable Weld, 10 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/fort-collins/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Fort Collins →</h3>
              <p className="text-sm text-gray-600">CSU and breweries, 25 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/johnstown/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Johnstown →</h3>
              <p className="text-sm text-gray-600">I-25 corridor, 15 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/eaton/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Eaton →</h3>
              <p className="text-sm text-gray-600">Rural schools community, 12 min northwest</p>
            </Link>
          </div>
        </div>
      </section>

      <RecentlySoldSection citySlug="la-salle" />

      <AreaFAQSection faqs={AREA_FAQS['la-salle']} city="La Salle" />

      <AreaEventsSection city="La Salle" slug="la-salle" />

      {/* Final CTA */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-serif mb-4">Ready to buy or sell in La Salle?</h2>
          <p className="text-gray-300 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across La Salle and all of Northern Colorado.
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