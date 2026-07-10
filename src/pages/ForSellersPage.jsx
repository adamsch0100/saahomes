import React, { useEffect } from "react";
import SEO from "../components/SEO";
import LatestMarketUpdateBanner from "../components/LatestMarketUpdateBanner.jsx";
import AreaFAQSection from "../components/AreaFAQSection.jsx";
import Testimonials from "../components/Testimonials.jsx";
import { SELLER_FAQS } from "../data/buyerSellerFaqs.js";

export default function ForSellersPage() {
  useEffect(() => {
    // Check if there's a hash in the URL and scroll to that section
    if (window.location.hash === '#home-valuation') {
      setTimeout(() => {
        const element = document.getElementById('home-valuation');
        if (element) {
          const headerHeight = 120; // Approximate header height
          const elementPosition = element.offsetTop;
          const offsetPosition = elementPosition - headerHeight - 50; // Extra 50px for spacing
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }, 100);
    }
  }, []);

  return (
    <>
      <SEO
        exactTitle="Sell Your Home in Northern Colorado | Free Market Analysis | SAA Homes"
        description="Sell your home in Northern Colorado with SAA Homes. Get a free market analysis, professional marketing, and expert negotiation to maximize your sale price in Fort Collins, Loveland, Windsor, and beyond."
        keywords="sell home Fort Collins, free market analysis Northern Colorado, home value Colorado, listing agent Fort Collins, sell house Loveland, SAA Homes seller services"
        canonical="https://saahomes.com/for-sellers/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: SELLER_FAQS.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.a,
              },
            })),
          },
        ]}
      />

      {/* Hero Section */}
      <section className="relative min-h-[420px] sm:h-[600px] bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-12" 
        style={{backgroundImage: "url('/images/sell-hero-1.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6 max-w-4xl mx-auto">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-serif mb-6">Why Sell With Us?</h1>
          <p className="text-lg sm:text-xl font-sans max-w-3xl mx-auto">
            Get proven results and streamlined service from start to finish. Scroll down to learn more about how we can get you results with our record-setting sales strategies.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/home-valuation/" className="inline-flex items-center justify-center px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Get Your Home Value
            </a>
            <a href="/contact/" className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors">
              Get a Customized Selling Plan
            </a>
          </div>
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              className="w-12 h-12 flex items-center justify-center"
              style={{backgroundColor: '#CFB36E'}}
              aria-label="Scroll down"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Trust Badges Section */}
      <section className="py-8 px-6 border-b border-gray-100" style={{backgroundColor: '#fafafa'}}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900 font-serif">20+</p>
            <p className="text-xs text-gray-600 mt-1 uppercase tracking-wide font-semibold">Years Experience</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 font-serif">Zillow</p>
            <p className="text-xs text-gray-600 mt-1 uppercase tracking-wide font-semibold">Premier Agent</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 font-serif">5-Star</p>
            <p className="text-xs text-gray-600 mt-1 uppercase tracking-wide font-semibold">Client Reviews</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 font-serif">🏡</p>
            <p className="text-xs text-gray-600 mt-1 uppercase tracking-wide font-semibold">Full-Service Marketing</p>
          </div>
        </div>
      </section>

      {/* For Sellers / Sell With The Best Team Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <img 
              src="/images/sell-intro-image.jpg" 
              alt="Northern Colorado Real Estate"
              className="rounded-lg shadow-xl w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">For Sellers</p>
            <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-6">Sell With The Best Team</h2>
            <p className="text-lg text-gray-700 mb-4">
              Selling your home is one of the most important financial decisions you'll make. That's why you need a team with proven results, cutting-edge marketing strategies, and a track record of getting top dollar for our clients.
            </p>
            <p className="text-lg text-gray-700 mb-6">
              We combine data-driven pricing strategies with aggressive marketing campaigns to create maximum demand for your property. Our goal is to generate multiple offers and create a competitive bidding environment that works in your favor.
            </p>
            <div className="flex gap-4 flex-wrap">
              <a href="/home-valuation/" className="inline-block px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
                Get Your Home Value
              </a>
              <a href="/contact/" className="inline-block px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors">
                Contact Us
              </a>
            </div>
            <p className="mt-4 text-gray-600">
              Or call <a href="tel:(970) 999-1407" className="text-black font-semibold hover:underline">(970) 999-1407</a> for an instant home valuation estimate
            </p>
          </div>
        </div>
      </section>

      <LatestMarketUpdateBanner />

      {/* Seller Services Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-4">Our Seller Services</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Selling your home is a significant decision. We leverage cutting-edge marketing, strategic pricing, and expert negotiation to ensure you get the best possible outcome.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-bold mb-4">Accurate Home Valuation</h3>
              <p className="text-gray-700">
                Get a comprehensive market analysis to price your home competitively and maximize your return.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">📸</div>
              <h3 className="text-2xl font-bold mb-4">Professional Marketing</h3>
              <p className="text-gray-700">
                High-quality photography, virtual tours, social media campaigns, and targeted advertising to showcase your home.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold mb-4">Strategic Pricing</h3>
              <p className="text-gray-700">
                Data-driven pricing strategies to attract qualified buyers and generate competitive offers.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🏡</div>
              <h3 className="text-2xl font-bold mb-4">Home Staging Advice</h3>
              <p className="text-gray-700">
                Expert guidance on preparing your home to make the best first impression and appeal to buyers.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">📢</div>
              <h3 className="text-2xl font-bold mb-4">Maximum Exposure</h3>
              <p className="text-gray-700">
                Your listing on all major real estate platforms, plus our extensive network of buyers and agents.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-2xl font-bold mb-4">Skilled Negotiation</h3>
              <p className="text-gray-700">
                We handle all negotiations to secure the best price and terms for your sale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Area Guides */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-4">Northern Colorado Area Guides</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Explore market insights and neighborhood guides for your selling area.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <a href="/northern-colorado-areas/fort-collins/" className="block bg-gray-50 p-6 rounded-lg hover:shadow-lg transition-shadow border border-gray-100">
              <h3 className="text-xl font-bold mb-2">Fort Collins</h3>
              <p className="text-gray-600 text-sm">CSU, breweries, and mountain views</p>
            </a>
            <a href="/northern-colorado-areas/loveland/" className="block bg-gray-50 p-6 rounded-lg hover:shadow-lg transition-shadow border border-gray-100">
              <h3 className="text-xl font-bold mb-2">Loveland</h3>
              <p className="text-gray-600 text-sm">Arts, lakes, and I-25 corridor</p>
            </a>
            <a href="/northern-colorado-areas/windsor/" className="block bg-gray-50 p-6 rounded-lg hover:shadow-lg transition-shadow border border-gray-100">
              <h3 className="text-xl font-bold mb-2">Windsor</h3>
              <p className="text-gray-600 text-sm">Family communities, top schools</p>
            </a>
            <a href="/northern-colorado-areas/greeley/" className="block bg-gray-50 p-6 rounded-lg hover:shadow-lg transition-shadow border border-gray-100">
              <h3 className="text-xl font-bold mb-2">Greeley</h3>
              <p className="text-gray-600 text-sm">Weld County value and growth</p>
            </a>
          </div>
          <div className="text-center mt-8">
            <a href="/northern-colorado-areas/" className="text-black font-semibold hover:underline">View All 19 Northern Colorado Communities →</a>
          </div>
        </div>
      </section>

      {/* Home Valuation Widget Section */}
      <section id="home-valuation" className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4">In Depth Market Analysis for Your Home</h2>
            <p className="text-lg text-gray-700">
              Get a free, instant estimate of your home's value
            </p>
          </div>
          <realscout-home-value agent-encoded-id="QWdlbnQtMjUxOTI5" include-name include-phone remove-title remove-subtitle></realscout-home-value>
        </div>
      </section>

      {/* Selling Process Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Our Selling Process</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">1</div>
              <h3 className="text-xl font-bold mb-2">Initial Consultation</h3>
              <p className="text-gray-700">We discuss your goals, timeline, and get to know your property.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">2</div>
              <h3 className="text-xl font-bold mb-2">Market Analysis</h3>
              <p className="text-gray-700">Comprehensive analysis to determine the optimal listing price.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">3</div>
              <h3 className="text-xl font-bold mb-2">Marketing Launch</h3>
              <p className="text-gray-700">Professional photos, listings go live, and marketing campaign begins.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">4</div>
              <h3 className="text-xl font-bold mb-2">Close the Deal</h3>
              <p className="text-gray-700">Negotiate offers, manage inspections, and close on your terms.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Expert Advice Section with Family Image */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Experience Leads To</p>
            <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-6">Expert Advice</h2>
            <p className="text-lg text-gray-700 mb-6">
              We will aggressively market your house to create the highest demand with the aim of creating a bidding war on your home. We will list your house on Zillow, MLS, Realtor.com and all the major home sites. At our own expense, we will have high class, professional photos taken of your home and entire property. We also can do video's and Matterport 3D tour of your home. We will also market your home aggressively on all major social media platforms, to make sure you can get the most money for your home. We are proud to be rated a Zillow 'Premier Agent', so you know we will take care of you from start to finish.
            </p>
            <div className="flex gap-4">
              <a href="#home-valuation" className="inline-block px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
                Value Your Home
              </a>
              <a href="/contact/" className="inline-block px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors">
                Get Started
              </a>
            </div>
          </div>
          <div>
            <img 
              src="/images/sell-cta-1-1-1.jpg" 
              alt="Schwartz and Associates Team"
              className="rounded-lg shadow-xl w-full"
            />
          </div>
        </div>
      </section>

      <AreaFAQSection faqs={SELLER_FAQS} city="Northern Colorado" />

      <Testimonials />

      {/* CTA Section */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Sell Your Home?</h2>
          <p className="text-xl mb-8">
            Let's discuss your selling goals and create a customized marketing plan for your property.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/contact/" className="inline-block px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-100 transition-colors">
              Get Started
            </a>
            <a href="/home-valuation/" className="inline-block px-8 py-3 border-2 border-white text-white font-semibold rounded hover:bg-white hover:text-black transition-colors">
              Free Home Valuation
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

