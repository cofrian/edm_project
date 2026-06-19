"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bike,
  Blend,
  ChevronDown,
  ChevronUp,
  Coins,
  Download,
  Dumbbell,
  HeartPulse,
  MapPin,
  Play,
  Save,
  Sparkles,
  Target,
  Users,
  Activity,
  Layers,
  Printer,
} from "lucide-react";
import { api, type ApiResult } from "@/lib/api";
import { demandTypeForSector, layersForSector } from "@/lib/mapLayers";
import { exportProposalCsv, exportProposalGeoJson, printProposalReport } from "@/lib/exportProposal";
import { loadScenarios, saveScenario, type SavedScenario } from "@/lib/scenarios";
import { ApiStatusBanner } from "@/components/ApiStatusBanner";
import { Card, Badge } from "@/components/Card";
import { Stat, PageHeader, Callout } from "@/components/ui";
import { CityMap } from "@/components/DynamicMap";
import type { GeoFeatureCollection, MapMarker, OptimizeResponse } from "@/lib/types";

type Sector = "valenbisi" | "sports" | "health" | "multi";
type ConstraintMode = "budget" | "count";

const SECTORS = [
  { id: "valenbisi" as const, title: "Movilidad · Valenbisi", subtitle: "Modo A (N fijo) y Modo B (presupuesto)", icon: <Bike className="h-5 w-5" />, accent: "from-orange-500 to-amber-600" },
  { id: "sports" as const, title: "Polideportivos", subtitle: "ILP censal · maximizar población cubierta", icon: <Dumbbell className="h-5 w-5" />, accent: "from-blue-500 to-indigo-600" },
  { id: "health" as const, title: "Centros de salud", subtitle: "ILP censal · cobertura sanitaria", icon: <HeartPulse className="h-5 w-5" />, accent: "from-emerald-500 to-teal-600" },
  { id: "multi" as const, title: "Plan mixto", subtitle: "Deporte + salud con un presupuesto", icon: <Blend className="h-5 w-5" />, accent: "from-violet-500 to-purple-600" },
];

const FACILITY_COLORS: Record<string, string> = {
  polideportivo: "#3b82f6",
  centro_salud: "#10b981",
  valenbisi: "#f97316",
  default: "#a855f7",
};

function isPopulationMode(sector: Sector) {
  return sector === "sports" || sector === "health" || sector === "multi";
}

function isScoreMode(sector: Sector) {
  return sector === "valenbisi";
}

export default function OptimizacionClient() {
  const searchParams = useSearchParams();
  const initialSector = (searchParams.get("sector") as Sector) || "valenbisi";

  const [sector, setSector] = useState<Sector>(
    SECTORS.some((s) => s.id === initialSector) ? initialSector : "valenbisi"
  );
  const [constraint, setConstraint] = useState<ConstraintMode>("budget");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [highlightId, setHighlightId] = useState<string | number | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number } | null>(null);
  const [coveredGeo, setCoveredGeo] = useState<GeoFeatureCollection | null>(null);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [coverageDataOk, setCoverageDataOk] = useState(true);

  const [budget, setBudget] = useState(120);
  const [n, setN] = useState(8);
  const [lambdaSports, setLambdaSports] = useState(0.5);
  const [wTraf, setWTraf] = useState(1);
  const [wPob, setWPob] = useState(1);
  const [wDef, setWDef] = useState(1);

  useEffect(() => {
    setScenarios(loadScenarios());
    api.metadata().then((m) => setCoverageDataOk(m.coverage_data ?? false));
  }, []);

  const fetchCovered = useCallback(async (res: OptimizeResponse, sec: Sector) => {
    if (!isPopulationMode(sec) || res.selected.length === 0) {
      setCoveredGeo(null);
      return;
    }
    const facilityType = sec === "health" ? "health" : "sports";
    const ids = res.selected.map((s) => s.candidate_id);
    const geoRes = await api.mapCoveredHexes(ids, facilityType);
    setCoveredGeo(geoRes.ok ? geoRes.data : null);
  }, []);

  async function run() {
    setLoading(true);
    setRan(true);
    setApiError(null);
    setHighlightId(null);
    let res: ApiResult<OptimizeResponse>;

    if (sector === "valenbisi") {
      res =
        constraint === "count"
          ? await api.optimizeValenbisi({
              n,
              alpha_trafico: wTraf,
              beta_poblacion: wPob,
              gamma_deficit: wDef,
            })
          : await api.optimizeCoverage({
              presupuesto: budget,
              alpha_poblacion: wPob,
              beta_trafico: wTraf,
              gamma_deficit: wDef,
            });
    } else if (sector === "multi") {
      res = await api.optimizeMulti({ presupuesto: budget, lambda_sports: lambdaSports });
    } else if (sector === "sports") {
      res = await api.optimizeSports({ presupuesto: budget });
    } else {
      res = await api.optimizeHealth({ presupuesto: budget });
    }

    if (!res.ok) {
      setApiError(res.error);
      setResult(null);
      setCoveredGeo(null);
      setLoading(false);
      return;
    }

    setResult(res.data);
    await fetchCovered(res.data, sector);
    setLoading(false);
  }

  function handleSaveScenario() {
    if (!result) return;
    const label = `${SECTORS.find((s) => s.id === sector)?.title} · ${result.n_selected} ubic.`;
    setScenarios(
      saveScenario({
        label,
        sector,
        params: { budget, n, constraint, lambdaSports, wTraf, wPob, wDef },
        result,
      })
    );
  }

  const proposedMarkers: MapMarker[] = useMemo(
    () =>
      result?.selected.map((s) => {
        const id = `${s.facility_type ?? sector}-${s.candidate_id}`;
        return {
          id,
          lat: s.lat,
          lon: s.lon,
          label: `#${s.candidate_id} · ${formatImpact(s.score, sector)}`,
          color: FACILITY_COLORS[s.facility_type ?? sector] ?? FACILITY_COLORS.default,
          radius: 12,
        };
      }) ?? [],
    [result, sector]
  );

  const mapLayers = useMemo(() => layersForSector(sector), [sector]);
  const demandType = demandTypeForSector(sector);
  const popMode = isPopulationMode(sector);
  const scoreMode = isScoreMode(sector);

  const impactLabel = popMode
    ? "Población cubierta"
    : constraint === "count"
      ? "Impacto (score)"
      : "Score total";

  const impactValue =
    result == null
      ? "—"
      : popMode && result.population_covered != null
        ? result.population_covered.toLocaleString("es-ES")
        : result.total_score.toFixed(3);

  const avgCost =
    result && result.n_selected > 0
      ? (result.total_cost / result.n_selected).toFixed(1)
      : "—";

  const activeSector = SECTORS.find((s) => s.id === sector)!;

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        eyebrow="Consola de planificación · Ayuntamiento de Valencia"
        title="Optimización de equipamientos urbanos"
        description="Simula escenarios con los modelos PuLP del pipeline Jupyter: Valenbisi (Modo A/B), polideportivos, salud y plan mixto. La presión de tráfico es precalculada (CatBoost oct-2023)."
      >
        <Badge color="blue">PuLP · CBC</Badge>
      </PageHeader>

      <ApiStatusBanner />

      {!coverageDataOk && popMode && (
        <Callout tone="amber" title="Modo simplificado activo">
          No se detectaron artefactos censales completos. Deporte/salud pueden estar usando el
          optimizador de score compuesto en lugar del ILP de cobertura poblacional.
        </Callout>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTORS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSector(s.id);
              setResult(null);
              setRan(false);
              setApiError(null);
              setCoveredGeo(null);
            }}
            className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
              sector === s.id
                ? "border-brand-300 bg-white shadow-card ring-2 ring-brand-200"
                : "border-slate-200 bg-white/80 hover:border-slate-300"
            }`}
          >
            {sector === s.id && (
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.accent}`} />
            )}
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${sector === s.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>
              {s.icon}
            </span>
            <p className="mt-3 font-semibold text-slate-900">{s.title}</p>
            <p className="mt-1 text-xs text-slate-500">{s.subtitle}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="!p-0 overflow-hidden">
            <div className={`bg-gradient-to-br ${activeSector.accent} p-4 text-white`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Escenario activo</p>
              <p className="mt-1 text-lg font-bold">{activeSector.title}</p>
            </div>
            <div className="space-y-5 p-5">
              {sector === "valenbisi" && (
                <div className="grid grid-cols-2 gap-2">
                  <ModeChip active={constraint === "budget"} onClick={() => setConstraint("budget")} icon={<Coins className="h-4 w-4" />} label="Presupuesto" />
                  <ModeChip active={constraint === "count"} onClick={() => setConstraint("count")} icon={<Target className="h-4 w-4" />} label="Nº fijo" />
                </div>
              )}

              {sector === "valenbisi" && constraint === "count" ? (
                <SliderField label="Estaciones a implantar" value={n} min={1} max={25}>
                  <input type="range" min={1} max={25} value={n} onChange={(e) => setN(+e.target.value)} className="range" />
                </SliderField>
              ) : (
                <SliderField label="Presupuesto (coste relativo cost1)" value={`${budget}`} hint="Unidades del dataset localizaciones2.csv">
                  <input type="range" min={20} max={400} step={10} value={budget} onChange={(e) => setBudget(+e.target.value)} className="range" />
                </SliderField>
              )}

              {sector === "multi" && (
                <SliderField label="Peso deporte (λ)" value={lambdaSports.toFixed(2)}>
                  <input type="range" min={0} max={1} step={0.05} value={lambdaSports} onChange={(e) => setLambdaSports(+e.target.value)} className="range" />
                </SliderField>
              )}

              {sector === "valenbisi" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Pesos α·tráfico + β·población + γ·déficit
                  </p>
                  <WeightSlider icon={<Activity className="h-3.5 w-3.5" />} label="Tráfico (precalc.)" v={wTraf} set={setWTraf} />
                  <WeightSlider icon={<Users className="h-3.5 w-3.5" />} label="Población" v={wPob} set={setWPob} />
                  <WeightSlider icon={<Layers className="h-3.5 w-3.5" />} label="Déficit" v={wDef} set={setWDef} />
                </div>
              )}

              <button className="btn-primary w-full" onClick={run} disabled={loading}>
                <Play className="h-4 w-4" />
                {loading ? "Calculando…" : "Generar propuesta"}
              </button>
            </div>
          </Card>

          <div className="grid gap-3">
            <Stat label="Ubicaciones" value={result?.n_selected ?? "—"} tone="brand" icon={<MapPin className="h-4 w-4" />} />
            <Stat label={impactLabel} value={impactValue} tone="teal" />
            <Stat label="Coste total" value={result ? result.total_cost.toFixed(1) : "—"} hint={`Medio: ${avgCost}`} />
          </div>

          {result && result.selected.length > 0 && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <button type="button" className="btn-secondary flex-1 text-xs" onClick={handleSaveScenario}>
                <Save className="h-3.5 w-3.5" /> Guardar escenario
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={() => exportProposalCsv(result)}>
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={() => exportProposalGeoJson(result)}>
                <Download className="h-3.5 w-3.5" /> GeoJSON
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={printProposalReport}>
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </button>
            </div>
          )}

          {scenarios.length > 0 && (
            <Card className="!p-4 print:hidden">
              <p className="text-xs font-semibold uppercase text-slate-400">Escenarios guardados (sesión)</p>
              <ul className="mt-2 space-y-2 text-sm">
                {scenarios.map((sc) => (
                  <li key={sc.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-medium text-slate-800">{sc.label}</p>
                    <p className="text-xs text-slate-500">
                      {sc.result.n_selected} ubic. ·{" "}
                      {sc.result.population_covered?.toLocaleString("es-ES") ?? sc.result.total_score.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mapa de la propuesta</h2>
              <p className="text-sm text-slate-500">Infraestructura, demanda, candidatos y cobertura nueva.</p>
            </div>
            {result && (
              <Badge color="blue">
                <Sparkles className="mr-1 h-3 w-3" />
                {result.n_selected} recomendadas
              </Badge>
            )}
          </div>

          <CityMap
            height="min(68vh, 640px)"
            layers={mapLayers}
            demandType={demandType}
            proposedMarkers={proposedMarkers}
            coveredGeo={coveredGeo}
            fitToProposed={proposedMarkers.length > 0}
            highlightId={highlightId}
            flyTo={flyTo}
            onMarkerSelect={(id) => setHighlightId(id)}
          />

          {apiError && (
            <Callout tone="amber" title="Error de conexión">{apiError}</Callout>
          )}

          {!ran && !apiError && (
            <Callout tone="brand" title="Flujo recomendado">
              Explora <strong>/mapa</strong>, elige sector y genera la propuesta. Clic en fila del ranking para centrar el mapa.
            </Callout>
          )}

          {ran && !apiError && result && result.selected.length === 0 && (
            <Callout tone="amber" title="Sin solución viable">
              Ningún candidato cumple la restricción. Aumenta presupuesto o N.
            </Callout>
          )}
        </div>
      </div>

      {ran && result && result.selected.length > 0 && (
        <Card className="print:break-inside-avoid">
          <h3 className="text-base font-bold text-slate-900">Ranking de ubicaciones</h3>
          <p className="mt-1 text-sm text-slate-500">Restricción: {result.constraint}</p>
          <div className="mt-4 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Zona</th>
                  <th className="py-2 pr-3">Impacto</th>
                  <th className="py-2">Coste</th>
                </tr>
              </thead>
              <tbody>
                {result.selected.map((s, i) => {
                  const rowId = `${s.facility_type ?? sector}-${s.candidate_id}`;
                  return (
                    <tr
                      key={rowId}
                      className={`cursor-pointer border-b border-slate-100 last:border-0 ${highlightId === rowId ? "bg-brand-50" : "hover:bg-slate-50"}`}
                      onClick={() => {
                        setHighlightId(rowId);
                        setFlyTo({ lat: s.lat, lon: s.lon });
                      }}
                    >
                      <td className="py-2.5 pr-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span></td>
                      <td className="py-2.5 pr-3 font-medium">#{s.candidate_id}</td>
                      <td className="py-2.5 pr-3 capitalize">{(s.facility_type ?? sector).replace(/_/g, " ")}</td>
                      <td className="py-2.5 pr-3">{s.zona ?? "—"}</td>
                      <td className="py-2.5 pr-3 font-semibold text-teal-600">{formatImpact(s.score, sector)}</td>
                      <td className="py-2.5">{s.cost}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden print:hidden">
        <button type="button" onClick={() => setShowTech((v) => !v)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
          <span className="font-semibold text-slate-900">Detalle técnico (notebooks 05–06)</span>
          {showTech ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
        </button>
        {showTech && (
          <div className="border-t border-slate-200 px-5 pb-5 pt-4 text-sm text-slate-600">
            {popMode ? (
              <p>ILP censal: max Σ pⱼ Yⱼ con restricciones de cobertura y presupuesto.</p>
            ) : scoreMode && constraint === "count" ? (
              <p>Modo A (nb. 05): max Σ score·x, Σ x = N. Tráfico precalculado por CatBoost oct-2023.</p>
            ) : (
              <p>Modo B (nb. 06): max Σ score·x, Σ coste·x ≤ presupuesto.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function formatImpact(score: number, sector: Sector) {
  if (isPopulationMode(sector)) return `${score.toLocaleString("es-ES")} hab.`;
  return score.toFixed(3);
}

function ModeChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${active ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
      {icon}{label}
    </button>
  );
}

function SliderField({ label, value, min, max, hint, children }: { label: string; value: React.ReactNode; min?: number; max?: number; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">{value}</span>
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {min != null && max != null && (
        <div className="mt-1 flex justify-between text-xs text-slate-400"><span>{min}</span><span>{max}</span></div>
      )}
    </div>
  );
}

function WeightSlider({ icon, label, v, set }: { icon: React.ReactNode; label: string; v: number; set: (n: number) => void }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="font-semibold">{v.toFixed(1)}</span>
      </div>
      <input type="range" min={0} max={3} step={0.1} value={v} onChange={(e) => set(+e.target.value)} className="range" />
    </div>
  );
}
