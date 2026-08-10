import React, { useEffect, useRef } from "react";
import { photoUrl } from "../utils/photoUrl.js";
import { formatPrice, formatPriceCompact, listingAddress, listingStatsLine } from "../utils/listingHelpers.js";
import { LISTING_PHOTO_FALLBACK_SRC } from "../utils/photoUrl.js";

/**
 * ListingMap — Mapbox GL clustered markers (Zillow-style).
 * Cluster circles with counts · price-pill unclustered points · photo popup
 * on click/hover · fly-to on list-card hover. Optional polygon draw.
 * priceHeatmap colors pins by real list_price (green→yellow→red quantiles).
 *
 * Props:
 *   listings        — array of listing rows with lat/lng + list_price
 *   selectedId      — hovered/selected card id (drives fly-to + highlight)
 *   onSelect        — (id) => {} when a marker is clicked
 *   onOpenListing   — (listing) => {} when popup is clicked (opens detail panel)
 *   interactive     — default true; set false for static detail-page embed
 *   drawEnabled     — when true, user can draw a search polygon
 *   polygon         — active ring as "lng,lat;lng,lat;..." or empty
 *   onPolygonChange — (ringString | "") => {} when draw completes / is deleted
 *   priceHeatmap    — color unclustered pins by list_price band
 */

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

const DRAW_CSS_ID = "mapbox-gl-draw-css";
const MAPBOX_CSS_ID = "mapbox-gl-css";

/** Serialize ring [[lng,lat],...] → "lng,lat;lng,lat;..." */
export function ringToParam(ring) {
  if (!ring?.length) return "";
  return ring.map(([lng, lat]) => `${lng},${lat}`).join(";");
}

/** Parse "lng,lat;..." → [[lng,lat],...] */
export function paramToRing(param) {
  if (!param || typeof param !== "string") return null;
  const ring = param
    .split(";")
    .map((pair) => {
      const [a, b] = pair.split(",").map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return [a, b];
    })
    .filter(Boolean);
  return ring.length >= 3 ? ring : null;
}

export default function ListingMap({
  listings = [],
  selectedId = null,
  onSelect,
  onOpenListing,
  interactive = true,
  drawEnabled = false,
  polygon = "",
  onPolygonChange,
  priceHeatmap = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const popupRef = useRef(null);
  const hoverPopupRef = useRef(null);
  const listingsRef = useRef(listings);
  const onSelectRef = useRef(onSelect);
  const onOpenListingRef = useRef(onOpenListing);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const drawEnabledRef = useRef(drawEnabled);
  const polygonRef = useRef(polygon);
  const priceHeatmapRef = useRef(priceHeatmap);
  const suppressDrawEvent = useRef(false);
  const mapboxglRef = useRef(null);

  listingsRef.current = listings;
  onSelectRef.current = onSelect;
  onOpenListingRef.current = onOpenListing;
  onPolygonChangeRef.current = onPolygonChange;
  drawEnabledRef.current = drawEnabled;
  polygonRef.current = polygon;
  priceHeatmapRef.current = priceHeatmap;

  // Init map once
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    if (!document.getElementById(MAPBOX_CSS_ID)) {
      const link = document.createElement("link");
      link.id = MAPBOX_CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById(DRAW_CSS_ID)) {
      const link = document.createElement("link");
      link.id = DRAW_CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css";
      document.head.appendChild(link);
    }

    Promise.all([
      import("mapbox-gl/dist/mapbox-gl.js"),
      import("@mapbox/mapbox-gl-draw"),
    ]).then(([{ default: mapboxgl }, DrawMod]) => {
      if (cancelled || !containerRef.current) return;
      const MapboxDraw = DrawMod.default || DrawMod;
      mapboxglRef.current = mapboxgl;

      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-105.1, 40.5],
        zoom: 8.5,
        attributionControl: true,
        interactive,
        scrollZoom: true,
        dragPan: true,
      });
      if (interactive) {
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      }
      mapRef.current = map;

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: "simple_select",
        styles: drawStyles(),
      });
      map.addControl(draw);
      drawRef.current = draw;

      const emitPolygon = () => {
        if (suppressDrawEvent.current || draw.__saaSuppressing) return;
        const data = draw.getAll();
        const poly = data.features.find((f) => f.geometry?.type === "Polygon");
        if (!poly) {
          onPolygonChangeRef.current?.("");
          return;
        }
        const ring = poly.geometry.coordinates[0];
        onPolygonChangeRef.current?.(ringToParam(ring));
      };

      // Shared suppress flag for programmatic polygon sync
      draw.__saaSuppress = suppressDrawEvent;
      map.__saaSuppressDraw = suppressDrawEvent;

      map.on("draw.create", (e) => {
        if (suppressDrawEvent.current) return;
        // Keep only one polygon — delete older ones
        const ids = draw.getAll().features
          .filter((f) => f.geometry?.type === "Polygon")
          .map((f) => f.id);
        if (ids.length > 1) {
          const keep = e.features?.[0]?.id;
          suppressDrawEvent.current = true;
          ids.filter((id) => id !== keep).forEach((id) => {
            try { draw.delete(id); } catch { /* noop */ }
          });
          suppressDrawEvent.current = false;
        }
        emitPolygon();
        // Exit draw mode after complete
        try { draw.changeMode("simple_select"); } catch { /* noop */ }
      });
      map.on("draw.update", emitPolygon);
      map.on("draw.delete", emitPolygon);

      map.on("load", () => {
        map.addSource("listings", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 48,
        });

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

        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "listings",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": pinColorExpression(selectedId, priceHeatmapRef.current),
            "circle-radius": [
              "case",
              ["==", ["to-string", ["get", "id"]], String(selectedId ?? "")],
              11,
              8,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.addLayer({
          id: "unclustered-price",
          type: "symbol",
          source: "listings",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "priceLabel"],
            "text-size": 11,
            "text-offset": [0, -1.65],
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

        const buildPopupEl = (listing, { mini = false } = {}) => {
          const addr = listingAddress(listing);
          const el = document.createElement("div");
          el.className = "saa-map-popup";
          const stats = listingStatsLine(listing);
          const photoAlt = (addr || "Listing photo").replace(/"/g, "&quot;");
          const wirePhotoFallback = (root) => {
            root.querySelectorAll("img").forEach((img) => {
              img.addEventListener(
                "error",
                () => {
                  img.onerror = null;
                  img.src = LISTING_PHOTO_FALLBACK_SRC;
                },
                { once: true }
              );
            });
          };
          if (mini) {
            el.innerHTML = `
              <div class="flex gap-2 bg-white rounded-lg overflow-hidden shadow-lg border border-gray-100 w-[220px] p-0">
                <div class="w-[72px] h-[72px] shrink-0 bg-[#1a1a1a] overflow-hidden">
                  <img src="${photoUrl(listing.id, 0)}" alt=""
                    class="w-full h-full object-cover" />
                </div>
                <div class="py-1.5 pr-2 min-w-0 flex flex-col justify-center">
                  <p class="font-bold text-sm text-gray-900 m-0 leading-tight">${formatPrice(listing.list_price)}</p>
                  <p class="text-[11px] font-semibold text-gray-700 mt-0.5 mb-0 truncate">${stats}</p>
                  <p class="text-[10px] text-gray-500 mt-0.5 mb-0 truncate">${addr}${listing.city ? `, ${listing.city}` : ""}</p>
                </div>
              </div>`;
            wirePhotoFallback(el);
          } else {
            const photoCount =
              Array.isArray(listing.photos) && listing.photos.length > 0 ? listing.photos.length : 1;
            let photoIdx = 0;
            el.innerHTML = `
              <div type="button" data-saa-open-listing class="block w-full text-left bg-white rounded-xl overflow-hidden shadow-xl w-60 border border-gray-100 cursor-pointer p-0">
                <div class="relative aspect-[4/3] bg-[#1a1a1a] overflow-hidden">
                  <img data-saa-popup-img src="${photoUrl(listing.id, photoIdx)}" alt="${photoAlt}"
                    class="w-full h-full object-cover" />
                  <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6">
                    <p class="font-bold text-base text-white m-0">${formatPrice(listing.list_price)}</p>
                  </div>
                  ${
                    photoCount > 1
                      ? `<button type="button" data-saa-prev aria-label="Previous photo"
                          class="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white text-sm font-bold flex items-center justify-center border border-white/30">‹</button>
                        <button type="button" data-saa-next aria-label="Next photo"
                          class="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white text-sm font-bold flex items-center justify-center border border-white/30">›</button>
                        <span data-saa-counter class="absolute top-9 right-1.5 text-[10px] font-bold text-white bg-black/50 rounded-full px-1.5 py-0.5">1/${photoCount}</span>`
                      : ""
                  }
                </div>
                <div class="p-3">
                  <p class="text-xs font-semibold text-gray-800 m-0 truncate">${stats}</p>
                  <p class="text-xs text-gray-500 mt-1 mb-0 truncate">${addr}${listing.city ? `, ${listing.city}` : ""}</p>
                  <p class="text-xs font-semibold text-[#8a7340] mt-2 mb-0">View details →</p>
                </div>
              </div>`;
            wirePhotoFallback(el);
            const card = el.querySelector("[data-saa-open-listing]");
            if (card) {
              card.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (onOpenListingRef.current) {
                  onOpenListingRef.current(listing);
                } else {
                  window.location.href = `/homes-for-sale/${listing.slug}/`;
                }
              });
            }
            // Photo carousel — prev/next cycle through the listing's photos.
            const img = el.querySelector("[data-saa-popup-img]");
            const prevBtn = el.querySelector("[data-saa-prev]");
            const nextBtn = el.querySelector("[data-saa-next]");
            const counter = el.querySelector("[data-saa-counter]");
            const setPhoto = (i) => {
              photoIdx = (i + photoCount) % photoCount;
              if (img) {
                img.src = photoUrl(listing.id, photoIdx);
                img.addEventListener(
                  "error",
                  () => {
                    img.onerror = null;
                    img.src = LISTING_PHOTO_FALLBACK_SRC;
                  },
                  { once: true }
                );
              }
              if (counter) counter.textContent = `${photoIdx + 1}/${photoCount}`;
            };
            prevBtn?.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              setPhoto(photoIdx - 1);
            });
            nextBtn?.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              setPhoto(photoIdx + 1);
            });
          }
          return el;
        };

        const openPopup = (e) => {
          if (drawEnabledRef.current) return;
          const props = e.features[0].properties;
          const id = props.id;
          const listing = listingsRef.current.find((l) => String(l.id) === String(id));
          if (!listing) return;
          if (hoverPopupRef.current) {
            try { hoverPopupRef.current.remove(); } catch { /* noop */ }
            hoverPopupRef.current = null;
          }
          if (popupRef.current) popupRef.current.remove();

          const el = buildPopupEl(listing, { mini: false });
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

        const showHoverCard = (e) => {
          if (drawEnabledRef.current) return;
          if (popupRef.current) return; // sticky click popup wins
          const props = e.features?.[0]?.properties;
          if (!props) return;
          const listing = listingsRef.current.find((l) => String(l.id) === String(props.id));
          if (!listing) return;
          const coords = e.features[0].geometry.coordinates;
          if (hoverPopupRef.current) {
            try { hoverPopupRef.current.remove(); } catch { /* noop */ }
          }
          const el = buildPopupEl(listing, { mini: true });
          hoverPopupRef.current = new mapboxgl.Popup({
            offset: 16,
            closeButton: false,
            closeOnClick: false,
            maxWidth: "240px",
            className: "saa-mapbox-popup saa-mapbox-popup--hover",
          })
            .setLngLat(coords)
            .setDOMContent(el)
            .addTo(map);
        };

        const hideHoverCard = () => {
          if (hoverPopupRef.current) {
            try { hoverPopupRef.current.remove(); } catch { /* noop */ }
            hoverPopupRef.current = null;
          }
        };

        map.on("click", "unclustered-point", openPopup);
        map.on("click", "unclustered-price", openPopup);

        map.on("mouseenter", "unclustered-point", (e) => {
          map.getCanvas().style.cursor = drawEnabledRef.current ? "crosshair" : "pointer";
          showHoverCard(e);
        });
        map.on("mouseenter", "unclustered-price", (e) => {
          map.getCanvas().style.cursor = drawEnabledRef.current ? "crosshair" : "pointer";
          showHoverCard(e);
        });
        map.on("mouseleave", "unclustered-point", () => {
          map.getCanvas().style.cursor = drawEnabledRef.current ? "crosshair" : "";
          hideHoverCard();
        });
        map.on("mouseleave", "unclustered-price", () => {
          map.getCanvas().style.cursor = drawEnabledRef.current ? "crosshair" : "";
          hideHoverCard();
        });

        map.on("mouseenter", "clusters", () => {
          map.getCanvas().style.cursor = drawEnabledRef.current ? "crosshair" : "pointer";
        });
        map.on("mouseleave", "clusters", () => {
          map.getCanvas().style.cursor = drawEnabledRef.current ? "crosshair" : "";
        });

        applyListings(map, listingsRef.current);
        applyPinPaint(map, selectedId, priceHeatmapRef.current);
        // Hydrate existing polygon from URL/state
        syncDrawPolygon(draw, polygonRef.current);
        if (drawEnabledRef.current) {
          try {
            draw.changeMode("draw_polygon");
            map.getCanvas().style.cursor = "crosshair";
          } catch { /* noop */ }
        }
      });
    });

    return () => {
      cancelled = true;
      if (popupRef.current) {
        try { popupRef.current.remove(); } catch { /* noop */ }
        popupRef.current = null;
      }
      if (hoverPopupRef.current) {
        try { hoverPopupRef.current.remove(); } catch { /* noop */ }
        hoverPopupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      drawRef.current = null;
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

  // Highlight selected marker + price heatmap band colors
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("unclustered-point")) return;
    applyPinPaint(map, selectedId, priceHeatmap);
  }, [selectedId, priceHeatmap]);

  // Fly-to on card hover/select (skip when drawing)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId == null || !interactive || drawEnabled) return;
    const listing = listings.find((l) => String(l.id) === String(selectedId));
    if (listing && listing.latitude != null) {
      map.flyTo({
        center: [Number(listing.longitude), Number(listing.latitude)],
        zoom: Math.max(map.getZoom(), 12),
        speed: 1.15,
      });
    }
  }, [selectedId, listings, interactive, drawEnabled]);

  // Toggle draw mode
  useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;
    try {
      if (drawEnabled) {
        // Clear existing so user starts fresh, unless one already active and we're just re-entering
        draw.changeMode("draw_polygon");
        map.getCanvas().style.cursor = "crosshair";
      } else {
        draw.changeMode("simple_select");
        map.getCanvas().style.cursor = "";
      }
    } catch { /* draw not ready */ }
  }, [drawEnabled]);

  // Sync external polygon prop → draw layers (e.g. chip clear, URL load)
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;
    syncDrawPolygon(draw, polygon);
  }, [polygon]);

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

function syncDrawPolygon(draw, polygonParam) {
  if (!draw) return;
  const ring = paramToRing(polygonParam);
  try {
    const existing = draw.getAll().features.filter((f) => f.geometry?.type === "Polygon");
    const currentParam = existing[0]
      ? ringToParam(existing[0].geometry.coordinates[0])
      : "";
    // Normalize comparison (closed rings may re-append first vertex)
    const normalize = (p) => {
      if (!p) return "";
      const pts = p.split(";");
      if (pts.length > 1 && pts[0] === pts[pts.length - 1]) pts.pop();
      return pts.join(";");
    };
    if (normalize(polygonParam || "") === normalize(currentParam)) return;

    // Suppress draw.delete / draw.create callbacks while we replace programmatically
    const flag = draw._ctx?.map?.__saaSuppressDraw
      || draw.map?.__saaSuppressDraw
      || null;
    // Fallback: walk map from control
    let suppressRef = flag;
    if (!suppressRef && typeof draw.getAll === "function") {
      // Use a module-level pattern via draw instance stash
      suppressRef = draw.__saaSuppress || null;
    }

    const setSuppress = (v) => {
      if (suppressRef && typeof suppressRef === "object" && "current" in suppressRef) {
        suppressRef.current = v;
      }
      draw.__saaSuppressing = v;
    };

    setSuppress(true);
    existing.forEach((f) => {
      try { draw.delete(f.id); } catch { /* noop */ }
    });
    if (ring) {
      const closed = [...ring];
      const a = closed[0];
      const b = closed[closed.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) closed.push([...a]);
      draw.add({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [closed] },
      });
    }
    setSuppress(false);
  } catch { /* draw not ready */ }
}

/**
 * Pin color expression from real list_price quantiles on current results.
 * band 0=low green, 1=mid yellow, 2=high red. Selected always black.
 * Brand gold when heatmap is off.
 */
function pinColorExpression(selectedId, heatmapOn) {
  const selected = String(selectedId ?? "");
  if (!heatmapOn) {
    return [
      "case",
      ["==", ["to-string", ["get", "id"]], selected],
      "#000000",
      "#CFB36E",
    ];
  }
  return [
    "case",
    ["==", ["to-string", ["get", "id"]], selected],
    "#000000",
    ["==", ["get", "priceBand"], 0],
    "#22c55e",
    ["==", ["get", "priceBand"], 1],
    "#eab308",
    ["==", ["get", "priceBand"], 2],
    "#ef4444",
    "#CFB36E",
  ];
}

function applyPinPaint(map, selectedId, heatmapOn) {
  try {
    map.setPaintProperty(
      "unclustered-point",
      "circle-color",
      pinColorExpression(selectedId, heatmapOn)
    );
    map.setPaintProperty("unclustered-point", "circle-radius", [
      "case",
      ["==", ["to-string", ["get", "id"]], String(selectedId ?? "")],
      11,
      8,
    ]);
  } catch { /* layer not ready */ }
}

/** Assign priceBand 0/1/2 from terciles of actual list_price values — never fabricate prices */
function priceBandsForListings(listings) {
  const prices = (listings || [])
    .map((l) => Number(l.list_price))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return { t1: 0, t2: 0 };
  const t1 = prices[Math.floor(prices.length / 3)] ?? prices[0];
  const t2 = prices[Math.floor((prices.length * 2) / 3)] ?? prices[prices.length - 1];
  return { t1, t2 };
}

function applyListings(map, listings) {
  const { t1, t2 } = priceBandsForListings(listings);
  const features = (listings || [])
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => {
      const price = Number(l.list_price);
      let priceBand = 1;
      if (Number.isFinite(price) && price > 0) {
        if (price <= t1) priceBand = 0;
        else if (price >= t2) priceBand = 2;
        else priceBand = 1;
      }
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(l.longitude), Number(l.latitude)] },
        properties: {
          id: l.id,
          priceLabel: formatPriceCompact(l.list_price),
          listPrice: Number.isFinite(price) ? price : 0,
          priceBand,
        },
      };
    });
  map.getSource("listings").setData({ type: "FeatureCollection", features });
  try {
    window.__saaMapStats = { features: features.length };
  } catch { /* noop */ }

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

/** Brand-tinted draw styles (gold + black) */
function drawStyles() {
  return [
    {
      id: "gl-draw-polygon-fill",
      type: "fill",
      filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
      paint: {
        "fill-color": "#CFB36E",
        "fill-outline-color": "#111111",
        "fill-opacity": 0.18,
      },
    },
    {
      id: "gl-draw-polygon-stroke-active",
      type: "line",
      filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#111111",
        "line-width": 2.5,
      },
    },
    {
      id: "gl-draw-polygon-and-line-vertex-active",
      type: "circle",
      filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
      paint: {
        "circle-radius": 5,
        "circle-color": "#CFB36E",
        "circle-stroke-color": "#111111",
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: "gl-draw-line",
      type: "line",
      filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#111111",
        "line-width": 2.5,
        "line-dasharray": [2, 2],
      },
    },
    {
      id: "gl-draw-point",
      type: "circle",
      filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"], ["!=", "mode", "static"]],
      paint: {
        "circle-radius": 5,
        "circle-color": "#CFB36E",
        "circle-stroke-color": "#111111",
        "circle-stroke-width": 1.5,
      },
    },
  ];
}
