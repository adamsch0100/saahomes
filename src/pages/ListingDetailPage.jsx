import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import QualifyCta from "../components/QualifyCta";
import ListingMap from "../components/ListingMap";
import SaveSearchModal from "../components/SaveSearchModal";
import ScheduleShowingModal from "../components/ScheduleShowingModal";
import PaymentCalculator from "../components/PaymentCalculator";
import CityStatsBand from "../components/CityStatsBand";
import { photoUrl } from "../utils/photoUrl.js";
import { CITY_HOMES, getCityHomesPath } from "../data/cityHomesData";
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

/** Grouped feature sections — Zillow/Realtor "All details" pattern */
const FEATURE_GROUPS = [
  {
    title: "Interior",
    rows: (f) => [
      ["Architectural Style", f.style],
      ["Levels / Stories", f.levels],
      ["Structure Type", f.structure_type],
      ["Basement", f.basement],
      ["Interior Features", f.interior],
      ["Appliances", f.appliances],
      ["Flooring", f.flooring],
      ["Cooling", f.cooling],
      ["Heating", f.heating],
      ["Fireplace", f.fireplaces],
      ["Laundry", f.laundry],
      ["Windows", f.windows],
      ["Door Features", f.doors],
      ["Security Features", f.security],
      ["Other Equipment", f.other_equipment],
      ["Accessibility", f.accessibility],
    ],
  },
  {
    title: "Exterior",
    rows: (f) => [
      ["Construction", f.construction],
      ["Roof", f.roof],
      ["Exterior Features", f.exterior],
      ["Pool", f.pool],
      ["Spa / Hot Tub", f.spa],
      ["Parking", f.parking],
      ["Total Parking", f.parking_total],
      ["Other Parking", f.other_parking],
      ["Fencing", f.fencing],
      ["Patio & Porch", f.patio],
      ["Other Structures", f.other_structures],
      ["View", f.view],
      ["Waterfront", f.waterfront ? (f.water_body || "Yes") : null],
      ["Water Body", f.water_body],
      ["Horse Amenities", f.horse],
    ],
  },
  {
    title: "Utilities & Lot",
    rows: (f) => [
      ["Electric", f.electric],
      ["Sewer", f.sewer],
      ["Water Source", f.water_source],
      ["Utilities", f.utilities],
      ["Irrigation", f.irrigation],
      ["Irrigation Water Rights", f.irrigation_rights ? "Yes" : null],
      ["Zoning", f.zoning],
      ["Lot Features", f.lot_features],
    ],
  },
  {
    title: "Community",
    rows: (f) => [
      ["Community Features", f.community],
      ["Pets Allowed", f.pets],
      ["HOA Name", f.association_name],
      ["HOA Phone", f.association_phone],
      ["HOA Includes", f.association_includes],
      ["MLS Area", f.mls_area],
    ],
  },
  {
    title: "Build & Programs",
    rows: (f) => [
      ["Builder", f.builder],
      ["Builder Model", f.builder_model],
      ["New Construction", f.new_construction ? "Yes" : null],
      ["Energy Efficient", f.green_efficient],
      ["Green Verification", f.green_verification],
      ["Listing Terms", f.listing_terms],
      ["Special Conditions", f.special_conditions],
      ["Availability", f.availability],
    ],
  },
];

function displayValue(v) {
  if (v == null || v === "" || v === false) return null;
  if (typeof v === "string" && !v.trim()) return null;
  return String(v);
}

function KeyFact({ label, value }) {
  const shown = displayValue(value);
  if (!shown || shown === "—") return null;
  return (
    <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="font-semibold text-gray-900 mt-0.5 text-sm sm:text-base">{shown}</p>
    </div>
  );
}

function FactRow({ label, value }) {
  const shown = displayValue(value);
  if (!shown) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5">
      <span className="text-gray-500 text-sm shrink-0">{label}</span>
      <span className="text-gray-900 text-sm font-medium text-right">{shown}</span>
    </div>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

/** Zillow-style photo gallery: main image, thumbs, swipe, counter, keyboard, fullscreen */
function PhotoGallery({ listingId, photos, photosCount, alt }) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loaded, setLoaded] = useState({});
  const touchStartX = useRef(null);
  const rootRef = useRef(null);
  // Prefer photos array length; fall back to photos_count so proxy indices still work
  const total = Math.max(
    Array.isArray(photos) ? photos.length : 0,
    Number(photosCount) > 0 ? Number(photosCount) : 0
  );

  useEffect(() => {
    setActive(0);
    setLoaded({});
  }, [listingId]);

  const go = useCallback((dir) => {
    setActive((i) => {
      if (total <= 0) return 0;
      const next = i + dir;
      if (next < 0) return total - 1;
      if (next >= total) return 0;
      return next;
    });
  }, [total]);

  // Keyboard arrows always (when not typing in an input); Escape closes fullscreen
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

  // Preload adjacent images via photoUrl proxy for instant next/prev
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
      <div className="aspect-[16/10] rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 text-sm">
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
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded[active] ? "opacity-100" : "opacity-0"}`}
        decoding="async"
        fetchPriority={active === 0 ? "high" : "auto"}
      />

      {showControls && total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900 text-xl leading-none"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900 text-xl leading-none"
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

  // Thumbnail strip: use total count so proxy indices work even if photos array is short
  const thumbIndexes = Array.from({ length: total }, (_, i) => i);

  return (
    <>
      <div ref={rootRef} className="space-y-3" tabIndex={-1}>
        <div className="relative rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#CFB36E]">
          <MainImage className="aspect-[16/10] sm:aspect-[16/9]" />
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-semibold"
            aria-label="Open full-screen photo gallery"
          >
            Expand
          </button>
        </div>

        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" role="listbox" aria-label="Photo thumbnails">
            {thumbIndexes.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-opacity ${
                  i === active ? "border-[#CFB36E] opacity-100" : "border-transparent opacity-70 hover:opacity-100"
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
          className="text-sm font-semibold text-gray-700 hover:text-black underline underline-offset-2"
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

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-black pt-24 sm:pt-28 pb-6">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="h-8 w-2/3 max-w-md bg-white/10 rounded" />
          <div className="h-7 w-40 bg-[#CFB36E]/30 rounded" />
          <div className="h-4 w-64 bg-white/10 rounded" />
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="aspect-[16/9] rounded-xl bg-white/10" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
          <div className="h-32 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

function AgentCard({ openNadia, listing }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center shrink-0">
          <span className="text-[#CFB36E] font-serif font-bold text-lg">SAA</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">Your local agents</p>
          <h3 className="text-lg font-bold text-gray-900 font-serif mt-0.5">
            Adam &amp; Mandi Schwartz
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Schwartz and Associates · Coldwell Banker Realty
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <a href="tel:+19709991407" className="font-semibold text-gray-900 hover:text-[#CFB36E]">
              (970) 999-1407
            </a>
            <a href="https://saahomes.com" className="text-gray-600 hover:text-black underline underline-offset-2">
              saahomes.com
            </a>
          </div>
          <p className="mt-3 text-[11px] text-gray-500 flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-3.5 h-3.5 border border-gray-400 rounded-sm text-[8px] leading-3.5 text-center font-bold text-gray-500">
              =
            </span>
            Equal Housing Opportunity
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ScheduleShowingModal
              listing={listing}
              buttonLabel="Schedule a Showing"
              buttonClassName="inline-flex items-center justify-center px-5 py-2.5 font-semibold rounded-lg text-sm"
              buttonStyle={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
            />
            <button
              type="button"
              onClick={openNadia}
              className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-300 text-gray-900 font-semibold rounded-lg text-sm hover:border-black"
            >
              Ask Nadia
            </button>
            <a
              href="tel:+19709991407"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-black text-black font-semibold rounded-lg text-sm hover:bg-black hover:text-white"
            >
              Call
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  const { slug } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [saved, setSaved] = useState(false);
  const [match, setMatch] = useState({ matches: false, reasons: [] });
  const [shareCopied, setShareCopied] = useState(false);
  const [openFeatureGroups, setOpenFeatureGroups] = useState({});

  useEffect(() => {
    if (!slug) return;
    setListing(null);
    setError(null);
    fetch(`${API_BASE}/api/listings/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Listing not found");
        return res.json();
      })
      .then((data) => setListing(data.data))
      .catch((err) => setError(err.message));
  }, [slug]);

  // Property-view tracking for signed-in users (lead score + digest personalization)
  useEffect(() => {
    if (!listing) return;
    const lid = listing.listing_id || listing.id;
    if (!lid) return;
    fetch(`${API_BASE}/api/alerts/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ listing_id: String(lid) }),
    }).catch(() => { /* guest or offline — ignore */ });
  }, [listing]);

  useEffect(() => {
    if (!listing || !listing.city) return;
    // Similar: same city, same home_type, beds ±1, price ±20%, exclude self, limit 6–8
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
    if (listing.home_type) {
      params.set("type", listing.home_type);
    }
    const bedsN = listing.beds != null ? Number(listing.beds) : null;
    if (bedsN != null && Number.isFinite(bedsN)) {
      // API beds is min; client filters upper bound (beds + 1)
      params.set("beds", String(Math.max(0, Math.floor(bedsN - 1))));
    }
    fetch(`${API_BASE}/api/listings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const rows = d.data || [];
        const filtered = rows.filter((l) => {
          if (!l) return false;
          if (l.slug === listing.slug) return false;
          if (l.listing_id && listing.listing_id && l.listing_id === listing.listing_id) return false;
          if (bedsN != null && Number.isFinite(bedsN) && l.beds != null) {
            const b = Number(l.beds);
            if (Number.isFinite(b) && (b < bedsN - 1 || b > bedsN + 1)) return false;
          }
          return true;
        });
        setSimilar(filtered.slice(0, 8));
      })
      .catch(() => setSimilar([]));
    setSaved(isHomeSaved(listing.slug));
    setMatch(matchSavedSearch(listing, getSavedSearches()));
  }, [listing]);

  useEffect(() => {
    document.body.classList.add("listing-detail-page");
    return () => document.body.classList.remove("listing-detail-page");
  }, []);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Listing not found</h1>
        <p className="text-gray-600 mt-3">
          This property may no longer be active.{" "}
          <Link to="/properties/" className="underline text-black">Search current listings</Link>{" "}
          or call us at <a href="tel:+19709991407" className="underline">(970) 999-1407</a>.
        </p>
      </div>
    );
  }

  if (!listing) return <DetailSkeleton />;

  const address = listingAddress(listing);
  const fullAddress = listingFullAddress(listing);
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const feats = listing.features || {};
  const citySlug = (listing.city || "").toLowerCase().replace(/\s+/g, "-");
  const cityHomes = CITY_HOMES.find((c) => c.slug === citySlug);
  const { isNew, priceCut, priceCutPct, isNewConstruction, dom } = listingBadges(listing);
  const sqft = listing.living_area;
  const pricePerSqft = listing.price_per_sqft
    ?? (listing.list_price && sqft ? Math.round(listing.list_price / sqft) : null);
  const priceChangeDate = formatDate(listing.price_change_timestamp);
  const lotLabel =
    listing.lot_size_acres != null
      ? `${listing.lot_size_acres} acres`
      : listing.lot_size != null
        ? fmtSqft(listing.lot_size)
        : null;
  const hoaLabel =
    listing.hoa_fee != null
      ? `${formatPrice(listing.hoa_fee)}${feats.assoc_fee_freq ? ` / ${String(feats.assoc_fee_freq).toLowerCase()}` : ""}`
      : null;

  const featureSections = FEATURE_GROUPS.map((g) => ({
    title: g.title,
    items: g.rows(feats).filter(([, v]) => displayValue(v)),
  })).filter((g) => g.items.length > 0);

  const hasFinancial =
    listing.hoa_fee != null
    || feats.tax_annual != null
    || feats.tax_year != null
    || feats.zoning
    || feats.parcel
    || feats.association_name
    || feats.association_phone
    || feats.association_includes
    || feats.disclosures
    || feats.assoc_fee_freq;

  const onToggleSave = () => setSaved(toggleSavedHome(listing.slug));

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : `https://saahomes.com/homes-for-sale/${listing.slug}/`;
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

  const likeThisFilters = {
    city: listing.city || undefined,
    minPrice: listing.list_price ? String(Math.max(0, Math.round(Number(listing.list_price) * 0.8))) : undefined,
    maxPrice: listing.list_price ? String(Math.round(Number(listing.list_price) * 1.2)) : undefined,
    beds: listing.beds != null ? String(listing.beds) : undefined,
    baths: listing.baths != null ? String(listing.baths) : undefined,
    type: listing.home_type || undefined,
  };

  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${fullAddress} — Homes for Sale`,
    url: `https://saahomes.com/homes-for-sale/${listing.slug}/`,
    description: listing.description
      ? listing.description.slice(0, 250)
      : `${fullAddress} in ${listing.city}, CO`,
    image: photos.length ? `https://saahomes.com/api/photo/${listing.id}/0` : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: address || undefined,
      addressLocality: listing.city || undefined,
      addressRegion: listing.state || "CO",
      postalCode: listing.postal_code || undefined,
    },
    offers: {
      "@type": "Offer",
      price: listing.list_price != null ? Number(listing.list_price) : undefined,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    ...(listing.latitude && listing.longitude
      ? { geo: { "@type": "GeoCoordinates", latitude: Number(listing.latitude), longitude: Number(listing.longitude) } }
      : {}),
    ...(listing.beds != null ? { numberOfRooms: Number(listing.beds) } : {}),
    ...(listing.baths != null ? { numberOfBathroomsTotal: Number(listing.baths) } : {}),
    ...(sqft != null ? { floorSize: { "@type": "QuantitativeValue", value: Number(sqft), unitCode: "FTK" } } : {}),
    ...(listing.year_built ? { yearBuilt: Number(listing.year_built) } : {}),
  };

  const metaDesc = [
    `${fullAddress} — ${formatPrice(listing.list_price)}`,
    listing.beds != null ? `${listing.beds} bd` : "",
    listing.baths != null ? `${listing.baths} ba` : "",
    sqft != null ? `${Number(sqft).toLocaleString()} sqft` : "",
    "in",
    listing.city,
    "Colorado.",
    listing.elementary_school ? `Served by ${listing.elementary_school} Elementary.` : "",
    "Schedule a showing with Schwartz and Associates at SAA Homes — (970) 999-1407.",
  ].filter(Boolean).join(" ");

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
      { "@type": "ListItem", position: 2, name: "Homes for Sale", item: "https://saahomes.com/properties/" },
      ...(listing.city
        ? [{ "@type": "ListItem", position: 3, name: `${listing.city} Homes for Sale`, item: `https://saahomes.com/${citySlug}-homes-for-sale/` }]
        : []),
      {
        "@type": "ListItem",
        position: listing.city ? 4 : 3,
        name: fullAddress,
        item: `https://saahomes.com/homes-for-sale/${listing.slug}/`,
      },
    ],
  };

  const ogImage = photos.length ? `https://saahomes.com/api/photo/${listing.id}/0` : undefined;

  const openNadia = () => {
    window.dispatchEvent(
      new CustomEvent("open-nadia-chat", {
        detail: {
          message: `Hi! I'm interested in ${fullAddress} (${formatPrice(listing.list_price)}). Can you tell me more?`,
        },
      })
    );
  };

  const toggleGroup = (title) => {
    setOpenFeatureGroups((prev) => ({
      ...prev,
      [title]: prev[title] === false ? true : prev[title] === true ? false : false,
    }));
  };

  const isGroupOpen = (title, index) => {
    if (openFeatureGroups[title] === false) return false;
    if (openFeatureGroups[title] === true) return true;
    // First two groups open by default on mobile/desktop
    return index < 2;
  };

  return (
    <>
      <SEO
        title={`${fullAddress} | ${listing.city} Real Estate | SAA Homes`}
        description={metaDesc.slice(0, 158)}
        canonicalPath={`/homes-for-sale/${listing.slug}/`}
        ogImage={ogImage}
        jsonLd={[listingSchema, breadcrumbSchema]}
      />

      {/* ── 1–2. Hero: header block + gallery ───────────────────────── */}
      <section className="bg-black pt-24 sm:pt-28">
        <div className="max-w-7xl mx-auto px-4 pb-4 sm:pb-6">
          <nav className="text-xs text-gray-400 mb-3 flex flex-wrap gap-1.5" aria-label="Breadcrumb">
            <Link to="/properties/" className="hover:text-white">Homes for sale</Link>
            <span>/</span>
            {listing.city && (
              <>
                <Link to={`/${citySlug}-homes-for-sale/`} className="hover:text-white">
                  {listing.city}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-gray-300 truncate max-w-[200px] sm:max-w-none">{address}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif leading-tight">
                {fullAddress}
              </h1>

              {/* Price + status badges */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2.5">
                <span className="text-2xl sm:text-3xl font-bold text-[#CFB36E] tracking-tight">
                  {formatPrice(listing.list_price)}
                </span>
                {priceCut && (
                  <span className="text-gray-400 text-sm line-through">
                    {formatPrice(listing.original_list_price)}
                  </span>
                )}
                {isNew && (
                  <span className="bg-[#CFB36E] text-black text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    New
                  </span>
                )}
                {priceCut && (
                  <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    Price reduced{priceCutPct ? ` ${priceCutPct}%` : ""}
                  </span>
                )}
                {isNewConstruction && (
                  <span className="border border-[#CFB36E] text-[#CFB36E] text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    New construction
                  </span>
                )}
                {listing.status && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${
                    listing.status === "Active"
                      ? "border-emerald-400/80 text-emerald-400"
                      : "border-white/40 text-gray-300"
                  }`}>
                    {listing.status}
                  </span>
                )}
              </div>

              {priceCut && (
                <div className="mt-3 inline-flex items-start gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 max-w-lg">
                  <span className="text-emerald-400 text-sm font-bold shrink-0">↓</span>
                  <p className="text-sm text-emerald-100 leading-snug">
                    <strong className="text-white">Price drop:</strong> was{" "}
                    {formatPrice(listing.original_list_price)}
                    {priceCutPct ? ` — now ${priceCutPct}% lower` : ""}.
                    {dom != null ? ` ${dom} day${Number(dom) === 1 ? "" : "s"} on market.` : ""}
                    {priceChangeDate ? ` Changed ${priceChangeDate}.` : ""}
                  </p>
                </div>
              )}

              {/* Quick facts strip under price */}
              <p className="text-gray-300 mt-2.5 text-sm sm:text-base">
                {listing.beds != null && (
                  <>
                    <span className="font-semibold text-white">{listing.beds}</span>
                    <span> bd</span>
                  </>
                )}
                {listing.baths != null && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{listing.baths}</span>
                    <span> ba</span>
                  </>
                )}
                {listing.half_baths != null && Number(listing.half_baths) > 0 && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{listing.half_baths}</span>
                    <span> half-ba</span>
                  </>
                )}
                {listing.three_quarter_baths != null && Number(listing.three_quarter_baths) > 0 && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{listing.three_quarter_baths}</span>
                    <span> ¾-ba</span>
                  </>
                )}
                {sqft != null && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{Number(sqft).toLocaleString()}</span>
                    <span> sqft</span>
                  </>
                )}
                {pricePerSqft != null && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span>${pricePerSqft}/sqft</span>
                  </>
                )}
              </p>
              <p className="text-gray-400 mt-1 text-sm">
                {HOME_TYPE_LABEL[listing.home_type] || listing.property_subtype || listing.property_type}
                {listing.subdivision && <span> · {listing.subdivision}</span>}
                {listing.school_district && <span> · {listing.school_district}</span>}
              </p>

              {match.matches && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#CFB36E]/15 border border-[#CFB36E]/40 px-3 py-1.5">
                  <span className="text-[#CFB36E] text-xs" aria-hidden="true">★</span>
                  <p className="text-xs sm:text-sm text-[#CFB36E] font-semibold">
                    Matches your saved search
                    {match.reasons.length > 0 && match.reasons[0] !== "your saved search"
                      ? `: ${match.reasons.slice(0, 3).join(" · ")}`
                      : ""}
                  </p>
                </div>
              )}
            </div>

            {/* Desktop: Save + Share + Get alerts */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <button
                type="button"
                title="Go back"
                aria-label="Go back"
                onClick={() =>
                  window.history.length > 1
                    ? window.history.back()
                    : (window.location.href = "/properties/")
                }
                className="w-10 h-10 rounded-full border border-white/30 hover:border-white text-white/80 hover:text-white flex items-center justify-center transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white text-white text-sm font-semibold hover:bg-white hover:text-black transition-colors"
              >
                <ShareIcon />
                {shareCopied ? "Link copied" : "Share"}
              </button>
              <button
                type="button"
                onClick={onToggleSave}
                title={saved ? "Saved on this device" : "Save on this device"}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  saved
                    ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                    : "border-white text-white hover:bg-white hover:text-black"
                }`}
              >
                <HeartIcon filled={saved} />
                {saved ? "Saved" : "Save"}
              </button>
              <SaveSearchModal
                filters={likeThisFilters}
                buttonLabel="Get alerts"
                buttonClassName="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#CFB36E] text-[#CFB36E] text-sm font-semibold hover:bg-[#CFB36E] hover:text-black transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-6">
          <PhotoGallery
            listingId={listing.id}
            photos={photos}
            photosCount={listing.photos_count}
            alt={fullAddress}
          />
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-8 sm:py-10 grid lg:grid-cols-3 gap-8 pb-28 lg:pb-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Mobile action row */}
          <div className="sm:hidden flex gap-2 -mt-2">
            <button
              type="button"
              onClick={onToggleSave}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold ${
                saved ? "bg-[#CFB36E] border-[#CFB36E] text-black" : "border-gray-300 text-gray-900"
              }`}
            >
              <HeartIcon filled={saved} />
              {saved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={onShare}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-900"
            >
              <ShareIcon />
              {shareCopied ? "Copied" : "Share"}
            </button>
            <button
              type="button"
              onClick={openNadia}
              className="flex-1 inline-flex items-center justify-center px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-900"
            >
              Ask Nadia
            </button>
          </div>

          {!hasAnySavedSearch() && !match.matches && (
            <div className="rounded-xl border border-[#CFB36E]/40 bg-[#CFB36E]/10 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Like homes similar to this?</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Get alerts for new listings and price drops in this range — no spam.
                </p>
              </div>
              <SaveSearchModal
                filters={likeThisFilters}
                buttonLabel="Get alerts for homes like this"
                buttonClassName="shrink-0 px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-lg"
              />
            </div>
          )}

          {/* Est. payment — mobile (desktop lives in sticky sidebar) */}
          {listing.list_price != null && Number(listing.list_price) > 0 && (
            <div className="lg:hidden">
              <PaymentCalculator
                listPrice={listing.list_price}
                taxAnnual={feats.tax_annual}
                hoaFee={listing.hoa_fee}
                hoaFreq={feats.assoc_fee_freq}
                variant="card"
              />
            </div>
          )}

          {/* 4. Key facts strip */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Key Facts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KeyFact label="Price" value={formatPrice(listing.list_price)} />
              <KeyFact label="Price / Sq Ft" value={pricePerSqft != null ? `$${pricePerSqft}` : null} />
              <KeyFact label="Status" value={listing.status} />
              <KeyFact label="Beds" value={listing.beds != null ? String(listing.beds) : null} />
              <KeyFact label="Baths" value={listing.baths != null ? String(listing.baths) : null} />
              <KeyFact
                label="Half Baths"
                value={listing.half_baths != null && Number(listing.half_baths) > 0 ? String(listing.half_baths) : null}
              />
              <KeyFact
                label="¾ Baths"
                value={
                  listing.three_quarter_baths != null && Number(listing.three_quarter_baths) > 0
                    ? String(listing.three_quarter_baths)
                    : null
                }
              />
              <KeyFact label="Living Area" value={fmtSqft(sqft)} />
              <KeyFact
                label="Above Grade"
                value={listing.above_grade_area != null ? fmtSqft(listing.above_grade_area) : null}
              />
              <KeyFact label="Lot Size" value={lotLabel} />
              <KeyFact label="Year Built" value={listing.year_built ? String(listing.year_built) : null} />
              <KeyFact label="Days on Market" value={dom != null ? String(dom) : null} />
              <KeyFact label="Property Type" value={listing.property_subtype || listing.property_type} />
              <KeyFact
                label="Garage"
                value={listing.garage_spaces != null ? `${listing.garage_spaces} spaces` : null}
              />
              <KeyFact label="HOA Fee" value={hoaLabel} />
              <KeyFact
                label="Units"
                value={listing.units_total != null && Number(listing.units_total) > 1 ? String(listing.units_total) : null}
              />
              <KeyFact label="County" value={listing.county || null} />
              <KeyFact label="Subdivision" value={listing.subdivision || null} />
              <KeyFact label="MLS #" value={listing.listing_id || null} />
              <KeyFact label="Parcel #" value={feats.parcel || null} />
            </div>
          </div>

          {/* 5. Description */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">About this home</h2>
            {listing.description ? (
              <p className="text-gray-700 leading-relaxed whitespace-pre-line text-[15px] sm:text-base">
                {listing.description}
              </p>
            ) : (
              <p className="text-gray-500 text-sm">
                Contact us for details about this property —{" "}
                <a href="tel:+19709991407" className="underline text-gray-800">(970) 999-1407</a>.
              </p>
            )}
          </div>

          {/* 7. Virtual tour (when present) */}
          {feats.virtual_tour && (
            <div className="rounded-xl border border-[#CFB36E]/50 bg-[#CFB36E]/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Virtual Tour</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Walk through this home online before you visit in person.
                </p>
              </div>
              <a
                href={feats.virtual_tour}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 text-sm"
              >
                Open virtual tour
              </a>
            </div>
          )}

          {/* 6. All details — grouped features */}
          {featureSections.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">All Details</h2>
              <p className="text-sm text-gray-500 mb-4">
                Property features from the MLS listing. Empty fields are omitted.
              </p>
              <div className="space-y-3">
                {featureSections.map((section, idx) => {
                  const open = isGroupOpen(section.title, idx);
                  return (
                    <div key={section.title} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleGroup(section.title)}
                        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 bg-gray-50 hover:bg-gray-100 text-left"
                        aria-expanded={open}
                      >
                        <span className="font-semibold text-gray-900 text-sm sm:text-base">
                          {section.title}
                          <span className="ml-2 text-gray-400 font-normal text-xs">
                            {section.items.length}
                          </span>
                        </span>
                        <span className="text-gray-500 text-lg leading-none" aria-hidden="true">
                          {open ? "−" : "+"}
                        </span>
                      </button>
                      {open && (
                        <div className="px-4 sm:px-5 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                          {section.items.map(([label, value]) => (
                            <FactRow key={label} label={label} value={value} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 8. Price history — honest, data-derived */}
          {(listing.list_price != null || listing.original_list_price != null || dom != null) && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Price History</h2>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        Current list
                        {priceChangeDate && priceCut ? (
                          <span className="block text-xs text-gray-500 font-normal sm:hidden mt-0.5">
                            {priceChangeDate}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {formatPrice(listing.list_price)}
                        {priceCut && priceCutPct != null && (
                          <span className="ml-2 text-emerald-600 text-xs font-bold">
                            −{priceCutPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {[
                          priceChangeDate && priceCut ? `Changed ${priceChangeDate}` : null,
                          dom != null ? `${dom} day${Number(dom) === 1 ? "" : "s"} on market` : null,
                        ].filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                    {listing.original_list_price != null
                      && Number(listing.original_list_price) !== Number(listing.list_price) && (
                      <tr>
                        <td className="px-4 py-3 text-gray-900 font-medium">Original list</td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatPrice(listing.original_list_price)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                          {priceCut
                            ? `Difference ${formatPrice(Number(listing.original_list_price) - Number(listing.list_price))}`
                            : Number(listing.original_list_price) < Number(listing.list_price)
                              ? "Price increased from original"
                              : "—"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {pricePerSqft != null && (
                  <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
                    ${pricePerSqft} per sq ft based on current list price
                    {sqft != null ? ` and ${Number(sqft).toLocaleString()} sq ft living area` : ""}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 13 partial: HOA / taxes / zoning / disclosures */}
          {hasFinancial && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">HOA, Taxes &amp; Zoning</h2>
              <div className="rounded-xl border border-gray-200 px-4 sm:px-5 py-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <FactRow label="HOA Fee" value={hoaLabel} />
                <FactRow label="HOA Name" value={feats.association_name} />
                <FactRow label="HOA Phone" value={feats.association_phone} />
                <FactRow label="HOA Includes" value={feats.association_includes} />
                <FactRow
                  label="Annual Taxes"
                  value={feats.tax_annual != null ? formatPrice(feats.tax_annual) : null}
                />
                <FactRow
                  label="Tax Year"
                  value={feats.tax_year != null ? String(feats.tax_year) : null}
                />
                <FactRow label="Zoning" value={feats.zoning} />
                <FactRow label="Parcel #" value={feats.parcel} />
              </div>
              {feats.disclosures && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-amber-800 font-semibold">Disclosures</p>
                  <p className="text-sm text-amber-950 mt-1 leading-relaxed">{feats.disclosures}</p>
                </div>
              )}
            </div>
          )}

          {/* 9. Schools */}
          {(listing.elementary_school || listing.middle_school || listing.high_school || listing.school_district) && (
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Schools</h2>
              <p className="text-gray-500 text-sm mb-4">
                School attendance zones are assigned by the district and can change — verify with the district before relying on them.
              </p>
              {listing.school_district && (
                <p className="text-sm text-gray-700 mb-3">
                  <span className="font-semibold">District:</span> {listing.school_district}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  ["Elementary", listing.elementary_school],
                  ["Middle School", listing.middle_school],
                  ["High School", listing.high_school],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
                      <p className="font-semibold text-gray-900 mt-1">{value}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 10. Map + neighborhood */}
          {listing.latitude && listing.longitude && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Location &amp; Neighborhood</h2>
              <div className="rounded-xl overflow-hidden border border-gray-200 h-[320px]">
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
                  interactive
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Map pin is approximate. Confirm boundaries and floodplain status with surveys and local sources.
              </p>
              {feats.directions && (
                <p className="text-sm text-gray-600 mt-3">
                  <span className="font-semibold text-gray-800">Directions: </span>
                  {feats.directions}
                </p>
              )}
            </div>
          )}

          {/* City market stats — live from our Active inventory */}
          {listing.city && <CityStatsBand city={listing.city} />}

          <div className="bg-black text-white rounded-xl p-6">
            <h2 className="text-xl font-bold font-serif mb-2">About {listing.city}</h2>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              {cityHomes
                ? cityHomes.intro
                : `${listing.city} is one of the Northern Colorado communities served by Schwartz and Associates at SAA Homes.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/northern-colorado-areas/${citySlug}/`}
                className="px-4 py-2 bg-[#CFB36E] text-black text-sm font-semibold rounded-lg hover:bg-[#bd9f5a]"
              >
                {listing.city} Neighborhood Guide
              </Link>
              <Link
                to={getCityHomesPath(citySlug)}
                className="px-4 py-2 border border-white text-white text-sm font-semibold rounded-lg hover:bg-white hover:text-black"
              >
                All {listing.city} Homes for Sale
              </Link>
            </div>
          </div>

          {/* 11. Similar homes carousel — same city, type, beds ±1, price ±20% */}
          {similar.length > 0 && (
            <div>
              <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Similar Homes in {listing.city}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Same area
                    {listing.home_type ? ` · ${HOME_TYPE_LABEL[listing.home_type] || listing.home_type}` : ""}
                    {listing.beds != null ? ` · ${listing.beds}±1 beds` : ""}
                    {listing.list_price != null ? " · price ±20%" : ""}
                  </p>
                </div>
                <Link
                  to={getCityHomesPath(citySlug)}
                  className="text-sm font-semibold text-gray-700 underline underline-offset-2 shrink-0"
                >
                  See all
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0">
                {similar.map((l) => {
                  const b = listingBadges(l);
                  const hasPhoto = (Array.isArray(l.photos) && l.photos.length > 0) || Number(l.photos_count) > 0;
                  return (
                    <Link
                      key={l.listing_id || l.id || l.slug}
                      to={`/homes-for-sale/${l.slug}/`}
                      className="group block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow min-w-[260px] w-[78vw] max-w-sm snap-start sm:min-w-0 sm:w-auto sm:max-w-none"
                    >
                      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                        <img
                          src={hasPhoto ? photoUrl(l.id, 0) : "/images/buyers-hero.jpg"}
                          alt={`${l.street_name || "Home"} in ${l.city}`}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/images/buyers-hero.jpg";
                          }}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {b.priceCut && (
                          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            Price reduced
                          </span>
                        )}
                        {b.isNew && !b.priceCut && (
                          <span className="absolute top-2 left-2 bg-[#CFB36E] text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            New
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-gray-900">{formatPrice(l.list_price)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {l.beds != null ? `${Number(l.beds)} bd` : ""}
                          {l.baths != null ? ` · ${Number(l.baths)} ba` : ""}
                          {l.living_area != null ? ` · ${Number(l.living_area).toLocaleString()} sqft` : ""}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {[l.street_number, l.street_name].filter(Boolean).join(" ")}
                          {l.city ? `, ${l.city}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* 12. Agent card */}
          <AgentCard openNadia={openNadia} listing={listing} />

          {/* 13. IDX disclaimer footer */}
          <div className="border-t border-gray-200 pt-6 text-xs text-gray-500 leading-relaxed space-y-2">
            <p>
              Listing data provided by {listing.mls_source || "IRES"} MLS via IDX. Information is
              deemed reliable but not guaranteed. All measurements and square footage are approximate.
              Buyer should verify all information with independent sources before making decisions.
            </p>
            {feats.showing_instructions && (
              <p>
                <span className="font-semibold text-gray-600">Showing instructions: </span>
                {feats.showing_instructions}
              </p>
            )}
            <p className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block w-3.5 h-3.5 border border-gray-400 rounded-sm text-[8px] leading-3.5 text-center font-bold">
                =
              </span>
              Equal Housing Opportunity · Schwartz and Associates, Coldwell Banker Realty ·{" "}
              <a href="tel:+19709991407" className="underline hover:text-gray-800">(970) 999-1407</a>
            </p>
          </div>
        </div>

        {/* 3. Sticky conversion card — desktop */}
        <aside className="space-y-4 lg:sticky lg:top-24 h-fit hidden lg:block">
          <div className="bg-black text-white rounded-xl p-6 shadow-xl">
            <p className="text-2xl font-bold text-[#CFB36E] tracking-tight">
              {formatPrice(listing.list_price)}
            </p>
            {priceCut && (
              <p className="text-sm text-emerald-400 mt-1">
                Price reduced{priceCutPct ? ` ${priceCutPct}%` : ""}
                {listing.original_list_price != null && (
                  <span className="text-gray-400 line-through ml-2">
                    {formatPrice(listing.original_list_price)}
                  </span>
                )}
              </p>
            )}
            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
              {listing.beds != null ? `${listing.beds} bd` : ""}
              {listing.baths != null ? ` · ${listing.baths} ba` : ""}
              {sqft != null ? ` · ${Number(sqft).toLocaleString()} sqft` : ""}
            </p>
            <p className="text-gray-400 text-xs mt-1 truncate">{fullAddress}</p>

            <div className="mt-5 space-y-3">
              <ScheduleShowingModal
                listing={listing}
                buttonLabel="Schedule a Showing"
                buttonClassName="w-full inline-flex items-center justify-center px-6 py-3.5 font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                buttonStyle={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
              />
              <button
                type="button"
                onClick={openNadia}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors cursor-pointer"
              >
                Ask Nadia
              </button>
              {feats.virtual_tour && (
                <a
                  href={feats.virtual_tour}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-6 py-3.5 border border-[#CFB36E] text-[#CFB36E] font-semibold rounded-lg hover:bg-[#CFB36E] hover:text-black transition-colors"
                >
                  Virtual Tour
                </a>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleSave}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg border text-sm font-semibold transition-colors ${
                    saved
                      ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                      : "border-white/40 text-white hover:border-white"
                  }`}
                >
                  <HeartIcon filled={saved} />
                  {saved ? "Saved" : "Save"}
                </button>
                <a
                  href="tel:+19709991407"
                  className="inline-flex items-center justify-center px-3 py-3 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Call
                </a>
              </div>
              <SaveSearchModal
                filters={likeThisFilters}
                buttonLabel="Get alerts for homes like this"
                buttonClassName="w-full inline-flex items-center justify-center px-6 py-3 border border-white/40 text-white text-sm font-semibold rounded-lg hover:border-white transition-colors"
              />
              {hoaLabel && (
                <p className="text-xs text-gray-400 pt-1">HOA: {hoaLabel}</p>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
              Listing data from {listing.mls_source || "IRES"} MLS. IDX information provided by IRES.
            </p>
          </div>

          {/* Est. payment calculator — desktop sticky stack */}
          {listing.list_price != null && Number(listing.list_price) > 0 && (
            <PaymentCalculator
              listPrice={listing.list_price}
              taxAnnual={feats.tax_annual}
              hoaFee={listing.hoa_fee}
              hoaFreq={feats.assoc_fee_freq}
              variant="card"
            />
          )}

          {/* Compact agent blurb under sticky card */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Listed with local experts</p>
            <p className="font-semibold text-gray-900 mt-1">Adam &amp; Mandi Schwartz</p>
            <p className="text-sm text-gray-600">SAA Homes · Coldwell Banker Realty</p>
            <a href="tel:+19709991407" className="text-sm font-semibold text-gray-900 mt-2 inline-block hover:text-[#CFB36E]">
              (970) 999-1407
            </a>
          </div>
        </aside>
      </section>

      {/* Mobile sticky conversion bar — Schedule primary (gold), Call, Ask Nadia, Save */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-2.5 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center gap-1.5 max-w-lg mx-auto">
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
            Ask Nadia
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

      <QualifyCta
        program={`a home in ${listing.city || "Northern Colorado"}`}
        chatQuestion={`Hi! I'm looking at a home in ${listing.city || "Northern Colorado"} and want to know if I'd qualify for a loan or CHFA assistance. Can you help?`}
        formAnchor="/contact/"
        formLabel="Ask a question instead"
      />
    </>
  );
}
