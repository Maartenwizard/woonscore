"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const OVERLAYS = [
  {
    id: "overstroming",
    label: "Overstroming",
    // PDOK LIWO / illustrative WMS — may 404; toggles still useful when available
    url: "https://service.pdok.nl/rws/lvk/wms/v1_0",
    layers: "overstromingsdiepte",
  },
] as const;

export function PropertyMap({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          pdok: {
            type: "raster",
            tiles: [
              "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© Kadaster / PDOK",
          },
        },
        layers: [{ id: "pdok", type: "raster", source: "pdok" }],
      },
      center: [lon, lat],
      zoom: 15,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    new maplibregl.Marker({ color: "#0f4c5c" })
      .setLngLat([lon, lat])
      .setPopup(label ? new maplibregl.Popup().setText(label) : undefined)
      .addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lon, label]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      for (const o of OVERLAYS) {
        const sourceId = `wms-${o.id}`;
        const layerId = `wms-layer-${o.id}`;
        if (overlayOn) {
          if (!map.getSource(sourceId)) {
            const tiles = [
              `${o.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=${o.layers}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&BBOX={bbox-epsg-3857}`,
            ];
            map.addSource(sourceId, { type: "raster", tiles, tileSize: 256 });
            map.addLayer({
              id: layerId,
              type: "raster",
              source: sourceId,
              paint: { "raster-opacity": 0.55 },
            });
          }
        } else {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [overlayOn]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-white px-3 py-2 text-sm">
        <span className="text-[var(--muted)]">Kaart</span>
        <label className="flex items-center gap-2 text-[var(--ink)]">
          <input
            type="checkbox"
            checked={overlayOn}
            onChange={(e) => setOverlayOn(e.target.checked)}
          />
          Overlay risico
        </label>
      </div>
      <div ref={ref} className="h-72 w-full md:h-96" />
    </div>
  );
}
