import React, { useState } from "react";
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
        {similar.map((l) => {
          const b = listingBadges(l);
          const stats = listingStatsLine(l);
          return (
            <Link
              key={l.listing_id || l.id || l.slug}
              to={`/homes-for-sale/${l.slug}/`}
              className="group block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow min-w-[260px] w-[78vw] max-w-sm snap-start sm:min-w-0 sm:w-auto sm:max-w-none"
            >
              <div className="relative aspect-[4/3] bg-[#1a1a1a] overflow-hidden">
                <SimilarCardPhoto listing={l} />
                {b.priceCut && (
                  <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    Price reduced
                  </span>
                )}
                {b.isNew && !b.priceCut && (
                  <span className="absolute top-2 left-2 bg-[#CFB36E] text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    New
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="font-bold text-gray-900">{formatPrice(l.list_price)}</p>
                {stats ? <p className="text-xs text-gray-500 mt-0.5">{stats}</p> : null}
                <p className="text-xs text-gray-600 mt-1 truncate">
                  {[l.street_number, l.street_name].filter(Boolean).join(" ")}
                  {l.city ? `, ${l.city}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
