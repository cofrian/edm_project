"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { VALENCIA_CENTER } from "@/lib/constants";

export interface MapMarker {
  lat: number;
  lon: number;
  label?: string;
  color?: string;
  radius?: number;
}

export default function MapView({
  markers = [],
  center = VALENCIA_CENTER,
  zoom = 12,
  height = 420,
}: {
  markers?: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <CircleMarker
            key={i}
            center={[m.lat, m.lon]}
            radius={m.radius ?? 7}
            pathOptions={{
              color: m.color ?? "#2563eb",
              fillColor: m.color ?? "#2563eb",
              fillOpacity: 0.7,
            }}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
