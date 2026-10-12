import React, { useEffect, useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const displayPhone = (p) => {
  const d = String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

/**
 * "Call today": the same brief agents get by email at 7am, live. Each lead
 * shows what they did since yesterday morning and a first line to open with.
 */
export default function TodayBrief({ token }) {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/agent/brief`, { headers })
      .then((r) => r.json())
      .then((d) => (d?.success ? setBrief(d.data) : setError(d?.error || "Could not load today's calls.")))
      .catch(() => setError("Could not load today's calls."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleEmail = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/agent/brief`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ email: !brief.email_on }),
      });
      const d = await res.json();
      if (d?.success) setBrief((b) => ({ ...b, email_on: d.data.email_on }));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!brief) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm" aria-labelledby="today-brief-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="today-brief-heading" className="text-lg font-bold text-gray-900">Call today</h2>
          <p className="text-xs text-gray-500">From what your leads did since yesterday morning, plus follow-ups due.</p>
        </div>
        {brief.email_on !== null && (
          <label className="flex items-center gap-2 text-xs text-gray-600 min-h-[32px]">
            <input type="checkbox" checked={brief.email_on} onChange={toggleEmail} disabled={saving} className="accent-[#CFB36E]" />
            Email me this at 7am
          </label>
        )}
      </div>

      {brief.items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">Nobody needs a call yet today. New activity shows up here as it happens.</p>
      ) : (
        <ol className="mt-3 divide-y divide-gray-100">
          {brief.items.map((it, i) => (
            <li key={it.lead_id} className="py-3 flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {it.name}
                  {it.phone && (
                    <a href={`tel:${it.phone}`} className="ml-2 font-normal text-gray-600 underline">{displayPhone(it.phone)}</a>
                  )}
                </p>
                <p className="text-sm text-gray-600">{it.reasons.join(" · ")}</p>
                <p className="text-sm text-[#8a7340]">Try: {it.opener}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {brief.more > 0 && <p className="mt-2 text-xs text-gray-500">{brief.more} more below in your pipeline.</p>}
    </section>
  );
}
