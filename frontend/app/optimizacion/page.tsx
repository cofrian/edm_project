"use client";

import { useMemo, useState } from "react";
import {
  Bike,
  Blend,
  ChevronDown,
  ChevronUp,
  Coins,
  Dumbbell,
  HeartPulse,
  MapPin,
  Play,
  Sparkles,
  Target,
  Users,
  Activity,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { layersForSector } from "@/lib/mapLayers";
import { Card, Badge } from "@/components/Card";
import { Stat, PageHeader, Callout } from "@/components/ui";
import { CityMap } from "@/components/DynamicMap";
import type { MapMarker, OptimizeResponse } from "@/lib/types";

type Sector = "valenbisi" | "sports" | "health" | "multi";
type ConstraintMode = "budget" | "count";

const SECTORS: {
  id: Sector;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    id: "valenbisi",
    title: "Movilidad · Valenbisi",
    subtitle: "Nuevas estaciones bajo presupuesto o cupo fijo",
    icon: <Bike className="h-5 w-5" />,
    accent: "from-orange-500 to-amber-600",
  },
  {
    id: "sports",
    title: "Polideportivos",
    subtitle: "Maximizar población cubierta sin duplicar servicio",
    icon: <Dumbbell className="h-5 w-5" />,
    accent: "from-blue-500 to-indigo-600",
  },
  {
    id: "health",
    title: "Centros de salud",
    subtitle: "Cobertura sanitaria con isócronas reales",
    icon: <HeartPulse className="h-5 w-5" />,
    accent: "from-emerald-500 to-teal-600",
  },
  {
    id: "multi",
    title: "Plan mixto",
    subtitle: "Equilibrio deporte + salud con un solo presupuesto",
    icon: <Blend className="h-5 w-5" />,
    accent: "from-violet-500 to-purple-600",
  },
];

const FACILITY_COLORS: Record<string, string> = {
  polideportivo: "#3b82f6",
  centro_salud: "#10b981",
  valenbisi: "#f97316",
  default: "#a855f7",
};

export default function OptimizacionPage() {
  const [sector, setSector] = useState<Sector>("valenbisi");
  const [constraint, setConstraint] = useState<ConstraintMode>("budget");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const [budget, setBudget] = useState(120);
  const [n, setN] = useState(8);
  const [lambdaSports, setLambdaSports] = useState(0.5);
  const [wTraf, setWTraf] = useState(1);
  const [wPob, setWPob] = useState(1);
  const [wDef, setWDef] = useState(1);

  const usesPopulationModel = sector !== "valenbisi" || constraint === "budget";

  async function run() {
    setLoading(true);
    setRan(true);
    let res: OptimizeResponse;

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
      res = await api.optimizeMulti({
        presupuesto: budget,
        lambda_sports: lambdaSports,
      });
    } else if (sector === "sports") {
      res = await api.optimizeSports({ presupuesto: budget });
    } else {
      res = await api.optimizeHealth({ presupuesto: budget });
    }

    setResult(res);
    setLoading(false);
  }

  const proposedMarkers: MapMarker[] = useMemo(
    () =>
      result?.selected.map((s) => ({
        id: `${s.facility_type ?? sector}-${s.candidate_id}`,
        lat: s.lat,
        lon: s.lon,
        label: `#${s.candidate_id} · ${formatScore(s.score, usesPopulationModel)}`,
        color:
          FACILITY_COLORS[s.facility_type ?? sector] ?? FACILITY_COLORS.default,
        radius: 12,
      })) ?? [],
    [result, sector, usesPopulationModel]
  );

  const mapLayers = useMemo(() => layersForSector(sector), [sector]);

  const avgCost =
    result && result.n_selected > 0
      ? (result.total_cost / result.n_selected).toFixed(1)
      : "—";

  const activeSector = SECTORS.find((s) => s.id === sector)!;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Consola de planificación · Ayuntamiento de Valencia"
        title="Optimización de equipamientos urbanos"
        description="Simula escenarios de inversión, compara cobertura existente en el mapa y obtén una propuesta priorizada lista para revisión técnica."
      >
        <Badge color="blue">PuLP · CBC</Badge>
        <Badge color="green">Datos reales</Badge>
      </PageHeader>

      {/* Selector de sector */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTORS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSector(s.id);
              setResult(null);
              setRan(false);
            }}
            className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
              sector === s.id
                ? "border-brand-300 bg-white shadow-card ring-2 ring-brand-200"
                : "border-slate-200 bg-white/80 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            {sector === s.id && (
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.accent}`} />
            )}
            <span
              className={`grid h-10 w-10 place-items-center rounded-xl ${
                sector === s.id
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
              }`}
            >
              {s.icon}
            </span>
            <p className="mt-3 font-semibold text-slate-900">{s.title}</p>
            <p className="mt-1 text-xs text-slate-500">{s.subtitle}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Panel de escenario */}
        <div className="space-y-4">
          <Card className="!p-0 overflow-hidden">
            <div className={`bg-gradient-to-br ${activeSector.accent} p-4 text-white`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Escenario activo
              </p>
              <p className="mt-1 text-lg font-bold">{activeSector.title}</p>
            </div>
            <div className="space-y-5 p-5">
              {sector === "valenbisi" && (
                <div className="grid grid-cols-2 gap-2">
                  <ModeChip
                    active={constraint === "budget"}
                    onClick={() => setConstraint("budget")}
                    icon={<Coins className="h-4 w-4" />}
                    label="Presupuesto"
                  />
                  <ModeChip
                    active={constraint === "count"}
                    onClick={() => setConstraint("count")}
                    icon={<Target className="h-4 w-4" />}
                    label="Nº fijo"
                  />
                </div>
              )}

              {sector === "valenbisi" && constraint === "count" ? (
                <SliderField label="Estaciones a implantar" value={n} min={1} max={25}>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={n}
                    onChange={(e) => setN(+e.target.value)}
                    className="range"
                  />
                </SliderField>
              ) : (
                <SliderField label="Presupuesto disponible" value={`${budget} u.`}>
                  <input
                    type="range"
                    min={20}
                    max={400}
                    step={10}
                    value={budget}
                    onChange={(e) => setBudget(+e.target.value)}
                    className="range"
                  />
                </SliderField>
              )}

              {sector === "multi" && (
                <SliderField label="Peso deporte (λ)" value={lambdaSports.toFixed(2)}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={lambdaSports}
                    onChange={(e) => setLambdaSports(+e.target.value)}
                    className="range"
                  />
                </SliderField>
              )}

              {sector === "valenbisi" && constraint === "count" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Priorización compuesta
                  </p>
                  <WeightSlider icon={<Activity className="h-3.5 w-3.5" />} label="Tráfico" v={wTraf} set={setWTraf} />
                  <WeightSlider icon={<Users className="h-3.5 w-3.5" />} label="Población" v={wPob} set={setWPob} />
                  <WeightSlider icon={<Layers className="h-3.5 w-3.5" />} label="Déficit" v={wDef} set={setWDef} />
                </div>
              )}

              <button
                className="btn-primary w-full"
                onClick={run}
                disabled={loading}
              >
                <Play className="h-4 w-4" />
                {loading ? "Calculando propuesta…" : "Generar propuesta"}
              </button>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Stat
              label="Ubicaciones"
              value={result?.n_selected ?? "—"}
              tone="brand"
              icon={<MapPin className="h-4 w-4" />}
            />
            <Stat
              label={usesPopulationModel ? "Población cubierta" : "Impacto total"}
              value={
                result
                  ? usesPopulationModel && result.population_covered != null
                    ? result.population_covered.toLocaleString("es-ES")
                    : result.total_score.toFixed(2)
                  : "—"
              }
              tone="teal"
            />
            <Stat
              label="Coste total"
              value={result ? result.total_cost.toFixed(1) : "—"}
              hint={`Medio: ${avgCost}`}
            />
          </div>
        </div>

        {/* Mapa principal */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mapa de la propuesta</h2>
              <p className="text-sm text-slate-500">
                Activa capas, explora la red existente y revisa las ubicaciones recomendadas.
              </p>
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
            proposedMarkers={proposedMarkers}
            fitToProposed={proposedMarkers.length > 0}
          />

          {!ran && (
            <Callout tone="brand" title="Cómo usar esta consola">
              Elige un sector, ajusta presupuesto o número de plazas y pulsa
              «Generar propuesta». El mapa muestra la red existente y resalta
              las nuevas ubicaciones optimizadas.
            </Callout>
          )}

          {ran && result && result.selected.length === 0 && (
            <Callout tone="amber" title="Sin solución viable">
              No se encontraron ubicaciones con estos parámetros. Aumenta el
              presupuesto o verifica que la API esté activa con los artefactos
              de cobertura cargados.
            </Callout>
          )}
        </div>
      </div>

      {ran && result && result.selected.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ranking de ubicaciones
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Ordenadas por impacto · restricción: {result.constraint}
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Zona</th>
                  <th className="py-2 pr-3">Coordenadas</th>
                  <th className="py-2 pr-3">Impacto</th>
                  <th className="py-2">Coste</th>
                </tr>
              </thead>
              <tbody>
                {result.selected.map((s, i) => (
                  <tr
                    key={`${s.candidate_id}-${s.facility_type ?? ""}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-700">
                      #{s.candidate_id}
                    </td>
                    <td className="py-2.5 pr-3 capitalize text-slate-600">
                      {(s.facility_type ?? sector).replace(/_/g, " ")}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{s.zona ?? "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                      {s.lat.toFixed(4)}, {s.lon.toFixed(4)}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-teal-600">
                      {formatScore(s.score, usesPopulationModel)}
                    </td>
                    <td className="py-2.5 text-slate-600">{s.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTech((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
        >
          <span className="font-semibold text-slate-900">Detalle técnico del modelo</span>
          {showTech ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>
        {showTech && (
          <div className="border-t border-slate-200 px-5 pb-5 pt-4">
            {usesPopulationModel ? (
              <>
                <div className="overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100">
                  max Σⱼ pⱼ Yⱼ
                  <br />
                  s.a. Yⱼ − Σᵢ αᵢⱼ Xᵢ ≤ 0
                  <br />
                  Σᵢ costᵢ Xᵢ ≤ presupuesto
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Cobertura con población censal, isócronas y costes del dataset
                  del curso. Instalaciones existentes restan solapamiento antes
                  de maximizar habitantes cubiertos.
                </p>
              </>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100">
                  max Σ scoreᵢ·xᵢ &nbsp; con &nbsp; Σ xᵢ = N
                  <br />
                  score = w₁·tráfico + w₂·población + w₃·déficit
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Modo Valenbisi con número fijo de estaciones y score compuesto
                  normalizado por tráfico, población alcanzable y déficit de red.
                </p>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function formatScore(score: number, population: boolean) {
  return population ? `${score.toLocaleString("es-ES")} hab.` : score.toFixed(3);
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
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-brand-300 bg-brand-50 text-brand-800"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
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
  min,
  max,
  children,
}: {
  label: string;
  value: React.ReactNode;
  min?: number;
  max?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">
          {value}
        </span>
      </div>
      {children}
      {min != null && max != null && (
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
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
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="font-semibold">{v.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={3}
        step={0.1}
        value={v}
        onChange={(e) => set(+e.target.value)}
        className="range"
      />
    </div>
  );
}
