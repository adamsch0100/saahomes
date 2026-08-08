import React from "react";
import ListingMap from "../ListingMap";

export default function MapSection({ listing, photos = [], interactive = true }) {
  if (!listing?.latitude || !listing?.longitude) {
    return (
      <section aria-labelledby="detail-map-heading">
        <h2
          id="detail-map-heading"
          className="text-xl sm:text-2xl font-bold text-gray-900 font-serif mb-3"
        >
          Location &amp; Neighborhood
        </h2>
        <p className="text-sm text-gray-500">
          Contact us for location details —{" "}
          <a href="tel:+19709991407" className="underline text-gray-800 font-medium">
            (970) 999-1407
          </a>
          .
        </p>
      </section>
    );
  }

  const feats = listing.features || {};
  const mapListings = [
    {
      id: listing.id,
      slug: listing.slug,
      latitude: Number(listing.latitude),
      longitude: Number(listing.longitude),
      list_price: listing.list_price,
      street_name: listing.street_name,
      street_number: listing.street_number,
      city: listing.city,
      beds: listing.beds,
      baths: listing.baths,
      living_area: listing.living_area,
      photos: Array.isArray(photos) ? photos.slice(0, 1) : [],
    },
  ];

  return (
    <section aria-labelledby="detail-map-heading">
      <h2
        id="detail-map-heading"
        className="text-xl sm:text-2xl font-bold text-gray-900 font-serif mb-3"
      >
        Location &amp; Neighborhood
      </h2>
      <div className="rounded-xl overflow-hidden border border-gray-200 h-[300px] sm:h-[360px]">
        <ListingMap listings={mapListings} interactive={interactive} />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Map pin is approximate. Confirm boundaries and floodplain status with surveys and local
        sources.
      </p>
      {feats.directions && (
        <p className="text-sm text-gray-600 mt-3">
          <span className="font-semibold text-gray-800">Directions: </span>
          {feats.directions}
        </p>
      )}
    </section>
  );
}
