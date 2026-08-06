import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { photoUrl } from "../utils/photoUrl.js";
import { useSearchParams } from "react-router-dom";
import ListingMap from "./ListingMap";
import ListingDetailPanel from "./ListingDetailPanel";
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
 * Desktop: sticky map left + scrollable cards right + filter drawer.
 * Mobile: Map | List toggle, bottom-sheet filters.
 * Every filter is URL-encoded (shareable, back-button-safe).
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

const PRICE_QUICK = [
  { label: "≤ $250K", value: "0-250000" },
  { label: "$250–500K", value: "250000-500000" },
  { label: "$500–750K", value: "500000-750000" },
  { label: "$750K–1M", value: "750000-1000000" },
  { label: "$1M+", value: "1000000-" },
];

const BED_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
  { label: "5+", value: "5" },
];

const BATH_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "1.5+", value: "1.5" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
];

const HOME_TYPE_OPTIONS = [
  { label: "Houses", value: "house" },
  { label: "Townhomes", value: "townhome" },
  { label: "Condos", value: "condo" },
  { label: "Multi-family", value: "multi" },
  { label: "Manufactured", value: "manufactured" },
  { label: "Lots / Land", value: "land" },
];

const SQFT_OPTIONS = [
  { label: "Any", value: "" },
  { label: "500+", value: "500" },
  { label: "750+", value: "750" },
  { label: "1,000+", value: "1000" },
  { label: "1,200+", value: "1200" },
  { label: "1,500+", value: "1500" },
  { label: "2,000+", value: "2000" },
  { label: "2,500+", value: "2500" },
  { label: "3,000+", value: "3000" },
  { label: "3,500+", value: "3500" },
];

const LOT_OPTIONS = [
  { label: "Any", min: "", max: "" },
  { label: "< 0.25 acre", min: "", max: "0.25" },
  { label: "0.25–0.5 acre", min: "0.25", max: "0.5" },
  { label: "0.5–1 acre", min: "0.5", max: "1" },
  { label: "1–5 acres", min: "1", max: "5" },
  { label: "5–10 acres", min: "5", max: "10" },
  { label: "10–20 acres", min: "10", max: "20" },
  { label: "20+ acres", min: "20", max: "" },
];

const YEAR_OPTIONS = [
  { label: "Any", min: "", max: "" },
  { label: "Before 1950", min: "", max: "1949" },
  { label: "1950–1979", min: "1950", max: "1979" },
  { label: "1980–1999", min: "1980", max: "1999" },
  { label: "2000–2009", min: "2000", max: "2009" },
  { label: "2010–2019", min: "2010", max: "2019" },
  { label: "2020+", min: "2020", max: "" },
];

const HOA_OPTIONS = [
  { label: "Any", value: "" },
  { label: "No HOA / $0", value: "0" },
  { label: "≤ $100/mo", value: "100" },
  { label: "≤ $200/mo", value: "200" },
  { label: "≤ $300/mo", value: "300" },
  { label: "≤ $500/mo", value: "500" },
];

const GARAGE_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
];

const STORIES_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1 story", value: "1" },
  { label: "2 stories", value: "2" },
  { label: "3+", value: "3" },
];

const BASEMENT_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Has basement", value: "true" },
  { label: "Finished", value: "finished" },
  { label: "Walkout", value: "walkout" },
];

const COOLING_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Central air", value: "central" },
  { label: "Evaporative", value: "evaporative" },
];

const HEATING_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Forced air", value: "forced" },
  { label: "Heat pump", value: "heat-pump" },
  { label: "Radiant", value: "radiant" },
  { label: "Baseboard", value: "baseboard" },
];

const PARKING_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Attached garage", value: "attached" },
  { label: "Detached garage", value: "detached" },
  { label: "Carport", value: "carport" },
  { label: "No garage", value: "none" },
];

const VIEW_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Mountain", value: "mountain" },
  { label: "Water", value: "water" },
  { label: "City", value: "city" },
  { label: "Golf", value: "golf" },
  { label: "Park", value: "park" },
];

const STYLE_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Contemporary", value: "contemporary" },
  { label: "Craftsman", value: "craftsman" },
  { label: "Ranch", value: "ranch" },
  { label: "Mid-century", value: "mid" },
  { label: "Victorian", value: "victorian" },
  { label: "Tudor", value: "tudor" },
];

const COMMUNITY_OPTIONS = [
  { label: "Any", value: "" },
  { label: "55+", value: "55+" },
  { label: "Gated", value: "gated" },
  { label: "Golf community", value: "golf" },
];

const EXTERIOR_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Brick", value: "brick" },
  { label: "Wood", value: "wood" },
  { label: "Stucco", value: "stucco" },
  { label: "Stone", value: "stone" },
  { label: "Vinyl", value: "vinyl" },
];

const INTERIOR_TOGGLES = [
  { key: "fireplace", label: "Fireplace", token: "fireplace" },
  { key: "wetbar", label: "Wet bar", token: "wet-bar" },
  { key: "walkin", label: "Walk-in closet", token: "walk-in" },
  { key: "solar", label: "Solar", token: "solar" },
  { key: "ev", label: "EV charging", token: "ev" },
  { key: "office", label: "Home office", token: "office" },
];

const LISTING_STATUS_OPTIONS = [
  { label: "For sale", value: "" },
  { label: "New listings", value: "new" },
  { label: "Price drops", value: "price-drop" },
];

const SORT_OPTIONS = [
  { label: "Recommended", value: "recommended" },
  { label: "Newest", value: "newest" },
  { label: "Price: high to low", value: "price-desc" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price per sqft", value: "price-sqft" },
  { label: "Lot size", value: "lot-size" },
  { label: "Square feet", value: "sqft" },
  { label: "Days on market", value: "days-on-market" },
];

const PAGE_SIZE = 40;

/** Default empty filter state */
function emptyFilters(overrides = {}) {
  return {
    city: "__noco__",
    minPrice: "",
    maxPrice: "",
    beds: "",
    baths: "",
    types: [], // multi home type
    sort: "newest",
    minSqft: "",
    maxSqft: "",
    minYear: "",
    maxYear: "",
    maxHoa: "",
    minLotAcres: "",
    maxLotAcres: "",
    garage: "",
    stories: "",
    basement: "",
    cooling: "",
    heating: "",
    parking: "",
    pool: "",
    waterfront: "",
    view: "",
    style: "",
    community: "",
    exterior: "",
    interior: [], // tokens
    newcon: "",
    listingStatus: "",
    newdays: "",
    keywords: "",
    hasImages: "",
    hasTour: "",
    ...overrides,
  };
}

/** Parse URL search params → filter state */
function filtersFromParams(sp) {
  const priceCombined = sp.get("price");
  let minPrice = sp.get("minPrice") || "";
  let maxPrice = sp.get("maxPrice") || "";
  if (priceCombined && !minPrice && !maxPrice) {
    const [a, b] = priceCombined.split("-");
    minPrice = a || "";
    maxPrice = b || "";
  }

  // Legacy single type=detached|attached|land
  let types = [];
  const typesParam = sp.get("types") || "";
  const typeParam = sp.get("type") || "";
  if (typesParam) {
    types = typesParam.split(",").map((t) => t.trim()).filter(Boolean);
  } else if (typeParam) {
    // Map legacy
    if (typeParam === "detached") types = ["house"];
    else if (typeParam === "attached") types = ["townhome", "condo"];
    else if (typeParam === "land") types = ["land"];
    else types = typeParam.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const interior = (sp.get("interior") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return emptyFilters({
    city: sp.get("city") || sp.get("location") || "__noco__",
    minPrice,
    maxPrice,
    beds: sp.get("beds") || "",
    baths: sp.get("baths") || "",
    types,
    sort: sp.get("sort") || "newest",
    minSqft: sp.get("minSqft") || "",
    maxSqft: sp.get("maxSqft") || "",
    minYear: sp.get("minYear") || "",
    maxYear: sp.get("maxYear") || "",
    maxHoa: sp.get("maxHoa") || "",
    minLotAcres: sp.get("minLotAcres") || "",
    maxLotAcres: sp.get("maxLotAcres") || "",
    garage: sp.get("garage") === "true" ? "1" : (sp.get("garage") || ""),
    stories: sp.get("stories") || "",
    basement: sp.get("basement") || "",
    cooling: sp.get("cooling") || "",
    heating: sp.get("heating") || "",
    parking: sp.get("parking") || "",
    pool: sp.get("pool") || "",
    waterfront: sp.get("waterfront") || "",
    view: sp.get("view") || "",
    style: sp.get("style") || "",
    community: sp.get("community") || "",
    exterior: sp.get("exterior") || "",
    interior,
    newcon: sp.get("newConstruction") || "",
    listingStatus: sp.get("listingStatus") || "",
    newdays: sp.get("newDays") || "",
    keywords: sp.get("keywords") || sp.get("q") || "",
    hasImages: sp.get("hasImages") || "",
    hasTour: sp.get("hasTour") || sp.get("has3d") || "",
  });
}

/** Filter state → API / URL params */
function filtersToParams(f, { forUrl = false, pageNum = 1 } = {}) {
  const params = new URLSearchParams();
  if (f.city && (!forUrl || f.city !== "__noco__")) {
    if (!(forUrl && f.city === "__noco__")) params.set("city", f.city);
  } else if (!forUrl) {
    params.set("city", f.city || "__noco__");
  }
  if (f.minPrice) params.set("minPrice", f.minPrice);
  if (f.maxPrice) params.set("maxPrice", f.maxPrice);
  if (f.beds) params.set("beds", f.beds);
  if (f.baths) params.set("baths", f.baths);
  if (f.types?.length) {
    // Prefer multi types= for Zillow-style; also keep type= for single legacy
    if (f.types.length === 1) params.set("type", f.types[0]);
    else params.set("types", f.types.join(","));
  }
  if (f.sort && (!forUrl || f.sort !== "newest")) params.set("sort", f.sort);
  if (f.minSqft) params.set("minSqft", f.minSqft);
  if (f.maxSqft) params.set("maxSqft", f.maxSqft);
  if (f.minYear) params.set("minYear", f.minYear);
  if (f.maxYear) params.set("maxYear", f.maxYear);
  if (f.maxHoa) params.set("maxHoa", f.maxHoa);
  if (f.minLotAcres) params.set("minLotAcres", f.minLotAcres);
  if (f.maxLotAcres) params.set("maxLotAcres", f.maxLotAcres);
  if (f.garage) params.set("garage", f.garage);
  if (f.stories) params.set("stories", f.stories);
  if (f.basement) params.set("basement", f.basement);
  if (f.cooling) params.set("cooling", f.cooling);
  if (f.heating) params.set("heating", f.heating);
  if (f.parking) params.set("parking", f.parking);
  if (f.pool === "true") params.set("pool", "true");
  if (f.waterfront === "true") params.set("waterfront", "true");
  if (f.view) params.set("view", f.view);
  if (f.style) params.set("style", f.style);
  if (f.community) params.set("community", f.community);
  if (f.exterior) params.set("exterior", f.exterior);
  if (f.interior?.length) params.set("interior", f.interior.join(","));
  if (f.newcon === "true") params.set("newConstruction", "true");
  if (f.listingStatus) params.set("listingStatus", f.listingStatus);
  if (f.newdays) params.set("newDays", f.newdays);
  if (f.keywords) params.set(forUrl ? "keywords" : "keywords", f.keywords);
  if (f.hasImages === "true") params.set("hasImages", "true");
  if (f.hasTour === "true") params.set("hasTour", "true");
  if (!forUrl) {
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(pageNum));
    // Always scope API to a city param
    if (!params.has("city")) params.set("city", f.city || "__noco__");
  }
  return params;
}

function countActiveFilters(f) {
  return [
    f.city && f.city !== "__noco__" && f.city !== "__all__",
    f.minPrice, f.maxPrice,
    f.beds, f.baths,
    f.types?.length,
    f.minSqft, f.maxSqft,
    f.minYear, f.maxYear,
    f.maxHoa,
    f.minLotAcres, f.maxLotAcres,
    f.garage, f.stories, f.basement,
    f.cooling, f.heating, f.parking,
    f.pool === "true", f.waterfront === "true",
    f.view, f.style, f.community, f.exterior,
    f.interior?.length,
    f.newcon === "true",
    f.listingStatus, f.newdays,
    f.keywords,
    f.hasImages === "true", f.hasTour === "true",
  ].filter(Boolean).length;
}

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

function ListingCard({ listing, selected, onHover, onOpen, savedSearches }) {
  const { isNew, priceCut, priceCutPct, isNewConstruction } = listingBadges(listing);
  const match = matchSavedSearch(listing, savedSearches);
  const [imgLoaded, setImgLoaded] = useState(false);
  const addr = listingAddress(listing);

  const open = (e) => {
    e?.preventDefault?.();
    onOpen?.(listing);
  };

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
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open(e);
          }
        }}
        className="block w-full text-left cursor-pointer"
      >
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

          <div className="absolute top-2 right-2 z-10">
            <HeartButton slug={listing.slug} />
          </div>

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

          {match.matches && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8a7340] bg-[#CFB36E]/15 px-2 py-0.5 rounded-full">
              <span aria-hidden="true">★</span>
              Matches your saved search
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Shared form control styles ─────────────────────────────────────── */
const selectClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-black focus:border-black outline-none";
const chipBase =
  "inline-flex items-center gap-1.5 px-3 py-2 border rounded-full text-sm font-medium transition-colors whitespace-nowrap";
const chipIdle = `${chipBase} border-gray-300 bg-white text-gray-800 hover:border-black`;
const chipActive = `${chipBase} border-black bg-black text-white`;
const pillBtn =
  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors";
const pillIdle = `${pillBtn} border-gray-300 bg-white text-gray-700 hover:border-black`;
const pillOn = `${pillBtn} border-black bg-black text-white`;

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
      {children}
    </p>
  );
}

function OptionPills({ options, value, onChange, multi = false }) {
  const selected = multi
    ? (Array.isArray(value) ? value : [])
    : value;

  const toggle = (v) => {
    if (!multi) {
      onChange(v === selected ? "" : v);
      return;
    }
    const set = new Set(selected);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange([...set]);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = multi ? selected.includes(o.value) : selected === o.value;
        return (
          <button
            key={o.value || o.label}
            type="button"
            onClick={() => toggle(o.value)}
            className={on ? pillOn : pillIdle}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Full filter drawer body — shared desktop panel + mobile bottom sheet.
 */
function FilterDrawerBody({
  draft,
  setDraft,
  onApply,
  onClear,
  total,
  loading,
}) {
  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const toggleInterior = (token) => {
    setDraft((d) => {
      const setTok = new Set(d.interior || []);
      if (setTok.has(token)) setTok.delete(token);
      else setTok.add(token);
      return { ...d, interior: [...setTok] };
    });
  };

  const priceLabel = () => {
    if (!draft.minPrice && !draft.maxPrice) return null;
    const f = (n) => (n ? `$${Number(n).toLocaleString()}` : "Any");
    return `${f(draft.minPrice)} – ${f(draft.maxPrice)}`;
  };

  // Lot select composite
  const lotValue = LOT_OPTIONS.find(
    (o) => o.min === (draft.minLotAcres || "") && o.max === (draft.maxLotAcres || "")
  );
  const yearValue = YEAR_OPTIONS.find(
    (o) => o.min === (draft.minYear || "") && o.max === (draft.maxYear || "")
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-6">
        {/* City */}
        <div>
          <SectionLabel>Location</SectionLabel>
          <select
            value={draft.city}
            onChange={(e) => set("city", e.target.value)}
            className={selectClass}
            aria-label="City"
          >
            <option value="__noco__">All Northern Colorado</option>
            <option value="__all__">All Colorado</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <SectionLabel>Price{priceLabel() ? ` · ${priceLabel()}` : ""}</SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="text-xs text-gray-600">
              Min
              <input
                type="number"
                inputMode="numeric"
                placeholder="No min"
                value={draft.minPrice}
                onChange={(e) => set("minPrice", e.target.value)}
                className={`${selectClass} mt-1`}
              />
            </label>
            <label className="text-xs text-gray-600">
              Max
              <input
                type="number"
                inputMode="numeric"
                placeholder="No max"
                value={draft.maxPrice}
                onChange={(e) => set("maxPrice", e.target.value)}
                className={`${selectClass} mt-1`}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRICE_QUICK.map((o) => {
              const [min, max] = o.value.split("-");
              const on = draft.minPrice === (min || "") && draft.maxPrice === (max || "");
              return (
                <button
                  key={o.value}
                  type="button"
                  className={on ? pillOn : pillIdle}
                  onClick={() => setDraft((d) => ({
                    ...d,
                    minPrice: min || "",
                    maxPrice: max || "",
                  }))}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Beds / Baths */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Beds</SectionLabel>
            <OptionPills
              options={BED_OPTIONS}
              value={draft.beds}
              onChange={(v) => set("beds", v)}
            />
          </div>
          <div>
            <SectionLabel>Baths</SectionLabel>
            <OptionPills
              options={BATH_OPTIONS}
              value={draft.baths}
              onChange={(v) => set("baths", v)}
            />
          </div>
        </div>

        {/* Home type multi */}
        <div>
          <SectionLabel>Home type</SectionLabel>
          <OptionPills
            options={HOME_TYPE_OPTIONS}
            value={draft.types}
            onChange={(v) => set("types", v)}
            multi
          />
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.newcon === "true"}
              onChange={(e) => set("newcon", e.target.checked ? "true" : "")}
              className="w-4 h-4 accent-black"
            />
            New construction only
          </label>
        </div>

        {/* Listing status */}
        <div>
          <SectionLabel>Listing status</SectionLabel>
          <OptionPills
            options={LISTING_STATUS_OPTIONS}
            value={draft.listingStatus}
            onChange={(v) => set("listingStatus", v)}
          />
          <label className="block mt-3 text-xs font-medium text-gray-600">
            Listed within
            <select
              value={draft.newdays}
              onChange={(e) => set("newdays", e.target.value)}
              className={`${selectClass} mt-1`}
            >
              <option value="">Anytime</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
        </div>

        {/* Size */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Square feet</SectionLabel>
            <select
              value={draft.minSqft}
              onChange={(e) => set("minSqft", e.target.value)}
              className={selectClass}
            >
              {SQFT_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Lot size</SectionLabel>
            <select
              value={lotValue ? `${lotValue.min}|${lotValue.max}` : "|"}
              onChange={(e) => {
                const [min, max] = e.target.value.split("|");
                setDraft((d) => ({ ...d, minLotAcres: min || "", maxLotAcres: max || "" }));
              }}
              className={selectClass}
            >
              {LOT_OPTIONS.map((o) => (
                <option key={o.label} value={`${o.min}|${o.max}`}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Year / HOA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Year built</SectionLabel>
            <select
              value={yearValue ? `${yearValue.min}|${yearValue.max}` : "|"}
              onChange={(e) => {
                const [min, max] = e.target.value.split("|");
                setDraft((d) => ({ ...d, minYear: min || "", maxYear: max || "" }));
              }}
              className={selectClass}
            >
              {YEAR_OPTIONS.map((o) => (
                <option key={o.label} value={`${o.min}|${o.max}`}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Max HOA</SectionLabel>
            <select
              value={draft.maxHoa}
              onChange={(e) => set("maxHoa", e.target.value)}
              className={selectClass}
            >
              {HOA_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Garage / Stories / Basement */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <SectionLabel>Garage</SectionLabel>
            <select value={draft.garage} onChange={(e) => set("garage", e.target.value)} className={selectClass}>
              {GARAGE_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Stories</SectionLabel>
            <select value={draft.stories} onChange={(e) => set("stories", e.target.value)} className={selectClass}>
              {STORIES_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Basement</SectionLabel>
            <select value={draft.basement} onChange={(e) => set("basement", e.target.value)} className={selectClass}>
              {BASEMENT_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* HVAC / Parking */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <SectionLabel>Cooling</SectionLabel>
            <select value={draft.cooling} onChange={(e) => set("cooling", e.target.value)} className={selectClass}>
              {COOLING_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Heating</SectionLabel>
            <select value={draft.heating} onChange={(e) => set("heating", e.target.value)} className={selectClass}>
              {HEATING_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Parking</SectionLabel>
            <select value={draft.parking} onChange={(e) => set("parking", e.target.value)} className={selectClass}>
              {PARKING_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Amenities toggles */}
        <div>
          <SectionLabel>Amenities</SectionLabel>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {[
              ["pool", "Pool"],
              ["waterfront", "Waterfront"],
            ].map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft[key] === "true"}
                  onChange={(e) => set(key, e.target.checked ? "true" : "")}
                  className="w-4 h-4 accent-black"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* View / Style / Community / Exterior */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>View</SectionLabel>
            <select value={draft.view} onChange={(e) => set("view", e.target.value)} className={selectClass}>
              {VIEW_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Style</SectionLabel>
            <select value={draft.style} onChange={(e) => set("style", e.target.value)} className={selectClass}>
              {STYLE_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Community</SectionLabel>
            <select value={draft.community} onChange={(e) => set("community", e.target.value)} className={selectClass}>
              {COMMUNITY_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SectionLabel>Exterior</SectionLabel>
            <select value={draft.exterior} onChange={(e) => set("exterior", e.target.value)} className={selectClass}>
              {EXTERIOR_OPTIONS.map((o) => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Interior features */}
        <div>
          <SectionLabel>Interior features</SectionLabel>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {INTERIOR_TOGGLES.map(({ token, label }) => (
              <label key={token} className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(draft.interior || []).includes(token)}
                  onChange={() => toggleInterior(token)}
                  className="w-4 h-4 accent-black"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <SectionLabel>Keywords</SectionLabel>
          <input
            type="search"
            placeholder="e.g. mountain view, corner lot, RV parking"
            value={draft.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            className={selectClass}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Matches public remarks, subdivision, and address.
          </p>
        </div>

        {/* Media must-haves */}
        <div>
          <SectionLabel>Must haves</SectionLabel>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.hasImages === "true"}
                onChange={(e) => set("hasImages", e.target.checked ? "true" : "")}
                className="w-4 h-4 accent-black"
              />
              Has photos
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.hasTour === "true"}
                onChange={(e) => set("hasTour", e.target.checked ? "true" : "")}
                className="w-4 h-4 accent-black"
              />
              Virtual tour
            </label>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-semibold text-gray-600 underline underline-offset-2 hover:text-black"
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={onApply}
          className="ml-auto flex-1 sm:flex-none px-6 py-3 bg-black text-white font-semibold rounded-lg text-sm hover:bg-gray-800 transition-colors"
        >
          {loading
            ? "Searching…"
            : `Show ${total > 0 ? total.toLocaleString() : ""} homes`}
        </button>
      </div>
    </div>
  );
}

export default function ListingSearch({ location, height = "700px", compact = false }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => {
    const base = filtersFromParams(searchParams);
    if (location && !searchParams.get("city") && !searchParams.get("location")) {
      base.city = location;
    }
    return base;
  });
  // Draft state for the drawer (apply on button)
  const [draft, setDraft] = useState(filters);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0, page: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState(() =>
    typeof window !== "undefined" ? getSavedSearches() : []
  );
  const [panelSlug, setPanelSlug] = useState(null);
  const panelHistoryPushed = useRef(false);
  const resultsRef = useRef(null);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const fetchListings = useCallback(async (f, pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = filtersToParams(f, { pageNum });
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
  }, []);

  // Sync filters → fetch + URL
  useEffect(() => {
    fetchListings(filters, 1, false);
    const urlParams = filtersToParams(filters, { forUrl: true });
    setSearchParams(urlParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchParams stable-ish; avoid loop
  }, [filters, fetchListings]);

  useEffect(() => {
    const onStorage = () => setSavedSearches(getSavedSearches());
    window.addEventListener("saa-search-saved", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("saa-search-saved", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Instant chip filters (city, beds, baths, sort) apply immediately
  const setFilterInstant = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      setDraft(next);
      return next;
    });
    setPage(1);
  };

  const openDrawer = () => {
    setDraft(filters);
    setDrawerOpen(true);
  };

  const applyDraft = () => {
    setFilters({ ...draft });
    setDrawerOpen(false);
    setPage(1);
  };

  const clearFilters = () => {
    const cleared = emptyFilters({ city: "__noco__", sort: filters.sort || "newest" });
    setFilters(cleared);
    setDraft(cleared);
    setDrawerOpen(false);
  };

  const selectCard = (id) => {
    setSelectedId(id);
    const el = document.getElementById(`listing-card-${id}`);
    if (el && resultsRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const openListingPanel = useCallback((listingOrSlug) => {
    const slug = typeof listingOrSlug === "string" ? listingOrSlug : listingOrSlug?.slug;
    if (!slug) return;
    const listing =
      typeof listingOrSlug === "object" && listingOrSlug
        ? listingOrSlug
        : results.find((l) => l.slug === slug);
    if (listing?.id) setSelectedId(listing.id);

    if (panelSlug === slug) return;

    if (panelSlug) {
      window.history.replaceState(
        { ...(window.history.state || {}), saaListingPanel: slug },
        "",
        `/homes-for-sale/${slug}/`
      );
      setPanelSlug(slug);
      return;
    }

    const returnUrl = `${window.location.pathname}${window.location.search}`;
    window.history.pushState(
      { ...(window.history.state || {}), saaListingPanel: slug, saaSearchReturn: returnUrl },
      "",
      `/homes-for-sale/${slug}/`
    );
    panelHistoryPushed.current = true;
    setPanelSlug(slug);
  }, [panelSlug, results]);

  const closeListingPanel = useCallback(() => {
    if (panelHistoryPushed.current) {
      panelHistoryPushed.current = false;
      window.history.back();
      return;
    }
    setPanelSlug(null);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (panelSlug) {
        panelHistoryPushed.current = false;
        setPanelSlug(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [panelSlug]);

  // Lock body scroll when drawer open on mobile
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  /** Payload for SaveSearchModal — serializes every active filter */
  const saveFilters = useMemo(() => {
    const out = {};
    if (filters.city && filters.city !== "__noco__" && filters.city !== "__all__") out.city = filters.city;
    if (filters.minPrice) out.minPrice = filters.minPrice;
    if (filters.maxPrice) out.maxPrice = filters.maxPrice;
    if (filters.beds) out.beds = filters.beds;
    if (filters.baths) out.baths = filters.baths;
    if (filters.types?.length) {
      out.types = filters.types.join(",");
      if (filters.types.length === 1) out.type = filters.types[0];
    }
    if (filters.minSqft) out.minSqft = filters.minSqft;
    if (filters.maxSqft) out.maxSqft = filters.maxSqft;
    if (filters.minYear) out.minYear = filters.minYear;
    if (filters.maxYear) out.maxYear = filters.maxYear;
    if (filters.maxHoa) out.maxHoa = filters.maxHoa;
    if (filters.minLotAcres) out.minLotAcres = filters.minLotAcres;
    if (filters.maxLotAcres) out.maxLotAcres = filters.maxLotAcres;
    if (filters.garage) out.garage = filters.garage;
    if (filters.stories) out.stories = filters.stories;
    if (filters.basement) out.basement = filters.basement;
    if (filters.cooling) out.cooling = filters.cooling;
    if (filters.heating) out.heating = filters.heating;
    if (filters.parking) out.parking = filters.parking;
    if (filters.pool === "true") out.pool = "true";
    if (filters.waterfront === "true") out.waterfront = "true";
    if (filters.view) out.view = filters.view;
    if (filters.style) out.style = filters.style;
    if (filters.community) out.community = filters.community;
    if (filters.exterior) out.exterior = filters.exterior;
    if (filters.interior?.length) out.interior = filters.interior.join(",");
    if (filters.newcon === "true") out.newConstruction = "true";
    if (filters.listingStatus) out.listingStatus = filters.listingStatus;
    if (filters.newdays) out.newDays = filters.newdays;
    if (filters.keywords) out.keywords = filters.keywords;
    if (filters.hasImages === "true") out.hasImages = "true";
    if (filters.hasTour === "true") out.hasTour = "true";
    if (filters.sort) out.sort = filters.sort;
    return out;
  }, [filters]);

  const resultLabel = (() => {
    if (filters.city && filters.city !== "__noco__" && filters.city !== "__all__") {
      return `${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"} in ${filters.city}`;
    }
    if (filters.city === "__all__") {
      return `${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"} in Colorado`;
    }
    return `${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"} in Northern Colorado`;
  })();

  const priceChipLabel = () => {
    if (!filters.minPrice && !filters.maxPrice) return "Price";
    const f = (n) => {
      if (!n) return "";
      const num = Number(n);
      if (num >= 1000000) return `$${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
      if (num >= 1000) return `$${Math.round(num / 1000)}K`;
      return `$${num}`;
    };
    if (filters.minPrice && filters.maxPrice) return `${f(filters.minPrice)}–${f(filters.maxPrice)}`;
    if (filters.maxPrice) return `≤ ${f(filters.maxPrice)}`;
    return `${f(filters.minPrice)}+`;
  };

  const typeChipLabel = () => {
    if (!filters.types?.length) return "Home type";
    if (filters.types.length === 1) {
      return HOME_TYPE_OPTIONS.find((o) => o.value === filters.types[0])?.label || "Home type";
    }
    return `${filters.types.length} types`;
  };

  return (
    <div className="flex flex-col bg-white relative" style={{ height: compact ? height : height }}>
      {/* Sticky filter bar */}
      <div className="border-b border-gray-200 bg-white z-20 shrink-0">
        {/* Desktop chip bar */}
        <div className="hidden md:flex flex-wrap items-center gap-2 p-3 lg:px-4">
          <select
            value={filters.city}
            onChange={(e) => setFilterInstant("city", e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-full text-sm bg-white font-medium focus:ring-2 focus:ring-black outline-none"
            aria-label="City"
          >
            <option value="__noco__">Northern Colorado</option>
            <option value="__all__">All Colorado</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <button
            type="button"
            onClick={openDrawer}
            className={filters.minPrice || filters.maxPrice ? chipActive : chipIdle}
          >
            {priceChipLabel()}
          </button>

          <select
            value={filters.beds}
            onChange={(e) => setFilterInstant("beds", e.target.value)}
            className={`px-3 py-2 border rounded-full text-sm font-medium outline-none ${
              filters.beds ? "border-black bg-black text-white" : "border-gray-300 bg-white"
            }`}
            aria-label="Beds"
          >
            {BED_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.value ? `${o.label} beds` : "Beds"}
              </option>
            ))}
          </select>

          <select
            value={filters.baths}
            onChange={(e) => setFilterInstant("baths", e.target.value)}
            className={`px-3 py-2 border rounded-full text-sm font-medium outline-none ${
              filters.baths ? "border-black bg-black text-white" : "border-gray-300 bg-white"
            }`}
            aria-label="Baths"
          >
            {BATH_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.value ? `${o.label} baths` : "Baths"}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openDrawer}
            className={filters.types?.length ? chipActive : chipIdle}
          >
            {typeChipLabel()}
          </button>

          <button
            type="button"
            onClick={openDrawer}
            className={activeFilterCount > 0 ? chipActive : chipIdle}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
            More filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-black underline underline-offset-2"
              >
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

        {/* Mobile filter trigger */}
        <div className="md:hidden flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={openDrawer}
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
            onChange={(e) => setFilterInstant("sort", e.target.value)}
            className="ml-auto px-2 py-2 border border-gray-300 rounded-lg text-xs bg-white max-w-[140px]"
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

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
                onChange={(e) => setFilterInstant("sort", e.target.value)}
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
              onOpenListing={openListingPanel}
            />
          </div>
          <div className="hidden lg:block absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <SaveSearchModal
              filters={saveFilters}
              buttonLabel="Save this search · price drops & new homes"
              buttonClassName="shadow-lg px-5 py-3 bg-white text-gray-900 border border-gray-200 rounded-full text-sm font-semibold hover:border-black transition-colors"
            />
          </div>
        </div>

        <div
          ref={resultsRef}
          className={`overflow-y-auto overscroll-contain bg-gray-50 ${
            view === "list" ? "flex-1" : "hidden lg:block lg:w-[52%] xl:w-[48%]"
          }`}
        >
          <div className="md:hidden px-4 pt-3 pb-1">
            <p className="text-sm font-semibold text-gray-900">
              {loading ? "Searching…" : resultLabel}
            </p>
          </div>

          {loading && (
            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

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

          {!loading && !error && results.length > 0 && (
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    selected={selectedId === listing.id}
                    onHover={setSelectedId}
                    onOpen={openListingPanel}
                    savedSearches={savedSearches}
                  />
                ))}
              </div>

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

      {/* Filter drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Desktop: right panel · Mobile: bottom sheet */}
          <div
            className="relative z-10 flex flex-col bg-white shadow-2xl
              w-full md:w-[440px] lg:w-[480px]
              h-[92vh] md:h-full
              mt-auto md:mt-0
              rounded-t-2xl md:rounded-none
              animate-[slideUp_0.25s_ease-out]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <h2 className="text-base font-bold text-gray-900">Filters</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <FilterDrawerBody
              draft={draft}
              setDraft={setDraft}
              onApply={applyDraft}
              onClear={clearFilters}
              total={meta.total}
              loading={loading}
            />
          </div>
        </div>
      )}

      {panelSlug && (
        <ListingDetailPanel slug={panelSlug} onClose={closeListingPanel} />
      )}
    </div>
  );
}
