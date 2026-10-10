/**
 * Installable app + instant alerts (web push) on this device.
 * The service worker only handles push; it caches nothing.
 */
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

let installPromptEvent = null;
const installListeners = new Set();

export function registerAppShell() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPromptEvent = e;
    installListeners.forEach((fn) => fn(true));
  });
  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    installListeners.forEach((fn) => fn(false));
  });
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iPhone only allows web push from the app on the home screen. */
export const needsHomeScreenFirst = () => isIos() && !isStandalone();

export function canPromptInstall() {
  return !!installPromptEvent;
}

export function onInstallAvailable(fn) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

export async function promptInstall() {
  if (!installPromptEvent) return false;
  installPromptEvent.prompt();
  const choice = await installPromptEvent.userChoice.catch(() => null);
  installPromptEvent = null;
  return choice?.outcome === "accepted";
}

function urlBase64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "on" | "off" | "blocked" | "unsupported" */
export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Must run from a tap: asks permission, subscribes, saves on the server. */
export async function enablePush() {
  if (!pushSupported()) throw new Error("This browser can’t show instant alerts.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are turned off for this site in your browser settings.");
  const keyRes = await fetch(`${API_BASE}/api/push/key`).then((r) => r.json());
  if (!keyRes.enabled) throw new Error("Instant alerts aren’t available right now.");
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  let sub;
  try {
    sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) }));
  } catch {
    throw new Error("This browser couldn’t set up notifications. Try again, or use Chrome or Safari on your phone.");
  }
  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || "Could not turn on instant alerts.");
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await fetch(`${API_BASE}/api/push/unsubscribe`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
