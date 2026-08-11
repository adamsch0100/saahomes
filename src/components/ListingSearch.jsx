import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { photoUrl } from "../utils/photoUrl.js";
import { useSearchParams } from "react-router-dom";
import ListingMap from "./ListingMap";
import ListingDetailPanel from "./ListingDetailPanel";
import SaveSearchModal from "./SaveSearchModal";
import LocationCombobox, {
  parseCityList,
  parseZipList,
} from "./LocationCombobox";
import {
  formatPrice,
  listingBadges,
  listingAddress,
  homeTypeLabel,
  listingStatsLine,
  matchSavedSearch,
  getSavedSearches,
  hasAnySavedSearch,
  isLandListing,
} from "../utils/listingHelpers.js";
import SaveHomeButton, { useSavedHomesStatus } from "./SaveHomeButton";
import ListingPhotoFallback from "./ListingPhotoFallback";
import { marketPack } from "../data/marketPack.js";
import { buildListingsItemListSchema } from "../utils/seoConstants.js";
import { estimateMonthlyPayment } from "./PaymentCalculator.jsx";

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

const PRICE_QUICK = [
  { label: "≤ $250K", value: "0-250000" },
  { label: "$250–500K", value: "250000-500000" },
  { label: "$500–750K", value: "500000-750000" },
  { label: "$750K–1M", value: "750000-1000000" },
  { label: "$1M+", value: "1000000-" },
];

// Granular ladder for the quick price dropdown (Adam, Aug 8: Price chip = simple
// min/max dropdown from the top, NOT the full filters drawer).
const PRICE_STEPS = [
  { label: "Any", value: "" },
  { label: "$100K", value: "100000" },
  { label: "$150K", value: "150000" },
  { label: "$200K", value: "200000" },
  { label: "$250K", value: "250000" },
  { label: "$300K", value: "300000" },
  { label: "$350K", value: "350000" },
  { label: "$400K", value: "400000" },
  { label: "$450K", value: "450000" },
  { label: "$500K", value: "500000" },
  { label: "$600K", value: "600000" },
  { label: "$700K", value: "700000" },
  { label: "$800K", value: "800000" },
  { label: "$900K", value: "900000" },
  { label: "$1M", value: "1000000" },
  { label: "$1.25M", value: "1250000" },
  { label: "$1.5M", value: "1500000" },
  { label: "$2M", value: "2000000" },
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
  { label: "Wall / window unit", value: "wall" },
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
  { label: "Hills", value: "hills" },
  { label: "Plains", value: "plains" },
  { label: "Golf", value: "golf" },
  { label: "Park", value: "park" },
];

// Style tokens mapped to real IRES ArchitecturalStyle values (verified live).
// Ranch/craftsman/mid-century are nearly absent in NoCO feed — omit zero-result options.
const STYLE_OPTIONS = [
  { label: "Any", value: "" },
  { label: "Contemporary", value: "contemporary" },
  { label: "Patio home", value: "patio" },
  { label: "Cottage", value: "cottage" },
  { label: "Farmhouse", value: "farmhouse" },
  { label: "Chalet", value: "chalet" },
  { label: "Victorian", value: "victorian" },
  { label: "Colonial", value: "colonial" },
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

/** MLS home statuses with live inventory. Sold is omitted — feed has ~0 Closed rows. */
const LISTING_STATUS_OPTIONS = [
  { label: "For sale", value: "" },
  { label: "Backup offers accepted", value: "Active Under Contract" },
  { label: "Pending", value: "Pending" },
  { label: "Withdrawn", value: "Withdrawn" },
  { label: "Expired", value: "Expired" },
];

/** Home-status tokens sent as API `status=` (not listingStatus overlay). */
const HOME_STATUS_VALUES = new Set([
  "Active",
  "Active Under Contract",
  "Pending",
  "Sold",
  "Withdrawn",
  "Expired",
  "Canceled",
]);

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

/** Keyword match modes — backend keywordMode=all|any|exact|comma */
const KEYWORD_MODE_OPTIONS = [
  {
    value: "all",
    label: "All words",
    hint: "Every word must appear (e.g. “mountain view corner lot” matches homes mentioning all of them).",
  },
  {
    value: "any",
    label: "Any word",
    hint: "Matches if any word appears (broader results).",
  },
  {
    value: "exact",
    label: "Exact phrase",
    hint: "The full phrase must appear together as typed.",
  },
  {
    value: "comma",
    label: "Comma-separated",
    hint: "Separated by commas = each phrase must match.",
  },
];

const PAGE_SIZE = 40;
/** Debounce filter-driven fetches so typing price/keywords doesn't spam the API */
const FILTER_DEBOUNCE_MS = 375;

/** Default empty filter state */
function emptyFilters(overrides = {}) {
  return {
    city: "__noco__",
    // Comma-separated ZIPs (multi); empty = no zip filter
    postalCode: "",
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
    dropdays: "",
    droppct: "",
    keywords: "",
    keywordMode: "all",
    polygon: "",
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

  // city= supports multi ("Denver,Erie"); also accept cities= alias
  const cityParam = sp.get("city") || sp.get("cities") || sp.get("location") || "__noco__";
  const postalParam =
    sp.get("postal_code") || sp.get("postalCode") || sp.get("zip") || sp.get("zips") || "";

  // Home status: prefer status=; also accept listingStatus= when it holds a home status
  // (legacy). "Active" / empty → For sale (default). Overlay chips use listingStatus=price-drop|new.
  const statusParam = sp.get("status") || "";
  const lsParam = sp.get("listingStatus") || "";
  let listingStatus = "";
  if (statusParam && statusParam !== "Active" && HOME_STATUS_VALUES.has(statusParam)) {
    listingStatus = statusParam;
  } else if (lsParam && HOME_STATUS_VALUES.has(lsParam) && lsParam !== "Active") {
    listingStatus = lsParam;
  } else if (lsParam === "price-drop" || lsParam === "price_drop" || lsParam === "new") {
    listingStatus = lsParam === "price_drop" ? "price-drop" : lsParam;
  }

  return emptyFilters({
    city: cityParam,
    postalCode: postalParam,
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
    listingStatus,
    newdays: sp.get("newDays") || "",
    dropdays: sp.get("dropDays") || "",
    droppct: sp.get("dropPct") || "",
    keywords: sp.get("keywords") || sp.get("q") || "",
    keywordMode: (() => {
      const m = (sp.get("keywordMode") || sp.get("keyword_mode") || "all").toLowerCase();
      return ["all", "any", "exact", "comma"].includes(m) ? m : "all";
    })(),
    polygon: sp.get("polygon") || "",
    hasImages: sp.get("hasImages") || "",
    hasTour: sp.get("hasTour") || sp.get("has3d") || "",
  });
}

/** Filter state → API / URL params */
function filtersToParams(f, { forUrl = false, pageNum = 1 } = {}) {
  const params = new URLSearchParams();
  // Polygon overrides city/zip — don't send location when a custom area is active
  if (!f.polygon) {
    if (f.city && (!forUrl || f.city !== "__noco__")) {
      if (!(forUrl && f.city === "__noco__")) params.set("city", f.city);
    } else if (!forUrl) {
      params.set("city", f.city || "__noco__");
    }
    // postal_code: multi as comma-separated (shareable, stable)
    if (f.postalCode) params.set("postal_code", f.postalCode);
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
  // Home status → API `status=`; overlay chips (price-drop/new) stay on listingStatus=
  if (f.listingStatus) {
    if (HOME_STATUS_VALUES.has(f.listingStatus)) {
      params.set("status", f.listingStatus);
    } else {
      params.set("listingStatus", f.listingStatus);
    }
  }
  if (f.newdays) params.set("newDays", f.newdays);
  if (f.dropdays) params.set("dropDays", f.dropdays);
  if (f.droppct) params.set("dropPct", f.droppct);
  if (f.keywords) {
    params.set("keywords", f.keywords);
    const mode = f.keywordMode || "all";
    // API always gets mode; URL only when non-default so links stay clean
    if (!forUrl || mode !== "all") params.set("keywordMode", mode);
  }
  if (f.polygon) params.set("polygon", f.polygon);
  if (f.hasImages === "true") params.set("hasImages", "true");
  if (f.hasTour === "true") params.set("hasTour", "true");
  if (!forUrl) {
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(pageNum));
    // Polygon overrides city on the backend; still pass city only when no polygon
    if (f.polygon) {
      params.delete("city");
    } else if (!params.has("city")) {
      params.set("city", f.city || "__noco__");
    }
  }
  return params;
}

function countActiveFilters(f) {
  const multiCity = parseCityList(f.city).length > 0;
  return [
    f.polygon
      || multiCity
      || f.city === "__all__"
      || f.postalCode,
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
    f.listingStatus, f.newdays, f.dropdays, f.droppct,
    f.keywords,
    f.hasImages === "true", f.hasTour === "true",
  ].filter(Boolean).length;
}

function formatPriceChip(minPrice, maxPrice) {
  const f = (n) => {
    if (!n) return "";
    const num = Number(n);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
    if (num >= 1000) return `$${Math.round(num / 1000)}K`;
    return `$${num}`;
  };
  if (minPrice && maxPrice) return `${f(minPrice)}–${f(maxPrice)}`;
  if (maxPrice) return `≤ ${f(maxPrice)}`;
  if (minPrice) return `${f(minPrice)}+`;
  return "";
}

/**
 * Build removable active-filter chips for the summary strip.
 * Each chip: { id, label, patch } where patch is partial filter updates to apply on remove.
 */
function buildActiveChips(f) {
  const chips = [];
  if (f.polygon) {
    chips.push({
      id: "polygon",
      label: "Custom area",
      patch: {
        polygon: "",
        city: f.city && f.city !== "__all__" ? f.city : "__noco__",
      },
    });
  } else {
    const cityList = parseCityList(f.city);
    const zipList = parseZipList(f.postalCode);
    if (cityList.length) {
      cityList.forEach((c) => {
        const remaining = cityList.filter((x) => x.toLowerCase() !== c.toLowerCase());
        chips.push({
          id: `city-${c}`,
          label: c,
          patch: {
            city: remaining.length ? remaining.join(",") : (zipList.length ? "__all__" : "__noco__"),
          },
        });
      });
    } else if (f.city === "__all__" && !zipList.length) {
      chips.push({ id: "city", label: "All Colorado", patch: { city: "__noco__" } });
    }
    zipList.forEach((z) => {
      const remaining = zipList.filter((x) => x !== z);
      chips.push({
        id: `zip-${z}`,
        label: z,
        patch: {
          postalCode: remaining.join(","),
          // If last zip removed and no cities, return to NoCO default
          ...(remaining.length === 0 && !cityList.length ? { city: "__noco__" } : {}),
        },
      });
    });
  }
  const priceLabel = formatPriceChip(f.minPrice, f.maxPrice);
  if (priceLabel) {
    chips.push({ id: "price", label: priceLabel, patch: { minPrice: "", maxPrice: "" } });
  }
  if (f.beds) {
    chips.push({ id: "beds", label: `${f.beds}+ bd`, patch: { beds: "" } });
  }
  if (f.baths) {
    chips.push({ id: "baths", label: `${f.baths}+ ba`, patch: { baths: "" } });
  }
  if (f.types?.length) {
    if (f.types.length === 1) {
      const lab = HOME_TYPE_OPTIONS.find((o) => o.value === f.types[0])?.label || f.types[0];
      chips.push({ id: "types", label: lab, patch: { types: [] } });
    } else {
      chips.push({ id: "types", label: `${f.types.length} home types`, patch: { types: [] } });
    }
  }
  if (f.minSqft) chips.push({ id: "minSqft", label: `${Number(f.minSqft).toLocaleString()}+ sqft`, patch: { minSqft: "" } });
  if (f.maxSqft) chips.push({ id: "maxSqft", label: `≤ ${Number(f.maxSqft).toLocaleString()} sqft`, patch: { maxSqft: "" } });
  if (f.minLotAcres || f.maxLotAcres) {
    const lot = LOT_OPTIONS.find(
      (o) => o.min === (f.minLotAcres || "") && o.max === (f.maxLotAcres || "")
    );
    chips.push({
      id: "lot",
      label: lot?.label || "Lot size",
      patch: { minLotAcres: "", maxLotAcres: "" },
    });
  }
  if (f.minYear || f.maxYear) {
    const y = YEAR_OPTIONS.find(
      (o) => o.min === (f.minYear || "") && o.max === (f.maxYear || "")
    );
    chips.push({
      id: "year",
      label: y?.label || "Year built",
      patch: { minYear: "", maxYear: "" },
    });
  }
  if (f.maxHoa) {
    chips.push({
      id: "hoa",
      label: f.maxHoa === "0" ? "No HOA" : `HOA ≤ $${f.maxHoa}`,
      patch: { maxHoa: "" },
    });
  }
  if (f.garage) chips.push({ id: "garage", label: `${f.garage}+ garage`, patch: { garage: "" } });
  if (f.stories) chips.push({ id: "stories", label: f.stories === "3" ? "3+ stories" : `${f.stories} story`, patch: { stories: "" } });
  if (f.basement) {
    const b = BASEMENT_OPTIONS.find((o) => o.value === f.basement);
    chips.push({ id: "basement", label: b?.label || "Basement", patch: { basement: "" } });
  }
  if (f.cooling) {
    const c = COOLING_OPTIONS.find((o) => o.value === f.cooling);
    chips.push({ id: "cooling", label: c?.label || "Cooling", patch: { cooling: "" } });
  }
  if (f.heating) {
    const h = HEATING_OPTIONS.find((o) => o.value === f.heating);
    chips.push({ id: "heating", label: h?.label || "Heating", patch: { heating: "" } });
  }
  if (f.parking) {
    const p = PARKING_OPTIONS.find((o) => o.value === f.parking);
    chips.push({ id: "parking", label: p?.label || "Parking", patch: { parking: "" } });
  }
  if (f.pool === "true") chips.push({ id: "pool", label: "Pool", patch: { pool: "" } });
  if (f.waterfront === "true") chips.push({ id: "waterfront", label: "Waterfront", patch: { waterfront: "" } });
  if (f.view) {
    const v = VIEW_OPTIONS.find((o) => o.value === f.view);
    chips.push({ id: "view", label: v ? `${v.label} view` : "View", patch: { view: "" } });
  }
  if (f.style) {
    const s = STYLE_OPTIONS.find((o) => o.value === f.style);
    chips.push({ id: "style", label: s?.label || "Style", patch: { style: "" } });
  }
  if (f.community) {
    const c = COMMUNITY_OPTIONS.find((o) => o.value === f.community);
    chips.push({ id: "community", label: c?.label || "Community", patch: { community: "" } });
  }
  if (f.exterior) {
    const e = EXTERIOR_OPTIONS.find((o) => o.value === f.exterior);
    chips.push({ id: "exterior", label: e?.label || "Exterior", patch: { exterior: "" } });
  }
  if (f.interior?.length) {
    for (const tok of f.interior) {
      const t = INTERIOR_TOGGLES.find((x) => x.token === tok);
      chips.push({
        id: `interior-${tok}`,
        label: t?.label || tok,
        patch: { interior: (f.interior || []).filter((x) => x !== tok) },
      });
    }
  }
  if (f.newcon === "true") chips.push({ id: "newcon", label: "New construction", patch: { newcon: "" } });
  if (f.listingStatus === "Active Under Contract") chips.push({ id: "listingStatus", label: "Backup offers accepted", patch: { listingStatus: "" } });
  if (f.listingStatus === "Pending") chips.push({ id: "listingStatus", label: "Pending", patch: { listingStatus: "" } });
  if (f.listingStatus === "Sold") chips.push({ id: "listingStatus", label: "Recently sold", patch: { listingStatus: "" } });
  if (f.listingStatus === "Withdrawn") chips.push({ id: "listingStatus", label: "Withdrawn", patch: { listingStatus: "" } });
  if (f.listingStatus === "Expired") chips.push({ id: "listingStatus", label: "Expired", patch: { listingStatus: "" } });
  if (f.listingStatus === "price-drop") chips.push({ id: "listingStatus", label: "Price drops", patch: { listingStatus: "" } });
  if (f.listingStatus === "new") chips.push({ id: "listingStatus", label: "New listings", patch: { listingStatus: "" } });
  if (f.newdays) chips.push({ id: "newdays", label: `New ≤ ${f.newdays}d`, patch: { newdays: "" } });
  if (f.dropdays) chips.push({ id: "dropdays", label: `Dropped ≤ ${f.dropdays}d`, patch: { dropdays: "" } });
  if (f.droppct) chips.push({ id: "droppct", label: `Drop ≥ ${f.droppct}%`, patch: { droppct: "" } });
  if (f.keywords) {
    const mode = KEYWORD_MODE_OPTIONS.find((m) => m.value === (f.keywordMode || "all"));
    const modeTag = mode && mode.value !== "all" ? ` · ${mode.label}` : "";
    const short = f.keywords.length > 28 ? `${f.keywords.slice(0, 26)}…` : f.keywords;
    chips.push({
      id: "keywords",
      label: `“${short}”${modeTag}`,
      patch: { keywords: "", keywordMode: "all" },
    });
  }
  if (f.hasImages === "true") chips.push({ id: "hasImages", label: "Has photos", patch: { hasImages: "" } });
  if (f.hasTour === "true") chips.push({ id: "hasTour", label: "Virtual tour", patch: { hasTour: "" } });
  return chips;
}

/** Pulse skeleton matching grid card geometry (4:3 + 3–4 text lines) */
function SkeletonCard({ compact = false }) {
  if (compact) {
    return (
      <div className="flex gap-3 rounded-xl overflow-hidden border border-gray-200 bg-white animate-pulse p-0 min-h-[112px]">
        <div className="w-[140px] sm:w-[168px] shrink-0 bg-gray-200" />
        <div className="flex-1 py-3 pr-3 space-y-2.5">
          <div className="h-5 w-28 bg-gray-200 rounded" />
          <div className="h-3.5 w-36 bg-gray-100 rounded" />
          <div className="h-3 w-44 bg-gray-100 rounded" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[10px] overflow-hidden border border-gray-200 bg-white animate-pulse shadow-sm">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-3 space-y-2.5">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-3.5 w-40 bg-gray-100 rounded" />
        <div className="h-3.5 w-48 bg-gray-100 rounded" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

function CardBadges({ listing }) {
  const { isNew, priceCut, priceCutPct, isNewConstruction, hasOpenHouse } = listingBadges(listing);
  if (!isNew && !priceCut && !isNewConstruction && !hasOpenHouse) return null;
  return (
    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[78%] z-[1]">
      {isNew && (
        <span className="inline-flex items-center min-h-[24px] bg-[#CFB36E] text-black text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-sm">
          New
        </span>
      )}
      {priceCut && (
        <span className="inline-flex items-center min-h-[24px] bg-emerald-600 text-white text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-sm">
          Price drop{priceCutPct ? ` ${priceCutPct}%` : ""}
        </span>
      )}
      {hasOpenHouse && (
        <span className="inline-flex items-center min-h-[24px] bg-blue-600 text-white text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-sm">
          Open house
        </span>
      )}
      {isNewConstruction && (
        <span className="inline-flex items-center min-h-[24px] bg-black/85 text-white text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md shadow-sm">
          New construction
        </span>
      )}
    </div>
  );
}

function CardStatsLine({ listing, className = "" }) {
  const line = listingStatsLine(listing);
  if (!line) return null;
  return (
    <p className={`text-[13px] sm:text-sm font-semibold text-gray-800 tracking-tight ${className}`}>
      {line}
    </p>
  );
}

/**
 * Grid card — Zillow-grade 4:3 photo, price + badges on image, type scale below.
 * compact=true → horizontal list row (mobile / dense list).
 * Photo carousel arrows on multi-photo cards (Zillow §3); est. payment micro-line.
 */
function ListingCard({ listing, selected, onHover, onOpen, savedSearches, compact = false, savedMap = {} }) {
  const { priceCut } = listingBadges(listing);
  const match = matchSavedSearch(listing, savedSearches);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const addr = listingAddress(listing);
  const typeLabel = homeTypeLabel(listing);
  const photoCount = Array.isArray(listing.photos)
    ? listing.photos.length
    : Number(listing.photos_count) > 0
      ? Number(listing.photos_count)
      : 0;
  const hasPhoto = photoCount > 0;
  const showPhoto = hasPhoto && !imgFailed;
  const multiPhoto = showPhoto && photoCount > 1;
  const safePhotoIdx = multiPhoto ? ((photoIdx % photoCount) + photoCount) % photoCount : 0;
  const photoAlt = addr
    ? `Photo of ${addr}${listing.city ? `, ${listing.city}` : ""}${
        multiPhoto ? ` — photo ${safePhotoIdx + 1} of ${photoCount}` : ""
      }`
    : `Home in ${listing.city || marketPack.market.name}`;
  const isSaved =
    Boolean(savedMap[listing.listing_id]) ||
    Boolean(savedMap[listing.slug]) ||
    Boolean(listing.id != null && savedMap[String(listing.id)]);

  // Est. payment (same defaults as detail rail) — skip land / missing price
  const estPay = useMemo(() => {
    if (isLandListing(listing)) return null;
    const feats = listing.features || {};
    return estimateMonthlyPayment(listing.list_price, {
      taxAnnual: feats.tax_annual,
      hoaFee: listing.hoa_fee,
      hoaFreq: feats.assoc_fee_freq,
    });
  }, [listing]);

  // Reset photo index when listing identity changes (page reuse)
  useEffect(() => {
    setPhotoIdx(0);
    setImgLoaded(false);
    setImgFailed(false);
  }, [listing.id]);

  const open = (e) => {
    e?.preventDefault?.();
    onOpen?.(listing);
  };

  const stepPhoto = (dir, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!multiPhoto) return;
    setImgLoaded(false);
    setPhotoIdx((i) => {
      const next = i + dir;
      if (next < 0) return photoCount - 1;
      if (next >= photoCount) return 0;
      return next;
    });
  };

  const photo = (
    <>
      {showPhoto && !imgLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-200" />
      )}
      {showPhoto ? (
        <img
          key={`${listing.id}-${safePhotoIdx}`}
          src={photoUrl(listing.id, safePhotoIdx)}
          alt={photoAlt}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            // First photo failure → branded fallback; other indices step back to 0
            if (safePhotoIdx === 0) {
              setImgFailed(true);
              setImgLoaded(true);
            } else {
              setPhotoIdx(0);
              setImgLoaded(false);
            }
          }}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          loading={safePhotoIdx === 0 ? "lazy" : "eager"}
          decoding="async"
          draggable={false}
        />
      ) : (
        <ListingPhotoFallback className="w-full h-full absolute inset-0" compact={compact} />
      )}
      <CardBadges listing={listing} />
      <div className={`absolute z-10 ${compact ? "top-1.5 right-1.5" : "top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"}`}>
        <SaveHomeButton
          listing={listing}
          saved={isSaved}
          className={compact ? "!w-10 !h-10 !min-w-[40px] !min-h-[40px]" : ""}
        />
      </div>
      {/* Zillow §3: left/right photo arrows on hover (desktop) / always on touch */}
      {multiPhoto && (
        <>
          <button
            type="button"
            onClick={(e) => stepPhoto(-1, e)}
            onMouseDown={(e) => e.stopPropagation()}
            className={`absolute left-1.5 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/95 hover:bg-white shadow-md flex items-center justify-center text-gray-900 leading-none active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#CFB36E] ${
              compact
                ? "w-7 h-7 text-base opacity-100"
                : "w-8 h-8 text-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            }`}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => stepPhoto(1, e)}
            onMouseDown={(e) => e.stopPropagation()}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/95 hover:bg-white shadow-md flex items-center justify-center text-gray-900 leading-none active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#CFB36E] ${
              compact
                ? "w-7 h-7 text-base opacity-100"
                : "w-8 h-8 text-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:right-12"
            }`}
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}
      {/* Price overlay — primary focal point on the photo */}
      {!compact && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent pt-10 pb-2.5 px-3 pointer-events-none">
          <div className="flex items-end justify-between gap-2">
            <p className="text-[1.35rem] sm:text-2xl font-bold text-white tracking-tight leading-none drop-shadow-sm">
              {formatPrice(listing.list_price)}
            </p>
            {priceCut && listing.original_list_price != null && (
              <p className="text-xs text-white/75 line-through mb-0.5">
                {formatPrice(listing.original_list_price)}
              </p>
            )}
          </div>
        </div>
      )}
      {!compact && multiPhoto && (
        <span className="absolute bottom-2.5 right-2.5 bg-black/65 text-white text-[10px] font-medium px-1.5 py-0.5 rounded z-[1] tabular-nums pointer-events-none">
          {safePhotoIdx + 1} / {photoCount}
        </span>
      )}
    </>
  );

  const estPayLine = estPay ? (
    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 tabular-nums">
      Est. {`$${Math.round(estPay.total).toLocaleString("en-US")}`}/mo
    </p>
  ) : null;

  const body = compact ? (
    <div className="flex-1 min-w-0 py-2.5 pr-2.5 pl-0.5 flex flex-col justify-center gap-0.5">
      <div className="flex items-baseline gap-2">
        <p className="text-lg font-bold text-gray-900 tracking-tight leading-none">
          {formatPrice(listing.list_price)}
        </p>
        {priceCut && listing.original_list_price != null && (
          <p className="text-xs text-gray-400 line-through">
            {formatPrice(listing.original_list_price)}
          </p>
        )}
      </div>
      {estPayLine}
      <CardStatsLine listing={listing} className="mt-1" />
      <p className="text-[13px] text-gray-600 truncate mt-0.5">
        {addr || "Address available on request"}
        {listing.city ? `, ${listing.city}` : ""}
      </p>
      {typeLabel && (
        <p className="text-xs text-gray-400 mt-0.5">{typeLabel}</p>
      )}
      {match.matches && (
        <p className="mt-1 inline-flex self-start items-center gap-1 text-[10px] font-semibold text-[#8a7340] bg-[#CFB36E]/15 px-2 py-0.5 rounded-full">
          <span aria-hidden="true">★</span> Match
        </p>
      )}
    </div>
  ) : (
    <div className="px-3 pt-2.5 pb-3">
      <CardStatsLine listing={listing} />
      {estPayLine}
      <p className="text-[13px] text-gray-600 mt-1 truncate leading-snug">
        {addr || "Address available on request"}
      </p>
      <p className="text-xs text-gray-400 truncate mt-0.5">
        {[listing.city, listing.state, listing.postal_code].filter(Boolean).join(", ")}
        {typeLabel ? ` · ${typeLabel}` : ""}
      </p>
      {match.matches && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8a7340] bg-[#CFB36E]/15 px-2 py-0.5 rounded-full">
          <span aria-hidden="true">★</span>
          Matches your saved search
        </p>
      )}
    </div>
  );

  return (
    <article
      id={`listing-card-${listing.id}`}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative overflow-hidden bg-white border transition-all duration-200 scroll-mt-24 ${
        compact
          ? "rounded-[10px] flex flex-row min-h-[112px]"
          : "rounded-[10px]"
      } ${
        selected
          ? "border-[#CFB36E] shadow-lg ring-2 ring-[#CFB36E]/35"
          : "border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300"
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
        className={`block w-full text-left cursor-pointer active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E] ${
          compact ? "flex flex-row min-h-[112px]" : ""
        }`}
      >
        <div
          className={`relative bg-gray-100 overflow-hidden shrink-0 ${
            compact
              ? "w-[140px] sm:w-[168px] self-stretch"
              : "aspect-[4/3] w-full"
          }`}
        >
          {photo}
        </div>
        {body}
      </div>
    </article>
  );
}

/* ── Shared form control styles — min 44px tap targets on interactive chips ── */
const selectClass =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#CFB36E] focus:border-[#CFB36E] outline-none min-h-[44px]";
const chipBase =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 border rounded-full text-sm font-medium transition-colors whitespace-nowrap touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]";
const chipIdle = `${chipBase} border-gray-300 bg-white text-gray-800 hover:border-black`;
const chipActive = `${chipBase} border-black bg-black text-white`;
const pillBtn =
  "inline-flex items-center justify-center min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]";
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
        {/* Location — typed city/ZIP multi-select */}
        <div>
          <SectionLabel>Location</SectionLabel>
          <LocationCombobox
            id="filter-drawer-location"
            city={draft.polygon ? "__noco__" : draft.city}
            postalCode={draft.polygon ? "" : (draft.postalCode || "")}
            disabled={Boolean(draft.polygon)}
            showQuickPicks
            inputClassName="!rounded-lg"
            onChange={({ city: nextCity, postalCode: nextZip }) => {
              setDraft((d) => ({
                ...d,
                city: nextCity,
                postalCode: nextZip || "",
                polygon: "",
              }));
            }}
          />
          {draft.polygon ? (
            <p className="text-[11px] text-gray-600 mt-1.5">
              Custom drawn area is active (overrides city/ZIP).{" "}
              <button
                type="button"
                className="underline font-semibold text-black"
                onClick={() => setDraft((d) => ({ ...d, polygon: "" }))}
              >
                Clear shape
              </button>
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1.5">
              Type any Colorado city or ZIP · multi-select · or use <strong>Draw area</strong> on the map.
            </p>
          )}
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

        {/* Listing status — the HOME's status */}
        <div>
          <SectionLabel>Status</SectionLabel>
          <OptionPills
            options={LISTING_STATUS_OPTIONS}
            value={draft.listingStatus}
            onChange={(v) => set("listingStatus", v)}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-600">
              New listings (listed within)
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
            <label className="block text-xs font-medium text-gray-600">
              Price dropped within
              <select
                value={draft.dropdays}
                onChange={(e) => set("dropdays", e.target.value)}
                className={`${selectClass} mt-1`}
              >
                <option value="">Anytime</option>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
          </div>
          <label className="block mt-2 text-xs font-medium text-gray-600">
            Price drop of at least
            <span className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={draft.droppct}
                onChange={(e) => set("droppct", e.target.value)}
                placeholder="5"
                className={`${selectClass} flex-1`}
              />
              <span className="text-sm text-gray-500">%</span>
            </span>
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

        {/* Keywords + match mode */}
        <div>
          <SectionLabel>Keywords</SectionLabel>
          <input
            type="search"
            placeholder="e.g. mountain view, corner lot, RV parking"
            value={draft.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            className={selectClass}
            aria-label="Keywords"
          />
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Keyword match mode">
            {KEYWORD_MODE_OPTIONS.map((m) => {
              const on = (draft.keywordMode || "all") === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => set("keywordMode", m.value)}
                  className={on ? pillOn : pillIdle}
                  aria-pressed={on}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
            {KEYWORD_MODE_OPTIONS.find((m) => m.value === (draft.keywordMode || "all"))?.hint
              || "Matches public remarks, subdivision, and address."}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Results update as you type — no enter needed.
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
          className="ml-auto flex-1 sm:flex-none px-6 py-3 bg-black text-white font-semibold rounded-lg text-sm hover:bg-gray-800 active:scale-[0.99] transition-all"
        >
          {loading
            ? "Updating…"
            : total > 0
              ? `Done · ${total.toLocaleString()} homes`
              : "Done · view results"}
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
  // Card grid density: 1|2|3 columns on desktop (default 2). Persisted per device.
  const [density, setDensity] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem("saa-card-density"));
      return saved === 1 || saved === 2 || saved === 3 ? saved : 2;
    } catch {
      return 2;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [homeTypeOpen, setHomeTypeOpen] = useState(false);
  const [drawEnabled, setDrawEnabled] = useState(false);
  /** Color map pins by list_price band (green→yellow→red) — uses real prices only */
  const [priceHeatmap, setPriceHeatmap] = useState(false);
  /** true below lg — drives compact horizontal list cards on mobile */
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false
  );
  const [savedSearches, setSavedSearches] = useState(() =>
    typeof window !== "undefined" ? getSavedSearches() : []
  );
  const [panelSlug, setPanelSlug] = useState(null);
  const panelHistoryPushed = useRef(false);
  const resultsRef = useRef(null);
  const homeTypeRef = useRef(null);
  const fetchGen = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const activeChips = useMemo(() => buildActiveChips(filters), [filters]);
  // Batch heart status for visible results (one API call, not N+1)
  const { savedMap } = useSavedHomesStatus(results);

  const fetchListings = useCallback(async (f, pageNum = 1, append = false) => {
    const gen = ++fetchGen.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = filtersToParams(f, { pageNum });
      const res = await fetch(`${API_BASE}/api/listings?${params}`, {
        // Deploy rolls swap the backend instance; a fetch that lands mid-swap
        // can hang indefinitely (no server response, no abort). Timeout +
        // stale-gen guard turns that into a visible error instead of a
        // forever "Updating results…" spinner. (Adam, Aug 8)
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      // Drop stale responses (rapid filter changes / debounce races)
      if (gen !== fetchGen.current) return;
      const rows = data.data || [];
      setResults((prev) => (append ? [...prev, ...rows] : rows));
      setMeta(data.meta || { total: 0, pages: 0, page: pageNum });
      setPage(pageNum);
    } catch (err) {
      if (gen !== fetchGen.current) return;
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      setError(timedOut ? "The search is taking longer than expected. Check your connection and try again." : err.message);
      if (!append) setResults([]);
    } finally {
      if (gen === fetchGen.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // While the filter drawer is open, stream draft → applied filters so typing
  // keywords / price updates results without Enter. Fetch itself is debounced below.
  useEffect(() => {
    if (!drawerOpen) return;
    setFilters((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(draft)) return prev;
      return { ...draft };
    });
  }, [draft, drawerOpen]);

  // Debounced sync: filters → fetch + URL (live updates without Enter)
  useEffect(() => {
    const t = setTimeout(() => {
      fetchListings(filters, 1, false);
      const urlParams = filtersToParams(filters, { forUrl: true });
      setSearchParams(urlParams, { replace: true });
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
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

  // Close home-type popover on outside click
  useEffect(() => {
    if (!homeTypeOpen) return undefined;
    const onDoc = (e) => {
      if (homeTypeRef.current && !homeTypeRef.current.contains(e.target)) {
        setHomeTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [homeTypeOpen]);

  // Escape closes price / home-type popovers (Zillow-style chip UX)
  useEffect(() => {
    if (!priceOpen && !homeTypeOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setPriceOpen(false);
      setHomeTypeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [priceOpen, homeTypeOpen]);

  // Instant chip filters (city, beds, baths, sort) apply immediately
  const setFilterInstant = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Changing location clears custom polygon (and vice-versa handled on polygon set)
      if ((key === "city" || key === "postalCode") && value !== undefined) next.polygon = "";
      setDraft(next);
      return next;
    });
    setPage(1);
  };

  /** Location combobox → city + postalCode (clears polygon) */
  const setLocation = useCallback((patch) => {
    setFilters((prev) => {
      const next = {
        ...prev,
        city: patch.city !== undefined ? patch.city : prev.city,
        postalCode: patch.postalCode !== undefined ? patch.postalCode : prev.postalCode,
        polygon: "",
      };
      setDraft(next);
      return next;
    });
    setPage(1);
  }, []);

  const applyFilterPatch = (patch) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      setDraft(next);
      return next;
    });
    setPage(1);
  };

  const removeChip = (chip) => {
    applyFilterPatch(chip.patch || {});
  };

  const toggleHomeType = (value) => {
    setFilters((prev) => {
      const set = new Set(prev.types || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      const next = { ...prev, types: [...set] };
      setDraft(next);
      return next;
    });
    setPage(1);
  };

  const handlePolygonChange = useCallback((ringStr) => {
    setFilters((prev) => {
      const next = {
        ...prev,
        polygon: ringStr || "",
        // Polygon overrides city/zip scope
        city: ringStr ? "__noco__" : (prev.city || "__noco__"),
        postalCode: ringStr ? "" : (prev.postalCode || ""),
      };
      setDraft(next);
      return next;
    });
    if (ringStr) setDrawEnabled(false);
    setPage(1);
  }, []);

  const openDrawer = () => {
    setDraft(filters);
    setDrawerOpen(true);
    setHomeTypeOpen(false);
  };

  const applyDraft = () => {
    // Draft already streams into filters while the drawer is open; Apply just commits + closes.
    setFilters({ ...draft });
    setDrawerOpen(false);
    setPage(1);
  };

  const clearFilters = () => {
    const cleared = emptyFilters({ city: "__noco__", sort: filters.sort || "newest" });
    setFilters(cleared);
    setDraft(cleared);
    setDrawerOpen(false);
    setDrawEnabled(false);
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
    if (filters.city === "__all__" && filters.postalCode) out.city = "__all__";
    if (filters.postalCode) out.postal_code = filters.postalCode;
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
    if (filters.listingStatus) {
      if (HOME_STATUS_VALUES.has(filters.listingStatus)) {
        out.status = filters.listingStatus;
      } else {
        out.listingStatus = filters.listingStatus;
      }
    }
    if (filters.newdays) out.newDays = filters.newdays;
    if (filters.dropdays) out.dropDays = filters.dropdays;
    if (filters.droppct) out.dropPct = filters.droppct;
    if (filters.keywords) {
      out.keywords = filters.keywords;
      if (filters.keywordMode && filters.keywordMode !== "all") {
        out.keywordMode = filters.keywordMode;
      }
    }
    if (filters.polygon) out.polygon = filters.polygon;
    if (filters.hasImages === "true") out.hasImages = "true";
    if (filters.hasTour === "true") out.hasTour = "true";
    if (filters.sort) out.sort = filters.sort;
    return out;
  }, [filters]);

  const areaLabel = (() => {
    if (filters.polygon) return "your drawn area";
    const cityList = parseCityList(filters.city);
    const zipList = parseZipList(filters.postalCode);
    const bits = [];
    if (cityList.length > 2) bits.push(`${cityList.slice(0, 2).join(", ")} +${cityList.length - 2}`);
    else if (cityList.length) bits.push(cityList.join(", "));
    if (zipList.length > 2) bits.push(`ZIP ${zipList.slice(0, 2).join(", ")} +${zipList.length - 2}`);
    else if (zipList.length) bits.push(`ZIP ${zipList.join(", ")}`);
    if (bits.length) return bits.join(" · ");
    if (filters.city === "__all__") return "Colorado";
    return "Northern Colorado";
  })();

  const resultLabel = loading
    ? `Updating results…`
    : `Showing ${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"} in ${areaLabel}`;

  // Card grid columns by density (1/2/3, default 2). Viewport-based md+ so desktop
  // always shows the chosen density even when the results panel is narrower than
  // 560px (container-query @[560px] collapsed to 1 col on 1280–1440px laptops — Adam, Aug 8).
  const cardGridClass = `grid grid-cols-1 gap-3 md:gap-4 ${
    density === 3 ? "md:grid-cols-3" : density === 1 ? "" : "md:grid-cols-2"
  }`;

  // GEO: ItemList of first page of results (max 24) — list or map mode.
  // Only real active MLS rows; canonical /homes-for-sale/{slug}/ URLs.
  const listingsItemList = useMemo(
    () =>
      buildListingsItemListSchema(results, {
        name: `Homes for Sale in ${areaLabel}`,
        description: `Active IRES MLS listings for sale in ${areaLabel}.`,
        maxItems: 24,
      }),
    [results, areaLabel]
  );

  const priceChipLabel = () => {
    if (!filters.minPrice && !filters.maxPrice) return "Price";
    return formatPriceChip(filters.minPrice, filters.maxPrice) || "Price";
  };

  const typeChipLabel = () => {
    if (!filters.types?.length) return "Home type";
    if (filters.types.length === 1) {
      return HOME_TYPE_OPTIONS.find((o) => o.value === filters.types[0])?.label || "Home type";
    }
    return `${filters.types.length} types`;
  };

  return (
    <div
      className="flex flex-col bg-white relative h-full min-h-0"
      style={{ height: height || "100%" }}
    >
      {listingsItemList && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(listingsItemList)}</script>
        </Helmet>
      )}
      {/* Sticky filter bar — never scrolls away; generous spacing, no cramped wrap */}
      <div className="border-b border-gray-200 bg-white z-20 shrink-0 sticky top-0">
        {/* Desktop chip bar */}
        <div className="hidden md:flex flex-wrap items-center gap-2.5 px-3 py-2.5 lg:px-4 lg:py-3">
          <div className="min-w-[16rem] max-w-md flex-1 basis-[16rem]">
            <LocationCombobox
              id="desktop-location"
              city={filters.city}
              postalCode={filters.postalCode || ""}
              onChange={setLocation}
              showQuickPicks={false}
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setPriceOpen((o) => !o);
                setHomeTypeOpen(false);
              }}
              aria-expanded={priceOpen}
              aria-haspopup="true"
              className={`${filters.minPrice || filters.maxPrice ? chipActive : chipIdle} ${
                priceOpen && !filters.minPrice && !filters.maxPrice ? "border-black" : ""
              }`}
            >
              {priceChipLabel()}
            </button>
            {priceOpen && (
              <>
                {/* Click-away backdrop (below the popover, above the page) */}
                <div className="fixed inset-0 z-30" onClick={() => setPriceOpen(false)} aria-hidden="true" />
                {/* Price dropdown — min/max from the top (Adam, Aug 8: quick pick, not the full drawer) */}
                <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-80 rounded-xl border border-gray-200 bg-white shadow-xl p-4">
                  <p className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">Price range</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={filters.minPrice || ""}
                      onChange={(e) => setFilterInstant("minPrice", e.target.value)}
                      className="flex-1 min-h-[44px] px-2.5 py-2 border border-gray-300 rounded-lg text-sm bg-white touch-manipulation"
                      aria-label="Minimum price"
                    >
                      {PRICE_STEPS.map((o) => (
                        <option key={`min-${o.value || "any"}`} value={o.value}>
                          {o.value ? `${o.label}+` : "Min price"}
                        </option>
                      ))}
                    </select>
                    <span className="text-gray-400 text-sm shrink-0" aria-hidden="true">
                      –
                    </span>
                    <select
                      value={filters.maxPrice || ""}
                      onChange={(e) => setFilterInstant("maxPrice", e.target.value)}
                      className="flex-1 min-h-[44px] px-2.5 py-2 border border-gray-300 rounded-lg text-sm bg-white touch-manipulation"
                      aria-label="Maximum price"
                    >
                      {PRICE_STEPS.map((o) => (
                        <option key={`max-${o.value || "any"}`} value={o.value}>
                          {o.value ? o.label : "Max price"}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Zillow §2: quick price ranges on the chip (not only in full drawer) */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {PRICE_QUICK.map((o) => {
                      const [min, max] = o.value.split("-");
                      const on =
                        String(filters.minPrice || "") === (min || "") &&
                        String(filters.maxPrice || "") === (max || "");
                      return (
                        <button
                          key={o.value}
                          type="button"
                          className={on ? pillOn : pillIdle}
                          onClick={() => {
                            applyFilterPatch({
                              minPrice: min || "",
                              maxPrice: max || "",
                            });
                          }}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                  {(filters.minPrice || filters.maxPrice) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterInstant("minPrice", "");
                        setFilterInstant("maxPrice", "");
                      }}
                      className="mt-3 min-h-[32px] text-xs font-semibold text-gray-500 underline hover:text-black touch-manipulation"
                    >
                      Clear price
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <select
            value={filters.beds}
            onChange={(e) => setFilterInstant("beds", e.target.value)}
            className={`min-h-[44px] px-3.5 py-2 border rounded-full text-sm font-medium outline-none touch-manipulation focus-visible:ring-2 focus-visible:ring-[#CFB36E] ${
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
            className={`min-h-[44px] px-3.5 py-2 border rounded-full text-sm font-medium outline-none touch-manipulation focus-visible:ring-2 focus-visible:ring-[#CFB36E] ${
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

          {/* Home type — inline multi-select popover (not full drawer) */}
          <div className="relative" ref={homeTypeRef}>
            <button
              type="button"
              onClick={() => {
                setHomeTypeOpen((o) => !o);
                setPriceOpen(false);
              }}
              className={filters.types?.length ? chipActive : chipIdle}
              aria-expanded={homeTypeOpen}
              aria-haspopup="listbox"
            >
              {typeChipLabel()}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {homeTypeOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-gray-200 bg-white shadow-xl p-2"
                role="listbox"
                aria-label="Home type"
              >
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Home type
                </p>
                {HOME_TYPE_OPTIONS.map((o) => {
                  const on = (filters.types || []).includes(o.value);
                  return (
                    <label
                      key={o.value}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer hover:bg-gray-50 ${
                        on ? "font-semibold text-gray-900" : "text-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleHomeType(o.value)}
                        className="w-4 h-4 accent-black"
                      />
                      {o.label}
                    </label>
                  );
                })}
                {(filters.types?.length > 0) && (
                  <button
                    type="button"
                    onClick={() => applyFilterPatch({ types: [] })}
                    className="mt-1 w-full text-left px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-black"
                  >
                    Clear types
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openDrawer}
            className={activeFilterCount > 0 ? chipActive : chipIdle}
            aria-label={
              activeFilterCount > 0
                ? `Open filters, ${activeFilterCount} active`
                : "Open filters"
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <SaveSearchModal
              filters={saveFilters}
              buttonLabel="Save search"
              buttonClassName="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all whitespace-nowrap touch-manipulation"
            />
          </div>
        </div>

        {/* Mobile filter trigger + location */}
        <div className="md:hidden flex flex-col gap-2.5 p-3">
          <LocationCombobox
            id="mobile-location"
            city={filters.city}
            postalCode={filters.postalCode || ""}
            onChange={setLocation}
            showQuickPicks={false}
          />
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openDrawer}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-full text-sm font-semibold bg-white touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
            aria-label={
              activeFilterCount > 0
                ? `Open filters, ${activeFilterCount} active`
                : "Open filters"
            }
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-black text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 rounded-full inline-flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <SaveSearchModal
            filters={saveFilters}
            buttonLabel="Save"
            buttonClassName="inline-flex items-center justify-center gap-1 min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-full text-sm font-semibold bg-white touch-manipulation"
          />
          <select
            value={filters.sort}
            onChange={(e) => setFilterInstant("sort", e.target.value)}
            className="ml-auto min-h-[44px] px-2.5 py-2 border border-gray-300 rounded-lg text-xs bg-white max-w-[140px] touch-manipulation"
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          </div>
        </div>

        {/* Active filter chip strip — co-located with filter trigger + Clear all */}
        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 px-3 lg:px-4 pb-3 overflow-x-auto scrollbar-thin">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Active
            </span>
            <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
              {activeChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => removeChip(chip)}
                  className="inline-flex items-center gap-1 min-h-[32px] pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#CFB36E]/20 text-gray-900 border border-[#CFB36E]/50 hover:bg-[#CFB36E]/35 whitespace-nowrap touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
                  title={`Remove ${chip.label}`}
                  aria-label={`Remove filter: ${chip.label}`}
                >
                  {chip.label}
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-black/10" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </span>
                  <span className="sr-only">Remove {chip.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 min-h-[32px] text-xs font-semibold text-gray-600 hover:text-black underline underline-offset-2 ml-1 touch-manipulation"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results meta + sort (desktop) — live count, no Enter needed */}
        <div className="hidden md:flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/80">
          <p className={`text-sm font-semibold ${loading ? "text-[#8a7340]" : "text-gray-900"}`} aria-live="polite">
            {resultLabel}
            {loading && (
              <span className="ml-2 inline-block w-3.5 h-3.5 border-2 border-[#CFB36E] border-t-transparent rounded-full animate-spin align-[-2px]" aria-hidden="true" />
            )}
          </p>
          <div className="flex items-center gap-3">
            {hasAnySavedSearch() && (
              <span className="text-xs text-[#8a7340] font-medium hidden lg:inline">
                ★ Match chips show homes that fit your saved search
              </span>
            )}
            <div
              className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5"
              role="group"
              aria-label="Results per row"
            >
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setDensity(n);
                    try {
                      window.localStorage.setItem("saa-card-density", String(n));
                    } catch {}
                  }}
                  aria-pressed={density === n}
                  title={n === 1 ? "One column" : `${n} columns`}
                  className={`min-h-[40px] w-9 rounded-md text-xs font-bold touch-manipulation transition-colors ${
                    density === n ? "bg-black text-white" : "text-gray-500 hover:text-black"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={filters.sort}
                onChange={(e) => setFilterInstant("sort", e.target.value)}
                className="min-h-[40px] px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
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

      {/* Mobile map | list toggle — 44px tap targets */}
      <div className="flex lg:hidden border-b border-gray-200 bg-white shrink-0">
        <button
          type="button"
          onClick={() => setView("list")}
          className={`flex-1 min-h-[44px] py-2.5 text-sm font-semibold transition-colors touch-manipulation ${
            view === "list" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          List{!loading && meta.total > 0 ? ` (${meta.total.toLocaleString()})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setView("map")}
          className={`flex-1 min-h-[44px] py-2.5 text-sm font-semibold transition-colors touch-manipulation ${
            view === "map" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Map
        </button>
      </div>

      {/* Body — map dominant (~58%), list ~42% on desktop */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div
          className={`relative lg:block lg:w-[58%] xl:w-[60%] border-r border-gray-200 ${
            view === "map" ? "block flex-1" : "hidden"
          }`}
        >
          <div className="absolute inset-0">
            <ListingMap
              listings={results}
              selectedId={selectedId}
              onSelect={selectCard}
              onOpenListing={openListingPanel}
              drawEnabled={drawEnabled}
              polygon={filters.polygon || ""}
              onPolygonChange={handlePolygonChange}
              priceHeatmap={priceHeatmap}
            />
          </div>

          {/* Results count chip — floating on map */}
          {!loading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="inline-flex items-center min-h-[36px] px-3.5 py-1.5 rounded-full bg-white/95 text-gray-900 text-sm font-bold shadow-md border border-gray-200/80 backdrop-blur-sm">
                {meta.total > 0
                  ? `${meta.total.toLocaleString()} home${meta.total === 1 ? "" : "s"}`
                  : "No homes match"}
              </span>
            </div>
          )}

          {/* Map controls — draw + price heatmap */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setDrawEnabled((d) => !d);
                setView("map");
              }}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold shadow-md border transition-colors touch-manipulation ${
                drawEnabled
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-900 border-gray-200 hover:border-black"
              }`}
              aria-pressed={drawEnabled}
              title="Draw a shape on the map instead of picking a city"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {drawEnabled ? "Drawing… click to finish" : "Draw area"}
            </button>
            {filters.polygon && (
              <button
                type="button"
                onClick={() => handlePolygonChange("")}
                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold shadow-md bg-white text-gray-700 border border-gray-200 hover:border-black touch-manipulation"
              >
                Clear shape
              </button>
            )}
            <button
              type="button"
              onClick={() => setPriceHeatmap((h) => !h)}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold shadow-md border transition-colors touch-manipulation ${
                priceHeatmap
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-900 border-gray-200 hover:border-black"
              }`}
              aria-pressed={priceHeatmap}
              title="Color pins by list price: green (lower) → yellow → red (higher)"
            >
              <span
                className="inline-block w-3.5 h-3.5 rounded-full shrink-0"
                style={{
                  background: priceHeatmap
                    ? "linear-gradient(90deg, #22c55e, #eab308, #ef4444)"
                    : "linear-gradient(90deg, #CFB36E, #CFB36E)",
                }}
                aria-hidden="true"
              />
              {priceHeatmap ? "Price colors on" : "Price heatmap"}
            </button>
            {priceHeatmap && (
              <div className="rounded-lg bg-white/95 border border-gray-200 shadow-md px-2.5 py-2 text-[10px] font-medium text-gray-600 leading-tight">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Mid
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> High
                </div>
              </div>
            )}
          </div>

          {/* Empty results overlay on map */}
          {!loading && !error && results.length === 0 && (
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-10 flex justify-center pointer-events-none">
              <div className="pointer-events-auto max-w-sm w-full rounded-xl bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl px-5 py-4 text-center">
                <p className="text-sm font-bold text-gray-900">No homes match your filters</p>
                {activeChips.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                    Active: {activeChips.map((c) => c.label).join(" · ")}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Widen price or beds, expand the search area, or clear filters to see more homes.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 min-h-[40px] px-4 py-2 bg-black text-white text-xs font-semibold rounded-lg touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
                >
                  Clear all filters
                </button>
                <a
                  href="/properties/"
                  onClick={(e) => {
                    e.preventDefault();
                    clearFilters();
                  }}
                  className="mt-2 inline-block text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-black"
                >
                  Browse all {marketPack.market.name} homes
                </a>
              </div>
            </div>
          )}

          {drawEnabled && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 max-w-[90%] px-3 py-2 rounded-lg bg-black/85 text-white text-xs font-medium text-center shadow-lg">
              Click the map to add corners · double-click or click the first point to finish
            </div>
          )}
          <div className="hidden lg:block absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <SaveSearchModal
              filters={saveFilters}
              buttonLabel="Save this search · price drops & new homes"
              buttonClassName="shadow-lg min-h-[44px] px-5 py-3 bg-white text-gray-900 border border-gray-200 rounded-full text-sm font-semibold hover:border-black transition-colors touch-manipulation"
            />
          </div>
        </div>

        <div
          ref={resultsRef}
          className={`overflow-y-auto overscroll-contain bg-gray-50 @container ${
            view === "list" ? "flex-1" : "hidden lg:block lg:w-[42%] xl:w-[40%]"
          }`}
        >
          <div className="md:hidden px-4 pt-3 pb-1">
            <p className={`text-sm font-semibold ${loading ? "text-[#8a7340]" : "text-gray-900"}`} aria-live="polite">
              {resultLabel}
            </p>
          </div>

          {/* First load: skeleton shimmer matching card layout */}
          {loading && results.length === 0 && (
            <div
              className={
                isNarrow && view === "list"
                  ? "p-3 sm:p-4 flex flex-col gap-3"
                  : `p-3 sm:p-4 ${cardGridClass}`
              }
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} compact={isNarrow && view === "list"} />
              ))}
            </div>
          )}

          {loading && results.length > 0 && (
            <div className="mx-3 sm:mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#CFB36E]/15 border border-[#CFB36E]/40 text-sm font-semibold text-gray-900">
              <span className="inline-block w-3.5 h-3.5 border-2 border-[#CFB36E] border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
              Updating results…
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center text-center min-h-[360px] px-6">
              <p className="text-gray-900 font-semibold text-lg">We couldn&apos;t load listings</p>
              <p className="text-gray-500 mt-2 max-w-md text-sm">
                Please try again in a moment, or call{" "}
                <a href={marketPack.market.tel} className="underline text-black font-medium">{marketPack.market.phone}</a>.
              </p>
              <button
                type="button"
                onClick={() => fetchListings(filters, 1, false)}
                className="mt-4 min-h-[44px] px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 active:scale-[0.99] transition-all touch-manipulation"
              >
                Retry search
              </button>
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center min-h-[360px] px-6">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </div>
              <p className="text-gray-900 font-semibold text-lg">
                No homes match your filters
                {filters.polygon
                  ? " in your drawn area"
                  : areaLabel && areaLabel !== marketPack.market.name
                    ? ` in ${areaLabel}`
                    : ""}
              </p>
              {activeChips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 justify-center max-w-md">
                  {activeChips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center min-h-[28px] px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#CFB36E]/20 text-gray-900 border border-[#CFB36E]/45"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-gray-500 mt-3 max-w-md text-sm leading-relaxed">
                Try widening price or beds, expand the map area, or clear filters. You can also save this search — we&apos;ll email you when a match hits the market (new homes + price drops, no spam).
              </p>
              <div className="mt-5 flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-[44px] px-5 py-2.5 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
                >
                  Clear all filters
                </button>
                <SaveSearchModal
                  filters={saveFilters}
                  buttonLabel="Alert me when one appears"
                  buttonClassName="min-h-[44px] px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold hover:border-black touch-manipulation"
                />
              </div>
              <a
                href="/properties/"
                onClick={(e) => {
                  e.preventDefault();
                  clearFilters();
                }}
                className="mt-4 text-sm font-semibold text-gray-700 underline underline-offset-2 hover:text-black"
              >
                Browse all {marketPack.market.name} homes
              </a>
              <p className="text-gray-400 text-xs mt-4">
                Or explore our{" "}
                <a href="/northern-colorado-areas/" className="underline">city guides</a>
              </p>
            </div>
          )}

          {/* Keep prior cards visible while updating so live filter changes feel instant.
              Mobile list: compact horizontal. Grid: 2 cols when list panel ≥560px (≈ full width @900+). */}
          {!error && results.length > 0 && (
            <div className={`p-3 sm:p-4 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
              <div
                className={
                  isNarrow && view === "list"
                    ? "flex flex-col gap-3"
                    : cardGridClass
                }
              >
                {results.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    selected={selectedId === listing.id}
                    onHover={setSelectedId}
                    onOpen={openListingPanel}
                    savedSearches={savedSearches}
                    compact={isNarrow && view === "list"}
                    savedMap={savedMap}
                  />
                ))}
              </div>

              <div className="mt-6 mb-4 flex flex-col items-center gap-3">
                {page < (meta.pages || 1) ? (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => fetchListings(filters, page + 1, true)}
                    className="min-h-[48px] px-6 py-3 bg-white border-2 border-black text-black font-semibold rounded-lg text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50 touch-manipulation"
                  >
                    {loadingMore ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                        Loading more
                      </span>
                    ) : (
                      `Show more homes (${results.length} of ${meta.total.toLocaleString()})`
                    )}
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
                      buttonClassName="min-h-[44px] px-4 py-2.5 bg-black text-white rounded-lg text-sm font-semibold touch-manipulation"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter drawer overlay — proportional width, not cramped */}
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
              w-full md:w-[min(520px,92vw)] lg:w-[min(560px,40vw)]
              h-[92vh] md:h-full
              mt-auto md:mt-0
              rounded-t-2xl md:rounded-none
              animate-[slideUp_0.25s_ease-out]"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200 shrink-0">
              <h2 className="text-base font-bold text-gray-900">Filters</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 touch-manipulation"
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
