"use client";

import { useMemo } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
} from "react-leaflet";
import type { PathOptions } from "leaflet";
import { VALENCIA_CENTER, NIVEL_COLORS } from "@/lib/constants";

export interface MapMarker {
  lat: number;
  lon: number;
  label?: string;
  color?: string;
  radius?: number;
}

export interface MapPolygon {
  positions: [number, number][];
  color?: string;
  label?: string;
}

export interface HeatmapPoint {
  lat: number;
  lon: number;
  zona: number;
  intensidad: number;
  nivel: string;
  descripcion?: string;
}

export interface EventCircle {
  lat: number;
  lon: number;
  nombre: string;
  radio_metros: number;
  tipo?: string;
}

function nivelColor(nivel: string): string {
  return NIVEL_COLORS[nivel] ?? "#64748b";
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
  eventCircles = [],
  showTraffic = false,
  showEvents = true,
  center = VALENCIA_CENTER,
  zoom = 12,
  height = 460,
}: {
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  heatmapPoints?: HeatmapPoint[];
  trafficGeoJson?: { type: string; features: unknown[] } | null;
  eventCircles?: EventCircle[];
  showTraffic?: boolean;
  showEvents?: boolean;
  center?: [number, number];
  zoom?: number;
  height?: number;
}) {
  const maxIntensity = useMemo(
    () => Math.max(...heatmapPoints.map((p) => p.intensidad), 1),
    [heatmapPoints],
  );

  const trafficStyle = (feature?: { properties?: Record<string, unknown> }): PathOptions => {
    const estado = feature?.properties?.color as string | undefined;
    return {
      color: estado ?? "#94a3b8",
      weight: 4,
      opacity: 0.85,
    };
  };

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {showTraffic && trafficGeoJson && (
          <GeoJSON data={trafficGeoJson as never} style={trafficStyle as never} />
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
        {showEvents &&
          eventCircles.map((ev, i) => (
            <CircleMarker
              key={`ev-${i}`}
              center={[ev.lat, ev.lon]}
              radius={Math.min(24, 8 + ev.radio_metros / 80)}
              pathOptions={{
                color: "#7c3aed",
                weight: 2,
                fillColor: "#a78bfa",
                fillOpacity: 0.25,
                dashArray: "4 4",
              }}
            >
              <Popup>
                <strong>{ev.nombre}</strong>
                {ev.tipo && <p className="text-xs text-slate-500">{ev.tipo}</p>}
              </Popup>
            </CircleMarker>
          ))}
        {heatmapPoints.map((p) => (
          <CircleMarker
            key={`hz-${p.zona}`}
            center={[p.lat, p.lon]}
            radius={5}
            pathOptions={{
              color: "#ffffff",
              weight: 1,
              fillColor: p.nivel
                ? nivelColor(p.nivel)
                : intensidadColor(p.intensidad, maxIntensity),
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <strong>Zona {p.zona}</strong>
              <p>{p.intensidad} veh/h</p>
              <p className="text-xs capitalize">Nivel: {p.nivel}</p>
              {p.descripcion && <p className="text-xs">{p.descripcion}</p>}
            </Popup>
          </CircleMarker>
        ))}
        {markers.map((m, i) => (
          <CircleMarker
            key={`mk-${i}`}
            center={[m.lat, m.lon]}
            radius={m.radius ?? 8}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: m.color ?? "#1d4ed8",
              fillOpacity: 0.9,
            }}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
