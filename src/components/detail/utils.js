/** Shared listing-detail helpers — used by route page + modal popup */

export const HOME_TYPE_LABEL = {
  detached: "Detached Home",
  attached: "Condo / Townhome / Attached",
  land: "Land",
  commercial: "Commercial",
  other: "Property",
};

/** Grouped feature sections — Zillow/Realtor "All details" pattern */
export const FEATURE_GROUPS = [
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
      ["Waterfront", f.waterfront ? f.water_body || "Yes" : null],
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

export function displayValue(v) {
  if (v == null || v === "" || v === false) return null;
  if (typeof v === "string" && !v.trim()) return null;
  return String(v);
}

export function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

export function buildFeatureSections(feats) {
  const f = feats || {};
  return FEATURE_GROUPS.map((g) => ({
    title: g.title,
    items: g.rows(f).filter(([, v]) => displayValue(v)),
  })).filter((g) => g.items.length > 0);
}

export function lotLabel(listing) {
  if (!listing) return null;
  if (listing.lot_size_acres != null) return `${listing.lot_size_acres} acres`;
  if (listing.lot_size != null) {
    const n = Number(listing.lot_size);
    if (Number.isFinite(n)) return `${n.toLocaleString("en-US")} sqft`;
  }
  return null;
}

export function pricePerSqftOf(listing) {
  if (!listing) return null;
  if (listing.price_per_sqft != null) return listing.price_per_sqft;
  const sqft = listing.living_area;
  if (listing.list_price && sqft) return Math.round(Number(listing.list_price) / Number(sqft));
  return null;
}
