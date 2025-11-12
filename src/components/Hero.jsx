import React from "react";

export default function Hero() {
  return (
    <section id="home" className="relative w-full min-h-screen flex flex-col bg-black">
      {/* Video Background */}
      <video
        className="absolute inset-0 w-full h-full object-cover z-0"
        autoPlay
        loop
        muted
        playsInline
        poster="/images/saahomescom-homepage-video-Moment.jpg"
      >
        <source src="/videos/Adam-Shwartz-Video-Compressed.mp4" type="video/mp4" />
      </video>
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/40 to-black/60" aria-hidden="true" />

      {/* Hero Content */}
      <div className="relative z-20 flex-1 flex items-center justify-center pt-40 pb-8 px-6">
        <div className="text-center text-white max-w-5xl mx-auto">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight font-serif">
            Schwartz And Associates
          </h1>
          <p className="mt-4 text-base sm:text-lg lg:text-xl font-sans font-normal">
            Team at Coldwell Banker Realty
          </p>
          <p className="mt-2 text-lg sm:text-xl lg:text-2xl font-semibold font-sans">
            Your Northern Colorado Real Estate Experts
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/contact/"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-900 font-semibold rounded hover:bg-gray-100 transition-colors"
            >
              Contact Us
            </a>
            <a
              href="/about-us/"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded hover:bg-white/10 transition-colors"
            >
              About Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
