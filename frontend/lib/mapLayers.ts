import type { LayerKey } from "./types";

export const LAYER_META: Record<
  LayerKey,
  { label: string; color: string; description: string }
> = {
  valenbisi: {
    label: "Valenbisi",
    color: "#f97316",
    description: "Estaciones actuales del servicio de bicicletas",
  },
  sports: {
    label: "Polideportivos",
    color: "#3b82f6",
    description: "Instalaciones deportivas y áreas de cobertura",
  },
  health: {
    label: "Centros de salud",
    color: "#10b981",
    description: "Centros sanitarios y zonas de influencia",
  },
  traffic: {
    label: "Red viaria",
    color: "#94a3b8",
    description: "Muestra de segmentos de tráfico urbano",
  },
  proposed: {
    label: "Propuesta",
    color: "#a855f7",
    description: "Ubicaciones recomendadas por el optimizador",
  },
};

export const SECTOR_LAYERS: Record<string, LayerKey[]> = {
  valenbisi: ["valenbisi", "traffic", "proposed"],
  sports: ["sports", "traffic", "proposed"],
  health: ["health", "traffic", "proposed"],
  multi: ["sports", "health", "traffic", "proposed"],
};

export const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  valenbisi: true,
  sports: false,
  health: false,
  traffic: false,
  proposed: true,
};

export function layersForSector(sector: string): Record<LayerKey, boolean> {
  const active = new Set(SECTOR_LAYERS[sector] ?? SECTOR_LAYERS.sports);
  return {
    valenbisi: active.has("valenbisi"),
    sports: active.has("sports"),
    health: active.has("health"),
    traffic: active.has("traffic"),
    proposed: active.has("proposed"),
  };
}
