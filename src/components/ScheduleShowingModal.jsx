import React, { useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM",
];

function nextDays(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i += 1) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    out.push(day);
  }
  return out;
}

const fmtDate = (d) => d.toISOString().split("T")[0];
const fmtLabel = (d) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function ScheduleShowingModal({ listing = {}, buttonClassName = "", buttonLabel = "Schedule a Showing" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState("idle"); // idle | saving | done | error
  const [error, setError] = useState("");

  const address = [listing.street_number, listing.street_name, listing.unit && `#${listing.unit}`, listing.city]
    .filter(Boolean).join(" ");

  const submit = async (e) => {
    e.preventDefault();
    if (!date || !time) {
      setError("Please pick a date and time.");
      return;
    }
    setState("saving");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/showing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), phone: phone.trim(), date, time,
          message: message.trim(), listing_slug: listing.slug, listing_address: address,
          source_page: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not submit");
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
        className={buttonClassName || "px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"}
      >
        📅 {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 my-8" onClick={(e) => e.stopPropagation()}>
            {state === "done" ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-xl font-bold text-gray-900">Showing requested!</h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  We'll confirm your showing of{" "}
                  <span className="font-semibold text-gray-900">{address}</span> for{" "}
                  <span className="font-semibold text-gray-900">
                    {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at {time}
                  </span>
                  .
                </p>
                <p className="text-gray-500 mt-3 text-sm">
                  Adam or Mandi will reach out shortly to confirm. Need it sooner? Call{" "}
                  <a href="tel:+19709991407" className="underline font-semibold">(970) 999-1407</a>.
                </p>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setState("idle"); setName(""); setEmail(""); setPhone(""); setDate(""); setTime(""); setMessage(""); }}
                  className="mt-5 w-full py-3 bg-[#CFB36E] text-black font-semibold rounded-lg hover:bg-[#bd9f5a]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900">Schedule a Showing</h3>
                <p className="text-gray-500 text-sm mt-1">
                  <span className="font-semibold text-gray-900">{address}</span>
                  {listing.list_price != null && ` — $${Number(listing.list_price).toLocaleString()}`}
                </p>
                <form onSubmit={submit} className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text" required value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="(970) 555-0123"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {nextDays(7).map((d) => (
                          <button
                            key={fmtDate(d)}
                            type="button"
                            onClick={() => setDate(fmtDate(d))}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold ${
                              date === fmtDate(d) ? "bg-black text-white border-black" : "border-gray-300 text-gray-600 hover:border-black"
                            }`}
                          >
                            {fmtLabel(d)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <select
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black outline-none"
                        aria-label="Time"
                      >
                        <option value="">Pick a time</option>
                        {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Questions? <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={message} onChange={(e) => setMessage(e.target.value)}
                      rows={2} placeholder="e.g. Is the basement finished? Can we bring the kids?"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm"
                    />
                  </div>
                  {error && <p className="text-red-600 text-sm">{error}</p>}
                  <button
                    type="submit"
                    disabled={state === "saving"}
                    className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    {state === "saving" ? "Requesting…" : "Request this showing"}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    No obligation. We'll confirm availability with the listing agent.
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
