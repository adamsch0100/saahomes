// Listing photo URL helper — serves through our proxy so photos keep working
// even when the MLS signed URLs expire or rate-limit.
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

export function photoUrl(listingId, idx = 0) {
  if (!listingId) return "/images/buyers-hero.jpg";
  return `${API_BASE}/api/photo/${listingId}/${idx}`;
}

// Formats 3.0 → "3", 2.5 → "2.5"
export function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}
