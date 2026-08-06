import React, { useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const TYPE_LABEL = { detached: "Detached home", attached: "Condo / townhome / attached", land: "Land", commercial: "Commercial" };

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", immediate: "As it happens" };

function filterSummary(filters = {}) {
  const parts = [];
  if (filters.city) parts.push(filters.city);
  if (filters.minPrice || filters.maxPrice) {
    const f = (n) => (n ? `$${Number(n).toLocaleString()}` : "Any");
    parts.push(`${f(filters.minPrice)} – ${f(filters.maxPrice)}`);
  }
  if (filters.beds) parts.push(`${filters.beds}+ beds`);
  if (filters.baths) parts.push(`${filters.baths}+ baths`);
  if (filters.type && TYPE_LABEL[filters.type]) parts.push(TYPE_LABEL[filters.type]);
  return parts.length ? parts.join(" · ") : "All Northern Colorado";
}

export default function SaveSearchModal({ filters = {}, buttonLabel = "Save this search", buttonClassName = "", buttonStyle = {} }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [sendTime, setSendTime] = useState("06:00");
  const [sendDay, setSendDay] = useState("Monday");
  const [state, setState] = useState("idle"); // idle | saving | done | error
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const emailStr = email.trim();
    if (!emailStr || !emailStr.includes("@")) {
      setError("Please enter a valid email so we can send your alerts.");
      return;
    }
    setState("saving");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailStr, phone: phone.trim(), name: name.trim() || "My Search", frequency, send_time: sendTime, send_day: sendDay, ...filters }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not save");
      setState("done");
    } catch (err) {
      setState("error");
      setError(err.message || "Something went wrong — please try again.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName || "px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold hover:border-black transition-colors bg-white text-gray-900"}
        style={buttonStyle}
      >
        🔔 {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            {state === "done" ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-gray-900">Search saved!</h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  We'll email you when new homes match{" "}
                  <span className="font-semibold text-gray-900">{filterSummary(filters)}</span> —
                  including <strong>price drops</strong> and status changes.
                </p>
                <p className="text-gray-500 mt-3 text-xs">
                  Schwartz and Associates · (970) 999-1407 · Unsubscribe anytime from any email.
                </p>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setState("idle"); setEmail(""); setName(""); }}
                  className="mt-5 w-full py-3 bg-[#CFB36E] text-black font-semibold rounded-lg hover:bg-[#bd9f5a]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900">Save this search</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Get emailed when new homes match:{" "}
                  <span className="font-semibold text-gray-900">{filterSummary(filters)}</span>
                </p>
                <form onSubmit={submit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(970) 555-0123"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">So we can reach you when a great match hits the market.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name this search <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Fort Collins 3-bed"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">How often should we email you?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(FREQ_LABEL).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFrequency(value)}
                          className={`px-2 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                            frequency === value ? "bg-black text-white border-black" : "border-gray-300 text-gray-600 hover:border-black"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {frequency === "weekly" && (
                      <select
                        value={sendDay}
                        onChange={(e) => setSendDay(e.target.value)}
                        className="mt-2 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black outline-none"
                        aria-label="Day of week"
                      >
                        {DAYS.map((d) => <option key={d} value={d}>{d}s</option>)}
                      </select>
                    )}
                    {frequency !== "immediate" && (
                      <select
                        value={sendTime}
                        onChange={(e) => setSendTime(e.target.value)}
                        className="mt-2 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black outline-none"
                        aria-label="Time of day"
                      >
                        {HOURS.map((h) => {
                          const [hh] = h.split(":");
                          const hour12 = hh % 12 === 0 ? 12 : hh % 12;
                          const ampm = hh < 12 ? "AM" : "PM";
                          return <option key={h} value={h}>{hour12}:00 {ampm} (Mountain)</option>;
                        })}
                      </select>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5">
                      {frequency === "immediate"
                        ? "Price drops & new listings email you the moment they hit."
                        : frequency === "weekly"
                        ? `We'll email you every ${sendDay} at the time above.`
                        : `We'll email you every day at the time above.`}
                    </p>
                  </div>
                  {error && <p className="text-red-600 text-sm">{error}</p>}
                  <button
                    type="submit"
                    disabled={state === "saving"}
                    className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {state === "saving" ? "Saving…" : "Save & get alerts"}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    No spam. No sharing your info. Unsubscribe with one click.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
