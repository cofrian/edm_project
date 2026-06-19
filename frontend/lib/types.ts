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
  coverage_data?: boolean;
  data_date: string;
  validation: string;
}

export type LayerKey =
  | "valenbisi"
  | "sports"
  | "health"
  | "traffic"
  | "demand"
  | "candidates"
  | "covered"
  | "proposed";

export interface MapMarker {
  id?: string | number;
  lat: number;
  lon: number;
  label?: string;
  color?: string;
  radius?: number;
}

export interface GeoFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties?: Record<string, unknown>;
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

export interface WeatherCurrent {
  temp_c: number;
  hum_rel: number;
  pres_mb: number;
  vel_viento_ms: number;
  vel_viento_max_ms?: number;
  dir_viento_grados?: number;
  precip_lm2: number;
  source?: string;
  timestamp?: string;
  note?: string;
}

export interface CityEvent {
  id: string;
  nombre: string;
  tipo: string;
  inicio: string;
  fin: string;
  lat: number;
  lon: number;
  direccion?: string;
  radio_metros: number;
  factor_max: number;
  fuente?: string;
  enlace?: string;
  imagen?: string;
}

export interface HeatmapPoint {
  zona: number;
  lat: number;
  lon: number;
  intensidad: number;
  baseline: number;
  nivel: "baja" | "media" | "alta";
  descripcion?: string;
}

export interface HeatmapResponse {
  fecha: string;
  hora: number;
  n_points: number;
  points: HeatmapPoint[];
  events_active: number;
  model_loaded: boolean;
  weather?: Record<string, number>;
}

export interface TrafficLiveResponse {
  type: string;
  features: Array<{
    type: string;
    geometry: object;
    properties: Record<string, unknown>;
  }>;
  source?: string;
  source_label?: string;
  source_url?: string;
  fetched_at?: string;
  updated_ttl_seconds?: number;
  stats?: Record<string, number>;
  n_tramos?: number;
}
