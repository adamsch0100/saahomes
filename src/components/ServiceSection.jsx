import React from "react";

export default function ServiceSection() {
  return (
    <section className="w-full bg-gray-50 py-20">
      <div className="w-full px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest">Premium Service</p>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 text-center mb-6">
            Who You Work With Matters!
          </h2>
          
          <p className="text-lg text-gray-700 text-center max-w-4xl mx-auto mb-12 leading-relaxed">
            With their 20 years of combined industry experience, the Schwartzs have mastered the dos and don'ts of real estate. Adam, a digital marketing specialist with sharp business acumen and an entrepreneurial mind, has helped develop effective marketing strategies supported by Mandi's help on the back end, keeping in touch with all their clients. Together, they thrive by putting their clients' interests above their own, providing extra value, and going the extra mile in making sure you have a complete understanding of each step of the buying and selling process.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {/* For Buyers */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
              <div
                className="absolute inset-0 bg-center bg-cover transition-transform duration-500 group-hover:scale-110"
                style={{
                  backgroundImage: "url('/images/Shwartz-CTA-Buyers.jpg')",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="relative p-10 flex flex-col justify-end min-h-[400px]">
                <h3 className="text-3xl font-bold text-white mb-4">FOR BUYERS</h3>
                <p className="text-white/90 text-lg mb-6">
                  Purchasing a home is an investment. We put in the effort to ensure our clients feel at ease with their decisions.
                </p>
                <a
                  href="/for-buyers/"
                  className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg shadow-lg hover:bg-gray-100 transform hover:scale-105 transition-all w-fit"
                >
                  Learn More
                </a>
              </div>
            </div>

            {/* For Sellers */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
              <div
                className="absolute inset-0 bg-center bg-cover transition-transform duration-500 group-hover:scale-110"
                style={{
                  backgroundImage: "url('/images/Shwartz-CTA-Sellers.jpg')",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="relative p-10 flex flex-col justify-end min-h-[400px]">
                <h3 className="text-3xl font-bold text-white mb-4">FOR SELLERS</h3>
                <p className="text-white/90 text-lg mb-6">
                  Everyone has goals for the sale of their home. We know how to market your property and advise clients to achieve a result that makes them feel valued.
                </p>
                <a
                  href="/for-sellers/"
                  className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg shadow-lg hover:bg-gray-100 transform hover:scale-105 transition-all w-fit"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

