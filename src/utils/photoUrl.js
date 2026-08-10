// Listing photo URL helper — serves through our proxy so photos keep working
// even when the MLS signed URLs expire or rate-limit.
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

/**
 * Branded SVG placeholder when listing id is missing (no MLS photo to proxy).
 * Same treatment as ListingPhotoFallback for img src / map onError.
 */
export const LISTING_PHOTO_FALLBACK_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect fill="#1a1a1a" width="800" height="600"/>
      <g fill="none" stroke="#CFB36E" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" transform="translate(340 200) scale(5)">
        <path d="M3 10.5 12 3l9 7.5"/>
        <path d="M5 9.5V20h14V9.5"/>
        <path d="M9 20v-6h6v6"/>
      </g>
      <text x="400" y="430" text-anchor="middle" fill="#CFB36E" font-family="system-ui,sans-serif" font-size="32" font-weight="600">SAA Homes</text>
    </svg>`
  );

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
