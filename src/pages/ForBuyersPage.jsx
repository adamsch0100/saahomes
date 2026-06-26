import React from "react";
import SEO from "../components/SEO";

export default function ForBuyersPage() {
  return (
    <>
      <SEO
        exactTitle="Homes for Sale in Fort Collins, Loveland &amp; Windsor | Colorado Home Buyers | SAA Homes"
        description="Search homes for sale in Fort Collins, Loveland, Windsor, and across Northern Colorado. SAA Homes offers expert buyer representation, down payment program guidance including CHFA Schools To Home, and personalized home search services."
        keywords="homes for sale Fort Collins, Colorado home buyers, Loveland homes for sale, Windsor CO real estate, buy home Northern Colorado, first time home buyer Colorado, buyer agent Fort Collins, CHFA down payment assistance"
        canonical="https://saahomes.com/for-buyers/"
      />

      {/* Hero Section */}
      <section className="relative min-h-[420px] sm:h-[600px] bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-12" 
        style={{backgroundImage: "url('/images/buyers-hero.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-serif">For Buyers</h1>
          <p className="mt-4 text-xl sm:text-2xl font-sans">Your Guide to Finding the Perfect Home in Northern Colorado</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/properties/" className="inline-flex items-center justify-center px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Search Homes
            </a>
            <a href="/contact/" className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors">
              Get Free Buyer Consultation
            </a>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="pl-4 md:pl-8">
              <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-6">Why Choose Us?</h2>
              <p className="text-lg text-gray-700 mb-4">
                We're dedicated to making your home buying experience as smooth and successful as possible. From your first search to closing day, we're with you every step of the way.
              </p>
              <p className="text-lg text-gray-700 mb-4">
                Our team brings years of experience and local market knowledge to help you find the perfect home in Northern Colorado. We understand the unique characteristics of each neighborhood and can guide you to properties that match your lifestyle and budget.
              </p>
              <p className="text-lg text-gray-700">
                With our extensive network and proven track record, we'll help you navigate the buying process with confidence and ease.
              </p>
            </div>
            <div className="flex justify-center">
              <img 
                src="/images/Buyers-CTA-1.jpg" 
                alt="Adam and Mandi Schwartz - Real Estate Agents"
                className="rounded-lg shadow-xl w-full max-w-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Buyer Resources Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-4">Buyer Resources</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Everything you need to make informed decisions throughout your home buying journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-black/5">
              <h3 className="text-2xl font-bold mb-4 font-serif">CHFA Down Payment Assistance</h3>
              <p className="text-gray-700 mb-4">
                Colorado&apos;s primary first-time homebuyer program — grants and deferred loans up to $25,000 for down payment and closing costs through CHFA participating lenders.
              </p>
              <a href="/chfa-down-payment-assistance/" className="text-black font-semibold hover:underline">Learn More →</a>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-4 font-serif">Champions Home Loan</h3>
              <p className="text-gray-700 mb-4">
                Colorado&apos;s new CHFA program for first responders — expanded income eligibility and down payment assistance. Expected late 2026.
              </p>
              <a href="/colorado-champions-home-loan-program/" className="text-black font-semibold hover:underline">Learn More →</a>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-4 font-serif">CHFA Schools To Home</h3>
              <p className="text-gray-700 mb-4">
                Full-time Colorado public school employees may qualify for up to 25% down payment assistance through CHFA's new Schools To Home program.
              </p>
              <a href="/chfa-schools-to-home/" className="text-black font-semibold hover:underline">Learn More →</a>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-4 font-serif">First-Time Homebuyers</h3>
              <p className="text-gray-700 mb-4">
                New to the home buying process? We'll guide you through every step, from understanding mortgages to closing on your first home.
              </p>
              <a href="/contact/" className="text-black font-semibold hover:underline">Learn More →</a>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-4 font-serif">Relocation Guide</h3>
              <p className="text-gray-700 mb-4">
                Moving to Northern Colorado? Get insider knowledge about neighborhoods, schools, and local amenities to find your perfect community.
              </p>
              <a href="/contact/" className="text-black font-semibold hover:underline">Learn More →</a>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-4 font-serif">Mortgage Calculator</h3>
              <p className="text-gray-700 mb-4">
                Calculate your monthly payments and understand how much home you can afford with our easy-to-use mortgage calculator.
              </p>
              <a href="/mortgage-calculator/" className="text-black font-semibold hover:underline">Calculate →</a>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-4 font-serif">Neighborhood Guides</h3>
              <p className="text-gray-700 mb-4">
                Explore detailed guides for Fort Collins, Loveland, Windsor, Greeley, and other Northern Colorado communities.
              </p>
              <a href="/northern-colorado-areas/" className="text-black font-semibold hover:underline">Explore →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Buyer Services Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-4">Our Buyer Services</h2>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              We're dedicated to making your home buying experience as smooth and successful as possible. From your first search to closing day, we're with you every step of the way.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🏠</div>
              <h3 className="text-2xl font-bold mb-4">Personalized Home Search</h3>
              <p className="text-gray-700">
                We'll work with you to understand exactly what you're looking for and provide you with listings that match your criteria, budget, and lifestyle.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold mb-4">Exclusive Property Access</h3>
              <p className="text-gray-700">
                Get early access to new listings before they hit the market, giving you an advantage in competitive neighborhoods.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">💼</div>
              <h3 className="text-2xl font-bold mb-4">Expert Negotiation</h3>
              <p className="text-gray-700">
                Our experienced team will negotiate on your behalf to ensure you get the best possible deal on your new home.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-2xl font-bold mb-4">Market Analysis</h3>
              <p className="text-gray-700">
                We provide detailed market insights to help you make informed decisions about timing, pricing, and location.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-2xl font-bold mb-4">Professional Network</h3>
              <p className="text-gray-700">
                Access to our trusted network of lenders, inspectors, contractors, and other professionals to support your purchase.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-2xl font-bold mb-4">Smooth Closing</h3>
              <p className="text-gray-700">
                We handle all the details and paperwork to ensure your closing goes smoothly and on time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Get Pre-Approved CTA Section with Kitchen Image */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Kitchen Image */}
            <div className="order-2 md:order-1">
              <img 
                src="/images/Buyers-img-2.jpg" 
                alt="Modern Kitchen"
                className="w-full h-auto rounded-lg shadow-xl"
              />
            </div>
            
            {/* Get Pre-Approved Content */}
            <div className="order-1 md:order-2" style={{backgroundColor: '#CFB36E'}}>
              <div className="p-8 md:p-12 text-center md:text-left">
                <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-4 text-gray-900">Get Pre-Approved</h2>
                <p className="text-lg text-gray-800 mb-4">
                  Getting pre-approved for a mortgage is one of the first steps in your home buying journey. It shows sellers you're serious and helps you understand your budget. Connect with our trusted lending partners today.
                </p>
                <p className="text-gray-800 mb-6">
                  Questions? Call us at <a href="tel:(970) 999-1407" className="font-bold hover:underline">(970) 999-1407</a>
                </p>
                <a href="/contact/" className="inline-block px-8 py-3 bg-gray-900 text-white font-semibold rounded hover:bg-gray-800 transition-colors">
                  Apply Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center -mt-8 mb-[20px]">
          <h2 className="text-4xl sm:text-5xl font-bold font-serif mb-4">Ready to Find Your Dream Home?</h2>
          <p className="text-xl mb-8">
            Let's start your home buying journey together. Contact us today for a free consultation.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="/contact/" className="inline-block px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-100 transition-colors">
              Contact Us
            </a>
            <a href="/properties/" className="inline-block px-8 py-3 border-2 border-white text-white font-semibold rounded hover:bg-white hover:text-black transition-colors">
              View Properties
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

