import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";

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
  return parts.length ? parts.join(" · ") : "All Northern Colorado";
}

export default function ManageAlertsPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
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

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    if (token) {
      fetch(`${API_BASE}/api/alerts/manage?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.success) throw new Error(d.error || "Could not load your alerts.");
          setData(d.data);
          setNeedsLogin(false);
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
        })
        .catch(() => setNeedsLogin(true))
        .finally(() => setLoading(false));
    }
  }, [token]);

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
    setNeedsLogin(true);
  };

  const loginWithPassword = async (e) => {
    e.preventDefault();
    setPassBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const toggleSearch = async (id, isActive) => {
    setBusy(id);
    try {
      await fetch(`${API_BASE}/api/alerts/${id}?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      load();
    } finally { setBusy(null); }
  };

  const deleteSearch = async (id) => {
    if (!window.confirm("Delete this saved search?")) return;
    setBusy(id);
    try {
      await fetch(`${API_BASE}/api/alerts/${id}?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      load();
    } finally { setBusy(null); }
  };

  const saveSchedule = async (id) => {
    setBusy(id);
    try {
      await fetch(`${API_BASE}/api/alerts/${id}?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency: editFreq, send_time: editTime, send_day: editDay }),
      });
      setEditingId(null);
      load();
    } finally { setBusy(null); }
  };

  const unsubscribe = async () => {
    if (!window.confirm("Unsubscribe from ALL alert emails?")) return;
    try {
      await fetch(`${API_BASE}/api/alerts/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setUnsubscribed(true);
    } catch { /* noop */ }
  };

  return (
    <>
      <SEO
        title="Manage Your Home Search Alerts | SAA Homes"
        description="View, pause, or delete your saved home searches and email alerts for Northern Colorado."
        canonicalPath="/alerts/manage/"
        robots="noindex, nofollow"
      />
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 min-h-[60vh]">
        <h1 className="text-3xl font-bold font-serif text-gray-900">Your Saved Searches</h1>
        <p className="text-gray-500 mt-2">Manage the home alerts we email you. Changes apply immediately.</p>

        {unsubscribed ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-lg font-semibold text-gray-900">You're unsubscribed.</p>
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
                  No password yet? Use "Email me a link" — or create one next time you save a search.
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
        ) : error ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-700">{error}</p>
            <p className="text-gray-400 text-sm mt-2">
              If the problem persists, call Schwartz and Associates at{" "}
              <a href="tel:+19709991407" className="underline">(970) 999-1407</a>.
            </p>
          </div>
        ) : loading ? (
          <p className="mt-8 text-gray-500">Loading your alerts…</p>
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
            {data.searches.length === 0 ? (
              <div className="mt-4 bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-700">No active saved searches.</p>
                <Link to="/properties/" className="inline-block mt-4 px-5 py-2.5 bg-black text-white rounded-lg text-sm font-semibold">
                  Create one — search homes
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.searches.map((s) => (
                  <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        {s.name}
                        {s.is_active ? (
                          <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">ACTIVE</span>
                        ) : (
                          <span className="text-[11px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">PAUSED</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{filtersText(s.filters)}</p>
                      <p className="text-xs text-gray-400 mt-1">📧 {scheduleText(s)}</p>
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
                            className="px-3.5 py-2 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => toggleSearch(s.id, s.is_active)}
                        className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-black disabled:opacity-50"
                      >
                        {s.is_active ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(editingId === s.id ? null : s.id);
                          setEditFreq(s.frequency || "daily");
                          setEditTime(s.send_time || "06:00");
                          setEditDay(s.send_day || "Monday");
                        }}
                        className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-black disabled:opacity-50"
                      >
                        Schedule
                      </button>
                      <button
                        type="button"
                        disabled={busy === s.id}
                        onClick={() => deleteSearch(s.id)}
                        className="px-3.5 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:border-red-400 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
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
      </div>
    </>
  );
}
