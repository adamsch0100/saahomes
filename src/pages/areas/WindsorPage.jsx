import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import AreaFAQSection from "../../components/AreaFAQSection.jsx";
import { AREA_FAQS } from "../../data/areaFaqs.js";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function WindsorPage() {
  return (
    <>
      <AreaSEO slug="windsor" />
      
      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Windsor-CO-Area-Guide.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Windsor, CO</h1>
          <p className="mt-4 text-xl">Small Town Charm, Big City Convenience</p>
        </div>
      </section>

      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Area Guide Intro */}
        <section className="mb-12">
          <h2 className="text-4xl font-bold mb-6">Windsor, CO Area Guide</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Windsor is a thriving community of approximately 35,000 residents located in northern Colorado. Situated between Fort Collins and Loveland, Windsor offers the perfect blend of small-town charm and modern amenities. Known for its excellent schools, family-friendly atmosphere, and strong sense of community, Windsor has become one of the fastest-growing towns in Colorado.
            </p>
          </div>
        </section>

        {/* Property Search CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Search Homes in Windsor</h2>
            <p className="text-lg mb-6 text-gray-700">
              Explore available properties in Windsor, CO
            </p>
            <Link
              to="/properties/?location=Windsor, CO"
              className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search Windsor Homes
            </Link>
          </div>
        </section>

        {/* Moving to Windsor */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Moving to Windsor, CO - Here's what it's like living in Windsor!</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Living in Windsor means enjoying a high quality of life with easy access to larger cities. The town has experienced unprecedented growth over the past 20 years, growing from a population of about 5,000 to 35,000, while maintaining its welcoming, small-town character. Residents appreciate the town's safe neighborhoods, excellent schools, and abundance of parks and recreational facilities.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Windsor's location provides the best of both worlds - the peace and community spirit of a small town, with Fort Collins and Loveland just minutes away for shopping, dining, and entertainment. The town features beautiful views of the Rocky Mountains and offers easy access to outdoor recreation.
            </p>
          </div>
        </section>

        {/* Culture and Activities */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Culture and Activities in Windsor -</h2>
          <div className="prose prose-lg max-w-none">
            <div className="mb-6">
              <img 
                src="/images/Windsor-CO-Area-Guide.jpg" 
                alt="Windsor Colorado community and Rocky Mountain views" 
                className="w-full rounded-lg shadow-lg"
                loading="lazy"
              />
            </div>
            <p className="text-lg leading-relaxed mb-4">
              Windsor is a small town with a big heart. Whether you're visiting for the first time or have lived there your entire life, you can always count on being welcomed with open arms by everyone here. The locals of Windsor celebrate their tight-knit community spirit and look out for each other like family. They pride themselves on their helpfulness to others, whether it be supporting local businesses or lending a helping hand to those in need.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Community members often gather together to share old stories, laughs, and meals at one of the many restaurants right in the town center and at Windsor Community Events like the Windsor Harvest Festival, Movies in the Park, or the Summer Concert Series at Windsor Lake. The 6,000-seat Budweiser Event Center plays host to many popular musicians and shows and also hosts the professional hockey team, the Colorado Eagles.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The people of Windsor possess an incomparable sense of hospitality that makes it stand out amongst its peers throughout Colorado. From warm welcomes while visiting the local favorite High Hops Brewery or Mash Lab, to friendly waves from neighbors, the citizens of Windsor create a warm and inviting atmosphere for visitors and residents alike. In addition to providing an unprecedented level of hospitality, Windsor also offers some of the most beautiful distant views of the Rocky Mountains.
            </p>
          </div>
        </section>

        {/* Economy */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Windsor Economy -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Windsor is a thriving community with a booming economy. Windsor has seen unprecedented growth over the past 20 years going from a population of about 5,000 to 35,000. Located in northern Colorado and situated between Fort Collins, Loveland, and Greeley, Windsor offers its residents a variety of economic opportunities and is a hub for economic growth, while having one of the lowest unemployment rates in Colorado.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              The average household income in Windsor is $111,477, while only 3.5% of the population lives in poverty. The town's strategic location provides easy access to major employment centers, and many residents commute to nearby cities for work while enjoying Windsor's quality of life and affordable housing compared to neighboring communities.
            </p>
          </div>
        </section>

        {/* Education */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Education in Windsor -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Windsor is served by the Weld County School District RE-4, which is known for its commitment to academic excellence and student success. The district offers a variety of educational programs and has consistently high ratings for its schools.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Windsor schools include Windsor High School, Windsor Middle School, and several highly-rated elementary schools. The district emphasizes STEM education, arts programs, and athletics, providing students with well-rounded educational experiences. Class sizes are manageable, and the schools benefit from strong community support and parent involvement.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              For higher education, residents have easy access to Front Range Community College, Colorado State University in Fort Collins, and the University of Northern Colorado in Greeley, all within a 20-30 minute drive.
            </p>
          </div>
        </section>

        {/* Location and Climate */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Location and Climate of Windsor -</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">
              Windsor is a small town in northern Colorado that offers many amenities to its residents. Overall, the geography of Windsor is diverse, with a mix of agricultural lands, natural areas, and urban development. The Cache la Poudre River Experience runs through the town and is surrounded by natural areas, including the Poudre River Trail and Windsor Lake. The town is known for its excellent lifestyle and quality of life, making it an ideal place to live.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              From stunning scenery to ample outdoor activities and plenty of recreational opportunities, Windsor has something for everyone. The town enjoys a semi-arid climate with four distinct seasons and over 300 days of sunshine per year. Summers are warm with average highs in the mid-80s to low 90s, while winters are relatively mild with occasional snowfall. The low humidity and abundant sunshine make outdoor activities enjoyable year-round.
            </p>
          </div>
        </section>

        {/* 10 Facts */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">10 Facts About Windsor, Colorado</h2>
          <div className="prose prose-lg max-w-none">
            <ul className="list-disc pl-6 space-y-3 text-lg">
              <li>Windsor has grown from 5,000 to 35,000 residents over the past 20 years, making it one of Colorado's fastest-growing communities.</li>
              <li>The town is home to the 6,000-seat Budweiser Events Center, which hosts concerts, shows, and the Colorado Eagles hockey team.</li>
              <li>Windsor's average household income is $111,477, significantly above the national average.</li>
              <li>The town has one of the lowest unemployment rates in Colorado, reflecting its strong economy.</li>
              <li>Windsor hosts popular community events including the Windsor Harvest Festival, Movies in the Park, and Summer Concert Series.</li>
              <li>The Cache la Poudre River runs through Windsor, offering scenic trails and outdoor recreation opportunities.</li>
              <li>Windsor Lake is a popular destination for fishing, picnicking, and community gatherings.</li>
              <li>The town is located just minutes from both Fort Collins and Loveland, providing easy access to big-city amenities.</li>
              <li>Windsor is known for its excellent schools, part of the highly-rated Weld County School District RE-4.</li>
              <li>Local breweries like High Hops Brewery and Mash Lab have become community gathering spots and contribute to Windsor's vibrant social scene.</li>
            </ul>
          </div>
        </section>

        {/* Market Report CTA */}
        <section className="mb-12 bg-gray-100 p-8 rounded-lg">
          <h2 className="text-3xl font-bold mb-4">Want the full market report for Windsor, CO?</h2>
          <p className="text-lg mb-6">
            Get detailed information about current market trends, home values, and neighborhood statistics in Windsor.
          </p>
          <div className="flex gap-4">
            <Link 
              to="/contact/" 
              className="inline-block px-8 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors"
            >
              Contact Us
            </Link>
            <a 
              href="https://www.realscout.com/search?agent_id=251929&location=Windsor,%20CO"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors"
            >
              Search Windsor Homes
            </a>
          </div>
        </section>

        {/* Area Highlights */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Windsor Area Highlights</h2>
          <p className="text-lg mb-6">A quick view of the most influential metrics in Windsor, CO.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">Population</h3>
              <p className="text-3xl font-bold text-gray-900">~35,000</p>
              <p className="text-sm text-gray-600 mt-2">Rapidly growing</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">Median Home Price</h3>
              <p className="text-3xl font-bold text-gray-900">$525K+</p>
              <p className="text-sm text-gray-600 mt-2">Strong market</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-bold text-xl mb-2">School Rating</h3>
              <p className="text-3xl font-bold text-gray-900">A</p>
              <p className="text-sm text-gray-600 mt-2">Weld RE-4 Schools</p>
            </div>
          </div>
        </section>

      </article>

      {/* Nearby Northern Colorado Communities */}
      <section className="py-8 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Nearby Northern Colorado Communities</h2>
          <p className="text-gray-700 text-center mb-6">
            Windsor straddles the Larimer-Weld county line, surrounded by communities that offer different lifestyles and price points.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/northern-colorado-areas/fort-collins/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Fort Collins →</h3>
              <p className="text-sm text-gray-600">CSU and breweries, 15 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/loveland/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Loveland →</h3>
              <p className="text-sm text-gray-600">Lake living and arts, 15 min south</p>
            </Link>
            <Link to="/northern-colorado-areas/greeley/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Greeley →</h3>
              <p className="text-sm text-gray-600">Affordable Weld County, 15 min east</p>
            </Link>
            <Link to="/northern-colorado-areas/timnath/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Timnath →</h3>
              <p className="text-sm text-gray-600">New construction hub, 8 min west</p>
            </Link>
            <Link to="/northern-colorado-areas/severance/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Severance →</h3>
              <p className="text-sm text-gray-600">Fast-growing Weld town, 5 min north</p>
            </Link>
            <Link to="/northern-colorado-areas/eaton/" className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow transition-all">
              <h3 className="font-bold text-gray-900">Eaton →</h3>
              <p className="text-sm text-gray-600">Top-rated schools, 12 min northeast</p>
            </Link>
          </div>
        </div>
      </section>

      <AreaFAQSection faqs={AREA_FAQS['windsor']} city="Windsor" />

    </>
  );
}

