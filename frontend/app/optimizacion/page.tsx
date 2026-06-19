"use client";

import { useState } from "react";
import {
  Target,
  Coins,
  Play,
  MapPin,
  Layers,
  Activity,
  Users,
  Info,
  Dumbbell,
  HeartPulse,
  Blend,
  Bike,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, Badge } from "@/components/Card";
import { Stat, PageHeader, Callout } from "@/components/ui";
import { DynamicMap } from "@/components/DynamicMap";
import type { OptimizeResponse } from "@/lib/types";

type FacilityMode = "sports" | "health" | "multi" | "valenbisi";
type ConstraintMode = "budget" | "count";

const FACILITY_LABELS: Record<FacilityMode, string> = {
  sports: "Polideportivo",
  health: "Centro de salud",
  multi: "Multi (deporte + salud)",
  valenbisi: "Valenbisi (legacy)",
};

const FACILITY_COLORS: Record<string, string> = {
  polideportivo: "#1d4ed8",
  centro_salud: "#059669",
  default: "#7c3aed",
};

export default function OptimizacionPage() {
  const [facility, setFacility] = useState<FacilityMode>("sports");
  const [constraint, setConstraint] = useState<ConstraintMode>("budget");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const [budget, setBudget] = useState(100);
  const [n, setN] = useState(10);
  const [lambdaSports, setLambdaSports] = useState(0.5);

  const [wTraf, setWTraf] = useState(1);
  const [wPob, setWPob] = useState(1);
  const [wDef, setWDef] = useState(1);

  async function run() {
    setLoading(true);
    setRan(true);
    let res;

    if (facility === "valenbisi") {
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
    } else if (facility === "multi") {
      res = await api.optimizeMulti({
        presupuesto: budget,
        lambda_sports: lambdaSports,
      });
    } else if (facility === "sports") {
      res = await api.optimizeSports({ presupuesto: budget });
    } else {
      res = await api.optimizeHealth({ presupuesto: budget });
    }

    setResult(res.ok ? res.data : null);
    setLoading(false);
  }

  const markers =
    result?.selected.map((s) => ({
      lat: s.lat,
      lon: s.lon,
      label: `${s.facility_type ?? FACILITY_LABELS[facility]} #${s.candidate_id} · ${s.score} hab.`,
      color:
        FACILITY_COLORS[s.facility_type ?? ""] ??
        FACILITY_COLORS.default,
    })) ?? [];

  const avgCost =
    result && result.n_selected > 0
      ? (result.total_cost / result.n_selected).toFixed(1)
      : "—";

  const usesRealPopulation = facility !== "valenbisi";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Herramienta de decisión · Notebook SMARTCITIES"
        title="Optimización de equipamientos urbanos"
        description="Modelo de cobertura poblacional con población real (population_spain.gpkg), isócronas y costes del curso. Maximiza habitantes cubiertos bajo presupuesto con PuLP · CBC."
      >
        <Badge color="blue">PuLP · CBC</Badge>
        <Badge color="green">Población censal real</Badge>
      </PageHeader>

      {/* Tipo de equipamiento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FacilityButton
          active={facility === "sports"}
          onClick={() => setFacility("sports")}
          icon={<Dumbbell className="h-5 w-5" />}
          title="Polideportivo"
          subtitle="Modelo 2 · cost1 · isócronas deportivas existentes"
        />
        <FacilityButton
          active={facility === "health"}
          onClick={() => setFacility("health")}
          icon={<HeartPulse className="h-5 w-5" />}
          title="Centro de salud"
          subtitle="Modelo 2 · cost2 · hospitales existentes"
        />
        <FacilityButton
          active={facility === "multi"}
          onClick={() => setFacility("multi")}
          icon={<Blend className="h-5 w-5" />}
          title="Multi-objetivo"
          subtitle="Modelo 3 · λ deporte + (1−λ) salud"
        />
        <FacilityButton
          active={facility === "valenbisi"}
          onClick={() => setFacility("valenbisi")}
          icon={<Bike className="h-5 w-5" />}
          title="Valenbisi"
          subtitle="Modo legacy (score compuesto)"
        />
      </div>

      {facility === "valenbisi" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeButton
            active={constraint === "count"}
            onClick={() => setConstraint("count")}
            icon={<Target className="h-5 w-5" />}
            title="Nº fijo de ubicaciones"
            subtitle="Σ xᵢ = N"
          />
          <ModeButton
            active={constraint === "budget"}
            onClick={() => setConstraint("budget")}
            icon={<Coins className="h-5 w-5" />}
            title="Presupuesto máximo"
            subtitle="Σ costeᵢ·xᵢ ≤ presupuesto"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="text-base font-bold text-slate-900">Escenario</h3>
          <p className="mt-1 text-sm text-slate-500">
            {FACILITY_LABELS[facility]} —{" "}
            {usesRealPopulation
              ? "max Σ pⱼ Yⱼ (población sin cobertura previa)"
              : "max Σ scoreᵢ·xᵢ (ponderado)"}
          </p>

          <div className="mt-5 space-y-5">
            {facility === "valenbisi" && constraint === "count" ? (
              <Field label="Número de equipamientos" value={n}>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={n}
                  onChange={(e) => setN(+e.target.value)}
                  className="range"
                />
                <Scale left="1" right="30" />
              </Field>
            ) : (
              <Field label="Presupuesto disponible" value={`${budget} u.`}>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={budget}
                  onChange={(e) => setBudget(+e.target.value)}
                  className="range"
                />
                <Scale left="10" right="500" />
              </Field>
            )}

            {facility === "multi" && (
              <Field label="λ deporte (peso)" value={lambdaSports.toFixed(2)}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={lambdaSports}
                  onChange={(e) => setLambdaSports(+e.target.value)}
                  className="range"
                />
                <Scale left="0 (solo salud)" right="1 (solo deporte)" />
              </Field>
            )}

            {facility === "valenbisi" && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pesos del score compuesto
                </p>
                <Weight
                  icon={<Activity className="h-4 w-4 text-brand-600" />}
                  label="Presión de tráfico"
                  v={wTraf}
                  set={setWTraf}
                />
                <Weight
                  icon={<Users className="h-4 w-4 text-teal-600" />}
                  label="Población alcanzable"
                  v={wPob}
                  set={setWPob}
                />
                <Weight
                  icon={<Layers className="h-4 w-4 text-amber-600" />}
                  label="Déficit de cobertura"
                  v={wDef}
                  set={setWDef}
                />
              </div>
            )}

            <button
              className="btn-primary w-full"
              onClick={run}
              disabled={loading}
            >
              <Play className="h-4 w-4" />
              {loading ? "Optimizando…" : "Ejecutar optimización"}
            </button>
            <p className="text-center text-xs text-slate-400">
              {usesRealPopulation
                ? "Restricción: Σ coste ≤ presupuesto; Yⱼ cubierto si hex en isócrona"
                : constraint === "count"
                  ? "Restricción: Σ xᵢ = N"
                  : "Restricción: Σ costeᵢ·xᵢ ≤ presupuesto"}
            </p>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Ubicaciones elegidas"
              value={result?.n_selected ?? "—"}
              tone="brand"
              icon={<MapPin className="h-4 w-4" />}
            />
            <Stat
              label={
                usesRealPopulation ? "Población cubierta" : "Impacto total"
              }
              value={
                result
                  ? usesRealPopulation && result.population_covered != null
                    ? result.population_covered.toLocaleString("es-ES")
                    : result.total_score.toFixed(2)
                  : "—"
              }
              tone="teal"
              hint={
                usesRealPopulation
                  ? "Habitantes en hexágonos nuevos cubiertos"
                  : "Suma de scores ponderados"
              }
            />
            <Stat
              label="Coste total"
              value={result ? result.total_cost.toFixed(1) : "—"}
              hint={`Coste medio: ${avgCost}`}
            />
            <Stat
              label="Modo"
              value={result?.mode ?? "—"}
              hint={FACILITY_LABELS[facility]}
            />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Mapa de la propuesta
              </h3>
              {result && <Badge color="blue">{result.n_selected} puntos</Badge>}
            </div>
            <div className="mt-4">
              <DynamicMap markers={markers} height={440} />
            </div>
            {result && (
              <p className="mt-3 text-xs text-slate-400">
                Restricción aplicada: {result.constraint}
              </p>
            )}
          </Card>
        </div>
      </div>

      {ran && result && result.selected.length > 0 && (
        <Card>
          <h3 className="text-base font-bold text-slate-900">
            Ubicaciones recomendadas
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Ordenadas por impacto. Datos: localizaciones2.csv + población
            censal + isócronas del curso SMARTCITIES.
          </p>
          <div className="mt-4 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Zona</th>
                  <th className="py-2 pr-3">Coordenadas</th>
                  <th className="py-2 pr-3">Población / score</th>
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
                    <td className="py-2.5 pr-3 text-slate-600">
                      {s.facility_type ?? FACILITY_LABELS[facility]}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {s.zona ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                      {s.lat.toFixed(4)}, {s.lon.toFixed(4)}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-teal-600">
                      {s.score.toLocaleString("es-ES")}
                    </td>
                    <td className="py-2.5 text-slate-600">{s.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {ran && result && result.selected.length === 0 && (
        <Callout tone="amber" title="Sin solución para este escenario">
          No se seleccionó ninguna ubicación. Prueba a aumentar el presupuesto
          o revisa que la API esté desplegada con los artefactos de cobertura.
        </Callout>
      )}

      <Card>
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Formulación (notebook optimización SMARTCITIES)
            </h3>
            {usesRealPopulation ? (
              <>
                <div className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100 sm:text-sm">
                  max Σⱼ pⱼ Yⱼ &nbsp; (pⱼ = población en hex sin cobertura
                  previa)
                  <br />
                  s.a. Yⱼ − Σᵢ αᵢⱼ Xᵢ ≤ 0 &nbsp; ∀j
                  <br />
                  Σᵢ costᵢ Xᵢ ≤ presupuesto
                  <br />
                  {facility === "multi" && (
                    <>
                      <br />
                      Multi: max λ Σ pⱼ Yⱼ + (1−λ) Σ p&apos;ⱼ Y&apos;ⱼ
                      <br />
                      Xᵢ + X&apos;ᵢ ≤ 1
                    </>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  αᵢⱼ = 1 si el centroide del hexágono censal j cae dentro de
                  la isócrona del candidato i. pⱼ usa{" "}
                  <strong>population_spain.gpkg</strong> filtrado a Valencia.
                  Instalaciones existentes: centros-deportivo-valencia.csv y
                  hospitales-valencia.csv.
                </p>
              </>
            ) : (
              <>
                <div className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100 sm:text-sm">
                  scoreᵢ = w_tráfico·tráficoᵢ + w_población·poblaciónᵢ +
                  w_déficit·déficitᵢ
                  <br />
                  max Σ scoreᵢ·xᵢ
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Modo legacy con score compuesto (compatible con la API
                  anterior).
                </p>
              </>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Autores: Sergio Ortiz Montesinos, Luis Trigueros Espada, Fernando
              Martínez Gómez
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FacilityButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </span>
      <span>
        <span
          className={`block font-semibold ${active ? "text-brand-800" : "text-slate-900"}`}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span>
      </span>
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </span>
      <span>
        <span
          className={`block font-semibold ${active ? "text-brand-800" : "text-slate-900"}`}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span>
      </span>
    </button>
  );
}

function Field({
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
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}

function Scale({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-1 flex justify-between text-xs text-slate-400">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function Weight({
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
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          {icon}
          {label}
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {v.toFixed(1)}
        </span>
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
