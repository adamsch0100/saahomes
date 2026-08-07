import React, { useEffect, useState } from "react";

const GOLD = "#CFB36E";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const LEVEL_LABEL = {
  elementary: "Elementary",
  middle: "Middle",
  high: "High",
  "k-8": "K–8",
};

/**
 * Top-rated schools for a city — used on AreaGuidePage + standalone city pages.
 * Fetches /api/schools?city=…; hides entirely when no ratings are cached.
 * Attribution required (GreatSchools Rating + link). Never fabricates.
 */
export default function TopRatedSchools({ city, citySlug, limit = 8 }) {
  const [schools, setSchools] = useState(null); // null = loading, [] = empty
  const [error, setError] = useState(false);

  const query = citySlug || city;

  useEffect(() => {
    if (!query) {
      setSchools([]);
      return undefined;
    }
    let cancelled = false;
    setSchools(null);
    setError(false);
    const params = new URLSearchParams({
      city: String(query),
      limit: String(limit),
    });
    fetch(`${API_BASE}/api/schools?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setSchools(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setSchools([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query, limit]);

  if (schools === null) {
    return (
      <section className="py-12 px-6 bg-white" aria-busy="true">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-2 text-center">
            Top-rated schools in {city}
          </h2>
          <p className="text-center text-gray-500 text-sm">Loading school ratings…</p>
        </div>
      </section>
    );
  }

  // No ratings available → hide section (never show empty / fabricated data)
  if (error || !schools.length) return null;

  return (
    <section
      className="py-12 px-6 bg-white"
      aria-labelledby="top-rated-schools-heading"
    >
      <div className="max-w-5xl mx-auto">
        <h2
          id="top-rated-schools-heading"
          className="text-2xl sm:text-3xl font-bold font-serif mb-2 text-center"
        >
          Top-rated schools in {city}
        </h2>
        <p className="text-center text-gray-600 text-sm mb-8 max-w-2xl mx-auto">
          GreatSchools Ratings (1–10) for schools in {city}, Colorado. Attendance zones are set
          by the district and can change — always verify with the school district.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          {schools.map((s) => (
            <div
              key={`${s.citySlug || s.city}-${s.name}`}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:border-[#CFB36E]/50 transition-colors"
            >
              {s.rating != null && (
                <a
                  href={s.url || "https://www.greatschools.org/"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 text-gray-900 font-bold"
                  style={{ backgroundColor: `${GOLD}33`, borderColor: GOLD }}
                  title={`GreatSchools Rating: ${s.rating}/10`}
                  aria-label={`${s.name} GreatSchools Rating ${s.rating}/10`}
                >
                  <span className="text-base leading-none">{s.rating}</span>
                  <span className="text-[9px] font-semibold text-gray-600 leading-none mt-0.5">
                    /10
                  </span>
                </a>
              )}
              <div className="min-w-0 flex-1">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-gray-900 hover:underline leading-snug block truncate"
                  >
                    {s.name}
                  </a>
                ) : (
                  <p className="font-semibold text-gray-900 leading-snug truncate">{s.name}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {s.level ? LEVEL_LABEL[s.level] || s.level : "School"}
                  {" · "}
                  <span className="font-medium text-gray-600">GreatSchools Rating</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-600">Source: </span>
          <a
            href="https://www.greatschools.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            GreatSchools.org
          </a>
          {" — ratings cached from public city pages. "}
          <a
            href={`https://www.greatschools.org/colorado/${(citySlug || city || "")
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "")}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            See all {city} schools on GreatSchools
          </a>
        </p>
      </div>
    </section>
  );
}
