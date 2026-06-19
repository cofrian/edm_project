"use client";

import { useMemo } from "react";
import { Circle, GeoJSON, MapContainer, Marker, Polygon, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
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

export interface MapEventMarker {
  id: string;
  nombre: string;
  tipo: string;
  lat: number;
  lon: number;
  radio_metros: number;
  inicio?: string;
  fin?: string;
  direccion?: string;
}

function eventMarkerIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "event-marker-leaflet",
    html: `<div class="event-marker-pulse">
      <span class="event-marker-ring"></span>
      <div class="event-marker-icon${selected ? " event-marker-icon-selected" : ""}" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
      </div>
    </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function formatEventTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
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

function formatVhTooltip(props: Record<string, unknown>, nombre: string, estado: string): string {
  const vh = props.intensidad_vh;
  const vhLine =
    vh != null && vh !== ""
      ? `<strong>${vh} veh/h</strong> (Ayto. capa 188)`
      : "<span>Sin lectura en vivo</span>";
  return `<div class="text-sm"><strong>${nombre}</strong><br/>Estado: ${estado}<br/>${vhLine}</div>`;
}

export default function MapView({
  markers = [],
  polygons = [],
  heatmapPoints = [],
  trafficGeoJson = null,
  showTraffic = true,
  roadColorMode = "live",
  affectedTramoIds = [],
  eventMarkers = [],
  eventImpactZones = [],
  selectedEventId = null,
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
  affectedTramoIds?: string[];
  eventMarkers?: MapEventMarker[];
  eventImpactZones?: Array<{
    eventId: string;
    nombre: string;
    geojson: { type: string; properties: Record<string, unknown>; geometry: object };
  }>;
  selectedEventId?: string | null;
  center?: [number, number];
  zoom?: number;
  height?: number;
}) {
  const affectedSet = useMemo(() => new Set(affectedTramoIds), [affectedTramoIds]);

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
    const idtramo = String(props.idtramo ?? "");
    const isAffected = affectedSet.has(idtramo);
    const estadoLabel = String(props.estado_label ?? "");
    const liveColor =
      (props.color as string | undefined) ??
      TRAFFIC_ESTADO_COLORS[estadoLabel] ??
      "#94a3b8";

    if (roadColorMode === "prediction") {
      const zona = props.zona_nearest != null ? Number(props.zona_nearest) : null;
      const pred = zona != null ? zonaStyle.get(zona) : undefined;
      const baseColor = pred?.color ?? "#94a3b8";
      return {
        color: isAffected ? "#7c3aed" : baseColor,
        weight: isAffected ? 7 : 5,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
      };
    }

    return {
      color: isAffected ? "#7c3aed" : liveColor,
      weight: isAffected ? 7 : 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      dashArray: !isAffected && estadoLabel === "cortado" ? "8 5" : undefined,
    };
  };

  const onEachTrafficFeature = (
    feature: { properties?: Record<string, unknown> },
    layer: Layer,
  ) => {
    const props = feature.properties ?? {};
    const nombre = String(props.denominacion ?? "Tramo");
    const estado = String(props.estado_label ?? "—");
    const zona = props.zona_nearest != null ? Number(props.zona_nearest) : null;
    const pred = zona != null ? zonaStyle.get(zona) : undefined;
    const vh = props.intensidad_vh;

    if (roadColorMode === "live") {
      const tooltip = formatVhTooltip(props, nombre, estado);
      layer.bindTooltip(tooltip, { sticky: true, opacity: 0.95 });
      const vhText =
        vh != null && vh !== ""
          ? `<p class="text-xs"><b>${vh} veh/h</b> (Ayuntamiento)</p>`
          : `<p class="text-xs text-slate-500">Sin lectura veh/h en vivo</p>`;
      layer.bindPopup(`
        <strong>${nombre}</strong>
        <p class="text-xs">Estado: <b>${estado}</b></p>
        ${vhText}
        <p class="text-xs text-slate-400">geoportal.valencia.es</p>
      `);
      return;
    }

    const predLine = pred
      ? `<p class="text-xs">Predicción zona ${zona}: ${pred.intensidad} veh/h (${pred.nivel})</p>`
      : `<p class="text-xs">Sin zona asignada</p>`;
    layer.bindTooltip(
      `<strong>${nombre}</strong><br/>${pred ? `${pred.intensidad} veh/h · ${pred.nivel}` : "Sin predicción"}`,
      { sticky: true },
    );
    layer.bindPopup(`
      <strong>${nombre}</strong>
      ${predLine}
      <p class="text-xs text-slate-500">Modo predicción CatBoost</p>
    `);
  };

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {eventImpactZones.map((zone) => {
          const selected = selectedEventId === zone.eventId;
          return (
            <GeoJSON
              key={`ev-corridor-${zone.eventId}`}
              data={zone.geojson as never}
              style={{
                color: selected ? "#5b21b6" : "#7c3aed",
                weight: selected ? 2.5 : 1.5,
                fillColor: "#7c3aed",
                fillOpacity: selected ? 0.28 : 0.2,
              }}
              onEachFeature={(_feature, layer) => {
                layer.bindPopup(`
                  <strong>${zone.nombre}</strong>
                  <p class="text-xs capitalize text-violet-700">${String(zone.geojson.properties?.tipo ?? "")}</p>
                  <p class="text-xs">Corredor sobre <b>${zone.geojson.properties?.nTramos ?? 0}</b> tramos de vía</p>
                  <p class="text-xs text-slate-500">Geometría real Ayuntamiento · no es un radio circular</p>
                `);
              }}
            />
          );
        })}
        {showTraffic && trafficGeoJson && trafficGeoJson.features.length > 0 && (
          <GeoJSON
            key={`traffic-${roadColorMode}-${trafficGeoJson.features.length}-${affectedTramoIds.length}`}
            data={trafficGeoJson as never}
            style={trafficStyle as never}
            onEachFeature={onEachTrafficFeature as never}
          />
        )}
        {eventMarkers.map((ev) => {
          const selected = selectedEventId === ev.id;
          return (
            <Marker
              key={`ev-pin-${ev.id}`}
              position={[ev.lat, ev.lon]}
              icon={eventMarkerIcon(selected)}
              zIndexOffset={selected ? 1000 : 500}
            >
              <Popup>
                <strong>{ev.nombre}</strong>
                <p className="text-xs capitalize text-violet-700">{ev.tipo}</p>
                <p className="text-xs">
                  Ubicación del evento · impacto sobre vías cercanas
                </p>
                {(ev.inicio || ev.fin) && (
                  <p className="text-xs text-slate-500">
                    {formatEventTime(ev.inicio)} – {formatEventTime(ev.fin)}
                  </p>
                )}
                {ev.direccion && <p className="text-xs text-slate-400">{ev.direccion}</p>}
              </Popup>
            </Marker>
          );
        })}
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
