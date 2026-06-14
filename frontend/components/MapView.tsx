"use client";

import {
  CircleMarker,
  MapContainer,
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
}

export default function MapView({
  markers = [],
  polygons = [],
  center = VALENCIA_CENTER,
  zoom = 12,
  height = 460,
}: {
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  center?: [number, number];
  zoom?: number;
  height?: number;
}) {
  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
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
