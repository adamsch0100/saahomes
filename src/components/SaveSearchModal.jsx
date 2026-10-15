import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { rememberSavedSearch } from "../utils/listingHelpers.js";
import InstantAlertsCard from "./InstantAlertsCard.jsx";
import { useBrokerageBrand } from "../context/TenantContext.jsx";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const TYPE_LABEL = {
  detached: "Detached home",
  attached: "Condo / townhome / attached",
  land: "Land",
  commercial: "Commercial",
  house: "Houses",
  townhome: "Townhomes",
  condo: "Condos",
  multi: "Multi-family",
  manufactured: "Manufactured",
};

const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", immediate: "As it happens" };

function filterSummary(filters = {}) {
  const parts = [];
  if (filters.city) parts.push(filters.city);
  if (filters.postal_code || filters.postalCode) {
    parts.push(`ZIP ${filters.postal_code || filters.postalCode}`);
  }
  if (filters.minPrice || filters.maxPrice) {
    const f = (n) => (n ? `$${Number(n).toLocaleString()}` : "Any");
    parts.push(`${f(filters.minPrice)} – ${f(filters.maxPrice)}`);
  }
  if (filters.beds) parts.push(`${filters.beds}+ beds`);
  if (filters.baths) parts.push(`${filters.baths}+ baths`);
  const typeList = filters.types
    ? String(filters.types).split(",").map((t) => t.trim()).filter(Boolean)
    : filters.type
      ? [filters.type]
      : [];
  if (typeList.length) {
    parts.push(typeList.map((t) => TYPE_LABEL[t] || t).join(", "));
  }
  if (filters.minSqft) parts.push(`${Number(filters.minSqft).toLocaleString()}+ sqft`);
  if (filters.minLotAcres || filters.maxLotAcres) {
    if (filters.minLotAcres && filters.maxLotAcres) {
      parts.push(`${filters.minLotAcres}–${filters.maxLotAcres} acres`);
    } else if (filters.minLotAcres) parts.push(`${filters.minLotAcres}+ acres`);
    else parts.push(`≤ ${filters.maxLotAcres} acres`);
  }
  if (filters.minYear || filters.maxYear) {
    if (filters.minYear && filters.maxYear) parts.push(`${filters.minYear}–${filters.maxYear}`);
    else if (filters.minYear) parts.push(`built ${filters.minYear}+`);
    else parts.push(`built ≤ ${filters.maxYear}`);
  }
  if (filters.garage) parts.push(`${filters.garage}+ garage`);
  if (filters.stories) parts.push(filters.stories === "3" ? "3+ stories" : `${filters.stories} story`);
  if (filters.pool === "true" || filters.pool === true) parts.push("Pool");
  if (filters.waterfront === "true" || filters.waterfront === true) parts.push("Waterfront");
  if (filters.newConstruction === "true" || filters.newConstruction === true) parts.push("New construction");
  if (filters.assumable === "true" || filters.assumable === true) parts.push("Assumable loan");
  if (filters.view) parts.push(`${filters.view} view`);
  if (filters.style) parts.push(filters.style);
  if (filters.community) parts.push(filters.community);
  if (filters.exterior) parts.push(filters.exterior);
  if (filters.cooling) parts.push(`Cooling: ${filters.cooling}`);
  if (filters.heating) parts.push(`Heating: ${filters.heating}`);
  if (filters.parking) parts.push(`Parking: ${filters.parking}`);
  if (filters.interior) {
    const toks = String(filters.interior).split(",").map((t) => t.trim()).filter(Boolean);
    if (toks.length) parts.push(toks.join(", "));
  }
  // Home status (status=) or legacy overlay (listingStatus=price-drop|new)
  const homeStatus = filters.status || (
    ["Active Under Contract", "Pending", "Sold", "Withdrawn", "Expired"].includes(filters.listingStatus)
      ? filters.listingStatus
      : ""
  );
  if (homeStatus === "Active Under Contract") parts.push("Backup offers accepted");
  else if (homeStatus === "Pending") parts.push("Pending");
  else if (homeStatus === "Sold") parts.push("Recently sold");
  else if (homeStatus === "Withdrawn") parts.push("Withdrawn");
  else if (homeStatus === "Expired") parts.push("Expired");
  if (filters.listingStatus === "price-drop") parts.push("Price drops");
  if (filters.listingStatus === "new") parts.push("New listings");
  if (filters.newDays) parts.push(`New ≤ ${filters.newDays}d`);
  if (filters.dropDays) parts.push(`Dropped ≤ ${filters.dropDays}d`);
  if (filters.dropPct) parts.push(`Drop ≥ ${filters.dropPct}%`);
  if (filters.keywords) {
    const mode = filters.keywordMode && filters.keywordMode !== "all"
      ? ` (${filters.keywordMode})`
      : "";
    parts.push(`“${filters.keywords}”${mode}`);
  }
  if (filters.polygon) parts.push("Custom map area");
  if (filters.basement) parts.push(filters.basement === "true" ? "Basement" : `Basement: ${filters.basement}`);
  if (filters.maxHoa) parts.push(filters.maxHoa === "0" || filters.maxHoa === 0 ? "No HOA" : `HOA ≤ $${filters.maxHoa}`);
  if (filters.hasImages === "true" || filters.hasImages === true) parts.push("Has photos");
  if (filters.hasTour === "true" || filters.hasTour === true || filters.has3d === "true") parts.push("Virtual tour");
  return parts.length ? parts.join(" · ") : "All homes";
}

/** Short default name for a search: "Fort Collins · 3+ beds · Under $600K". */
function suggestSearchName(filters = {}, bb = null) {
  const parts = [];
  const cities = String(filters.city || "").split(",").map((c) => c.trim()).filter(Boolean);
  const zips = String(filters.postal_code || filters.postalCode || "").split(",").map((z) => z.trim()).filter(Boolean);
  if (filters.polygon) parts.push("My map area");
  else if (cities.length) parts.push(cities.length > 2 ? `${cities.slice(0, 2).join(", ")} +${cities.length - 2}` : cities.join(", "));
  else if (zips.length) parts.push(`ZIP ${zips.length > 2 ? `${zips.slice(0, 2).join(", ")} +${zips.length - 2}` : zips.join(", ")}`);
  if (filters.beds) parts.push(`${filters.beds}+ beds`);
  const k = (n) => (Number(n) >= 1e6 ? `$${(Number(n) / 1e6).toFixed(1).replace(/\.0$/, "")}M` : `$${Math.round(Number(n) / 1000)}K`);
  if (filters.minPrice && filters.maxPrice) parts.push(`${k(filters.minPrice)}–${k(filters.maxPrice)}`);
  else if (filters.maxPrice) parts.push(`Under ${k(filters.maxPrice)}`);
  else if (filters.minPrice) parts.push(`${k(filters.minPrice)}+`);
  const fallback = bb ? (bb.market ? `${bb.market} homes` : "All homes") : "Northern Colorado homes";
  return (parts.join(" · ") || fallback).slice(0, 120);
}

/**
 * SaveSearchModal — one field, then the rest.
 * Step "save": the email (or a one-tap save when the visitor is signed in);
 * the search is saved the moment it's valid. Step "details": name, mobile +
 * text opt-in, and how often, all optional (PATCH /api/alerts/me + /:id).
 * Step "done": where to manage it. Shares the session cookie (/api/alerts/me)
 * with AccountModal; a guest save creates the account and signs this device in.
 */
export default function SaveSearchModal({
  filters = {},
  buttonLabel = "Save this search",
  buttonClassName = "",
  buttonStyle = {},
  hideIcon = false,
}) {
  const bb = useBrokerageBrand();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("save"); // save | details | done
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [frequency, setFrequency] = useState("daily");
  const [savedId, setSavedId] = useState(null);
  const [signInNote, setSignInNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Session: null = checking, false = guest, object = signed in
  const [session, setSession] = useState(null);
  const [wasGuest, setWasGuest] = useState(true);

  // When modal opens, check cookie session via /api/alerts/me
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSession(null);
    fetch(`${API_BASE}/api/alerts/me`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success && d.data) {
          setSession(d.data);
          setWasGuest(false);
          if (d.data.email) setEmail(d.data.email);
          if (d.data.phone) {
            // Format digits for display if backend stored raw digits
            const digits = String(d.data.phone).replace(/\D/g, "");
            if (digits.length === 10) {
              setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
            } else {
              setPhone(String(d.data.phone));
            }
          }
          if (d.data.name) setContactName(d.data.name);
        } else {
          setSession(false);
          setWasGuest(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(false);
          setWasGuest(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when open flips true
  }, [open]);

  // Escape closes modal (parity with filter popovers / detail panel — G-UX2-4)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      resetAndClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetAndClose reads latest state when it runs
  }, [open]);

  const isSignedIn = Boolean(session && session.email);
  const suggestedName = suggestSearchName(filters, bb);
  const summary = filterSummary(filters);

  /** Step 1 — the email is all it takes; the search is saved right away. */
  const save = async (e) => {
    e.preventDefault();
    const emailStr = email.trim();
    if (!emailStr || !emailStr.includes("@")) {
      setError("Enter your email so we know where to send new homes.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...filters,
          email: emailStr,
          search_name: suggestedName,
          frequency: "daily",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not save");
      setSavedId(data.data?.id || null);
      setSignInNote(data.signInRequired ? data.message || "" : "");
      localStorage.setItem("saa_lead_captured", "1");
      // RealScout-style: remember criteria so cards/detail can show match chips
      rememberSavedSearch(filters);
      try {
        window.dispatchEvent(new CustomEvent("saa-search-saved", { detail: filters }));
      } catch { /* noop */ }
      // An existing account that isn't signed in here gets its sign-in link
      // emailed; the follow-up step needs the session, so skip straight to done.
      setStep(data.signInRequired ? "done" : "details");
    } catch (err) {
      setError(err.message || "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Step 2 — all optional; the search is already saved. */
  const askName = !(isSignedIn && session.name);
  const askPhone = !(isSignedIn && session.phone);
  const finishDetails = async (e) => {
    e.preventDefault();
    const nameStr = contactName.trim();
    const phoneStr = phone.trim();
    if (smsOptIn && !phoneStr) {
      setError("Add your mobile number to get texts, or untick the text option.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const sendName = askName && nameStr;
      const sendPhone = askPhone && phoneStr;
      if (sendName || sendPhone || smsOptIn) {
        const res = await fetch(`${API_BASE}/api/alerts/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            contact_name: sendName ? nameStr : undefined,
            phone: sendPhone ? phoneStr : undefined,
            sms_opt_in: smsOptIn,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Could not save your details");
      }
      if (savedId && frequency !== "daily") {
        const res = await fetch(`${API_BASE}/api/alerts/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ frequency }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Could not set how often");
      }
      setStep("done");
    } catch (err) {
      setError(err.message || "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    setStep("save");
    setError("");
    setBusy(false);
    setSavedId(null);
    setSignInNote("");
    // Keep email/phone if they just signed up so re-open feels sticky
    if (wasGuest && step === "save") {
      setEmail("");
      setPhone("");
      setContactName("");
      setSmsOptIn(false);
      setFrequency("daily");
    }
  };

  const inputClass =
    "w-full min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none";
  const primaryBtn =
    "w-full min-h-[48px] py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50";
  const closeBtn = (
    <button
      type="button"
      onClick={resetAndClose}
      className="shrink-0 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center text-2xl leading-none text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-accent)]"
      aria-label="Close"
    >
      ×
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName || "px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold hover:border-black transition-colors bg-white text-gray-900"}
        style={buttonStyle}
      >
        {!hideIcon && <span className="mr-1" aria-hidden="true">🔔</span>}
        {buttonLabel}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
            onClick={resetAndClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-search-title"
          >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 max-h-[92vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            {step === "done" ? (
              <div className="text-center py-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-[rgb(var(--brand-accent-rgb)/0.25)] flex items-center justify-center text-2xl mb-3" aria-hidden="true">✓</div>
                <h3 id="save-search-title" className="text-xl font-bold text-gray-900">
                  {wasGuest ? "You're set up!" : "Search saved!"}
                </h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  We&apos;ll email you when new homes match{" "}
                  <span className="font-semibold text-gray-900">{summary}</span>
                  {" "}— including <strong>price drops</strong> and status changes.
                </p>
                {signInNote ? (
                  <p className="text-gray-700 mt-3 text-sm leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                    {signInNote}
                  </p>
                ) : wasGuest ? (
                  <p className="text-gray-700 mt-3 text-sm leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                    Account created on this device.{" "}
                    <strong>Manage your alerts anytime</strong> — no password required on this browser.
                  </p>
                ) : (
                  <p className="text-gray-500 mt-3 text-sm">
                    Added to your account ({session?.email || email}).
                  </p>
                )}
                {!signInNote && <InstantAlertsCard compact className="mt-4" />}
                <a
                  href="/my-saved-searches/"
                  className="mt-3 inline-flex items-center justify-center w-full py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Manage my alerts
                </a>
                <p className="text-gray-500 mt-3 text-xs">
                  {bb
                    ? [bb.legalName || bb.name, bb.phone, "Unsubscribe anytime from any email."].filter(Boolean).join(" · ")
                    : "Schwartz and Associates · (970) 999-1407 · Unsubscribe anytime from any email."}
                </p>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="mt-4 w-full py-3 bg-[color:var(--brand-accent)] text-[color:var(--brand-on-accent)] font-semibold rounded-lg hover:bg-[color:var(--brand-accent-strong)]"
                >
                  Done
                </button>
              </div>
            ) : step === "details" ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="save-search-title" className="text-xl font-bold text-gray-900">Saved. Want them faster?</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Alerts for <span className="font-semibold text-gray-900">{summary}</span> go to{" "}
                      <span className="font-semibold text-gray-900">{email.trim()}</span>. Everything below is optional.
                    </p>
                  </div>
                  {closeBtn}
                </div>

                <form onSubmit={finishDetails} className="mt-4 space-y-4">
                  {askName && (
                    <div>
                      <label htmlFor="save-search-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Your name
                      </label>
                      <input
                        id="save-search-name"
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="First and last name"
                        autoComplete="name"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {askPhone && (
                    <div>
                      <label htmlFor="save-search-phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Mobile phone
                      </label>
                      <input
                        id="save-search-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(970) 555-0123"
                        autoComplete="tel"
                        className={inputClass}
                      />
                    </div>
                  )}
                  <label className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsOptIn}
                      onChange={(e) => setSmsOptIn(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-black"
                    />
                    {/* Same words as SMS_ALERT_CONSENT_WORDING in backend/src/controllers/alertController.js */}
                    <span>
                      Text me new matches and price drops for this search from {bb ? bb.name : "SAA Homes"}. Msg frequency varies.
                      Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.
                    </span>
                  </label>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">How often?</p>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="How often">
                      {Object.entries(FREQ_LABEL).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFrequency(value)}
                          aria-pressed={frequency === value}
                          className={`min-h-[44px] px-2 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                            frequency === value
                              ? "bg-black text-white border-black"
                              : "border-gray-300 text-gray-600 hover:border-black"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {frequency === "immediate"
                        ? "New homes and price drops email you the moment they hit."
                        : frequency === "weekly"
                          ? "One email every Monday morning."
                          : "One email each morning, only when something's new."}
                    </p>
                  </div>
                  {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
                  <button type="submit" disabled={busy} className={primaryBtn}>
                    {busy ? "Saving…" : "Finish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("done")}
                    disabled={busy}
                    className="w-full min-h-[44px] text-sm font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Skip for now
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="save-search-title" className="text-xl font-bold text-gray-900">Save this search</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      New homes + price drops for:{" "}
                      <span className="font-semibold text-gray-900">{summary}</span>
                    </p>
                  </div>
                  {closeBtn}
                </div>

                <form onSubmit={save} className="mt-4 space-y-4">
                  {session === null ? (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-xs text-gray-500 animate-pulse">
                      Checking your account…
                    </div>
                  ) : isSignedIn ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700">
                      Alerts go to <strong>{session.email}</strong>
                      {session.searches?.length > 0 && (
                        <span className="text-gray-500">
                          {" "}· {session.searches.length} saved search{session.searches.length === 1 ? "" : "es"}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="save-search-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        id="save-search-email"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        inputMode="email"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
                  <button type="submit" disabled={busy || session === null} className={primaryBtn}>
                    {busy ? "Saving…" : isSignedIn ? "Save to my account" : "Save & get alerts"}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    {isSignedIn
                      ? "You're signed in — this search is added to your alerts."
                      : "No spam. No sharing your info. Unsubscribe with one click."}
                  </p>
                </form>
              </>
            )}
          </div>
          </div>,
          document.body
        )}
    </>
  );
}
