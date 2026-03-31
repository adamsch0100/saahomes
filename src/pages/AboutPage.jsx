import React from "react";
import SEO from "../components/SEO";

export default function AboutPage() {
  return (
    <>
      <SEO
        exactTitle="About SAA Homes | Fort Collins Real Estate Experts | 20+ Years Experience"
        description="Meet Adam and Mandi Schwartz of SAA Homes — Fort Collins real estate experts with 20+ years of combined experience. Trusted Coldwell Banker agents serving all of Northern Colorado."
        keywords="about SAA Homes, Adam Schwartz realtor, Mandi Schwartz, Fort Collins real estate experts, experienced realtors Fort Collins, Coldwell Banker agents, 20 years experience"
        canonical="https://saahomes.com/about-us/"
      />
      
      {/* Hero Section */}
      <section className="relative h-96 bg-cover bg-center flex items-center justify-center pt-32" 
        style={{backgroundImage: "url('/images/About-Hero.jpg')"}}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-5xl sm:text-6xl font-bold">About Us</h1>
          <p className="mt-4 text-xl">Your Colorado Real Estate Experts.</p>
        </div>
      </section>

      {/* Passion, Service, Excellence Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <img 
              src="/images/About-Img-1-1-1.jpg" 
              alt="Adam and Mandi Schwartz"
              className="rounded-lg shadow-xl w-full"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Get To Know Us</p>
            <h2 className="text-4xl font-bold mb-6">Passion, Service, Excellence</h2>
            <p className="text-lg text-gray-700 mb-6">
              Adam and Mandi are committed to being the team that comes to mind when you or any of your friends, family, neighbors, or colleagues require real estate services, and work hard every day to earn the right to be your first choice. With both firmly on your side advocating for you, you consistently get access to twice the resources and twice the attention, and the results are twice as good.
            </p>
            <div className="flex gap-4">
              <a href="/for-buyers/" className="inline-block px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
                Buy with us
              </a>
              <a href="/for-sellers/" className="inline-block px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors">
                Sell with us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Best Services Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Premium Service</p>
            <h2 className="text-4xl font-bold mb-6">Best Services From The Best Agents In Colorado</h2>
            <p className="text-lg text-gray-700 mb-6">
              With their 20 years of combined industry experience, the Schwartzs have mastered the dos and don'ts of real estate. Adam, a digital marketing specialist with sharp business acumen and an entrepreneurial mind, has helped develop effective marketing strategies supported by Mandi's help on the back end, keeping in touch with all their clients. Together, they thrive by putting their clients' interests above their own, providing extra value, and going the extra mile in making sure you have a complete understanding of each step of the buying and selling process.
            </p>
            <div className="flex gap-4">
              <a href="/properties/" className="inline-block px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
                Perfect Home Finder
              </a>
              <a href="/home-valuation/" className="inline-block px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors">
                Free Home Valuation
              </a>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <img 
              src="/images/About-new-image-1-1.jpg" 
              alt="Premium Service"
              className="rounded-lg shadow-xl w-full"
            />
          </div>
        </div>
      </section>

      {/* Explore Colorado Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Areas of Service</p>
          <h2 className="text-4xl font-bold mb-4">Explore Colorado With Us</h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto">
            With all of the beauty that Colorado area has to offer, it's hard to find the perfect place to call home. Our area guides simplify that process by giving you unique market, lifestyle, and demographic insights into each area!
          </p>
          <a href="/featured-areas/" className="inline-block px-8 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
            Explore The Area
          </a>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-6 bg-cover bg-center" 
        style={{backgroundImage: "url('/images/About-Hero.jpg')"}}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to take the next step</h2>
          <p className="text-xl mb-8">We're here and ready to answer all your real estate questions!</p>
          <a href="/contact/" className="inline-block px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-100 transition-colors">
            Get Started
          </a>
        </div>
      </section>
    </>
  );
}

