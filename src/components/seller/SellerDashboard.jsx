import React, { useState } from "react";
import { formatPrice } from "../../utils/listingHelpers.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const DECISIONS = [
  { key: "fix", title: "Worth fixing", sub: "Small things that help photos and first impressions" },
  { key: "consider", title: "Talk it through", sub: "Sometimes worth it — ask your agent" },
  { key: "skip", title: "Skip it", sub: "Rarely pays back before a sale" },
];
const STEPS = ["preparing", "listed", "under_contract", "closed"];
const STEP_LABEL = { preparing: "Getting ready", listed: "On the market", under_contract: "Under contract", closed: "Sold" };
const PART = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const OFFER_STATUS = {
  active: "Open",
  countered: "Countered",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

const shortDate = (s) => {
  if (!s) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? new Date(`${s}T12:00:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const money = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US")}`);

function Card({ title, sub, children, id }) {
  return (
    <section id={id} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm scroll-mt-24">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tick({ item, onTick, busy }) {
  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <input
        type="checkbox"
        id={`chk-${item.id}`}
        checked={!!item.done}
        disabled={busy}
        onChange={(e) => onTick(item.id, e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[color:var(--brand-accent)]"
      />
      <label htmlFor={`chk-${item.id}`} className="min-w-0 cursor-pointer">
        <span className={`block text-sm font-medium ${item.done ? "text-gray-400 line-through" : "text-gray-900"}`}>{item.title}</span>
        {(item.note || item.hint) && <span className="block text-xs text-gray-500 mt-0.5">{item.note || item.hint}</span>}
      </label>
    </li>
  );
}

/**
 * A homeowner's selling plan on My Home: where things stand, the market
 * analysis, what to fix (and skip), and once the home is listed its showings,
 * feedback and offers side by side, then the closing checklist. Agents edit
 * the plan from their console; the owner ticks things off here.
 */
export default function SellerDashboard({ plan, token = "", onPlan, agentLine }) {
  const [cmaNote, setCmaNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const q = token ? `?token=${encodeURIComponent(token)}` : "";

  const call = async (method, path, body) => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/api${path}${q}`, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Could not save.");
      onPlan(d.data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tick = (list) => (id, done) => call("PATCH", `/seller/checklist/${encodeURIComponent(id)}`, { done, list });
  const stepIdx = Math.max(0, STEPS.indexOf(plan.status));
  const listed = ["listed", "under_contract", "closed"].includes(plan.status) || !!plan.listing;
  const closingPhase = ["under_contract", "closed"].includes(plan.status);
  const prepDone = plan.checklist.filter((i) => i.decision !== "skip" && i.done).length;
  const prepTotal = plan.checklist.filter((i) => i.decision !== "skip").length;
  const offers = plan.offers || [];
  const best = offers.filter((o) => o.status === "active" || o.status === "countered").reduce((m, o) => Math.max(m, o.price || 0), 0);
  const price = plan.list_price || plan.listing?.list_price || null;

  return (
    <div>
      {err && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{err}</p>}

      {/* Status + timeline */}
      <section className="mt-6 rounded-2xl bg-[color:var(--brand-primary,#000)] text-white p-5 sm:p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--brand-accent)]">Selling {plan.address_line || "your home"}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold font-serif">{plan.status === "withdrawn" ? "Paused" : STEP_LABEL[plan.status] || plan.status_label}</h2>
          {price ? <p className="text-lg font-semibold text-[color:var(--brand-accent)] tabular-nums">{formatPrice(price)}</p> : null}
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Where things stand">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-0">
              <div className={`h-1.5 rounded-full ${i <= stepIdx ? "bg-[color:var(--brand-accent)]" : "bg-white/20"}`} />
              <p className={`mt-1.5 text-[11px] leading-tight ${i <= stepIdx ? "text-white font-semibold" : "text-white/60"}`}>{STEP_LABEL[s]}</p>
            </li>
          ))}
        </ol>
        {plan.timeline?.length > 0 && (
          <ul className="mt-5 space-y-1.5 text-sm">
            {plan.timeline.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-2 min-w-0 ${t.done ? "text-white/60" : "text-white"}`}>
                  <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${t.done ? "bg-[color:var(--brand-accent)]" : "border border-white/50"}`} />
                  <span className={`truncate ${t.done ? "line-through" : ""}`}>{t.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-white/80">{shortDate(t.date) || "Date to set"}</span>
              </li>
            ))}
          </ul>
        )}
        {agentLine && <p className="mt-4 text-xs text-white/70">{agentLine}</p>}
      </section>

      {/* Market analysis */}
      <Card id="cma" title="Your market analysis" sub="What your home would likely sell for, from recent nearby sales, prepared by your agent.">
        {plan.cma.ready_at ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Ready {shortDate(plan.cma.ready_at)}</p>
            <p className="mt-1 text-sm text-emerald-950 whitespace-pre-line">{plan.cma.summary || "Your agent has it ready. They will walk you through it."}</p>
          </div>
        ) : plan.cma.requested_at ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            Requested {shortDate(plan.cma.requested_at)}. Your agent is pulling recent sales and will reach out, usually within a day.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              call("POST", "/seller/cma", { note: cmaNote.trim() || undefined });
            }}
            className="space-y-3"
          >
            <textarea
              value={cmaNote}
              onChange={(e) => setCmaNote(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Anything we should know? Updates you've made, when you'd like to move…"
              className="w-full rounded-lg border border-gray-300 p-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-lg text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent-ink)" }}
            >
              Ask for my market analysis
            </button>
          </form>
        )}
      </Card>

      {/* Once listed: showings, feedback, offers */}
      {listed && (
        <>
          <Card
            title="Showings"
            sub={plan.showings.length ? `${plan.showings.length} request${plan.showings.length === 1 ? "" : "s"} so far${plan.listing?.days_on_market != null ? ` · ${plan.listing.days_on_market} days on market` : ""}` : "Requests to see your home will show up here."}
          >
            {plan.showings.length > 0 ? (
              <ul className="divide-y divide-gray-100 text-sm">
                {plan.showings.slice(0, 12).map((s, i) => (
                  <li key={`${s.kind}-${i}`} className="flex items-center justify-between py-2">
                    <span className="text-gray-900">{shortDate(s.date) || "Date to confirm"}</span>
                    <span className="text-gray-500">{PART[s.time] || s.time || ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No showings yet.</p>
            )}
          </Card>

          <Card title="What buyers said" sub="Feedback your agent collects after showings.">
            {plan.feedback.length > 0 ? (
              <ul className="space-y-3">
                {plan.feedback.map((f) => (
                  <li key={f.id} className="rounded-xl border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">
                      {shortDate(f.shown_on) || shortDate(f.created_at)}
                      {f.interest ? ` · ${f.interest} interest` : ""}
                    </p>
                    <p className="mt-1 text-sm text-gray-900">{f.feedback}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No feedback yet.</p>
            )}
          </Card>

          <Card title="Offers" sub={offers.length ? "Side by side, so you can compare more than price." : "When offers come in, your agent adds them here."}>
            {offers.length > 0 ? (
              <div className="-mx-5 sm:mx-0 overflow-x-auto px-5 sm:px-0">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-white pr-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" scope="col"><span className="sr-only">Term</span></th>
                      {offers.map((o) => (
                        <th key={o.id} scope="col" className="px-3 py-2 text-left align-bottom min-w-[132px]">
                          <span className="block text-sm font-bold text-gray-900">{o.label || "Offer"}</span>
                          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${o.status === "accepted" ? "bg-emerald-100 text-emerald-800" : o.status === "declined" || o.status === "withdrawn" ? "bg-gray-100 text-gray-500" : "bg-[rgb(var(--brand-accent-rgb)/0.18)] text-gray-900"}`}>
                            {OFFER_STATUS[o.status] || o.status}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["Price", (o) => <strong className={`tabular-nums ${o.price === best ? "text-emerald-700" : "text-gray-900"}`}>{money(o.price)}</strong>],
                      ["Financing", (o) => o.financing || "—"],
                      ["Down payment", (o) => (o.down_payment_pct != null ? `${o.down_payment_pct}%` : "—")],
                      ["Earnest money", (o) => money(o.earnest_money)],
                      ["Asks you to pay", (o) => (o.seller_credit ? money(o.seller_credit) : "Nothing")],
                      ["Net of credits", (o) => <span className="tabular-nums">{money((o.price || 0) - (o.seller_credit || 0))}</span>],
                      ["Closing", (o) => shortDate(o.close_date) || "—"],
                      ["Conditions", (o) => o.contingencies || "—"],
                      ["Expires", (o) => (o.expires_at ? new Date(o.expires_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—")],
                      ["Notes", (o) => o.note || "—"],
                    ].map(([label, cell]) => (
                      <tr key={label}>
                        <th scope="row" className="sticky left-0 bg-white pr-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{label}</th>
                        {offers.map((o) => (
                          <td key={o.id} className={`px-3 py-2 align-top text-gray-800 ${o.status === "declined" || o.status === "withdrawn" ? "opacity-50" : ""}`}>{cell(o)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No offers yet.</p>
            )}
          </Card>
        </>
      )}

      {/* Prep checklist (before and while listed) */}
      {!closingPhase && plan.checklist.length > 0 && (
        <Card id="prep" title="Get it ready" sub={`${prepDone} of ${prepTotal} done. Your agent can tailor this list for your home.`}>
          <div className="space-y-5">
            {DECISIONS.map((d) => {
              const items = plan.checklist.filter((i) => i.decision === d.key);
              if (!items.length) return null;
              return (
                <div key={d.key}>
                  <h3 className="text-sm font-bold text-gray-900">{d.title}</h3>
                  <p className="text-xs text-gray-500">{d.sub}</p>
                  {d.key === "skip" ? (
                    <ul className="mt-2 space-y-1.5">
                      {items.map((i) => (
                        <li key={i.id} className="text-sm text-gray-500">
                          <span className="line-through decoration-gray-300">{i.title}</span>
                          {(i.note || i.hint) && <span className="block text-xs no-underline">{i.note || i.hint}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="mt-1">{items.map((i) => <Tick key={i.id} item={i} onTick={tick("prep")} busy={busy} />)}</ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Closing checklist */}
      {closingPhase && plan.closing_checklist.length > 0 && (
        <Card title="On the way to closing" sub={plan.status === "closed" ? "All done. Congratulations!" : "Tick things off as they happen."}>
          <ul>{plan.closing_checklist.map((i) => <Tick key={i.id} item={i} onTick={tick("closing")} busy={busy} />)}</ul>
        </Card>
      )}
    </div>
  );
}
