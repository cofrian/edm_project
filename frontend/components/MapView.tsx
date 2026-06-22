"use client";

import { useEffect, useMemo } from "react";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Layer, PathOptions } from "leaflet";
import { NIVEL_COLORS, TRAFFIC_ESTADO_COLORS, VALENCIA_CENTER } from "@/lib/constants";
import type {
  EmtRoute,
  EmtStop,
  EstimatedBusPosition,
  ValenbisiStation,
} from "@/lib/types";

export interface MapPolygon {
  positions: [number, number][];
  color?: string;
  label?: string;
  fillOpacity?: number;
  weight?: number;
}

export interface MapLine {
  positions: [number, number][];
  color?: string;
  label?: string;
  opacity?: number;
  weight?: number;
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

function FlyToPoint({ target }: { target: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], 15, { duration: 0.8 });
  }, [map, target]);
  return null;
}

function busEstimateIcon(bus: EstimatedBusPosition): L.DivIcon {
  const delayed = bus.delayed ? "border:#dc2626;background:#fee2e2;color:#991b1b;" : "border:#2563eb;background:#dbeafe;color:#1e3a8a;";
  return L.divIcon({
    className: "estimated-bus-marker",
    html: `<div style="display:flex;align-items:center;gap:4px;border:2px solid;${delayed}border-radius:999px;padding:2px 7px;font-size:11px;font-weight:800;box-shadow:0 8px 24px rgba(15,23,42,.18);white-space:nowrap;">BUS ${bus.line}</div>`,
    iconSize: [74, 26],
    iconAnchor: [37, 13],
  });
}

function valenbisiColor(status: ValenbisiStation["status"], alerts: ValenbisiStation["alerts"]): string {
  if (alerts.some((alert) => alert.severity === "critical")) return "#dc2626";
  if (status === "closed") return "#64748b";
  if (status === "empty") return "#ef4444";
  if (status === "full") return "#f97316";
  if (status === "watch_event_area") return "#7c3aed";
  return "#16a34a";
}

function routePositions(route: EmtRoute): [number, number][] {
  const source = route.shape?.length ? route.shape : route.stops;
  return source.map((point) => [point.lat, point.lon]);
}

function formatShortTime(value?: string | number | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
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
  lines = [],
  heatmapPoints = [],
  trafficGeoJson = null,
  showTraffic = true,
  roadColorMode = "live",
  affectedTramoIds = [],
  eventMarkers = [],
  eventImpactZones = [],
  selectedEventId = null,
  valenbisiStations = [],
  emtStops = [],
  emtRoutes = [],
  estimatedBusPositions = [],
  selectedEmtStopId = null,
  onSelectEmtStop,
  showOnlyMobilityAlerts = false,
  center = VALENCIA_CENTER,
  zoom = 12,
  height = 460,
  scrollWheelZoom = true,
  useCircleMarker = false,
  flyTo = null,
}: {
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  lines?: MapLine[];
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
  valenbisiStations?: ValenbisiStation[];
  emtStops?: EmtStop[];
  emtRoutes?: EmtRoute[];
  estimatedBusPositions?: EstimatedBusPosition[];
  selectedEmtStopId?: number | null;
  onSelectEmtStop?: (stop: EmtStop) => void;
  showOnlyMobilityAlerts?: boolean;
  center?: [number, number];
  zoom?: number;
  height?: number;
  scrollWheelZoom?: boolean;
  useCircleMarker?: boolean;
  flyTo?: { lat: number; lon: number } | null;
}) {
  const affectedSet = useMemo(() => new Set(affectedTramoIds), [affectedTramoIds]);
  const visibleValenbisi = useMemo(
    () =>
      showOnlyMobilityAlerts
        ? valenbisiStations.filter((station) => station.alerts.length > 0)
        : valenbisiStations,
    [showOnlyMobilityAlerts, valenbisiStations],
  );
  const visibleEmtStops = useMemo(
    () => (showOnlyMobilityAlerts ? [] : emtStops),
    [showOnlyMobilityAlerts, emtStops],
  );
  const visibleBusPositions = useMemo(
    () =>
      showOnlyMobilityAlerts
        ? estimatedBusPositions.filter((bus) => bus.delayed)
        : estimatedBusPositions,
    [showOnlyMobilityAlerts, estimatedBusPositions],
  );

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

  const shellClass = heatmapPoints.length || trafficGeoJson || eventMarkers.length
    ? "overflow-hidden rounded-2xl"
    : "overflow-hidden rounded-[1.5rem] bg-white shadow-map";

  return (
    <div style={{ height }} className={shellClass}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FlyToPoint target={flyTo} />
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
        {emtRoutes.map((route) => {
          const positions = routePositions(route);
          if (positions.length < 2) return null;
          const approximate = route.source === "derived_from_stops";
          return (
            <Polyline
              key={`emt-route-${route.id}`}
              positions={positions}
              pathOptions={{
                color: route.color ?? "#2563eb",
                opacity: approximate ? 0.45 : 0.72,
                weight: approximate ? 3 : 4,
                dashArray: approximate ? "8 6" : undefined,
              }}
            >
              <Popup>
                <strong>Linea {route.line}</strong>
                <p className="text-xs">
                  {approximate ? "Ruta aproximada derivada de paradas." : "Ruta oficial."}
                </p>
              </Popup>
            </Polyline>
          );
        })}
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
        {visibleValenbisi.map((station) => {
          const color = valenbisiColor(station.status, station.alerts);
          return (
            <CircleMarker
              key={`valenbisi-live-${station.id}`}
              center={[station.lat, station.lon]}
              radius={station.alerts.length ? 8 : 6}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: color,
                fillOpacity: 0.92,
              }}
            >
              <Popup>
                <strong>{station.name}</strong>
                <p className="text-xs text-slate-500">{station.address ?? "Estacion Valenbisi"}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <p>Bicis disponibles: <b>{station.bikesAvailable}</b></p>
                  <p>Huecos libres: <b>{station.docksFree}</b> / {station.docksTotal}</p>
                  <p>Estado: <b>{station.status}</b></p>
                  <p>Actualizado: {formatShortTime(station.updatedAt)}</p>
                </div>
                {station.alerts.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {station.alerts.map((alert) => (
                      <li key={alert.id} className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">
                        {alert.title}
                      </li>
                    ))}
                  </ul>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
        {visibleEmtStops.map((stop) => {
          const selected = selectedEmtStopId === stop.stopId;
          return (
            <CircleMarker
              key={`emt-stop-${stop.stopId}`}
              center={[stop.lat, stop.lon]}
              radius={selected ? 7 : 4}
              pathOptions={{
                color: selected ? "#0f172a" : "#ffffff",
                weight: selected ? 2.5 : 1.5,
                fillColor: selected ? "#0f172a" : "#0284c7",
                fillOpacity: selected ? 0.95 : 0.72,
              }}
              eventHandlers={{
                click: () => onSelectEmtStop?.(stop),
              }}
            >
              <Popup>
                <strong>{stop.name}</strong>
                <p className="text-xs text-slate-500">Parada {stop.stopId}</p>
                <p className="text-xs">Lineas: {stop.lines.length ? stop.lines.join(", ") : "Sin lineas"}</p>
                {onSelectEmtStop && (
                  <button
                    type="button"
                    className="mt-2 rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                    onClick={() => onSelectEmtStop(stop)}
                  >
                    Ver llegadas
                  </button>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
        {visibleBusPositions.map((bus) => (
          <Marker
            key={`bus-est-${bus.id}`}
            position={[bus.estimatedLat, bus.estimatedLon]}
            icon={busEstimateIcon(bus)}
            zIndexOffset={900}
          >
            <Popup>
              <strong>Linea {bus.line}</strong>
              <p className="text-xs">
                Posicion estimada, no GPS real. Llega en {bus.minutesToTargetStop} min.
              </p>
              {bus.destination && <p className="text-xs">Destino: {bus.destination}</p>}
              <p className="text-xs">Confianza: {bus.confidence}</p>
              <p className="text-xs">Metodo: {bus.method}</p>
              {bus.delayed && (
                <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  Posible retraso
                </p>
              )}
              <p className="text-xs text-slate-500">{bus.message}</p>
            </Popup>
          </Marker>
        ))}
        {lines.map((line, i) => (
          <Polyline
            key={`line-${i}`}
            positions={line.positions}
            pathOptions={{
              color: line.color ?? "#f59e0b",
              opacity: line.opacity ?? 0.5,
              weight: line.weight ?? 2,
            }}
          >
            {line.label && <Popup>{line.label}</Popup>}
          </Polyline>
        ))}
        {polygons.map((p, i) => (
          <Polygon
            key={`poly-${i}`}
            positions={p.positions}
            pathOptions={{
              color: p.color ?? "#0fa99c",
              fillColor: p.color ?? "#0fa99c",
              fillOpacity: p.fillOpacity ?? 0.12,
              weight: p.weight ?? 1.5,
            }}
          >
            {p.label && <Popup>{p.label}</Popup>}
          </Polygon>
        ))}
        {markers.map((m, i) =>
          useCircleMarker ? (
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
          ) : (
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
          ),
        )}
      </MapContainer>
    </div>
  );
}
