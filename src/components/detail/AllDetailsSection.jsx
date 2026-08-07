import React, { useState } from "react";
import {
  formatPrice,
  fmtSqft,
  listingBadges,
} from "../../utils/listingHelpers.js";
import {
  buildFeatureSections,
  displayValue,
  lotLabel,
  pricePerSqftOf,
} from "./utils.js";

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

/**
 * Listing details: key facts grid + collapsible "All details" feature groups.
 */
export default function AllDetailsSection({ listing }) {
  const [openFeatureGroups, setOpenFeatureGroups] = useState({});
  if (!listing) return null;

  const feats = listing.features || {};
  const { dom } = listingBadges(listing);
  const sqft = listing.living_area;
  const pricePerSqft = pricePerSqftOf(listing);
  const lot = lotLabel(listing);
  const hoaLabel =
    listing.hoa_fee != null
      ? `${formatPrice(listing.hoa_fee)}${
          feats.assoc_fee_freq ? ` / ${String(feats.assoc_fee_freq).toLowerCase()}` : ""
        }`
      : null;

  const featureSections = buildFeatureSections(feats);

  const hasFinancial =
    listing.hoa_fee != null ||
    feats.tax_annual != null ||
    feats.tax_year != null ||
    feats.zoning ||
    feats.parcel ||
    feats.association_name ||
    feats.association_phone ||
    feats.association_includes ||
    feats.disclosures ||
    feats.assoc_fee_freq;

  const toggleGroup = (title) => {
    setOpenFeatureGroups((prev) => ({
      ...prev,
      [title]: prev[title] === false ? true : prev[title] === true ? false : false,
    }));
  };

  const isGroupOpen = (title, index) => {
    if (openFeatureGroups[title] === false) return false;
    if (openFeatureGroups[title] === true) return true;
    return index < 2;
  };

  return (
    <section aria-labelledby="detail-listing-details-heading" className="space-y-8">
      <div>
        <h2
          id="detail-listing-details-heading"
          className="text-xl sm:text-2xl font-bold text-gray-900 font-serif mb-4"
        >
          Listing details
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KeyFact label="Price" value={formatPrice(listing.list_price)} />
          <KeyFact label="Price / Sq Ft" value={pricePerSqft != null ? `$${pricePerSqft}` : null} />
          <KeyFact label="Status" value={listing.status} />
          <KeyFact label="Beds" value={listing.beds != null ? String(listing.beds) : null} />
          <KeyFact label="Baths" value={listing.baths != null ? String(listing.baths) : null} />
          <KeyFact
            label="Half Baths"
            value={
              listing.half_baths != null && Number(listing.half_baths) > 0
                ? String(listing.half_baths)
                : null
            }
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
          <KeyFact label="Lot Size" value={lot} />
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
            value={
              listing.units_total != null && Number(listing.units_total) > 1
                ? String(listing.units_total)
                : null
            }
          />
          <KeyFact label="County" value={listing.county || null} />
          <KeyFact label="Subdivision" value={listing.subdivision || null} />
          <KeyFact label="MLS #" value={listing.listing_id || null} />
          <KeyFact label="Parcel #" value={feats.parcel || null} />
        </div>
      </div>

      {featureSections.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">All details</h3>
          <p className="text-sm text-gray-500 mb-4">
            Property features from the MLS listing. Empty fields are omitted.
          </p>
          <div className="space-y-3">
            {featureSections.map((section, idx) => {
              const open = isGroupOpen(section.title, idx);
              return (
                <div
                  key={section.title}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(section.title)}
                    className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
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

      {hasFinancial && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">HOA, taxes &amp; zoning</h3>
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
              <p className="text-[11px] uppercase tracking-wide text-amber-800 font-semibold">
                Disclosures
              </p>
              <p className="text-sm text-amber-950 mt-1 leading-relaxed">{feats.disclosures}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
