import React from "react";

/**
 * Who a home is listed with, and whether it's a sample home.
 *
 * Every listing from the API carries `courtesy` ("Listing courtesy of …",
 * when the MLS requires it and the office is known) and `sample` (true for
 * the made-up homes a brokerage sees until its MLS approves its site).
 */

/** Pill over a listing photo: this isn't a real home. */
/** short: just "Sample", for small photos. */
export function SampleBadge({ listing, className = "", short = false }) {
  if (!listing?.sample) return null;
  return (
    <span
      className={`inline-flex items-center min-h-[24px] bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold tracking-wide uppercase whitespace-nowrap px-2.5 py-1 rounded-md shadow-sm ${className}`}
      title="A sample home to try the search. Not a real listing and not for sale."
    >
      {short ? "Sample" : "Sample listing"}
    </span>
  );
}

/** Small line under a card: "Listing courtesy of …". */
export function CourtesyLine({ listing, className = "" }) {
  const text = listing?.courtesy || listing?.attribution?.courtesy;
  if (!text) return null;
  return <p className={`text-[11px] text-gray-500 truncate ${className}`}>{text}</p>;
}

/** Banner at the top of a sample home's page. */
export function SampleNotice({ listing, className = "" }) {
  if (!listing?.sample) return null;
  return (
    <div
      role="note"
      className={`rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <p className="font-semibold">Sample listing</p>
      <p className="mt-0.5 text-amber-800">
        This is a made-up home so you can try the search. It isn't a real listing and isn't for sale.
      </p>
    </div>
  );
}

/** Small HTML string versions for map popups (built with innerHTML). */
export function sampleBadgeHtml(listing) {
  return listing?.sample
    ? '<span class="inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">Sample listing</span>'
    : "";
}

export function courtesyHtml(listing) {
  const text = listing?.courtesy;
  if (!text) return "";
  const safe = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p class="text-[10px] text-gray-500 mt-1 mb-0 truncate">${safe}</p>`;
}
