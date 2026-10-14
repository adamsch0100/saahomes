import React, { useEffect, useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const EMPTY = {
  side: "buyer",
  address_line: "",
  city: "",
  state: "CO",
  postal_code: "",
  close_date: "",
  close_price: "",
  loan_amount: "",
  loan_rate: "",
  loan_years: "30",
  birthday: "",
  stay_in_touch: false,
  target_rate: "",
  agent_note: "",
};

const field = "w-full min-h-[40px] rounded-lg border border-gray-300 px-3 text-sm";
const toForm = (c) =>
  Object.fromEntries(Object.entries({ ...EMPTY, ...c }).map(([k, v]) => [k, v == null ? EMPTY[k] : typeof v === "boolean" ? v : String(v)]));

/**
 * When an agent marks a client closed: capture the closing facts that power
 * "stay in touch" (anniversary report, neighbor sales, birthday, tax and rate
 * notes). Saving also marks the lead closed. Skipping just marks it closed.
 */
export default function ClosingFactsDialog({ lead, token, onDone, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    let off = false;
    fetch(`${API_BASE}/api/agent/clients/${lead.id}/closing`, { headers })
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (d?.success) setForm(toForm(d.data.closing || d.data.prefill || {}));
      })
      .catch(() => {})
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, token]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/agent/clients/${lead.id}/closing`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...form, birthday: form.birthday || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Could not save.");
      onDone({ saved: true, closing: d.data.closing });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="closing-title" onClick={onCancel}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="closing-title" className="text-lg font-bold text-gray-900">Closed with {lead.name || lead.email}</h3>
            <p className="text-sm text-gray-500 mt-0.5">These details power the notes they get from you after closing.</p>
          </div>
          <button type="button" onClick={onCancel} className="min-w-[40px] min-h-[40px] text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close">×</button>
        </div>

        {loading ? (
          <div className="mt-6 h-48 animate-pulse rounded-xl bg-gray-50" />
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex gap-2" role="radiogroup" aria-label="They">
              {[
                ["buyer", "Bought a home"],
                ["seller", "Sold a home"],
              ].map(([v, label]) => (
                <label key={v} className={`flex-1 min-h-[40px] inline-flex items-center justify-center rounded-lg border text-sm font-semibold cursor-pointer ${form.side === v ? "bg-black text-white border-black" : "border-gray-300 text-gray-700"}`}>
                  <input type="radio" name="side" value={v} checked={form.side === v} onChange={set("side")} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid grid-cols-6 gap-2">
              <label className="col-span-6 text-xs font-medium text-gray-700">
                {form.side === "seller" ? "Home they sold" : "Their new home"}
                <input required value={form.address_line} onChange={set("address_line")} placeholder="Street address" className={`${field} mt-1`} />
              </label>
              <input aria-label="City" value={form.city} onChange={set("city")} placeholder="City" className={`${field} col-span-3`} />
              <input aria-label="State" value={form.state} onChange={set("state")} placeholder="ST" maxLength={2} className={`${field} col-span-1`} />
              <input aria-label="ZIP" value={form.postal_code} onChange={set("postal_code")} placeholder="ZIP" inputMode="numeric" className={`${field} col-span-2`} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-gray-700">
                Closing date
                <input required type="date" value={form.close_date} onChange={set("close_date")} className={`${field} mt-1`} />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Price
                <input value={form.close_price} onChange={set("close_price")} inputMode="numeric" placeholder="525000" className={`${field} mt-1`} />
              </label>
            </div>

            {form.side === "buyer" && (
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs font-medium text-gray-700">
                  Loan amount
                  <input value={form.loan_amount} onChange={set("loan_amount")} inputMode="numeric" placeholder="420000" className={`${field} mt-1`} />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  Rate %
                  <input value={form.loan_rate} onChange={set("loan_rate")} inputMode="decimal" placeholder="6.25" className={`${field} mt-1`} />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  Years
                  <input value={form.loan_years} onChange={set("loan_years")} inputMode="numeric" className={`${field} mt-1`} />
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-gray-700">
                Birthday (optional)
                <input
                  value={form.birthday}
                  onChange={set("birthday")}
                  placeholder="MM-DD"
                  pattern="\d{1,2}-\d{1,2}"
                  className={`${field} mt-1`}
                />
              </label>
              <label className="text-xs font-medium text-gray-700">
                Rate to watch for (optional)
                <input value={form.target_rate} onChange={set("target_rate")} inputMode="decimal" placeholder="5.5" className={`${field} mt-1`} />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              <input type="checkbox" checked={!!form.stay_in_touch} onChange={set("stay_in_touch")} className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--brand-accent)]" />
              <span>
                <strong>They said yes to staying in touch.</strong>
                <span className="block text-xs text-gray-500 mt-0.5">A few emails a year about their home. Every email has an unsubscribe link, and you can turn off any kind for them.</span>
              </span>
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Note for yourself (optional)
              <textarea value={form.agent_note} onChange={set("agent_note")} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm" placeholder="Kids' names, the dog, what they loved about the house…" />
            </label>

            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" onClick={() => onDone({ saved: false })} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700">
                Mark closed without details
              </button>
              <button type="submit" disabled={saving} className="min-h-[44px] px-5 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-60">
                {saving ? "Saving…" : "Save and mark closed"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
