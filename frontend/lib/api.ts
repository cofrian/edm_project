import { API_URL } from "./constants";
import type {
  GeoFeatureCollection,
  GlobalMetrics,
  HourMetric,
  Metadata,
  Monitoring,
  OptimizeResponse,
  PredictRequest,
  PredictResponse,
  ZoneError,
} from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function postStrict<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, error: `Error del servidor (${res.status})` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con la API de planificación" };
  }
}

async function postJSON<T>(path: string, body: unknown, fallback: T): Promise<T> {
  const result = await postStrict<T>(path, body);
  return result.ok ? result.data : fallback;
}

export const api = {
  health: () => getJSON<{ status: string; version?: string }>("/health", { status: "down" }),
  metadata: () =>
    getJSON<Metadata>("/metadata", {
      project: "UrbanFlow Valencia API",
      version: "1.0.0",
      model: "CatBoost por hora",
      model_loaded: false,
      coverage_data: false,
      data_date: "2023-10 (holdout 25-31)",
      validation: "holdout temporal: train 1-24 oct, test 25-31 oct",
    }),
  coverageSummary: () =>
    getJSON<{
      n_candidates: number;
      n_valenbisi_candidates: number;
      n_hexes: number;
      hexes_need_sports: number;
      hexes_need_health: number;
      population_need_sports: number;
      population_need_health: number;
    }>("/coverage/summary", {
      n_candidates: 0,
      n_valenbisi_candidates: 0,
      n_hexes: 0,
      hexes_need_sports: 0,
      hexes_need_health: 0,
      population_need_sports: 0,
      population_need_health: 0,
    }),
  metricsGlobal: () =>
    getJSON<GlobalMetrics>("/metrics/global", {
      MAE: 44.38,
      RMSE: 87.8,
      R2: 0.92,
      sMAPE: 16.79,
      validation: "holdout temporal días 25-31 oct (DEMO)",
    }),
  metricsByHour: () => getJSON<HourMetric[]>("/metrics/by-hour", []),
  errorsByZone: (top = 15) =>
    getJSON<ZoneError[]>(`/metrics/errors-by-zone?top=${top}`, []),
  scatter: (n = 500) =>
    getJSON<{ y_real: number; y_pred: number }[]>(`/evaluation/scatter?n=${n}`, []),
  predict: (req: PredictRequest) =>
    postJSON<PredictResponse>("/predict", req, {
      zona: req.zona,
      hora: req.hora,
      dia_semana: req.dia_semana,
      intensidad: 0,
      baseline: 0,
      nivel: "media",
      fiabilidad: "desconocida (API no disponible)",
      mae_hora: null,
    }),
  optimizeValenbisi: (req: unknown) => postStrict<OptimizeResponse>("/optimize/valenbisi", req),
  optimizeCoverage: (req: unknown) => postStrict<OptimizeResponse>("/optimize/coverage", req),
  optimizeSports: (req: { presupuesto: number }) =>
    postStrict<OptimizeResponse>("/optimize/sports", { ...req, facility_type: "sports" }),
  optimizeHealth: (req: { presupuesto: number }) =>
    postStrict<OptimizeResponse>("/optimize/health", { ...req, facility_type: "health" }),
  optimizeMulti: (req: { presupuesto: number; lambda_sports: number }) =>
    postStrict<OptimizeResponse>("/optimize/multi", req),
  candidatesValenbisi: () =>
    getJSON<
      {
        candidate_id: number;
        lat: number;
        lon: number;
        zona: number;
        traffic_score: number;
        population_score: number;
        valenbisi_deficit_score: number;
        cost: number;
      }[]
    >("/candidates/valenbisi", []),
  monitoring: () =>
    getJSON<Monitoring>("/monitoring/alerts", {
      model_active: "CatBoost por hora",
      data_date: "2023-10",
      validation: "holdout temporal",
      mae_threshold: 80,
      alerts: [],
      mae_by_hour: [],
      top_error_zones: [],
    }),
  mapValenbisi: () =>
    getJSON<GeoFeatureCollection>("/map/current-valenbisi", {
      type: "FeatureCollection",
      features: [],
    }),
  mapSports: () =>
    getJSON<GeoFeatureCollection>("/map/existing-sports", {
      type: "FeatureCollection",
      features: [],
    }),
  mapHealth: () =>
    getJSON<GeoFeatureCollection>("/map/existing-health", {
      type: "FeatureCollection",
      features: [],
    }),
  mapTraffic: () =>
    getJSON<GeoFeatureCollection>("/map/traffic-segments", {
      type: "FeatureCollection",
      features: [],
    }),
  mapPopulationHexes: (facilityType: "sports" | "health") =>
    getJSON<GeoFeatureCollection>(`/map/population-hexes?facility_type=${facilityType}`, {
      type: "FeatureCollection",
      features: [],
    }),
  mapCandidatesFacilities: () =>
    getJSON<GeoFeatureCollection>("/map/candidates-facilities", {
      type: "FeatureCollection",
      features: [],
    }),
  mapCoveredHexes: (candidateIds: number[], facilityType: "sports" | "health") =>
    postStrict<GeoFeatureCollection>("/map/covered-hexes", {
      candidate_ids: candidateIds,
      facility_type: facilityType,
    }),
};
