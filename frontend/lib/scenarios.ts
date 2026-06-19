import type { OptimizeResponse } from "./types";

const STORAGE_KEY = "urbanflow_scenarios";

export interface SavedScenario {
  id: string;
  label: string;
  sector: string;
  params: Record<string, unknown>;
  result: OptimizeResponse;
  savedAt: string;
}

export function loadScenarios(): SavedScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedScenario[]) : [];
  } catch {
    return [];
  }
}

export function saveScenario(scenario: Omit<SavedScenario, "id" | "savedAt">): SavedScenario[] {
  const entry: SavedScenario = {
    ...scenario,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...loadScenarios()].slice(0, 5);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearScenarios(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
