import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { photoUrl } from "../../utils/photoUrl.js";
import {
  formatPrice,
  listingBadges,
  listingStatsLine,
  displayBeds,
  isLandListing,
} from "../../utils/listingHelpers.js";
import { getCityHomesPath } from "../../data/cityHomesData";
import { HOME_TYPE_LABEL } from "./utils.js";
import ListingPhotoFallback from "../ListingPhotoFallback.jsx";
import SaveHomeButton from "../SaveHomeButton.jsx";
import { estimateMonthlyPayment } from "../PaymentCalculator.jsx";

function SimilarCardPhoto({ listing: l }) {
  const [failed, setFailed] = useState(false);
  const hasPhoto =
    (Array.isArray(l.photos) && l.photos.length > 0) || Number(l.photos_count) > 0;
  const addr = [l.street_number, l.street_name].filter(Boolean).join(" ");
  const alt = addr
    ? `Photo of ${addr}${l.city ? ` in ${l.city}` : ""}`
    : `Home in ${l.city || "Northern Colorado"}`;

  if (!hasPhoto || failed) {
    return <ListingPhotoFallback className="w-full h-full absolute inset-0" />;
  }
  return (
    <img
      src={photoUrl(l.id, 0)}
      alt={alt}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    />
  );
}

function SimilarCard({ listing: l }) {
  const b = listingBadges(l);
  const stats = listingStatsLine(l);
  const estPay = useMemo(() => {
    if (isLandListing(l)) return null;
    const feats = l.features || {};
    return estimateMonthlyPayment(l.list_price, {
      taxAnnual: feats.tax_annual,
      hoaFee: l.hoa_fee,
      hoaFreq: feats.assoc_fee_freq,
    });
  }, [l]);

  return (
    <Link
      to={`/homes-for-sale/${l.slug}/`}
      className="group relative block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 active:scale-[0.99] transition-all min-w-[260px] w-[78vw] max-w-sm snap-start sm:min-w-0 sm:w-auto sm:max-w-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CFB36E]"
    >
      <div className="relative aspect-[4/3] bg-[#1a1a1a] overflow-hidden">
        <SimilarCardPhoto listing={l} />
        {b.priceCut && (
          <span className="absolute top-2 left-2 z-[1] bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            Price reduced
          </span>
        )}
        {b.isNew && !b.priceCut && (
          <span className="absolute top-2 left-2 z-[1] bg-[#CFB36E] text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            New
          </span>
        )}
        {/* Save heart — stopPropagation handled inside SaveHomeButton */}
        <div
          className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <SaveHomeButton listing={l} />
        </div>
        {/* Price overlay — matches primary search cards (Zillow §3) */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent pt-8 pb-2 px-3 pointer-events-none">
          <div className="flex items-end justify-between gap-2">
            <p className="text-lg font-bold text-white tracking-tight leading-none drop-shadow-sm">
              {formatPrice(l.list_price)}
            </p>
            {b.priceCut && l.original_list_price != null && (
              <p className="text-[10px] text-white/75 line-through mb-0.5">
                {formatPrice(l.original_list_price)}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="p-3">
        {stats ? <p className="text-xs font-semibold text-gray-800">{stats}</p> : null}
        {estPay && (
          <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
            Est. ${Math.round(estPay.total).toLocaleString("en-US")}/mo
          </p>
        )}
        <p className="text-xs text-gray-600 mt-1 truncate">
          {[l.street_number, l.street_name].filter(Boolean).join(" ")}
          {l.city ? `, ${l.city}` : ""}
        </p>
      </div>
    </Link>
  );
}

export default function SimilarHomesSection({ listing, similar = [] }) {
  if (!listing || !similar.length) return null;
  const citySlug = (listing.city || "").toLowerCase().replace(/\s+/g, "-");
  const beds = displayBeds(listing);

  return (
    <section aria-labelledby="detail-similar-heading">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h2
            id="detail-similar-heading"
            className="text-xl sm:text-2xl font-bold text-gray-900 font-serif"
          >
            Similar homes in {listing.city}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Same area
            {listing.home_type
              ? ` · ${HOME_TYPE_LABEL[listing.home_type] || listing.home_type}`
              : ""}
            {beds != null ? ` · ${beds}±1 beds` : isLandListing(listing) ? " · land" : ""}
            {listing.list_price != null ? " · price ±20%" : ""}
          </p>
        </div>
        {citySlug && (
          <Link
            to={getCityHomesPath(citySlug)}
            className="text-sm font-semibold text-gray-700 underline underline-offset-2 shrink-0 hover:text-black"
          >
            See all
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0">
        {similar.map((l) => (
          <SimilarCard key={l.listing_id || l.id || l.slug} listing={l} />
        ))}
      </div>
    </section>
  );
}
