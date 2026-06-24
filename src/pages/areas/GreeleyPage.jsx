import React from "react";
import AreaSEO from "../../components/AreaSEO.jsx";
import { Link } from "react-router-dom";
import MarketReportForm from "../../components/MarketReportForm.jsx";

export default function GreeleyPage() {
  return (
    <>
      <AreaSEO slug="greeley" />

      {/* Hero Section */}
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8" 
        style={{backgroundImage: "url('/images/Area-Guide-for-Greeley-CO.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Greeley, Colorado</h1>
          <p className="mt-4 text-xl">Home to the University of Northern Colorado</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6 text-center">Your Greeley Area Guide</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Greeley, Colorado is a vibrant city with a rich agricultural heritage and a thriving cultural scene. Home to the University of Northern Colorado, Greeley offers a unique blend of small-town charm and big-city amenities. With its affordable housing, excellent schools, and strong sense of community, Greeley is an ideal place to call home for families, young professionals, and retirees alike.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Located in Weld County, Greeley provides easy access to the Rocky Mountains, Denver, and Fort Collins, making it a perfect base for exploring Northern Colorado. The city's downtown district features art galleries, local restaurants, and historic architecture, while its parks and recreation areas offer endless opportunities for outdoor activities.
          </p>
        </div>
      </section>

      {/* Property Search CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Search Homes in Greeley</h2>
          <p className="text-lg mb-6 text-gray-700">
            Explore available properties in Greeley, CO
          </p>
          <Link
            to="/properties/?location=Greeley, CO"
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search Greeley Homes
          </Link>
        </div>
      </section>

      {/* Economy Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <img 
                src="/images/Area-Guide-for-Greeley-CO.jpg"
              alt="Greeley Colorado downtown and University of Northern Colorado" 
              className="w-full rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Economy & Employment</h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Greeley's economy is diverse and robust, with strong sectors in agriculture, education, healthcare, and energy. The city is known as the "Heart of Weld County" and plays a significant role in Colorado's agricultural industry.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Major employers include the University of Northern Colorado, North Colorado Medical Center, JBS USA, and State Farm Insurance. The city's strategic location and business-friendly environment continue to attract new companies and create job opportunities.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Greeley's median household income and cost of living make it an attractive option for those seeking affordability without sacrificing quality of life.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">Key Industries</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Agriculture & Food Processing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Higher Education (UNC)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Healthcare & Medical Services</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Energy & Natural Resources</span>
                </li>
                <li className="flex items-start">
                  <span className="text-black mr-2">•</span>
                  <span>Insurance & Financial Services</span>
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
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Arts & Entertainment</h3>
              <p className="text-gray-700">
                Greeley's cultural scene includes the Union Colony Civic Center, Greeley Philharmonic Orchestra, and numerous art galleries. The city hosts annual events like the Greeley Stampede, one of the world's largest rodeos.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Outdoor Recreation</h3>
              <p className="text-gray-700">
                With over 30 parks, miles of trails, and the Poudre River Trail, Greeley offers abundant outdoor activities. Nearby reservoirs provide opportunities for fishing, boating, and water sports.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Dining & Shopping</h3>
              <p className="text-gray-700">
                Downtown Greeley features local restaurants, breweries, and unique shops. The city's diverse culinary scene reflects its multicultural community and agricultural roots.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Education in Greeley</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Greeley is served by Weld County School District 6, which operates numerous elementary, middle, and high schools throughout the city. The district is known for its commitment to academic excellence and innovative programs.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            The University of Northern Colorado (UNC) is a major educational institution in Greeley, offering undergraduate and graduate programs in education, business, arts, sciences, and more. UNC's presence brings cultural events, athletic competitions, and educational opportunities to the community.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Aims Community College also has a campus in Greeley, providing accessible higher education and workforce training programs.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Location & Accessibility</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Greeley is strategically located in Northern Colorado, approximately 50 miles north of Denver and 25 miles east of Fort Collins. The city's location provides easy access to major highways, including US-34 and US-85, making commuting and travel convenient.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Denver International Airport is about an hour's drive away, offering domestic and international flight connections. The city's proximity to the Rocky Mountains makes weekend getaways and outdoor adventures easily accessible.
          </p>
        </div>
      </section>

      {/* 10 Facts Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">10 Things to Know About Greeley</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">1. The Greeley Stampede</h3>
              <p className="text-gray-700">Home to one of the world's largest rodeos, attracting thousands of visitors each summer.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">2. University Town</h3>
              <p className="text-gray-700">UNC brings a vibrant college atmosphere with 12,000+ students and numerous cultural events.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">3. Agricultural Heritage</h3>
              <p className="text-gray-700">Known as an agricultural hub with deep roots in farming and ranching traditions.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">4. Affordable Living</h3>
              <p className="text-gray-700">Offers more affordable housing options compared to nearby Denver and Boulder.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">5. Historic Downtown</h3>
              <p className="text-gray-700">Features beautifully preserved historic buildings, local shops, and restaurants.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">6. Family-Friendly</h3>
              <p className="text-gray-700">Excellent schools, safe neighborhoods, and numerous family-oriented activities and events.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">7. Outdoor Access</h3>
              <p className="text-gray-700">Over 30 parks, miles of trails, and nearby reservoirs for year-round recreation.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">8. Growing Economy</h3>
              <p className="text-gray-700">Diverse job market with opportunities in agriculture, education, healthcare, and energy.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">9. Cultural Scene</h3>
              <p className="text-gray-700">Home to theaters, museums, art galleries, and the Greeley Philharmonic Orchestra.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold mb-2">10. Community Spirit</h3>
              <p className="text-gray-700">Strong sense of community with active neighborhood associations and local events.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Report CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center">Want the full market report for Greeley, CO?</h2>
          <p className="text-lg mb-6 text-center text-gray-700">
            We want to ensure that you have all the information needed to make the best decisions when it comes to your home goals. When you enter your info below you will get instant access to the area's latest market report, complete with sales and demographic trends.
          </p>
          <MarketReportForm areaName="Greeley, CO" />
        </div>
      </section>

      {/* Area Highlights */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Greeley Highlights</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Popular Neighborhoods</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• West Greeley - Family-friendly with newer developments</li>
                <li>• Downtown Greeley - Historic charm and urban living</li>
                <li>• Bella Romero - Established community with mature trees</li>
                <li>• Centennial - Mix of residential and commercial areas</li>
                <li>• Garden City - Affordable homes and convenient location</li>
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-4">Local Attractions</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Greeley Stampede - Annual rodeo and western celebration</li>
                <li>• Union Colony Civic Center - Performing arts venue</li>
                <li>• Greeley History Museum - Local history exhibits</li>
                <li>• Island Grove Regional Park - Events and recreation</li>
                <li>• Poudre River Trail - Hiking and biking trails</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

