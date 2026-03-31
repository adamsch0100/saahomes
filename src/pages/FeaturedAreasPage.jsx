import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

export default function FeaturedAreasPage() {
  const areas = [
    { 
      name: "Fort Collins", 
      image: "/images/Fort-Collins-CO-Area-Guide.jpg", 
      url: "/northern-colorado-areas/fort-collins/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Fort%20Collins,%20CO",
      description: "A vibrant city with CSU, craft breweries, and stunning mountain views. Perfect blend of outdoor recreation and urban amenities."
    },
    { 
      name: "Loveland", 
      image: "/images/Loveland-CO-Area-Guide.jpg", 
      url: "/northern-colorado-areas/loveland/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Loveland,%20CO",
      description: "Known as the 'Sweetheart City,' Loveland offers art galleries, sculpture parks, and easy access to mountain recreation."
    },
    { 
      name: "Windsor", 
      image: "/images/Windsor-CO-Area-Guide.jpg", 
      url: "/northern-colorado-areas/windsor/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Windsor,%20CO",
      description: "A growing community with excellent schools, family-friendly atmosphere, and small-town charm close to Fort Collins."
    },
    { 
      name: "Greeley", 
      image: "/images/Area-Guide-for-Greeley-CO.jpg", 
      url: "/northern-colorado-areas/greeley/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Greeley,%20CO",
      description: "Home to the University of Northern Colorado, with a rich agricultural heritage and vibrant downtown district."
    },
    { 
      name: "Timnath", 
      image: "/images/timnath.png", 
      url: "/northern-colorado-areas/timnath/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Timnath,%20CO",
      description: "A rapidly growing town with new developments, modern amenities, and a strong sense of community."
    },
    { 
      name: "Wellington", 
      image: "/images/wellington.png", 
      url: "/northern-colorado-areas/wellington/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Wellington,%20CO",
      description: "Charming small-town atmosphere with agricultural roots, great schools, and affordable housing options."
    },
    { 
      name: "Johnstown", 
      image: "/images/Johnstown-CO-Area-Guide.jpg", 
      url: "/northern-colorado-areas/johnstown/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Johnstown,%20CO",
      description: "Fast-growing community between Greeley and Loveland, offering new construction and family amenities."
    },
    { 
      name: "Eaton", 
      image: "/images/Eaton-CO-Area-Guide.jpg", 
      url: "/northern-colorado-areas/eaton/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Eaton,%20CO",
      description: "Peaceful rural community with strong agricultural heritage and close-knit neighborhoods."
    },
    { 
      name: "Milliken", 
      image: "/images/milliken.png", 
      url: "/northern-colorado-areas/milliken/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Milliken,%20CO",
      description: "Small town with affordable housing, friendly community, and easy access to larger cities."
    },
    { 
      name: "La Salle", 
      image: "/images/la-salle.png", 
      url: "/northern-colorado-areas/la-salle/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=LaSalle,%20CO",
      description: "Historic community with small-town feel, strong schools, and affordable cost of living."
    },
    { 
      name: "Mead", 
      image: "/images/Mead.JPG", 
      url: "/northern-colorado-areas/mead/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Mead,%20CO",
      description: "Small-town charm with excellent schools, family-friendly atmosphere, and easy access to larger cities."
    },
    { 
      name: "Longmont", 
      image: "/images/Longmont.jpg", 
      url: "/northern-colorado-areas/longmont/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Longmont,%20CO",
      description: "Thriving tech hub with vibrant downtown, craft breweries, and exceptional quality of life in Boulder County."
    },
    { 
      name: "Boulder", 
      image: "/images/Boulder.jpg", 
      url: "/northern-colorado-areas/boulder/",
      realscoutLink: "https://www.realscout.com/search?agent_id=251929&location=Boulder,%20CO",
      description: "Iconic mountain city with world-class outdoor recreation, CU Boulder, and a vibrant cultural scene."
    },
  ];

  return (
    <>
      <SEO
        exactTitle="Northern Colorado Neighborhoods | Fort Collins, Loveland, Windsor Real Estate"
        description="Explore Northern Colorado neighborhoods including Fort Collins, Loveland, Windsor, Greeley, and more. Get market insights, lifestyle guides, and real estate data for every community."
        keywords="Northern Colorado neighborhoods, Fort Collins real estate, Loveland CO areas, Windsor CO homes, Greeley communities, Northern Colorado towns"
        canonical="https://saahomes.com/northern-colorado-areas/"
      />

      {/* Hero Section */}
      <section className="relative h-96 bg-cover bg-center flex items-center justify-center pt-32" 
        style={{backgroundImage: "url('/images/Northern Colorado.webp')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-5xl sm:text-6xl font-bold">Featured Areas</h1>
          <p className="mt-4 text-xl">Discover the beauty and diversity of Northern Colorado</p>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Explore Colorado With Us</h2>
          <p className="text-lg text-gray-700">
            With all of the beauty that Colorado area has to offer, it's hard to find the perfect place to call home. Our area guides simplify that process by giving you unique market, lifestyle, and demographic insights into each area!
          </p>
        </div>
      </section>

      {/* Areas Grid */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {areas.map((area, index) => (
              <div 
                key={index}
                className="bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
              >
                {/* Area Image - Clickable */}
                <Link to={area.url} className="block relative h-48 overflow-hidden">
                  <img 
                    src={area.image}
                    alt={`${area.name}, Colorado - Real Estate Guide`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <h3 className="text-white text-3xl font-bold group-hover:scale-110 transition-transform duration-300">
                      {area.name}
                    </h3>
                  </div>
                </Link>
                
                {/* Area Info */}
                <div className="p-6">
                  <Link to={area.url} className="block mb-4">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 hover:text-gray-700 transition-colors">
                      {area.name}, CO
                    </h3>
                  </Link>
                  <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                    {area.description}
                  </p>
                  
                  {/* Buttons */}
                  <div className="flex gap-3">
                    <a 
                      href={area.realscoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-black text-white text-sm font-semibold rounded hover:bg-gray-800 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Search Homes
                    </a>
                    <Link 
                      to={area.url}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border-2 border-black text-black text-sm font-semibold rounded hover:bg-black hover:text-white transition-colors"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Area Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Choose Northern Colorado?</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-5xl mb-4">🏔️</div>
              <h3 className="text-2xl font-bold mb-4">Natural Beauty</h3>
              <p className="text-gray-700">
                From the Rocky Mountains to open plains, Northern Colorado offers stunning landscapes and outdoor recreation year-round.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">💼</div>
              <h3 className="text-2xl font-bold mb-4">Strong Economy</h3>
              <p className="text-gray-700">
                Thriving job market with opportunities in tech, healthcare, education, and agriculture. Home to major employers and startups alike.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">🏫</div>
              <h3 className="text-2xl font-bold mb-4">Great Schools</h3>
              <p className="text-gray-700">
                Top-rated school districts and higher education institutions including Colorado State University.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">🎭</div>
              <h3 className="text-2xl font-bold mb-4">Arts & Culture</h3>
              <p className="text-gray-700">
                Vibrant arts scene, craft breweries, local restaurants, and community events throughout the year.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">🚴</div>
              <h3 className="text-2xl font-bold mb-4">Active Lifestyle</h3>
              <p className="text-gray-700">
                Miles of trails for hiking, biking, and running. Easy access to skiing, rafting, and camping.
              </p>
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">👨‍👩‍👧‍👦</div>
              <h3 className="text-2xl font-bold mb-4">Family Friendly</h3>
              <p className="text-gray-700">
                Safe communities with parks, recreational facilities, and family-oriented activities and events.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Explore These Areas?</h2>
          <p className="text-xl mb-8">
            Let's schedule a tour and show you around your potential new neighborhood.
          </p>
          <a href="/contact/" className="inline-block px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-100 transition-colors">
            Contact Us Today
          </a>
        </div>
      </section>
    </>
  );
}

