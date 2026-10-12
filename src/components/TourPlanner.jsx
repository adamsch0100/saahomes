import React, { useEffect, useState } from "react";
import { formatPrice } from "../utils/listingHelpers.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const PARTS = [
  { value: "morning", label: "Morning (9–12)" },
  { value: "afternoon", label: "Afternoon (12–4)" },
  { value: "evening", label: "Evening (4–7)" },
];

async function post(path, body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => null);
  if (!res.ok || !d?.success) throw new Error(d?.error || "Something went wrong.");
  return d.data;
}

const localDate = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const hours = (m) => (m >= 90 ? `about ${Math.round((m / 60) * 2) / 2} hours` : `about ${m} minutes`);

/**
 * Plan a tour of several homes: shows them in driving order with an honest
 * time estimate, collects up to three times that work, and sends one request.
 */
export default function TourPlanner({ listingKeys, onClose, onSent }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [windows, setWindows] = useState([{ date: localDate(2), part: "afternoon" }]);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    post("/tours/plan", { listing_keys: listingKeys }).then(setPlan).catch((e) => setError(e.message));
  }, [listingKeys]);

  const setWindow = (i, patch) => setWindows((ws) => ws.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await post("/tours", { listing_keys: listingKeys, windows, phone, note });
      setSent(data);
      onSent?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = sent?.plan || plan;

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Plan a tour">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">{sent ? "Tour requested" : "Plan a tour"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 text-gray-500 text-xl">×</button>
        </div>

        {!shown && !error && <p className="mt-3 text-sm text-gray-500">Working out the best order…</p>}
        {shown && (
          <>
            <p className="mt-1 text-sm text-gray-600">
              {shown.stops.length} home{shown.stops.length === 1 ? "" : "s"} in driving order, {hours(shown.total_minutes)} with
              {" "}time inside each one (estimate).
            </p>
            <ol className="mt-3 space-y-2">
              {shown.stops.map((s) => (
                <li key={s.listing_key} className="flex gap-3 items-start">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">{s.stop}</span>
                  <div className="min-w-0">
                    {s.leg && <p className="text-[11px] text-gray-400">about {s.leg.minutes} min drive</p>}
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.address}</p>
                    {s.list_price != null && <p className="text-xs text-gray-500">{formatPrice(s.list_price)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        {sent ? (
          <div className="mt-4">
            <p className="text-sm text-gray-700">Your agent has the route and will confirm an exact time. Anyone on your board can see it too.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`${API_BASE}${sent.calendar_url}`}
                className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-[#CFB36E] text-gray-900 text-sm font-bold"
              >
                Add a hold to my calendar
              </a>
              <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-semibold">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900">When could you go? Pick up to three.</p>
            {windows.map((w, i) => (
              <div key={i} className="flex gap-2">
                <label className="sr-only" htmlFor={`tour-date-${i}`}>Date</label>
                <input
                  id={`tour-date-${i}`}
                  type="date"
                  required
                  min={localDate(0)}
                  max={localDate(60)}
                  value={w.date}
                  onChange={(e) => setWindow(i, { date: e.target.value })}
                  className="flex-1 min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm"
                />
                <label className="sr-only" htmlFor={`tour-part-${i}`}>Time of day</label>
                <select
                  id={`tour-part-${i}`}
                  value={w.part}
                  onChange={(e) => setWindow(i, { part: e.target.value })}
                  className="flex-1 min-h-[44px] rounded-lg border border-gray-300 px-2 text-sm bg-white"
                >
                  {PARTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {windows.length > 1 && (
                  <button type="button" onClick={() => setWindows((ws) => ws.filter((_, j) => j !== i))} aria-label="Remove this time" className="min-w-[44px] text-gray-400">×</button>
                )}
              </div>
            ))}
            {windows.length < 3 && (
              <button
                type="button"
                onClick={() => setWindows((ws) => [...ws, { date: localDate(ws.length + 2), part: "morning" }])}
                className="text-sm font-semibold text-[#8a7340] underline min-h-[32px]"
              >
                Add another time
              </button>
            )}
            <label className="block text-sm text-gray-700">
              Phone to confirm (leave blank to use the one we have)
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm"
              />
            </label>
            <label className="block text-sm text-gray-700">
              Anything your agent should know?
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !plan}
              className="w-full min-h-[48px] rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-60"
            >
              {busy ? "Sending…" : "Request this tour"}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      </div>
    </div>
  );
}
