import React, { useEffect, useRef, useState } from "react";
import {
  formatPrice,
  listingFullAddress,
  matchSavedSearch,
  getSavedSearches,
} from "../utils/listingHelpers.js";
import {
  PhotoGallery,
  ListingDetailContent,
  MobileStickyBar,
  PanelDetailSkeleton,
  HeartIcon,
  ShareIcon,
} from "./detail";
import AccountModal from "./AccountModal";
import {
  fetchSessionUser,
  fetchSavedStatus,
  listingKeyOf,
  migrateLocalSavedHomes,
  notifySavedHomesChanged,
  saveHomeApi,
  unsaveHomeApi,
} from "../utils/savedHomesApi.js";
import { isHomeSaved as isLocalHomeSaved } from "../utils/listingHelpers.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

/**
 * ListingDetailPanel — premium wide popup for search → detail.
 * Desktop: max-w-7xl two-column (content left, sticky conversion rail right).
 * Mobile: full-screen sheet + sticky bottom bar (Save · Nadia · Call · Schedule).
 * Full SEO page remains at /homes-for-sale/:slug.
 */
export default function ListingDetailPanel({ slug, onClose }) {
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState([]);
  const [saved, setSaved] = useState(false);
  const [match, setMatch] = useState({ matches: false, reasons: [] });
  const [shareCopied, setShareCopied] = useState(false);
  const [entered, setEntered] = useState(false);
  const [showSaveLogin, setShowSaveLogin] = useState(false);
  const [pendingSaveAfterLogin, setPendingSaveAfterLogin] = useState(false);
  const scrollRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setListing(null);
    setSimilar([]);
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
    setMatch(matchSavedSearch(listing, getSavedSearches()));
    // Heart state: account-linked when signed in, else localStorage fallback
    let cancelled = false;
    (async () => {
      const key = listingKeyOf(listing);
      const keys = [listing.listing_id, listing.slug, listing.id != null ? String(listing.id) : null]
        .filter(Boolean)
        .map(String);
      const user = await fetchSessionUser();
      if (cancelled) return;
      if (!user) {
        setSaved(isLocalHomeSaved(listing.slug) || keys.some((k) => isLocalHomeSaved(k)));
        return;
      }
      await migrateLocalSavedHomes();
      if (cancelled) return;
      const map = await fetchSavedStatus(keys.length ? keys : [key]);
      if (cancelled) return;
      setSaved(keys.some((k) => map[k]) || Boolean(map[String(key)]));
    })();
    const lid = listing.listing_id || listing.id;
    if (lid) {
      fetch(`${API_BASE}/api/alerts/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ listing_id: String(lid) }),
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [listing]);

  // Similar homes (same city, type, beds ±1, price ±20%)
  useEffect(() => {
    if (!listing || !listing.city) {
      setSimilar([]);
      return undefined;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      city: listing.city,
      limit: "16",
      sort: "newest",
      status: "Active",
    });
    if (listing.list_price) {
      const price = Number(listing.list_price);
      params.set("minPrice", String(Math.round(Math.max(0, price * 0.8))));
      params.set("maxPrice", String(Math.round(price * 1.2)));
    }
    if (listing.home_type) params.set("type", listing.home_type);
    const bedsN = listing.beds != null ? Number(listing.beds) : null;
    if (bedsN != null && Number.isFinite(bedsN)) {
      params.set("beds", String(Math.max(0, Math.floor(bedsN - 1))));
    }
    fetch(`${API_BASE}/api/listings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = d.data || [];
        const filtered = rows.filter((l) => {
          if (!l) return false;
          if (l.slug === listing.slug) return false;
          if (l.listing_id && listing.listing_id && l.listing_id === listing.listing_id) {
            return false;
          }
          if (bedsN != null && Number.isFinite(bedsN) && l.beds != null) {
            const b = Number(l.beds);
            if (Number.isFinite(b) && (b < bedsN - 1 || b > bedsN + 1)) return false;
          }
          return true;
        });
        setSimilar(filtered.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setSimilar([]);
      });
    return () => {
      cancelled = true;
    };
  }, [listing]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, [slug]);

  const fullAddress = listing ? listingFullAddress(listing) : "";
  const photos = listing && Array.isArray(listing.photos) ? listing.photos : [];

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

  const onToggleSave = async () => {
    if (!listing) return;
    const key = listingKeyOf(listing);
    if (!key) return;
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) await saveHomeApi(key);
      else await unsaveHomeApi(key);
      notifySavedHomesChanged({ listingKey: key, saved: next });
    } catch (err) {
      setSaved(!next);
      if (err?.status === 401) {
        setPendingSaveAfterLogin(true);
        setShowSaveLogin(true);
      }
    }
  };

  const afterSaveLogin = async () => {
    if (!listing || !pendingSaveAfterLogin) return;
    setPendingSaveAfterLogin(false);
    const key = listingKeyOf(listing);
    if (!key) return;
    setSaved(true);
    try {
      await saveHomeApi(key);
      notifySavedHomesChanged({ listingKey: key, saved: true });
    } catch {
      setSaved(false);
    }
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

  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      <button
        type="button"
        aria-label="Close listing details"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Wide premium modal: max-w-7xl / fluid up to 1280px */}
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
          md:inset-4 md:pt-0 md:mx-auto md:w-[min(92vw,1280px)] md:max-w-7xl md:rounded-2xl md:overflow-hidden
          transition-[transform,opacity] duration-300 ease-out
          ${
            entered
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-full md:translate-y-0 md:scale-[0.96] opacity-0 md:opacity-100"
          }
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
                  className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full border border-gray-300 text-gray-800 hover:border-black active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
                  aria-label={shareCopied ? "Link copied" : "Share this home"}
                  title={shareCopied ? "Link copied" : "Share"}
                >
                  <ShareIcon />
                </button>
                <button
                  type="button"
                  onClick={onToggleSave}
                  className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full border text-sm active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E] ${
                    saved
                      ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                      : "border-gray-300 text-gray-800 hover:border-black"
                  }`}
                  aria-label={saved ? "Remove from saved homes" : "Save this home"}
                  title={saved ? "Saved" : "Save home"}
                >
                  <HeartIcon filled={saved} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl text-gray-700 leading-none active:scale-95 transition-transform touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable body — gallery + two-column content; rail sticks within this scroller */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {loading && <PanelDetailSkeleton />}

          {!loading && error && (
            <div className="p-8 text-center">
              <p className="text-lg font-semibold text-gray-900">Listing not found</p>
              <p className="text-sm text-gray-500 mt-2">
                This property may no longer be active.{" "}
                <button
                  type="button"
                  onClick={onClose}
                  className="underline text-black font-medium"
                >
                  Return to search
                </button>
              </p>
            </div>
          )}

          {!loading && !error && listing && (
            <>
              <div className="bg-black">
                <PhotoGallery
                  listingId={listing.id}
                  photos={photos}
                  photosCount={listing.photos_count}
                  alt={fullAddress}
                  compact
                />
              </div>

              <ListingDetailContent
                listing={listing}
                similar={similar}
                saved={saved}
                onToggleSave={onToggleSave}
                openNadia={openNadia}
                likeThisFilters={likeThisFilters}
                match={match}
                shareCopied={shareCopied}
                onShare={onShare}
                variant="panel"
                stickyTopClass="lg:top-4"
                mapInteractive={false}
              />
            </>
          )}
        </div>

        {/* Mobile sticky bottom CTA */}
        {!loading && listing && (
          <MobileStickyBar
            listing={listing}
            saved={saved}
            onToggleSave={onToggleSave}
            openNadia={openNadia}
            mode="footer"
          />
        )}
      </div>
      <AccountModal
        open={showSaveLogin}
        onClose={() => {
          setShowSaveLogin(false);
          setPendingSaveAfterLogin(false);
        }}
        onSuccess={afterSaveLogin}
        purpose="save-home"
        askIntent
        showSuccess={false}
      />
    </div>
  );
}
