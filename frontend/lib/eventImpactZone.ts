import type { CityEvent } from "./types";
import { computeAffectedTramoIds } from "./eventTramos";

type TramoFeature = {
  type: string;
  geometry?: { type?: string; coordinates?: number[][] };
  properties?: Record<string, unknown>;
};

export interface EventImpactZone {
  eventId: string;
  nombre: string;
  tipo: string;
  nTramos: number;
  geojson: {
    type: "Feature";
    properties: { eventId: string; nombre: string; tipo: string; nTramos: number };
    geometry: {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };
  };
}

const DEG = Math.PI / 180;
const EARTH_R = 6_371_000;

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δλ = (lon2 - lon1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

function offsetM(lat: number, lon: number, bearing: number, meters: number): [number, number] {
  const δ = meters / EARTH_R;
  const θ = bearing * DEG;
  const φ1 = lat * DEG;
  const λ1 = lon * DEG;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [(φ2 / DEG), λ2 / DEG];
}

/** Corredor rectangular sobre un segmento de vía (ancho total = 2 × halfWidthM). */
function segmentCorridorRing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  halfWidthM: number,
): number[][] {
  const brng = bearingDeg(lat1, lon1, lat2, lon2);
  const left = brng - 90;
  const right = brng + 90;
  const p1L = offsetM(lat1, lon1, left, halfWidthM);
  const p1R = offsetM(lat1, lon1, right, halfWidthM);
  const p2L = offsetM(lat2, lon2, left, halfWidthM);
  const p2R = offsetM(lat2, lon2, right, halfWidthM);
  return [
    [p1L[1], p1L[0]],
    [p2L[1], p2L[0]],
    [p2R[1], p2R[0]],
    [p1R[1], p1R[0]],
    [p1L[1], p1L[0]],
  ];
}

function corridorHalfWidthM(event: CityEvent): number {
  return Math.min(50, Math.max(22, event.radio_metros * 0.14));
}

function tramoIdsForEvent(features: TramoFeature[], event: CityEvent): Set<string> {
  return computeAffectedTramoIds(features, [event]);
}

function corridorsForTramo(
  feat: TramoFeature,
  halfWidthM: number,
): number[][][][] {
  const coords = feat.geometry?.coordinates;
  if (!coords || coords.length < 2 || feat.geometry?.type !== "LineString") return [];

  const polygons: number[][][][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    polygons.push([segmentCorridorRing(lat1, lon1, lat2, lon2, halfWidthM)]);
  }
  return polygons;
}

/** Zona de impacto como corredor sobre vías reales (geometría Ayuntamiento). */
export function buildEventImpactZones(
  features: TramoFeature[] | undefined,
  events: CityEvent[],
): EventImpactZone[] {
  if (!features?.length || !events.length) return [];

  const byId = new Map<string, TramoFeature>();
  for (const f of features) {
    const tid = String(f.properties?.idtramo ?? "");
    if (tid) byId.set(tid, f);
  }

  const zones: EventImpactZone[] = [];

  for (const ev of events) {
    const ids = tramoIdsForEvent(features, ev);
    const halfW = corridorHalfWidthM(ev);
    const polygons: number[][][][] = [];

    for (const tid of ids) {
      const feat = byId.get(tid);
      if (!feat) continue;
      for (const polygon of corridorsForTramo(feat, halfW)) {
        polygons.push(polygon);
      }
    }

    if (polygons.length === 0) continue;

    zones.push({
      eventId: ev.id,
      nombre: ev.nombre,
      tipo: ev.tipo,
      nTramos: ids.size,
      geojson: {
        type: "Feature",
        properties: {
          eventId: ev.id,
          nombre: ev.nombre,
          tipo: ev.tipo,
          nTramos: ids.size,
        },
        geometry: {
          type: "MultiPolygon",
          coordinates: polygons,
        },
      },
    });
  }

  return zones;
}
