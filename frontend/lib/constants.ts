export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const VALENCIA_CENTER: [number, number] = [39.4699, -0.3763];

export const DIAS_SEMANA = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

export const NIVEL_COLORS: Record<string, string> = {
  baja: "#16a34a",
  media: "#d97706",
  alta: "#dc2626",
};

/** Colores oficiales del servicio de tráfico del Ayuntamiento de Valencia */
export const TRAFFIC_ESTADO_COLORS: Record<string, string> = {
  fluido: "#16a34a",
  denso: "#d97706",
  congestionado: "#ea580c",
  cortado: "#dc2626",
};

export const TRAFFIC_ESTADO_LABELS: Record<string, string> = {
  fluido: "Fluido",
  denso: "Denso",
  congestionado: "Congestionado",
  cortado: "Cortado",
};

export const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/mapa", label: "Mapa" },
  { href: "/optimizacion", label: "Optimización" },
  { href: "/datos", label: "Datos" },
  { href: "/prediccion", label: "Demanda" },
  { href: "/evaluacion", label: "Evaluación" },
  { href: "/monitorizacion", label: "Monitorización" },
  { href: "/metodologia", label: "Documentación" },
];

export const WORKSPACE_LINKS = [
  { href: "/mapa", label: "Mapa urbano" },
  { href: "/optimizacion", label: "Optimización" },
  { href: "/prediccion", label: "Demanda en vivo" },
];

export const DOC_LINKS = [
  { href: "/metodologia", label: "Documentación" },
  { href: "/datos", label: "Datos" },
  { href: "/evaluacion", label: "Evaluación" },
];
