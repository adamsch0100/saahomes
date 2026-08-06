import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import QualifyCta from "../components/QualifyCta";
import ListingMap from "../components/ListingMap";
import SaveSearchModal from "../components/SaveSearchModal";
import ScheduleShowingModal from "../components/ScheduleShowingModal";
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

function KeyFact({ label, value }) {
  if (!value || value === "—" || value === "") return null;
  return (
    <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-100">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="font-semibold text-gray-900 mt-0.5 text-sm sm:text-base">{value}</p>
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

/** Zillow-style photo gallery: main image, thumbs, swipe, counter, fullscreen */
function PhotoGallery({ listingId, photos, alt }) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loaded, setLoaded] = useState({});
  const touchStartX = useRef(null);
  const total = photos.length;

  const go = useCallback((dir) => {
    setActive((i) => {
      const next = i + dir;
      if (next < 0) return total - 1;
      if (next >= total) return 0;
      return next;
    });
  }, [total]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen, go]);

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
        key={active}
        src={photoUrl(listingId, active)}
        alt={`${alt} — photo ${active + 1} of ${total}`}
        onLoad={() => markLoaded(active)}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/images/buyers-hero.jpg";
          markLoaded(active);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded[active] ? "opacity-100" : "opacity-0"}`}
      />

      {showControls && total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-gray-900"
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs font-medium px-3 py-1 rounded-full tabular-nums">
        {active + 1} / {total}
      </span>
    </div>
  );

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="block w-full text-left rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#CFB36E]"
          aria-label="Open full-screen photo gallery"
        >
          <MainImage className="aspect-[16/10] sm:aspect-[16/9]" />
        </button>

        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {photos.map((_, i) => (
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
                  loading="lazy"
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

      {/* Fullscreen lightbox */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[110] bg-black flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <span className="text-sm font-medium tabular-nums">{active + 1} / {total}</span>
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
              {photos.map((_, i) => (
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

export default function ListingDetailPage() {
  const { slug } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [saved, setSaved] = useState(false);
  const [match, setMatch] = useState({ matches: false, reasons: [] });

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

  useEffect(() => {
    if (!listing || !listing.city) return;
    const params = new URLSearchParams({ city: listing.city, limit: "4", sort: "newest" });
    if (listing.list_price) {
      const lo = Math.max(0, Number(listing.list_price) * 0.7);
      const hi = Number(listing.list_price) * 1.3;
      params.set("minPrice", String(Math.round(lo)));
      params.set("maxPrice", String(Math.round(hi)));
    }
    fetch(`${API_BASE}/api/listings?${params}`)
      .then((r) => r.json())
      .then((d) => setSimilar((d.data || []).filter((l) => l.slug !== listing.slug).slice(0, 3)))
      .catch(() => {});
    setSaved(isHomeSaved(listing.slug));
    setMatch(matchSavedSearch(listing, getSavedSearches()));
  }, [listing]);

  // Hide global floating bar on detail — we own the sticky conversion cluster
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

  const onToggleSave = () => setSaved(toggleSavedHome(listing.slug));

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

  return (
    <>
      <SEO
        title={`${fullAddress} | ${listing.city} Real Estate | SAA Homes`}
        description={metaDesc.slice(0, 158)}
        canonicalPath={`/homes-for-sale/${listing.slug}/`}
        ogImage={ogImage}
        jsonLd={[listingSchema, breadcrumbSchema]}
      />

      {/* ── Hero: price hierarchy + gallery ─────────────────────────── */}
      <section className="bg-black pt-24 sm:pt-28">
        <div className="max-w-7xl mx-auto px-4 pb-4 sm:pb-6">
          {/* Breadcrumb */}
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

              {/* Price + badges */}
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
                {listing.status === "Active" && (
                  <span className="border border-emerald-400/80 text-emerald-400 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    Active
                  </span>
                )}
              </div>

              {/* RealScout price-drop callout */}
              {priceCut && (
                <div className="mt-3 inline-flex items-start gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 max-w-lg">
                  <span className="text-emerald-400 text-sm font-bold shrink-0">↓</span>
                  <p className="text-sm text-emerald-100 leading-snug">
                    <strong className="text-white">Price drop:</strong> was{" "}
                    {formatPrice(listing.original_list_price)}
                    {priceCutPct ? ` — now ${priceCutPct}% lower` : ""}.
                    {dom != null ? ` ${dom} day${dom === 1 ? "" : "s"} on market.` : ""}
                  </p>
                </div>
              )}

              {/* Key stats strip */}
              <p className="text-gray-300 mt-2.5 text-sm sm:text-base">
                {listing.beds != null && <span className="font-semibold text-white">{listing.beds}</span>}
                {listing.beds != null && <span> bd</span>}
                {listing.baths != null && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{listing.baths}</span>
                    <span> ba</span>
                  </>
                )}
                {listing.half_baths != null && listing.half_baths > 0 && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{listing.half_baths}</span>
                    <span> half-ba</span>
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

              {/* Match explanation for savers */}
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

            {/* Desktop action cluster */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
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
                onClick={onToggleSave}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  saved
                    ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                    : "border-white text-white hover:bg-white hover:text-black"
                }`}
              >
                <HeartIcon filled={saved} />
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <PhotoGallery listingId={listing.id} photos={photos} alt={fullAddress} />
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-8 sm:py-10 grid lg:grid-cols-3 gap-8 pb-28 lg:pb-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Mobile save + type row */}
          <div className="sm:hidden flex gap-2 -mt-2">
            <button
              type="button"
              onClick={onToggleSave}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold ${
                saved ? "bg-[#CFB36E] border-[#CFB36E] text-black" : "border-gray-300 text-gray-900"
              }`}
            >
              <HeartIcon filled={saved} />
              {saved ? "Saved" : "Save this home"}
            </button>
            <button
              type="button"
              onClick={openNadia}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-900"
            >
              Ask Nadia
            </button>
          </div>

          {/* Save-search nudge for new visitors */}
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

          {/* Key facts */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Key Facts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KeyFact label="Price" value={formatPrice(listing.list_price)} />
              <KeyFact label="Price / Sq Ft" value={pricePerSqft != null ? `$${pricePerSqft}` : null} />
              <KeyFact label="Beds" value={listing.beds != null ? String(listing.beds) : null} />
              <KeyFact label="Baths" value={listing.baths != null ? String(listing.baths) : null} />
              <KeyFact label="Living Area" value={fmtSqft(sqft)} />
              <KeyFact
                label="Above Grade"
                value={listing.above_grade_area != null ? fmtSqft(listing.above_grade_area) : null}
              />
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
                    ? `${formatPrice(listing.hoa_fee)}${feats.assoc_fee_freq ? ` / ${feats.assoc_fee_freq.toLowerCase()}` : ""}`
                    : null
                }
              />
              <KeyFact label="County" value={listing.county || null} />
              <KeyFact label="Subdivision" value={listing.subdivision || null} />
              <KeyFact label="MLS #" value={listing.listing_id || null} />
              <KeyFact label="Parcel #" value={feats.parcel || null} />
            </div>
          </div>

          {/* About */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">About this home</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {listing.description || "Contact us for details about this property."}
            </p>
          </div>

          {/* Features & amenities */}
          {(() => {
            const rows = [
              ["Architectural Style", feats.style],
              ["Levels / Stories", feats.levels],
              ["Structure Type", feats.structure_type],
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
              ["Spa / Hot Tub", feats.spa],
              ["Parking", feats.parking],
              ["Total Parking", feats.parking_total],
              ["Other Parking", feats.other_parking],
              ["Fencing", feats.fencing],
              ["Patio & Porch", feats.patio],
              ["Windows", feats.windows],
              ["Security Features", feats.security],
              ["Door Features", feats.doors],
              ["Electric", feats.electric],
              ["Laundry", feats.laundry],
              ["Other Equipment", feats.other_equipment],
              ["Other Structures", feats.other_structures],
              ["Pets Allowed", feats.pets],
              ["View", feats.view],
              ["Waterfront", feats.waterfront ? (feats.water_body || "Yes") : null],
              ["Water Body", feats.water_body],
              ["Horse Amenities", feats.horse],
              ["Irrigation", feats.irrigation],
              ["Irrigation Water Rights", feats.irrigation_rights ? "Yes" : null],
              ["Sewer", feats.sewer],
              ["Water Source", feats.water_source],
              ["Utilities", feats.utilities],
              ["Zoning", feats.zoning],
              ["Lot Features", feats.lot_features],
              ["HOA Name", feats.association_name],
              ["HOA Includes", feats.association_includes],
              ["Builder", feats.builder],
              ["Builder Model", feats.builder_model],
              ["Listing Terms", feats.listing_terms],
              ["Special Conditions", feats.special_conditions],
              ["Energy Efficient", feats.green_efficient],
              ["Green Verification", feats.green_verification],
              ["Accessibility", feats.accessibility],
              ["Community Features", feats.community],
              ["MLS Area", feats.mls_area],
              ["Annual Taxes", feats.tax_annual != null ? formatPrice(feats.tax_annual) : null],
              ["Tax Year", feats.tax_year != null ? String(feats.tax_year) : null],
              ["Availability", feats.availability],
            ].filter(([, v]) => v);
            if (!rows.length) return null;
            return (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Features & Amenities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                      <span className="text-gray-500 text-sm">{label}</span>
                      <span className="text-gray-900 text-sm font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Schools — local depth */}
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

          {/* Area info */}
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

          {/* Map */}
          {listing.latitude && listing.longitude && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Location</h2>
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
            </div>
          )}

          {/* Similar homes */}
          {similar.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Similar Homes in {listing.city}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {similar.map((l) => {
                  const b = listingBadges(l);
                  return (
                    <Link
                      key={l.listing_id || l.id}
                      to={`/homes-for-sale/${l.slug}/`}
                      className="group block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                        <img
                          src={l.photos?.length ? photoUrl(l.id, 0) : "/images/buyers-hero.jpg"}
                          alt={`${l.street_name || "Home"} in ${l.city}`}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/images/buyers-hero.jpg";
                          }}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {b.priceCut && (
                          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            Price reduced
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-gray-900">{formatPrice(l.list_price)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {l.beds != null ? `${l.beds} bd` : ""}
                          {l.baths != null ? ` · ${l.baths} ba` : ""}
                          {l.living_area != null ? ` · ${Number(l.living_area).toLocaleString()} sqft` : ""}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {[l.street_number, l.street_name].filter(Boolean).join(" ")}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky conversion card — desktop */}
        <aside className="space-y-4 lg:sticky lg:top-24 h-fit hidden lg:block">
          <div className="bg-black text-white rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-bold font-serif">Interested in this home?</h2>
            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
              We&apos;ll walk you through pricing, neighborhood details, and whether you qualify for CHFA down payment assistance.
            </p>
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
                Chat about this home
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
              <SaveSearchModal
                filters={likeThisFilters}
                buttonLabel="Get alerts for homes like this"
                buttonClassName="w-full inline-flex items-center justify-center px-6 py-3.5 border border-white/40 text-white text-sm font-semibold rounded-lg hover:border-white transition-colors"
              />
              <a
                href="tel:+19709991407"
                className="w-full inline-flex items-center justify-center px-6 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Call (970) 999-1407
              </a>
              {listing.hoa_fee != null && (
                <p className="text-xs text-gray-400 pt-1">
                  HOA: {formatPrice(listing.hoa_fee)}
                  {feats.assoc_fee_freq ? ` / ${feats.assoc_fee_freq.toLowerCase()}` : ""}
                </p>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
              Listing data from {listing.mls_source || "IRES"} MLS. IDX information provided by IRES.{" "}
              {feats.showing_instructions ? `Showing instructions: ${feats.showing_instructions}` : ""}
            </p>
          </div>
        </aside>
      </section>

      {/* Mobile sticky conversion bar — Zillow pattern */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-3 pt-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <div className="min-w-0 flex-1 hidden xs:block sm:block">
            <p className="text-sm font-bold text-gray-900 truncate">{formatPrice(listing.list_price)}</p>
            <p className="text-[11px] text-gray-500 truncate">{address}</p>
          </div>
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
          <a
            href="tel:+19709991407"
            className="shrink-0 px-3 py-2.5 border-2 border-black text-black text-sm font-semibold rounded-lg"
          >
            Call
          </a>
          <div className="flex-1 min-w-[140px]">
            <ScheduleShowingModal
              listing={listing}
              buttonLabel="Schedule"
              buttonClassName="w-full inline-flex items-center justify-center px-3 py-2.5 bg-black text-white text-sm font-semibold rounded-lg"
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
