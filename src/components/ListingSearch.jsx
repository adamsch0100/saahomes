import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import ListingMap from "./ListingMap";

/**
 * ListingSearch — Zillow-style split-view search powering /properties/.
 * Left: Mapbox cluster map. Right: filterable listing cards. Hover a card →
 * map flies to it. Click a marker → popup with photo + price.
 * Renders clean empty states until the IRES feed is connected.
 */
const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const CITIES = [
  "Fort Collins", "Loveland", "Windsor", "Greeley", "Timnath", "Severance",
  "Wellington", "Johnstown", "Longmont", "Boulder", "Berthoud", "Firestone",
  "Frederick", "Evans", "Mead", "Milliken", "La Salle", "Eaton", "Niwot",
];

const PRICE_OPTIONS = [
  { label: "Any price", value: "" },
  { label: "Under $400K", value: "0-400000" },
  { label: "$400K – $600K", value: "400000-600000" },
  { label: "$600K – $800K", value: "600000-800000" },
  { label: "$800K – $1M", value: "800000-1000000" },
  { label: "$1M+", value: "1000000-" },
];

const BED_OPTIONS = [
  { label: "Any beds", value: "" }, { label: "1+", value: "1" }, { label: "2+", value: "2" },
  { label: "3+", value: "3" }, { label: "4+", value: "4" }, { label: "5+", value: "5" },
];

const BATH_OPTIONS = [
  { label: "Any baths", value: "" }, { label: "1+", value: "1" }, { label: "2+", value: "2" },
  { label: "3+", value: "3" }, { label: "4+", value: "4" },
];

const TYPE_OPTIONS = [
  { label: "All types", value: "" },
  { label: "House", value: "Residential" },
  { label: "Condo / Townhome", value: "Condominium" },
  { label: "Townhome", value: "Townhouse" },
  { label: "Land / Lot", value: "Land" },
  { label: "Multi-Family", value: "Multi-Family" },
  { label: "Commercial", value: "Commercial Sale" },
];

const formatPrice = (n) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function ListingSearch({ location, height = "700px" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlLocation = searchParams.get("location") || location || "";
  const urlPrice =
    searchParams.get("price") ||
    (searchParams.get("minPrice") || searchParams.get("maxPrice")
      ? `${searchParams.get("minPrice") || ""}-${searchParams.get("maxPrice") || ""}`
      : "");
  const [filters, setFilters] = useState({
    city: searchParams.get("city") || urlLocation || "",
    price: urlPrice,
    beds: searchParams.get("beds") || "",
    baths: searchParams.get("baths") || "",
    type: searchParams.get("type") || "",
    sort: searchParams.get("sort") || "newest",
  });
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0, page: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("map"); // map | list (mobile toggle)
  const resultsRef = useRef(null);

  const fetchListings = useCallback(async (override = {}) => {
    const params = new URLSearchParams();
    const f = { ...filters, ...override };
    if (f.city) params.set("city", f.city);
    if (f.price) {
      const [min, max] = f.price.split("-");
      if (min) params.set("minPrice", min);
      if (max) params.set("maxPrice", max);
    }
    if (f.beds) params.set("beds", f.beds);
    if (f.baths) params.set("baths", f.baths);
    if (f.type) params.set("type", f.type);
    if (f.sort) params.set("sort", f.sort);
    params.set("limit", "50");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/listings?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.data || []);
      setMeta(data.meta || { total: 0, pages: 0, page: 1 });
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const setFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Sync filters to the URL so searches are shareable, back-buttonable,
      // and crawlable (e.g. /properties/?city=Fort+Collins&minPrice=400000&beds=3)
      const params = new URLSearchParams();
      if (next.city) params.set("city", next.city);
      if (next.price) {
        const [min, max] = next.price.split("-");
        if (min) params.set("minPrice", min);
        if (max) params.set("maxPrice", max);
      }
      if (next.beds) params.set("beds", next.beds);
      if (next.baths) params.set("baths", next.baths);
      if (next.type) params.set("type", next.type);
      if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
      setSearchParams(params, { replace: true });
      return next;
    });
  };

  const selectCard = (id) => {
    setSelectedId(id);
    const el = document.getElementById(`listing-card-${id}`);
    if (el && resultsRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ── Empty/loading states ─────────────────────────────────────────────
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center h-full min-h-[400px] px-6">
      <p className="text-gray-700 font-semibold text-lg">Search is warming up</p>
      <p className="text-gray-500 mt-2 max-w-md">
        The MLS feed is being connected. In the meantime, browse our{" "}
        <a href="/northern-colorado-areas/" className="underline text-black">city guides</a>{" "}
        or call <a href="tel:+19709991407" className="underline">(970) 999-1407</a>.
      </p>
    </div>
  );

  const NoResults = () => (
    <div className="flex flex-col items-center justify-center text-center h-full min-h-[400px] px-6">
      <p className="text-gray-700 font-semibold text-lg">
        No active listings found{filters.city ? ` in ${filters.city}` : ""}
      </p>
      <p className="text-gray-500 mt-2 max-w-md">
        Try widening your filters, or explore our{" "}
        <a href="/northern-colorado-areas/" className="underline text-black">area guides</a>{" "}
        — we can help you find the right home. <a href="tel:+19709991407" className="underline">(970) 999-1407</a>
      </p>
    </div>
  );

  // ── Filter bar (shared) ──────────────────────────────────────────────
  const FilterBar = () => (
    <div className="flex flex-wrap gap-3 p-4 border-b border-gray-200 bg-white">
      <select value={filters.city} onChange={(e) => setFilter("city", e.target.value)}
        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black" aria-label="City">
        <option value="">All cities</option>
        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={filters.price} onChange={(e) => setFilter("price", e.target.value)}
        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black" aria-label="Price">
        {PRICE_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      <select value={filters.beds} onChange={(e) => setFilter("beds", e.target.value)}
        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black" aria-label="Beds">
        {BED_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      <select value={filters.baths} onChange={(e) => setFilter("baths", e.target.value)}
        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black" aria-label="Baths">
        {BATH_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)}
        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black" aria-label="Property type">
        {TYPE_OPTIONS.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
      <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}
        className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black" aria-label="Sort">
        <option value="newest">Newest first</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
      {meta.total > 0 && (
        <span className="ml-auto self-center text-sm text-gray-500">
          {meta.total.toLocaleString()} listing{meta.total === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );

  // ── Result card ──────────────────────────────────────────────────────
  const Card = ({ listing }) => (
    <article
      id={`listing-card-${listing.id}`}
      onMouseEnter={() => setSelectedId(listing.id)}
      className={`border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg transition-all flex flex-col scroll-mt-24 ${
        selectedId === listing.id ? "border-[#CFB36E] ring-2 ring-[#CFB36E]/40" : "border-gray-200"
      }`}
    >
      <a href={`/homes-for-sale/${listing.slug}/`} className="block relative aspect-[4/3] bg-gray-100">
        {listing.photos?.length > 0 ? (
          <img src={listing.photos[0]} alt={`${listing.street_number || ""} ${listing.street_name || ""} ${listing.city || ""}`}
            className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            {listing.city || "Northern Colorado"} listing
          </div>
        )}
        <span className="absolute bottom-2 left-2 bg-black/80 text-white text-sm font-semibold px-3 py-1 rounded-md">
          {formatPrice(listing.list_price)}
        </span>
        <span className="absolute top-2 right-2 bg-white/90 text-black text-xs font-semibold px-2 py-1 rounded">
          {listing.status || "Active"}
        </span>
      </a>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 className="font-semibold text-gray-900 leading-snug">
          <a href={`/homes-for-sale/${listing.slug}/`} className="hover:underline">
            {listing.street_number || ""} {listing.street_name || "Home"}{listing.unit ? ` #${listing.unit}` : ""}
          </a>
        </h3>
        <p className="text-sm text-gray-500">{listing.city}, {listing.state} {listing.postal_code || ""}</p>
        <p className="text-sm text-gray-700 mt-1">
          {listing.beds != null && <span><strong>{listing.beds}</strong> bd </span>}
          {listing.baths != null && <span><strong>{listing.baths}</strong> ba </span>}
          {listing.living_area != null && <span><strong>{Number(listing.living_area).toLocaleString()}</strong> sqft</span>}
        </p>
        <a href={`/homes-for-sale/${listing.slug}/`}
          className="mt-auto pt-3 inline-flex items-center justify-center px-4 py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors">
          View Details
        </a>
      </div>
    </article>
  );

  // ── Desktop split view ───────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height }}>
      <FilterBar />

      {/* Mobile view toggle */}
      <div className="flex lg:hidden border-b border-gray-200 bg-gray-50">
        <button onClick={() => setView("map")}
          className={`flex-1 py-2.5 text-sm font-semibold ${view === "map" ? "bg-black text-white" : "text-gray-600"}`}>
          Map
        </button>
        <button onClick={() => setView("list")}
          className={`flex-1 py-2.5 text-sm font-semibold ${view === "list" ? "bg-black text-white" : "text-gray-600"}`}>
          List ({meta.total.toLocaleString()})
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center flex-1 text-gray-500">Loading listings…</div>
      )}

      {/* Error / empty */}
      {!loading && error && <div className="flex-1"><EmptyState /></div>}
      {!loading && !error && results.length === 0 && <div className="flex-1"><NoResults /></div>}

      {/* Split view */}
      {!loading && !error && results.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          {/* Map — hidden on mobile list view */}
          <div className={`lg:block lg:w-[52%] ${view === "map" ? "block flex-1" : "hidden"}`}>
            <ListingMap listings={results} selectedId={selectedId} onSelect={selectCard} />
          </div>
          {/* Results — scrollable */}
          <div
            ref={resultsRef}
            className={`overflow-y-auto p-4 space-y-4 ${view === "list" ? "flex-1" : "hidden lg:block lg:w-[48%]"}`}
          >
            <p className="text-sm text-gray-600 font-medium mb-3">
              {meta.total.toLocaleString()} homes in Northern Colorado
            </p>
            {results.map((listing) => <Card key={listing.id} listing={listing} />)}
          </div>
        </div>
      )}
    </div>
  );
}
