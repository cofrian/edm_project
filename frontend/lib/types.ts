export interface GlobalMetrics {
  MAE: number;
  RMSE: number;
  R2: number;
  sMAPE: number;
  validation?: string;
  model?: string;
}

export interface HourMetric {
  Hora: number;
  MAE: number;
  RMSE: number;
  R2: number;
  sMAPE: number;
}

export interface ZoneError {
  Zona: number;
  mae: number;
}

export interface PredictRequest {
  zona: number;
  hora: number;
  dia_semana: number;
  temp_c?: number;
  hum_rel?: number;
  pres_mb?: number;
  vel_viento_ms?: number;
  vel_viento_max_ms?: number;
  dir_viento_grados?: number;
  precip_lm2?: number;
}

export interface PredictResponse {
  zona: number;
  hora: number;
  dia_semana: number;
  intensidad: number;
  baseline: number;
  nivel: "baja" | "media" | "alta";
  fiabilidad: string;
  mae_hora: number | null;
}

export interface SelectedCandidate {
  candidate_id: number;
  lat: number;
  lon: number;
  zona: number | null;
  score: number;
  cost: number;
  facility_type?: string | null;
}

export interface OptimizeResponse {
  mode: string;
  selected: SelectedCandidate[];
  total_score: number;
  total_cost: number;
  n_selected: number;
  constraint: string;
  population_covered?: number | null;
}

export interface MonitoringAlert {
  hora: number | null;
  mae: number | null;
  nivel: string;
  mensaje: string;
}

export interface Monitoring {
  model_active: string;
  data_date: string;
  validation: string;
  mae_threshold: number;
  mae_global?: number;
  alerts: MonitoringAlert[];
  mae_by_hour: { Hora: number; MAE: number }[];
  top_error_zones: ZoneError[];
}

export interface Metadata {
  project: string;
  version: string;
  model: string;
  model_loaded: boolean;
  data_date: string;
  validation: string;
}

export interface GeoJSONFeature {
  type?: "Feature";
  geometry?: {
    type: "Point" | "LineString" | "Polygon" | "MultiPolygon" | string;
    coordinates: unknown;
  } | null;
  properties?: Record<string, unknown> | null;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}
