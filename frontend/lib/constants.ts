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

export const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/datos", label: "Datos" },
  { href: "/prediccion", label: "Predicción" },
  { href: "/evaluacion", label: "Evaluación" },
  { href: "/optimizacion", label: "Optimización" },
  { href: "/monitorizacion", label: "Monitorización" },
  { href: "/metodologia", label: "Metodología" },
];
