"use client";

import {
  CircleMarker,
  MapContainer,
  Polyline,
  Polygon,
  Popup,
  TileLayer,
} from "react-leaflet";
import { VALENCIA_CENTER } from "@/lib/constants";

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

export default function MapView({
  markers = [],
  polygons = [],
  lines = [],
  center = VALENCIA_CENTER,
  zoom = 12,
  height = 460,
}: {
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  lines?: MapLine[];
  center?: [number, number];
  zoom?: number;
  height?: number;
}) {
  return (
    <div style={{ height }} className="overflow-hidden rounded-lg">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
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
