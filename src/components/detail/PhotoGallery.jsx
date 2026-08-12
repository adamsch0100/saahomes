import React, { useCallback, useEffect, useRef, useState } from "react";
import { photoUrl } from "../../utils/photoUrl.js";
import ListingPhotoFallback from "../ListingPhotoFallback.jsx";
import { LISTING_PHOTO_FALLBACK_SRC } from "../../utils/photoUrl.js";

/**
 * Zillow-style photo gallery: main image, thumbs, swipe, counter, keyboard, fullscreen.
 * Shared by the full route page and the search detail popup.
 *
 * Critical: image UI is NOT a nested React component (that remounts every parent
 * render and breaks prev/next + causes grey flashes). Loading uses a dual-buffer
 * (keep last good photo visible) + preload of adjacent indices via photoUrl proxy.
 *
 * Arrow UX (Adam Aug 7): mouse clicks must work, not only touch. Do NOT use blanket
 * onPointerDown stopPropagation — it can break the mouse pointer→click chain on some
 * browsers. Use onMouseDown stopPropagation instead; main <img> is pointer-events-none.
 */

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
    // Cached images may already be complete before handlers attach
    if (img.complete && img.naturalWidth > 0) finish(true);
  });
}

export default function PhotoGallery({ listingId, photos, photosCount, alt, compact = false }) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  /** index → true once that photo has loaded successfully */
  const [loaded, setLoaded] = useState(() => ({}));
  /** last index that fully loaded while it was active — underlay while next loads */
  const [displayIndex, setDisplayIndex] = useState(0);
  const touchStartX = useRef(null);
  const rootRef = useRef(null);
  const mainImgRef = useRef(null);
  const loadedRef = useRef({});
  const activeRef = useRef(0);

  const total = Math.max(
    Array.isArray(photos) ? photos.length : 0,
    Number(photosCount) > 0 ? Number(photosCount) : 0
  );

  activeRef.current = active;

  useEffect(() => {
    setActive(0);
    setDisplayIndex(0);
    setLoaded({});
    loadedRef.current = {};
  }, [listingId]);

  const markLoaded = useCallback((i) => {
    if (loadedRef.current[i]) {
      // Already known good — if it is the active slide, keep underlay in sync
      if (i === activeRef.current) setDisplayIndex(i);
      return;
    }
    loadedRef.current = { ...loadedRef.current, [i]: true };
    setLoaded((prev) => (prev[i] ? prev : { ...prev, [i]: true }));
    // Only advance displayIndex when the *active* photo finishes (preloads must not)
    if (i === activeRef.current) setDisplayIndex(i);
  }, []);

  const go = useCallback(
    (dir) => {
      setActive((i) => {
        if (total <= 0) return 0;
        const next = i + dir;
        if (next < 0) return total - 1;
        if (next >= total) return 0;
        return next;
      });
    },
    [total]
  );

  // When active changes to an already-cached photo, promote underlay immediately
  useEffect(() => {
    if (loadedRef.current[active]) {
      setDisplayIndex(active);
    }
  }, [active]);

  // Keyboard: arrows + Escape (capture so fullscreen Escape wins over panel close)
  useEffect(() => {
    if (total <= 1 && !fullscreen) return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
        return;
      }
      if (e.key === "Escape" && fullscreen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setFullscreen(false);
        return;
      }
      if (total <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, total, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Preload current + adjacent; mark loaded when ready (avoids grey flash on next)
  useEffect(() => {
    if (!listingId || total <= 0) return undefined;
    let cancelled = false;
    const idxs = new Set([active]);
    if (total > 1) {
      idxs.add((active + 1) % total);
      idxs.add((active - 1 + total) % total);
      // Also warm ±2 for smoother scrubbing
      idxs.add((active + 2) % total);
      idxs.add((active - 2 + total) % total);
    }
    idxs.forEach((idx) => {
      if (loadedRef.current[idx]) return;
      const url = photoUrl(listingId, idx);
      preloadImage(url).then((ok) => {
        if (cancelled || !ok) return;
        markLoaded(idx);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [active, listingId, total, markLoaded]);

  // Handle cached <img> that may already be complete when src is set
  useEffect(() => {
    const el = mainImgRef.current;
    if (!el) return;
    if (el.complete && el.naturalWidth > 0) {
      markLoaded(active);
    }
  }, [active, listingId, markLoaded]);

  if (!total) {
    return (
      <div
        className={`${
          compact ? "aspect-[16/10]" : "aspect-[16/10] rounded-xl"
        } bg-gray-800 flex items-center justify-center text-gray-400 text-sm`}
      >
        Photos coming soon
      </div>
    );
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  /**
   * Arrow activation for mouse click, touch tap, and keyboard activation.
   * stopPropagation on click + mousedown only (not pointerdown) so mouse
   * click synthesis is not broken on touchscreen laptops / some browsers.
   */
  const onArrowClick = (dir) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    go(dir);
  };
  const onArrowMouseDown = (e) => {
    // Block parent mousedown (panel/backdrop) without touching pointerdown→click
    e.stopPropagation();
  };

  const countBadge = total > 0 ? `${active + 1}/${total}` : "0/0";
  const thumbIndexes = Array.from({ length: total }, (_, i) => i);
  const activeLoaded = !!loaded[active];
  const showUnderlay = !activeLoaded && displayIndex !== active && !!loaded[displayIndex];
  const mainAlt = alt
    ? total > 0
      ? `Photo of ${alt} — photo ${active + 1} of ${total}`
      : `Photo of ${alt}`
    : "Listing photo";

  const renderMainStage = (stageClassName, { large = false } = {}) => (
    <div
      className={`relative bg-neutral-900 overflow-hidden select-none ${stageClassName}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Soft brand-tinted placeholder — never harsh grey */}
      <div
        className="absolute inset-0 pointer-events-none bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-800"
        aria-hidden="true"
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_#CFB36E_0%,_transparent_65%)]" />
      </div>

      {total <= 0 ? (
        <ListingPhotoFallback className="absolute inset-0 z-[1]" />
      ) : (
        <>
          {/* Keep previous photo visible while the next one loads */}
          {showUnderlay && (
            <img
              src={photoUrl(listingId, displayIndex)}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              decoding="async"
              draggable={false}
            />
          )}

          <img
            ref={mainImgRef}
            key={`${listingId}-${active}`}
            src={photoUrl(listingId, active)}
            alt={mainAlt}
            onLoad={() => markLoaded(active)}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = LISTING_PHOTO_FALLBACK_SRC;
              markLoaded(active);
            }}
            className={`absolute inset-0 z-[1] w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${
              activeLoaded ? "opacity-100" : "opacity-0"
            }`}
            decoding="async"
            // Current (and near-current) photos must load eagerly — lazy causes grey stalls
            loading="eager"
            fetchPriority={active === 0 ? "high" : "auto"}
            draggable={false}
          />

          {/* Subtle pulse only while first paint of this index is pending */}
          {!activeLoaded && (
            <div
              className="absolute inset-0 z-[2] pointer-events-none animate-pulse bg-black/20"
              aria-hidden="true"
            />
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={onArrowClick(-1)}
                onMouseDown={onArrowMouseDown}
                className={`absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 rounded-full bg-white/95 hover:bg-white shadow-lg flex items-center justify-center text-gray-900 leading-none active:scale-95 transition-transform pointer-events-auto touch-manipulation select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E] ${
                  large ? "w-12 h-12 text-2xl" : "w-10 h-10 text-xl"
                }`}
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={onArrowClick(1)}
                onMouseDown={onArrowMouseDown}
                className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-30 rounded-full bg-white/95 hover:bg-white shadow-lg flex items-center justify-center text-gray-900 leading-none active:scale-95 transition-transform pointer-events-auto touch-manipulation select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E] ${
                  large ? "w-12 h-12 text-2xl" : "w-10 h-10 text-xl"
                }`}
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}

          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-black/75 text-white text-xs font-medium px-3 py-1 rounded-full tabular-nums pointer-events-none">
            {countBadge}
          </span>
        </>
      )}
    </div>
  );

  return (
    <>
      <div ref={rootRef} className="space-y-3" tabIndex={-1}>
        <div
          className={`relative overflow-hidden focus-within:ring-2 focus-within:ring-[#CFB36E] ${
            compact ? "" : "rounded-xl"
          }`}
        >
          {renderMainStage(
            compact ? "aspect-[16/10] sm:aspect-[16/9]" : "aspect-[16/10] sm:aspect-[16/9]"
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFullscreen(true);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 z-40 min-h-[44px] px-3.5 py-2 rounded-full bg-black/70 hover:bg-black text-white text-xs font-semibold active:scale-95 transition-transform pointer-events-auto touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
            aria-label="Open full-screen photo gallery"
          >
            Expand
          </button>
        </div>

        {total > 1 && (
          <div
            className={`flex gap-2 overflow-x-auto pb-1 scrollbar-thin ${compact ? "px-3" : ""}`}
            role="listbox"
            aria-label="Photo thumbnails"
          >
            {thumbIndexes.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-opacity touch-manipulation pointer-events-auto ${
                  i === active
                    ? "border-[#CFB36E] opacity-100"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
              >
                <img
                  src={photoUrl(listingId, i)}
                  alt=""
                  // Eager for near-active; lazy only for far thumbs
                  loading={Math.abs(i - active) <= 3 || i < 6 ? "eager" : "lazy"}
                  decoding="async"
                  onLoad={() => markLoaded(i)}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = LISTING_PHOTO_FALLBACK_SRC;
                  }}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}

        {total > 0 && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className={`text-sm font-semibold text-gray-700 hover:text-black underline underline-offset-2 ${
              compact ? "px-3" : ""
            }`}
          >
            View all {total} photos
          </button>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[110] bg-black flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <span className="text-sm font-medium tabular-nums">{countBadge}</span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center text-2xl touch-manipulation active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
              aria-label="Close gallery"
            >
              ×
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-2 sm:px-8">
            {renderMainStage("w-full max-h-full max-w-6xl aspect-auto h-full", { large: true })}
          </div>
          {total > 1 && (
            <div className="shrink-0 flex gap-2 overflow-x-auto px-4 py-3 justify-center">
              {thumbIndexes.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`w-14 h-10 rounded overflow-hidden flex-shrink-0 border-2 touch-manipulation pointer-events-auto ${
                    i === active ? "border-[#CFB36E]" : "border-transparent opacity-60"
                  }`}
                >
                  <img
                    src={photoUrl(listingId, i)}
                    alt=""
                    className="w-full h-full object-cover pointer-events-none"
                    loading={Math.abs(i - active) <= 4 ? "eager" : "lazy"}
                    decoding="async"
                    onLoad={() => markLoaded(i)}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = LISTING_PHOTO_FALLBACK_SRC;
                    }}
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
