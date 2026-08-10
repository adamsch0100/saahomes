import React from "react";
import { marketPack } from "../data/marketPack.js";
import { LISTING_PHOTO_FALLBACK_SRC as FALLBACK_SRC } from "../utils/photoUrl.js";

const BRAND = marketPack.market.brand || "SAA Homes";

/**
 * Branded placeholder when a listing has no photo or the photo proxy fails.
 * Dark background + gold house glyph + brand label (never a broken-image icon).
 */
export default function ListingPhotoFallback({
  className = "",
  label = BRAND,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-[#1a1a1a] text-center select-none ${className}`}
      role="img"
      aria-label={label ? `Photo unavailable — ${label}` : "Photo unavailable"}
    >
      <svg
        width={compact ? 28 : 40}
        height={compact ? 28 : 40}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#CFB36E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M9 20v-6h6v6" />
      </svg>
      {label ? (
        <span
          className={`mt-2 font-semibold tracking-wide text-[#CFB36E] ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

/** Re-export for map popups / img onError (single source in photoUrl.js). */
export const LISTING_PHOTO_FALLBACK_SRC = FALLBACK_SRC;
