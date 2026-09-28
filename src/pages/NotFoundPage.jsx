import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

// 404 page. Rendered by the React Router catch-all on the client, and by the
// prerendered /404/ static shell for crawlers hitting URLs that Express can't
// serve (see backend/src/server.js — the unknown-route branch serves this
// file with HTTP 404).
export default function NotFoundPage() {
  // Client-side signal for any prerender/scraping layer + analytics tooling
  // that this render represents a 404 (React can't set an HTTP status from
  // the browser, but the Express layer does return 404 for the initial load).
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-not-found", "true");
    }
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-not-found");
      }
    };
  }, []);

  return (
    <>
      <SEO
        exactTitle="Page Not Found (404) | SAA Homes"
        description="The page you're looking for isn't here. Explore Northern Colorado homes for sale, area guides, and resources from Schwartz and Associates."
        canonical="https://saahomes.com/404/"
        robots="noindex, follow"
      />

      <section
        className="relative pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 bg-black"
      >
        <div className="max-w-4xl mx-auto text-center text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-[#CFB36E] mb-4">
            404 — Page Not Found
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-serif mb-4">
            We couldn't find that page.
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            The link may be broken, the page may have moved, or the URL may
            have been mistyped. Try one of the destinations below, or head
            back to our homepage.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#CFB36E] text-black font-semibold rounded-lg hover:bg-[#b89a5a] transition-colors"
            >
              Back to Homepage
            </Link>
            <Link
              to="/properties/"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors"
            >
              Search Homes for Sale
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-8 text-center">
            Popular pages on SAA Homes
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Link
              to="/for-buyers/"
              className="block p-5 border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">For Buyers</h3>
              <p className="text-sm text-gray-600">
                Northern Colorado buyer guidance, CHFA down payment help, and
                MLS search tools.
              </p>
            </Link>

            <Link
              to="/for-sellers/"
              className="block p-5 border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">For Sellers</h3>
              <p className="text-sm text-gray-600">
                Free home valuation, pricing strategy, and marketing across
                Fort Collins, Loveland, Windsor, and Greeley.
              </p>
            </Link>

            <Link
              to="/northern-colorado-areas/"
              className="block p-5 border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">
                Northern Colorado Area Guides
              </h3>
              <p className="text-sm text-gray-600">
                Explore all 27+ Front Range communities we serve — market
                data, neighborhoods, and schools.
              </p>
            </Link>

            <Link
              to="/northern-colorado-areas/fort-collins/"
              className="block p-5 border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">
                Fort Collins Real Estate
              </h3>
              <p className="text-sm text-gray-600">
                Old Town, Horsetooth, and the largest Northern Colorado
                housing market.
              </p>
            </Link>

            <Link
              to="/chfa-down-payment-assistance/"
              className="block p-5 border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">
                CHFA Down Payment Assistance
              </h3>
              <p className="text-sm text-gray-600">
                Grants and deferred loans up to $25,000 for qualified Colorado
                first-time buyers.
              </p>
            </Link>

            <Link
              to="/blog/"
              className="block p-5 border border-gray-200 rounded-lg hover:border-[#CFB36E] hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">
                Northern Colorado Real Estate Blog
              </h3>
              <p className="text-sm text-gray-600">
                Market updates, buyer and seller guides, and CHFA program
                explainers.
              </p>
            </Link>
          </div>

          <div className="mt-10 text-center">
            <p className="text-gray-700">
              Need a person? Call{" "}
              <a
                href="tel:9709991407"
                className="font-semibold text-gray-900 hover:text-[#CFB36E]"
              >
                (970) 999-1407
              </a>{" "}
              or{" "}
              <Link
                to="/contact/"
                className="font-semibold text-gray-900 underline hover:text-[#CFB36E]"
              >
                send us a message
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
