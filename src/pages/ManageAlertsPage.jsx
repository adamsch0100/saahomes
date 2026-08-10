import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { photoUrl } from "../utils/photoUrl.js";
import ListingDetailPanel from "../components/ListingDetailPanel";
import ListingPhotoFallback from "../components/ListingPhotoFallback.jsx";
import {
  formatPrice,
  listingStatsLine,
} from "../utils/listingHelpers.js";
import { marketPack } from "../data/marketPack.js";
import {
  fetchSavedHomes,
  migrateLocalSavedHomes,
  unsaveHomeApi,
  notifySavedHomesChanged,
} from "../utils/savedHomesApi.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const TYPE_LABEL = { detached: "Detached home", attached: "Condo / townhome / attached", land: "Land", commercial: "Commercial" };
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", immediate: "As it happens" };

function scheduleText(s) {
  if (s.frequency === "immediate") return "As it happens — price drops & new listings email immediately";
  const time = s.send_time || "06:00";
  const [hh] = time.split(":");
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh < 12 ? "AM" : "PM";
  if (s.frequency === "weekly") return `Weekly on ${s.send_day || "Monday"}s at ${hour12}:00 ${ampm} MT`;
  return `Daily at ${hour12}:00 ${ampm} MT`;
}

function filtersText(filters = {}) {
  const f = (n) => (n ? `$${Number(n).toLocaleString()}` : "Any");
  const parts = [];
  if (filters.city) parts.push(filters.city);
  if (filters.minPrice || filters.maxPrice) parts.push(`${f(filters.minPrice)} – ${f(filters.maxPrice)}`);
  if (filters.beds) parts.push(`${filters.beds}+ beds`);
  if (filters.baths) parts.push(`${filters.baths}+ baths`);
  if (filters.type && TYPE_LABEL[filters.type]) parts.push(TYPE_LABEL[filters.type]);
  if (filters.minSqft) parts.push(`${Number(filters.minSqft).toLocaleString()}+ sqft`);
  return parts.length ? parts.join(" · ") : "All Northern Colorado";
}

function authQuery(token) {
  return token ? `?token=${encodeURIComponent(token)}` : "";
}

function LeadScoreBadge({ score, label }) {
  if (score == null) return null;
  const n = Number(score) || 0;
  // Visual only — score itself is never fabricated client-side
  const ring = n >= 50 ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : n >= 25 ? "bg-amber-50 border-amber-200 text-amber-900"
    : "bg-gray-50 border-gray-200 text-gray-700";
  return (
    <div className={`mt-5 rounded-xl border px-4 py-3 flex items-start gap-3 ${ring}`}>
      <div
        className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2"
        style={{ borderColor: "#CFB36E", color: "#1a1a1a", background: "#fff" }}
        aria-label={`Activity score ${n}`}
      >
        {n}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">Activity score: {n}</p>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
          {label || "Your activity score — helps us match you faster."}
        </p>
      </div>
    </div>
  );
}

function PreviewCard({ preview, matchCount, editPath }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (!preview && !matchCount) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-500">
        No active homes match these filters right now. We&apos;ll email you when something new hits.
      </div>
    );
  }
  const previewStats = preview ? listingStatsLine(preview) : "";
  return (
    <div className="mt-3 flex gap-3 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden">
      {preview?.id || preview?.listing_id ? (
        <Link
          to={preview.slug ? `/homes-for-sale/${preview.slug}/` : editPath || "/properties/"}
          className="shrink-0 w-24 sm:w-28 h-20 sm:h-24 bg-[#1a1a1a] relative overflow-hidden"
        >
          {imgFailed ? (
            <ListingPhotoFallback className="w-full h-full" compact />
          ) : (
            <img
              src={photoUrl(preview.id || preview.listing_id, 0)}
              alt={
                preview.address
                  ? `Photo of ${preview.address}`
                  : "Matching home"
              }
              className="w-full h-full object-cover"
              loading="lazy" decoding="async"
              onError={() => setImgFailed(true)}
            />
          )}
        </Link>
      ) : (
        <div className="shrink-0 w-24 sm:w-28 h-20 sm:h-24 bg-[#1a1a1a]">
          <ListingPhotoFallback className="w-full h-full" compact />
        </div>
      )}
      <div className="min-w-0 flex-1 py-2 pr-3 flex flex-col justify-center">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {matchCount === 1 ? "1 match live" : `${Number(matchCount || 0).toLocaleString()} matches live`}
        </p>
        {preview && (
          <>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{formatPrice(preview.list_price)}</p>
            <p className="text-xs text-gray-600 truncate">{preview.address || preview.city || "Matching home"}</p>
            {previewStats ? (
              <p className="text-[11px] text-gray-400 mt-0.5">{previewStats}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function SavedHomeCard({ home, onUnsave, onOpen, busy }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasProxyPhoto = Boolean(home.listing_db_id) || home.photo_url?.startsWith("/api/photo/");
  const imgSrc = home.listing_db_id
    ? photoUrl(home.listing_db_id, 0)
    : home.photo_url?.startsWith("/api/photo/")
      ? `${API_BASE}${home.photo_url}`
      : null;
  const canOpen = Boolean(home.slug) && !home.off_market;
  const stats = listingStatsLine({
    beds: home.beds,
    baths: home.baths,
    living_area: home.living_area,
    home_type: home.home_type,
    property_type: home.property_type,
    lot_size_acres: home.lot_size_acres,
    lot_size: home.lot_size,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col sm:flex-row">
      <button
        type="button"
        onClick={() => canOpen && onOpen?.(home)}
        disabled={!canOpen}
        className={`shrink-0 w-full sm:w-40 h-40 sm:h-auto sm:min-h-[140px] bg-[#1a1a1a] relative ${canOpen ? "cursor-pointer" : "cursor-default"}`}
        aria-label={canOpen ? `Open ${home.property_address || "saved home"}` : "Off market home"}
      >
        {!imgSrc || imgFailed || !hasProxyPhoto ? (
          <ListingPhotoFallback className="w-full h-full absolute inset-0" />
        ) : (
          <img
            src={imgSrc}
            alt={
              home.property_address
                ? `Photo of ${home.property_address}`
                : "Saved home"
            }
            className="w-full h-full object-cover"
            loading="lazy" decoding="async"
            onError={() => setImgFailed(true)}
          />
        )}
        {home.off_market && (
          <span className="absolute top-2 left-2 text-[11px] font-bold uppercase tracking-wide bg-gray-900/90 text-white px-2 py-1 rounded-md">
            Off market
          </span>
        )}
      </button>
      <div className="flex-1 min-w-0 p-4 flex flex-col justify-center gap-1">
        <p className="text-lg font-bold text-gray-900">{formatPrice(home.list_price)}</p>
        <p className="text-sm text-gray-700 leading-snug">{home.property_address || "Saved home"}</p>
        {stats ? <p className="text-xs text-gray-500">{stats}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {canOpen && (
            <button
              type="button"
              onClick={() => onOpen?.(home)}
              className="inline-flex items-center min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold text-black touch-manipulation"
              style={{ backgroundColor: "#CFB36E" }}
            >
              View home
            </button>
          )}
          {home.slug && (
            <Link
              to={`/homes-for-sale/${home.slug}/`}
              className="inline-flex items-center min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-black touch-manipulation"
            >
              Full page
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onUnsave?.(home)}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-[#CFB36E] disabled:opacity-50 touch-manipulation"
            aria-label="Remove from saved homes"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="#CFB36E" stroke="#CFB36E" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Unsave
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManageAlertsPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const tabParam = params.get("tab") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loginMode, setLoginMode] = useState("link"); // link | password
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicBusy, setMagicBusy] = useState(false);
  const [passEmail, setPassEmail] = useState("");
  const [passWord, setPassWord] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [busy, setBusy] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFreq, setEditFreq] = useState("daily");
  const [editTime, setEditTime] = useState("06:00");
  const [editDay, setEditDay] = useState("Monday");
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [tab, setTab] = useState(tabParam === "homes" ? "homes" : "searches");
  const [savedHomes, setSavedHomes] = useState([]);
  const [homesLoading, setHomesLoading] = useState(false);
  const [homesError, setHomesError] = useState(null);
  const [panelSlug, setPanelSlug] = useState(null);

  const loadSavedHomes = useCallback(async () => {
    setHomesLoading(true);
    setHomesError(null);
    try {
      await migrateLocalSavedHomes();
      const homes = await fetchSavedHomes();
      setSavedHomes(homes);
    } catch (e) {
      if (e?.status === 401) {
        setSavedHomes([]);
      } else {
        setHomesError(e.message || "Could not load saved homes.");
      }
    } finally {
      setHomesLoading(false);
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    if (token) {
      fetch(`${API_BASE}/api/alerts/manage?token=${encodeURIComponent(token)}`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => {
          if (!d.success) throw new Error(d.error || "Could not load your alerts.");
          setData(d.data);
          setNeedsLogin(false);
          loadSavedHomes();
        })
        .catch((e) => { setError(e.message); setNeedsLogin(true); })
        .finally(() => setLoading(false));
    } else {
      // Signed in via the auto-login cookie? (set when the search was saved)
      fetch(`${API_BASE}/api/alerts/me`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => {
          if (!d.success) { setNeedsLogin(true); return; }
          setData(d.data);
          setNeedsLogin(false);
          loadSavedHomes();
        })
        .catch(() => setNeedsLogin(true))
        .finally(() => setLoading(false));
    }
  }, [token, loadSavedHomes]);

  useEffect(() => { load(); }, [load]);

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setMagicBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail.trim() }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Could not send the link.");
      setMagicSent(true);
    } catch (err) {
      setError(err.message);
    } finally { setMagicBusy(false); }
  };

  const signOut = async () => {
    try {
      await fetch(`${API_BASE}/api/alerts/signout`, { method: "POST", credentials: "same-origin" });
    } catch { /* noop */ }
    setData(null);
    setSavedHomes([]);
    setNeedsLogin(true);
  };

  const unsaveHome = async (home) => {
    if (!home?.listing_key) return;
    setBusy(`home-${home.listing_key}`);
    try {
      await unsaveHomeApi(home.listing_key);
      setSavedHomes((prev) => prev.filter((h) => h.listing_key !== home.listing_key));
      notifySavedHomesChanged({ listingKey: home.listing_key, saved: false });
    } catch (err) {
      setHomesError(err.message || "Could not unsave.");
    } finally {
      setBusy(null);
    }
  };

  const loginWithPassword = async (e) => {
    e.preventDefault();
    setPassBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: passEmail.trim(), password: passWord }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Could not log in.");
      setPassWord("");
      load();
    } catch (err) {
      setError(err.message);
    } finally { setPassBusy(false); }
  };

  const patchSearch = async (id, body) => {
    setBusy(id);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${id}${authQuery(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || "Could not update.");
      load();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(null); }
  };

  const toggleSearch = (id, isActive) => patchSearch(id, { is_active: !isActive });

  const deleteSearch = async (id) => {
    if (!window.confirm("Delete this saved search?")) return;
    setBusy(id);
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${id}${authQuery(token)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || "Could not delete.");
      load();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(null); }
  };

  const saveSchedule = async (id) => {
    await patchSearch(id, { frequency: editFreq, send_time: editTime, send_day: editDay });
    setEditingId(null);
  };

  const unsubscribe = async () => {
    if (!window.confirm("Unsubscribe from ALL alert emails?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/alerts/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(token ? { token } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || "Could not unsubscribe.");
      setUnsubscribed(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <SEO
        title="My Account — Saved Searches & Homes | SAA Homes"
        description="View match counts, pause alerts, and manage saved homes for Northern Colorado."
        canonicalPath="/my-saved-searches/"
        robots="noindex, nofollow"
      />
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 min-h-[60vh]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-serif text-gray-900">My Account</h1>
            <p className="text-gray-500 mt-2 text-sm sm:text-base">
              Saved searches, email alerts, and favorite homes — synced to your account.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/my-home/"
              className="shrink-0 inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold border border-[#CFB36E] text-gray-900 hover:bg-[#CFB36E]/20 transition-colors"
            >
              My home value
            </Link>
            <Link
              to="/properties/"
              className="shrink-0 inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold border border-black text-black hover:bg-black hover:text-white transition-colors"
            >
              + New search
            </Link>
          </div>
        </div>

        {unsubscribed ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-lg font-semibold text-gray-900">You&apos;re unsubscribed.</p>
            <p className="text-gray-500 text-sm mt-2">No more alert emails will be sent.</p>
            <Link to="/properties/" className="inline-block mt-5 px-5 py-2.5 bg-black text-white rounded-lg text-sm font-semibold">
              Browse homes instead
            </Link>
          </div>
        ) : needsLogin ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-8 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-gray-900">Find your saved searches</h2>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              Sign in with your password, or we can email you a secure link — no password needed.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLoginMode("password")}
                className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${loginMode === "password" ? "bg-black text-white border-black" : "border-gray-300 text-gray-600 hover:border-black"}`}
              >
                Use password
              </button>
              <button
                type="button"
                onClick={() => setLoginMode("link")}
                className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${loginMode === "link" ? "bg-black text-white border-black" : "border-gray-300 text-gray-600 hover:border-black"}`}
              >
                Email me a link
              </button>
            </div>
            {loginMode === "password" ? (
              <form onSubmit={loginWithPassword} className="mt-4 space-y-3">
                <input
                  type="email" required value={passEmail} onChange={(e) => setPassEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm"
                />
                <input
                  type="password" required value={passWord} onChange={(e) => setPassWord(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm"
                />
                <button
                  type="submit" disabled={passBusy}
                  className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {passBusy ? "Logging in…" : "Log in"}
                </button>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <p className="text-xs text-gray-400 text-center">
                  No password yet? Use &quot;Email me a link&quot; — or create one next time you save a search.
                </p>
              </form>
            ) : magicSent ? (
              <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <p className="text-emerald-700 text-sm font-medium">✅ Link sent!</p>
                <p className="text-emerald-600 text-xs mt-1">
                  If we have a saved search for that email, your sign-in link is on its way.
                  Check your inbox (and spam folder).
                </p>
              </div>
            ) : (
              <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
                <input
                  type="email"
                  required
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={magicBusy}
                  className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {magicBusy ? "Sending…" : "Email me my sign-in link"}
                </button>
                {error && <p className="text-red-600 text-sm">{error}</p>}
              </form>
            )}
            <p className="text-xs text-gray-400 text-center mt-4">
              Just saved a search? Check your inbox — the confirmation email has your manage link.
            </p>
          </div>
        ) : error && !data ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-700">{error}</p>
            <p className="text-gray-400 text-sm mt-2">
              If the problem persists, call Schwartz and Associates at{" "}
              <a href={marketPack.market.tel} className="underline">{marketPack.market.phone}</a>.
            </p>
          </div>
        ) : loading ? (
          <div className="mt-8 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-2/3 mt-3" />
                <div className="h-20 bg-gray-100 rounded mt-4" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
              <p className="text-sm text-gray-600">
                Signed in as <strong className="text-gray-900">{data.email}</strong>
                {data.phone && <span className="text-gray-400"> · {data.phone}</span>}
              </p>
              <button
                type="button"
                onClick={signOut}
                className="text-xs text-gray-400 underline hover:text-gray-600"
              >
                Sign out
              </button>
            </div>

            <LeadScoreBadge score={data.lead_score} label={data.lead_score_label} />

            {/* Tabs: Saved Searches | Saved Homes */}
            <div
              className="mt-6 flex border-b border-gray-200 gap-1"
              role="tablist"
              aria-label="Account sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "searches"}
                onClick={() => setTab("searches")}
                className={`min-h-[44px] px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors touch-manipulation ${
                  tab === "searches"
                    ? "border-[#CFB36E] text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                Saved Searches
                {Array.isArray(data.searches) && data.searches.length > 0 && (
                  <span className="ml-1.5 text-xs font-bold text-gray-400">({data.searches.length})</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "homes"}
                onClick={() => setTab("homes")}
                className={`min-h-[44px] px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors touch-manipulation ${
                  tab === "homes"
                    ? "border-[#CFB36E] text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                Saved Homes
                {savedHomes.length > 0 && (
                  <span className="ml-1.5 text-xs font-bold text-gray-400">({savedHomes.length})</span>
                )}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>
            )}

            {tab === "searches" && (
              <>
                {data.searches.length === 0 ? (
                  <div className="mt-6 bg-white border border-gray-200 rounded-xl p-8 text-center">
                    <p className="text-lg font-semibold text-gray-900">No saved searches yet</p>
                    <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
                      Set your filters on the search page and tap &quot;Save this search&quot; — we&apos;ll email you when new homes match.
                    </p>
                    <Link to="/properties/" className="inline-block mt-5 px-5 py-2.5 bg-black text-white rounded-lg text-sm font-semibold min-h-[44px]">
                      Search homes
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {data.searches.map((s) => {
                      const editPath = s.edit_path || "/properties/";
                      return (
                        <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 flex flex-wrap items-center gap-2">
                                <span className="truncate">{s.name}</span>
                                {s.is_active ? (
                                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">ACTIVE</span>
                                ) : (
                                  <span className="text-[11px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">PAUSED</span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">{filtersText(s.filters)}</p>
                              <p className="text-xs text-gray-400 mt-1">📧 {scheduleText(s)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={busy === s.id}
                                onClick={() => toggleSearch(s.id, s.is_active)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-black disabled:opacity-50 min-h-[44px]"
                              >
                                {s.is_active ? "Pause" : "Resume"}
                              </button>
                              <Link
                                to={editPath}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-black inline-flex items-center min-h-[44px]"
                              >
                                Edit filters
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(editingId === s.id ? null : s.id);
                                  setEditFreq(s.frequency || "daily");
                                  setEditTime(s.send_time || "06:00");
                                  setEditDay(s.send_day || "Monday");
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-black disabled:opacity-50 min-h-[44px]"
                              >
                                Schedule
                              </button>
                              <button
                                type="button"
                                disabled={busy === s.id}
                                onClick={() => deleteSearch(s.id)}
                                className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:border-red-400 disabled:opacity-50 min-h-[44px]"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <PreviewCard
                            preview={s.preview}
                            matchCount={s.match_count}
                            editPath={editPath}
                          />

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                              to={editPath}
                              className="inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold text-black min-h-[44px]"
                              style={{ backgroundColor: "#CFB36E" }}
                            >
                              View {s.match_count === 1 ? "1 match" : `${Number(s.match_count || 0).toLocaleString()} matches`}
                            </Link>
                            {s.preview?.slug && (
                              <Link
                                to={`/homes-for-sale/${s.preview.slug}/`}
                                className="inline-flex items-center px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-black min-h-[44px]"
                              >
                                Open latest match
                              </Link>
                            )}
                          </div>

                          {editingId === s.id && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-3">
                              <select
                                value={editFreq}
                                onChange={(e) => setEditFreq(e.target.value)}
                                className="px-2.5 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                aria-label="Frequency"
                              >
                                {Object.entries(FREQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                              {editFreq === "weekly" && (
                                <select
                                  value={editDay}
                                  onChange={(e) => setEditDay(e.target.value)}
                                  className="px-2.5 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                  aria-label="Day"
                                >
                                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                              )}
                              {editFreq !== "immediate" && (
                                <select
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="px-2.5 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                  aria-label="Time"
                                >
                                  {HOURS.map((h) => {
                                    const [hh] = h.split(":");
                                    const hour12 = hh % 12 === 0 ? 12 : hh % 12;
                                    const ampm = hh < 12 ? "AM" : "PM";
                                    return <option key={h} value={h}>{hour12}:00 {ampm}</option>;
                                  })}
                                </select>
                              )}
                              <button
                                type="button"
                                disabled={busy === s.id}
                                onClick={() => saveSchedule(s.id)}
                                className="px-3.5 py-2 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-50 min-h-[44px]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium min-h-[44px]"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={unsubscribe}
                  className="mt-6 text-sm text-gray-400 underline hover:text-gray-600"
                >
                  Unsubscribe from all alert emails
                </button>
              </>
            )}

            {tab === "homes" && (
              <div className="mt-5">
                {homesError && (
                  <p className="mb-3 text-sm text-red-600" role="alert">{homesError}</p>
                )}
                {homesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl h-36 animate-pulse" />
                    ))}
                  </div>
                ) : savedHomes.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                    <p className="text-lg font-semibold text-gray-900">No saved homes yet</p>
                    <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
                      Start browsing {marketPack.market.name} listings and tap the heart to save your favorites.
                    </p>
                    <Link
                      to="/properties/"
                      className="inline-block mt-5 px-5 py-2.5 bg-black text-white rounded-lg text-sm font-semibold min-h-[44px]"
                    >
                      Browse {marketPack.market.name} homes
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedHomes.map((home) => (
                      <SavedHomeCard
                        key={home.listing_key || home.id}
                        home={home}
                        busy={busy === `home-${home.listing_key}`}
                        onUnsave={unsaveHome}
                        onOpen={(h) => h.slug && setPanelSlug(h.slug)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-400">
              Questions? Call or text{" "}
              <a href={marketPack.market.tel} className="underline">{marketPack.market.phone}</a>
              {" "}· {marketPack.fairHousing}
            </p>
          </>
        )}
      </div>
      {panelSlug && (
        <ListingDetailPanel slug={panelSlug} onClose={() => setPanelSlug(null)} />
      )}
    </>
  );
}
