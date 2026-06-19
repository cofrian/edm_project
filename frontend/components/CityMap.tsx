"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Layers, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { VALENCIA_CENTER } from "@/lib/constants";
import { DEFAULT_LAYERS, LAYER_META } from "@/lib/mapLayers";
import type { GeoFeature, GeoFeatureCollection, LayerKey, MapMarker } from "@/lib/types";

export type { MapMarker };

type LayerState = Record<LayerKey, boolean>;

interface CityMapProps {
  height?: number | string;
  layers?: Partial<LayerState>;
  proposedMarkers?: MapMarker[];
  zoom?: number;
  showLayerControl?: boolean;
  basemap?: "dark" | "light";
  fitToProposed?: boolean;
}

const BASEMAPS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; <a href="https://carto.com/">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; <a href="https://carto.com/">CARTO</a>',
  },
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, points]);

  return null;
}

function styleFeature(layer: LayerKey, feature?: GeoFeature): L.PathOptions {
  const color = LAYER_META[layer].color;

  if (feature?.geometry?.type === "LineString") {
    return {
      color: "#64748b",
      weight: 1.2,
      opacity: 0.35,
    };
  }

  if (feature?.geometry?.type === "Point" || feature?.properties?.point) {
    return {
      color: "#ffffff",
      weight: 1.5,
      fillColor: color,
      fillOpacity: feature?.properties?.point ? 0.95 : 0.85,
    };
  }

  return {
    color,
    weight: 1.5,
    fillColor: color,
    fillOpacity: 0.12,
    opacity: 0.7,
  };
}

function markerRadius(layer: LayerKey, feature?: GeoFeature): number {
  if (feature?.properties?.point) return 6;
  if (layer === "valenbisi") return 4;
  return 6;
}

function featureLabel(feature: GeoFeature): string {
  const props = feature.properties ?? {};
  const name = props.name as string | undefined;
  const type = props.type as string | undefined;
  const zona = props.zona as number | string | undefined;
  if (name) return name;
  if (zona != null) return `Zona ${zona}`;
  if (type) return type.replace(/_/g, " ");
  return "Elemento urbano";
}

function pointToLayer(
  layer: LayerKey,
  feature: GeoFeature,
  latlng: L.LatLng
): L.Layer {
  const style = styleFeature(layer, feature);
  return L.circleMarker(latlng, {
    radius: markerRadius(layer, feature),
    color: style.color,
    weight: style.weight,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
  });
}

function LayerToggle({
  layer,
  active,
  onToggle,
}: {
  layer: LayerKey;
  active: boolean;
  onToggle: (layer: LayerKey) => void;
}) {
  const meta = LAYER_META[layer];
  return (
    <button
      type="button"
      onClick={() => onToggle(layer)}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
        active
          ? "bg-white/10 text-white ring-1 ring-white/20"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/30"
        style={{ backgroundColor: meta.color }}
      />
      <span className="font-medium">{meta.label}</span>
    </button>
  );
}

export default function CityMap({
  height = 520,
  layers: layersProp,
  proposedMarkers = [],
  zoom = 12,
  showLayerControl = true,
  basemap = "dark",
  fitToProposed = true,
}: CityMapProps) {
  const [layerState, setLayerState] = useState<LayerState>({
    ...DEFAULT_LAYERS,
    ...layersProp,
  });
  const [geo, setGeo] = useState<Partial<Record<LayerKey, GeoFeatureCollection>>>(
    {}
  );
  const [loading, setLoading] = useState<Partial<Record<LayerKey, boolean>>>({});

  useEffect(() => {
    setLayerState((prev) => ({ ...prev, ...layersProp }));
  }, [layersProp]);

  const loadLayer = useCallback(async (key: LayerKey) => {
    if (key === "proposed") return;
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      let data: GeoFeatureCollection = { type: "FeatureCollection", features: [] };
      if (key === "valenbisi") data = await api.mapValenbisi();
      if (key === "sports") data = await api.mapSports();
      if (key === "health") data = await api.mapHealth();
      if (key === "traffic") data = await api.mapTraffic();
      setGeo((prev) => ({ ...prev, [key]: data }));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  useEffect(() => {
    (Object.keys(layerState) as LayerKey[]).forEach((key) => {
      if (key !== "proposed" && layerState[key] && !geo[key]) {
        void loadLayer(key);
      }
    });
  }, [geo, layerState, loadLayer]);

  const toggleLayer = (key: LayerKey) => {
    setLayerState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fitPoints = useMemo<[number, number][]>(() => {
    if (!fitToProposed || proposedMarkers.length === 0) return [];
    return proposedMarkers.map((m) => [m.lat, m.lon]);
  }, [fitToProposed, proposedMarkers]);

  const map = BASEMAPS[basemap];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-800/80 shadow-2xl shadow-slate-900/20"
      style={{ height }}
    >
      <MapContainer
        center={VALENCIA_CENTER}
        zoom={zoom}
        scrollWheelZoom
        className="city-map"
      >
        <TileLayer attribution={map.attribution} url={map.url} />

        {fitPoints.length > 0 && <FitBounds points={fitPoints} />}

        {(Object.keys(layerState) as LayerKey[]).map((key) => {
          if (key === "proposed" || !layerState[key] || !geo[key]) return null;
          const collection = geo[key]!;
          return (
            <GeoJSON
              key={`${key}-${collection.features.length}`}
              data={collection as never}
              style={(feature) =>
                styleFeature(key, feature as unknown as GeoFeature)
              }
              pointToLayer={(feature, latlng) =>
                pointToLayer(key, feature as unknown as GeoFeature, latlng)
              }
              onEachFeature={(feature, layerInstance) => {
                const label = featureLabel(feature as unknown as GeoFeature);
                layerInstance.bindPopup(
                  `<div class="map-popup"><strong>${label}</strong><br/><span>${LAYER_META[key].label}</span></div>`
                );
              }}
            />
          );
        })}

        {layerState.proposed &&
          proposedMarkers.map((m, i) => (
            <CircleMarker
              key={m.id ?? `proposed-${i}`}
              center={[m.lat, m.lon]}
              radius={m.radius ?? 11}
              pathOptions={{
                color: "#ffffff",
                weight: 3,
                fillColor: m.color ?? LAYER_META.proposed.color,
                fillOpacity: 0.95,
              }}
            >
              {m.label && (
                <Popup>
                  <div className="map-popup">
                    <strong>{m.label}</strong>
                  </div>
                </Popup>
              )}
            </CircleMarker>
          ))}
      </MapContainer>

      {showLayerControl && (
        <div className="pointer-events-none absolute inset-0 z-[500]">
          <div className="pointer-events-auto absolute left-3 top-3 max-w-[220px] rounded-xl border border-white/10 bg-slate-950/80 p-3 text-white backdrop-blur-md">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              <Layers className="h-3.5 w-3.5" />
              Capas urbanas
            </div>
            <div className="space-y-1">
              {(Object.keys(LAYER_META) as LayerKey[]).map((key) => (
                <div key={key} className="relative">
                  <LayerToggle
                    layer={key}
                    active={layerState[key]}
                    onToggle={toggleLayer}
                  />
                  {loading[key] && (
                    <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-slate-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-3 right-3 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-md">
            Valencia · datos reales del curso SMARTCITIES
          </div>
        </div>
      )}
    </div>
  );
}
