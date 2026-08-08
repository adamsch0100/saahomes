import React, { useMemo } from "react";
import ScheduleShowingModal from "../ScheduleShowingModal";
import SaveSearchModal from "../SaveSearchModal";
import {
  formatPrice,
  listingBadges,
  listingFullAddress,
} from "../../utils/listingHelpers.js";
import { HeartIcon } from "./icons.jsx";
import { pricePerSqftOf } from "./utils.js";
import { VirtualTourButton } from "./VirtualTourModal.jsx";
import { principalAndInterest, monthlyHoa } from "../PaymentCalculator.jsx";

/**
 * Sticky right conversion rail — price, CTAs, agent, compact est-payment teaser.
 * Desktop only (parent should hide on mobile). Stays visible while left column scrolls.
 * Full payment calculator lives once in main content (#payment-calculator).
 */
export default function ConversionRail({
  listing,
  saved,
  onToggleSave,
  openNadia,
  likeThisFilters,
  stickyTopClass = "lg:top-6",
}) {
  const feats = listing?.features || {};
  const listPrice = listing?.list_price;
  const hoaFee = listing?.hoa_fee;
  const taxAnnual = feats.tax_annual;
  const hoaFreq = feats.assoc_fee_freq;

  const estPayment = useMemo(() => {
    const price = Number(listPrice);
    if (!Number.isFinite(price) || price <= 0) return null;
    const downPct = 20;
    const rate = 6.5;
    const termYears = 30;
    const downAmount = (price * downPct) / 100;
    const loan = Math.max(0, price - downAmount);
    const pi = principalAndInterest(loan, rate, termYears);
    const hasTax =
      taxAnnual != null &&
      taxAnnual !== "" &&
      Number.isFinite(Number(taxAnnual)) &&
      Number(taxAnnual) > 0;
    const taxMonthly = hasTax ? Number(taxAnnual) / 12 : (price * 0.01) / 12;
    const insuranceMonthly = (price * 0.0035) / 12;
    const hoaMonthly = monthlyHoa(hoaFee, hoaFreq);
    const total = pi + taxMonthly + insuranceMonthly + hoaMonthly;
    return { total, price, downPct, rate, termYears };
  }, [listPrice, hoaFee, taxAnnual, hoaFreq]);

  if (!listing) return null;

  const fullAddress = listingFullAddress(listing);
  const { isNew, priceCut, priceCutPct, isNewConstruction, dom } = listingBadges(listing);
  const sqft = listing.living_area;
  const pricePerSqft = pricePerSqftOf(listing);
  const hoaLabel =
    listing.hoa_fee != null
      ? `${formatPrice(listing.hoa_fee)}${
          feats.assoc_fee_freq ? ` / ${String(feats.assoc_fee_freq).toLowerCase()}` : ""
        }`
      : null;

  const scrollToCalculator = (e) => {
    e.preventDefault();
    const el = document.getElementById("payment-calculator");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }
  };

  return (
    <aside
      className={`space-y-4 lg:sticky ${stickyTopClass} h-fit hidden lg:block`}
      aria-label="Contact and save options"
    >
      {/* Price + key facts + status */}
      <div className="bg-black text-white rounded-xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-2xl font-bold text-[#CFB36E] tracking-tight">
            {formatPrice(listing.list_price)}
          </p>
          {listing.status === "Active" && (
            <span className="border border-emerald-400/80 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Active
            </span>
          )}
          {listing.status && listing.status !== "Active" && (
            <span className="border border-white/40 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              {listing.status}
            </span>
          )}
        </div>

        {priceCut && (
          <p className="text-sm text-emerald-400 mt-1.5">
            Price reduced{priceCutPct ? ` ${priceCutPct}%` : ""}
            {listing.original_list_price != null && (
              <span className="text-gray-400 line-through ml-2">
                {formatPrice(listing.original_list_price)}
              </span>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {isNew && (
            <span className="bg-[#CFB36E] text-black text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
              New
            </span>
          )}
          {isNewConstruction && (
            <span className="border border-[#CFB36E] text-[#CFB36E] text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded">
              New construction
            </span>
          )}
          {dom != null && (
            <span className="border border-white/25 text-gray-300 text-[10px] font-medium px-2 py-0.5 rounded">
              {dom} day{Number(dom) === 1 ? "" : "s"} on market
            </span>
          )}
        </div>

        <p className="text-gray-300 text-sm mt-3 leading-relaxed">
          {listing.beds != null ? `${listing.beds} bd` : ""}
          {listing.baths != null ? ` · ${listing.baths} ba` : ""}
          {sqft != null ? ` · ${Number(sqft).toLocaleString()} sqft` : ""}
          {pricePerSqft != null ? ` · $${pricePerSqft}/sqft` : ""}
        </p>
        <p className="text-gray-400 text-xs mt-1 truncate" title={fullAddress}>
          {fullAddress}
        </p>

        {/* Primary CTAs — full width, stacked */}
        <div className="mt-5 space-y-2.5">
          <ScheduleShowingModal
            listing={listing}
            buttonLabel="Schedule a Showing"
            buttonClassName="w-full inline-flex items-center justify-center px-6 py-3.5 font-semibold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            buttonStyle={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
          />
          <button
            type="button"
            onClick={openNadia}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black active:scale-[0.98] transition-all cursor-pointer"
          >
            Ask Nadia
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border text-sm font-semibold active:scale-[0.98] transition-all ${
              saved
                ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                : "border-white/40 text-white hover:border-white"
            }`}
          >
            <HeartIcon filled={saved} />
            {saved ? "Saved ♥" : "Save"}
          </button>
          <a
            href="tel:+19709991407"
            className="w-full inline-flex items-center justify-center px-6 py-3 bg-white text-black text-sm font-semibold rounded-lg hover:bg-gray-100 active:scale-[0.98] transition-all"
          >
            Call (970) 999-1407
          </a>
          {feats.virtual_tour && (
            <VirtualTourButton
              url={feats.virtual_tour}
              label="Virtual Tour"
              className="w-full inline-flex items-center justify-center px-6 py-3 border border-[#CFB36E] text-[#CFB36E] font-semibold rounded-lg hover:bg-[#CFB36E] hover:text-black transition-colors text-sm cursor-pointer"
            />
          )}
          <SaveSearchModal
            filters={likeThisFilters || {}}
            buttonLabel="Get alerts for homes like this"
            buttonClassName="w-full inline-flex items-center justify-center px-6 py-2.5 border border-white/40 text-white text-sm font-semibold rounded-lg hover:border-white transition-colors"
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
          Live IRES MLS data · Updated daily. Listing data from {listing.mls_source || "IRES"} MLS.
        </p>
      </div>

      {/* Compact agent card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center shrink-0">
            <span className="text-[#CFB36E] font-serif font-bold text-sm">SAA</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">
              Your local agents
            </p>
            <p className="font-semibold text-gray-900 font-serif">Adam &amp; Mandi Schwartz</p>
            <p className="text-xs text-gray-600">SAA Homes · Coldwell Banker Realty</p>
          </div>
        </div>
        <a
          href="tel:+19709991407"
          className="text-sm font-semibold text-gray-900 mt-3 inline-block hover:text-[#CFB36E]"
        >
          (970) 999-1407
        </a>
      </div>

      {/* Compact est. payment teaser — scrolls to full calculator in main content */}
      {estPayment && (
        <button
          type="button"
          onClick={scrollToCalculator}
          className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-[#CFB36E]/60 hover:shadow-md transition-all group"
          aria-label="View full payment calculator"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">
                Est. payment
              </p>
              <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5 group-hover:text-black">
                ${Math.round(estPayment.total).toLocaleString("en-US")}
                <span className="text-sm font-semibold text-gray-500">/mo</span>
              </p>
            </div>
            <span
              className="text-[#CFB36E] text-lg font-bold group-hover:translate-x-0.5 transition-transform"
              aria-hidden="true"
            >
              →
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-snug">
            Home price{" "}
            <span className="font-semibold text-gray-700 tabular-nums">
              {formatPrice(estPayment.price)}
            </span>
            {" · "}
            {estPayment.downPct}% down · {estPayment.rate}% · {estPayment.termYears}-yr
          </p>
          <p className="text-[11px] font-semibold text-gray-800 mt-2 underline underline-offset-2 decoration-[#CFB36E]/60 group-hover:decoration-[#CFB36E]">
            Adjust down payment &amp; rate
          </p>
        </button>
      )}
    </aside>
  );
}
