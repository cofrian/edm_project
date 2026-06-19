"use client";

import { useState } from "react";
import {
  AlertTriangle,
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
  BookOpen,
  CheckCircle2,
  SlidersHorizontal,
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
  valenbisi: "Valenbisi",
};

const FACILITY_HELP: Record<
  FacilityMode,
  { question: string; objective: string; output: string; basis: string }
> = {
  sports: {
    question: "¿Dónde abrir nuevas instalaciones deportivas?",
    objective:
      "Maximiza habitantes que pasan a estar cubiertos por polideportivos, evitando duplicar cobertura existente.",
    output: "Ranking de ubicaciones candidatas, coste usado y población cubierta.",
    basis: "Modelo de cobertura urbana de UrbanFlow.",
  },
  health: {
    question: "¿Dónde reforzar la red sanitaria?",
    objective:
      "Maximiza habitantes que pasan a estar cubiertos por centros de salud u hospitales.",
    output: "Ubicaciones sanitarias priorizadas bajo el presupuesto disponible.",
    basis: "Modelo de cobertura sanitaria de UrbanFlow.",
  },
  multi: {
    question: "¿Cómo repartir presupuesto entre deporte y salud?",
    objective:
      "Combina dos objetivos con λ: 1 prioriza deporte, 0 prioriza salud, 0.5 equilibra ambos.",
    output: "Mezcla óptima de equipamientos sin instalar dos servicios en el mismo punto.",
    basis: "Modelo multiobjetivo de UrbanFlow.",
  },
  valenbisi: {
    question: "¿Qué puntos de movilidad tienen mayor potencial?",
    objective:
      "Combina tráfico, población alcanzable y déficit de Valenbisi en un score ponderado.",
    output: "Selección por número fijo o presupuesto usando el score de movilidad.",
    basis: "Modelo de movilidad sostenible de UrbanFlow.",
  },
};

const FUNCTIONAL_TRACE = [
  {
    source: "Cobertura urbana",
    block: "Variables binarias, restricciones de cobertura y presupuesto.",
    app: "Implementado en PuLP/CBC como polideportivo y centro de salud, con población hexagonal e isócronas.",
    status: "Activo en API",
  },
  {
    source: "Movilidad Valenbisi",
    block: "Candidatos de movilidad, tráfico, población alcanzable, déficit y optimización exacta.",
    app: "Modo Valenbisi con pesos editables y selección de N puntos o presupuesto sobre candidatos curados.",
    status: "Activo en API",
  },
  {
    source: "Multiobjetivo",
    block: "Combinación de cobertura deportiva y sanitaria en una misma decisión.",
    app: "Suma ponderada activa con λ y restricción para evitar duplicar servicios en el mismo punto.",
    status: "Activo en API",
  },
  {
    source: "Señales auxiliares",
    block: "Capas externas de contexto urbano para enriquecer la demanda.",
    app: "La versión pública usa solo datos curados: CatBoost de tráfico, población, costes e isócronas.",
    status: "Sustituido",
  },
  {
    source: "Análisis avanzado",
    block: "Heurísticas y áreas dinámicas de influencia para comparar alternativas.",
    app: "Documentado como análisis exploratorio: no se ejecuta en producción para mantener resultados deterministas y despliegue ligero.",
    status: "Documentado",
  },
  {
    source: "Preparación de datos",
    block: "Conversión de datos crudos a candidatos, población, isócronas, costes y cobertura existente.",
    app: "Artefactos servidos desde backend/data/processed: candidates_facilities, population_hexes y coverage_alpha.",
    status: "Curado",
  },
];

const BUDGET_PRESETS = [
  { label: "Piloto", value: 60 },
  { label: "Equilibrado", value: 120 },
  { label: "Ambicioso", value: 250 },
];

const COUNT_PRESETS = [
  { label: "5 puntos", value: 5 },
  { label: "10 puntos", value: 10 },
  { label: "20 puntos", value: 20 },
];

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

  function resetResult() {
    setResult(null);
    setRan(false);
  }

  function selectFacility(next: FacilityMode) {
    setFacility(next);
    resetResult();
  }

  function selectConstraint(next: ConstraintMode) {
    setConstraint(next);
    resetResult();
  }

  async function run() {
    setLoading(true);
    setRan(true);
    try {
      let res: OptimizeResponse;

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

      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  const usesRealPopulation = facility !== "valenbisi";
  const helper = FACILITY_HELP[facility];
  const budgetBased = facility !== "valenbisi" || constraint === "budget";
  const budgetUsage =
    result && budgetBased ? Math.round((result.total_cost / budget) * 100) : null;
  const topCandidate = result?.selected[0];
  const apiUnavailable = result?.constraint === "API no disponible";

  const markers =
    result?.selected.map((s) => ({
      lat: s.lat,
      lon: s.lon,
      label: `${formatFacilityType(s.facility_type, facility)} #${s.candidate_id} · ${
        usesRealPopulation
          ? `${s.score.toLocaleString("es-ES")} hab.`
          : `score ${s.score.toLocaleString("es-ES")}`
      }`,
      color:
        FACILITY_COLORS[s.facility_type ?? ""] ??
        FACILITY_COLORS.default,
    })) ?? [];

  const avgCost =
    result && result.n_selected > 0
      ? (result.total_cost / result.n_selected).toFixed(1)
      : "—";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Herramienta de decisión · UrbanFlow Valencia"
        title="Optimización de equipamientos urbanos"
        description="Modelo de cobertura poblacional con población real, isócronas y costes de implantación. Maximiza habitantes cubiertos bajo presupuesto con PuLP · CBC."
      >
        <Badge color="blue">PuLP · CBC</Badge>
        <Badge color="green">Población censal real</Badge>
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div>
              <p className="eyebrow">Guía rápida</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                De pregunta municipal a escenario optimizable
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Elige el objetivo urbano, ajusta la restricción y ejecuta el
                solver. La tabla y el mapa muestran exactamente qué candidatos
                cumplen mejor el criterio sin superar el presupuesto o el número
                de ubicaciones fijado.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <GuideStep n="1" title="Objetivo" text="Selecciona deporte, salud, multiobjetivo o Valenbisi." />
                <GuideStep n="2" title="Restricción" text="Define presupuesto, N puntos y pesos si aplica." />
                <GuideStep n="3" title="Decisión" text="Interpreta población cubierta, coste y ranking." />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
            <div>
              <p className="eyebrow">Escenario actual</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {helper.question}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{helper.objective}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <SummaryRow k="Salida" v={helper.output} />
                <SummaryRow k="Base técnica" v={helper.basis} />
              </dl>
            </div>
          </div>
        </Card>
      </section>

      {/* Tipo de equipamiento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FacilityButton
          active={facility === "sports"}
          onClick={() => selectFacility("sports")}
          icon={<Dumbbell className="h-5 w-5" />}
          title="Polideportivo"
          subtitle="Cobertura deportiva real · Modelo 2"
        />
        <FacilityButton
          active={facility === "health"}
          onClick={() => selectFacility("health")}
          icon={<HeartPulse className="h-5 w-5" />}
          title="Centro de salud"
          subtitle="Cobertura sanitaria real · Modelo 2"
        />
        <FacilityButton
          active={facility === "multi"}
          onClick={() => selectFacility("multi")}
          icon={<Blend className="h-5 w-5" />}
          title="Multi-objetivo"
          subtitle="Modelo 3 · λ deporte + (1−λ) salud"
        />
        <FacilityButton
          active={facility === "valenbisi"}
          onClick={() => selectFacility("valenbisi")}
          icon={<Bike className="h-5 w-5" />}
          title="Valenbisi"
          subtitle="Score de movilidad urbana"
        />
      </div>

      {facility === "valenbisi" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeButton
            active={constraint === "count"}
            onClick={() => selectConstraint("count")}
            icon={<Target className="h-5 w-5" />}
            title="Nº fijo de ubicaciones"
            subtitle="Σ xᵢ = N"
          />
          <ModeButton
            active={constraint === "budget"}
            onClick={() => selectConstraint("budget")}
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
                <PresetButtons
                  items={COUNT_PRESETS}
                  active={n}
                  onSelect={setN}
                />
                <div className="mt-3 grid grid-cols-[1fr_5rem] gap-3">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={n}
                    onChange={(e) => setN(+e.target.value)}
                    className="range"
                  />
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={n}
                    onChange={(e) => setN(clamp(+e.target.value, 1, 30))}
                    className="input py-1.5 text-center"
                  />
                </div>
                <Scale left="1" right="30" />
              </Field>
            ) : (
              <Field label="Presupuesto disponible" value={`${budget} u.`}>
                <PresetButtons
                  items={BUDGET_PRESETS}
                  active={budget}
                  onSelect={setBudget}
                />
                <div className="mt-3 grid grid-cols-[1fr_5.5rem] gap-3">
                  <input
                    type="range"
                    min={10}
                    max={500}
                    step={10}
                    value={budget}
                    onChange={(e) => setBudget(+e.target.value)}
                    className="range"
                  />
                  <input
                    type="number"
                    min={10}
                    max={500}
                    step={10}
                    value={budget}
                    onChange={(e) => setBudget(clamp(+e.target.value, 10, 500))}
                    className="input py-1.5 text-center"
                  />
                </div>
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
          {ran && (
            <Callout
              tone={apiUnavailable ? "amber" : result ? "teal" : "brand"}
              title={
                apiUnavailable
                  ? "API no disponible"
                  : result
                    ? "Lectura del resultado"
                    : "Calculando escenario"
              }
            >
              {apiUnavailable
                ? "La interfaz está funcionando, pero no ha podido obtener una solución del backend. Revisa NEXT_PUBLIC_API_URL o el estado del Space."
                : result
                  ? result.n_selected > 0
                    ? `El solver selecciona ${result.n_selected} ubicaciones${
                        budgetUsage != null
                          ? ` usando aproximadamente el ${budgetUsage}% del presupuesto`
                          : ""
                      }. La primera recomendación es el candidato #${topCandidate?.candidate_id}.`
                    : "El solver no ha seleccionado ubicaciones con esta restricción. Sube el presupuesto o reduce las exigencias del escenario."
                  : "Ejecutando PuLP/CBC sobre los artefactos curados del proyecto."}
            </Callout>
          )}

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
              hint={
                budgetUsage != null
                  ? `Uso presupuesto: ${budgetUsage}% · coste medio: ${avgCost}`
                  : `Coste medio: ${avgCost}`
              }
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
            censal + isócronas del proyecto.
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
                      {formatFacilityType(s.facility_type, facility)}
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
              Formulación matemática del motor
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
                  El modo Valenbisi usa un score compuesto para comparar
                  presión de tráfico, población alcanzable y déficit de
                  cobertura de estaciones existentes.
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

      <Card>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">
              Cobertura funcional del motor UrbanFlow
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              La app integra los módulos necesarios para una decisión urbana
              completa y separa el cálculo público determinista del análisis
              exploratorio interno.
            </p>
            <div className="mt-4 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Fuente</th>
                    <th className="py-2 pr-3">Bloque funcional</th>
                    <th className="py-2 pr-3">Implementación en la app</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNCTIONAL_TRACE.map((row) => (
                    <tr key={row.source} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3 align-top font-medium text-slate-800">
                        {row.source}
                      </td>
                      <td className="py-3 pr-3 align-top text-slate-600">
                        {row.block}
                      </td>
                      <td className="py-3 pr-3 align-top text-slate-600">
                        {row.app}
                      </td>
                      <td className="py-3 align-top">
                        <Badge color={traceStatusColor(row.status)}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout tone="amber" title="Criterio de despliegue">
              <span className="inline-flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  El algoritmo genético y el Voronoi dinámico siguen explicados
                  como análisis interno, pero el servicio público usa PuLP/CBC
                  porque es reproducible, testeable y más estable en Hugging
                  Face.
                </span>
              </span>
            </Callout>
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

function GuideStep({
  n,
  title,
  text,
}: {
  n: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {n}
      </span>
      <p className="mt-2 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{text}</p>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {k}
      </dt>
      <dd className="mt-0.5 text-slate-600">{v}</dd>
    </div>
  );
}

function PresetButtons({
  items,
  active,
  onSelect,
}: {
  items: { label: string; value: number }[];
  active: number;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onSelect(item.value)}
          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
            active === item.value
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function formatFacilityType(type: string | null | undefined, fallback: FacilityMode) {
  if (type === "polideportivo") return "Polideportivo";
  if (type === "centro_salud") return "Centro de salud";
  return FACILITY_LABELS[fallback];
}

function traceStatusColor(status: string): "green" | "amber" | "blue" {
  if (status === "Activo en API") return "green";
  if (status === "Parcial" || status === "Sustituido") return "amber";
  return "blue";
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
