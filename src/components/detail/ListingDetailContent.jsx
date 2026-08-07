import React from "react";
import { Link } from "react-router-dom";
import PaymentCalculator from "../PaymentCalculator";
import CityStatsBand from "../CityStatsBand";
import SaveSearchModal from "../SaveSearchModal";
import { getCityHomesPath } from "../../data/cityHomesData";
import {
  formatPrice,
  listingBadges,
  listingAddress,
  listingFullAddress,
  hasAnySavedSearch,
} from "../../utils/listingHelpers.js";
import DescriptionSection from "./DescriptionSection";
import AllDetailsSection from "./AllDetailsSection";
import MapSection from "./MapSection";
import SchoolsSection from "./SchoolsSection";
import SimilarHomesSection from "./SimilarHomesSection";
import ConversionRail from "./ConversionRail";
import { VirtualTourButton } from "./VirtualTourModal.jsx";
import { HeartIcon, ShareIcon } from "./icons.jsx";
import { HOME_TYPE_LABEL, formatDate, pricePerSqftOf } from "./utils.js";

/**
 * Shared two-column body for listing detail:
 * LEFT (scrolls): description → listing details → map → schools → calculator → city stats → similar
 * RIGHT (sticky rail): price, CTAs, agent, compact est-payment teaser (scrolls to #payment-calculator)
 *
 * @param {"page"|"panel"} variant
 */
export default function ListingDetailContent({
  listing,
  similar = [],
  saved,
  onToggleSave,
  openNadia,
  likeThisFilters,
  match = { matches: false, reasons: [] },
  shareCopied = false,
  onShare,
  cityHomes = null,
  variant = "page",
  stickyTopClass = "lg:top-24",
  mapInteractive = true,
}) {
  if (!listing) return null;

  const feats = listing.features || {};
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const address = listingAddress(listing);
  const fullAddress = listingFullAddress(listing);
  const citySlug = (listing.city || "").toLowerCase().replace(/\s+/g, "-");
  const { isNew, priceCut, priceCutPct, isNewConstruction, dom } = listingBadges(listing);
  const sqft = listing.living_area;
  const pricePerSqft = pricePerSqftOf(listing);
  const priceChangeDate = formatDate(listing.price_change_timestamp);
  const isPanel = variant === "panel";

  return (
    <div
      className={`grid lg:grid-cols-3 gap-6 lg:gap-8 ${
        isPanel ? "p-4 sm:p-5 pb-28 lg:pb-6" : ""
      }`}
    >
      {/* ── LEFT: content column ───────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-8 sm:space-y-10 min-w-0">
        {/* Panel: price + address (desktop also in rail). Page: hero already has this — mobile actions only. */}
        {isPanel && (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                {formatPrice(listing.list_price)}
              </p>
              {priceCut && listing.original_list_price != null && (
                <p className="text-sm text-gray-400 line-through">
                  {formatPrice(listing.original_list_price)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
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
                <span className="bg-black text-white text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
                  New construction
                </span>
              )}
              {listing.status === "Active" && (
                <span className="border border-emerald-500 text-emerald-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            {priceCut && (
              <div className="mt-2.5 inline-flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <span className="text-emerald-600 text-sm font-bold shrink-0">↓</span>
                <p className="text-sm text-emerald-900 leading-snug">
                  <strong>Price drop:</strong> was {formatPrice(listing.original_list_price)}
                  {priceCutPct ? ` — now ${priceCutPct}% lower` : ""}.
                  {dom != null ? ` ${dom} day${Number(dom) === 1 ? "" : "s"} on market.` : ""}
                  {priceChangeDate ? ` Changed ${priceChangeDate}.` : ""}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-700 mt-2.5 font-medium">
              {listing.beds != null && <span>{listing.beds} bd</span>}
              {listing.baths != null && <span> · {listing.baths} ba</span>}
              {listing.half_baths != null && Number(listing.half_baths) > 0 && (
                <span> · {listing.half_baths} half-ba</span>
              )}
              {sqft != null && <span> · {Number(sqft).toLocaleString()} sqft</span>}
              {pricePerSqft != null && <span> · ${pricePerSqft}/sqft</span>}
            </p>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mt-2 leading-snug font-serif">
              {address || "Address available on request"}
            </h2>
            <p className="text-sm text-gray-500">
              {[listing.city, listing.state, listing.postal_code].filter(Boolean).join(", ")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {HOME_TYPE_LABEL[listing.home_type] ||
                listing.property_subtype ||
                listing.property_type}
              {listing.subdivision && <span> · {listing.subdivision}</span>}
            </p>
            {match.matches && (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8a7340] bg-[#CFB36E]/15 px-2 py-0.5 rounded-full">
                <span aria-hidden="true">★</span>
                Matches your saved search
                {match.reasons.length > 0 && match.reasons[0] !== "your saved search"
                  ? `: ${match.reasons.slice(0, 2).join(" · ")}`
                  : ""}
              </p>
            )}
          </div>
        )}

        {/* Mobile action row */}
        <div className="flex gap-2 lg:hidden">
          <button
            type="button"
            onClick={onToggleSave}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold active:scale-[0.98] transition-transform ${
              saved
                ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                : "border-gray-300 text-gray-900"
            }`}
          >
            <HeartIcon filled={saved} />
            {saved ? "Saved" : "Save"}
          </button>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-900 active:scale-[0.98] transition-transform"
            >
              <ShareIcon />
              {shareCopied ? "Copied" : "Share"}
            </button>
          )}
          <button
            type="button"
            onClick={openNadia}
            className="flex-1 inline-flex items-center justify-center px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-900 active:scale-[0.98] transition-transform"
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
              filters={likeThisFilters || {}}
              buttonLabel="Get alerts for homes like this"
              buttonClassName="shrink-0 px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-lg"
            />
          </div>
        )}

        {/* 1. Description */}
        <DescriptionSection description={listing.description} />

        {/* Virtual tour — on-site modal embed (external fallback inside modal) */}
        {feats.virtual_tour && (
          <div className="rounded-xl border border-[#CFB36E]/50 bg-[#CFB36E]/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-serif">Virtual tour</h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Walk through this home online without leaving the listing — open the tour in a
                full-screen viewer here.
              </p>
            </div>
            <VirtualTourButton
              url={feats.virtual_tour}
              label="Open virtual tour"
              className="shrink-0 inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 text-sm active:scale-[0.98] transition-transform cursor-pointer"
            />
          </div>
        )}

        {/* 2. Listing details */}
        <AllDetailsSection listing={listing} />

        {/* Price history — honest, data-derived */}
        {(listing.list_price != null ||
          listing.original_list_price != null ||
          dom != null) && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 font-serif mb-4">Price history</h2>
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
                        dom != null
                          ? `${dom} day${Number(dom) === 1 ? "" : "s"} on market`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                  {listing.original_list_price != null &&
                    Number(listing.original_list_price) !== Number(listing.list_price) && (
                      <tr>
                        <td className="px-4 py-3 text-gray-900 font-medium">Original list</td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatPrice(listing.original_list_price)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                          {priceCut
                            ? `Difference ${formatPrice(
                                Number(listing.original_list_price) - Number(listing.list_price)
                              )}`
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
                  {sqft != null
                    ? ` and ${Number(sqft).toLocaleString()} sq ft living area`
                    : ""}
                  .
                </p>
              )}
            </div>
          </div>
        )}

        {/* 3. Map */}
        <MapSection listing={listing} photos={photos} interactive={mapInteractive} />

        {/* 4. Schools */}
        <SchoolsSection listing={listing} />

        {/* 5. Est. payment calculator — single full calculator (rail has teaser only) */}
        {listing.list_price != null && Number(listing.list_price) > 0 && (
          <div id="payment-calculator" className="scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 font-serif mb-3">
              Estimated payment
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Based on this home&apos;s list price of{" "}
              <span className="font-semibold text-gray-900 tabular-nums">
                {formatPrice(listing.list_price)}
              </span>
              . Adjust down payment, rate, and term below.
            </p>
            <PaymentCalculator
              listPrice={listing.list_price}
              taxAnnual={feats.tax_annual}
              hoaFee={listing.hoa_fee}
              hoaFreq={feats.assoc_fee_freq}
              variant="card"
            />
          </div>
        )}

        {/* 6. City stats + about city + similar */}
        {listing.city && <CityStatsBand city={listing.city} />}

        {listing.city && (
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
                className="px-4 py-2 bg-[#CFB36E] text-black text-sm font-semibold rounded-lg hover:bg-[#bd9f5a] active:scale-[0.98] transition-transform"
              >
                {listing.city} Neighborhood Guide
              </Link>
              <Link
                to={getCityHomesPath(citySlug)}
                className="px-4 py-2 border border-white text-white text-sm font-semibold rounded-lg hover:bg-white hover:text-black active:scale-[0.98] transition-transform"
              >
                All {listing.city} Homes for Sale
              </Link>
            </div>
          </div>
        )}

        <SimilarHomesSection listing={listing} similar={similar} />

        {/* Panel: open full SEO page */}
        {isPanel && listing.slug && (
          <div className="rounded-xl border border-gray-200 p-4 text-center space-y-2">
            <a
              href={`/homes-for-sale/${listing.slug}/`}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-900 underline underline-offset-2 hover:text-black"
            >
              Open full page
              <span aria-hidden="true">↗</span>
            </a>
            <p className="text-xs text-gray-500">
              Shareable link with full details, similar homes, and neighborhood guides.
            </p>
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black"
              >
                <ShareIcon />
                {shareCopied ? "Link copied!" : "Copy shareable link"}
              </button>
            )}
          </div>
        )}

        {/* IDX / Fair Housing footer */}
        <div className="border-t border-gray-200 pt-6 text-xs text-gray-500 leading-relaxed space-y-2">
          <p className="text-[11px] font-medium text-gray-600">
            Live IRES MLS data · Updated daily
          </p>
          <p>
            Listing data provided by {listing.mls_source || "IRES"} MLS via IDX. Information is
            deemed reliable but not guaranteed. All measurements and square footage are
            approximate. Buyer should verify all information with independent sources before
            making decisions.
          </p>
          {feats.showing_instructions && (
            <p>
              <span className="font-semibold text-gray-600">Showing instructions: </span>
              {feats.showing_instructions}
            </p>
          )}
          <p className="flex items-center gap-1.5 flex-wrap">
            <span
              aria-hidden="true"
              className="inline-block w-3.5 h-3.5 border border-gray-400 rounded-sm text-[8px] leading-3.5 text-center font-bold"
            >
              =
            </span>
            Equal Housing Opportunity · Schwartz and Associates, Coldwell Banker Realty ·{" "}
            <a href="tel:+19709991407" className="underline hover:text-gray-800">
              (970) 999-1407
            </a>
          </p>
        </div>
      </div>

      {/* ── RIGHT: sticky conversion rail ──────────────────────────── */}
      <ConversionRail
        listing={listing}
        saved={saved}
        onToggleSave={onToggleSave}
        openNadia={openNadia}
        likeThisFilters={likeThisFilters}
        stickyTopClass={stickyTopClass}
      />
    </div>
  );
}
