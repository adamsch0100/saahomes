/**
 * Browser activity → the platform's event stream (POST /api/events).
 * Fire-and-forget: tracking never blocks or breaks the page.
 * The server dedupes repeats, so callers can send freely.
 */
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

export function trackEvent(type, data = {}) {
  try {
    fetch(`${API_BASE}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ type, ...data }),
    }).catch(() => {});
  } catch {
    // tracking is best-effort
  }
}

/** A search the visitor ran: the URL query string plus the result count. */
export function trackSearch(params, total) {
  const p = String(params || "");
  if (!p) return;
  trackEvent("search", { params: p, total });
}
