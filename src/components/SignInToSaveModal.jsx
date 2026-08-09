import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ensureSessionApi,
  loginApi,
  migrateLocalSavedHomes,
  notifySavedHomesChanged,
} from "../utils/savedHomesApi.js";

/**
 * Sign-in gate for saving homes.
 * Email + phone required (brand pattern). Optional password for return visits.
 * On success: migrates localStorage hearts, fires onSuccess, closes.
 */
export default function SignInToSaveModal({ open, onClose, onSuccess, title, subtitle }) {
  const [mode, setMode] = useState("save"); // save | password
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    setError("");
    setBusy(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "password") {
        if (!email.trim() || !password) {
          throw new Error("Email and password are required.");
        }
        // Phone still required by product rule when this prompt appears
        if (!phone.trim()) {
          throw new Error("Please add your phone number so we can reach you about saved homes.");
        }
        await loginApi({ email: email.trim(), password });
        // Best-effort: attach phone if missing on account
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
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-save-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-gray-700"
          aria-label="Close sign-in"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="pr-10">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#CFB36E]">SAA Homes</p>
          <h2 id="sign-in-save-title" className="text-xl font-bold text-gray-900 mt-1">
            {title || "Sign in to save homes and sync across devices"}
          </h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            {subtitle ||
              "Your favorites will follow you — phone and computer. We never share your info."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("save")}
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
            onClick={() => setMode("password")}
            className={`px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors min-h-[44px] ${
              mode === "password"
                ? "bg-black text-white border-black"
                : "border-gray-300 text-gray-600 hover:border-black"
            }`}
          >
            Use password
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="save-home-email" className="block text-xs font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              id="save-home-email"
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
            <label htmlFor="save-home-phone" className="block text-xs font-semibold text-gray-700 mb-1">
              Phone
            </label>
            <input
              id="save-home-phone"
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
            <label htmlFor="save-home-password" className="block text-xs font-semibold text-gray-700 mb-1">
              {mode === "password" ? "Password" : "Password (optional)"}
            </label>
            <input
              id="save-home-password"
              type="password"
              required={mode === "password"}
              autoComplete={mode === "password" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "password" ? "Your password" : "Set one to sign in later (8+ chars)"}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none text-sm min-h-[44px]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 min-h-[48px] bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 touch-manipulation"
          >
            {busy ? "Signing in…" : "Sign in & save homes"}
          </button>
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            By continuing you agree we may contact you about Northern Colorado homes. Fair Housing Act compliant.
          </p>
        </form>
      </div>
    </div>,
    document.body
  );
}
