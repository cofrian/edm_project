"use client";

import { useMemo } from "react";
import { Circle, GeoJSON, MapContainer, Polygon, Popup, TileLayer } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import { NIVEL_COLORS, TRAFFIC_ESTADO_COLORS, VALENCIA_CENTER } from "@/lib/constants";

export interface MapPolygon {
  positions: [number, number][];
  color?: string;
  label?: string;
}

export interface MapMarker {
  lat: number;
  lon: number;
  label?: string;
  color?: string;
  radius?: number;
}

export interface HeatmapPoint {
  lat: number;
  lon: number;
  zona: number;
  intensidad: number;
  nivel: string;
  descripcion?: string;
}

export type RoadColorMode = "live" | "prediction";

function nivelColor(nivel: string): string {
  return NIVEL_COLORS[nivel as keyof typeof NIVEL_COLORS] ?? "#64748b";
}

function intensidadColor(intensidad: number, max: number): string {
  const t = max > 0 ? Math.min(1, intensidad / max) : 0;
  if (t < 0.33) return NIVEL_COLORS.baja;
  if (t < 0.66) return NIVEL_COLORS.media;
  return NIVEL_COLORS.alta;
}

export default function MapView({
  markers = [],
  polygons = [],
  heatmapPoints = [],
  trafficGeoJson = null,
  showTraffic = true,
  roadColorMode = "live",
  center = VALENCIA_CENTER,
  zoom = 12,
  height = 460,
}: {
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  heatmapPoints?: HeatmapPoint[];
  trafficGeoJson?: { type: string; features: unknown[] } | null;
  showTraffic?: boolean;
  roadColorMode?: RoadColorMode;
  center?: [number, number];
  zoom?: number;
  height?: number;
}) {
  const maxIntensity = useMemo(
    () => Math.max(...heatmapPoints.map((p) => p.intensidad), 1),
    [heatmapPoints],
  );

  const zonaStyle = useMemo(() => {
    const m = new Map<number, { color: string; nivel: string; intensidad: number }>();
    for (const p of heatmapPoints) {
      m.set(p.zona, {
        color: p.nivel ? nivelColor(p.nivel) : intensidadColor(p.intensidad, maxIntensity),
        nivel: p.nivel,
        intensidad: p.intensidad,
      });
    }
    return m;
  }, [heatmapPoints, maxIntensity]);

  const trafficStyle = (feature?: {
    properties?: Record<string, unknown>;
  }): PathOptions => {
    const props = feature?.properties ?? {};
    const estadoLabel = String(props.estado_label ?? "");
    const liveColor =
      (props.color as string | undefined) ??
      TRAFFIC_ESTADO_COLORS[estadoLabel] ??
      "#94a3b8";

    if (roadColorMode === "prediction") {
      const zona = props.zona_nearest != null ? Number(props.zona_nearest) : null;
      const pred = zona != null ? zonaStyle.get(zona) : undefined;
      if (pred) {
        return {
          color: pred.color,
          weight: 5,
          opacity: 0.92,
          lineCap: "round",
          lineJoin: "round",
        };
      }
    }

    return {
      color: liveColor,
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      dashArray: estadoLabel === "cortado" ? "8 5" : undefined,
    };
  };

  const onEachTrafficFeature = (
    feature: { properties?: Record<string, unknown> },
    layer: Layer,
  ) => {
    const props = feature.properties ?? {};
    const nombre = props.denominacion ?? "Tramo";
    const estado = props.estado_label ?? "—";
    const zona = props.zona_nearest != null ? Number(props.zona_nearest) : null;
    const pred = zona != null ? zonaStyle.get(zona) : undefined;

    if (roadColorMode === "live") {
      layer.bindPopup(`
        <strong>${nombre}</strong>
        <p class="text-xs">Estado Ayto.: <b>${estado}</b></p>
        <p class="text-xs text-slate-500">Fuente: geoportal.valencia.es</p>
      `);
      return;
    }

    layer.bindPopup(`
      <strong>${nombre}</strong>
      <p class="text-xs">Tráfico Ayto.: ${estado}</p>
      ${pred ? `<p class="text-xs">Predicción zona ${zona}: ${pred.intensidad} veh/h (${pred.nivel})</p>` : "<p class=\"text-xs\">Sin zona asignada</p>"}
    `);
  };

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {showTraffic && trafficGeoJson && trafficGeoJson.features.length > 0 && (
          <GeoJSON
            key={`traffic-${roadColorMode}-${trafficGeoJson.features.length}`}
            data={trafficGeoJson as never}
            style={trafficStyle as never}
            onEachFeature={onEachTrafficFeature as never}
          />
        )}
        {polygons.map((p, i) => (
          <Polygon
            key={`poly-${i}`}
            positions={p.positions}
            pathOptions={{
              color: p.color ?? "#0fa99c",
              fillColor: p.color ?? "#0fa99c",
              fillOpacity: 0.12,
              weight: 1.5,
            }}
          >
            {p.label && <Popup>{p.label}</Popup>}
          </Polygon>
        ))}
        {markers.map((m, i) => (
          <Circle
            key={`mk-${i}`}
            center={[m.lat, m.lon]}
            radius={m.radius ?? 80}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: m.color ?? "#1d4ed8",
              fillOpacity: 0.9,
            }}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
