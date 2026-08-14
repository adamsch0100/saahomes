import React, { useEffect, useState } from "react";
import { photoUrl } from "../utils/photoUrl.js";
import { formatPrice, fmtNum } from "../utils/listingHelpers.js";
import ListingPhotoFallback from "./ListingPhotoFallback.jsx";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

function normalizeZip(raw) {
  if (raw == null || raw === "") return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : "";
}

function formatClosedDate(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statsLine(row) {
  const parts = [];
  if (row.beds != null) parts.push(`${fmtNum(row.beds)} bd`);
  if (row.baths != null) parts.push(`${fmtNum(row.baths)} ba`);
  if (row.living_area != null) parts.push(`${Number(row.living_area).toLocaleString("en-US")} sqft`);
  return parts.join(" · ");
}

async function fetchSold({ zip, city, limit = 6 }) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (zip) qs.set("zip", zip);
  else if (city) qs.set("city", city);
  const res = await fetch(`${API_BASE}/api/sold-listings?${qs.toString()}`);
  if (!res.ok) throw new Error("sold fetch failed");
  const data = await res.json();
  return {
    listings: Array.isArray(data?.listings) ? data.listings : [],
    city: data?.city || city || "",
  };
}

function CompRow({ row }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = row.has_photo && row.listing_id && !imgFailed;
  const closedLabel = formatClosedDate(row.closed_date);
  const stats = statsLine(row);
  const alt = row.address
    ? `Sold home at ${row.address} in ${row.city || "Northern Colorado"}`
    : `Sold home in ${row.city || "Northern Colorado"}`;

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-[#1a1a1a]">
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
        <span className="absolute top-1 left-1 bg-[#CFB36E] text-black text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">
          Sold
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {row.address ? (
          <p className="text-sm font-semibold text-gray-900 truncate">{row.address}</p>
        ) : null}
        <p className="text-xs text-gray-500 truncate">
          {[row.city, row.postal_code].filter(Boolean).join(", ")}
        </p>
        {stats ? <p className="text-xs text-gray-600 mt-0.5">{stats}</p> : null}
        {row.sold_price != null ? (
          <p className="text-sm font-bold text-gray-900 mt-1">
            Sold for {formatPrice(row.sold_price)}
            {closedLabel ? ` · ${closedLabel}` : ""}
          </p>
        ) : closedLabel ? (
          <p className="text-xs text-gray-600 mt-1">Closed {closedLabel}</p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Compact closed-comps list for /my-home/. Zip match first (near you),
 * then city. Does not change the AVM estimate — context only.
 */
export default function RecentClosedSales({ city, postalCode }) {
  const zip = normalizeZip(postalCode);
  const cityName = city ? String(city).trim() : "";
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState(cityName || "your area");
  const [loading, setLoading] = useState(Boolean(zip || cityName));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!zip && !cityName) {
      setRows([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        let result = { listings: [], city: cityName };
        if (zip) {
          result = await fetchSold({ zip, limit: 6 });
        }
        if (result.listings.length === 0 && cityName) {
          result = await fetchSold({ city: cityName, limit: 6 });
        }
        if (cancelled) return;
        setRows(result.listings);
        setLabel(cityName || result.city || "your area");
      } catch {
        if (cancelled) return;
        setRows([]);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zip, cityName]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#CFB36E]">
        Recent closed sales near you
      </p>
      <h3 className="text-lg font-bold text-gray-900 mt-1">
        Closed sales in {label} — IRES MLS data
      </h3>
      <p className="text-xs text-gray-500 mt-1">Comps for context, not an appraisal.</p>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500 animate-pulse">Loading recent sales…</p>
      ) : error || rows.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-gray-800">No recent closed sales recorded here yet.</p>
          <p className="text-sm text-gray-600 mt-2">
            Call{" "}
            <a href="tel:9709991407" className="font-semibold text-black hover:underline">
              (970) 999-1407
            </a>{" "}
            for a free market report on your home.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {rows.map((row) => (
            <CompRow key={row.listing_id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
