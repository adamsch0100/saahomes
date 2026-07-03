import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import AreaFAQSection from "../../components/AreaFAQSection.jsx";
import { AREA_FAQS } from "../../data/areaFaqs.js";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";
import NeighborhoodLinks from "../../components/NeighborhoodLinks.jsx";

export default function MeadPage() {
  return (
    <>
      <AreaSEO slug="mead" />
      
      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Mead.JPG')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Mead, CO</h1>
          <p className="mt-4 text-xl">Small Town Charm, Big Community Heart</p>
        </div>
      </section>

      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Area Guide Intro */}
        <section className="mb-12">
          <h2 className="text-4xl font-bold mb-6">Mead, CO Area Guide</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Mead is a charming small town located in Weld County, Colorado, offering residents a peaceful, family-friendly atmosphere with easy access to larger cities. With a population of approximately 5,000, Mead provides the perfect balance of small-town living and modern conveniences.
            </p>
          </div>
        </section>

        {/* Property Search CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Search Homes in Mead</h2>
            <p className="text-lg mb-6 text-gray-700">
              Explore available properties in Mead, CO
            </p>
            <Link
              to="/properties/?location=Mead, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search Mead Homes
            </Link>
          </div>
        </section>

        {/* Moving to Mead */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Moving to Mead, CO - Here's what it's like living in Mead!</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Mead offers a unique blend of rural charm and suburban convenience. Located just minutes from Longmont and a short drive to both Fort Collins and Boulder, residents enjoy the tranquility of small-town life while having access to big-city amenities. The town is known for its strong sense of community, excellent schools, and family-oriented atmosphere.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The town features beautiful open spaces, well-maintained parks, and a growing network of trails perfect for outdoor enthusiasts. Mead's downtown area, though small, offers local shops and restaurants that contribute to the town's friendly, neighborly feel.
            </p>
          </div>
        </section>

        {/* Economy */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Mead Economy -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Mead's economy benefits from its strategic location between several major employment centers. Many residents commute to nearby cities like Longmont, Boulder, Fort Collins, and the Denver metro area for work. The town itself has seen steady growth in local businesses, particularly in retail and service industries.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The area's agricultural heritage remains important, with farming and ranching still playing a role in the local economy. However, Mead has been experiencing residential growth, attracting families seeking affordable housing options with excellent schools and a safe, community-oriented environment.
            </p>
          </div>
        </section>

        {/* Culture and Activities */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Culture and Activities in Mead -</h2>
          <div className="prose prose-lg max-w-none">
            <div className="mb-6">
              <img 
                src="/images/Mead.JPG" 
                alt="Mead Colorado community and Rocky Mountain views" 
                className="w-full rounded-lg shadow-lg"
                loading="lazy"
              />
            </div>
            <p className="text-lg leading-relaxed mb-4">
              Mead's community spirit shines through its numerous family-friendly events and activities. The town hosts annual celebrations including the Mead Day festival, which brings together residents for food, music, and entertainment. The community center offers various programs and activities for all ages throughout the year.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Outdoor recreation is a major draw for Mead residents. The town features several parks including Mead Town Park and Bison Ridge Park, offering playgrounds, sports fields, and picnic areas. The nearby St. Vrain State Park provides opportunities for hiking, fishing, and wildlife viewing. For those seeking more adventure, the Rocky Mountains are just a short drive away.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Families appreciate the town's safe neighborhoods, excellent schools, and abundance of youth sports and activities. The close-knit community means neighbors know each other, creating a supportive environment for raising children.
            </p>
          </div>
        </section>

        {/* Education */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Education in Mead -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Mead is served by the St. Vrain Valley School District, one of the highest-rated school districts in Colorado. The district is known for its innovative approach to education, strong academic programs, and commitment to student success.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Local schools include Mead Elementary School, Mead Middle School, and Mead High School, all of which maintain excellent reputations for academic achievement and extracurricular programs. The schools emphasize STEM education, arts programs, and athletics, providing students with well-rounded educational experiences.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              For higher education, residents have easy access to Front Range Community College in Longmont, as well as the University of Colorado Boulder and Colorado State University in Fort Collins, both within a 30-minute drive.
            </p>
          </div>
        </section>

        {/* Location and Climate */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Location and Climate of Mead -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Mead is strategically located in Northern Colorado, sitting at an elevation of approximately 4,900 feet. The town is positioned between Longmont to the south and Greeley to the north, with easy access to I-25 via Highway 66. This location provides residents with convenient access to major employment centers while maintaining a peaceful, rural atmosphere.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The climate in Mead is typical of the Colorado Front Range, featuring four distinct seasons. Residents enjoy over 300 days of sunshine per year, with mild summers where temperatures typically range from the 70s to low 90s. Winters are generally moderate, with occasional snowfall and temperatures ranging from the 20s to 40s. The low humidity and abundant sunshine make outdoor activities enjoyable year-round.
            </p>
          </div>
        </section>

        {/* 10 Facts */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">10 Facts About Mead, Colorado</h2>
          <div className="prose prose-lg max-w-none">
            <ul className="list-disc pl-6 space-y-3 text-lg">
              <li>Mead was incorporated in 1908 and named after a local rancher, William Mead.</li>
              <li>The town's population has grown significantly in recent years, attracting families seeking quality schools and affordable housing.</li>
              <li>Mead is part of the St. Vrain Valley School District, consistently ranked among the top school districts in Colorado.</li>
              <li>The town hosts an annual Mead Day celebration, bringing the community together for family-friendly fun.</li>
              <li>Mead is located just 15 minutes from Longmont and 30 minutes from both Boulder and Fort Collins.</li>
              <li>The area offers excellent access to outdoor recreation, including nearby state parks and mountain trails.</li>
              <li>Mead maintains a small-town feel with a strong sense of community and neighborly spirit.</li>
              <li>The town features several well-maintained parks and recreational facilities for residents of all ages.</li>
              <li>Mead's location provides stunning views of both the Rocky Mountains to the west and the plains to the east.</li>
              <li>The town has experienced steady growth while maintaining its commitment to preserving its small-town character and quality of life.</li>
            </ul>
          </div>
        </section>

        {/* Market Report CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Mead, CO?</h2>
            <p className="text-lg mb-6 text-center text-gray-700">
              We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
            </p>
            <MarketReportForm areaName="Mead, CO" />
          </div>
        </section>

        {/* Area Highlights */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Area Highlights</h2>
          <p className="text-lg mb-6">A quick view of the most influential metrics in Mead, CO.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">Population</h3>
              <p className="text-3xl font-bold text-gray-900">~5,000</p>
              <p className="text-sm text-gray-600 mt-2">Growing community</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">Median Home Price</h3>
              <p className="text-3xl font-bold text-gray-900">$550K+</p>
              <p className="text-sm text-gray-600 mt-2">Competitive market</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">School Rating</h3>
              <p className="text-3xl font-bold text-gray-900">A+</p>
              <p className="text-sm text-gray-600 mt-2">St. Vrain Valley Schools</p>
            </div>
          </div>
        </section>

      </article>

      {/* Neighborhood Guides */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <NeighborhoodLinks citySlug="mead" cityName="Mead" />
        </div>
      </section>

      <AreaFAQSection faqs={AREA_FAQS['mead']} city="Mead" />

    </>
  );
}

