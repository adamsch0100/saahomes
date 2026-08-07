import React, { useCallback, useEffect, useRef, useState } from "react";
import { photoUrl } from "../../utils/photoUrl.js";

/**
 * Zillow-style photo gallery: main image, thumbs, swipe, counter, keyboard, fullscreen.
 * Shared by the full route page and the search detail popup.
 */
export default function PhotoGallery({ listingId, photos, photosCount, alt, compact = false }) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loaded, setLoaded] = useState({});
  const touchStartX = useRef(null);
  const rootRef = useRef(null);
  const total = Math.max(
    Array.isArray(photos) ? photos.length : 0,
    Number(photosCount) > 0 ? Number(photosCount) : 0
  );

  useEffect(() => {
    setActive(0);
    setLoaded({});
  }, [listingId]);

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

  useEffect(() => {
    if (total <= 1) return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
        return;
      }
      if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!listingId || total <= 1) return undefined;
    const idxs = [(active + 1) % total, (active - 1 + total) % total];
    const imgs = idxs.map((idx) => {
      const img = new Image();
      img.src = photoUrl(listingId, idx);
      return img;
    });
    return () => {
      imgs.forEach((img) => {
        img.src = "";
      });
    };
  }, [active, listingId, total]);

  if (!total) {
    return (
      <div
        className={`${
          compact ? "aspect-[4/3]" : "aspect-[16/10] rounded-xl"
        } bg-gray-800 flex items-center justify-center text-gray-400 text-sm`}
      >
        Photos coming soon
      </div>
    );
  }

  const markLoaded = (i) => setLoaded((prev) => ({ ...prev, [i]: true }));

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const countBadge = `${active + 1}/${total}`;
  const thumbIndexes = Array.from({ length: total }, (_, i) => i);

  const MainImage = ({ className = "", showControls = true }) => (
    <div
      className={`relative bg-gray-900 overflow-hidden ${className}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {!loaded[active] && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-800 to-gray-700" />
      )}
      <img
        key={`${listingId}-${active}`}
        src={photoUrl(listingId, active)}
        alt={`${alt} — photo ${active + 1} of ${total}`}
        onLoad={() => markLoaded(active)}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/images/buyers-hero.jpg";
          markLoaded(active);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded[active] ? "opacity-100" : "opacity-0"
        }`}
        decoding="async"
        fetchPriority={active === 0 ? "high" : "auto"}
      />

      {showControls && total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900 text-xl leading-none active:scale-95 transition-transform"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900 text-xl leading-none active:scale-95 transition-transform"
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs font-medium px-3 py-1 rounded-full tabular-nums">
        {countBadge}
      </span>
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
          <MainImage className={compact ? "aspect-[16/10] sm:aspect-[16/9]" : "aspect-[16/10] sm:aspect-[16/9]"} />
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-semibold active:scale-95 transition-transform"
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
                className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-opacity ${
                  i === active
                    ? "border-[#CFB36E] opacity-100"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                aria-label={`Photo ${i + 1}`}
                aria-current={i === active}
              >
                <img
                  src={photoUrl(listingId, i)}
                  alt=""
                  loading={Math.abs(i - active) <= 2 ? "eager" : "lazy"}
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/buyers-hero.jpg";
                  }}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className={`text-sm font-semibold text-gray-700 hover:text-black underline underline-offset-2 ${
            compact ? "px-3" : ""
          }`}
        >
          View all {total} photos
        </button>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[110] bg-black flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <span className="text-sm font-medium tabular-nums">{countBadge}</span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-2xl"
              aria-label="Close gallery"
            >
              ×
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-2 sm:px-8">
            <MainImage className="w-full max-h-full max-w-6xl aspect-auto h-full" />
          </div>
          {total > 1 && (
            <div className="shrink-0 flex gap-2 overflow-x-auto px-4 py-3 justify-center">
              {thumbIndexes.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`w-14 h-10 rounded overflow-hidden flex-shrink-0 border-2 ${
                    i === active ? "border-[#CFB36E]" : "border-transparent opacity-60"
                  }`}
                >
                  <img
                    src={photoUrl(listingId, i)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/images/buyers-hero.jpg";
                    }}
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
