import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function WellingtonPage() {
  return (
    <>
      <AreaSEO slug="wellington" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/wellington.png')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Wellington, Colorado</h1>
          <p className="mt-4 text-xl">Small-Town Charm with Big-Hearted Community</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your Wellington Area Guide</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Wellington is a charming small town in Northern Colorado that offers the perfect blend of rural living and modern convenience. With its agricultural heritage, friendly community, and affordable housing, Wellington attracts families and individuals seeking a quieter pace of life without sacrificing access to amenities.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Located just north of Fort Collins, Wellington provides easy access to the city while maintaining its distinct small-town character. The town's excellent schools, safe neighborhoods, and strong community spirit make it an ideal place to raise a family or enjoy a peaceful lifestyle.
          </p>
        </div>
      </section>

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in Wellington</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in Wellington, CO
          </p>
          <Link
            to="/properties/?location=Wellington, CO"
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search Wellington Homes
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
                Wellington's economy is rooted in agriculture, with many residents involved in farming and ranching. The town also benefits from its proximity to Fort Collins, where many residents commute for work.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Local businesses include family-owned shops, restaurants, and service providers that contribute to the town's close-knit atmosphere. Wellington's affordable cost of living and housing make it an attractive option for those seeking value.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                The town's strategic location along Highway 1 provides convenient access to Fort Collins, Loveland, and other Northern Colorado communities.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Community Features</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Agricultural heritage and traditions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Affordable housing options</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Excellent schools (Poudre School District)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Safe, family-friendly neighborhoods</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Strong community involvement</span>
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
              src="/images/wellington.png" 
              alt="Wellington Colorado small town and agricultural landscape" 
              className="w-full rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Small-Town Living</h3>
              <p className="text-gray-700">
                Wellington offers a peaceful, rural lifestyle with friendly neighbors and a strong sense of community. Residents enjoy the slower pace and personal connections.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Outdoor Recreation</h3>
              <p className="text-gray-700">
                Surrounded by open spaces and agricultural land, Wellington provides opportunities for hiking, biking, and enjoying Colorado's natural beauty. Nearby reservoirs offer fishing and water sports.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Community Events</h3>
              <p className="text-gray-700">
                The town hosts annual events like the Wellington Harvest Festival, bringing the community together to celebrate local traditions and agriculture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Education in Wellington</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Wellington is served by Poudre School District, one of Colorado's top-rated school districts. The town is home to several schools, including Wellington Middle School and Eyestone Elementary.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            These schools are known for their dedicated teachers, strong academic programs, and supportive learning environments. The district offers comprehensive education from elementary through high school, with numerous extracurricular activities and athletic programs.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Proximity to Fort Collins provides access to Colorado State University and other higher education opportunities.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Location & Accessibility</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Wellington is located approximately 10 miles north of Fort Collins along Highway 1. This strategic location provides easy access to Fort Collins' amenities while maintaining a distinct rural character.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            The town is about 70 miles from Denver International Airport, making it accessible for travel. Wellington's location offers the best of both worlds - small-town living with convenient access to urban centers and outdoor recreation.
          </p>
        </div>
      </section>

      {/* 10 Facts Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">10 Things to Know About Wellington</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">1. Agricultural Roots</h3>
              <p className="text-gray-700">Strong farming and ranching heritage that continues to shape the community's character.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. Affordable Housing</h3>
              <p className="text-gray-700">More affordable home prices compared to nearby Fort Collins and Loveland.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Excellent Schools</h3>
              <p className="text-gray-700">Part of highly-rated Poudre School District with dedicated educators.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Small-Town Feel</h3>
              <p className="text-gray-700">Tight-knit community where neighbors know each other and look out for one another.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Fort Collins Access</h3>
              <p className="text-gray-700">Just 10 minutes from Fort Collins for shopping, dining, and entertainment.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Open Spaces</h3>
              <p className="text-gray-700">Surrounded by agricultural land and open spaces with mountain views.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Family-Friendly</h3>
              <p className="text-gray-700">Safe neighborhoods and excellent schools make it ideal for raising families.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Community Events</h3>
              <p className="text-gray-700">Annual festivals and events celebrate local traditions and bring residents together.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. Outdoor Access</h3>
              <p className="text-gray-700">Easy access to hiking, biking, fishing, and other outdoor recreation.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">10. Growing Community</h3>
              <p className="text-gray-700">Steady growth while maintaining small-town character and values.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Report CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Wellington, CO?</h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
          </p>
          <MarketReportForm areaName="Wellington, CO" />
        </div>
      </section>

      {/* Area Highlights */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Wellington Highlights</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Popular Neighborhoods</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Downtown Wellington - Historic charm</li>
                <li>• North Wellington - Newer developments</li>
                <li>• Country estates - Larger properties</li>
                <li>• Residential subdivisions - Family-friendly</li>
                <li>• Rural properties - Agricultural living</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Local Attractions</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Wellington Harvest Festival - Annual celebration</li>
                <li>• Local parks and recreation areas</li>
                <li>• Nearby Boyd Lake State Park</li>
                <li>• Agricultural tours and farm visits</li>
                <li>• Short drive to Fort Collins attractions</li>
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
            Wellington offers small-town living just minutes from Fort Collins. Explore the surrounding communities.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/northern-colorado-areas/fort-collins/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Fort Collins →</h3>
              <p className="text-sm text-gray-600">CSU and downtown, 10 min south</p>
            </Link>
            <Link to="/northern-colorado-areas/windsor/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Windsor →</h3>
              <p className="text-sm text-gray-600">Family communities, 15 min east</p>
            </Link>
            <Link to="/northern-colorado-areas/timnath/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Timnath →</h3>
              <p className="text-sm text-gray-600">New construction hub, 12 min southeast</p>
            </Link>
            <Link to="/northern-colorado-areas/loveland/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Loveland →</h3>
              <p className="text-sm text-gray-600">Lake living and arts, 20 min south</p>
            </Link>
            <Link to="/northern-colorado-areas/greeley/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Greeley →</h3>
              <p className="text-sm text-gray-600">Weld County value, 25 min east</p>
            </Link>
            <Link to="/northern-colorado-areas/johnstown/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Johnstown →</h3>
              <p className="text-sm text-gray-600">I-25 corridor, 25 min south</p>
            </Link>
          </div>
        </div>
      </section>

      <AreaFAQSection faqs={AREA_FAQS['wellington']} city="Wellington" />

    </>
  );
}

