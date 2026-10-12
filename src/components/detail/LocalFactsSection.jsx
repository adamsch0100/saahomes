import React from "react";

const money = (n) => `$${Math.round(Number(n)).toLocaleString("en-US")}`;
const pct = (r) => `${(Math.round(r * 10000) / 100).toFixed(2)}%`;

/**
 * Costs beyond the mortgage and the local things buyers get surprised by:
 * taxes against the rest of the town, HOA, metro districts, well and septic,
 * and a link to FEMA's flood map. Data comes from the API's local_facts.
 */
export default function LocalFactsSection({ listing }) {
  const facts = listing?.local_facts;
  if (!facts) return null;
  const { taxes, hoa, water, notes = [] } = facts;

  return (
    <section aria-labelledby="detail-facts-heading" className="bg-gray-50 rounded-xl p-5 sm:p-6 border border-gray-100">
      <h2 id="detail-facts-heading" className="text-xl sm:text-2xl font-bold text-gray-900 font-serif mb-1">
        Costs and local facts
      </h2>
      <p className="text-gray-500 text-sm mb-4">What it costs to own beyond the mortgage, from the listing and other homes for sale nearby.</p>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {taxes && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <dt className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">
              Property taxes{taxes.year ? ` (${taxes.year})` : ""}
            </dt>
            <dd className="mt-1">
              <span className="font-semibold text-gray-900">{money(taxes.annual)} a year</span>
              <span className="text-gray-500 text-sm"> · {money(taxes.monthly)}/mo</span>
              {taxes.rate != null && (
                <p className="mt-1 text-xs text-gray-500">
                  {pct(taxes.rate)} of the price
                  {taxes.town_rate != null && taxes.town ? ` · most ${taxes.town} homes: ${pct(taxes.town_rate)}` : ""}
                </p>
              )}
            </dd>
          </div>
        )}
        {hoa && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <dt className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">HOA</dt>
            <dd className="mt-1">
              {hoa.none ? (
                <span className="font-semibold text-gray-900">No HOA</span>
              ) : (
                <>
                  <span className="font-semibold text-gray-900">{money(hoa.monthly)} a month</span>
                  {hoa.includes?.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">Covers {hoa.includes.join(", ").toLowerCase()}</p>
                  )}
                </>
              )}
            </dd>
          </div>
        )}
        {water && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <dt className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Water and sewer</dt>
            <dd className="mt-1 text-sm text-gray-900">{water.join(" · ")}</dd>
          </div>
        )}
        {facts.flood_map_url && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <dt className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Flood zone</dt>
            <dd className="mt-1 text-sm">
              <a href={facts.flood_map_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 underline">
                Check FEMA&apos;s flood map for this address
              </a>
            </dd>
          </div>
        )}
      </dl>

      {facts.monthly_fixed > 0 && (
        <p className="mt-4 text-sm text-gray-800">
          <span className="font-semibold">{money(facts.monthly_fixed)} a month</span> in
          {taxes && hoa?.monthly ? " taxes and HOA" : taxes ? " taxes" : " HOA"} before the mortgage and insurance.
        </p>
      )}

      {notes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {notes.map((n, i) => (
            <li key={i} className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{n.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
