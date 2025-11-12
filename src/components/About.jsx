import React from "react";

export default function About() {
  return (
    <section id="about" className="w-full bg-gray-50">
      <div className="w-full px-6 md:px-12 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200">
            <img
              src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2069&auto=format&fit=crop"
              alt="Northern Colorado home exterior"
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Local expertise. Trusted guidance.</h2>
            <p className="mt-4 text-gray-700">
              As Schwartz and Associates at Coldwell Banker Realty, we help buyers and sellers succeed across Northern Colorado. From Fort Collins and Loveland to Windsor, Timnath, and Greeley, our approach is data-driven, neighborhood-savvy, and client-first.
            </p>
            <ul className="mt-6 space-y-3 text-gray-700">
              <li className="flex gap-3">
                <span className="h-2 w-2 mt-2 rounded-full bg-blue-600"></span>
                Expert guidance on pricing, timing, and strategy for today&apos;s market
              </li>
              <li className="flex gap-3">
                <span className="h-2 w-2 mt-2 rounded-full bg-blue-600"></span>
                New construction, resale, luxury, multi-family, and land
              </li>
              <li className="flex gap-3">
                <span className="h-2 w-2 mt-2 rounded-full bg-blue-600"></span>
                Seamless experience from search to close with clear communication
              </li>
              <li className="flex gap-3">
                <span className="h-2 w-2 mt-2 rounded-full bg-blue-600"></span>
                Strong network of local lenders, inspectors, and contractors
              </li>
            </ul>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href="#contact"
                className="px-6 py-3 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 hover:shadow-lg transform hover:scale-105 transition-all"
              >
                Schedule a Consultation
              </a>
              <a
                href="#explore"
                className="px-6 py-3 bg-white border border-gray-300 text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              >
                Explore Properties
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}