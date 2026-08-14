import React, { useEffect, useState } from "react";
import { photoUrl } from "../utils/photoUrl.js";
import { formatPrice, fmtNum } from "../utils/listingHelpers.js";
import ListingPhotoFallback from "./ListingPhotoFallback.jsx";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const CITY_OPTIONS = [
  { slug: "", label: "Northern Colorado" },
  { slug: "fort-collins", label: "Fort Collins" },
  { slug: "loveland", label: "Loveland" },
  { slug: "windsor", label: "Windsor" },
  { slug: "greeley", label: "Greeley" },
  { slug: "timnath", label: "Timnath" },
  { slug: "wellington", label: "Wellington" },
  { slug: "johnstown", label: "Johnstown" },
  { slug: "eaton", label: "Eaton" },
  { slug: "milliken", label: "Milliken" },
  { slug: "la-salle", label: "La Salle" },
  { slug: "mead", label: "Mead" },
  { slug: "longmont", label: "Longmont" },
  { slug: "boulder", label: "Boulder" },
  { slug: "berthoud", label: "Berthoud" },
  { slug: "firestone", label: "Firestone" },
  { slug: "frederick", label: "Frederick" },
  { slug: "evans", label: "Evans" },
  { slug: "severance", label: "Severance" },
  { slug: "niwot", label: "Niwot" },
  { slug: "erie", label: "Erie" },
  { slug: "brighton", label: "Brighton" },
  { slug: "estes-park", label: "Estes Park" },
  { slug: "red-feather-lakes", label: "Red Feather Lakes" },
  { slug: "fort-lupton", label: "Fort Lupton" },
  { slug: "lyons", label: "Lyons" },
  { slug: "bellvue", label: "Bellvue" },
];

function formatClosedDate(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function statsLine(row) {
  const parts = [];
  if (row.beds != null) parts.push(`${fmtNum(row.beds)} bd`);
  if (row.baths != null) parts.push(`${fmtNum(row.baths)} ba`);
  if (row.living_area != null) parts.push(`${Number(row.living_area).toLocaleString("en-US")} sqft`);
  return parts.join(" · ");
}

function SoldCard({ row }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = row.has_photo && row.listing_id && !imgFailed;
  const closedLabel = formatClosedDate(row.closed_date);
  const stats = statsLine(row);
  const alt = row.address
    ? `Sold home at ${row.address} in ${row.city || "Northern Colorado"}`
    : `Sold home in ${row.city || "Northern Colorado"}`;

  return (
    <article className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <div className="relative aspect-[4/3] bg-[#1a1a1a] overflow-hidden">
        {showPhoto ? (
          <img
            src={photoUrl(row.listing_id, 0)}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <ListingPhotoFallback className="w-full h-full absolute inset-0" />
        )}
        <span className="absolute top-2 left-2 bg-[#CFB36E] text-black text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded">
          Sold
        </span>
        {row.sold_price != null ? (
          <span className="absolute bottom-2 left-2 bg-black/80 text-white text-sm font-bold px-3 py-1 rounded-lg">
            Sold for {formatPrice(row.sold_price)}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        {stats ? <div className="text-sm text-gray-700 font-medium">{stats}</div> : null}
        {row.address ? (
          <p className="mt-1.5 text-gray-900 font-semibold truncate">{row.address}</p>
        ) : null}
        <p className="text-gray-500 text-sm truncate">
          {[row.city, row.postal_code].filter(Boolean).join(", ")}
        </p>
        {closedLabel && row.sold_price != null ? (
          <p className="mt-2 text-sm text-gray-700">
            Sold for {formatPrice(row.sold_price)} on {closedLabel}
          </p>
        ) : null}
        {row.days_on_market != null ? (
          <p className="text-xs text-gray-500 mt-1">{row.days_on_market} days on market</p>
        ) : null}
      </div>
    </article>
  );
}

function labelForSlug(slug) {
  if (!slug) return "Northern Colorado";
  const hit = CITY_OPTIONS.find((o) => o.slug === slug);
  if (hit) return hit.label;
  if (slug === "carbon-valley") return "Carbon Valley";
  return slug;
}

export default function RecentlySoldSection({ citySlug } = {}) {
  const locked = Boolean(citySlug);
  const [selectedCity, setSelectedCity] = useState("");
  const city = locked ? citySlug : selectedCity;
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState(locked ? labelForSlug(citySlug) : "Northern Colorado");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const qs = new URLSearchParams({ limit: locked ? "6" : "12" });
    if (city) qs.set("city", city);
    fetch(`${API_BASE}/api/sold-listings?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("sold fetch failed"))))
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data?.listings) ? data.listings : []);
        setLabel(data?.city || (locked ? labelForSlug(city) : "Northern Colorado"));
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, locked]);

  const headingCity = locked ? (label && label !== "Northern Colorado" ? label : labelForSlug(citySlug)) : label;

  return (
    <section className="py-16 px-6" aria-labelledby="recently-sold-heading">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Market activity</p>
            <h2 id="recently-sold-heading" className="text-4xl sm:text-5xl font-bold font-serif mb-3">
              {locked ? `Recently Sold in ${headingCity}` : "Recently Sold"}
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl">
              {locked
                ? `Recently sold in ${headingCity} · Source: IRES MLS data · we do not estimate or fill in missing figures.`
                : `Closed sales recorded in ${label} over the last 12 months. Each price and date comes from the MLS — we do not estimate or fill in missing figures.`}
            </p>
          </div>
          {locked ? null : (
          <label className="block sm:min-w-[220px]">
            <span className="sr-only">Filter recently sold homes by city</span>
            <select
              value={city}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full border-2 border-black rounded-lg px-4 py-3 bg-white font-semibold"
            >
              {CITY_OPTIONS.map((opt) => (
                <option key={opt.slug || "noco"} value={opt.slug}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          )}
        </div>

        {loading ? (
          <p className="text-gray-600">Loading recent sales…</p>
        ) : error || rows.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-lg text-gray-800 mb-3">
              No recent sales recorded for this area yet — check back soon.
            </p>
            <p className="text-gray-700">
              Call{" "}
              <a href="tel:9709991407" className="font-semibold text-black hover:underline">
                (970) 999-1407
              </a>{" "}
              for a free market report on your home.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rows.map((row) => (
              <SoldCard key={row.listing_id} row={row} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
