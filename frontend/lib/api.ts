import { API_URL } from "./constants";
import type {
  CityEvent,
  GeoFeatureCollection,
  GlobalMetrics,
  HeatmapResponse,
  HourMetric,
  Metadata,
  HourEvaluationResponse,
  Monitoring,
  OptimizeResponse,
  PredictRequest,
  PredictResponse,
  SystemMetrics,
  TrafficLiveResponse,
  WeatherCurrent,
  ZoneError,
  ZoneReviewResponse,
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

async function tryGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

async function tryPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
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

const emptyGeo: GeoFeatureCollection = { type: "FeatureCollection", features: [] };

export const api = {
  health: () => getJSON<{ status: string }>("/health", { status: "down" }),
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
  metricsGlobal: () =>
    getJSON<GlobalMetrics>("/metrics/global", {
      MAE: 44.38,
      RMSE: 87.8,
      R2: 0.92,
      sMAPE: 16.79,
      validation: "holdout temporal días 25-31 oct (DEMO)",
    }),
  metricsByHour: () => getJSON<HourMetric[]>("/metrics/by-hour", []),
  errorsByZone: (top = 15, hora?: number) => {
    const q = new URLSearchParams({ top: String(top) });
    if (hora != null) q.set("hora", String(hora));
    return getJSON<ZoneError[]>(`/metrics/errors-by-zone?${q}`, []);
  },
  metricsHourEval: (hora: number) =>
    getJSON<HourEvaluationResponse>(`/metrics/hour/${hora}`, {
      hora,
      hour: null,
      global: { MAE: 0, RMSE: 0, R2: 0, sMAPE: 0 },
    }),
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
  predictHeatmap: (params: {
    fecha?: string;
    hora: number;
    dia_semana?: number;
    use_live_weather?: boolean;
    apply_events?: boolean;
  }) => {
    const q = new URLSearchParams();
    q.set("hora", String(params.hora));
    if (params.fecha) q.set("fecha", params.fecha);
    if (params.dia_semana != null) q.set("dia_semana", String(params.dia_semana));
    if (params.use_live_weather != null) {
      q.set("use_live_weather", String(params.use_live_weather));
    }
    if (params.apply_events != null) q.set("apply_events", String(params.apply_events));
    return getJSON<HeatmapResponse>(`/predict/heatmap?${q}`, {
      fecha: params.fecha ?? "",
      hora: params.hora,
      n_points: 0,
      points: [],
      events_active: 0,
      model_loaded: false,
    });
  },
  weatherCurrent: () =>
    getJSON<WeatherCurrent>("/weather/current", {
      temp_c: 20,
      hum_rel: 60,
      pres_mb: 1015,
      vel_viento_ms: 2,
      precip_lm2: 0,
      source: "default",
    }),
  trafficLive: () => tryGet<TrafficLiveResponse>("/traffic/live"),
  events: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const suffix = q.toString() ? `?${q}` : "";
    return getJSON<{ count: number; events: CityEvent[] }>(`/events${suffix}`, {
      count: 0,
      events: [],
    });
  },
  mapZones: () =>
    getJSON<GeoFeatureCollection>("/map/zones", emptyGeo),
  mapValenbisi: () => tryGet<GeoFeatureCollection>("/map/current-valenbisi"),
  mapSports: () => tryGet<GeoFeatureCollection>("/map/existing-sports"),
  mapHealth: () => tryGet<GeoFeatureCollection>("/map/existing-health"),
  mapTraffic: () => tryGet<GeoFeatureCollection>("/map/traffic-segments"),
  mapPopulationHexes: (facilityType: "sports" | "health") =>
    tryGet<GeoFeatureCollection>(`/map/population-hexes?facility_type=${facilityType}`),
  mapCandidatesFacilities: () => tryGet<GeoFeatureCollection>("/map/candidates-facilities"),
  mapCoveredHexes: (candidateIds: number[], facilityType: "sports" | "health") =>
    tryPost<GeoFeatureCollection>("/map/covered-hexes", {
      candidate_ids: candidateIds,
      facility_type: facilityType,
    }),
  coverageSummary: () =>
    tryGet<{
      n_candidates: number;
      n_hexes: number;
      hexes_need_sports: number;
      hexes_need_health: number;
    }>("/coverage/summary"),
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
    postJSON<OptimizeResponse>(
      "/optimize/sports",
      { ...req, facility_type: "sports" },
      {
        mode: "polideportivo",
        selected: [],
        total_score: 0,
        total_cost: 0,
        n_selected: 0,
        constraint: "API no disponible",
      },
    ),
  optimizeHealth: (req: { presupuesto: number }) =>
    postJSON<OptimizeResponse>(
      "/optimize/health",
      { ...req, facility_type: "health" },
      {
        mode: "centro_salud",
        selected: [],
        total_score: 0,
        total_cost: 0,
        n_selected: 0,
        constraint: "API no disponible",
      },
    ),
  optimizeMulti: (req: { presupuesto: number; lambda_sports: number }) =>
    postJSON<OptimizeResponse>("/optimize/multi", req, {
      mode: "multi",
      selected: [],
      total_score: 0,
      total_cost: 0,
      n_selected: 0,
      constraint: "API no disponible",
    }),
  existingSports: () =>
    getJSON<GeoFeatureCollection>("/map/existing-sports", emptyGeo),
  existingHealth: () =>
    getJSON<GeoFeatureCollection>("/map/existing-health", emptyGeo),
  trafficSegments: () =>
    getJSON<GeoFeatureCollection>("/map/traffic-segments", emptyGeo),
  currentValenbisi: () =>
    getJSON<GeoFeatureCollection>("/map/current-valenbisi", emptyGeo),
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
  zonesToReview: (hora: number, fecha?: string, applyEvents = true) => {
    const q = new URLSearchParams({
      hora: String(hora),
      apply_events: String(applyEvents),
    });
    if (fecha) q.set("fecha", fecha);
    return getJSON<ZoneReviewResponse>(`/monitoring/zones-to-review?${q}`, {
      fecha: fecha ?? "",
      hora,
      n_predicted_high: 0,
      mae_threshold: 80,
      hour_metrics: null,
      zones_high_pressure: [],
      zones_low_confidence: [],
      events_active: 0,
    });
  },
  systemMetrics: () =>
    getJSON<SystemMetrics>("/monitoring/system", { available: false }),
};
