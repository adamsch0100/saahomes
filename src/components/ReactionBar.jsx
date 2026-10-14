import React, { useCallback, useEffect, useState } from "react";
import AccountModal from "./AccountModal";
import { fetchSessionUser, notifySavedHomesChanged } from "../utils/savedHomesApi.js";
import { fetchHomeForMe, notifyReactionsChanged, setHomeReaction } from "../utils/reactionsApi.js";

const CHOICES = [
  { value: "love", label: "Love it", icon: "♥" },
  { value: "maybe", label: "Maybe", icon: "?" },
  { value: "pass", label: "Not for me", icon: "✕" },
];

/**
 * "You and this home": why it fits the buyer's taste, a Love / Maybe /
 * Not for me reaction, and a private note. Love and Maybe save the home;
 * Not for me hides it from search and alerts.
 */
export default function ReactionBar({ listing, className = "" }) {
  const key = listing?.listing_id || listing?.slug || null;
  const [signedIn, setSignedIn] = useState(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    if (!key) return;
    const user = await fetchSessionUser();
    if (!user) {
      setSignedIn(false);
      setState(null);
      return;
    }
    setSignedIn(true);
    try {
      setState(await fetchHomeForMe(key));
    } catch {
      setState(null);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  // The heart elsewhere on the page can change the reaction (un-hearting a Love).
  useEffect(() => {
    const onChange = (e) => {
      const d = e?.detail || {};
      if (d.signedIn || !d.listingKey || [listing?.listing_id, listing?.slug].includes(String(d.listingKey))) load();
    };
    window.addEventListener("saa-saved-homes-changed", onChange);
    return () => window.removeEventListener("saa-saved-homes-changed", onChange);
  }, [load, listing?.listing_id, listing?.slug]);

  const send = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const next = await setHomeReaction(key, body);
      setState((s) => ({ ...(s || {}), ...next }));
      notifySavedHomesChanged({ listingKey: next.listing_key, saved: next.saved });
      notifyReactionsChanged({ listingKey: next.listing_key, reaction: next.reaction });
      return true;
    } catch (err) {
      if (err.status === 401) {
        setSignedIn(false);
        setPending(body);
        setLoginOpen(true);
      } else {
        setError(err.message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const choose = (value) => {
    const body = { reaction: state?.reaction === value ? null : value };
    if (signedIn === false) {
      setPending(body);
      setLoginOpen(true);
      return;
    }
    send(body);
  };

  const saveNote = async () => {
    if (await send({ reaction: state?.reaction ?? null, note: noteDraft })) setNoteOpen(false);
  };

  if (!key) return null;
  const reaction = state?.reaction || null;
  const reasons = state?.match?.reasons || [];

  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`} aria-label="You and this home">
      {reasons.length > 0 && (
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-900">Why this home fits you</h3>
          <ul className="mt-1.5 space-y-1">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-sm text-gray-700">
                <span aria-hidden="true" className="text-[#5f6b3a]">✓</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {signedIn && state && !state.taste_ready && (
        <p className="mb-3 text-xs text-gray-500">
          Love or save a few homes and we&apos;ll show why each new one fits you.
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Your reaction">
        {CHOICES.map((c) => {
          const on = reaction === c.value;
          return (
            <button
              key={c.value}
              type="button"
              disabled={busy}
              aria-pressed={on}
              onClick={() => choose(c.value)}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border text-sm font-semibold transition-colors touch-manipulation disabled:opacity-60 ${
                on
                  ? c.value === "pass"
                    ? "bg-gray-800 border-gray-800 text-white"
                    : "bg-[color:var(--brand-accent)] border-[color:var(--brand-accent)] text-gray-900"
                  : "bg-white border-gray-300 text-gray-800 hover:border-[color:var(--brand-accent)]"
              }`}
            >
              <span aria-hidden="true">{c.icon}</span>
              {c.label}
            </button>
          );
        })}
      </div>
      {reaction === "love" && (
        <p className="mt-2 text-xs text-gray-500">
          Saved. Buying with someone?{" "}
          <a href="/board/" className="font-semibold text-[color:var(--brand-accent-text)] underline underline-offset-2">Shop together</a>
        </p>
      )}
      {reaction === "pass" && (
        <p className="mt-2 text-xs text-gray-500">Hidden from your searches and alerts. Tap again to undo.</p>
      )}

      {signedIn && (
        <div className="mt-3">
          {noteOpen ? (
            <div>
              <label htmlFor={`note-${key}`} className="sr-only">Private note</label>
              <textarea
                id={`note-${key}`}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Only you can see this. Great kitchen, small yard, busy street…"
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-[color:var(--brand-accent)] focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveNote}
                  className="min-h-[40px] px-4 rounded-full bg-gray-900 text-white text-sm font-semibold disabled:opacity-60"
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={() => setNoteOpen(false)}
                  className="min-h-[40px] px-3 text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : state?.note ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Your note:</span> {state.note}{" "}
              <button
                type="button"
                onClick={() => {
                  setNoteDraft(state.note || "");
                  setNoteOpen(true);
                }}
                className="text-[color:var(--brand-accent-text)] underline underline-offset-2"
              >
                Edit
              </button>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNoteDraft("");
                setNoteOpen(true);
              }}
              className="text-sm font-semibold text-[color:var(--brand-accent-text)] underline underline-offset-2 min-h-[32px]"
            >
              Add a private note
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}

      <AccountModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setPending(null);
        }}
        onSuccess={async () => {
          setLoginOpen(false);
          setSignedIn(true);
          const body = pending;
          setPending(null);
          if (body) await send(body);
          load();
        }}
        purpose="save-home"
        askIntent
        showSuccess={false}
      />
    </section>
  );
}
