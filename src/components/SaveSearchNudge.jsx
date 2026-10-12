import React, { useEffect, useState } from "react";
import SaveSearchModal from "./SaveSearchModal";

const DISMISS_KEY = "saa_save_nudge_dismissed_at";
const SHOWN_KEY = "saa_save_nudge_shown";
const DISMISS_DAYS = 7;
export const NUDGE_AFTER_HOMES = 3;
export const NUDGE_AFTER_SEARCHES = 3;

const read = (store, key) => {
  try { return window[store].getItem(key); } catch { return null; }
};
const write = (store, key, value) => {
  try { window[store].setItem(key, value); } catch { /* private mode */ }
};

function suppressed() {
  if (read("localStorage", "saa_lead_captured") === "1") return true;
  if (read("sessionStorage", SHOWN_KEY) === "1") return true;
  const at = Number(read("localStorage", DISMISS_KEY));
  return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 86400000;
}

/**
 * Offers "save this search" once a visitor is clearly shopping (opened a few
 * homes or refined the search a few times), never mid-listing, once per
 * visit, and not again for a week after a dismiss.
 */
export default function SaveSearchNudge({ filters, homesOpened, searchesRun, paused }) {
  const [open, setOpen] = useState(false);
  // After a save the bar hides but stays mounted, so the modal's own
  // success screen (rendered in a portal) isn't torn down with it.
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open || paused) return;
    if (homesOpened < NUDGE_AFTER_HOMES && searchesRun < NUDGE_AFTER_SEARCHES) return;
    if (suppressed()) return;
    const t = setTimeout(() => {
      write("sessionStorage", SHOWN_KEY, "1");
      setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [homesOpened, searchesRun, paused, open]);

  useEffect(() => {
    const onSaved = () => setSaved(true);
    window.addEventListener("saa-search-saved", onSaved);
    return () => window.removeEventListener("saa-search-saved", onSaved);
  }, []);

  if (!open || paused) return null;

  const dismiss = () => {
    write("localStorage", DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  return (
    <div className={`fixed inset-x-0 bottom-[9.5rem] md:bottom-6 z-40 justify-center px-4 pointer-events-none ${saved ? "hidden" : "flex"}`}>
      <div
        role="dialog"
        aria-label="Save this search"
        className="pointer-events-auto w-full max-w-md rounded-2xl bg-black text-white shadow-2xl px-4 py-3.5 flex items-center gap-3 animate-[slideUp_0.25s_ease-out]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Hear first when homes like these list</p>
          <p className="text-xs text-gray-300 mt-0.5">New matches and price drops for this search. No spam.</p>
        </div>
        <SaveSearchModal
          filters={filters}
          buttonLabel="Save search"
          hideIcon
          buttonClassName="shrink-0 min-h-[40px] px-3.5 py-2 bg-[#CFB36E] text-black rounded-lg text-sm font-bold touch-manipulation"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
