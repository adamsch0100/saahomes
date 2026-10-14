import React, { useCallback, useEffect, useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATUS_STYLE = {
  scheduled: "bg-emerald-50 text-emerald-800",
  watching: "bg-blue-50 text-blue-800",
  off_by_agent: "bg-gray-100 text-gray-500",
  off_by_client: "bg-gray-100 text-gray-500",
  not_set_up: "bg-amber-50 text-amber-900",
  no_consent: "bg-gray-100 text-gray-500",
};
const STATUS_WORD = {
  scheduled: "Scheduled",
  watching: "Watching",
  off_by_agent: "Off",
  off_by_client: "Unsubscribed",
  not_set_up: "Needs setup",
  no_consent: "No consent",
};
const PLAN_STATUSES = [
  ["preparing", "Getting ready"],
  ["listed", "On the market"],
  ["under_contract", "Under contract"],
  ["closed", "Sold"],
  ["withdrawn", "Paused"],
];
const OFFER_STATUSES = ["active", "countered", "accepted", "declined", "withdrawn"];

const shortDate = (s) => {
  if (!s) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? new Date(`${s}T12:00:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const money = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US")}`);
const input = "min-h-[36px] rounded-lg border border-gray-300 px-2 text-sm";

function useApi(token) {
  return useCallback(
    async (method, path, body) => {
      const res = await fetch(`${API_BASE}/api/agent${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || "Request failed");
      return d.data;
    },
    [token]
  );
}

// ───────────────────────────────────────────── Stay in touch

function PreviewModal({ preview, onClose }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Email preview" onClick={onClose}>
      <div className="w-full sm:max-w-2xl h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <p className="min-w-0 truncate text-sm"><span className="text-gray-500">Subject:</span> <strong>{preview.subject}</strong></p>
          <button type="button" onClick={onClose} className="min-w-[40px] min-h-[40px] text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close preview">×</button>
        </div>
        <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="flex-1 w-full bg-gray-100" />
      </div>
    </div>
  );
}

function BirthdayTemplate({ api }) {
  const [t, setT] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api("GET", "/stay/template").then(setT).catch(() => {});
  }, [api]);
  if (!t) return null;
  const save = async (approve) => {
    setMsg("");
    try {
      setT(await api("PUT", "/stay/template", { subject: t.subject, body: t.body, approve }));
      setMsg(approve ? "Approved. Birthday notes will go out from you." : "Saved as a draft.");
    } catch (e) {
      setMsg(e.message);
    }
  };
  return (
    <details className="rounded-xl border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">
        Your birthday note{" "}
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${t.approved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {t.approved ? "Approved" : "Not approved yet"}
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        <input value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} className={`${input} w-full`} aria-label="Subject" />
        <textarea value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} rows={5} className="w-full rounded-lg border border-gray-300 p-2 text-sm" aria-label="Note" />
        <p className="text-xs text-gray-500">You can use {t.placeholders.join(", ")}. Nothing goes out until you approve it.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => save(true)} className="min-h-[36px] px-3 rounded-lg bg-black text-white text-sm font-semibold">Approve and use</button>
          <button type="button" onClick={() => save(false)} className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-sm font-semibold">Save draft</button>
          {msg && <span className="self-center text-xs text-gray-600">{msg}</span>}
        </div>
      </div>
    </details>
  );
}

function TaxSetting({ api }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api("GET", "/stay/settings").then(setS).catch(() => {});
  }, [api]);
  if (!s) return null;
  if (!s.can_edit) {
    return (
      <p className="text-xs text-gray-500">
        Tax season note: {s.tax_enabled && s.tax_month ? `sent in ${MONTHS[s.tax_month - 1]}` : "off (your brokerage owner can turn it on)"}.
        {s.rate_source ? "" : " Rate watch: no rate source connected."}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
      <label htmlFor="tax-month">Tax season note goes out in</label>
      <select
        id="tax-month"
        value={s.tax_enabled && s.tax_month ? s.tax_month : ""}
        onChange={async (e) => {
          setMsg("");
          try {
            setS(await api("PUT", "/stay/settings", { tax_month: e.target.value ? Number(e.target.value) : null }));
            setMsg("Saved");
          } catch (err) {
            setMsg(err.message);
          }
        }}
        className={input}
      >
        <option value="">Off</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      {!s.rate_source && <span className="text-xs text-gray-500">Rate watch is off: no rate source connected.</span>}
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}

function StayRow({ item, api, onItem, onPreview }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(item.closing.agent_note || "");
  const [busy, setBusy] = useState(false);
  const patch = async (body) => {
    setBusy(true);
    try {
      const d = await api("PATCH", `/stay/${item.user_id}`, body);
      onItem({ ...item, closing: d.closing, plan: d.plan });
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 text-left" aria-expanded={open}>
          <p className="font-semibold text-gray-900">
            {item.name}
            {item.seller_score >= 35 && (
              <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-800" title={(item.seller_reasons || []).join("\n")}>
                Might sell · {item.seller_score}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {item.closing.side === "seller" ? "Sold" : "Bought"} {item.closing.address_line} · {shortDate(item.closing.close_date)}
          </p>
        </button>
        <p className="text-xs text-gray-600 text-right">
          {item.next ? <>Next: <strong>{item.next.label}</strong> {shortDate(item.next.next_on)}</> : item.closing.stay_in_touch ? "Nothing scheduled" : "No consent to email"}
        </p>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {item.plan.map((p) => (
              <li key={p.kind} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {p.label}{" "}
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[p.status] || ""}`}>{STATUS_WORD[p.status] || p.status}</span>
                  </p>
                  <p className="text-xs text-gray-500">{[p.next_on && `Next ${shortDate(p.next_on)}`, p.detail].filter(Boolean).join(" · ") || p.help}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onPreview(item, p.kind)} className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-xs font-semibold">Preview</button>
                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={p.status !== "off_by_agent"}
                      disabled={busy}
                      onChange={(e) => patch({ kind: p.kind, on: e.target.checked })}
                      className="h-4 w-4 accent-[color:var(--brand-accent)]"
                    />
                    On
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A line for their anniversary report (optional)" className={`${input} flex-1`} aria-label="Personal note" />
            <button type="button" disabled={busy} onClick={() => patch({ agent_note: note })} className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-sm font-semibold">Save note</button>
          </div>
        </div>
      )}
    </li>
  );
}

function StayInTouch({ api }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    api("GET", "/stay").then(setData).catch((e) => setError(e.message));
  }, [api]);
  const openPreview = async (item, kind) => {
    try {
      setPreview(await api("GET", `/stay/${item.user_id}/preview/${kind}`));
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Past clients who said yes to hearing from you. Each email is in your brand and has its own unsubscribe link; turn any kind off for one client here.
      </p>
      <TaxSetting api={api} />
      <BirthdayTemplate api={api} />
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {!data ? (
        <div className="h-24 animate-pulse rounded-xl bg-gray-50" />
      ) : data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No closings yet. When you set a client to Closed, add their closing details and they show up here.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.items.map((it) => (
            <StayRow
              key={it.user_id}
              item={it}
              api={api}
              onPreview={openPreview}
              onItem={(next) => setData({ ...data, items: data.items.map((x) => (x.user_id === next.user_id ? next : x)) })}
            />
          ))}
        </ul>
      )}
      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ───────────────────────────────────────────── Sellers

function OfferForm({ onAdd }) {
  const [f, setF] = useState({ price: "", financing: "Conventional", down_payment_pct: "", earnest_money: "", seller_credit: "", close_date: "", contingencies: "", expires_at: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd(f)) setF({ ...f, price: "", down_payment_pct: "", earnest_money: "", seller_credit: "", contingencies: "", expires_at: "" });
      }}
    >
      <input required value={f.price} onChange={set("price")} placeholder="Price" inputMode="numeric" className={input} aria-label="Offer price" />
      <select value={f.financing} onChange={set("financing")} className={input} aria-label="Financing">
        {["Conventional", "FHA", "VA", "Cash", "USDA", "Other"].map((x) => <option key={x}>{x}</option>)}
      </select>
      <input value={f.down_payment_pct} onChange={set("down_payment_pct")} placeholder="Down %" inputMode="decimal" className={input} aria-label="Down payment percent" />
      <input value={f.earnest_money} onChange={set("earnest_money")} placeholder="Earnest $" inputMode="numeric" className={input} aria-label="Earnest money" />
      <input value={f.seller_credit} onChange={set("seller_credit")} placeholder="Seller credit $" inputMode="numeric" className={input} aria-label="Seller credit" />
      <input type="date" value={f.close_date} onChange={set("close_date")} className={input} aria-label="Closing date" />
      <input type="datetime-local" value={f.expires_at} onChange={set("expires_at")} className={input} aria-label="Expires" />
      <input value={f.contingencies} onChange={set("contingencies")} placeholder="Conditions" className={`${input} col-span-2 sm:col-span-1`} aria-label="Conditions" />
      <button type="submit" className="col-span-2 sm:col-span-4 min-h-[36px] rounded-lg bg-black text-white text-sm font-semibold">Add offer</button>
    </form>
  );
}

function PlanEditor({ planId, api, onClose }) {
  const [plan, setPlan] = useState(null);
  const [msg, setMsg] = useState("");
  const [cmaSummary, setCmaSummary] = useState("");
  const [fb, setFb] = useState({ shown_on: "", interest: "", feedback: "" });
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    api("GET", `/sellers/${planId}`).then((p) => {
      setPlan(p);
      setCmaSummary(p.cma.summary || "");
    }).catch((e) => setMsg(e.message));
  }, [api, planId]);

  const run = async (method, path, body, ok) => {
    setMsg("");
    try {
      const p = await api(method, path, body);
      setPlan(p);
      if (ok) setMsg(ok);
      return true;
    } catch (e) {
      setMsg(e.message);
      return false;
    }
  };
  const patch = (body, ok = "Saved") => run("PATCH", `/sellers/${planId}`, body, ok);

  if (!plan) return <div className="h-32 animate-pulse rounded-xl bg-gray-50" />;
  const setItem = (i, changes) => patch({ checklist: plan.checklist.map((x, j) => (j === i ? { ...x, ...changes } : x)) });

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-900">{plan.address_line || "Selling plan"}</p>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-600 underline">Close</button>
      </div>
      {msg && <p className="text-xs text-gray-600" role="status">{msg}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-xs text-gray-600">Status
          <select value={plan.status} onChange={(e) => patch({ status: e.target.value })} className={`${input} mt-1 w-full`}>
            {PLAN_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">List price
          <input defaultValue={plan.list_price || ""} onBlur={(e) => e.target.value !== String(plan.list_price || "") && patch({ list_price: e.target.value })} inputMode="numeric" className={`${input} mt-1 w-full`} />
        </label>
        <label className="text-xs text-gray-600">MLS number (once listed)
          <input defaultValue={plan.listing_key || ""} onBlur={(e) => e.target.value !== (plan.listing_key || "") && patch({ listing_key: e.target.value })} className={`${input} mt-1 w-full`} />
        </label>
      </div>

      <section>
        <h4 className="text-sm font-bold text-gray-900">Market analysis</h4>
        <p className="text-xs text-gray-500">
          {plan.cma.ready_at ? `Shared ${shortDate(plan.cma.ready_at)}` : plan.cma.requested_at ? `Requested ${shortDate(plan.cma.requested_at)}${plan.cma.note ? ` · "${plan.cma.note}"` : ""}` : "Not requested yet."}
        </p>
        <textarea value={cmaSummary} onChange={(e) => setCmaSummary(e.target.value)} rows={3} placeholder="Suggested range and the key comparable sales, in plain words" className="mt-2 w-full rounded-lg border border-gray-300 p-2 text-sm" />
        <button type="button" onClick={() => patch({ cma_ready: true, cma_summary: cmaSummary }, "Shared with your client")} className="mt-1 min-h-[36px] px-3 rounded-lg bg-black text-white text-sm font-semibold">
          {plan.cma.ready_at ? "Update what they see" : "Mark ready and share"}
        </button>
      </section>

      <section>
        <h4 className="text-sm font-bold text-gray-900">Timeline</h4>
        <ul className="mt-2 space-y-1.5">
          {plan.timeline.map((t, i) => (
            <li key={t.key} className="flex flex-wrap items-center gap-2">
              <input type="checkbox" checked={t.done} onChange={(e) => patch({ timeline: plan.timeline.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} className="h-4 w-4 accent-[color:var(--brand-accent)]" aria-label={`${t.label} done`} />
              <span className="flex-1 min-w-[140px] text-sm">{t.label}</span>
              <input type="date" value={t.date || ""} onChange={(e) => patch({ timeline: plan.timeline.map((x, j) => (j === i ? { ...x, date: e.target.value || null } : x)) })} className={input} aria-label={`${t.label} date`} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-bold text-gray-900">Prep list</h4>
        <ul className="mt-2 space-y-1.5">
          {plan.checklist.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <span className={`flex-1 min-w-[160px] text-sm ${c.done ? "line-through text-gray-400" : ""}`}>{c.title}</span>
              <select value={c.decision} onChange={(e) => setItem(i, { decision: e.target.value })} className={input} aria-label={`${c.title}: fix or skip`}>
                <option value="fix">Fix</option>
                <option value="consider">Consider</option>
                <option value="skip">Skip</option>
              </select>
              <button type="button" onClick={() => patch({ checklist: plan.checklist.filter((_, j) => j !== i) })} className="min-h-[36px] px-2 text-xs text-gray-500 underline" aria-label={`Remove ${c.title}`}>Remove</button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newItem.trim()) return;
            if (await patch({ checklist: [...plan.checklist, { title: newItem.trim(), decision: "fix" }] })) setNewItem("");
          }}
        >
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item for this home" className={`${input} flex-1`} />
          <button type="submit" className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-sm font-semibold">Add</button>
        </form>
      </section>

      <section>
        <h4 className="text-sm font-bold text-gray-900">Showing feedback</h4>
        <p className="text-xs text-gray-500">{plan.showings.length} showing request{plan.showings.length === 1 ? "" : "s"} on record. Your client sees dates only, never who.</p>
        <ul className="mt-2 space-y-1">
          {plan.feedback.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-2 text-sm">
              <span><span className="text-xs text-gray-500">{shortDate(f.shown_on)}{f.interest ? ` · ${f.interest}` : ""}</span> {f.feedback}</span>
              <button type="button" onClick={() => run("DELETE", `/sellers/${planId}/feedback/${f.id}`)} className="text-xs text-gray-500 underline">Remove</button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("POST", `/sellers/${planId}/feedback`, fb, "Feedback added")) setFb({ shown_on: "", interest: "", feedback: "" });
          }}
        >
          <input type="date" value={fb.shown_on} onChange={(e) => setFb({ ...fb, shown_on: e.target.value })} className={input} aria-label="Shown on" />
          <select value={fb.interest} onChange={(e) => setFb({ ...fb, interest: e.target.value })} className={input} aria-label="Interest">
            <option value="">Interest</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input required value={fb.feedback} onChange={(e) => setFb({ ...fb, feedback: e.target.value })} placeholder="What they said" className={`${input} col-span-2`} />
          <button type="submit" className="col-span-2 sm:col-span-4 min-h-[36px] rounded-lg border border-gray-300 text-sm font-semibold">Add feedback</button>
        </form>
      </section>

      <section>
        <h4 className="text-sm font-bold text-gray-900">Offers</h4>
        {plan.offers.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {plan.offers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                <strong className="w-20">{o.label}</strong>
                <span className="tabular-nums">{money(o.price)}</span>
                <span className="text-gray-500">{o.financing || ""}</span>
                <select value={o.status} onChange={(e) => run("PATCH", `/sellers/${planId}/offers/${o.id}`, { status: e.target.value }, "Saved")} className={input} aria-label={`${o.label} status`}>
                  {OFFER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => run("DELETE", `/sellers/${planId}/offers/${o.id}`)} className="text-xs text-gray-500 underline">Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <OfferForm onAdd={(f) => run("POST", `/sellers/${planId}/offers`, f, "Offer added. Your client sees it side by side.")} />
        </div>
        <p className="mt-1 text-xs text-gray-500">Only this seller sees their offers. Buyer names are never shown.</p>
      </section>
    </div>
  );
}

function Sellers({ api }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const load = useCallback(() => api("GET", "/sellers").then(setRows).catch((e) => setError(e.message)), [api]);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!rows) return <div className="h-24 animate-pulse rounded-xl bg-gray-50" />;
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        No sellers yet. Use “Selling” on a lead, or clients can start a plan from My Home.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {rows.map((r) => (
        <li key={r.id} className="py-3">
          <button type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)} className="w-full text-left" aria-expanded={openId === r.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-gray-900">
                {r.name}
                {r.cma_waiting && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">Market analysis requested</span>}
                {r.open_offers > 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">{r.open_offers} open offer{r.open_offers === 1 ? "" : "s"}</span>}
              </p>
              <p className="text-xs text-gray-500">{PLAN_STATUSES.find(([v]) => v === r.status)?.[1] || r.status}{r.next_step ? ` · ${r.next_step.label} ${shortDate(r.next_step.date)}` : ""}</p>
            </div>
            <p className="text-xs text-gray-500">{r.address || "Address to add"}{r.list_price ? ` · ${money(r.list_price)}` : ""}</p>
          </button>
          {openId === r.id && (
            <div className="mt-3">
              <PlanEditor planId={r.id} api={api} onClose={() => { setOpenId(null); load(); }} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * After the search: past clients we stay in touch with, and homeowners
 * working toward a sale. Lives next to the cockpit on the agent and owner
 * consoles; every request is scoped to the leads this person can see.
 */
export default function ClientLifePanel({ token }) {
  const api = useApi(token);
  const [tab, setTab] = useState("stay");
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">After the search</h2>
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5" role="tablist">
          {[
            ["stay", "Stay in touch"],
            ["sellers", "Sellers"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-[36px] px-3 rounded-md text-sm font-semibold ${tab === k ? "bg-black text-white" : "text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">{tab === "stay" ? <StayInTouch api={api} /> : <Sellers api={api} />}</div>
    </section>
  );
}
