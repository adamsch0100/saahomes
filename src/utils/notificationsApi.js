/**
 * Thin fetch wrappers for the in-app notification center.
 * Same cookie-session pattern as savedHomesApi.js.
 */
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function authError(status) {
  const err = new Error(status === 401 ? "Not signed in." : "Request failed.");
  err.status = status;
  return err;
}

/**
 * @param {{ page?: number, filter?: string }} [opts]
 * @returns {Promise<{
 *   notifications: object[],
 *   unread_count: number,
 *   total: number,
 *   page: number,
 *   page_size: number,
 *   has_more: boolean
 * }>}
 */
export async function fetchNotifications({ page = 1, filter = "all" } = {}) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (filter && filter !== "all") params.set("filter", filter);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/api/notifications${qs ? `?${qs}` : ""}`, {
    credentials: "same-origin",
  });
  const d = await parseJson(res);
  if (res.status === 401) throw authError(401);
  if (!d?.success) throw new Error(d?.error || "Could not load notifications.");
  return d.data;
}

/** Lightweight unread poll — returns { unread_count, notifications (page 1) } or null if signed out */
export async function fetchUnreadSummary() {
  try {
    const res = await fetch(`${API_BASE}/api/notifications?page=1`, {
      credentials: "same-origin",
    });
    if (res.status === 401) return null;
    const d = await parseJson(res);
    if (!d?.success) return null;
    return {
      unread_count: d.data?.unread_count ?? 0,
      notifications: (d.data?.notifications || []).slice(0, 7),
    };
  } catch {
    return null;
  }
}

export async function markNotificationRead(id) {
  const res = await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
    credentials: "same-origin",
  });
  const d = await parseJson(res);
  if (res.status === 401) throw authError(401);
  if (!d?.success) throw new Error(d?.error || "Could not mark read.");
  return d.data;
}

export async function markAllNotificationsRead() {
  const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: "POST",
    credentials: "same-origin",
  });
  const d = await parseJson(res);
  if (res.status === 401) throw authError(401);
  if (!d?.success) throw new Error(d?.error || "Could not mark all read.");
  return d.data;
}

export async function dismissNotification(id) {
  const res = await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const d = await parseJson(res);
  if (res.status === 401) throw authError(401);
  if (!d?.success) throw new Error(d?.error || "Could not dismiss.");
  return d.data;
}

export async function dismissAllNotifications() {
  const res = await fetch(`${API_BASE}/api/notifications/dismiss-all`, {
    method: "POST",
    credentials: "same-origin",
  });
  const d = await parseJson(res);
  if (res.status === 401) throw authError(401);
  if (!d?.success) throw new Error(d?.error || "Could not dismiss all.");
  return d.data;
}

/** Relative time for notification rows */
export function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return `${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h}h ago`;
  }
  if (diffSec < 172800) return "Yesterday";
  if (diffSec < 604800) {
    const d = Math.floor(diffSec / 86400);
    return `${d}d ago`;
  }
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export const NOTIFICATION_TYPE_LABELS = {
  new_match: "New Match",
  price_drop: "Price Drop",
  value_update: "Value Update",
  off_market: "Off Market",
  showing_confirm: "Showing",
  shared_home: "Shared Home",
};

/** Resolve image_url for <img src> — proxy path or absolute API path */
export function notificationImageSrc(imageUrl) {
  if (!imageUrl) return null;
  // Never pass through raw MLS media
  if (/media\.mlsgrid/i.test(imageUrl)) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    // Only allow our own host / relative already handled
    try {
      const u = new URL(imageUrl);
      if (!/saahomes\.com$/i.test(u.hostname) && u.hostname !== "localhost") return null;
      return imageUrl;
    } catch {
      return null;
    }
  }
  if (imageUrl.startsWith("/api/photo/")) {
    return `${API_BASE}${imageUrl}`;
  }
  if (imageUrl.startsWith("/")) return imageUrl;
  return null;
}
