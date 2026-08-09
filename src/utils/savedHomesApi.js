/**
 * Account-linked saved homes API + localStorage migration helpers.
 * Prefer listing_key (IRES listing_id); accept slug for legacy hearts.
 */
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

export const SAVED_HOMES_KEY = "saa-saved-homes";

/** @returns {string[]} legacy localStorage keys (slugs or listing ids) */
export function getLocalSavedHomes() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_HOMES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearLocalSavedHomes() {
  try {
    localStorage.removeItem(SAVED_HOMES_KEY);
  } catch {
    /* noop */
  }
}

export function listingKeyOf(listing) {
  if (!listing) return null;
  return (
    listing.listing_id ||
    listing.listing_key ||
    listing.listingId ||
    listing.slug ||
    (listing.id != null ? String(listing.id) : null)
  );
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** GET session user via /api/alerts/me — null if signed out */
export async function fetchSessionUser() {
  try {
    const res = await fetch(`${API_BASE}/api/alerts/me`, { credentials: "same-origin" });
    const d = await parseJson(res);
    if (d?.success && d.data) return d.data;
    return null;
  } catch {
    return null;
  }
}

/** Batch heart status. Returns Record<inputKey, boolean>. Empty if 401. */
export async function fetchSavedStatus(keys = []) {
  const list = [...new Set(keys.filter(Boolean).map(String))].slice(0, 200);
  if (!list.length) return {};
  try {
    const res = await fetch(
      `${API_BASE}/api/saved-homes/status?listing_keys=${encodeURIComponent(list.join(","))}`,
      { credentials: "same-origin" }
    );
    if (res.status === 401) return {};
    const d = await parseJson(res);
    if (!d?.success) return {};
    return d.data?.saved || {};
  } catch {
    return {};
  }
}

export async function fetchSavedHomes() {
  const res = await fetch(`${API_BASE}/api/saved-homes`, { credentials: "same-origin" });
  const d = await parseJson(res);
  if (res.status === 401) {
    const err = new Error("Not signed in.");
    err.status = 401;
    throw err;
  }
  if (!d?.success) throw new Error(d?.error || "Could not load saved homes.");
  return d.data?.homes || [];
}

export async function saveHomeApi(listingKey) {
  const res = await fetch(`${API_BASE}/api/saved-homes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ listing_key: String(listingKey) }),
  });
  const d = await parseJson(res);
  if (res.status === 401) {
    const err = new Error("Not signed in.");
    err.status = 401;
    throw err;
  }
  if (!d?.success) throw new Error(d?.error || "Could not save this home.");
  return d.data;
}

export async function unsaveHomeApi(listingKey) {
  const res = await fetch(
    `${API_BASE}/api/saved-homes/${encodeURIComponent(String(listingKey))}`,
    { method: "DELETE", credentials: "same-origin" }
  );
  const d = await parseJson(res);
  if (res.status === 401) {
    const err = new Error("Not signed in.");
    err.status = 401;
    throw err;
  }
  if (!d?.success) throw new Error(d?.error || "Could not remove this saved home.");
  return d.data;
}

/**
 * Migrate legacy localStorage hearts → server once per session after login.
 * Clears localStorage when done (even if some keys 404).
 */
let migrationInFlight = null;
export async function migrateLocalSavedHomes() {
  if (typeof window === "undefined") return { migrated: 0 };
  if (migrationInFlight) return migrationInFlight;

  migrationInFlight = (async () => {
    const local = getLocalSavedHomes();
    if (!local.length) return { migrated: 0 };

    let migrated = 0;
    for (const key of local) {
      try {
        await saveHomeApi(key);
        migrated += 1;
      } catch {
        // Listing may be gone — still drop local key later
      }
    }
    clearLocalSavedHomes();
    try {
      window.dispatchEvent(new CustomEvent("saa-saved-homes-changed"));
    } catch {
      /* noop */
    }
    return { migrated };
  })().finally(() => {
    migrationInFlight = null;
  });

  return migrationInFlight;
}

/** Create/ensure cookie session with email + phone (required). */
export async function ensureSessionApi({ email, phone, name, password } = {}) {
  const res = await fetch(`${API_BASE}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      email: String(email || "").trim(),
      phone: String(phone || "").trim(),
      name: name ? String(name).trim() : undefined,
      password: password || undefined,
    }),
  });
  const d = await parseJson(res);
  if (!d?.success) throw new Error(d?.error || "Could not sign you in.");
  return d.data;
}

export async function loginApi({ email, password } = {}) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      email: String(email || "").trim(),
      password: String(password || ""),
    }),
  });
  const d = await parseJson(res);
  if (!d?.success) throw new Error(d?.error || "Could not log in.");
  return d.data;
}

/** Request passwordless magic-link email (same response whether email exists). */
export async function requestMagicLinkApi(email) {
  const res = await fetch(`${API_BASE}/api/alerts/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email: String(email || "").trim().toLowerCase() }),
  });
  const d = await parseJson(res);
  if (!d?.success) throw new Error(d?.error || "Could not send the link. Please try again.");
  return d;
}

/** Clear saa_user_token cookie session. */
export async function signOutApi() {
  const res = await fetch(`${API_BASE}/api/alerts/signout`, {
    method: "POST",
    credentials: "same-origin",
  });
  const d = await parseJson(res);
  if (!d?.success) throw new Error(d?.error || "Could not sign out.");
  return d;
}

export function notifySavedHomesChanged(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent("saa-saved-homes-changed", { detail }));
  } catch {
    /* noop */
  }
}
