/**
 * RESO Data Dictionary → our listings table.
 *
 * Moved out of iresSync.js unchanged so every MLS feed maps a Property record
 * the same way. IRES calls normalizeResoListing() with no options and gets
 * exactly what it always did; the generic engine (mls/engine.js) passes the
 * feed's id prefix, home state and source name.
 */

// Adam's home-type model (Aug 2026): attached = condos/townhomes/multi-unit,
// detached = freestanding homes. PropertyAttachedYN is the feed's definitive
// flag; PropertySubType carries the label.
export function classifyHomeType(propertyType, subtype, attachedYn) {
  const s = (subtype || '').toLowerCase();
  const t = (propertyType || '').toLowerCase();
  if (t.includes('land') || s.includes('land') || s.includes('unimproved')) return 'land';
  if (t.includes('commercial') || ['office', 'warehouse', 'retail', 'industrial', 'mixed use', 'mixed-use'].includes(s)) return 'commercial';
  if (attachedYn === true || attachedYn === 'Y') return 'attached';
  if (s.includes('condo') || s.includes('town') || s.includes('attached') ||
      s.includes('duplex') || s.includes('triplex') || s.includes('multi family') ||
      s.includes('timeshare') || t.includes('residential income') || t.includes('condominium')) return 'attached';
  if (s.includes('single family') || s.includes('detached') || s.includes('cabin') ||
      s.includes('farm') || s.includes('manufactured on land') || s === '') return 'detached';
  return 'other';
}

export const STATUS_MAP = {
  Active: 'Active',
  'Active Under Contract': 'Active Under Contract', // backup offers accepted
  Pending: 'Pending',
  Contingent: 'Pending',
  Closed: 'Sold',
  Sold: 'Sold',
  Expired: 'Expired',
  Withdrawn: 'Withdrawn',
  OffMarket: 'Withdrawn',
  Canceled: 'Canceled',
};

// Statuses shown as "listed" in search (is_active=TRUE). Sold/Withdrawn/
// Expired/Canceled are archived (is_active=FALSE but still stored).
export const LISTED_STATUSES = new Set(['Active', 'Active Under Contract', 'Pending']);

/** IRES's photo rule: a Media row whose URL ends in an image extension. */
export function isPhotoUrlByExtension(m) {
  return typeof m?.MediaURL === 'string' && /\.(jpe?g|png|webp)(\?|$)/i.test(m.MediaURL);
}

/**
 * Photos for feeds whose media URLs carry no file extension (Trestle serves
 * them from an API path): any http(s) MediaURL that isn't marked as a video,
 * document or floor plan.
 */
export function isPhotoMedia(m) {
  if (typeof m?.MediaURL !== 'string' || !/^https?:\/\//i.test(m.MediaURL)) return false;
  const kind = `${m.MediaCategory || ''} ${m.MediaType || ''} ${m.MimeType || ''}`.toLowerCase();
  if (/video|document|pdf|tour|audio|floor ?plan/.test(kind)) return false;
  return true;
}

/** Ordered photo URLs from a record's expanded Media. */
export function photosFromMedia(media, isPhoto = isPhotoUrlByExtension) {
  return (Array.isArray(media) ? media : [])
    .filter(isPhoto)
    .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m) => m.MediaURL)
    .filter(Boolean);
}

/**
 * One RESO Property record → a listings row. With no options this is the
 * IRES mapping exactly (state defaults to CO, source to IRES, the MLS number
 * is the listing id). Other feeds pass:
 *   idPrefix      'feedkey-' so two MLSs' numbers never collide
 *   defaultState  the MLS's home state
 *   defaultSource the MLS's short name
 *   isPhoto       which Media rows are photos
 */
export function normalizeResoListing(raw, {
  idPrefix = '', defaultState = 'CO', defaultSource = 'IRES', isPhoto = isPhotoUrlByExtension,
} = {}) {
  const photos = photosFromMedia(raw.Media, isPhoto);

  const street = [raw.StreetNumber, raw.StreetName].filter(Boolean).join(' ');
  const city = raw.City || '';
  const state = raw.StateOrProvince || defaultState;

  // Data sanitization: MLS feeds contain garbage values (e.g. HOA fee $9.7B).
  // Store null rather than absurd numbers — never ship junk to the site.
  const num = (v, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= max ? n : null;
  };
  // Signed variant for coordinates — Colorado longitudes are negative (-105°).
  const numSigned = (v, max) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 && Math.abs(n) <= max ? n : null;
  };

  const slugBase = `${street || 'home'} ${city} ${state} ${raw.ListPrice || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const livingArea = num(raw.LivingArea, 1e7) ?? num(raw.BuildingAreaTotal, 1e7);
  const listPrice = num(raw.ListPrice, 1e9);
  const originalPrice = num(raw.OriginalListPrice, 1e9);
  const str = (v) => (Array.isArray(v) ? v.join(', ') : v);
  const yn = (v) => v === 'Y' || v === true || v === 'Yes';
  const features = {
    style: str(raw.ArchitecturalStyle) || null,
    levels: str(raw.Levels) || null,
    structure_type: str(raw.StructureType) || null,
    basement: str(raw.Basement) || null,
    construction: str(raw.ConstructionMaterials) || null,
    roof: str(raw.Roof) || null,
    interior: str(raw.InteriorFeatures) || null,
    exterior: str(raw.ExteriorFeatures) || null,
    appliances: str(raw.Appliances) || null,
    flooring: str(raw.Flooring) || null,
    cooling: str(raw.Cooling) || null,
    heating: str(raw.Heating) || null,
    fireplaces: str(raw.FireplaceFeatures) || null,
    pool: str(raw.PoolFeatures) || yn(raw.PoolFeatures) || null,
    spa: str(raw.SpaFeatures) || null,
    parking: str(raw.ParkingFeatures) || null,
    parking_total: raw.ParkingTotal != null ? String(raw.ParkingTotal) : null,
    other_parking: str(raw.OtherParking) || null,
    fencing: str(raw.Fencing) || null,
    patio: str(raw.PatioAndPorchFeatures) || null,
    windows: str(raw.WindowFeatures) || null,
    security: str(raw.SecurityFeatures) || null,
    doors: str(raw.DoorFeatures) || null,
    electric: str(raw.Electric) || null,
    laundry: str(raw.LaundryFeatures) || null,
    other_equipment: str(raw.OtherEquipment) || null,
    other_structures: str(raw.OtherStructures) || null,
    pets: str(raw.PetsAllowed) || null,
    view: str(raw.View) || null,
    waterfront: yn(raw.WaterfrontYN),
    water_body: raw.WaterBodyName || null,
    horse: str(raw.HorseAmenities) || null,
    irrigation: str(raw.IrrigationSource) || null,
    irrigation_rights: yn(raw.IrrigationWaterRightsYN),
    sewer: str(raw.Sewer) || null,
    water_source: str(raw.WaterSource) || null,
    utilities: str(raw.Utilities) || null,
    zoning: str(raw.Zoning) || null,
    lot_features: str(raw.LotFeatures) || null,
    directions: raw.Directions || null,
    disclosures: str(raw.Disclosures) || null,
    association: yn(raw.AssociationYN),
    association_name: raw.AssociationName || null,
    association_includes: str(raw.AssociationFeeIncludes) || null,
    association_phone: raw.AssociationPhone || null,
    assoc_fee_freq: raw.AssociationFeeFrequency || null,
    builder: raw.BuilderName || null,
    builder_model: raw.BuilderModel || null,
    new_construction: yn(raw.NewConstructionYN),
    green_efficient: str(raw.GreenEnergyEfficient) || null,
    green_verification: str(raw.GreenBuildingVerificationType) || null,
    accessibility: str(raw.AccessibilityFeatures) || null,
    community: str(raw.CommunityFeatures) || null,
    tax_annual: num(raw.TaxAnnualAmount, 1e8),
    tax_year: num(raw.TaxYear, 2100),
    parcel: raw.ParcelNumber || null,
    listing_terms: str(raw.ListingTerms) || null,
    special_conditions: str(raw.SpecialListingConditions) || null,
    availability: raw.AvailabilityDate || null,
    subdivision: raw.SubdivisionName || null,
    mls_area: [raw.MLSAreaMajor, raw.MLSAreaMinor].filter(Boolean).join(' / ') || null,
    virtual_tour: raw.VirtualTourURLUnbranded || null,
  };

  return {
    listing_id: `${idPrefix}${String(raw.ListingId || raw.ListingKey)}`.slice(0, 64),
    status: STATUS_MAP[raw.StandardStatus] || String(raw.StandardStatus || 'Active'),
    // MlgCanView=false (docs: "record must be removed from your local data
    // store") → force archived so we never display a listing we're not
    // licensed to show. True/absent → normal status logic.
    is_active: (raw.MlgCanView === false || String(raw.MlgCanView).toLowerCase() === 'false')
      ? false
      : LISTED_STATUSES.has(STATUS_MAP[raw.StandardStatus] || String(raw.StandardStatus || 'Active')),
    modification_timestamp: raw.ModificationTimestamp || null,
    photos_change_timestamp: raw.PhotosChangeTimestamp || null,
    property_type: raw.PropertyType || null,
    property_subtype: raw.PropertySubType || null,
    home_type: classifyHomeType(raw.PropertyType, raw.PropertySubType, raw.PropertyAttachedYN),
    street_number: raw.StreetNumber ? String(raw.StreetNumber) : null,
    street_name: [raw.StreetDirPrefix, raw.StreetName, raw.StreetSuffix, raw.StreetDirSuffix].filter(Boolean).join(' ') || null,
    unit: raw.UnitNumber ? String(raw.UnitNumber) : null,
    city,
    state,
    postal_code: raw.PostalCode ? String(raw.PostalCode) : null,
    county: raw.CountyOrParish || null,
    list_price: listPrice,
    original_list_price: originalPrice,
    price_change_timestamp: raw.PriceChangeTimestamp || null,
    beds: num(raw.BedroomsTotal, 100),
    baths: num(raw.BathroomsTotalInteger, 50) ?? num(raw.BathroomsFull, 50),
    half_baths: num(raw.BathroomsHalf, 50),
    three_quarter_baths: num(raw.BathroomsThreeQuarter, 50),
    living_area: livingArea,
    above_grade_area: num(raw.AboveGradeFinishedArea, 1e7),
    lot_size: num(raw.LotSizeArea, 1e12),
    lot_size_acres: num(raw.LotSizeAcres, 1e6),
    units_total: num(raw.NumberOfUnitsTotal, 1000),
    year_built: num(raw.YearBuilt, 2100),
    garage_spaces: num(raw.GarageSpaces, 100),
    hoa_fee: num(raw.AssociationFee, 1e6),
    description: raw.PublicRemarks || null,
    // IRES has no structured loan field — remarks text is the only signal.
    assumable: typeof raw.PublicRemarks === 'string' && /assum/i.test(raw.PublicRemarks),
    photos,
    photos_count: num(raw.PhotosCount, 500) ?? photos.length,
    latitude: numSigned(raw.Latitude, 90),
    longitude: numSigned(raw.Longitude, 180),
    listing_url: null,
    mls_source: raw.OriginatingSystemName || defaultSource,
    list_office_name: raw.ListOfficeName ? String(raw.ListOfficeName).slice(0, 255) : null,
    list_office_mls_id: raw.ListOfficeMlsId ? String(raw.ListOfficeMlsId).slice(0, 40) : null,
    list_agent_name: raw.ListAgentFullName ? String(raw.ListAgentFullName).slice(0, 255) : null,
    list_agent_mls_id: raw.ListAgentMlsId ? String(raw.ListAgentMlsId).slice(0, 40) : null,
    elementary_school: raw.ElementarySchool || null,
    middle_school: raw.MiddleOrJuniorSchool || null,
    high_school: raw.HighSchool || null,
    school_district: raw.HighSchoolDistrict || null,
    days_on_market: num(raw.DaysOnMarket, 10000),
    price_per_sqft: livingArea && listPrice ? Math.round(listPrice / livingArea) : null,
    subdivision: raw.SubdivisionName || null,
    features,
    raw,
    slug: `${slugBase}-${idPrefix ? idPrefix.replace(/[^a-z0-9]+/gi, '').toLowerCase() + '-' : ''}${String(raw.ListingId || raw.ListingKey).slice(-6)}`,
  };
}
