import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../utils/listingHelpers.js";
import { getCityHomesPath } from "../data/cityHomesData";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

/**
 * Live city-level market band from our listings API.
 * Only shows real computed aggregates — never invents numbers.
 */
export default function CityStatsBand({ city, className = "", compact = false }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(Boolean(city));

  useEffect(() => {
    if (!city) {
      setStats(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ city });
    fetch(`${API_BASE}/api/listings/stats?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setStats(d?.data || null);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city]);

  if (!city) return null;

  const citySlug = city.toLowerCase().replace(/\s+/g, "-");

  if (loading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse ${className}`}>
        <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || !stats.total) return null;

  const items = [
    {
      label: "Active listings",
      value: Number(stats.total).toLocaleString("en-US"),
      show: stats.total != null,
    },
    {
      label: "Median list price",
      value: stats.median_price != null ? formatPrice(stats.median_price) : null,
      show: stats.median_price != null,
    },
    {
      label: "Median $/sqft",
      value: stats.median_price_per_sqft != null ? `$${Number(stats.median_price_per_sqft).toLocaleString("en-US")}` : null,
      show: stats.median_price_per_sqft != null,
    },
    {
      label: "Median days on market",
      value: stats.median_days_on_market != null ? String(stats.median_days_on_market) : null,
      show: stats.median_days_on_market != null,
    },
  ].filter((x) => x.show && x.value != null);

  if (items.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white ${
        compact ? "p-4" : "p-5 sm:p-6"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className={`font-bold text-gray-900 ${compact ? "text-base" : "text-xl"}`}>
            {city} market snapshot
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Live from active SAA Homes listings — verified inventory data only.
          </p>
        </div>
        <Link
          to={getCityHomesPath(citySlug)}
          className="text-sm font-semibold text-gray-800 underline underline-offset-2 hover:text-black shrink-0"
        >
          Browse {city} homes
        </Link>
      </div>
      <div className={`grid gap-3 ${items.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg bg-white border border-gray-100 px-3 py-3 shadow-sm"
          >
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-500 font-medium">
              {item.label}
            </p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-gray-900 tabular-nums tracking-tight">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
