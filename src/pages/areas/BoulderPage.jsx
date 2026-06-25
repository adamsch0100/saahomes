import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import AreaFAQSection from "../../components/AreaFAQSection.jsx";
import { AREA_FAQS } from "../../data/areaFaqs.js";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function BoulderPage() {
  return (
    <>
      <AreaSEO slug="boulder" />
      
      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Boulder.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Boulder, CO</h1>
          <p className="mt-4 text-xl">Where Mountains Meet Innovation</p>
        </div>
      </section>

      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Area Guide Intro */}
        <section className="mb-12">
          <h2 className="text-4xl font-bold mb-6">Boulder, CO Area Guide</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Boulder is an iconic Colorado city of approximately 108,000 residents, nestled at the base of the Rocky Mountains' Flatirons. Known worldwide for its stunning natural beauty, progressive values, and active lifestyle, Boulder offers an unparalleled quality of life. The city consistently ranks among the best places to live in America, attracting outdoor enthusiasts, entrepreneurs, scientists, and artists from around the globe.
            </p>
          </div>
        </section>

        {/* Property Search CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Search Homes in Boulder</h2>
            <p className="text-lg mb-6 text-gray-700">
              Explore available properties in Boulder, CO
            </p>
            <Link
              to="/properties/?location=Boulder, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search Boulder Homes
            </Link>
          </div>
        </section>

        {/* Moving to Boulder */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Moving to Boulder, CO - Here's what it's like living in Boulder!</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Living in Boulder means embracing an active, outdoor-oriented lifestyle. The city's location at the base of the Flatirons provides immediate access to world-class hiking, rock climbing, and mountain biking. The iconic Pearl Street Mall serves as the heart of downtown, offering a vibrant mix of local shops, restaurants, street performers, and cultural events.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Boulder residents are known for their commitment to health, wellness, and environmental sustainability. The city boasts more than 300 miles of biking and hiking trails, numerous parks and open spaces, and a strong culture of outdoor recreation. Whether you're into trail running, skiing, cycling, or simply enjoying nature, Boulder offers endless opportunities for adventure.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The community is highly educated and diverse, with the University of Colorado Boulder bringing energy and innovation to the city. Boulder's tech scene is thriving, with numerous startups and established companies choosing to call Boulder home. The city's commitment to sustainability, arts, and culture creates a unique and inspiring place to live.
            </p>
          </div>
        </section>

        {/* Economy */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Boulder Economy -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Boulder's economy is one of the most dynamic and innovative in Colorado. The city is a major hub for technology, aerospace, biotechnology, and natural foods industries. Major employers include Google, IBM, Ball Aerospace, and numerous successful startups that have chosen Boulder for its quality of life and educated workforce.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The University of Colorado Boulder is a significant economic driver, employing thousands and conducting cutting-edge research in fields ranging from aerospace to renewable energy. The university's presence has helped establish Boulder as a center for innovation and entrepreneurship, with numerous research institutes and national laboratories calling the area home.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Boulder's natural foods industry has deep roots in the city, with companies like Celestial Seasonings, Justin's, and Alfalfa's Market starting here. The city continues to attract health and wellness companies, contributing to its reputation as a leader in sustainable and organic food production.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              With one of the highest concentrations of high-tech workers in the nation and a highly educated population, Boulder offers exceptional career opportunities. The city's entrepreneurial spirit is supported by numerous co-working spaces, incubators, and venture capital firms, making it an ideal place for startups and established companies alike.
            </p>
          </div>
        </section>

        {/* Culture and Activities */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Culture and Activities in Boulder -</h2>
          <div className="prose prose-lg max-w-none">
            <div className="mb-6">
              <img 
                src="/images/Boulder.jpg" 
                alt="Boulder Colorado Flatirons and mountain views" 
                className="w-full rounded-lg shadow-lg"
                loading="lazy"
              />
            </div>
            <p className="text-lg leading-relaxed mb-4">
              Boulder's cultural scene is as diverse and vibrant as its landscape. The Pearl Street Mall is the epicenter of downtown life, featuring street performers, outdoor dining, boutique shopping, and year-round events. The Boulder Theater and Fox Theatre host world-class musical acts, while the Dairy Arts Center and Boulder Museum of Contemporary Art showcase visual and performing arts.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The city hosts numerous festivals and events throughout the year, including the Boulder Creek Festival, Colorado Shakespeare Festival, and the Boulder International Film Festival. The Boulder Farmers Market, operating year-round, is one of the largest and most popular in the state, featuring local produce, artisan goods, and live music.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Outdoor recreation is woven into the fabric of daily life in Boulder. Chautauqua Park, a National Historic Landmark, provides access to dozens of hiking trails leading into the Flatirons. The Boulder Creek Path runs through the heart of the city, offering 5.5 miles of paved trail perfect for walking, running, and cycling. For water enthusiasts, Boulder Reservoir offers swimming, paddleboarding, and sailing.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Boulder's food and beverage scene is exceptional, with farm-to-table restaurants, innovative cuisine, and a thriving craft brewery scene. The city is home to Avery Brewing Company, Upslope Brewing, and numerous other breweries and distilleries. Boulder's commitment to organic and sustainable food is evident in its many health-conscious restaurants and cafes.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              For families, Boulder offers excellent parks, playgrounds, and recreational programs. The Boulder Valley School District provides numerous options for youth sports, arts programs, and educational activities. The city's numerous open spaces and nature areas provide endless opportunities for children to explore and learn about the natural world.
            </p>
          </div>
        </section>

        {/* Education */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Education in Boulder -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Boulder is home to one of the nation's premier public research universities, the University of Colorado Boulder (CU Boulder). The university is consistently ranked among the top public universities in the country and is known for its strong programs in aerospace engineering, physics, environmental sciences, and business. CU Boulder's presence brings cultural events, athletic competitions, and educational opportunities to the entire community.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The Boulder Valley School District serves the city and surrounding areas, offering a variety of educational options including traditional public schools, charter schools, and alternative programs. The district is known for its commitment to academic excellence, innovative teaching methods, and strong arts and athletics programs. Notable schools include Boulder High School, Fairview High School, and numerous highly-rated elementary and middle schools.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Boulder also offers several private and independent schools, including the Boulder Country Day School and Alexander Dawson School, providing families with diverse educational choices. The city's commitment to education extends beyond K-12, with numerous opportunities for adult education, professional development, and lifelong learning.
            </p>
          </div>
        </section>

        {/* Location and Climate */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Location and Climate of Boulder -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Boulder is located in Boulder County, Colorado, at an elevation of 5,430 feet, nestled between the plains and the Rocky Mountains. The city sits at the base of the iconic Flatirons, dramatic rock formations that have become synonymous with Boulder's identity. Located just 25 miles northwest of Denver via Highway 36, Boulder offers easy access to the Denver metropolitan area while maintaining its distinct character and mountain-town feel.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Boulder's climate is characterized by abundant sunshine, low humidity, and four distinct seasons. The city enjoys over 300 days of sunshine per year, making outdoor activities enjoyable year-round. Summers are warm and pleasant, with average high temperatures in the mid-80s to low 90s, while winters are relatively mild with average highs in the mid-40s. The city receives moderate snowfall, typically around 80 inches per year, with most snow melting quickly due to the abundant sunshine.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The city's unique location creates a phenomenon known as the "Boulder Bubble," where temperatures can be significantly warmer than surrounding areas due to downslope winds from the mountains. This microclimate contributes to Boulder's reputation as an ideal place for outdoor recreation throughout the year.
            </p>
          </div>
        </section>

        {/* 10 Facts */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">10 Facts About Boulder, Colorado</h2>
          <div className="prose prose-lg max-w-none">
            <ul className="list-disc pl-6 space-y-3 text-lg">
              <li>Boulder was founded in 1859 during the Colorado Gold Rush and named for the large boulders found in the area.</li>
              <li>The University of Colorado Boulder was established in 1876, five months before Colorado became a state.</li>
              <li>Boulder has been named the "Happiest City in America" and consistently ranks among the healthiest and most educated cities in the nation.</li>
              <li>The city is home to the National Center for Atmospheric Research (NCAR), a world-renowned climate research facility.</li>
              <li>Boulder's Pearl Street Mall, created in 1977, was one of the first pedestrian malls in the United States.</li>
              <li>The city has more than 60,000 acres of open space and mountain parks, protected for public use and wildlife habitat.</li>
              <li>Boulder is known as a hub for outdoor recreation, with more outdoor gear companies per capita than any other U.S. city.</li>
              <li>The Flatirons, Boulder's iconic rock formations, are approximately 290 million years old.</li>
              <li>Boulder was the first city in the United States to tax itself for the acquisition and preservation of open space land.</li>
              <li>The city is home to numerous Olympic athletes and training facilities, earning it recognition as a premier destination for elite athletes.</li>
            </ul>
          </div>
        </section>

        {/* Market Report CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Boulder, CO?</h2>
            <p className="text-lg mb-6 text-center text-gray-700">
              We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
            </p>
            <MarketReportForm areaName="Boulder, CO" />
          </div>
        </section>

        {/* Area Highlights */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Area Highlights</h2>
          <p className="text-lg mb-6">A quick view of the most influential metrics in Boulder, CO.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">Population</h3>
              <p className="text-3xl font-bold text-gray-900">~108,000</p>
              <p className="text-sm text-gray-600 mt-2">Vibrant community</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">Median Home Price</h3>
              <p className="text-3xl font-bold text-gray-900">$850K+</p>
              <p className="text-sm text-gray-600 mt-2">Premium market</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">School Rating</h3>
              <p className="text-3xl font-bold text-gray-900">A</p>
              <p className="text-sm text-gray-600 mt-2">Boulder Valley Schools</p>
            </div>
          </div>
        </section>

      </article>

      <AreaFAQSection faqs={AREA_FAQS['boulder']} city="Boulder" />

    </>
  );
}

