"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Layers, Loader2, Maximize2 } from "lucide-react";
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
  coveredGeo?: GeoFeatureCollection | null;
  demandType?: "sports" | "health";
  zoom?: number;
  showLayerControl?: boolean;
  showLegend?: boolean;
  basemap?: "dark" | "light" | "satellite";
  fitToProposed?: boolean;
  highlightId?: string | number | null;
  flyTo?: { lat: number; lon: number } | null;
  onMarkerSelect?: (id: string | number) => void;
  className?: string;
  fullBleed?: boolean;
}

const BASEMAPS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
};

const HIGHWAY_COLORS: Record<string, string> = {
  motorway: "#ef4444",
  trunk: "#f97316",
  primary: "#eab308",
  secondary: "#64748b",
  tertiary: "#475569",
  residential: "#334155",
  living_street: "#1e293b",
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15 });
  }, [map, points]);
  return null;
}

function FlyToPoint({ target }: { target: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], 16, { duration: 0.7 });
  }, [map, target]);
  return null;
}

function filterCollection(
  collection: GeoFeatureCollection,
  layer: LayerKey
): GeoFeatureCollection {
  const features = collection.features.filter((f) => {
    if (f.properties?.point && (layer === "sports" || layer === "health")) {
      return false;
    }
    return true;
  });
  return { ...collection, features };
}

function demandColor(weight: number, maxWeight = 15000): string {
  const t = Math.min(1, weight / maxWeight);
  const r = Math.round(234 + t * (239 - 234));
  const g = Math.round(179 - t * 120);
  const b = Math.round(8 + t * (68 - 8));
  return `rgb(${r}, ${g}, ${b})`;
}

function styleFeature(layer: LayerKey, feature?: GeoFeature): L.PathOptions {
  const color = LAYER_META[layer].color;
  const p = feature?.properties ?? {};

  if (feature?.geometry?.type === "LineString") {
    const highway = String(p.highway ?? "secondary");
    return {
      color: HIGHWAY_COLORS[highway] ?? "#475569",
      weight: highway === "motorway" || highway === "trunk" ? 2.5 : 1.2,
      opacity: 0.55,
    };
  }

  if (layer === "demand" || layer === "covered") {
    const weight = Number(p.weight ?? 1);
    const fill = layer === "covered" ? "#22d3ee" : demandColor(weight);
    const opacity = Math.min(0.75, 0.2 + weight / 18000);
    return {
      color: "rgba(255,255,255,0.15)",
      weight: 0.5,
      fillColor: fill,
      fillOpacity: opacity,
    };
  }

  if (layer === "sports" || layer === "health") {
    if (feature?.geometry?.type === "Polygon") {
      return {
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.18,
        opacity: 0.85,
      };
    }
  }

  if (feature?.geometry?.type === "Point") {
    return {
      color: "#ffffff",
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.9,
    };
  }

  return {
    color,
    weight: 1.5,
    fillColor: color,
    fillOpacity: 0.15,
    opacity: 0.75,
  };
}

function markerRadius(layer: LayerKey, feature?: GeoFeature): number {
  if (layer === "demand" || layer === "covered") {
    const w = Number(feature?.properties?.weight ?? 1000);
    return Math.max(4, Math.min(12, 4 + w / 4000));
  }
  if (layer === "candidates") {
    const score = Number(feature?.properties?.traffic_score ?? 50);
    return Math.max(4, Math.min(9, 4 + score / 25));
  }
  if (layer === "valenbisi") return 5;
  return 6;
}

function popupHtml(layer: LayerKey, feature: GeoFeature): string {
  const p = feature.properties ?? {};
  if (layer === "candidates") {
    return `<div class="map-popup"><strong>Candidato #${p.candidate_id}</strong>
      <div class="metric"><span>Tráfico</span><b>${Number(p.traffic_score ?? 0).toFixed(1)}</b></div>
      <div class="metric"><span>Población isócrona</span><b>${Number(p.population_in_isochrone ?? 0).toLocaleString("es-ES")}</b></div>
      <div class="metric"><span>Coste deporte</span><b>${p.cost_sports ?? "—"}</b></div>
      <div class="metric"><span>Coste salud</span><b>${p.cost_health ?? "—"}</b></div></div>`;
  }
  if (layer === "demand" || layer === "covered") {
    return `<div class="map-popup"><strong>Hexágono ${p.hex_id}</strong>
      <div class="metric"><span>Población</span><b>${Number(p.population ?? 0).toLocaleString("es-ES")}</b></div>
      <div class="metric"><span>Peso demanda</span><b>${Number(p.weight ?? 0).toLocaleString("es-ES")}</b></div></div>`;
  }
  if (layer === "traffic") {
    return `<div class="map-popup"><strong>${p.name ?? "Vía"}</strong>
      <span class="muted">${p.highway ?? "segmento"} · ${Math.round(Number(p.length ?? 0))} m</span></div>`;
  }
  const label = (p.name as string) ?? (p.zona != null ? `Estación zona ${p.zona}` : LAYER_META[layer].label);
  return `<div class="map-popup"><strong>${label}</strong><span class="muted">${LAYER_META[layer].label}</span></div>`;
}

function pointToLayer(layer: LayerKey, feature: GeoFeature, latlng: L.LatLng): L.Layer {
  if (layer === "valenbisi") {
    return L.marker(latlng, {
      icon: L.divIcon({
        className: "valenbisi-marker-wrap",
        html: `<div class="valenbisi-marker"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      }),
    });
  }
  if (layer === "candidates") {
    const score = Number(feature.properties?.traffic_score ?? 50);
    const size = markerRadius(layer, feature);
    return L.marker(latlng, {
      icon: L.divIcon({
        className: "candidate-marker-wrap",
        html: `<div class="candidate-marker" style="width:${size}px;height:${size}px;background:#6366f1"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    });
  }

  const style = styleFeature(layer, feature);
  return L.circleMarker(latlng, {
    radius: markerRadius(layer, feature),
    color: style.color,
    weight: style.weight ?? 1.5,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
  });
}

function proposedIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: "proposed-marker-wrap",
    html: `<div class="proposed-marker ${selected ? "proposed-marker-selected" : ""}" style="--marker-color:${color}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function LayerToggle({
  layer,
  active,
  loading,
  onToggle,
}: {
  layer: LayerKey;
  active: boolean;
  loading?: boolean;
  onToggle: (layer: LayerKey) => void;
}) {
  const meta = LAYER_META[layer];
  return (
    <button
      type="button"
      onClick={() => onToggle(layer)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${
        active
          ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-500/25"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/20"
        style={{ backgroundColor: meta.color }}
      />
      <span className="flex-1 font-medium">{meta.label}</span>
      {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
    </button>
  );
}

export default function CityMap({
  height = "100%",
  layers: layersProp,
  proposedMarkers = [],
  coveredGeo = null,
  demandType = "sports",
  zoom = 12,
  showLayerControl = true,
  showLegend = true,
  basemap = "dark",
  fitToProposed = true,
  highlightId = null,
  flyTo = null,
  onMarkerSelect,
  className = "",
  fullBleed = false,
}: CityMapProps) {
  const [layerState, setLayerState] = useState<LayerState>({
    ...DEFAULT_LAYERS,
    ...layersProp,
  });
  const [geo, setGeo] = useState<Partial<Record<LayerKey, GeoFeatureCollection>>>({});
  const [loading, setLoading] = useState<Partial<Record<LayerKey, boolean>>>({});

  useEffect(() => {
    setLayerState((prev) => ({ ...prev, ...layersProp }));
  }, [layersProp]);

  const loadLayer = useCallback(
    async (key: LayerKey) => {
      if (key === "proposed" || key === "covered") return;
      setLoading((prev) => ({ ...prev, [key]: true }));
      try {
        let data: GeoFeatureCollection = { type: "FeatureCollection", features: [] };
        let res;
        if (key === "valenbisi") res = await api.mapValenbisi();
        else if (key === "sports") res = await api.mapSports();
        else if (key === "health") res = await api.mapHealth();
        else if (key === "traffic") res = await api.mapTraffic();
        else if (key === "demand") res = await api.mapPopulationHexes(demandType);
        else if (key === "candidates") res = await api.mapCandidatesFacilities();
        if (res) data = res.ok ? res.data : data;
        setGeo((prev) => ({ ...prev, [key]: data }));
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [demandType]
  );

  useEffect(() => {
    (Object.keys(layerState) as LayerKey[]).forEach((key) => {
      if (key === "proposed" || key === "covered" || !layerState[key]) return;
      if (key === "demand" && geo.demand) return;
      if (key !== "demand" && geo[key]) return;
      void loadLayer(key);
    });
  }, [geo, layerState, loadLayer]);

  useEffect(() => {
    setGeo((prev) => {
      if (!prev.demand) return prev;
      const next = { ...prev };
      delete next.demand;
      return next;
    });
  }, [demandType]);

  const toggleLayer = (key: LayerKey) => {
    setLayerState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fitPoints = useMemo<[number, number][]>(() => {
    if (!fitToProposed || proposedMarkers.length === 0) return [];
    return proposedMarkers.map((m) => [m.lat, m.lon]);
  }, [fitToProposed, proposedMarkers]);

  const map = BASEMAPS[basemap];
  const activeLayers = (Object.keys(layerState) as LayerKey[]).filter((k) => layerState[k]);

  const renderGeoLayer = (key: LayerKey, collection: GeoFeatureCollection) => {
    const filtered = filterCollection(collection, key);
    return (
      <GeoJSON
        key={`${key}-${filtered.features.length}-${demandType}`}
        data={filtered as never}
        style={(feature) => styleFeature(key, feature as unknown as GeoFeature)}
        pointToLayer={(feature, latlng) =>
          pointToLayer(key, feature as unknown as GeoFeature, latlng)
        }
        onEachFeature={(feature, layerInstance) => {
          const f = feature as unknown as GeoFeature;
          layerInstance.bindPopup(popupHtml(key, f), { className: "city-popup" });
        }}
      />
    );
  };

  return (
    <div
      className={`relative overflow-hidden ${fullBleed ? "" : "rounded-2xl border border-white/[0.06]"} ${className}`}
      style={{ height }}
    >
      <MapContainer center={VALENCIA_CENTER} zoom={zoom} scrollWheelZoom className="city-map">
        <TileLayer attribution={map.attribution} url={map.url} />
        {fitPoints.length > 0 && <FitBounds points={fitPoints} />}
        <FlyToPoint target={flyTo} />

        {(Object.keys(layerState) as LayerKey[]).map((key) => {
          if (key === "proposed" || key === "covered" || !layerState[key]) return null;
          const collection = geo[key];
          if (!collection) return null;
          return renderGeoLayer(key, collection);
        })}

        {layerState.covered && coveredGeo && coveredGeo.features.length > 0 &&
          renderGeoLayer("covered", coveredGeo)}

        {layerState.proposed &&
          proposedMarkers.map((m, i) => {
            const id = m.id ?? `proposed-${i}`;
            const selected = highlightId != null && highlightId === id;
            return (
              <Marker
                key={id}
                position={[m.lat, m.lon]}
                icon={proposedIcon(m.color ?? LAYER_META.proposed.color, selected)}
                eventHandlers={{
                  click: () => onMarkerSelect?.(id),
                }}
              />
            );
          })}
      </MapContainer>

      {(showLayerControl || showLegend) && (
        <div className="pointer-events-none absolute inset-0 z-[500]">
          {showLayerControl && (
            <div className="pointer-events-auto absolute left-4 top-4 w-[210px] console-panel shadow-2xl">
              <div className="console-panel-header flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                  Capas
                </span>
              </div>
              <div className="max-h-[320px] space-y-0.5 overflow-y-auto scroll-thin p-2">
                {(Object.keys(LAYER_META) as LayerKey[]).map((key) => (
                  <LayerToggle
                    key={key}
                    layer={key}
                    active={layerState[key]}
                    loading={loading[key]}
                    onToggle={toggleLayer}
                  />
                ))}
              </div>
            </div>
          )}

          {showLegend && activeLayers.length > 0 && (
            <div className="pointer-events-auto absolute bottom-4 left-4 console-panel px-3 py-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Leyenda
              </p>
              <div className="space-y-1.5">
                {activeLayers.slice(0, 6).map((key) => (
                  <div key={key} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: LAYER_META[key].color }}
                    />
                    {LAYER_META[key].label}
                  </div>
                ))}
              </div>
              {(layerState.demand || layerState.covered) && (
                <div className="mt-2.5 border-t border-white/[0.06] pt-2">
                  <p className="mb-1 text-[10px] text-slate-500">Intensidad demanda</p>
                  <div
                    className="h-1.5 w-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #eab308, #ef4444)",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[10px] text-slate-500">
            <Maximize2 className="h-3 w-3" />
            Valencia · oct-2023
          </div>
        </div>
      )}
    </div>
  );
}
