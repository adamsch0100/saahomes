import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBrokerageBrand } from "../context/TenantContext.jsx";
import { listingKeyOf } from "../utils/savedHomesApi.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const PARTS = [
  { value: "morning", label: "Morning", sub: "9–12" },
  { value: "afternoon", label: "Afternoon", sub: "12–4" },
  { value: "evening", label: "Evening", sub: "4–7" },
];
const PART_LABEL = { morning: "Morning (9am–12pm)", afternoon: "Afternoon (12–4pm)", evening: "Evening (4–7pm)" };
const MAX_PICKS = 3;

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok && data?.success !== false, status: res.status, data };
}

/**
 * Book a tour of one home: pick up to three times, optionally bring someone,
 * add a note. Signed-in buyers go straight into the tour flow (their agent
 * gets the request); new visitors leave name, email and phone first.
 */
export default function BookTourModal({
  listing = {},
  buttonLabel = "Book a tour",
  buttonClassName = "",
  buttonStyle = {},
  hideIcon = false,
  autoOpen = false,
  hideTrigger = false,
}) {
  const bb = useBrokerageBrand();
  const [open, setOpen] = useState(!!autoOpen);
  const [me, setMe] = useState(undefined); // undefined loading | null guest | { members }
  const [picks, setPicks] = useState([]);
  const [note, setNote] = useState("");
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [phone, setPhone] = useState("");
  const [bringId, setBringId] = useState(null);
  const [withSomeone, setWithSomeone] = useState(false);
  const [co, setCo] = useState({ name: "", email: "", invite: true });
  const [state, setState] = useState("idle"); // idle | saving | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  // The deep-link host (hideTrigger) also answers the old "schedule" event.
  useEffect(() => {
    if (!hideTrigger) return undefined;
    const onOpen = () => setOpen(true);
    window.addEventListener("open-schedule-showing", onOpen);
    window.addEventListener("open-book-tour", onOpen);
    return () => {
      window.removeEventListener("open-schedule-showing", onOpen);
      window.removeEventListener("open-book-tour", onOpen);
    };
  }, [hideTrigger]);

  useEffect(() => {
    if (!open || me !== undefined) return;
    api("GET", "/household").then((r) => {
      if (!r.ok) return setMe(null);
      const others = (r.data?.data?.members || []).filter((m) => !m.you);
      setMe({ others });
      if (others.length === 1) setBringId(others[0].id);
    }).catch(() => setMe(null));
  }, [open, me]);

  const days = useMemo(() => {
    const out = [];
    const start = new Date();
    for (let i = 1; i <= 14; i += 1) out.push(ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    return out;
  }, []);

  const address = [listing.street_number, listing.street_name, listing.unit && `#${listing.unit}`].filter(Boolean).join(" ");
  const place = [address, listing.city].filter(Boolean).join(", ");

  const toggleDay = (date) => {
    setError("");
    setPicks((ps) => {
      if (ps.some((p) => p.date === date)) return ps.filter((p) => p.date !== date);
      if (ps.length >= MAX_PICKS) return ps;
      return [...ps, { date, part: "afternoon" }].sort((a, b) => a.date.localeCompare(b.date));
    });
  };
  const setPart = (date, part) => setPicks((ps) => ps.map((p) => (p.date === date ? { ...p, part } : p)));

  const close = () => {
    setOpen(false);
    if (state === "done") {
      setState("idle");
      setPicks([]);
      setNote("");
      setResult(null);
    }
  };

  const coBuyer = () => {
    if (me?.others?.length && bringId) {
      const m = me.others.find((o) => o.id === bringId);
      return m ? { name: m.name || m.first_name, email: m.email } : null;
    }
    if (withSomeone && (co.name.trim() || co.email.trim())) return { name: co.name.trim(), email: co.email.trim() };
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!picks.length) return setError("Pick at least one day that works.");
    const key = listingKeyOf(listing);
    setState("saving");
    setError("");
    try {
      if (me === null) {
        if (!guest.name.trim() || !guest.email.trim() || !guest.phone.trim()) {
          setState("idle");
          return setError("Add your name, email and phone so your agent can confirm.");
        }
        const s = await api("POST", "/auth/session", { name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim() });
        if (!s.ok) {
          if (s.data?.code !== "sign_in_required") throw new Error(s.data?.error || "Could not send your request.");
          // An existing account: send it as a showing request, and they sign in from the emailed link.
          const extra = picks.slice(1).map((p) => `${dayLabel(p.date)} ${PART_LABEL[p.part]}`);
          const cb = coBuyer();
          const r = await api("POST", "/showing", {
            name: guest.name.trim(), email: guest.email.trim(), phone: guest.phone.trim(),
            date: picks[0].date, time: PART_LABEL[picks[0].part],
            message: [note.trim(), extra.length ? `Other times that work: ${extra.join("; ")}` : null, cb ? `Coming along: ${[cb.name, cb.email].filter(Boolean).join(", ")}` : null].filter(Boolean).join("\n"),
            listing_slug: listing.slug, listing_address: place, source_page: window.location.pathname,
          });
          if (!r.ok) throw new Error(r.data?.error || "Could not send your request.");
          setResult({ signInSent: true });
          setState("done");
          return;
        }
      }
      const cb = coBuyer();
      const r = await api("POST", "/tours", {
        listing_keys: [key],
        windows: picks,
        note: note.trim() || undefined,
        phone: me === null ? guest.phone.trim() : phone.trim() || undefined,
        co_buyer: cb || undefined,
      });
      if (!r.ok) {
        if (r.status === 400 && /phone/i.test(r.data?.error || "")) {
          setState("idle");
          return setError("Add a phone number so your agent can confirm the tour.");
        }
        throw new Error(r.data?.error || "Could not send your request.");
      }
      if (me && !me.others?.length && withSomeone && co.invite && co.email.trim()) {
        api("POST", "/household/invite", { email: co.email.trim(), name: co.name.trim() || undefined }).catch(() => {});
      }
      try { localStorage.setItem("saa_lead_captured", "1"); } catch { /* private mode */ }
      setResult({ tour: r.data.data, invited: !!(me && !me.others?.length && withSomeone && co.invite && co.email.trim()) });
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  const confirmLine = bb
    ? <>Your agent will confirm an exact time.{bb.phone ? <> Need it sooner? Call <a href={bb.tel} className="underline font-semibold">{bb.phone}</a>.</> : null}</>
    : <>Adam or Mandi will confirm an exact time. Need it sooner? Call <a href="tel:+19709991407" className="underline font-semibold">(970) 999-1407</a>.</>;

  const inputCls = "w-full min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-gray-400 outline-none";

  return (
    <>
      {!hideTrigger && (
        <button type="button" onClick={() => setOpen(true)} className={buttonClassName || "px-6 py-3 bg-black text-white font-semibold rounded-lg"} style={buttonStyle}>
          {!hideIcon && <span className="mr-1" aria-hidden="true">📅</span>}
          {buttonLabel}
        </button>
      )}

      {/* Portal: the rail is sticky (its own stacking context), so the dialog renders at the page root. */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-tour-title"
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto p-5 sm:p-7 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="book-tour-title" className="text-xl font-bold text-gray-900">{state === "done" ? "Tour requested" : "Book a tour"}</h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  <span className="font-semibold text-gray-900">{place || "This home"}</span>
                  {listing.list_price != null && ` · $${Number(listing.list_price).toLocaleString()}`}
                </p>
              </div>
              <button type="button" onClick={close} className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 text-gray-400 hover:text-gray-700 text-2xl leading-none" aria-label="Close">×</button>
            </div>

            {state === "done" ? (
              <div className="mt-5">
                <div className="rounded-xl border border-gray-200 p-4">
                  <ul className="space-y-1 text-sm text-gray-800">
                    {picks.map((p) => (
                      <li key={p.date}>{dayLabel(p.date)} · {PART_LABEL[p.part]}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-sm text-gray-700">{confirmLine}</p>
                {result?.signInSent && (
                  <p className="mt-2 text-sm text-gray-600">You already have an account with us, so we emailed you a link to sign in and see your tours.</p>
                )}
                {result?.invited && <p className="mt-2 text-sm text-gray-600">We invited {co.name.trim() || co.email.trim()} to shop with you on your board.</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  {result?.tour?.calendar_url && (
                    <a
                      href={`${API_BASE}${result.tour.calendar_url}`}
                      className="inline-flex items-center min-h-[44px] px-4 rounded-lg text-sm font-bold"
                      style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent-ink)" }}
                    >
                      Add a hold to my calendar
                    </a>
                  )}
                  <button type="button" onClick={close} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-semibold">Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-5">
                <fieldset className="min-w-0">
                  <legend className="text-sm font-semibold text-gray-900">When could you go? <span className="font-normal text-gray-500">Pick up to {MAX_PICKS} days.</span></legend>
                  <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto pb-1 px-1 snap-x" role="group" aria-label="Days">
                    {days.map((d) => {
                      const on = picks.some((p) => p.date === d);
                      const full = !on && picks.length >= MAX_PICKS;
                      const [wd, md] = [new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }), new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })];
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(d)}
                          disabled={full}
                          aria-pressed={on}
                          className={`snap-start shrink-0 w-[64px] min-h-[56px] rounded-lg border text-center transition-colors disabled:opacity-40 ${
                            on ? "border-transparent text-[color:var(--brand-on-accent-ink)]" : "border-gray-300 text-gray-700 hover:border-gray-900"
                          }`}
                          style={on ? { backgroundColor: "var(--brand-accent)" } : undefined}
                        >
                          <span className="block text-[11px] font-semibold uppercase tracking-wide">{wd}</span>
                          <span className="block text-sm font-bold">{md}</span>
                        </button>
                      );
                    })}
                  </div>
                  {picks.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {picks.map((p, i) => (
                        <li key={p.date} className="flex flex-wrap items-center gap-2">
                          <span className="w-full sm:w-28 text-sm font-semibold text-gray-900">{i === 0 ? "First choice" : "Also"}: {dayLabel(p.date)}</span>
                          <div className="flex flex-1 gap-1" role="group" aria-label={`Time of day on ${dayLabel(p.date)}`}>
                            {PARTS.map((part) => (
                              <button
                                key={part.value}
                                type="button"
                                onClick={() => setPart(p.date, part.value)}
                                aria-pressed={p.part === part.value}
                                className={`flex-1 min-h-[40px] rounded-lg border text-xs font-semibold ${p.part === part.value ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 text-gray-700"}`}
                              >
                                {part.label}
                                <span className="block text-[10px] font-normal opacity-75">{part.sub}</span>
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>

                {me?.others?.length > 0 ? (
                  <fieldset className="min-w-0">
                    <legend className="text-sm font-semibold text-gray-900">Who&apos;s coming?</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {me.others.map((o) => (
                        <label key={o.id} className="inline-flex items-center gap-2 min-h-[40px] rounded-lg border border-gray-300 px-3 text-sm">
                          <input type="checkbox" checked={bringId === o.id} onChange={(e) => setBringId(e.target.checked ? o.id : null)} className="accent-[color:var(--brand-accent)]" />
                          Bring {o.first_name || o.name || o.email}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-800 min-h-[40px]">
                      <input type="checkbox" checked={withSomeone} onChange={(e) => setWithSomeone(e.target.checked)} className="accent-[color:var(--brand-accent)]" />
                      Someone is coming with me (optional)
                    </label>
                    {withSomeone && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input aria-label="Their name" placeholder="Their name" value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} className={inputCls} />
                        <input aria-label="Their email" type="email" placeholder="Their email (optional)" value={co.email} onChange={(e) => setCo({ ...co, email: e.target.value })} className={inputCls} />
                        {me && co.email.trim() && (
                          <label className="sm:col-span-2 inline-flex items-center gap-2 text-xs text-gray-600">
                            <input type="checkbox" checked={co.invite} onChange={(e) => setCo({ ...co, invite: e.target.checked })} className="accent-[color:var(--brand-accent)]" />
                            Also invite them to see the homes I save
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {me === null ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input aria-label="Your name" required autoComplete="name" placeholder="Your name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className={inputCls} />
                    <input aria-label="Phone" required type="tel" autoComplete="tel" placeholder="Phone" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} className={inputCls} />
                    <input aria-label="Email" required type="email" autoComplete="email" placeholder="Email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                  </div>
                ) : me ? (
                  <input aria-label="Phone to confirm" type="tel" autoComplete="tel" placeholder="Phone to confirm (blank uses the one we have)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                ) : null}

                <label className="block">
                  <span className="text-sm font-semibold text-gray-900">Notes <span className="font-normal text-gray-500">(optional)</span></span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    rows={2}
                    placeholder="Anything to look at closely? Questions for the listing agent?"
                    className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-[color:var(--brand-accent)] outline-none"
                  />
                </label>

                {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={state === "saving" || me === undefined}
                  className="w-full min-h-[48px] rounded-lg text-sm font-bold disabled:opacity-60"
                  style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent-ink)" }}
                >
                  {state === "saving" ? "Sending…" : picks.length > 1 ? `Request a tour (${picks.length} options)` : "Request a tour"}
                </button>
                <p className="text-xs text-gray-400 text-center">Free, no obligation. Your agent confirms the exact time with the listing agent.</p>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
