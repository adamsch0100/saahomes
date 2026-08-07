import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../utils/listingHelpers.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const GOLD = "#CFB36E";

/**
 * Nearby / hub section towns with LIVE market lines from /api/listings/stats.
 * Never fabricates counts or medians — shows a soft fallback when the API is empty.
 *
 * @param {Object} props
 * @param {string} props.title - Section heading
 * @param {string} [props.intro] - Optional intro paragraph
 * @param {Array<{id:string,name:string,searchCity:string,description:string,writeup?:string,href?:string,searchHref?:string}>} props.towns
 */
export default function SectionTownsBand({ title, intro, towns = [] }) {
  const [statsByCity, setStatsByCity] = useState({});

  useEffect(() => {
    if (!towns.length) return undefined;
    let cancelled = false;
    const cities = [...new Set(towns.map((t) => t.searchCity).filter(Boolean))];

    Promise.all(
      cities.map((city) =>
        fetch(`${API_BASE}/api/listings/stats?city=${encodeURIComponent(city)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => [city, d?.data || null])
          .catch(() => [city, null])
      )
    ).then((pairs) => {
      if (cancelled) return;
      const next = {};
      for (const [city, data] of pairs) next[city] = data;
      setStatsByCity(next);
    });

    return () => {
      cancelled = true;
    };
  }, [towns]);

  if (!towns.length) return null;

  return (
    <section className="py-12 px-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3 text-center">{title}</h2>
        {intro && (
          <p className="text-gray-700 text-center mb-8 max-w-2xl mx-auto leading-relaxed">{intro}</p>
        )}
        <div className="space-y-6">
          {towns.map((town) => {
            const stats = statsByCity[town.searchCity];
            const total = stats?.total != null ? Number(stats.total) : null;
            const median = stats?.median_price != null ? Number(stats.median_price) : null;
            const marketLine =
              total != null && total > 0
                ? `${total.toLocaleString("en-US")} active listing${total === 1 ? "" : "s"}${
                    median != null ? ` · median list price ${formatPrice(median)}` : ""
                  } (live IRES data)`
                : total === 0
                  ? "No active listings right now — inventory changes daily (live IRES data)"
                  : "Live market data loading…";

            const searchHref =
              town.searchHref ||
              `/properties/?location=${encodeURIComponent(`${town.searchCity}, CO`)}`;

            return (
              <article
                key={town.id}
                id={town.id}
                className="scroll-mt-28 bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold font-serif text-gray-900">
                      {town.href ? (
                        <Link to={town.href} className="hover:underline">
                          {town.name}
                        </Link>
                      ) : (
                        town.name
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{town.description}</p>
                  </div>
                  <p
                    className="text-sm font-semibold shrink-0 sm:text-right"
                    style={{ color: GOLD === "#CFB36E" ? "#8a7340" : GOLD }}
                  >
                    {marketLine}
                  </p>
                </div>
                {town.writeup && (
                  <p className="text-gray-700 leading-relaxed mb-4">{town.writeup}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={searchHref}
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Search {town.name} homes
                  </Link>
                  {town.href && (
                    <Link
                      to={town.href}
                      className="inline-flex items-center justify-center px-5 py-2.5 border-2 border-black text-black text-sm font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
                    >
                      {town.name} area guide
                    </Link>
                  )}
                  <Link
                    to="/contact/"
                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-gray-800 hover:underline"
                  >
                    Talk to an agent →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
