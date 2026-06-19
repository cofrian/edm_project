"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bike,
  Blend,
  CheckCircle2,
  Coins,
  Dumbbell,
  HeartPulse,
  Info,
  Layers,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Play,
  Route,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge, Card } from "@/components/Card";
import { Callout, PageHeader, Stat } from "@/components/ui";
import { DynamicMap } from "@/components/DynamicMap";
import type { GeoJSONFeature, GeoJSONFeatureCollection, OptimizeResponse } from "@/lib/types";
import type { MapLine, MapMarker, MapPolygon } from "@/components/MapView";

type FacilityMode = "sports" | "health" | "multi" | "valenbisi";
type ConstraintMode = "budget" | "count";
type ActiveTab = "tool" | "info";

type GisLayers = {
  sports: GeoJSONFeatureCollection;
  health: GeoJSONFeatureCollection;
  traffic: GeoJSONFeatureCollection;
  valenbisi: GeoJSONFeatureCollection;
};

const emptyCollection: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

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
      "Prioriza candidatos que cubren población sin acceso actual a polideportivos.",
    output: "Ranking de ubicaciones, coste usado y nueva población cubierta.",
    basis: "Cobertura con isócronas, población hexagonal y restricción de presupuesto.",
  },
  health: {
    question: "¿Dónde reforzar la red sanitaria?",
    objective:
      "Busca centros de salud que añaden cobertura real sin duplicar la red existente.",
    output: "Ubicaciones sanitarias priorizadas bajo el presupuesto disponible.",
    basis: "Cobertura sanitaria con población real y equipamientos existentes.",
  },
  multi: {
    question: "¿Cómo repartir presupuesto entre deporte y salud?",
    objective:
      "Combina dos objetivos con λ: 1 prioriza deporte, 0 prioriza salud, 0.5 equilibra ambos.",
    output: "Mezcla óptima de equipamientos sin instalar dos servicios en el mismo punto.",
    basis: "Modelo multiobjetivo con restricción de no duplicidad por candidato.",
  },
  valenbisi: {
    question: "¿Qué puntos de movilidad tienen mayor potencial?",
    objective:
      "Combina tráfico, población alcanzable y déficit de estaciones en un score ponderado.",
    output: "Selección por número fijo o presupuesto usando el score de movilidad.",
    basis: "Optimización exacta sobre candidatos curados de movilidad sostenible.",
  },
};

const FUNCTIONAL_TRACE = [
  {
    source: "Cobertura urbana",
    block: "Variables binarias, restricciones de cobertura y presupuesto.",
    app: "Implementado en PuLP/CBC para deporte y salud, con población hexagonal e isócronas.",
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
    source: "Capas GIS",
    block: "Contexto espacial para entender la decisión sobre el territorio.",
    app: "Mapa con tráfico, cobertura existente, estaciones actuales y candidatos recomendados.",
    status: "Activo en app",
  },
  {
    source: "Preparación de datos",
    block: "Conversión de datos crudos a candidatos, población, isócronas, costes y cobertura existente.",
    app: "Artefactos servidos desde backend/data/processed: candidatos, población, cobertura y capas GeoJSON.",
    status: "Curado",
  },
  {
    source: "Análisis avanzado",
    block: "Heurísticas y áreas dinámicas de influencia para comparar alternativas.",
    app: "Documentado como análisis interno; el servicio público usa PuLP/CBC por reproducibilidad y estabilidad.",
    status: "Documentado",
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
  polideportivo: "#2563eb",
  centro_salud: "#059669",
  default: "#7c3aed",
};

export default function OptimizacionPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("tool");
  const [facility, setFacility] = useState<FacilityMode>("sports");
  const [constraint, setConstraint] = useState<ConstraintMode>("budget");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [layersLoading, setLayersLoading] = useState(true);
  const [layers, setLayers] = useState<GisLayers>({
    sports: emptyCollection,
    health: emptyCollection,
    traffic: emptyCollection,
    valenbisi: emptyCollection,
  });

  const [showTraffic, setShowTraffic] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showValenbisi, setShowValenbisi] = useState(false);

  const [budget, setBudget] = useState(100);
  const [n, setN] = useState(10);
  const [lambdaSports, setLambdaSports] = useState(0.5);

  const [wTraf, setWTraf] = useState(1);
  const [wPob, setWPob] = useState(1);
  const [wDef, setWDef] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadLayers() {
      setLayersLoading(true);
      const [sports, health, traffic, valenbisi] = await Promise.all([
        api.existingSports(),
        api.existingHealth(),
        api.trafficSegments(),
        api.currentValenbisi(),
      ]);

      if (active) {
        setLayers({ sports, health, traffic, valenbisi });
        setLayersLoading(false);
      }
    }

    loadLayers();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (facility === "valenbisi") setShowValenbisi(true);
  }, [facility]);

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
  const avgCost =
    result && result.n_selected > 0
      ? (result.total_cost / result.n_selected).toFixed(1)
      : "—";
  const modeHint = getModeHint(facility, constraint);
  const modeValue = result?.mode
    ? formatModeName(result.mode, facility)
    : FACILITY_LABELS[facility];

  const selectedMarkers: MapMarker[] =
    result?.selected.map((s) => ({
      lat: s.lat,
      lon: s.lon,
      radius: 9,
      label: `${formatFacilityType(s.facility_type, facility)} #${s.candidate_id} · ${
        usesRealPopulation
          ? `${s.score.toLocaleString("es-ES")} hab.`
          : `score ${s.score.toLocaleString("es-ES")}`
      }`,
      color:
        FACILITY_COLORS[s.facility_type ?? ""] ??
        FACILITY_COLORS.default,
    })) ?? [];

  const coveragePolygons = useMemo(() => {
    if (!showCoverage) return [];

    const polygons: MapPolygon[] = [];
    if (facility === "sports" || facility === "multi") {
      polygons.push(
        ...polygonFeaturesToPolygons(layers.sports, {
          color: "#2563eb",
          label: "Cobertura deportiva existente",
        }),
      );
    }
    if (facility === "health" || facility === "multi") {
      polygons.push(
        ...polygonFeaturesToPolygons(layers.health, {
          color: "#059669",
          label: "Cobertura sanitaria existente",
        }),
      );
    }

    return polygons;
  }, [facility, layers.health, layers.sports, showCoverage]);

  const trafficLines = useMemo(
    () =>
      showTraffic
        ? lineFeaturesToLines(layers.traffic, {
            color: "#f97316",
            label: "Segmento de tráfico",
            limit: 320,
          })
        : [],
    [layers.traffic, showTraffic],
  );

  const valenbisiMarkers = useMemo(
    () =>
      showValenbisi
        ? pointFeaturesToMarkers(layers.valenbisi, {
            color: "#64748b",
            label: "Estación Valenbisi actual",
            limit: 300,
            radius: 3,
          })
        : [],
    [layers.valenbisi, showValenbisi],
  );

  const mapMarkers = [...valenbisiMarkers, ...selectedMarkers];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="UrbanFlow Valencia"
        title="Optimizador urbano"
        description="Herramienta para comparar escenarios de equipamientos sobre Valencia con capas GIS, solver PuLP/CBC y resultados interpretables."
      >
        <Badge color="blue">Mapa GIS</Badge>
        <Badge color="green">Solver exacto</Badge>
      </PageHeader>

      <div className="flex w-full flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <TabButton
          active={activeTab === "tool"}
          onClick={() => setActiveTab("tool")}
          icon={<SlidersHorizontal className="h-4 w-4" />}
          label="Herramienta"
        />
        <TabButton
          active={activeTab === "info"}
          onClick={() => setActiveTab("info")}
          icon={<Info className="h-4 w-4" />}
          label="Información"
        />
      </div>

      {activeTab === "tool" ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <Card className="xl:self-start">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700">
                  <Target className="h-5 w-5" />
                </span>
                <div>
                  <p className="eyebrow">Escenario activo</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {helper.question}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {helper.objective}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <FacilityButton
                  active={facility === "sports"}
                  onClick={() => selectFacility("sports")}
                  icon={<Dumbbell className="h-5 w-5" />}
                  title="Polideportivo"
                  subtitle="Cobertura deportiva"
                />
                <FacilityButton
                  active={facility === "health"}
                  onClick={() => selectFacility("health")}
                  icon={<HeartPulse className="h-5 w-5" />}
                  title="Centro de salud"
                  subtitle="Cobertura sanitaria"
                />
                <FacilityButton
                  active={facility === "multi"}
                  onClick={() => selectFacility("multi")}
                  icon={<Blend className="h-5 w-5" />}
                  title="Multiobjetivo"
                  subtitle="Deporte + salud"
                />
                <FacilityButton
                  active={facility === "valenbisi"}
                  onClick={() => selectFacility("valenbisi")}
                  icon={<Bike className="h-5 w-5" />}
                  title="Valenbisi"
                  subtitle="Movilidad urbana"
                />
              </div>

              {facility === "valenbisi" && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-2">
                    <Bike className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Modo de planificación Valenbisi
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        Elige si quieres fijar cuántas estaciones se proponen o
                        limitar la solución por coste disponible.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <ModeButton
                      active={constraint === "count"}
                      onClick={() => selectConstraint("count")}
                      icon={<Target className="h-5 w-5" />}
                      title="Elegir N estaciones"
                      subtitle="Para un plan cerrado: 5, 10, 20... puntos nuevos."
                    />
                    <ModeButton
                      active={constraint === "budget"}
                      onClick={() => selectConstraint("budget")}
                      icon={<Coins className="h-5 w-5" />}
                      title="Usar presupuesto máximo"
                      subtitle="Para que el solver decida cuántas caben en el coste."
                    />
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-5">
                {facility === "valenbisi" && constraint === "count" ? (
                  <Field label="Estaciones nuevas a proponer" value={n}>
                    <PresetButtons items={COUNT_PRESETS} active={n} onSelect={setN} />
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
                  <Field
                    label={
                      facility === "valenbisi"
                        ? "Presupuesto para estaciones"
                        : "Presupuesto disponible"
                    }
                    value={`${budget} u.`}
                  >
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
                  <Field label="λ deporte" value={lambdaSports.toFixed(2)}>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={lambdaSports}
                      onChange={(e) => setLambdaSports(+e.target.value)}
                      className="range"
                    />
                    <Scale left="0 salud" right="1 deporte" />
                  </Field>
                )}

                {facility === "valenbisi" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Pesos del score
                    </p>
                    <Weight
                      icon={<Activity className="h-4 w-4 text-slate-700" />}
                      label="Tráfico"
                      v={wTraf}
                      set={setWTraf}
                    />
                    <Weight
                      icon={<Users className="h-4 w-4 text-teal-600" />}
                      label="Población"
                      v={wPob}
                      set={setWPob}
                    />
                    <Weight
                      icon={<Layers className="h-4 w-4 text-amber-600" />}
                      label="Déficit"
                      v={wDef}
                      set={setWDef}
                    />
                    <p className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                      Score actual: tráfico {wTraf.toFixed(1)} · población{" "}
                      {wPob.toFixed(1)} · déficit {wDef.toFixed(1)}.
                    </p>
                  </div>
                )}

                <button className="btn-primary w-full" onClick={run} disabled={loading}>
                  <Play className="h-4 w-4" />
                  {loading ? "Optimizando..." : "Ejecutar optimización"}
                </button>

                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  <strong className="text-slate-700">Criterio:</strong>{" "}
                  {usesRealPopulation
                    ? "maximizar población nueva cubierta sin superar presupuesto."
                    : constraint === "count"
                      ? "elegir exactamente N ubicaciones con mayor score conjunto."
                      : "maximizar score conjunto sin superar presupuesto."}
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="eyebrow">Mapa GIS de decisión</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">
                      Valencia: capas y recomendaciones
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                      {helper.output} Las capas ayudan a revisar cobertura actual,
                      presión de movilidad y puntos propuestos antes de aceptar una
                      solución.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LayerToggle
                      active={showTraffic}
                      onClick={() => setShowTraffic((v) => !v)}
                      tone="amber"
                      label="Tráfico"
                      count={trafficLines.length}
                    />
                    <LayerToggle
                      active={showCoverage}
                      onClick={() => setShowCoverage((v) => !v)}
                      tone="blue"
                      label="Cobertura"
                      count={coveragePolygons.length}
                    />
                    <LayerToggle
                      active={showValenbisi}
                      onClick={() => setShowValenbisi((v) => !v)}
                      tone="slate"
                      label="Valenbisi"
                      count={valenbisiMarkers.length}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <DynamicMap
                    markers={mapMarkers}
                    polygons={coveragePolygons}
                    lines={trafficLines}
                    height={560}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <LegendDot color="#f97316" label="Tráfico" />
                  <LegendDot color="#2563eb" label="Cobertura deportiva" />
                  <LegendDot color="#059669" label="Cobertura sanitaria" />
                  <LegendDot color="#64748b" label="Valenbisi actual" />
                  <LegendDot color="#7c3aed" label="Recomendación" />
                  {layersLoading && <span>Cargando capas GIS...</span>}
                  {result && <span>Restricción aplicada: {result.constraint}</span>}
                </div>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Elegidas"
                  value={result?.n_selected ?? "—"}
                  tone="brand"
                  icon={<MapPin className="h-4 w-4" />}
                />
                <Stat
                  label={usesRealPopulation ? "Población cubierta" : "Impacto total"}
                  value={
                    result
                      ? usesRealPopulation && result.population_covered != null
                        ? result.population_covered.toLocaleString("es-ES")
                        : result.total_score.toFixed(2)
                      : "—"
                  }
                  tone="teal"
                  hint={usesRealPopulation ? "Nueva cobertura" : "Score ponderado"}
                />
                <Stat
                  label="Coste"
                  value={result ? result.total_cost.toFixed(1) : "—"}
                  hint={
                    budgetUsage != null
                      ? `${budgetUsage}% del presupuesto · medio ${avgCost}`
                      : `Coste medio: ${avgCost}`
                  }
                />
                <Stat
                  label="Modo"
                  value={modeValue}
                  hint={modeHint}
                />
              </div>

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
                    ? "La interfaz funciona, pero no ha podido obtener solución del backend. Revisa NEXT_PUBLIC_API_URL o que la API local esté arrancada."
                    : result
                      ? result.n_selected > 0
                        ? `El solver propone ${result.n_selected} ubicaciones${
                            budgetUsage != null
                              ? ` usando aproximadamente el ${budgetUsage}% del presupuesto`
                              : ""
                          }. La primera recomendación es el candidato #${topCandidate?.candidate_id}.`
                        : "El solver no ha seleccionado ubicaciones con esta restricción. Sube el presupuesto o reduce las exigencias del escenario."
                      : "Ejecutando PuLP/CBC sobre los artefactos curados del proyecto."}
                </Callout>
              )}
            </div>
          </section>

          {ran && result && result.selected.length > 0 && (
            <Card>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">Ranking de decisión</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    Ubicaciones recomendadas
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Ordenadas por impacto. Cada fila corresponde a un candidato
                    que el solver ha seleccionado para el escenario activo.
                  </p>
                </div>
                <Badge color="blue">{result.selected.length} candidatos</Badge>
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
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
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
        </>
      ) : (
        <section className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
            <Card>
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
                <div>
                  <p className="eyebrow">Método del optimizador</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    Formulación matemática del motor
                  </h3>
                  <MethodFormula
                    facility={facility}
                    constraint={constraint}
                    usesRealPopulation={usesRealPopulation}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
                <div>
                  <p className="eyebrow">Cómo leer la herramienta</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    De escenario a decisión
                  </h3>
                  <div className="mt-4 grid gap-3">
                    <InfoStep
                      icon={<MapIcon className="h-4 w-4" />}
                      title="1. Ajusta el escenario"
                      text="Selecciona servicio, presupuesto, N puntos o pesos de movilidad."
                    />
                    <InfoStep
                      icon={<Route className="h-4 w-4" />}
                      title="2. Revisa el mapa GIS"
                      text="Activa capas para ver tráfico, cobertura existente y estaciones actuales."
                    />
                    <InfoStep
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      title="3. Contrasta el ranking"
                      text="El ranking muestra qué ubicaciones cumplen mejor la restricción activa."
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
              <div className="min-w-0">
                <p className="eyebrow">Trazabilidad funcional</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Cobertura funcional del motor UrbanFlow
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Esta pestaña documenta qué piezas del motor están activas,
                  cuáles son capas de contexto y cuáles quedan como análisis
                  interno para mantener la app estable.
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
                      Los análisis experimentales se explican aquí, pero la ruta
                      pública ejecuta PuLP/CBC porque es reproducible, testeable y
                      más estable en despliegue.
                    </span>
                  </span>
                </Callout>
              </div>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

function MethodFormula({
  facility,
  constraint,
  usesRealPopulation,
}: {
  facility: FacilityMode;
  constraint: ConstraintMode;
  usesRealPopulation: boolean;
}) {
  const rows = usesRealPopulation
    ? [
        {
          label: "Objetivo",
          formula: "max Σⱼ pⱼ · Yⱼ",
          detail: "Maximizar habitantes nuevos cubiertos por el escenario.",
        },
        {
          label: "Cobertura",
          formula: "Yⱼ ≤ Σᵢ αᵢⱼ · Xᵢ",
          detail: "Un hexágono cuenta si cae dentro de una isócrona seleccionada.",
        },
        {
          label: "Presupuesto",
          formula: "Σᵢ costᵢ · Xᵢ ≤ presupuesto",
          detail: "La solución no supera el límite económico fijado.",
        },
      ]
    : [
        {
          label: "Score",
          formula: "scoreᵢ = wₜ·tráficoᵢ + wₚ·poblaciónᵢ + w_d·déficitᵢ",
          detail: "Cada candidato se valora con los pesos configurados.",
        },
        {
          label: "Objetivo",
          formula: "max Σᵢ scoreᵢ · xᵢ",
          detail: "Se seleccionan los puntos con mayor impacto conjunto.",
        },
        {
          label: constraint === "count" ? "N estaciones" : "Presupuesto",
          formula:
            constraint === "count"
              ? "Σᵢ xᵢ = N"
              : "Σᵢ costᵢ · xᵢ ≤ presupuesto",
          detail:
            constraint === "count"
              ? "El usuario fija exactamente cuántas estaciones quiere proponer."
              : "El solver decide cuántas estaciones caben en el coste máximo.",
        },
      ];

  if (facility === "multi") {
    rows.push(
      {
        label: "Balance",
        formula: "max λ·cobertura_deporte + (1−λ)·cobertura_salud",
        detail: "λ permite mover prioridad entre deporte y salud.",
      },
      {
        label: "No duplicidad",
        formula: "Xᵢ + X'ᵢ ≤ 1",
        detail: "Evita instalar dos servicios en el mismo candidato.",
      },
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {usesRealPopulation
              ? "Modelo de cobertura poblacional"
              : "Modelo de movilidad Valenbisi"}
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            {usesRealPopulation
              ? "Convierte isócronas y población en una decisión de cobertura nueva."
              : "Convierte tráfico, población y déficit en una priorización editable."}
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          PuLP · CBC
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {rows.map((row) => (
          <FormulaRow key={row.label} {...row} />
        ))}
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        {usesRealPopulation ? (
          <>
            <strong className="text-slate-800">αᵢⱼ</strong> vale 1 si el
            centroide del hexágono censal j cae dentro de la isócrona del
            candidato i. Así se mide nueva cobertura, no solo cercanía visual.
          </>
        ) : (
          <>
            El score se recalcula con los pesos elegidos por el usuario; por
            eso Valenbisi permite comparar planes por número de estaciones o por
            presupuesto disponible.
          </>
        )}
      </p>
    </div>
  );
}

function FormulaRow({
  label,
  formula,
  detail,
}: {
  label: string;
  formula: string;
  detail: string;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="min-w-0">
        <code className="block max-w-full whitespace-normal break-words rounded-md bg-slate-100 px-3 py-2 font-mono text-xs leading-6 text-slate-800 sm:text-sm">
          {formula}
        </code>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function TabButton({
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
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
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
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
        active
          ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
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
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
        active
          ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
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

function LayerToggle({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "amber" | "blue" | "slate";
}) {
  const toneMap = {
    amber: active
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-white text-slate-500",
    blue: active
      ? "border-brand-200 bg-brand-50 text-brand-800"
      : "border-slate-200 bg-white text-slate-500",
    slate: active
      ? "border-slate-300 bg-slate-100 text-slate-800"
      : "border-slate-200 bg-white text-slate-500",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition hover:border-slate-300 ${toneMap[tone]}`}
    >
      <span className="block">{label}</span>
      <span className="block text-[11px] font-medium opacity-70">
        {active ? `${count} elementos` : "Oculto"}
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
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700">
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

function InfoStep({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-slate-700 shadow-sm">
        {icon}
      </span>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
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
              ? "border-slate-300 bg-slate-100 text-slate-900"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function pointFeaturesToMarkers(
  collection: GeoJSONFeatureCollection,
  options: { color: string; label: string; limit: number; radius: number },
): MapMarker[] {
  return collection.features.slice(0, options.limit).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    const point = toLatLon(coordinates);
    if (!point) return [];

    return [
      {
        lat: point[0],
        lon: point[1],
        label: featureLabel(feature, options.label),
        color: options.color,
        radius: options.radius,
      },
    ];
  });
}

function lineFeaturesToLines(
  collection: GeoJSONFeatureCollection,
  options: { color: string; label: string; limit: number },
): MapLine[] {
  return collection.features.slice(0, options.limit).flatMap((feature) => {
    if (feature.geometry?.type !== "LineString") return [];
    if (!Array.isArray(feature.geometry.coordinates)) return [];

    const positions = feature.geometry.coordinates
      .map(toLatLon)
      .filter((point): point is [number, number] => Boolean(point));

    if (positions.length < 2) return [];

    return [
      {
        positions,
        label: featureLabel(feature, options.label),
        color: options.color,
        opacity: 0.38,
        weight: 2,
      },
    ];
  });
}

function polygonFeaturesToPolygons(
  collection: GeoJSONFeatureCollection,
  options: { color: string; label: string },
): MapPolygon[] {
  return collection.features.flatMap((feature) =>
    polygonRings(feature).map((positions) => ({
      positions,
      label: featureLabel(feature, options.label),
      color: options.color,
      fillOpacity: 0.08,
      weight: 1.2,
    })),
  );
}

function polygonRings(feature: GeoJSONFeature): [number, number][][] {
  const geometry = feature.geometry;
  if (!geometry) return [];

  if (geometry.type === "Polygon") {
    return ringsFromPolygon(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.flatMap(ringsFromPolygon);
  }

  return [];
}

function ringsFromPolygon(coordinates: unknown): [number, number][][] {
  if (!Array.isArray(coordinates)) return [];

  return coordinates.slice(0, 1).flatMap((ring) => {
    if (!Array.isArray(ring)) return [];

    const positions = ring
      .map(toLatLon)
      .filter((point): point is [number, number] => Boolean(point));

    return positions.length > 2 ? [positions] : [];
  });
}

function toLatLon(coordinates: unknown): [number, number] | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const [lon, lat] = coordinates;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  return [lat, lon];
}

function featureLabel(feature: GeoJSONFeature, fallback: string) {
  const props = feature.properties ?? {};
  const name = props.name ?? props.zona ?? props.id;

  if (typeof name === "string" || typeof name === "number") {
    return `${fallback}: ${name}`;
  }

  return fallback;
}

function formatFacilityType(type: string | null | undefined, fallback: FacilityMode) {
  if (type === "polideportivo") return "Polideportivo";
  if (type === "centro_salud") return "Centro de salud";
  return FACILITY_LABELS[fallback];
}

function formatModeName(mode: string, fallback: FacilityMode) {
  if (mode === "polideportivo") return "Polideportivo";
  if (mode === "centro_salud") return "Centro salud";
  if (mode === "coverage") return "Valenbisi";
  if (mode === "valenbisi") return "Valenbisi";
  if (mode === "multi") return "Multiobjetivo";
  return FACILITY_LABELS[fallback];
}

function getModeHint(facility: FacilityMode, constraint: ConstraintMode) {
  if (facility === "valenbisi") {
    return constraint === "count"
      ? "N estaciones + score"
      : "Presupuesto + score";
  }

  if (facility === "multi") return "Balance deporte/salud";
  if (facility === "health") return "Cobertura sanitaria";
  return "Cobertura deportiva";
}

function traceStatusColor(status: string): "green" | "amber" | "blue" {
  if (status === "Activo en API" || status === "Activo en app") return "green";
  if (status === "Parcial" || status === "Sustituido") return "amber";
  return "blue";
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
