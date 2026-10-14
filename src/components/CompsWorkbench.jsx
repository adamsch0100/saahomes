import React, { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const fmt = (v) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);
const pct = (p) => `${p > 0 ? "+" : ""}${Math.round(p * 1000) / 10}%`;
const day = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "");

/**
 * "Build your own value": the owner picks which recent sales are like their
 * home and says what shape it's in; the number updates as they go and is saved.
 */
export default function CompsWorkbench({ homeId, authQ = "" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!homeId) return;
    setData(null);
    fetch(`${API_BASE}/api/home/${homeId}/comps${authQ}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => (d?.success ? setData(d.data) : setError(d?.error || "Could not load recent sales.")))
      .catch(() => setError("Could not load recent sales."));
  }, [homeId, authQ]);

  const save = useCallback(
    (next) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSaving(true);
        try {
          const res = await fetch(`${API_BASE}/api/home/${homeId}/comps${authQ}`, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              included: next.comps.filter((c) => c.included).map((c) => c.id),
              condition: next.condition,
              upgrades: next.upgrades,
            }),
          });
          const d = await res.json();
          if (d?.success) setData(d.data);
          else setError(d?.error || "Could not save.");
        } catch {
          setError("Could not save.");
        } finally {
          setSaving(false);
        }
      }, 450);
    },
    [homeId, authQ]
  );

  const update = (patch) => {
    const next = { ...data, ...patch };
    setData(next);
    save(next);
  };

  if (error && !data) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return null;
  if (!data.comps.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <p className="text-sm text-gray-600">We don&apos;t have enough recent sales near you to build your own value yet.</p>
      </div>
    );
  }

  const est = data.estimate;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" aria-label="Build your own value">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Build your own value</p>
          <h3 className="text-lg font-bold text-gray-900 mt-0.5">Pick the sales that are most like your home</h3>
        </div>
        <div className="text-right" aria-live="polite">
          <p className="text-2xl font-bold text-gray-900">{est ? fmt(est.mid) : "Pick a sale"}</p>
          {est && <p className="text-xs text-gray-500">{fmt(est.low)} – {fmt(est.high)}{saving ? " · saving…" : data.saved_at ? " · saved" : ""}</p>}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-gray-100">
        {data.comps.map((c) => (
          <li key={c.id}>
            <label className="flex items-start gap-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={c.included}
                onChange={() => update({ comps: data.comps.map((x) => (x.id === c.id ? { ...x, included: !x.included } : x)) })}
                className="mt-1 w-4 h-4 accent-[color:var(--brand-accent)]"
              />
              <span className="flex-1 min-w-0">
                <span className="flex justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{c.address}</span>
                  <span className="text-sm font-bold text-gray-900 shrink-0">{fmt(c.sold_price)}</span>
                </span>
                <span className="block text-xs text-gray-500">
                  Sold {day(c.closed_date)} · {[c.beds != null && `${c.beds} bd`, c.baths != null && `${c.baths} ba`, c.living_area && `${Number(c.living_area).toLocaleString()} sqft`].filter(Boolean).join(" · ")}
                  {c.price_per_sqft ? ` · $${c.price_per_sqft}/sqft` : ""}
                </span>
                {c.notes?.length > 0 && (
                  <span className="block text-xs text-gray-400">
                    Adjusted to your home ({c.notes.join(", ")}): about {fmt(Math.round(c.adjusted / 1000) * 1000)}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900">What shape is your home in?</legend>
          <div className="mt-2 space-y-1">
            {data.options.conditions.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-gray-700 min-h-[32px]">
                <input
                  type="radio"
                  name={`cond-${homeId}`}
                  checked={data.condition === o.value}
                  onChange={() => update({ condition: o.value })}
                  className="accent-[color:var(--brand-accent)]"
                />
                {o.label}
                {o.pct !== 0 && <span className="text-xs text-gray-400">{pct(o.pct)}</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900">Upgrades</legend>
          <div className="mt-2 space-y-1">
            {data.options.upgrades.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-gray-700 min-h-[32px]">
                <input
                  type="checkbox"
                  checked={data.upgrades.includes(o.value)}
                  onChange={() =>
                    update({
                      upgrades: data.upgrades.includes(o.value)
                        ? data.upgrades.filter((u) => u !== o.value)
                        : [...data.upgrades, o.value],
                    })
                  }
                  className="accent-[color:var(--brand-accent)]"
                />
                {o.label}
                <span className="text-xs text-gray-400">{pct(o.pct)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="mt-4 text-[11px] text-gray-500 leading-relaxed">
        Each sale is adjusted to your home&apos;s size, bedrooms and bathrooms with simple rules of thumb, then condition and
        upgrades move the result (upgrades count for up to 8%). Sales from the last 12 months in{" "}
        {data.scope === "zip" ? "your ZIP code" : "your city"}. This is an estimate you built, not an appraisal; your agent can
        walk through it with you.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
