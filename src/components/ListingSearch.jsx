import { useState, useEffect, useRef, useCallback } from "react";
import { photoUrl } from "../utils/photoUrl.js";
import { useSearchParams } from "react-router-dom";
import ListingMap from "./ListingMap";
import SaveSearchModal from "./SaveSearchModal";
import {
  formatPrice,
  fmtNum,
  listingBadges,
  listingAddress,
  isHomeSaved,
  toggleSavedHome,
  matchSavedSearch,
  getSavedSearches,
  hasAnySavedSearch,
} from "../utils/listingHelpers.js";

/**
 * ListingSearch — Zillow-style split-view search for /properties/.
 * Desktop: sticky map left + scrollable cards right.
 * Mobile: Map | List toggle, collapsible filters.
 * RealScout touches: save-search CTA, match chip on cards for known savers.
 */

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const CITIES = [
  "Fort Collins", "Loveland", "Windsor", "Greeley", "Timnath", "Severance",
  "Wellington", "Johnstown", "Longmont", "Boulder", "Berthoud", "Firestone",
  "Frederick", "Evans", "Mead", "Milliken", "La Salle", "Eaton", "Niwot",
];

const PRICE_OPTIONS = [
  { label: "Any price", value: "" },
  { label: "Under $400K", value: "0-400000" },
  { label: "$400K – $600K", value: "400000-600000" },
  { label: "$600K – $800K", value: "600000-800000" },
  { label: "$800K – $1M", value: "800000-1000000" },
  { label: "$1M+", value: "1000000-" },
];

const BED_OPTIONS = [
  { label: "Any beds", value: "" }, { label: "1+", value: "1" }, { label: "2+", value: "2" },
  { label: "3+", value: "3" }, { label: "4+", value: "4" }, { label: "5+", value: "5" },
];

const BATH_OPTIONS = [
  { label: "Any baths", value: "" }, { label: "1+", value: "1" }, { label: "2+", value: "2" },
  { label: "3+", value: "3" }, { label: "4+", value: "4" },
];

const TYPE_OPTIONS = [
  { label: "All types", value: "" },
  { label: "Detached home", value: "detached" },
  { label: "Condo / townhome", value: "attached" },
  { label: "Land", value: "land" },
  { label: "Commercial", value: "commercial" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
];

const PAGE_SIZE = 40;

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-3.5 space-y-2.5">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="h-3.5 w-40 bg-gray-100 rounded" />
        <div className="h-3.5 w-32 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

function HeartButton({ slug, className = "" }) {
  const [saved, setSaved] = useState(() => isHomeSaved(slug));
  useEffect(() => { setSaved(isHomeSaved(slug)); }, [slug]);

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved homes" : "Save this home"}
      title={saved ? "Saved" : "Save home"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved(toggleSavedHome(slug));
      }}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/95 shadow-md border border-black/5 hover:scale-105 transition-transform ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
        fill={saved ? "#CFB36E" : "none"}
        stroke={saved ? "#CFB36E" : "#111"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

function ListingCard({ listing, selected, onHover, savedSearches }) {
  const { isNew, priceCut, priceCutPct, isNewConstruction } = listingBadges(listing);
  const match = matchSavedSearch(listing, savedSearches);
  const [imgLoaded, setImgLoaded] = useState(false);
  const addr = listingAddress(listing);

  return (
    <article
      id={`listing-card-${listing.id}`}
      onMouseEnter={() => onHover?.(listing.id)}
      className={`group relative rounded-xl overflow-hidden bg-white border transition-all duration-200 scroll-mt-24 ${
        selected
          ? "border-[#CFB36E] shadow-lg ring-2 ring-[#CFB36E]/35"
          : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
      }`}
    >
      <a href={`/homes-for-sale/${listing.slug}/`} className="block">
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-200" />
          )}
          {listing.photos?.length > 0 ? (
            <img
              src={photoUrl(listing.id, 0)}
              alt={`${addr} ${listing.city || ""}`}
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/images/buyers-hero.jpg";
                setImgLoaded(true);
              }}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              {listing.city || "Northern Colorado"}
            </div>
          )}

          {/* Badges — top left */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 max-w-[75%]">
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
              <span className="bg-black/85 text-white text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
                New construction
              </span>
            )}
          </div>

          {/* Heart — top right */}
          <div className="absolute top-2 right-2 z-10">
            <HeartButton slug={listing.slug} />
          </div>

          {/* Photo count hint */}
          {listing.photos?.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
              1 / {listing.photos.length}
            </span>
          )}
        </div>

        <div className="p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-lg font-bold text-gray-900 tracking-tight">
              {formatPrice(listing.list_price)}
            </p>
            {priceCut && listing.original_list_price != null && (
              <p className="text-xs text-gray-400 line-through">
                {formatPrice(listing.original_list_price)}
              </p>
            )}
          </div>

          <p className="text-sm text-gray-700 mt-1 font-medium">
            {listing.beds != null && <span>{fmtNum(listing.beds)} bd</span>}
            {listing.baths != null && <span> · {fmtNum(listing.baths)} ba</span>}
            {listing.living_area != null && (
              <span> · {Number(listing.living_area).toLocaleString()} sqft</span>
            )}
          </p>

          <p className="text-sm text-gray-900 mt-1.5 truncate font-medium">
            {addr || "Address available on request"}
          </p>
          <p className="text-sm text-gray-500 truncate">
            {[listing.city, listing.state, listing.postal_code].filter(Boolean).join(", ")}
          </p>

          {/* RealScout-style match chip */}
          {match.matches && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8a7340] bg-[#CFB36E]/15 px-2 py-0.5 rounded-full">
              <span aria-hidden="true">★</span>
              Matches your saved search
            </p>
          )}
        </div>
      </a>
    </article>
  );
}

export default function ListingSearch({ location, height = "700px", compact = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlLocation = searchParams.get("location") || location || "";
  const urlPrice =
    searchParams.get("price") ||
    (searchParams.get("minPrice") || searchParams.get("maxPrice")
      ? `${searchParams.get("minPrice") || ""}-${searchParams.get("maxPrice") || ""}`
      : "");

  const [filters, setFilters] = useState({
    city: searchParams.get("city") || urlLocation || "__noco__",
    price: urlPrice,
    beds: searchParams.get("beds") || "",
    baths: searchParams.get("baths") || "",
    type: searchParams.get("type") || "",
    sort: searchParams.get("sort") || "newest",
  });
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0, page: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("list"); // mobile: list default (Zillow-like); map toggle
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState(() =>
    typeof window !== "undefined" ? getSavedSearches() : []
  );
  const resultsRef = useRef(null);

  const buildParams = useCallback((f, pageNum = 1) => {
    const params = new URLSearchParams();
    if (f.city) params.set("city", f.city);
    if (f.price) {
      const [min, max] = f.price.split("-");
      if (min) params.set("minPrice", min);
      if (max) params.set("maxPrice", max);
    }
    if (f.beds) params.set("beds", f.beds);
    if (f.baths) params.set("baths", f.baths);
    if (f.type) params.set("type", f.type);
    if (f.sort) params.set("sort", f.sort);
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(pageNum));
    return params;
  }, []);

  const fetchListings = useCallback(async (f, pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = buildParams(f, pageNum);
      const res = await fetch(`${API_BASE}/api/listings?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const rows = data.data || [];
      setResults((prev) => (append ? [...prev, ...rows] : rows));
      setMeta(data.meta || { total: 0, pages: 0, page: pageNum });
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchListings(filters, 1, false);
  }, [filters, fetchListings]);

  // Refresh match chips when save-search completes
  useEffect(() => {
    const onStorage = () => setSavedSearches(getSavedSearches());
    window.addEventListener("saa-search-saved", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("saa-search-saved", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      const params = new URLSearchParams();
      if (next.city && next.city !== "__noco__") params.set("city", next.city);
      if (next.price) {
        const [min, max] = next.price.split("-");
        if (min) params.set("minPrice", min);
        if (max) params.set("maxPrice", max);
      }
      if (next.beds) params.set("beds", next.beds);
      if (next.baths) params.set("baths", next.baths);
      if (next.type) params.set("type", next.type);
      if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
      setSearchParams(params, { replace: true });
      return next;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      city: "__noco__",
      price: "",
      beds: "",
      baths: "",
      type: "",
      sort: "newest",
    });
    setSearchParams({}, { replace: true });
  };

  const activeFilterCount = [
    filters.city && filters.city !== "__noco__" && filters.city !== "__all__",
    filters.price,
    filters.beds,
    filters.baths,
    filters.type,
  ].filter(Boolean).length;

  const selectCard = (id) => {
    setSelectedId(id);
    const el = document.getElementById(`listing-card-${id}`);
    if (el && resultsRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const saveFilters = {
    city: filters.city && filters.city !== "__noco__" && filters.city !== "__all__" ? filters.city : undefined,
    minPrice: filters.price ? filters.price.split("-")[0] || undefined : undefined,
    maxPrice: filters.price ? filters.price.split("-")[1] || undefined : undefined,
    beds: filters.beds || undefined,
    baths: filters.baths || undefined,
    type: filters.type || undefined,
  };

  const selectClass =
    "px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-black focus:border-black outline-none min-w-0";

  const FilterControls = ({ mobile = false }) => (
    <div className={`flex ${mobile ? "flex-col gap-3" : "flex-wrap items-center gap-2"}`}>
      <select value={filters.city} onChange={(e) => setFilter("city", e.target.value)}
        className={selectClass} aria-label="City">
        <option value="__noco__">All Northern Colorado</option>
        <option value="__all__">All Colorado</option>
        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={filters.price} onChange={(e) => setFilter("price", e.target.value)}
        className={selectClass} aria-label="Price">
        {PRICE_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      <select value={filters.beds} onChange={(e) => setFilter("beds", e.target.value)}
        className={selectClass} aria-label="Beds">
        {BED_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      <select value={filters.baths} onChange={(e) => setFilter("baths", e.target.value)}
        className={selectClass} aria-label="Baths">
        {BATH_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)}
        className={selectClass} aria-label="Property type">
        {TYPE_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      {mobile && (
        <button
          type="button"
          onClick={() => setFiltersOpen(false)}
          className="w-full py-3 bg-black text-white font-semibold rounded-lg text-sm"
        >
          Show {meta.total > 0 ? meta.total.toLocaleString() : ""} homes
        </button>
      )}
    </div>
  );

  const resultLabel = (() => {
    if (filters.city && filters.city !== "__noco__" && filters.city !== "__all__") {
      return `${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"} in ${filters.city}`;
    }
    if (filters.city === "__all__") {
      return `${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"} in Colorado`;
    }
    return `${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"} in Northern Colorado`;
  })();

  return (
    <div className="flex flex-col bg-white" style={{ height: compact ? height : height }}>
      {/* Sticky filter bar — Zillow-style */}
      <div className="border-b border-gray-200 bg-white z-20 shrink-0">
        {/* Desktop filters */}
        <div className="hidden md:flex flex-wrap items-center gap-2 p-3 lg:px-4">
          <FilterControls />
          <div className="ml-auto flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-black underline underline-offset-2">
                Clear filters
              </button>
            )}
            <SaveSearchModal
              filters={saveFilters}
              buttonLabel="Save search"
              buttonClassName="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap"
            />
          </div>
        </div>

        {/* Mobile filter trigger + result row */}
        <div className="md:hidden flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-full text-sm font-semibold bg-white"
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-black text-white text-[10px] font-bold w-5 h-5 rounded-full inline-flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <SaveSearchModal
            filters={saveFilters}
            buttonLabel="Save"
            buttonClassName="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-full text-sm font-semibold bg-white"
          />
          <select
            value={filters.sort}
            onChange={(e) => setFilter("sort", e.target.value)}
            className="ml-auto px-2 py-2 border border-gray-300 rounded-lg text-xs bg-white"
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Mobile collapsible filters */}
        {filtersOpen && (
          <div className="md:hidden border-t border-gray-100 p-3 bg-gray-50">
            <FilterControls mobile />
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters}
                className="mt-2 text-sm text-gray-500 underline">
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Results meta + sort (desktop) */}
        <div className="hidden md:flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/80">
          <p className="text-sm font-semibold text-gray-900">
            {loading ? "Searching…" : resultLabel}
          </p>
          <div className="flex items-center gap-3">
            {hasAnySavedSearch() && (
              <span className="text-xs text-[#8a7340] font-medium hidden lg:inline">
                ★ Match chips show homes that fit your saved search
              </span>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={filters.sort}
                onChange={(e) => setFilter("sort", e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                aria-label="Sort"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Mobile map | list toggle */}
      <div className="flex lg:hidden border-b border-gray-200 bg-white shrink-0">
        <button
          type="button"
          onClick={() => setView("list")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            view === "list" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          List{!loading && meta.total > 0 ? ` (${meta.total.toLocaleString()})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setView("map")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            view === "map" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Map
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Map — left on desktop (Zillow pattern) */}
        <div
          className={`relative lg:block lg:w-[48%] xl:w-[52%] border-r border-gray-200 ${
            view === "map" ? "block flex-1" : "hidden"
          }`}
        >
          <div className="absolute inset-0">
            <ListingMap
              listings={results}
              selectedId={selectedId}
              onSelect={selectCard}
            />
          </div>
          {/* Floating save search on map (desktop) */}
          <div className="hidden lg:block absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <SaveSearchModal
              filters={saveFilters}
              buttonLabel="Save this search · price drops & new homes"
              buttonClassName="shadow-lg px-5 py-3 bg-white text-gray-900 border border-gray-200 rounded-full text-sm font-semibold hover:border-black transition-colors"
            />
          </div>
        </div>

        {/* Results column */}
        <div
          ref={resultsRef}
          className={`overflow-y-auto overscroll-contain bg-gray-50 ${
            view === "list" ? "flex-1" : "hidden lg:block lg:w-[52%] xl:w-[48%]"
          }`}
        >
          {/* Mobile result count */}
          <div className="md:hidden px-4 pt-3 pb-1">
            <p className="text-sm font-semibold text-gray-900">
              {loading ? "Searching…" : resultLabel}
            </p>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center text-center min-h-[360px] px-6">
              <p className="text-gray-900 font-semibold text-lg">We couldn&apos;t load listings</p>
              <p className="text-gray-500 mt-2 max-w-md text-sm">
                Please try again in a moment, or call{" "}
                <a href="tel:+19709991407" className="underline text-black font-medium">(970) 999-1407</a>.
              </p>
              <button
                type="button"
                onClick={() => fetchListings(filters, 1, false)}
                className="mt-4 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg"
              >
                Retry search
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center min-h-[360px] px-6">
              <p className="text-gray-900 font-semibold text-lg">
                No homes match these filters
                {filters.city && filters.city !== "__noco__" && filters.city !== "__all__"
                  ? ` in ${filters.city}`
                  : ""}
              </p>
              <p className="text-gray-500 mt-2 max-w-md text-sm leading-relaxed">
                Try widening price or beds, or save this search — we&apos;ll email you when a match hits the market (new homes + price drops, no spam).
              </p>
              <div className="mt-5 flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold hover:border-black"
                >
                  Clear filters
                </button>
                <SaveSearchModal
                  filters={saveFilters}
                  buttonLabel="Alert me when one appears"
                  buttonClassName="px-5 py-2.5 bg-black text-white rounded-lg text-sm font-semibold"
                />
              </div>
              <p className="text-gray-400 text-xs mt-6">
                Or explore our{" "}
                <a href="/northern-colorado-areas/" className="underline">city guides</a>
              </p>
            </div>
          )}

          {/* Cards grid */}
          {!loading && !error && results.length > 0 && (
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    selected={selectedId === listing.id}
                    onHover={setSelectedId}
                    savedSearches={savedSearches}
                  />
                ))}
              </div>

              {/* Load more / pagination */}
              <div className="mt-6 mb-4 flex flex-col items-center gap-3">
                {page < (meta.pages || 1) ? (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => fetchListings(filters, page + 1, true)}
                    className="px-6 py-3 bg-white border-2 border-black text-black font-semibold rounded-lg text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : `Show more homes (${results.length} of ${meta.total.toLocaleString()})`}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">
                    Showing all {meta.total.toLocaleString()} homes
                  </p>
                )}
                {/* RealScout empty-end nudge */}
                <div className="w-full max-w-md text-center rounded-xl border border-[#CFB36E]/40 bg-[#CFB36E]/10 px-4 py-4 mt-2">
                  <p className="text-sm font-semibold text-gray-900">Want new matches in your inbox?</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Save this search — new listings and price drops, no spam.
                  </p>
                  <div className="mt-3">
                    <SaveSearchModal
                      filters={saveFilters}
                      buttonLabel="Save search & get alerts"
                      buttonClassName="px-4 py-2.5 bg-black text-white rounded-lg text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
