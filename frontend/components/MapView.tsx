"use client";

import { useMemo } from "react";
import L from "leaflet";
import {
  Circle,
  GeoJSON,
  MapContainer,
  Marker,
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
  id?: string;
  lat: number;
  lon: number;
  nombre: string;
  radio_metros: number;
  tipo?: string;
  imagen?: string;
  inicio?: string;
  fin?: string;
  enlace?: string;
  direccion?: string;
}

function nivelColor(nivel: string): string {
  return NIVEL_COLORS[nivel as keyof typeof NIVEL_COLORS] ?? "#64748b";
}

function intensidadColor(intensidad: number, max: number): string {
  const t = max > 0 ? Math.min(1, intensidad / max) : 0;
  if (t < 0.33) return NIVEL_COLORS.baja;
  if (t < 0.66) return NIVEL_COLORS.media;
  return NIVEL_COLORS.alta;
}

function eventIcon(ev: EventCircle) {
  const img = ev.imagen ?? "";
  const safeName = ev.nombre.replace(/"/g, "'");
  return L.divIcon({
    className: "event-marker-leaflet",
    html: `
      <div class="event-marker-pulse">
        <div class="event-marker-ring"></div>
        <img src="${img}" alt="" loading="lazy" />
      </div>
      <span class="event-marker-label">${safeName}</span>
    `,
    iconSize: [56, 72],
    iconAnchor: [28, 36],
    popupAnchor: [0, -28],
  });
}

function formatEventTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function MapView({
  markers = [],
  polygons = [],
  heatmapPoints = [],
  trafficGeoJson = null,
  eventCircles = [],
  showTraffic = false,
  showEvents = true,
  showHeatmapPoints = false,
  colorRoadsByPrediction = true,
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
  showHeatmapPoints?: boolean;
  colorRoadsByPrediction?: boolean;
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
    const zona = props.zona_nearest != null ? Number(props.zona_nearest) : null;
    const pred = zona != null ? zonaStyle.get(zona) : undefined;
    const liveColor = props.color as string | undefined;
    const estadoLabel = props.estado_label as string | undefined;

    if (colorRoadsByPrediction && pred) {
      return {
        color: pred.color,
        weight: 5,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
      };
    }

    return {
      color: liveColor ?? "#94a3b8",
      weight: 4,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
      dashArray: estadoLabel === "cortado" ? "6 4" : undefined,
    };
  };

  const onEachTrafficFeature = (
    feature: { properties?: Record<string, unknown> },
    layer: L.Layer,
  ) => {
    const props = feature.properties ?? {};
    const zona = props.zona_nearest != null ? Number(props.zona_nearest) : null;
    const pred = zona != null ? zonaStyle.get(zona) : undefined;
    const nombre = props.denominacion ?? props.Denominacion ?? "Tramo";
    const estado = props.estado_label ?? "—";
    layer.bindPopup(`
      <strong>${nombre}</strong>
      <p class="text-xs">Tráfico vivo: ${estado}</p>
      ${pred ? `<p class="text-xs">Predicción zona ${zona}: ${pred.intensidad} veh/h (${pred.nivel})</p>` : ""}
    `);
  };

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {showTraffic && trafficGeoJson && (
          <GeoJSON
            key={`traffic-${heatmapPoints.length}-${colorRoadsByPrediction}`}
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
        {showEvents &&
          eventCircles.flatMap((ev, i) => {
            const key = ev.id ?? `ev-${i}`;
            return [
              <Circle
                key={`${key}-circle`}
                center={[ev.lat, ev.lon]}
                radius={ev.radio_metros}
                pathOptions={{
                  color: "#7c3aed",
                  weight: 2,
                  fillColor: "#a78bfa",
                  fillOpacity: 0.18,
                  dashArray: "6 6",
                }}
              />,
              <Marker key={`${key}-marker`} position={[ev.lat, ev.lon]} icon={eventIcon(ev)}>
                <Popup>
                  <div className="min-w-[180px]">
                    {ev.imagen && (
                      <img
                        src={ev.imagen}
                        alt=""
                        className="mb-2 h-24 w-full rounded-lg object-cover"
                      />
                    )}
                    <strong>{ev.nombre}</strong>
                    {ev.tipo && <p className="text-xs capitalize text-slate-500">{ev.tipo}</p>}
                    {ev.inicio && (
                      <p className="text-xs text-slate-500">
                        {formatEventTime(ev.inicio)}
                        {ev.fin ? ` – ${formatEventTime(ev.fin)}` : ""}
                      </p>
                    )}
                    {ev.direccion && <p className="text-xs">{ev.direccion}</p>}
                    {ev.enlace && (
                      <a
                        href={ev.enlace}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-brand-700"
                      >
                        Más info →
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>,
            ];
          })}
        {showHeatmapPoints &&
          heatmapPoints.map((p) => (
            <Circle
              key={`hz-${p.zona}`}
              center={[p.lat, p.lon]}
              radius={120}
              pathOptions={{
                color: "#ffffff",
                weight: 1,
                fillColor: p.nivel
                  ? nivelColor(p.nivel)
                  : intensidadColor(p.intensidad, maxIntensity),
                fillOpacity: 0.35,
              }}
            >
              <Popup>
                <strong>Zona {p.zona}</strong>
                <p>{p.intensidad} veh/h</p>
                <p className="text-xs capitalize">Nivel: {p.nivel}</p>
                {p.descripcion && <p className="text-xs">{p.descripcion}</p>}
              </Popup>
            </Circle>
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
