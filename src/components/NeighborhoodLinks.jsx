import React from "react";
import { Link } from "react-router-dom";
import { getNeighborhoodsByCity } from "../data/neighborhoods.js";

/**
 * Reusable component that displays links to all neighborhoods in a city.
 * Place this in any city page to automatically show neighborhood guides.
 *
 * Usage: <NeighborhoodLinks citySlug="fort-collins" cityName="Fort Collins" />
 */
export default function NeighborhoodLinks({ citySlug, cityName, limit, columns = 3 }) {
  const neighborhoods = getNeighborhoodsByCity(citySlug);

  if (!neighborhoods || neighborhoods.length === 0) return null;

  const display = limit ? neighborhoods.slice(0, limit) : neighborhoods;

  return (
    <section className="mb-12">
      <h2 className="text-3xl font-bold font-serif mb-6">
        {cityName} Neighborhoods & Subdivisions
      </h2>
      <p className="text-lg leading-relaxed mb-6 text-gray-700">
        {cityName} is made up of distinct neighborhoods, each with its own character and amenities.
        Explore our detailed guides to find the right fit for your lifestyle.
      </p>
      <div className={`grid sm:grid-cols-2 lg:grid-cols-${columns} gap-4`}>
        {display.map((n) => (
          <Link
            key={n.slug}
            to={`/northern-colorado-areas/${citySlug}/${n.slug}/`}
            className="block p-5 rounded-xl border border-gray-200 hover:border-[#CFB36E] hover:shadow-md transition-all bg-white"
          >
            <h3 className="font-bold font-serif text-lg mb-1">{n.name}</h3>
            <p className="text-sm text-gray-600">
              {n.features?.slice(0, 2).join(" · ") || `${n.type === "subdivision" ? "Subdivision" : "Neighborhood"} in ${cityName}`}
            </p>
          </Link>
        ))}
      </div>
      {limit && neighborhoods.length > limit && (
        <div className="text-center mt-6">
          <Link
            to={`/northern-colorado-areas/${citySlug}/`}
            className="text-[#CFB36E] font-semibold hover:underline"
          >
            View all {neighborhoods.length} {cityName} neighborhoods →
          </Link>
        </div>
      )}
    </section>
  );
}
