import React, { useCallback, useEffect, useRef, useState } from "react";
import ListingMap from "./ListingMap";
import SaveSearchModal from "./SaveSearchModal";
import ScheduleShowingModal from "./ScheduleShowingModal";
import { photoUrl } from "../utils/photoUrl.js";
import {
  formatPrice,
  fmtSqft,
  listingBadges,
  listingAddress,
  listingFullAddress,
  isHomeSaved,
  toggleSavedHome,
  matchSavedSearch,
  getSavedSearches,
  hasAnySavedSearch,
} from "../utils/listingHelpers.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const HOME_TYPE_LABEL = {
  detached: "Detached Home",
  attached: "Condo / Townhome / Attached",
  land: "Land",
  commercial: "Commercial",
  other: "Property",
};

function HeartIcon({ filled }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function KeyFact({ label, value }) {
  if (!value || value === "—" || value === "") return null;
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="font-semibold text-gray-900 mt-0.5 text-sm">{value}</p>
    </div>
  );
}

/** Compact gallery for the slide-over panel (Zillow-grade: skeleton → image, counter, thumbs) */
function PanelGallery({ listingId, photos, alt }) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState({});
  const touchStartX = useRef(null);
  const total = photos.length;

  useEffect(() => {
    setActive(0);
    setLoaded({});
  }, [listingId]);

  const go = useCallback(
    (dir) => {
      setActive((i) => {
        const next = i + dir;
        if (next < 0) return total - 1;
        if (next >= total) return 0;
        return next;
      });
    },
    [total]
  );

  if (!total) {
    return (
      <div className="aspect-[4/3] bg-gray-800 flex items-center justify-center text-gray-400 text-sm">
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

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-[4/3] bg-gray-900 overflow-hidden"
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
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900 text-lg"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900 text-lg"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}

        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs font-medium px-2.5 py-0.5 rounded-full tabular-nums">
          {active + 1} / {total}
        </span>
      </div>

      {total > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-1">
          {photos.slice(0, 12).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative w-14 h-11 rounded-md overflow-hidden flex-shrink-0 border-2 transition-opacity ${
                i === active ? "border-[#CFB36E] opacity-100" : "border-transparent opacity-70 hover:opacity-100"
              }`}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === active}
            >
              <img
                src={photoUrl(listingId, i)}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/images/buyers-hero.jpg";
                }}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          {total > 12 && (
            <span className="flex-shrink-0 self-center text-xs text-gray-500 pl-1">+{total - 12}</span>
          )}
        </div>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-7 w-36 bg-gray-200 rounded" />
        <div className="h-4 w-48 bg-gray-100 rounded" />
        <div className="h-4 w-40 bg-gray-100 rounded" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg" />
          ))}
        </div>
        <div className="h-24 bg-gray-100 rounded-lg" />
        <div className="h-12 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * ListingDetailPanel — Zillow-style central search → detail overlay.
 * Desktop (~md+): centered dialog (~1024px) over dimmed search, scale-in.
 * Mobile: full-screen sheet with safe-area padding.
 * Search stays mounted underneath; full SEO page remains at /homes-for-sale/:slug.
 */
export default function ListingDetailPanel({ slug, onClose }) {
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [match, setMatch] = useState({ matches: false, reasons: [] });
  const [shareCopied, setShareCopied] = useState(false);
  const [entered, setEntered] = useState(false);
  const scrollRef = useRef(null);
  const panelRef = useRef(null);

  // Entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Fetch listing when slug changes (opening a new card replaces content)
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setListing(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    let cancelled = false;
    fetch(`${API_BASE}/api/listings/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Listing not found");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setListing(data.data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Could not load listing");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!listing) return;
    setSaved(isHomeSaved(listing.slug));
    setMatch(matchSavedSearch(listing, getSavedSearches()));
  }, [listing]);

  // ESC closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while panel is open (mobile sheet especially)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus panel for a11y
  useEffect(() => {
    panelRef.current?.focus();
  }, [slug]);

  const address = listing ? listingAddress(listing) : "";
  const fullAddress = listing ? listingFullAddress(listing) : "";
  const photos = listing && Array.isArray(listing.photos) ? listing.photos : [];
  const feats = listing?.features || {};
  const badges = listing ? listingBadges(listing) : {};
  const { isNew, priceCut, priceCutPct, isNewConstruction, dom } = badges;
  const sqft = listing?.living_area;
  const pricePerSqft =
    listing?.price_per_sqft ??
    (listing?.list_price && sqft ? Math.round(listing.list_price / sqft) : null);

  const likeThisFilters = listing
    ? {
        city: listing.city || undefined,
        minPrice: listing.list_price
          ? String(Math.max(0, Math.round(Number(listing.list_price) * 0.8)))
          : undefined,
        maxPrice: listing.list_price
          ? String(Math.round(Number(listing.list_price) * 1.2))
          : undefined,
        beds: listing.beds != null ? String(listing.beds) : undefined,
        baths: listing.baths != null ? String(listing.baths) : undefined,
        type: listing.home_type || undefined,
      }
    : {};

  const onToggleSave = () => {
    if (!listing?.slug) return;
    setSaved(toggleSavedHome(listing.slug));
  };

  const fullPageUrl = listing?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : "https://saahomes.com"}/homes-for-sale/${listing.slug}/`
    : "";

  const onShare = async () => {
    if (!listing?.slug) return;
    const url = fullPageUrl;
    const text = `${fullAddress} — ${formatPrice(listing.list_price)}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: fullAddress, text, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      /* user cancelled share */
    }
  };

  const openNadia = () => {
    window.dispatchEvent(
      new CustomEvent("open-nadia-chat", {
        detail: {
          message: listing
            ? `Hi! I'm interested in ${fullAddress} (${formatPrice(listing.list_price)}). Can you tell me more?`
            : "Hi! I'd like help with a home I saw in search.",
        },
      })
    );
  };

  const featureRows = (() => {
    if (!listing) return [];
    return [
      ["Architectural Style", feats.style],
      ["Levels / Stories", feats.levels],
      ["Basement", feats.basement],
      ["Construction", feats.construction],
      ["Roof", feats.roof],
      ["Interior Features", feats.interior],
      ["Exterior Features", feats.exterior],
      ["Appliances", feats.appliances],
      ["Flooring", feats.flooring],
      ["Cooling", feats.cooling],
      ["Heating", feats.heating],
      ["Fireplace", feats.fireplaces],
      ["Pool", feats.pool],
      ["Parking", feats.parking],
      ["Garage", listing.garage_spaces != null ? `${listing.garage_spaces} spaces` : null],
      ["Fencing", feats.fencing],
      ["Patio & Porch", feats.patio],
      ["View", feats.view],
      ["Waterfront", feats.waterfront ? feats.water_body || "Yes" : null],
      ["Sewer", feats.sewer],
      ["Water Source", feats.water_source],
      ["Utilities", feats.utilities],
      ["Zoning", feats.zoning],
      ["Lot Features", feats.lot_features],
      ["HOA Name", feats.association_name],
      ["HOA Includes", feats.association_includes],
      ["Builder", feats.builder],
      ["MLS Area", feats.mls_area],
      ["Annual Taxes", feats.tax_annual != null ? formatPrice(feats.tax_annual) : null],
    ].filter(([, v]) => v);
  })();

  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      {/* Backdrop — click closes (desktop dim over map/list) */}
      <button
        type="button"
        aria-label="Close listing details"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Zillow-style central modal:
        Desktop: large centered dialog (~1024px) over the dimmed search.
        Mobile: full-screen sheet sliding up + safe-area. */}
      <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={fullAddress || "Listing details"}
          tabIndex={-1}
          className={`
            absolute bg-white shadow-2xl flex flex-col outline-none
            inset-x-0 bottom-0 top-0
            pt-[env(safe-area-inset-top,0px)]
            md:inset-4 md:pt-0 md:mx-auto md:max-w-5xl md:rounded-2xl md:overflow-hidden
            transition-[transform,opacity] duration-300 ease-out
            ${entered
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-full md:translate-y-0 md:scale-[0.96] opacity-0 md:opacity-100"}
          `}
        >
        {/* Sticky header bar */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200 bg-white z-10">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-semibold text-gray-800 hover:bg-gray-100"
            aria-label="Close and return to search"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back to search</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="flex items-center gap-1.5">
            {listing && (
              <>
                <button
                  type="button"
                  onClick={onShare}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 text-gray-800 hover:border-black transition-colors"
                  aria-label={shareCopied ? "Link copied" : "Share this home"}
                  title={shareCopied ? "Link copied" : "Share"}
                >
                  <ShareIcon />
                </button>
                <button
                  type="button"
                  onClick={onToggleSave}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full border text-sm transition-colors ${
                    saved
                      ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                      : "border-gray-300 text-gray-800 hover:border-black"
                  }`}
                  aria-label={saved ? "Unsave home" : "Save this home on this device"}
                  title={saved ? "Saved on this device" : "Save on this device"}
                >
                  <HeartIcon filled={saved} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl text-gray-700 leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {loading && <PanelSkeleton />}

          {!loading && error && (
            <div className="p-8 text-center">
              <p className="text-lg font-semibold text-gray-900">Listing not found</p>
              <p className="text-sm text-gray-500 mt-2">
                This property may no longer be active.{" "}
                <button type="button" onClick={onClose} className="underline text-black font-medium">
                  Return to search
                </button>
              </p>
            </div>
          )}

          {!loading && !error && listing && (
            <>
              <PanelGallery listingId={listing.id} photos={photos} alt={fullAddress} />

              <div className="p-4 sm:p-5 space-y-6 pb-28">
                {/* Price + badges */}
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                      {formatPrice(listing.list_price)}
                    </p>
                    {priceCut && listing.original_list_price != null && (
                      <p className="text-sm text-gray-400 line-through">
                        {formatPrice(listing.original_list_price)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {isNew && (
                      <span className="bg-[#CFB36E] text-black text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
                        New
                      </span>
                    )}
                    {priceCut && (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
                        Price reduced{priceCutPct ? ` ${priceCutPct}%` : ""}
                      </span>
                    )}
                    {isNewConstruction && (
                      <span className="bg-black text-white text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
                        New construction
                      </span>
                    )}
                    {listing.status === "Active" && (
                      <span className="border border-emerald-500 text-emerald-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>

                  {priceCut && (
                    <div className="mt-2.5 inline-flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <span className="text-emerald-600 text-sm font-bold shrink-0">↓</span>
                      <p className="text-sm text-emerald-900 leading-snug">
                        <strong>Price drop:</strong> was {formatPrice(listing.original_list_price)}
                        {priceCutPct ? ` — now ${priceCutPct}% lower` : ""}.
                        {dom != null ? ` ${dom} day${dom === 1 ? "" : "s"} on market.` : ""}
                      </p>
                    </div>
                  )}

                  <p className="text-sm text-gray-700 mt-2.5 font-medium">
                    {listing.beds != null && <span>{listing.beds} bd</span>}
                    {listing.baths != null && <span> · {listing.baths} ba</span>}
                    {listing.half_baths != null && listing.half_baths > 0 && (
                      <span> · {listing.half_baths} half-ba</span>
                    )}
                    {sqft != null && <span> · {Number(sqft).toLocaleString()} sqft</span>}
                    {pricePerSqft != null && <span> · ${pricePerSqft}/sqft</span>}
                  </p>

                  <h2 className="text-base sm:text-lg font-bold text-gray-900 mt-2 leading-snug">
                    {address || "Address available on request"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {[listing.city, listing.state, listing.postal_code].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {HOME_TYPE_LABEL[listing.home_type] || listing.property_subtype || listing.property_type}
                    {listing.subdivision && <span> · {listing.subdivision}</span>}
                  </p>

                  {match.matches && (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8a7340] bg-[#CFB36E]/15 px-2 py-0.5 rounded-full">
                      <span aria-hidden="true">★</span>
                      Matches your saved search
                      {match.reasons.length > 0 && match.reasons[0] !== "your saved search"
                        ? `: ${match.reasons.slice(0, 2).join(" · ")}`
                        : ""}
                    </p>
                  )}
                </div>

                {/* Conversion cluster */}
                <div className="rounded-xl bg-black text-white p-4 space-y-2.5 shadow-lg">
                  <p className="text-sm font-semibold font-serif">Interested in this home?</p>
                  <ScheduleShowingModal
                    listing={listing}
                    buttonLabel="Schedule a Showing"
                    buttonClassName="w-full inline-flex items-center justify-center px-4 py-3 font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    buttonStyle={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={openNadia}
                      className="inline-flex items-center justify-center px-3 py-2.5 rounded-lg border border-white/40 text-white text-sm font-semibold hover:border-white transition-colors"
                    >
                      💬 Ask Nadia
                    </button>
                    <button
                      type="button"
                      onClick={onShare}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/40 text-white text-sm font-semibold hover:border-white transition-colors"
                    >
                      <ShareIcon />
                      {shareCopied ? "Copied" : "Share"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onToggleSave}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                        saved
                          ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                          : "border-white/40 text-white hover:border-white"
                      }`}
                      title="Saves on this device only"
                    >
                      <HeartIcon filled={saved} />
                      {saved ? "Saved" : "Save"}
                    </button>
                    <a
                      href="tel:+19709991407"
                      className="inline-flex items-center justify-center px-3 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Call
                    </a>
                  </div>
                  <SaveSearchModal
                    filters={likeThisFilters}
                    buttonLabel="Get alerts for homes like this"
                    buttonClassName="w-full inline-flex items-center justify-center px-4 py-2.5 border border-white/40 text-white text-sm font-semibold rounded-lg hover:border-white transition-colors"
                  />
                  <p className="text-[11px] text-white/50 text-center leading-snug">
                    ♡ Save keeps this home on your device. Get alerts creates your account &amp; emails matches.
                  </p>
                  {feats.virtual_tour && (
                    <a
                      href={feats.virtual_tour}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-[#CFB36E] text-[#CFB36E] text-sm font-semibold rounded-lg hover:bg-[#CFB36E] hover:text-black transition-colors"
                    >
                      Virtual Tour
                    </a>
                  )}
                </div>

                {!hasAnySavedSearch() && !match.matches && (
                  <div className="rounded-xl border border-[#CFB36E]/40 bg-[#CFB36E]/10 px-3.5 py-3">
                    <p className="text-sm font-semibold text-gray-900">Like homes similar to this?</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Get alerts for new listings and price drops in this range — no spam.
                    </p>
                    <div className="mt-2">
                      <SaveSearchModal
                        filters={likeThisFilters}
                        buttonLabel="Get alerts for homes like this"
                        buttonClassName="px-3 py-2 bg-black text-white text-sm font-semibold rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Key facts */}
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-2.5">Key Facts</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <KeyFact label="Price" value={formatPrice(listing.list_price)} />
                    <KeyFact label="Price / Sq Ft" value={pricePerSqft != null ? `$${pricePerSqft}` : null} />
                    <KeyFact label="Beds" value={listing.beds != null ? String(listing.beds) : null} />
                    <KeyFact label="Baths" value={listing.baths != null ? String(listing.baths) : null} />
                    <KeyFact label="Living Area" value={fmtSqft(sqft)} />
                    <KeyFact
                      label="Lot Size"
                      value={
                        listing.lot_size_acres != null
                          ? `${listing.lot_size_acres} acres`
                          : listing.lot_size != null
                            ? fmtSqft(listing.lot_size)
                            : null
                      }
                    />
                    <KeyFact label="Year Built" value={listing.year_built ? String(listing.year_built) : null} />
                    <KeyFact label="Days on Market" value={dom != null ? String(dom) : null} />
                    <KeyFact label="Property Type" value={listing.property_subtype || listing.property_type} />
                    <KeyFact
                      label="Garage"
                      value={listing.garage_spaces != null ? `${listing.garage_spaces} spaces` : null}
                    />
                    <KeyFact
                      label="HOA Fee"
                      value={
                        listing.hoa_fee != null
                          ? `${formatPrice(listing.hoa_fee)}${
                              feats.assoc_fee_freq ? ` / ${feats.assoc_fee_freq.toLowerCase()}` : ""
                            }`
                          : null
                      }
                    />
                    <KeyFact label="County" value={listing.county || null} />
                    <KeyFact label="MLS #" value={listing.listing_id || null} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">About this home</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {listing.description || "Contact us for details about this property."}
                  </p>
                </div>

                {/* Features */}
                {featureRows.length > 0 && (
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-2.5">Features & Amenities</h3>
                    <div className="space-y-2">
                      {featureRows.map(([label, value]) => (
                        <div
                          key={label}
                          className="flex justify-between gap-3 border-b border-gray-100 pb-1.5"
                        >
                          <span className="text-gray-500 text-xs shrink-0">{label}</span>
                          <span className="text-gray-900 text-xs font-medium text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schools */}
                {(listing.elementary_school ||
                  listing.middle_school ||
                  listing.high_school ||
                  listing.school_district) && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h3 className="text-base font-bold text-gray-900 mb-1">Schools</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Attendance zones can change — verify with the district.
                    </p>
                    {listing.school_district && (
                      <p className="text-xs text-gray-700 mb-2">
                        <span className="font-semibold">District:</span> {listing.school_district}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        ["Elementary", listing.elementary_school],
                        ["Middle School", listing.middle_school],
                        ["High School", listing.high_school],
                      ]
                        .filter(([, v]) => v)
                        .map(([label, value]) => (
                          <div key={label} className="bg-white rounded-lg border border-gray-200 p-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
                            <p className="font-semibold text-gray-900 text-sm mt-0.5">{value}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Map */}
                {listing.latitude && listing.longitude && (
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-2">Location</h3>
                    <div className="rounded-xl overflow-hidden border border-gray-200 h-[220px]">
                      <ListingMap
                        listings={[
                          {
                            id: listing.id,
                            slug: listing.slug,
                            latitude: Number(listing.latitude),
                            longitude: Number(listing.longitude),
                            list_price: listing.list_price,
                            street_name: listing.street_name,
                            street_number: listing.street_number,
                            city: listing.city,
                            beds: listing.beds,
                            baths: listing.baths,
                            living_area: listing.living_area,
                            photos: photos.slice(0, 1),
                          },
                        ]}
                        interactive={false}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Map pin is approximate. Confirm boundaries with surveys and local sources.
                    </p>
                  </div>
                )}

                {/* Open full page — SEO route preserved */}
                <div className="rounded-xl border border-gray-200 p-4 text-center space-y-2">
                  <a
                    href={`/homes-for-sale/${listing.slug}/`}
                    className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-900 underline underline-offset-2 hover:text-black"
                  >
                    Open full page
                    <span aria-hidden="true">↗</span>
                  </a>
                  <p className="text-xs text-gray-500">
                    Shareable link with full details, similar homes, and neighborhood guides.
                  </p>
                  <button
                    type="button"
                    onClick={onShare}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black"
                  >
                    <ShareIcon />
                    {shareCopied ? "Link copied!" : "Copy shareable link"}
                  </button>
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Listing data from {listing.mls_source || "IRES"} MLS. IDX information provided by IRES.
                  Deemed reliable but not guaranteed.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Mobile sticky bottom CTA — Save · Nadia · Call · Schedule */}
        {!loading && listing && (
          <div className="shrink-0 md:hidden border-t border-gray-200 bg-white px-2.5 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSave}
                className={`w-11 h-11 shrink-0 rounded-full border flex items-center justify-center ${
                  saved ? "bg-[#CFB36E] border-[#CFB36E] text-black" : "border-gray-300 text-gray-800"
                }`}
                aria-label={saved ? "Unsave home" : "Save home"}
              >
                <HeartIcon filled={saved} />
              </button>
              <button
                type="button"
                onClick={openNadia}
                className="shrink-0 px-2.5 py-2.5 border border-gray-300 text-gray-900 text-xs font-semibold rounded-lg"
              >
                Nadia
              </button>
              <a
                href="tel:+19709991407"
                className="shrink-0 px-2.5 py-2.5 border-2 border-black text-black text-xs font-semibold rounded-lg"
              >
                Call
              </a>
              <div className="flex-1 min-w-0">
                <ScheduleShowingModal
                  listing={listing}
                  buttonLabel="Schedule"
                  buttonClassName="w-full inline-flex items-center justify-center px-3 py-2.5 text-sm font-semibold rounded-lg"
                  buttonStyle={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
                  hideIcon
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
