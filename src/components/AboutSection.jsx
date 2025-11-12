import React from "react";

export default function AboutSection() {
  return (
    <section id="about" className="w-full bg-gray-50 py-20">
      <div className="w-full px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest">About Us</p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="/images/About-new-image-1-1.jpg"
                alt="Adam and Mandi Schwartz"
                className="w-full h-full object-cover"
              />
              <div 
                className="absolute -bottom-10 -right-10 w-40 h-40 opacity-20"
                style={{
                  backgroundImage: "url('/images/Gold-Pseudo-1.png')",
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat'
                }}
              />
            </div>

            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                Adam, Mandi, And Our "Why"
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                As the team leaders of Schwartz and Associates, Adam and Mandi are passionate about helping their clients find their dream homes. Drawn together by their aligned family values as husband and wife, they understand that a home is more than just a place to live; it is where memories are made, and they approach the process with great due diligence. The couple specializes in offering white-glove service that is rooted in honesty, strong work ethics, and genuine care for all their clients.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/about-us/"
                  className="inline-flex items-center justify-center px-8 py-3 bg-gray-900 text-white font-semibold rounded-md shadow-lg hover:bg-gray-800 transform hover:scale-105 transition-all"
                >
                  Who We Are
                </a>
                <a
                  href="#testimonials"
                  className="inline-flex items-center justify-center px-8 py-3 bg-white border-2 border-gray-900 text-gray-900 font-semibold rounded-md hover:bg-gray-50 transition-colors"
                >
                  Testimonials
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

