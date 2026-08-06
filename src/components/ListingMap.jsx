import React, { useEffect, useRef } from "react";
import { photoUrl } from "../utils/photoUrl.js";
import { formatPrice, formatPriceCompact, listingAddress } from "../utils/listingHelpers.js";

/**
 * ListingMap — Mapbox GL clustered markers (Zillow-style).
 * Cluster circles with counts · price-pill unclustered points · photo popup
 * on click · fly-to on list-card hover. Degrades if VITE_MAPBOX_TOKEN is unset.
 *
 * Props:
 *   listings      — array of listing rows with lat/lng
 *   selectedId    — hovered/selected card id (drives fly-to + highlight)
 *   onSelect      — (id) => {} when a marker is clicked
 *   onOpenListing — (listing) => {} when popup is clicked (opens detail panel)
 *   interactive   — default true; set false for static detail-page embed
 */
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

export default function ListingMap({
  listings = [],
  selectedId = null,
  onSelect,
  onOpenListing,
  interactive = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const listingsRef = useRef(listings);
  const onSelectRef = useRef(onSelect);
  const onOpenListingRef = useRef(onOpenListing);

  listingsRef.current = listings;
  onSelectRef.current = onSelect;
  onOpenListingRef.current = onOpenListing;

  // Init map once
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    // Ensure Mapbox CSS is present
    if (!document.getElementById("mapbox-gl-css")) {
      const link = document.createElement("link");
      link.id = "mapbox-gl-css";
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css";
      document.head.appendChild(link);
    }

    import("mapbox-gl/dist/mapbox-gl.js").then(({ default: mapboxgl }) => {
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-105.1, 40.5],
        zoom: 8.5,
        attributionControl: true,
        interactive,
      });
      if (interactive) {
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      }
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("listings", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 48,
        });

        // Cluster circles — black brand
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "listings",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#111111",
            "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 40, 30, 100, 36],
            "circle-opacity": 0.92,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "listings",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          },
          paint: { "text-color": "#ffffff" },
        });

        // Unclustered gold dots (fallback under price labels when using circles)
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "listings",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "id"], selectedId ?? ""],
              "#000000",
              "#CFB36E",
            ],
            "circle-radius": [
              "case",
              ["==", ["get", "id"], selectedId ?? ""],
              10,
              7,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Price labels on unclustered points (Zillow price-pill feel)
        map.addLayer({
          id: "unclustered-price",
          type: "symbol",
          source: "listings",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "priceLabel"],
            "text-size": 11,
            "text-offset": [0, -1.6],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
            "text-allow-overlap": false,
            "text-ignore-placement": false,
          },
          paint: {
            "text-color": "#111111",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });

        map.on("click", "clusters", (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          map.getSource("listings").getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
          });
        });

        const openPopup = (e) => {
          const props = e.features[0].properties;
          const id = props.id;
          const listing = listingsRef.current.find((l) => String(l.id) === String(id));
          if (!listing) return;
          if (popupRef.current) popupRef.current.remove();

          const addr = listingAddress(listing);
          const el = document.createElement("div");
          el.className = "saa-map-popup";
          // Button (not <a>) — opens detail panel over search instead of navigating
          el.innerHTML = `
            <button type="button" data-saa-open-listing class="block w-full text-left bg-white rounded-xl overflow-hidden shadow-xl w-60 border border-gray-100 cursor-pointer p-0">
              <div class="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                <img src="${photoUrl(listing.id, 0)}" alt="${addr || "home"}"
                  class="w-full h-full object-cover"
                  onerror="this.onerror=null;this.src='/images/buyers-hero.jpg'" />
              </div>
              <div class="p-3">
                <p class="font-bold text-sm text-gray-900 m-0">${formatPrice(listing.list_price)}</p>
                <p class="text-xs text-gray-600 mt-0.5 mb-0 truncate">
                  ${[listing.beds != null ? `${listing.beds} bd` : "", listing.baths != null ? `${listing.baths} ba` : "", listing.living_area != null ? `${Number(listing.living_area).toLocaleString()} sqft` : ""].filter(Boolean).join(" · ")}
                </p>
                <p class="text-xs text-gray-500 mt-1 mb-0 truncate">${addr}${listing.city ? `, ${listing.city}` : ""}</p>
                <p class="text-xs font-semibold text-[#8a7340] mt-2 mb-0">View details →</p>
              </div>
            </button>`;
          const btn = el.querySelector("[data-saa-open-listing]");
          if (btn) {
            btn.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              if (onOpenListingRef.current) {
                onOpenListingRef.current(listing);
              } else {
                window.location.href = `/homes-for-sale/${listing.slug}/`;
              }
            });
          }
          popupRef.current = new mapboxgl.Popup({
            offset: 22,
            closeButton: true,
            maxWidth: "260px",
            className: "saa-mapbox-popup",
          })
            .setLngLat(e.features[0].geometry.coordinates)
            .setDOMContent(el)
            .addTo(map);
          onSelectRef.current?.(id);
        };

        map.on("click", "unclustered-point", openPopup);
        map.on("click", "unclustered-price", openPopup);

        ["clusters", "unclustered-point", "unclustered-price"].forEach((layer) => {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        });

        // Apply any listings that arrived before load
        applyListings(map, listingsRef.current);
      });
    });

    return () => {
      cancelled = true;
      if (popupRef.current) {
        try { popupRef.current.remove(); } catch { /* noop */ }
        popupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild GeoJSON when listings change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getSource("listings")) return false;
      applyListings(map, listings);
      return true;
    };
    if (apply()) return;
    const onLoad = () => apply();
    map.on("load", onLoad);
    return () => map.off("load", onLoad);
  }, [listings]);

  // Highlight selected marker (update paint expression via filter trick)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("unclustered-point")) return;
    try {
      map.setPaintProperty("unclustered-point", "circle-color", [
        "case",
        ["==", ["to-string", ["get", "id"]], String(selectedId ?? "")],
        "#000000",
        "#CFB36E",
      ]);
      map.setPaintProperty("unclustered-point", "circle-radius", [
        "case",
        ["==", ["to-string", ["get", "id"]], String(selectedId ?? "")],
        11,
        7,
      ]);
    } catch { /* layer not ready */ }
  }, [selectedId]);

  // Fly-to on card hover/select
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId == null || !interactive) return;
    const listing = listings.find((l) => String(l.id) === String(selectedId));
    if (listing && listing.latitude != null) {
      map.flyTo({
        center: [Number(listing.longitude), Number(listing.latitude)],
        zoom: Math.max(map.getZoom(), 12),
        speed: 1.15,
      });
    }
  }, [selectedId, listings, interactive]);

  if (!TOKEN) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500 text-sm px-4 text-center">
        <p className="font-medium text-gray-700">Map view</p>
        <p className="mt-1 text-xs">Map loads when Mapbox is configured.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full min-h-[240px]" role="img" aria-label="Map of listings" />;
}

function applyListings(map, listings) {
  const features = (listings || [])
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(l.longitude), Number(l.latitude)] },
      properties: {
        id: l.id,
        priceLabel: formatPriceCompact(l.list_price),
      },
    }));
  map.getSource("listings").setData({ type: "FeatureCollection", features });
  try {
    window.__saaMapStats = { features: features.length };
  } catch { /* noop */ }

  // Fit bounds when we have points (gentle, only if multiple)
  if (features.length >= 2) {
    try {
      const bounds = features.reduce(
        (b, f) => {
          const [lng, lat] = f.geometry.coordinates;
          return {
            minLng: Math.min(b.minLng, lng),
            maxLng: Math.max(b.maxLng, lng),
            minLat: Math.min(b.minLat, lat),
            maxLat: Math.max(b.maxLat, lat),
          };
        },
        { minLng: 180, maxLng: -180, minLat: 90, maxLat: -90 }
      );
      map.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 48, maxZoom: 12, duration: 600 }
      );
    } catch { /* noop */ }
  } else if (features.length === 1) {
    map.easeTo({ center: features[0].geometry.coordinates, zoom: 13, duration: 500 });
  }
}
