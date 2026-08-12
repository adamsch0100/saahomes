import React from "react";
import { Link } from "react-router-dom";
import {
  CITY_MARKET_CONTEXT,
  LUXURY_THRESHOLDS,
  getLuxuryNeighborhoods,
  luxurySearchHref,
} from "../data/luxuryMarket.js";

const GOLD = "#CFB36E";

/**
 * City-modified luxury H2/H3 block for area pages.
 * Data-only: thresholds and neighborhood price hints from luxuryMarket.js
 * (sourced from areaSeo / areaFaqs / blogPosts / neighborhoods.js).
 */
export default function CityLuxurySection({ citySlug, deep = false }) {
  const ctx = CITY_MARKET_CONTEXT[citySlug];
  const threshold = LUXURY_THRESHOLDS[citySlug];
  const neighborhoods = getLuxuryNeighborhoods(citySlug);

  if (!ctx || !threshold) return null;

  const searchHref = luxurySearchHref(ctx.city, threshold.threshold);
  const showCount = deep ? neighborhoods.length : Math.min(neighborhoods.length, 6);
  const displayNeighborhoods = neighborhoods.slice(0, showCount);

  return (
    <section
      id="luxury-homes"
      className="mb-12 scroll-mt-28 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm"
      aria-labelledby={`${citySlug}-luxury-heading`}
    >
      <div className="px-6 sm:px-8 py-8 sm:py-10">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] mb-2"
          style={{ color: GOLD }}
        >
          Luxury Real Estate
        </p>
        <h2
          id={`${citySlug}-luxury-heading`}
          className="text-3xl sm:text-4xl font-bold font-serif text-gray-900 mb-4"
        >
          Luxury Homes in {ctx.city}
        </h2>
        <p className="text-lg text-gray-700 leading-relaxed mb-4 max-w-3xl">
          {ctx.shortDesc}
        </p>
        {threshold.millionPlusReality ? (
          <p className="text-base text-gray-700 leading-relaxed mb-4 max-w-3xl">
            <strong className="text-gray-900">$1M+ reality:</strong>{" "}
            {threshold.millionPlusReality}
          </p>
        ) : null}
        <p className="text-base text-gray-600 leading-relaxed mb-6 max-w-3xl">
          <strong className="text-gray-900">Price reality:</strong>{" "}
          {threshold.note}{" "}
          Citywide market context: median / typical range{" "}
          <strong className="text-gray-900">{ctx.medianDisplay}</strong>
          {ctx.premiumDom ? (
            <>
              . Premium segment timing: {ctx.premiumDom}
            </>
          ) : null}
          . We never invent luxury medians — live asking prices come from IRES MLS.
        </p>

        {displayNeighborhoods.length > 0 && (
          <>
            <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">
              Premier {ctx.city} neighborhoods
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {displayNeighborhoods.map((n) => (
                <Link
                  key={n.slug}
                  to={`/northern-colorado-areas/${citySlug}/${n.slug}/`}
                  className="block p-4 rounded-lg border border-gray-200 hover:border-[#CFB36E] hover:shadow-md transition-all bg-gray-50"
                >
                  <span className="font-semibold text-gray-900">{n.name}</span>
                  <span className="block text-sm text-gray-600 mt-1">{n.priceHint}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            to={searchHref}
            className="inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Search {ctx.city} homes {threshold.thresholdDisplay}
          </Link>
          <Link
            to="/luxury-real-estate/"
            className="inline-flex items-center justify-center px-6 py-3 border-2 font-semibold rounded-lg transition-colors hover:bg-[#CFB36E]/10"
            style={{ borderColor: GOLD, color: "#1a1a1a" }}
          >
            Northern Colorado Luxury Hub
          </Link>
          <Link
            to="/contact/"
            className="inline-flex items-center justify-center px-6 py-3 border-2 border-gray-900 text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Private Consultation
          </Link>
          <a
            href="tel:9709991407"
            className="inline-flex items-center justify-center px-6 py-3 text-gray-800 font-semibold hover:underline"
          >
            (970) 999-1407
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Related:{" "}
          <Link to="/for-buyers/" className="underline hover:text-gray-800">
            For Buyers
          </Link>
          {" · "}
          <Link to="/for-sellers/" className="underline hover:text-gray-800">
            For Sellers
          </Link>
          {" · "}
          <Link
            to="/blog/luxury-home-buying-guide-northern-colorado/"
            className="underline hover:text-gray-800"
          >
            Luxury buying guide
          </Link>
          {citySlug === "fort-collins" && (
            <>
              {" · "}
              <Link
                to="/blog/fort-collins-luxury-neighborhoods-guide/"
                className="underline hover:text-gray-800"
              >
                Fort Collins luxury neighborhoods
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
