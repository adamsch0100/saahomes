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
  const [busy, setBusy] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFreq, setEditFreq] = useState("daily");
  const [editTime, setEditTime] = useState("06:00");
  const [editDay, setEditDay] = useState("Monday");
  const [unsubscribed, setUnsubscribed] = useState(false);

  const load = useCallback(() => {
    if (!token) {
      setError("This link is missing its token. Use the link from your alert email.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE}/api/alerts/manage?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.error || "Could not load your alerts.");
        setData(d.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
            <p className="text-sm text-gray-600 mt-6">
              Alerts go to <strong className="text-gray-900">{data.email}</strong>
            </p>
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
