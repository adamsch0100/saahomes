// Listing photo URL helper — serves through our proxy so photos keep working
// even when the MLS signed URLs expire or rate-limit.
import { SAA_THEME } from "./brandTheme.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

/**
 * Branded SVG placeholder when listing id is missing (no MLS photo to proxy).
 * Same treatment as ListingPhotoFallback for img src / map onError.
 * A data: URI can't read CSS variables, so the brand's accent hex and name are
 * baked in; TenantProvider rebuilds it for a brokerage's domain
 * (setListingPhotoFallbackBrand) and importers see the new value (live binding).
 */
function buildFallbackSrc({ accent, label }) {
  const safeLabel = String(label || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect fill="#1a1a1a" width="800" height="600"/>
      <g fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" transform="translate(340 200) scale(5)">
        <path d="M3 10.5 12 3l9 7.5"/>
        <path d="M5 9.5V20h14V9.5"/>
        <path d="M9 20v-6h6v6"/>
      </g>
      ${safeLabel ? `<text x="400" y="430" text-anchor="middle" fill="${accent}" font-family="system-ui,sans-serif" font-size="32" font-weight="600">${safeLabel}</text>` : ""}
    </svg>`
    )
  );
}

export let LISTING_PHOTO_FALLBACK_SRC = buildFallbackSrc({ accent: SAA_THEME.accent, label: "SAA Homes" });

/** Rebuild the placeholder for a brokerage's brand (name may be empty). */
export function setListingPhotoFallbackBrand({ accent, label }) {
  LISTING_PHOTO_FALLBACK_SRC = buildFallbackSrc({ accent, label });
}

export function photoUrl(listingId, idx = 0) {
  if (!listingId) return LISTING_PHOTO_FALLBACK_SRC;
  return `${API_BASE}/api/photo/${listingId}/${idx}`;
}

// Formats 3.0 → "3", 2.5 → "2.5"
export function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}
