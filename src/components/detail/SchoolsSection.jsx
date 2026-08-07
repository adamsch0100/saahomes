import React from "react";

/**
 * Schools — names/district only. Never fabricate ratings.
 */
export default function SchoolsSection({ listing }) {
  if (!listing) return null;
  const hasAny =
    listing.elementary_school ||
    listing.middle_school ||
    listing.high_school ||
    listing.school_district;
  if (!hasAny) return null;

  const cards = [
    ["Elementary", listing.elementary_school],
    ["Middle School", listing.middle_school],
    ["High School", listing.high_school],
  ].filter(([, v]) => v);

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
          {cards.map(([label, value]) => (
            <div
              key={label}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-[#CFB36E]/60 transition-colors"
            >
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">
                {label}
              </p>
              <p className="font-semibold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
