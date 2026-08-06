import React, { useEffect, useRef } from "react";

/**
 * ListingMap — Mapbox GL map with clustered listing markers.
 * Zillow-style: cluster circles with counts, popup on click, fly-to on
 * list-card hover. Degrades to a placeholder if VITE_MAPBOX_TOKEN is unset.
 *
 * Props:
 *   listings  — array of { id, slug, latitude, longitude, list_price, street_name, city, photos }
 *   selectedId — id of the hovered/selected card (drives fly-to + highlight)
 *   onSelect   — (id) => {} when a marker is clicked
 */
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

const formatPrice = (n) =>
  n == null ? "" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function ListingMap({ listings = [], selectedId = null, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const markersRef = useRef({});

  // Init map once
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("mapbox-gl/dist/mapbox-gl.js").then(({ default: mapboxgl }) => {
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-105.1, 40.5], // Northern Colorado centroid
        zoom: 8.5,
        attributionControl: true,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        // Cluster source — GeoJSON rebuilt on each listings change
        map.addSource("listings", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 50,
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "listings",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#000000",
            "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30],
            "circle-opacity": 0.85,
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
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "listings",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#CFB36E",
            "circle-radius": 7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Click cluster → zoom in
        map.on("click", "clusters", (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
          const clusterId = features[0].properties.cluster_id;
          map.getSource("listings").getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
          });
        });

        // Click marker → popup + select
        map.on("click", "unclustered-point", (e) => {
          const id = e.features[0].properties.id;
          const listing = listings.find((l) => l.id === id);
          if (!listing) return;
          if (popupRef.current) popupRef.current.remove();
          const el = document.createElement("div");
          el.className = "flex flex-col bg-white rounded-lg overflow-hidden shadow-lg w-56";
          el.innerHTML = `
            <div class="aspect-[4/3] bg-gray-100 overflow-hidden">
              ${listing.photos?.[0]
                ? `<img src="${listing.photos[0]}" alt="${listing.street_name || "home"}" class="w-full h-full object-cover" />`
                : `<div class="w-full h-full flex items-center justify-center text-gray-400 text-xs">No photo</div>`}
            </div>
            <div class="p-2.5">
              <p class="font-bold text-sm">${formatPrice(listing.list_price)}</p>
              <p class="text-xs text-gray-600 truncate">${listing.street_name || ""} ${listing.city || ""}</p>
              <a href="/homes-for-sale/${listing.slug}/" class="mt-1.5 inline-block text-xs font-semibold bg-black text-white px-2.5 py-1 rounded">View</a>
            </div>`;
          popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false })
            .setLngLat(e.lngLat)
            .setDOMContent(el)
            .addTo(map);
          onSelect?.(id);
        });

        // Cursor
        map.on("mouseenter", "unclustered-point", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "unclustered-point", () => (map.getCanvas().style.cursor = ""));
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild GeoJSON when listings change (retry once the map source exists —
  // fixes the race where listings arrive before the map 'load' event).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const features = listings
      .filter((l) => l.latitude != null && l.longitude != null)
      .map((l) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(l.longitude), Number(l.latitude)] },
        properties: { id: l.id },
      }));
    const apply = () => {
      if (!map.getSource("listings")) return false;
      map.getSource("listings").setData({ type: "FeatureCollection", features });
      return true;
    };
    if (apply()) return;
    const onLoad = () => apply();
    map.on("load", onLoad);
    // eslint-disable-next-line consistent-return
    return () => map.off("load", onLoad);
  }, [listings]);

  // Fly-to + highlight on card hover/select
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId == null) return;
    const listing = listings.find((l) => l.id === selectedId);
    if (listing && listing.latitude != null) {
      map.flyTo({ center: [Number(listing.longitude), Number(listing.latitude)], zoom: 12, speed: 1.2 });
    }
  }, [selectedId, listings]);

  if (!TOKEN) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
        Map coming soon — set VITE_MAPBOX_TOKEN
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
