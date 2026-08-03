import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import QualifyCta from "../components/QualifyCta";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const formatPrice = (n) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function ListingDetailPage() {
  const { slug } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!slug) return;
    setListing(null);
    setError(null);
    fetch(`${API_BASE}/api/listings/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Listing not found");
        return res.json();
      })
      .then((data) => setListing(data.data))
      .catch((err) => setError(err.message));
  }, [slug]);

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
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-500">
        Loading listing…
      </div>
    );
  }

  const address = [listing.street_number, listing.street_name, listing.unit && `#${listing.unit}`]
    .filter(Boolean).join(" ");
  const fullAddress = [address, listing.city, listing.state].filter(Boolean).join(", ");
  const photos = Array.isArray(listing.photos) ? listing.photos : [];

  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${fullAddress} — Homes for Sale`,
    url: `https://saahomes.com/homes-for-sale/${listing.slug}/`,
    description: listing.description ? listing.description.slice(0, 250) : `${fullAddress} in ${listing.city}, CO`,
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
  };

  return (
    <>
      <SEO
        title={`${fullAddress} | ${listing.city} Real Estate | SAA Homes`}
        description={
          listing.description
            ? listing.description.slice(0, 155)
            : `${fullAddress} — ${formatPrice(listing.list_price)}. Browse this Northern Colorado listing and contact SAA Homes.`
        }
        canonicalPath={`/homes-for-sale/${listing.slug}/`}
        jsonLd={[listingSchema]}
      />

      {/* Hero gallery */}
      <section className="bg-black">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <nav className="text-sm text-gray-400 mb-4">
            <Link to="/properties/" className="hover:text-white">All Listings</Link>
            {" / "}
            <Link to={`/northern-colorado-areas/${(listing.city || "").toLowerCase().replace(/\s+/g, "-")}/`} className="hover:text-white">
              {listing.city} Real Estate
            </Link>
            {" / "}
            <span className="text-white">{fullAddress}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif">{fullAddress}</h1>
          <p className="text-gray-300 mt-1">
            {formatPrice(listing.list_price)}
            {listing.beds != null && <span> · {listing.beds} beds</span>}
            {listing.baths != null && <span> · {listing.baths} baths</span>}
            {listing.living_area != null && <span> · {Number(listing.living_area).toLocaleString()} sqft</span>}
          </p>
        </div>
        {photos.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pb-6">
            <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-800">
              <img src={photos[activePhoto]} alt={fullAddress} className="w-full h-full object-cover" />
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
                    <img src={p} alt={`${fullAddress} photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Main content */}
      <section className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-gray-900 mb-3">About this home</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {listing.description || "Contact us for details about this property."}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8">
            {[
              ["Price", formatPrice(listing.list_price)],
              ["Beds", listing.beds != null ? String(listing.beds) : "—"],
              ["Baths", listing.baths != null ? String(listing.baths) : "—"],
              ["Sq Ft", listing.living_area != null ? Number(listing.living_area).toLocaleString() : "—"],
              ["Year Built", listing.year_built || "—"],
              ["Lot Size", listing.lot_size != null ? `${Number(listing.lot_size).toLocaleString()} sqft` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="font-semibold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact card */}
        <aside className="bg-black text-white rounded-xl p-6 h-fit lg:sticky lg:top-24">
          <h2 className="text-lg font-bold font-serif">Interested in this home?</h2>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
            Let's talk — we'll walk you through pricing, neighborhood details, and whether
            you qualify for CHFA down payment assistance.
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
            <a
              href={`/contact/?interest=${encodeURIComponent(`Listing: ${fullAddress}`)}`}
              className="w-full inline-flex items-center justify-center px-6 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors"
            >
              Request a Showing
            </a>
            <a
              href="tel:+19709991407"
              className="w-full inline-flex items-center justify-center px-6 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Call (970) 999-1407
            </a>
          </div>
          {listing.listing_url && (
            <p className="text-xs text-gray-500 mt-4">
              Listing data from {listing.mls_source || "IRES"} MLS.{" "}
              <a href={listing.listing_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
                View original listing
              </a>
            </p>
          )}
        </aside>
      </section>

      {/* Conversational qualify CTA — reuse the lending-page pattern */}
      <QualifyCta
        program={`a home in ${listing.city || "Northern Colorado"}`}
        chatQuestion={`Hi! I'm looking at a home in ${listing.city || "Northern Colorado"} and want to know if I'd qualify for a loan or CHFA assistance. Can you help?`}
        formAnchor="/contact/"
        formLabel="Ask a question instead"
      />
    </>
  );
}
