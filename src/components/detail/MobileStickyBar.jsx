import React from "react";
import ScheduleShowingModal from "../ScheduleShowingModal";
import { HeartIcon, ShareIcon } from "./icons.jsx";

/**
 * Mobile sticky bottom conversion bar — Save · Share · Nadia · Call · Schedule.
 * Share is icon-only (≥44px) so five actions fit on ≤360px screens without overflow.
 * Use fixed for route page; use shrink-0 footer inside modal.
 *
 * Share reuses parent onShare (Web Share API → clipboard + shareCopied toast).
 */
export default function MobileStickyBar({
  listing,
  saved,
  onToggleSave,
  openNadia,
  onShare,
  shareCopied = false,
  mode = "fixed", // "fixed" | "footer"
}) {
  if (!listing) return null;

  const bar = (
    <div className="relative flex items-center gap-1 max-w-lg mx-auto">
      {shareCopied && (
        <div
          role="status"
          className="absolute left-1/2 -translate-x-1/2 -top-10 z-10 px-3 py-1.5 rounded-full bg-black text-white text-xs font-semibold shadow-lg whitespace-nowrap pointer-events-none"
        >
          Link copied
        </div>
      )}
      <button
        type="button"
        onClick={onToggleSave}
        className={`w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-full border flex items-center justify-center active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E] ${
          saved
            ? "bg-[#CFB36E] border-[#CFB36E] text-black"
            : "border-gray-300 text-gray-800 hover:border-black"
        }`}
        aria-label={saved ? "Unsave home" : "Save home"}
      >
        <HeartIcon filled={saved} />
      </button>
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className={`w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-full border flex items-center justify-center active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E] ${
            shareCopied
              ? "bg-[#CFB36E] border-[#CFB36E] text-black"
              : "border-gray-300 text-gray-800 hover:border-black"
          }`}
          aria-label={shareCopied ? "Link copied" : "Share this home"}
          title={shareCopied ? "Link copied" : "Share"}
        >
          <ShareIcon />
        </button>
      )}
      <button
        type="button"
        onClick={openNadia}
        className="shrink-0 min-h-[44px] px-2 py-2.5 border border-gray-300 text-gray-900 text-xs font-semibold rounded-lg active:scale-95 hover:border-black transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
      >
        Nadia
      </button>
      <a
        href="tel:+19709991407"
        className="shrink-0 min-h-[44px] px-2 py-2.5 border-2 border-black text-black text-xs font-semibold rounded-lg active:scale-95 hover:bg-black hover:text-white transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
      >
        Call
      </a>
      <div className="flex-1 min-w-0">
        <ScheduleShowingModal
          listing={listing}
          buttonLabel="Schedule"
          buttonClassName="w-full min-h-[44px] inline-flex items-center justify-center px-2.5 py-2.5 text-sm font-semibold rounded-lg active:scale-[0.98] hover:opacity-90 transition-all touch-manipulation"
          buttonStyle={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
          hideIcon
        />
      </div>
    </div>
  );

  if (mode === "footer") {
    return (
      <div className="shrink-0 lg:hidden border-t border-gray-200 bg-white px-2.5 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]">
        {bar}
      </div>
    );
  }

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-2.5 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]">
      {bar}
    </div>
  );
}
