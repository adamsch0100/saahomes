import React from "react";

export default function SocialSection() {
  return (
    <section className="w-full bg-white py-20">
      <div className="w-full px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* TikTok Section */}
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Follow Us On TikTok
            </h2>
            <a
              href="https://www.tiktok.com/@live.dwell.dmv"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-10 py-4 bg-gray-900 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-800 transform hover:scale-105 transition-all"
            >
              @live.dwell.dmv
            </a>
          </div>

          {/* Instagram Section */}
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">
              Follow Us On Instagram
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Instagram feed would go here - you can integrate with Instagram API or manually add images */}
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
            </div>
            <a
              href="https://www.instagram.com/saa_homes/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center mt-8 px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg shadow-lg hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all"
            >
              View on Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

