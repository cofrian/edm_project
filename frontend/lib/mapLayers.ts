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
    description: "Muestra de segmentos viarios (oct-2023)",
  },
  demand: {
    label: "Demanda",
    color: "#eab308",
    description: "Población sin cobertura previa (hexágonos censales)",
  },
  candidates: {
    label: "Candidatos",
    color: "#6366f1",
    description: "131 ubicaciones posibles con coste y presión de tráfico precalculada",
  },
  covered: {
    label: "Nueva cobertura",
    color: "#22d3ee",
    description: "Hexágonos cubiertos por la propuesta optimizada",
  },
  proposed: {
    label: "Propuesta",
    color: "#a855f7",
    description: "Ubicaciones recomendadas por el optimizador",
  },
};

export const SECTOR_LAYERS: Record<string, LayerKey[]> = {
  valenbisi: ["valenbisi", "candidates", "traffic", "proposed"],
  sports: ["sports", "demand", "candidates", "covered", "proposed"],
  health: ["health", "demand", "candidates", "covered", "proposed"],
  multi: ["sports", "health", "demand", "candidates", "covered", "proposed"],
};

export const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  valenbisi: true,
  sports: false,
  health: false,
  traffic: false,
  demand: false,
  candidates: false,
  covered: true,
  proposed: true,
};

export function layersForSector(sector: string): Record<LayerKey, boolean> {
  const active = new Set(SECTOR_LAYERS[sector] ?? SECTOR_LAYERS.sports);
  return {
    valenbisi: active.has("valenbisi"),
    sports: active.has("sports"),
    health: active.has("health"),
    traffic: active.has("traffic"),
    demand: active.has("demand"),
    candidates: active.has("candidates"),
    covered: active.has("covered"),
    proposed: active.has("proposed"),
  };
}

export function demandTypeForSector(sector: string): "sports" | "health" {
  return sector === "health" ? "health" : "sports";
}
