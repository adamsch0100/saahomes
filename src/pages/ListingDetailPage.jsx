import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import QualifyCta from "../components/QualifyCta";
import SaveSearchModal from "../components/SaveSearchModal";
import { CITY_HOMES } from "../data/cityHomesData";
import {
  formatPrice,
  listingBadges,
  listingAddress,
  listingFullAddress,
  isHomeSaved,
  toggleSavedHome,
  matchSavedSearch,
  getSavedSearches,
} from "../utils/listingHelpers.js";
import {
  PhotoGallery,
  ListingDetailContent,
  MobileStickyBar,
  PageDetailSkeleton,
  HeartIcon,
  ShareIcon,
  HOME_TYPE_LABEL,
  formatDate,
  pricePerSqftOf,
} from "../components/detail";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

export default function ListingDetailPage() {
  const { slug } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [saved, setSaved] = useState(false);
  const [match, setMatch] = useState({ matches: false, reasons: [] });
  const [shareCopied, setShareCopied] = useState(false);

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

  useEffect(() => {
    if (!listing) return;
    const lid = listing.listing_id || listing.id;
    if (!lid) return;
    fetch(`${API_BASE}/api/alerts/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ listing_id: String(lid) }),
    }).catch(() => {});
  }, [listing]);

  useEffect(() => {
    if (!listing || !listing.city) return;
    const params = new URLSearchParams({
      city: listing.city,
      limit: "16",
      sort: "newest",
      status: "Active",
    });
    if (listing.list_price) {
      const price = Number(listing.list_price);
      params.set("minPrice", String(Math.round(Math.max(0, price * 0.8))));
      params.set("maxPrice", String(Math.round(price * 1.2)));
    }
    if (listing.home_type) params.set("type", listing.home_type);
    const bedsN = listing.beds != null ? Number(listing.beds) : null;
    if (bedsN != null && Number.isFinite(bedsN)) {
      params.set("beds", String(Math.max(0, Math.floor(bedsN - 1))));
    }
    fetch(`${API_BASE}/api/listings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const rows = d.data || [];
        const filtered = rows.filter((l) => {
          if (!l) return false;
          if (l.slug === listing.slug) return false;
          if (l.listing_id && listing.listing_id && l.listing_id === listing.listing_id) {
            return false;
          }
          if (bedsN != null && Number.isFinite(bedsN) && l.beds != null) {
            const b = Number(l.beds);
            if (Number.isFinite(b) && (b < bedsN - 1 || b > bedsN + 1)) return false;
          }
          return true;
        });
        setSimilar(filtered.slice(0, 8));
      })
      .catch(() => setSimilar([]));
    setSaved(isHomeSaved(listing.slug));
    setMatch(matchSavedSearch(listing, getSavedSearches()));
  }, [listing]);

  useEffect(() => {
    document.body.classList.add("listing-detail-page");
    return () => document.body.classList.remove("listing-detail-page");
  }, []);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Listing not found</h1>
        <p className="text-gray-600 mt-3">
          This property may no longer be active.{" "}
          <Link to="/properties/" className="underline text-black">
            Search current listings
          </Link>{" "}
          or call us at{" "}
          <a href="tel:+19709991407" className="underline">
            (970) 999-1407
          </a>
          .
        </p>
      </div>
    );
  }

  if (!listing) return <PageDetailSkeleton />;

  const address = listingAddress(listing);
  const fullAddress = listingFullAddress(listing);
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const citySlug = (listing.city || "").toLowerCase().replace(/\s+/g, "-");
  const cityHomes = CITY_HOMES.find((c) => c.slug === citySlug);
  const { isNew, priceCut, priceCutPct, isNewConstruction, dom } = listingBadges(listing);
  const sqft = listing.living_area;
  const pricePerSqft = pricePerSqftOf(listing);
  const priceChangeDate = formatDate(listing.price_change_timestamp);

  const onToggleSave = () => setSaved(toggleSavedHome(listing.slug));

  const onShare = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `https://saahomes.com/homes-for-sale/${listing.slug}/`;
    const text = `${fullAddress} — ${formatPrice(listing.list_price)}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: fullAddress, text, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      /* user cancelled share */
    }
  };

  const likeThisFilters = {
    city: listing.city || undefined,
    minPrice: listing.list_price
      ? String(Math.max(0, Math.round(Number(listing.list_price) * 0.8)))
      : undefined,
    maxPrice: listing.list_price
      ? String(Math.round(Number(listing.list_price) * 1.2))
      : undefined,
    beds: listing.beds != null ? String(listing.beds) : undefined,
    baths: listing.baths != null ? String(listing.baths) : undefined,
    type: listing.home_type || undefined,
  };

  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${fullAddress} — Homes for Sale`,
    url: `https://saahomes.com/homes-for-sale/${listing.slug}/`,
    description: listing.description
      ? listing.description.slice(0, 250)
      : `${fullAddress} in ${listing.city}, CO`,
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
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: Number(listing.latitude),
            longitude: Number(listing.longitude),
          },
        }
      : {}),
    ...(listing.beds != null ? { numberOfRooms: Number(listing.beds) } : {}),
    ...(listing.baths != null ? { numberOfBathroomsTotal: Number(listing.baths) } : {}),
    ...(sqft != null
      ? { floorSize: { "@type": "QuantitativeValue", value: Number(sqft), unitCode: "FTK" } }
      : {}),
    ...(listing.year_built ? { yearBuilt: Number(listing.year_built) } : {}),
    // School names from MLS (+ GreatSchools rating when cached). Never invent ratings.
    ...((() => {
      const schoolNodes = [];
      const fromApi = Array.isArray(listing.schools) ? listing.schools : [];
      if (fromApi.length) {
        for (const s of fromApi) {
          if (!s?.name) continue;
          const node = { "@type": "School", name: s.name };
          if (s.gsUrl) node.url = s.gsUrl;
          if (s.gsRating != null && s.gsRating >= 1 && s.gsRating <= 10) {
            node.additionalProperty = {
              "@type": "PropertyValue",
              name: "GreatSchools Rating",
              value: s.gsRating,
              minValue: 1,
              maxValue: 10,
            };
          }
          schoolNodes.push(node);
        }
      } else {
        for (const name of [
          listing.elementary_school,
          listing.middle_school,
          listing.high_school,
        ]) {
          if (name) schoolNodes.push({ "@type": "School", name });
        }
      }
      return schoolNodes.length ? { amenityFeature: schoolNodes } : {};
    })()),
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
  ]
    .filter(Boolean)
    .join(" ");

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Homes for Sale",
        item: "https://saahomes.com/properties/",
      },
      ...(listing.city
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: `${listing.city} Homes for Sale`,
              item: `https://saahomes.com/${citySlug}-homes-for-sale/`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: listing.city ? 4 : 3,
        name: fullAddress,
        item: `https://saahomes.com/homes-for-sale/${listing.slug}/`,
      },
    ],
  };

  const ogImage = photos.length ? `https://saahomes.com/api/photo/${listing.id}/0` : undefined;

  const openNadia = () => {
    window.dispatchEvent(
      new CustomEvent("open-nadia-chat", {
        detail: {
          message: `Hi! I'm interested in ${fullAddress} (${formatPrice(listing.list_price)}). Can you tell me more?`,
        },
      })
    );
  };

  return (
    <>
      <SEO
        title={`${fullAddress} | ${listing.city} Real Estate | SAA Homes`}
        description={metaDesc.slice(0, 158)}
        canonicalPath={`/homes-for-sale/${listing.slug}/`}
        ogImage={ogImage}
        jsonLd={[listingSchema, breadcrumbSchema]}
      />

      {/* ── Hero: header block + gallery ───────────────────────── */}
      <section className="bg-black pt-24 sm:pt-28">
        <div className="max-w-7xl mx-auto px-4 pb-4 sm:pb-6">
          <nav className="text-xs text-gray-400 mb-3 flex flex-wrap gap-1.5" aria-label="Breadcrumb">
            <Link to="/properties/" className="hover:text-white">
              Homes for sale
            </Link>
            <span>/</span>
            {listing.city && (
              <>
                <Link to={`/${citySlug}-homes-for-sale/`} className="hover:text-white">
                  {listing.city}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-gray-300 truncate max-w-[200px] sm:max-w-none">{address}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif leading-tight">
                {fullAddress}
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2.5">
                <span className="text-2xl sm:text-3xl font-bold text-[#CFB36E] tracking-tight">
                  {formatPrice(listing.list_price)}
                </span>
                {priceCut && (
                  <span className="text-gray-400 text-sm line-through">
                    {formatPrice(listing.original_list_price)}
                  </span>
                )}
                {isNew && (
                  <span className="bg-[#CFB36E] text-black text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    New
                  </span>
                )}
                {priceCut && (
                  <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    Price reduced{priceCutPct ? ` ${priceCutPct}%` : ""}
                  </span>
                )}
                {isNewConstruction && (
                  <span className="border border-[#CFB36E] text-[#CFB36E] text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    New construction
                  </span>
                )}
                {listing.status && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${
                      listing.status === "Active"
                        ? "border-emerald-400/80 text-emerald-400"
                        : "border-white/40 text-gray-300"
                    }`}
                  >
                    {listing.status}
                  </span>
                )}
              </div>

              {priceCut && (
                <div className="mt-3 inline-flex items-start gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 max-w-lg">
                  <span className="text-emerald-400 text-sm font-bold shrink-0">↓</span>
                  <p className="text-sm text-emerald-100 leading-snug">
                    <strong className="text-white">Price drop:</strong> was{" "}
                    {formatPrice(listing.original_list_price)}
                    {priceCutPct ? ` — now ${priceCutPct}% lower` : ""}.
                    {dom != null
                      ? ` ${dom} day${Number(dom) === 1 ? "" : "s"} on market.`
                      : ""}
                    {priceChangeDate ? ` Changed ${priceChangeDate}.` : ""}
                  </p>
                </div>
              )}

              <p className="text-gray-300 mt-2.5 text-sm sm:text-base">
                {listing.beds != null && (
                  <>
                    <span className="font-semibold text-white">{listing.beds}</span>
                    <span> bd</span>
                  </>
                )}
                {listing.baths != null && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{listing.baths}</span>
                    <span> ba</span>
                  </>
                )}
                {listing.half_baths != null && Number(listing.half_baths) > 0 && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">{listing.half_baths}</span>
                    <span> half-ba</span>
                  </>
                )}
                {listing.three_quarter_baths != null &&
                  Number(listing.three_quarter_baths) > 0 && (
                    <>
                      <span className="text-gray-600 mx-1.5">·</span>
                      <span className="font-semibold text-white">
                        {listing.three_quarter_baths}
                      </span>
                      <span> ¾-ba</span>
                    </>
                  )}
                {sqft != null && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span className="font-semibold text-white">
                      {Number(sqft).toLocaleString()}
                    </span>
                    <span> sqft</span>
                  </>
                )}
                {pricePerSqft != null && (
                  <>
                    <span className="text-gray-600 mx-1.5">·</span>
                    <span>${pricePerSqft}/sqft</span>
                  </>
                )}
              </p>
              <p className="text-gray-400 mt-1 text-sm">
                {HOME_TYPE_LABEL[listing.home_type] ||
                  listing.property_subtype ||
                  listing.property_type}
                {listing.subdivision && <span> · {listing.subdivision}</span>}
                {listing.school_district && <span> · {listing.school_district}</span>}
              </p>

              {match.matches && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#CFB36E]/15 border border-[#CFB36E]/40 px-3 py-1.5">
                  <span className="text-[#CFB36E] text-xs" aria-hidden="true">
                    ★
                  </span>
                  <p className="text-xs sm:text-sm text-[#CFB36E] font-semibold">
                    Matches your saved search
                    {match.reasons.length > 0 && match.reasons[0] !== "your saved search"
                      ? `: ${match.reasons.slice(0, 3).join(" · ")}`
                      : ""}
                  </p>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <button
                type="button"
                title="Go back"
                aria-label="Go back"
                onClick={() =>
                  window.history.length > 1
                    ? window.history.back()
                    : (window.location.href = "/properties/")
                }
                className="w-10 h-10 rounded-full border border-white/30 hover:border-white text-white/80 hover:text-white flex items-center justify-center transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white text-white text-sm font-semibold hover:bg-white hover:text-black transition-colors"
              >
                <ShareIcon />
                {shareCopied ? "Link copied" : "Share"}
              </button>
              <button
                type="button"
                onClick={onToggleSave}
                title={saved ? "Saved on this device" : "Save on this device"}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${
                  saved
                    ? "bg-[#CFB36E] border-[#CFB36E] text-black"
                    : "border-white text-white hover:bg-white hover:text-black"
                }`}
              >
                <HeartIcon filled={saved} />
                {saved ? "Saved" : "Save"}
              </button>
              <SaveSearchModal
                filters={likeThisFilters}
                buttonLabel="Get alerts"
                buttonClassName="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#CFB36E] text-[#CFB36E] text-sm font-semibold hover:bg-[#CFB36E] hover:text-black transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-6">
          <PhotoGallery
            listingId={listing.id}
            photos={photos}
            photosCount={listing.photos_count}
            alt={fullAddress}
          />
        </div>
      </section>

      {/* ── Main: shared two-column content + sticky rail ───────── */}
      <section className="max-w-7xl mx-auto px-4 py-8 sm:py-10 pb-28 lg:pb-10">
        <ListingDetailContent
          listing={listing}
          similar={similar}
          saved={saved}
          onToggleSave={onToggleSave}
          openNadia={openNadia}
          likeThisFilters={likeThisFilters}
          match={match}
          shareCopied={shareCopied}
          onShare={onShare}
          cityHomes={cityHomes}
          variant="page"
          stickyTopClass="lg:top-24"
          mapInteractive
        />
      </section>

      <MobileStickyBar
        listing={listing}
        saved={saved}
        onToggleSave={onToggleSave}
        openNadia={openNadia}
        mode="fixed"
      />

      <QualifyCta
        program={`a home in ${listing.city || "Northern Colorado"}`}
        chatQuestion={`Hi! I'm looking at a home in ${listing.city || "Northern Colorado"} and want to know if I'd qualify for a loan or CHFA assistance. Can you help?`}
        formAnchor="/contact/"
        formLabel="Ask a question instead"
      />
    </>
  );
}
