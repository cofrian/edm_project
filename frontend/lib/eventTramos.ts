import type { CityEvent } from "./types";

type TramoFeature = {
  type: string;
  geometry?: { type?: string; coordinates?: number[][] };
  properties?: Record<string, unknown>;
};

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6_371_000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dlat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(Math.min(1, a)));
}

function pointToLinestringM(lat: number, lon: number, coords: number[][]): number {
  if (coords.length < 2) {
    if (coords.length === 1) return haversineM(lat, lon, coords[0][1], coords[0][0]);
    return Infinity;
  }
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const plat = lat1 + t * (lat2 - lat1);
      const plon = lon1 + t * (lon2 - lon1);
      best = Math.min(best, haversineM(lat, lon, plat, plon));
    }
  }
  return best;
}

export function computeAffectedTramoIds(
  features: TramoFeature[],
  events: CityEvent[],
): Set<string> {
  const ids = new Set<string>();
  for (const ev of events) {
    for (const feat of features) {
      const props = feat.properties ?? {};
      const tid = String(props.idtramo ?? "");
      const coords = feat.geometry?.coordinates;
      if (!tid || !coords || feat.geometry?.type !== "LineString") continue;
      if (pointToLinestringM(ev.lat, ev.lon, coords) <= ev.radio_metros) {
        ids.add(tid);
      }
    }
  }
  return ids;
}
