import React from "react";

const GOLD = "#CFB36E";

/**
 * GreatSchools Rating badge (1–10). Attribution required on every badge.
 * Never fabricates — only shows a number when gsRating is a real 1–10.
 */
function RatingBadge({ rating, href, schoolName }) {
  if (rating == null || rating < 1 || rating > 10) return null;
  const badge = (
    <span
      className="inline-flex items-center justify-center min-w-[2.5rem] h-10 px-2 rounded-full text-sm font-bold text-gray-900 border-2 shadow-sm"
      style={{ backgroundColor: `${GOLD}33`, borderColor: GOLD }}
      title={`GreatSchools Rating: ${rating}/10`}
      aria-label={`GreatSchools Rating ${rating} out of 10`}
    >
      {rating}
      <span className="text-[10px] font-semibold text-gray-600 ml-0.5">/10</span>
    </span>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 hover:opacity-90 transition-opacity"
        aria-label={`${schoolName} GreatSchools Rating ${rating}/10 — open GreatSchools profile`}
      >
        {badge}
      </a>
    );
  }
  return badge;
}

const LEVEL_LABEL = {
  elementary: "Elementary",
  middle: "Middle School",
  high: "High School",
};

/**
 * Schools — names/district + GreatSchools Rating badges when available.
 * Ratings come only from the API cache (live JSON-LD extraction). Never invent.
 */
export default function SchoolsSection({ listing }) {
  if (!listing) return null;

  const hasFields =
    listing.elementary_school ||
    listing.middle_school ||
    listing.high_school ||
    listing.school_district;
  const schoolsFromApi = Array.isArray(listing.schools) ? listing.schools : [];

  if (!hasFields && schoolsFromApi.length === 0) return null;

  // Prefer API-enriched schools[]; fall back to raw listing fields (no ratings)
  const cards =
    schoolsFromApi.length > 0
      ? schoolsFromApi.map((s) => ({
          level: s.level,
          label: LEVEL_LABEL[s.level] || s.level || "School",
          name: s.name,
          gsRating: s.gsRating ?? s.rating ?? null,
          gsUrl: s.gsUrl ?? s.url ?? null,
        }))
      : [
          ["elementary", "Elementary", listing.elementary_school],
          ["middle", "Middle School", listing.middle_school],
          ["high", "High School", listing.high_school],
        ]
          .filter(([, , name]) => name)
          .map(([level, label, name]) => ({
            level,
            label,
            name,
            gsRating: null,
            gsUrl: null,
          }));

  const anyRated = cards.some(
    (c) => c.gsRating != null && c.gsRating >= 1 && c.gsRating <= 10
  );

  return (
    <section
      aria-labelledby="detail-schools-heading"
      className="bg-gray-50 rounded-xl p-5 sm:p-6 border border-gray-100"
    >
      <h2
        id="detail-schools-heading"
        className="text-xl sm:text-2xl font-bold text-gray-900 font-serif mb-1"
      >
        Schools
      </h2>
      <p className="text-gray-500 text-sm mb-4">
        School attendance zones are assigned by the district and can change — verify with the
        district before relying on them.
      </p>
      {listing.school_district && (
        <p className="text-sm text-gray-700 mb-3">
          <span className="font-semibold">District:</span> {listing.school_district}
        </p>
      )}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {cards.map((card) => (
            <div
              key={`${card.level}-${card.name}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-[#CFB36E]/60 transition-colors flex gap-3 items-start"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">
                  {card.label}
                </p>
                <p className="font-semibold text-gray-900 mt-1 leading-snug">{card.name}</p>
                {card.gsRating != null && card.gsRating >= 1 && card.gsRating <= 10 ? (
                  <p className="mt-2 text-[11px] text-gray-500">
                    <span className="font-medium text-gray-700">GreatSchools Rating</span>
                    {card.gsUrl ? (
                      <>
                        {" · "}
                        <a
                          href={card.gsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-gray-800"
                        >
                          View on GreatSchools.org
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-gray-400">Rating not available</p>
                )}
              </div>
              <RatingBadge
                rating={card.gsRating}
                href={card.gsUrl}
                schoolName={card.name}
              />
            </div>
          ))}
        </div>
      )}
      {anyRated && (
        <p className="mt-4 text-[11px] text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-600">Source: </span>
          <a
            href="https://www.greatschools.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            GreatSchools.org
          </a>
          {" — "}
          GreatSchools Rating is a 1–10 score based on test scores, student progress, and equity.
          Ratings are cached from public GreatSchools city pages and may lag live updates.
        </p>
      )}
    </section>
  );
}
