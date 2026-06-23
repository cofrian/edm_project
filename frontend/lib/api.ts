import { API_URL } from "./constants";
import type {
  CityEvent,
  EmtArrivalsResponse,
  EmtRoutesResponse,
  EmtStopsResponse,
  GeoFeatureCollection,
  GlobalMetrics,
  HeatmapResponse,
  HourMetric,
  Metadata,
  HourEvaluationResponse,
  Monitoring,
  MobilityAlertsResponse,
  OptimizeResponse,
  PredictRequest,
  PredictResponse,
  SystemMetrics,
  TrafficLiveResponse,
  ValenbisiStationsResponse,
  WeatherCurrent,
  ZoneError,
  ZoneReviewResponse,
} from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ApiOptions = { signal?: AbortSignal };

function isAbortError(e: unknown): boolean {
  return (
    e instanceof DOMException && e.name === "AbortError"
  ) || (
    e instanceof Error && e.name === "AbortError"
  );
}

async function getJSON<T>(path: string, fallback: T, options?: ApiOptions): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      signal: options?.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (isAbortError(e)) throw e;
    return fallback;
  }
}

async function tryGet<T>(path: string, options?: ApiOptions): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      signal: options?.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    if (isAbortError(e)) throw e;
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

async function tryPost<T>(path: string, body: unknown, options?: ApiOptions): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    if (isAbortError(e)) throw e;
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

async function postJSON<T>(path: string, body: unknown, fallback: T, options?: ApiOptions): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (isAbortError(e)) throw e;
    return fallback;
  }
}

const emptyGeo: GeoFeatureCollection = { type: "FeatureCollection", features: [] };
const emptyValenbisiRealtime: ValenbisiStationsResponse = {
  stations: [],
  alerts: [],
  source: "unavailable",
  sourceLabel: "Ayuntamiento de Valencia · geoportal.valencia.es",
  sourceUrl: "",
  fetchedAt: "",
  updatedTtlSeconds: 180,
  stale: true,
};
const emptyEmtStops: EmtStopsResponse = {
  stops: [],
  source: "unavailable",
  sourceLabel: "Ayuntamiento de Valencia · geoportal.valencia.es",
  sourceUrl: "",
  fetchedAt: "",
  updatedTtlSeconds: 21600,
  stale: true,
};
const emptyEmtArrivals = (stopId: number): EmtArrivalsResponse => ({
  stopId,
  stopName: `Parada ${stopId}`,
  arrivals: [],
  snapshots: [],
  alerts: [],
  estimatedPositions: [],
  routes: [],
  source: "unavailable",
  sourceLabel: "EMT Valencia SAE",
  sourceUrl: "",
  fetchedAt: "",
  updatedTtlSeconds: 45,
  stale: true,
});
const emptyEmtRoutes: EmtRoutesResponse = {
  routes: [],
  source: "unavailable",
  sourceLabel: "Paradas EMT Geoportal",
  sourceUrl: "",
  fetchedAt: "",
  updatedTtlSeconds: 21600,
  stale: true,
};

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
  errorsByZone: (top = 15, hora?: number, options?: ApiOptions) => {
    const q = new URLSearchParams({ top: String(top) });
    if (hora != null) q.set("hora", String(hora));
    return getJSON<ZoneError[]>(`/metrics/errors-by-zone?${q}`, [], options);
  },
  metricsHourEval: (hora: number, options?: ApiOptions) =>
    getJSON<HourEvaluationResponse>(`/metrics/hour/${hora}`, {
      hora,
      hour: null,
      global: { MAE: 0, RMSE: 0, R2: 0, sMAPE: 0 },
    }, options),
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
    temp_c?: number;
    hum_rel?: number;
    pres_mb?: number;
    vel_viento_ms?: number;
    precip_lm2?: number;
  }, options?: ApiOptions) => {
    const q = new URLSearchParams();
    q.set("hora", String(params.hora));
    if (params.fecha) q.set("fecha", params.fecha);
    if (params.dia_semana != null) q.set("dia_semana", String(params.dia_semana));
    if (params.use_live_weather != null) {
      q.set("use_live_weather", String(params.use_live_weather));
    }
    if (params.apply_events != null) q.set("apply_events", String(params.apply_events));
    if (params.temp_c != null) q.set("temp_c", String(params.temp_c));
    if (params.hum_rel != null) q.set("hum_rel", String(params.hum_rel));
    if (params.pres_mb != null) q.set("pres_mb", String(params.pres_mb));
    if (params.vel_viento_ms != null) q.set("vel_viento_ms", String(params.vel_viento_ms));
    if (params.precip_lm2 != null) q.set("precip_lm2", String(params.precip_lm2));
    return getJSON<HeatmapResponse>(`/predict/heatmap?${q}`, {
      fecha: params.fecha ?? "",
      hora: params.hora,
      n_points: 0,
      points: [],
      events_active: 0,
      model_loaded: false,
    }, options);
  },
  weatherCurrent: (options?: ApiOptions) =>
    getJSON<WeatherCurrent>("/weather/current", {
      temp_c: 20,
      hum_rel: 60,
      pres_mb: 1015,
      vel_viento_ms: 2,
      precip_lm2: 0,
      source: "default",
    }, options),
  weatherForecast: (fecha: string, options?: ApiOptions) =>
    getJSON<WeatherCurrent[]>(`/weather/forecast?fecha=${fecha}`, [], options)
      .then((res) => (Array.isArray(res) ? res : (res as { hours?: WeatherCurrent[] }).hours ?? [])),
  trafficLive: (options?: ApiOptions) => tryGet<TrafficLiveResponse>("/traffic/live", options),
  mobilityValenbisiStations: (options?: ApiOptions) =>
    getJSON<ValenbisiStationsResponse>(
      "/api/mobility/valenbisi/stations",
      emptyValenbisiRealtime,
      options,
    ),
  mobilityEmtStops: (options?: ApiOptions) =>
    getJSON<EmtStopsResponse>("/api/mobility/emt/stops", emptyEmtStops, options),
  mobilityEmtArrivals: (stopId: number, lineId?: string, options?: ApiOptions) => {
    const q = new URLSearchParams();
    if (lineId) q.set("lineId", lineId);
    const suffix = q.toString() ? `?${q}` : "";
    return getJSON<EmtArrivalsResponse>(
      `/api/mobility/emt/stops/${stopId}/arrivals${suffix}`,
      emptyEmtArrivals(stopId),
      options,
    );
  },
  mobilityEmtRoutes: (line?: string, options?: ApiOptions) => {
    const q = new URLSearchParams();
    if (line) q.set("line", line);
    const suffix = q.toString() ? `?${q}` : "";
    return getJSON<EmtRoutesResponse>(`/api/mobility/emt/routes${suffix}`, emptyEmtRoutes, options);
  },
  mobilityAlerts: (options?: ApiOptions) =>
    getJSON<MobilityAlertsResponse>(
      "/api/mobility/alerts",
      { alerts: [], counts: { critical: 0, warning: 0, info: 0 }, fetchedAt: "" },
      options,
    ),
  events: (from?: string, to?: string, options?: ApiOptions) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const suffix = q.toString() ? `?${q}` : "";
    return getJSON<{ count: number; events: CityEvent[] }>(`/events${suffix}`, {
      count: 0,
      events: [],
    }, options);
  },
  mapZones: () =>
    getJSON<GeoFeatureCollection>("/map/zones", emptyGeo),
  mapValenbisi: () => tryGet<GeoFeatureCollection>("/map/current-valenbisi"),
  mapSports: () => tryGet<GeoFeatureCollection>("/map/existing-sports"),
  mapHealth: () => tryGet<GeoFeatureCollection>("/map/existing-health"),
  mapTraffic: () => tryGet<GeoFeatureCollection>("/map/traffic-segments"),
  mapPopulationHexes: (facilityType: "sports" | "health", includeAll = true) =>
    tryGet<GeoFeatureCollection>(
      `/map/population-hexes?facility_type=${facilityType}&include_all=${includeAll}`,
    ),
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
  monitoring: (options?: ApiOptions) =>
    getJSON<Monitoring>("/monitoring/alerts", {
      model_active: "CatBoost por hora",
      data_date: "2023-10",
      validation: "holdout temporal",
      mae_threshold: 80,
      alerts: [],
      mae_by_hour: [],
      top_error_zones: [],
    }, options),
  zonesToReview: (hora: number, fecha?: string, applyEvents = true, options?: ApiOptions) => {
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
    }, options);
  },
  systemMetrics: (options?: ApiOptions) =>
    getJSON<SystemMetrics>("/monitoring/system", { available: false }, options),
};
