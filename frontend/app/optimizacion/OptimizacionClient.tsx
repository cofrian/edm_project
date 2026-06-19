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
import { CityMap } from "@/components/DynamicMap";
import type { GeoFeatureCollection, MapMarker, OptimizeResponse } from "@/lib/types";

type Sector = "valenbisi" | "sports" | "health" | "multi";
type ConstraintMode = "budget" | "count";

const SECTORS = [
  {
    id: "valenbisi" as const,
    title: "Valenbisi",
    subtitle: "Modo A / B",
    icon: <Bike className="h-4 w-4" />,
    color: "#f97316",
  },
  {
    id: "sports" as const,
    title: "Deporte",
    subtitle: "ILP censal",
    icon: <Dumbbell className="h-4 w-4" />,
    color: "#3b82f6",
  },
  {
    id: "health" as const,
    title: "Salud",
    subtitle: "ILP censal",
    icon: <HeartPulse className="h-4 w-4" />,
    color: "#10b981",
  },
  {
    id: "multi" as const,
    title: "Mixto",
    subtitle: "Deporte + salud",
    icon: <Blend className="h-4 w-4" />,
    color: "#a855f7",
  },
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
  const [showRanking, setShowRanking] = useState(true);
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
    <div className="flex h-[100dvh] min-h-0">
      <aside className="console-panel z-10 flex w-[340px] shrink-0 flex-col overflow-hidden rounded-none border-y-0 border-l-0">
        <div className="console-panel-header">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/80">
            Optimización
          </p>
          <h1 className="text-base font-semibold text-white">Generar propuesta</h1>
          <div className="mt-2">
            <ApiStatusBanner compact />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto scroll-thin p-4">
          {!coverageDataOk && popMode && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Artefactos censales incompletos — modo simplificado posible.
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
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
                className={`rounded-xl border px-2.5 py-2.5 text-left transition ${
                  sector === s.id
                    ? "border-cyan-500/30 bg-cyan-500/10 ring-1 ring-cyan-500/20"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                <span
                  className="mb-1.5 inline-flex rounded-lg p-1.5"
                  style={{
                    backgroundColor: `${s.color}22`,
                    color: s.color,
                  }}
                >
                  {s.icon}
                </span>
                <p className="text-xs font-semibold text-white">{s.title}</p>
                <p className="text-[10px] text-slate-500">{s.subtitle}</p>
              </button>
            ))}
          </div>

          {sector === "valenbisi" && (
            <div className="grid grid-cols-2 gap-1.5">
              <ModeChip
                active={constraint === "budget"}
                onClick={() => setConstraint("budget")}
                icon={<Coins className="h-3.5 w-3.5" />}
                label="Presupuesto"
              />
              <ModeChip
                active={constraint === "count"}
                onClick={() => setConstraint("count")}
                icon={<Target className="h-3.5 w-3.5" />}
                label="N fijo"
              />
            </div>
          )}

          {sector === "valenbisi" && constraint === "count" ? (
            <SliderField label="Estaciones" value={n}>
              <input
                type="range"
                min={1}
                max={25}
                value={n}
                onChange={(e) => setN(+e.target.value)}
                className="console-range"
              />
            </SliderField>
          ) : (
            <SliderField label="Presupuesto" value={budget}>
              <input
                type="range"
                min={20}
                max={400}
                step={10}
                value={budget}
                onChange={(e) => setBudget(+e.target.value)}
                className="console-range"
              />
            </SliderField>
          )}

          {sector === "multi" && (
            <SliderField label="Peso deporte λ" value={lambdaSports.toFixed(2)}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={lambdaSports}
                onChange={(e) => setLambdaSports(+e.target.value)}
                className="console-range"
              />
            </SliderField>
          )}

          {sector === "valenbisi" && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Pesos α·tráfico + β·población + γ·déficit
              </p>
              <WeightSlider icon={<Activity className="h-3 w-3" />} label="Tráfico" v={wTraf} set={setWTraf} />
              <WeightSlider icon={<Users className="h-3 w-3" />} label="Población" v={wPob} set={setWPob} />
              <WeightSlider icon={<Layers className="h-3 w-3" />} label="Déficit" v={wDef} set={setWDef} />
            </div>
          )}

          <button className="console-btn-primary w-full" onClick={run} disabled={loading}>
            <Play className="h-4 w-4" />
            {loading ? "Calculando…" : "Generar propuesta"}
          </button>

          <div className="grid gap-2">
            <MetricRow icon={<MapPin className="h-3.5 w-3.5" />} label="Ubicaciones" value={result?.n_selected ?? "—"} />
            <MetricRow label={impactLabel} value={impactValue} accent />
            <MetricRow label="Coste total" value={result ? result.total_cost.toFixed(1) : "—"} hint={`Medio: ${avgCost}`} />
          </div>

          {result && result.selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 print:hidden">
              <button type="button" className="console-btn-ghost flex-1" onClick={handleSaveScenario}>
                <Save className="h-3.5 w-3.5" /> Guardar
              </button>
              <button type="button" className="console-btn-ghost" onClick={() => exportProposalCsv(result)}>
                <Download className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="console-btn-ghost" onClick={() => exportProposalGeoJson(result)}>
                GeoJSON
              </button>
              <button type="button" className="console-btn-ghost" onClick={printProposalReport}>
                <Printer className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {scenarios.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Escenarios (sesión)</p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {scenarios.map((sc) => (
                  <li key={sc.id} className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-slate-300">
                    {sc.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowTech((v) => !v)}
            className="flex w-full items-center justify-between text-xs text-slate-500 hover:text-slate-300"
          >
            Detalle técnico
            {showTech ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showTech && (
            <p className="text-[11px] leading-relaxed text-slate-500">
              {popMode
                ? "ILP censal (nb. 07): maximiza población cubierta bajo presupuesto."
                : scoreMode && constraint === "count"
                  ? "Modo A (nb. 05): N estaciones fijas, score compuesto precalculado."
                  : "Modo B (nb. 06): presupuesto máximo, score compuesto."}
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {result && (
            <div className="absolute right-4 top-4 z-[600] console-panel px-3 py-2 text-xs text-slate-300">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-cyan-400" />
              {result.n_selected} recomendadas · {activeSector.title}
            </div>
          )}

          {apiError && (
            <div className="absolute left-4 top-4 z-[600] max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {apiError}
            </div>
          )}

          {!ran && !apiError && (
            <div className="absolute bottom-20 left-1/2 z-[600] -translate-x-1/2 console-panel px-4 py-2 text-xs text-slate-400">
              Ajusta sector y presupuesto, luego genera la propuesta
            </div>
          )}

          <CityMap
            height="100%"
            fullBleed
            layers={mapLayers}
            demandType={demandType}
            proposedMarkers={proposedMarkers}
            coveredGeo={coveredGeo}
            fitToProposed={proposedMarkers.length > 0}
            highlightId={highlightId}
            flyTo={flyTo}
            onMarkerSelect={(id) => setHighlightId(id)}
            showLayerControl={false}
            showLegend
          />
        </div>

        {ran && result && result.selected.length > 0 && (
          <div className="console-panel max-h-[220px] shrink-0 overflow-hidden rounded-none border-x-0 border-b-0">
            <button
              type="button"
              onClick={() => setShowRanking((v) => !v)}
              className="flex w-full items-center justify-between console-panel-header py-2.5"
            >
              <span className="text-sm font-semibold text-white">Ranking de ubicaciones</span>
              {showRanking ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
            </button>
            {showRanking && (
              <div className="overflow-x-auto scroll-thin px-4 pb-3">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wide text-slate-500">
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
                          className={`cursor-pointer border-b border-white/[0.04] last:border-0 ${
                            highlightId === rowId ? "bg-cyan-500/10" : "hover:bg-white/[0.03]"
                          }`}
                          onClick={() => {
                            setHighlightId(rowId);
                            setFlyTo({ lat: s.lat, lon: s.lon });
                          }}
                        >
                          <td className="py-2 pr-3">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-300">
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-2 pr-3 font-medium text-slate-200">#{s.candidate_id}</td>
                          <td className="py-2 pr-3 capitalize text-slate-400">
                            {(s.facility_type ?? sector).replace(/_/g, " ")}
                          </td>
                          <td className="py-2 pr-3 text-slate-400">{s.zona ?? "—"}</td>
                          <td className="py-2 pr-3 font-semibold text-teal-400">
                            {formatImpact(s.score, sector)}
                          </td>
                          <td className="py-2 text-slate-300">{s.cost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {ran && !apiError && result && result.selected.length === 0 && (
          <div className="shrink-0 border-t border-white/[0.06] bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            Sin solución viable — aumenta presupuesto o N.
          </div>
        )}
      </div>
    </div>
  );
}

function formatImpact(score: number, sector: Sector) {
  if (isPopulationMode(sector)) return `${score.toLocaleString("es-ES")} hab.`;
  return score.toFixed(3);
}

function ModeChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-semibold ${
        active
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
          : "border-white/[0.06] text-slate-400 hover:bg-white/[0.04]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SliderField({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400">{label}</label>
        <span className="rounded-lg bg-cyan-500/10 px-2 py-0.5 text-xs font-bold text-cyan-300">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}

function WeightSlider({
  icon,
  label,
  v,
  set,
}: {
  icon: React.ReactNode;
  label: string;
  v: number;
  set: (n: number) => void;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="font-semibold text-slate-300">{v.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={3}
        step={0.1}
        value={v}
        onChange={(e) => set(+e.target.value)}
        className="console-range"
      />
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="console-stat flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div>
        <p className={`text-sm font-bold ${accent ? "text-teal-400" : "text-white"}`}>{value}</p>
        {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
      </div>
    </div>
  );
}
