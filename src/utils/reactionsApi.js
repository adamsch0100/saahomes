/**
 * Love / Maybe / Not for me, private notes and "why this home".
 * All calls need a signed-in buyer; 401s come back as err.status = 401.
 */
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

async function call(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, { credentials: "same-origin", ...options });
  let d = null;
  try {
    d = await res.json();
  } catch {
    /* not json */
  }
  if (!res.ok || !d?.success) {
    const err = new Error(d?.error || "Something went wrong.");
    err.status = res.status;
    throw err;
  }
  return d.data;
}

/** { listing_key, reaction, note, saved, taste_ready, match: { score, reasons } | null } */
export const fetchHomeForMe = (listingKey) => call(`/reactions/${encodeURIComponent(String(listingKey))}`);

export const setHomeReaction = (listingKey, body) =>
  call(`/reactions/${encodeURIComponent(String(listingKey))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const fetchMyReactions = () => call("/reactions");

export const fetchTaste = () => call("/taste");

export function notifyReactionsChanged(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent("saa-reactions-changed", { detail }));
  } catch {
    /* noop */
  }
}
