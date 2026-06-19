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

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function postJSON<T>(path: string, body: unknown, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const api = {
  health: () => getJSON<{ status: string }>("/health", { status: "down" }),
  metadata: () =>
    getJSON<Metadata>("/metadata", {
      project: "UrbanFlow Valencia API",
      version: "1.0.0",
      model: "CatBoost por hora",
      model_loaded: false,
      data_date: "2023-10 (holdout 25-31)",
      validation: "holdout temporal: train 1-24 oct, test 25-31 oct",
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
  optimizeValenbisi: (req: unknown) =>
    postJSON<OptimizeResponse>("/optimize/valenbisi", req, {
      mode: "valenbisi",
      selected: [],
      total_score: 0,
      total_cost: 0,
      n_selected: 0,
      constraint: "API no disponible",
    }),
  optimizeCoverage: (req: unknown) =>
    postJSON<OptimizeResponse>("/optimize/coverage", req, {
      mode: "coverage",
      selected: [],
      total_score: 0,
      total_cost: 0,
      n_selected: 0,
      constraint: "API no disponible",
    }),
  optimizeSports: (req: { presupuesto: number }) =>
    postJSON<OptimizeResponse>("/optimize/sports", { ...req, facility_type: "sports" }, {
      mode: "polideportivo",
      selected: [],
      total_score: 0,
      total_cost: 0,
      n_selected: 0,
      constraint: "API no disponible",
    }),
  optimizeHealth: (req: { presupuesto: number }) =>
    postJSON<OptimizeResponse>("/optimize/health", { ...req, facility_type: "health" }, {
      mode: "centro_salud",
      selected: [],
      total_score: 0,
      total_cost: 0,
      n_selected: 0,
      constraint: "API no disponible",
    }),
  optimizeMulti: (req: { presupuesto: number; lambda_sports: number }) =>
    postJSON<OptimizeResponse>("/optimize/multi", req, {
      mode: "multi",
      selected: [],
      total_score: 0,
      total_cost: 0,
      n_selected: 0,
      constraint: "API no disponible",
    }),
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
};
