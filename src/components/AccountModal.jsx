import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ensureSessionApi,
  loginApi,
  requestMagicLinkApi,
  migrateLocalSavedHomes,
  notifySavedHomesChanged,
  fetchSessionUser,
} from "../utils/savedHomesApi.js";

/**
 * Unified account capture modal (heart / save-search / header sign-in).
 *
 * Design notes (Zillow × RealScout × SAA original):
 * - Zillow: gate hearts on account; single sticky CTA; email-first return visits
 * - RealScout Capture: intent + contact in one step; success shows what they unlocked
 * - SAA original: email+phone required (brand rule), gold #CFB36E, Fair Housing footer,
 *   magic-link for passwordless return, cookie session (no new auth system)
 *
 * Props:
 *  - open, onClose, onSuccess
 *  - purpose: "save-home" | "sign-in" | "save-search" (copy only)
 *  - title, subtitle: optional overrides
 *  - askIntent: show buying/selling/both for guests (default true for sign-in / save-home)
 *  - showSuccess: if true, show success screen before close (default false → fire onSuccess + close)
 *  - successMeta: { searchSummary, savedHomesCount, searchesCount } real counts only
 */
const PURPOSE_COPY = {
  "save-home": {
    title: "Save this home to your account",
    subtitle:
      "We'll sync your favorites across phone and computer — and email you price drops on homes you heart.",
    cta: "Sign in & save home",
    successTitle: "Home saved",
  },
  "save-search": {
    title: "Get alerts for homes like this",
    subtitle:
      "We'll email you new matches and price drops. One account for hearts, searches, and home value tracking.",
    cta: "Save search & get alerts",
    successTitle: "You're set up",
  },
  "sign-in": {
    title: "Sign in or create your account",
    subtitle:
      "Save homes, get search alerts, and track your home's value — all in one place. We never share your info.",
    cta: "Continue",
    successTitle: "You're signed in",
  },
};

export default function AccountModal({
  open,
  onClose,
  onSuccess,
  purpose = "sign-in",
  title,
  subtitle,
  askIntent = true,
  showSuccess = false,
  successMeta = null,
}) {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY["sign-in"];
  const [mode, setMode] = useState("save"); // save | password | magic
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [intent, setIntent] = useState("buying");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [session, setSession] = useState(null); // null checking | false guest | object signed in
  const [screen, setScreen] = useState("form"); // form | success
  const [wasGuest, setWasGuest] = useState(true);
  const [resultMeta, setResultMeta] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setError("");
    setBusy(false);
    setMagicSent(false);
    setScreen("form");
    setMode("save");
    setPassword("");
    setResultMeta(null);
    setSession(null);

    let cancelled = false;
    fetchSessionUser().then((user) => {
      if (cancelled) return;
      if (user?.email) {
        setSession(user);
        setWasGuest(false);
        if (user.email) setEmail(user.email);
        if (user.phone) {
          const digits = String(user.phone).replace(/\D/g, "");
          if (digits.length === 10) {
            setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
          } else {
            setPhone(String(user.phone));
          }
        }
      } else {
        setSession(false);
        setWasGuest(true);
      }
    });

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const isSignedIn = session && session.email;
  const searchesCount =
    resultMeta?.searchesCount ??
    successMeta?.searchesCount ??
    (Array.isArray(session?.searches) ? session.searches.length : null);
  const savedHomesCount =
    resultMeta?.savedHomesCount ?? successMeta?.savedHomesCount ?? null;

  const finishSuccess = (meta = {}) => {
    setResultMeta(meta);
    if (showSuccess) {
      setScreen("success");
    } else {
      onSuccess?.({ intent, wasGuest, session: meta.session || session, ...meta });
      onClose?.();
    }
  };

  const handleSignedInContinue = () => {
    // Already have session — one-tap continue for heart / header
    onSuccess?.({ intent, wasGuest: false, session, alreadySignedIn: true });
    if (showSuccess) {
      setScreen("success");
    } else {
      onClose?.();
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "magic") {
        if (!email.trim() || !email.includes("@")) {
          throw new Error("Enter a valid email so we can send your sign-in link.");
        }
        await requestMagicLinkApi(email.trim());
        setMagicSent(true);
        return;
      }

      if (isSignedIn) {
        handleSignedInContinue();
        return;
      }

      if (mode === "password") {
        if (!email.trim() || !password) {
          throw new Error("Email and password are required.");
        }
        if (!phone.trim()) {
          throw new Error("Please add your phone number so we can reach you.");
        }
        await loginApi({ email: email.trim(), password });
        try {
          await ensureSessionApi({ email: email.trim(), phone: phone.trim() });
        } catch {
          /* login already set cookie */
        }
      } else {
        await ensureSessionApi({
          email: email.trim(),
          phone: phone.trim(),
          password: password || undefined,
        });
      }

      await migrateLocalSavedHomes();
      notifySavedHomesChanged({ signedIn: true });

      // Refresh session for real counts on success screen
      const fresh = await fetchSessionUser();
      if (fresh) setSession(fresh);

      if (intent) {
        try {
          localStorage.setItem("saa_intent", intent);
          localStorage.setItem("saa_lead_captured", "1");
        } catch {
          /* noop */
        }
      }

      finishSuccess({
        session: fresh,
        searchesCount: Array.isArray(fresh?.searches) ? fresh.searches.length : 0,
      });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const closeSuccess = () => {
    onSuccess?.({ intent, wasGuest, session, ...resultMeta });
    onClose?.();
  };

  const showIntentStep = askIntent && !isSignedIn && mode !== "magic";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-gray-700"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {screen === "success" ? (
          <div className="text-center py-2 pr-6">
            <div
              className="mx-auto w-14 h-14 rounded-full bg-[#CFB36E]/25 flex items-center justify-center text-2xl mb-3"
              aria-hidden="true"
            >
              ✓
            </div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-[#CFB36E]">SAA Homes</p>
            <h2 id="account-modal-title" className="text-xl font-bold text-gray-900 mt-1">
              {copy.successTitle}
            </h2>
            <ul className="mt-4 text-left space-y-2.5 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-[#CFB36E] font-bold shrink-0" aria-hidden="true">
                  ✓
                </span>
                <span>
                  Hearts sync across devices
                  {typeof savedHomesCount === "number" && savedHomesCount > 0
                    ? ` · ${savedHomesCount} saved`
                    : ""}
                </span>
              </li>
              {(purpose === "save-search" || successMeta?.searchSummary) && (
                <li className="flex gap-2">
                  <span className="text-[#CFB36E] font-bold shrink-0" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    Alerts on for{" "}
                    <strong className="text-gray-900">
                      {successMeta?.searchSummary || "your search"}
                    </strong>
                  </span>
                </li>
              )}
              {typeof searchesCount === "number" && searchesCount > 0 && (
                <li className="flex gap-2">
                  <span className="text-[#CFB36E] font-bold shrink-0" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    {searchesCount} saved search{searchesCount === 1 ? "" : "es"} on your account
                  </span>
                </li>
              )}
              {(intent === "selling" || intent === "both") && (
                <li className="flex gap-2">
                  <span className="text-[#CFB36E] font-bold shrink-0" aria-hidden="true">
                    ✓
                  </span>
                  <span>Home value tracking available on My Home</span>
                </li>
              )}
              {wasGuest && (
                <li className="flex gap-2">
                  <span className="text-[#CFB36E] font-bold shrink-0" aria-hidden="true">
                    ✓
                  </span>
                  <span>Account created on this device — stay signed in to manage anytime</span>
                </li>
              )}
            </ul>

            {(intent === "selling" || intent === "both") && (
              <a
                href="/my-home/"
                className="mt-5 inline-flex items-center justify-center w-full py-3 min-h-[48px] bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors text-sm"
              >
                Track my home&apos;s value →
              </a>
            )}
            <Link
              to="/my-saved-searches/"
              onClick={closeSuccess}
              className="mt-3 inline-flex items-center justify-center w-full py-3 min-h-[48px] border-2 border-black text-black font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Manage saved homes & alerts
            </Link>
            <button
              type="button"
              onClick={closeSuccess}
              className="mt-3 w-full py-3 min-h-[48px] bg-[#CFB36E] text-black font-semibold rounded-lg hover:bg-[#bd9f5a]"
            >
              Done
            </button>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              Schwartz and Associates · (970) 999-1407 · Unsubscribe anytime from any email.
            </p>
          </div>
        ) : (
          <>
            <div className="pr-10">
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#CFB36E]">SAA Homes</p>
              <h2 id="account-modal-title" className="text-xl font-bold text-gray-900 mt-1">
                {title || copy.title}
              </h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {subtitle || copy.subtitle}
              </p>
            </div>

            {session === null ? (
              <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-xs text-gray-500 animate-pulse">
                Checking your account…
              </div>
            ) : isSignedIn ? (
              <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 leading-relaxed">
                <strong>Signed in as {session.email}</strong>
                {Array.isArray(session.searches) && session.searches.length > 0 && (
                  <span className="text-emerald-700">
                    {" "}
                    · {session.searches.length} saved search
                    {session.searches.length === 1 ? "" : "es"}
                  </span>
                )}
                <br />
                {purpose === "save-home"
                  ? "Tap below to save this home to your account."
                  : "You're ready — continue below."}{" "}
                <a href="/my-saved-searches/" className="underline font-semibold">
                  Manage account
                </a>
              </div>
            ) : null}

            {/* Mode tabs — guest only */}
            {!isSignedIn && session !== null && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("save");
                    setMagicSent(false);
                    setError("");
                  }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors min-h-[44px] ${
                    mode === "save"
                      ? "bg-black text-white border-black"
                      : "border-gray-300 text-gray-600 hover:border-black"
                  }`}
                >
                  Email + phone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setMagicSent(false);
                    setError("");
                  }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors min-h-[44px] ${
                    mode === "password"
                      ? "bg-black text-white border-black"
                      : "border-gray-300 text-gray-600 hover:border-black"
                  }`}
                >
                  Use password
                </button>
              </div>
            )}

            <form onSubmit={submit} className="mt-4 space-y-3">
              {showIntentStep && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Are you buying, selling, or both?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "buying", label: "Buying" },
                      { value: "selling", label: "Selling" },
                      { value: "both", label: "Both" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIntent(opt.value)}
                        className={`px-2 py-2.5 rounded-lg border text-xs font-semibold transition-colors min-h-[44px] ${
                          intent === opt.value
                            ? "bg-black text-white border-black"
                            : "border-gray-300 text-gray-600 hover:border-black"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {(intent === "selling" || intent === "both") && (
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                      After signing in you can track your home&apos;s value on{" "}
                      <span className="font-semibold text-gray-700">My Home</span> — monthly
                      updates, no pressure.
                    </p>
                  )}
                </div>
              )}

              {/* Guest contact fields (or magic-link email only) */}
              {!isSignedIn && session !== null && mode !== "magic" && (
                <>
                  <div>
                    <label htmlFor="account-email" className="block text-xs font-semibold text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      id="account-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="account-phone" className="block text-xs font-semibold text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      id="account-phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(970) 555-1234"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="account-password"
                      className="block text-xs font-semibold text-gray-700 mb-1"
                    >
                      {mode === "password" ? "Password" : "Password (optional)"}
                    </label>
                    <input
                      id="account-password"
                      type="password"
                      required={mode === "password"}
                      autoComplete={mode === "password" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === "password"
                          ? "Your password"
                          : "Set one to sign in later (8+ chars)"
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm min-h-[44px]"
                    />
                  </div>
                </>
              )}

              {mode === "magic" && !isSignedIn && (
                <div>
                  {magicSent ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-sm text-emerald-900 leading-relaxed">
                      If we have an account for that email, your sign-in link is on its way. Check
                      your inbox (and spam) for a link to manage saved homes and alerts.
                    </div>
                  ) : (
                    <>
                      <label
                        htmlFor="account-magic-email"
                        className="block text-xs font-semibold text-gray-700 mb-1"
                      >
                        Email
                      </label>
                      <input
                        id="account-magic-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm min-h-[44px]"
                      />
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                        We&apos;ll email a one-tap link to your saved searches — no password needed.
                      </p>
                    </>
                  )}
                </div>
              )}

              {isSignedIn && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700">
                  Signed in as <strong>{session.email}</strong>
                  {phone ? <> · {phone}</> : null}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              {!(mode === "magic" && magicSent) && (
                <button
                  type="submit"
                  disabled={busy || session === null}
                  className="w-full py-3 min-h-[48px] bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 touch-manipulation"
                >
                  {busy
                    ? mode === "magic"
                      ? "Sending link…"
                      : "Signing in…"
                    : isSignedIn
                      ? purpose === "save-home"
                        ? "Save to my account"
                        : "Continue"
                      : mode === "magic"
                        ? "Email me a link"
                        : copy.cta}
                </button>
              )}

              {!isSignedIn && session !== null && mode !== "magic" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("magic");
                    setError("");
                    setMagicSent(false);
                  }}
                  className="w-full text-center text-sm font-semibold text-gray-700 hover:text-black underline-offset-2 hover:underline min-h-[44px]"
                >
                  Email me a link instead
                </button>
              )}

              {mode === "magic" && !isSignedIn && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("save");
                    setMagicSent(false);
                    setError("");
                  }}
                  className="w-full text-center text-sm font-semibold text-gray-700 hover:text-black underline-offset-2 hover:underline min-h-[44px]"
                >
                  ← Back to email + phone
                </button>
              )}

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                By continuing you agree we may contact you about Northern Colorado homes. Fair
                Housing Act compliant. No spam — unsubscribe in one click.
              </p>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
