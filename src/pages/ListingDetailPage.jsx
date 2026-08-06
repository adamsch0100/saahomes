import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import QualifyCta from "../components/QualifyCta";
import ListingMap from "../components/ListingMap";
import SaveSearchModal from "../components/SaveSearchModal";
import ScheduleShowingModal from "../components/ScheduleShowingModal";
import { photoUrl } from "../utils/photoUrl.js";
import { CITY_HOMES, getCityHomesPath } from "../data/cityHomesData";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const formatPrice = (n) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const fmtSqft = (n) => (n == null ? "—" : `${Number(n).toLocaleString()} sqft`);

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
    <div className="bg-gray-50 rounded-lg p-3.5">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="font-semibold text-gray-900 mt-0.5 text-sm sm:text-base">{value}</p>
    </div>
  );
}

export default function ListingDetailPage() {
  const { slug } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [similar, setSimilar] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setListing(null);
    setError(null);
    setActivePhoto(0);
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
    // saved state
    try {
      const savedList = JSON.parse(localStorage.getItem("saa-saved-homes") || "[]");
      setSaved(savedList.includes(listing.slug));
    } catch { /* noop */ }
  }, [listing]);

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

  if (!listing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-500">Loading listing…</div>
    );
  }

  const address = [listing.street_number, listing.street_name, listing.unit && `#${listing.unit}`]
    .filter(Boolean).join(" ");
  const fullAddress = [address, listing.city, listing.state].filter(Boolean).join(", ");
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const feats = listing.features || {};
  const citySlug = (listing.city || "").toLowerCase().replace(/\s+/g, "-");
  const cityHomes = CITY_HOMES.find((c) => c.slug === citySlug);
  const dom = listing.days_on_market;
  const isNew = dom != null && dom <= 7;
  const priceCut =
    listing.original_list_price != null &&
    listing.list_price != null &&
    Number(listing.original_list_price) > Number(listing.list_price);
  const priceCutPct = priceCut
    ? Math.round((1 - Number(listing.list_price) / Number(listing.original_list_price)) * 100)
    : null;
  const sqft = listing.living_area;
  const pricePerSqft = listing.price_per_sqft
    ?? (listing.list_price && sqft ? Math.round(listing.list_price / sqft) : null);

  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${fullAddress} — Homes for Sale`,
    url: `https://saahomes.com/homes-for-sale/${listing.slug}/`,
    description: listing.description ? listing.description.slice(0, 250) : `${fullAddress} in ${listing.city}, CO`,
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
    ...(listing.property_subtype ? { additionalProperty: { "@type": "PropertyValue", name: "PropertySubType", value: listing.property_subtype } } : {}),
  };

  const toggleSave = () => {
    try {
      const savedList = JSON.parse(localStorage.getItem("saa-saved-homes") || "[]");
      const next = savedList.includes(listing.slug)
        ? savedList.filter((s) => s !== listing.slug)
        : [...savedList, listing.slug];
      localStorage.setItem("saa-saved-homes", JSON.stringify(next));
      setSaved(!savedList.includes(listing.slug));
    } catch { /* noop */ }
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
      ...(listing.city ? [{ "@type": "ListItem", position: 3, name: `${listing.city} Homes for Sale`, item: `https://saahomes.com/${citySlug}-homes-for-sale/` }] : []),
      { "@type": "ListItem", position: listing.city ? 4 : 3, name: fullAddress, item: `https://saahomes.com/homes-for-sale/${listing.slug}/` },
    ],
  };

  const ogImage = photos.length ? `https://saahomes.com/api/photo/${listing.id}/0` : undefined;

  return (
    <>
      <SEO
        title={`${fullAddress} | ${listing.city} Real Estate | SAA Homes`}
        description={metaDesc.slice(0, 158)}
        canonicalPath={`/homes-for-sale/${listing.slug}/`}
        ogImage={ogImage}
        jsonLd={[listingSchema, breadcrumbSchema]}
      />

      {/* Hero gallery */}
      <section className="bg-black pt-24 sm:pt-28">
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif">{fullAddress}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                <span className="text-2xl font-bold text-[#CFB36E]">{formatPrice(listing.list_price)}</span>
                <span className="text-gray-300">{HOME_TYPE_LABEL[listing.home_type] || listing.property_subtype || listing.property_type}</span>
                {isNew && (
                  <span className="bg-[#CFB36E] text-black text-xs font-bold px-2.5 py-1 rounded-full">NEW</span>
                )}
                {priceCut && (
                  <span className="bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    PRICE REDUCED {priceCutPct}%
                  </span>
                )}
                {feats.new_construction && (
                  <span className="border border-[#CFB36E] text-[#CFB36E] text-xs font-bold px-2.5 py-1 rounded-full">NEW CONSTRUCTION</span>
                )}
                {listing.status === "Active" && (
                  <span className="border border-emerald-400 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full">ACTIVE</span>
                )}
              </div>
              <p className="text-gray-300 mt-1 text-sm">
                {listing.beds != null && <span>{listing.beds} bd</span>}
                {listing.baths != null && <span> · {listing.baths} ba</span>}
                {listing.half_baths != null && listing.half_baths > 0 && <span> · {listing.half_baths} half-ba</span>}
                {sqft != null && <span> · {Number(sqft).toLocaleString()} sqft</span>}
                {pricePerSqft != null && <span> · ${pricePerSqft}/sqft</span>}
                {listing.subdivision && <span> · {listing.subdivision}</span>}
              </p>
              {priceCut && (
                <p className="text-gray-400 text-sm mt-1">
                  Was {formatPrice(listing.original_list_price)}
                </p>
              )}
              {listing.school_district && (
                <p className="text-gray-400 text-sm mt-1">🏫 {listing.school_district}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                title="Go back"
                aria-label="Go back"
                onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/properties/"))}
                className="w-10 h-10 rounded-full border border-white/30 hover:border-white text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={toggleSave}
                className={`px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  saved
                    ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                    : "border-white text-white hover:bg-white hover:text-black"
                }`}
              >
                {saved ? "♥ Saved" : "♡ Save this home"}
              </button>
            </div>
          </div>
        </div>
        {photos.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pb-6">
            <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-800">
              <img src={photoUrl(listing.id, activePhoto)} alt={`${fullAddress} — photo ${activePhoto + 1}`}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/images/buyers-hero.jpg"; }}
                className="w-full h-full object-cover" />
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={`w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 ${
                      i === activePhoto ? "border-[#CFB36E]" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={photoUrl(listing.id, i)} alt={`${fullAddress} photo ${i + 1}`}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/images/buyers-hero.jpg"; }}
                      className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Main content */}
      <section className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          {/* Key facts */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Key Facts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KeyFact label="Price" value={formatPrice(listing.list_price)} />
              <KeyFact label="Price / Sq Ft" value={pricePerSqft != null ? `$${pricePerSqft}` : null} />
              <KeyFact label="Beds" value={listing.beds != null ? String(listing.beds) : null} />
              <KeyFact label="Baths" value={listing.baths != null ? String(listing.baths) : null} />
              <KeyFact label="Living Area" value={fmtSqft(sqft)} />
              <KeyFact label="Above Grade" value={listing.above_grade_area != null ? fmtSqft(listing.above_grade_area) : null} />
              <KeyFact label="Lot Size" value={listing.lot_size_acres != null ? `${listing.lot_size_acres} acres` : listing.lot_size != null ? fmtSqft(listing.lot_size) : null} />
              <KeyFact label="Year Built" value={listing.year_built ? String(listing.year_built) : null} />
              <KeyFact label="Days on Market" value={dom != null ? String(dom) : null} />
              <KeyFact label="Property Type" value={listing.property_subtype || listing.property_type} />
              <KeyFact label="Garage" value={listing.garage_spaces != null ? `${listing.garage_spaces} spaces` : null} />
              <KeyFact label="HOA Fee" value={listing.hoa_fee != null ? `${formatPrice(listing.hoa_fee)}${feats.assoc_fee_freq ? ` / ${feats.assoc_fee_freq.toLowerCase()}` : ""}` : null} />
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

          {/* Schools */}
          {(listing.elementary_school || listing.middle_school || listing.high_school) && (
            <div className="bg-gray-50 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Schools</h2>
              <p className="text-gray-500 text-sm mb-4">
                School attendance zones are assigned by the district and can change — verify with the district before relying on them.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  ["Elementary", listing.elementary_school],
                  ["Middle School", listing.middle_school],
                  ["High School", listing.high_school],
                ].filter(([, v]) => v).map(([label, value]) => (
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
              {cityHomes ? cityHomes.intro : `${listing.city} is one of the Northern Colorado communities served by Schwartz and Associates at SAA Homes.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/northern-colorado-areas/${citySlug}/`}
                className="px-4 py-2 bg-[#CFB36E] text-black text-sm font-semibold rounded-lg hover:bg-[#bd9f5a]">
                {listing.city} Neighborhood Guide
              </Link>
              <Link to={getCityHomesPath(citySlug)}
                className="px-4 py-2 border border-white text-white text-sm font-semibold rounded-lg hover:bg-white hover:text-black">
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
                  listings={[{ id: listing.id, slug: listing.slug, latitude: Number(listing.latitude), longitude: Number(listing.longitude), list_price: listing.list_price, street_name: listing.street_name, city: listing.city, photos: photos.slice(0, 1) }]}
                />
              </div>
            </div>
          )}

          {/* Similar homes */}
          {similar.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Similar Homes in {listing.city}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {similar.map((l) => (
                  <Link key={l.listing_id} to={`/homes-for-sale/${l.slug}/`}
                    className="group block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                      <img src={(l.photos && l.photos[0]) ? photoUrl(l.id, 0) : "/images/buyers-hero.jpg"} alt={`${l.street_name || "Home"} in ${l.city}`}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/images/buyers-hero.jpg"; }}
                        loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-gray-900">{formatPrice(l.list_price)}</p>
                      <p className="text-xs text-gray-500">
                        {l.beds != null ? `${l.beds} bd` : ""}{l.baths != null ? ` · ${l.baths} ba` : ""}
                        {l.living_area != null ? ` · ${Number(l.living_area).toLocaleString()} sqft` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky contact card */}
        <aside className="space-y-4 lg:sticky lg:top-24 h-fit">
          <div className="bg-black text-white rounded-xl p-6">
            <h2 className="text-lg font-bold font-serif">Interested in this home?</h2>
            <p className="text-gray-300 text-sm mt-2 leading-relaxed">
              Let's talk — we'll walk you through pricing, neighborhood details, and whether you qualify for CHFA down payment assistance.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-nadia-chat", {
                    detail: { message: `Hi! I'm interested in ${fullAddress} (${formatPrice(listing.list_price)}). Can you tell me more?` },
                  }))
                }
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                style={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
              >
                💬 Chat about this home
              </button>
              <ScheduleShowingModal
                listing={listing}
                buttonLabel="Schedule a Showing"
                buttonClassName="w-full inline-flex items-center justify-center px-6 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors"
              />
              {feats.virtual_tour && (
                <a
                  href={feats.virtual_tour}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-6 py-3.5 border border-[#CFB36E] text-[#CFB36E] font-semibold rounded-lg hover:bg-[#CFB36E] hover:text-black transition-colors"
                >
                  ▶ Virtual Tour
                </a>
              )}
              <SaveSearchModal
                filters={{
                  city: listing.city || undefined,
                  minPrice: listing.list_price ? String(Math.max(0, Math.round(Number(listing.list_price) * 0.8))) : undefined,
                  maxPrice: listing.list_price ? String(Math.round(Number(listing.list_price) * 1.2)) : undefined,
                  beds: listing.beds != null ? String(listing.beds) : undefined,
                  baths: listing.baths != null ? String(listing.baths) : undefined,
                  type: listing.home_type || undefined,
                }}
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
                  HOA: {formatPrice(listing.hoa_fee)}{feats.assoc_fee_freq ? ` / ${feats.assoc_fee_freq.toLowerCase()}` : ""}
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

      {/* Conversational qualify CTA */}
      <QualifyCta
        program={`a home in ${listing.city || "Northern Colorado"}`}
        chatQuestion={`Hi! I'm looking at a home in ${listing.city || "Northern Colorado"} and want to know if I'd qualify for a loan or CHFA assistance. Can you help?`}
        formAnchor="/contact/"
        formLabel="Ask a question instead"
      />
    </>
  );
}
