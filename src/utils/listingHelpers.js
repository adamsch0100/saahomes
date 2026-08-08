/**
 * Shared listing UI helpers — badges, formatters, saved homes & saved-search match.
 * All facts must come from MLS fields; never invent stats.
 */

export const formatPrice = (n) =>
  n == null || n === "" ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const formatPriceCompact = (n) => {
  if (n == null || n === "") return "";
  const num = Number(n);
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, "")}M`;
  }
  if (num >= 10_000) return `$${Math.round(num / 1000)}K`;
  return formatPrice(num);
};

export const fmtNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
};

export const fmtSqft = (n) => (n == null ? "—" : `${Number(n).toLocaleString()} sqft`);

export function listingAddress(listing) {
  if (!listing) return "";
  return [listing.street_number, listing.street_name, listing.unit && `#${listing.unit}`]
    .filter(Boolean)
    .join(" ");
}

export function listingFullAddress(listing) {
  if (!listing) return "";
  const street = listingAddress(listing);
  return [street, listing.city, listing.state].filter(Boolean).join(", ");
}

/** Badge flags derived only from MLS fields — never invent. NEW = ≤3 DOM. */
export function listingBadges(listing) {
  if (!listing) {
    return {
      isNew: false,
      priceCut: false,
      priceCutPct: null,
      isNewConstruction: false,
      hasOpenHouse: false,
      dom: null,
    };
  }
  const dom = listing.days_on_market;
  // Zillow-grade "NEW" badge: first 3 days on market only
  const isNew = dom != null && Number(dom) <= 3;
  const priceCut =
    listing.original_list_price != null &&
    listing.list_price != null &&
    Number(listing.original_list_price) > Number(listing.list_price);
  const priceCutPct = priceCut
    ? Math.round((1 - Number(listing.list_price) / Number(listing.original_list_price)) * 100)
    : null;
  const feats = listing.features || {};
  const isNewConstruction = Boolean(feats.new_construction);
  // Open house only when feed exposes a real flag/date (never fabricate)
  const hasOpenHouse = Boolean(
    listing.open_house === true ||
      listing.has_open_house === true ||
      feats.open_house === true ||
      feats.OpenHouse === true ||
      (typeof feats.open_house === "string" && feats.open_house.length > 0) ||
      (typeof listing.open_house_date === "string" && listing.open_house_date.length > 0)
  );
  return { isNew, priceCut, priceCutPct, isNewConstruction, hasOpenHouse, dom };
}

/** Human home-type label from MLS home_type / property_type / subtype — no invention */
export function homeTypeLabel(listing) {
  if (!listing) return "";
  const ht = (listing.home_type || "").toLowerCase();
  const subtype = (listing.property_subtype || "").toLowerCase();
  const ptype = (listing.property_type || "").toLowerCase();
  if (ht === "detached" || subtype.includes("single family") || subtype.includes("single-family")) {
    return "House";
  }
  if (ht === "townhome" || subtype.includes("town") || ptype.includes("townhouse")) return "Townhome";
  if (ht === "condo" || subtype.includes("condo") || ptype.includes("condo")) return "Condo";
  if (ht === "land" || ptype.includes("land")) return "Land";
  if (
    ht === "multi" ||
    ptype.includes("income") ||
    subtype.includes("multi") ||
    subtype.includes("duplex") ||
    subtype.includes("triplex")
  ) {
    return "Multi-family";
  }
  if (
    ht === "manufactured" ||
    ptype.includes("manufactured") ||
    subtype.includes("manufactured") ||
    subtype.includes("mobile")
  ) {
    return "Manufactured";
  }
  if (ht === "attached") return "Attached";
  if (listing.property_subtype) return listing.property_subtype;
  if (listing.property_type && listing.property_type !== "Residential") return listing.property_type;
  return "";
}

// ── Saved homes (local) ────────────────────────────────────────────────
const SAVED_HOMES_KEY = "saa-saved-homes";

export function getSavedHomes() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_HOMES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function isHomeSaved(slug) {
  if (!slug) return false;
  return getSavedHomes().includes(slug);
}

export function toggleSavedHome(slug) {
  if (!slug) return false;
  const list = getSavedHomes();
  const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
  try {
    localStorage.setItem(SAVED_HOMES_KEY, JSON.stringify(next));
  } catch { /* noop */ }
  return next.includes(slug);
}

// ── Saved search filters (for RealScout-style match indicators) ────────
const SAVED_SEARCH_KEY = "saa-saved-search-filters";

export function rememberSavedSearch(filters = {}) {
  try {
    const existing = getSavedSearches();
    const entry = {
      city: filters.city || null,
      minPrice: filters.minPrice ? Number(filters.minPrice) : null,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : null,
      beds: filters.beds ? Number(filters.beds) : null,
      baths: filters.baths ? Number(filters.baths) : null,
      type: filters.type || null,
      savedAt: Date.now(),
    };
    // Keep last 5 unique-ish searches
    const next = [entry, ...existing.filter((s) => JSON.stringify(s) !== JSON.stringify({ ...entry, savedAt: s.savedAt }))].slice(0, 5);
    localStorage.setItem(SAVED_SEARCH_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

export function getSavedSearches() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SEARCH_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * RealScout-style match: does this listing fit any remembered saved search?
 * Returns { matches: boolean, reasons: string[] } for display.
 */
export function matchSavedSearch(listing, searches = getSavedSearches()) {
  if (!listing || !searches.length) return { matches: false, reasons: [] };

  for (const s of searches) {
    const reasons = [];
    let ok = true;

    // Multi-city (comma-separated) and/or multi-zip
    const cityList = s.city && s.city !== "__noco__" && s.city !== "__all__"
      ? String(s.city).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
      : [];
    const zipRaw = s.postal_code || s.postalCode || s.zip || "";
    const zipList = zipRaw
      ? String(zipRaw).split(",").map((x) => x.trim()).filter(Boolean)
      : [];
    if (cityList.length || zipList.length) {
      const cityOk = cityList.length
        ? cityList.includes((listing.city || "").toLowerCase())
        : false;
      const zipOk = zipList.length
        ? zipList.includes(String(listing.postal_code || ""))
        : false;
      if (cityList.length && zipList.length) {
        if (!cityOk && !zipOk) ok = false;
        else if (cityOk) reasons.push(listing.city);
        else reasons.push(listing.postal_code);
      } else if (cityList.length) {
        if (!cityOk) ok = false;
        else reasons.push(listing.city || s.city);
      } else if (!zipOk) {
        ok = false;
      } else {
        reasons.push(listing.postal_code || zipRaw);
      }
    }
    if (s.minPrice != null && listing.list_price != null) {
      if (Number(listing.list_price) < s.minPrice) ok = false;
      else reasons.push(`over ${formatPriceCompact(s.minPrice)}`);
    }
    if (s.maxPrice != null && listing.list_price != null) {
      if (Number(listing.list_price) > s.maxPrice) ok = false;
      else reasons.push(`under ${formatPriceCompact(s.maxPrice)}`);
    }
    if (s.beds != null && listing.beds != null) {
      if (Number(listing.beds) < s.beds) ok = false;
      else reasons.push(`${s.beds}+ beds`);
    }
    if (s.baths != null && listing.baths != null) {
      if (Number(listing.baths) < s.baths) ok = false;
      else reasons.push(`${s.baths}+ baths`);
    }
    if (s.type && listing.home_type && listing.home_type !== s.type) {
      ok = false;
    }

    if (ok && reasons.length > 0) {
      return { matches: true, reasons };
    }
    // Broad "all NoCO" save with no criteria still counts as a soft match when they saved something
    if (ok && !s.city && s.minPrice == null && s.maxPrice == null && s.beds == null && s.baths == null) {
      return { matches: true, reasons: ["your saved search"] };
    }
  }
  return { matches: false, reasons: [] };
}

export function hasAnySavedSearch() {
  return getSavedSearches().length > 0;
}
