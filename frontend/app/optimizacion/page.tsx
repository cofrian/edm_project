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
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, Badge } from "@/components/Card";
import { Stat, PageHeader, Callout } from "@/components/ui";
import { DynamicMap } from "@/components/DynamicMap";
import type { OptimizeResponse } from "@/lib/types";

type Mode = "count" | "budget";

export default function OptimizacionPage() {
  const [mode, setMode] = useState<Mode>("count");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  // Modo "Nº fijo de ubicaciones"
  const [n, setN] = useState(10);
  // Modo "Presupuesto"
  const [budget, setBudget] = useState(100);

  // Pesos compartidos (interpretación común para el técnico)
  const [wTraf, setWTraf] = useState(1);
  const [wPob, setWPob] = useState(1);
  const [wDef, setWDef] = useState(1);

  async function run() {
    setLoading(true);
    setRan(true);
    const res =
      mode === "count"
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
    setResult(res);
    setLoading(false);
  }

  const markers =
    result?.selected.map((s) => ({
      lat: s.lat,
      lon: s.lon,
      label: `Ubicación #${s.candidate_id} · score ${s.score} · coste ${s.cost}`,
      color: "#1d4ed8",
    })) ?? [];

  const avgCost =
    result && result.n_selected > 0
      ? (result.total_cost / result.n_selected).toFixed(1)
      : "—";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Herramienta de decisión"
        title="Optimización de equipamientos urbanos"
        description="Selecciona qué ubicaciones candidatas instalar para maximizar el impacto ciudadano. El motor resuelve un problema de programación lineal entera (PuLP · CBC) sobre datos reales de Valencia."
      >
        <Badge color="blue">PuLP · CBC</Badge>
        <Badge color="green">Datos reales</Badge>
      </PageHeader>

      {/* Selector de modo */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeButton
          active={mode === "count"}
          onClick={() => setMode("count")}
          icon={<Target className="h-5 w-5" />}
          title="Nº fijo de ubicaciones"
          subtitle="Elijo cuántos equipamientos instalar (N) y busco los de mayor impacto."
        />
        <ModeButton
          active={mode === "budget"}
          onClick={() => setMode("budget")}
          icon={<Coins className="h-5 w-5" />}
          title="Presupuesto máximo"
          subtitle="Fijo el dinero disponible y busco la mejor combinación que cabe en él."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel de parámetros */}
        <Card className="lg:col-span-1">
          <h3 className="text-base font-bold text-slate-900">Escenario</h3>
          <p className="mt-1 text-sm text-slate-500">
            Ajusta la restricción y la importancia de cada criterio.
          </p>

          <div className="mt-5 space-y-5">
            {mode === "count" ? (
              <Field label="Número de equipamientos" value={n}>
                <input type="range" min={1} max={30} value={n} onChange={(e) => setN(+e.target.value)} className="range" />
                <Scale left="1" right="30" />
              </Field>
            ) : (
              <Field label="Presupuesto disponible" value={`${budget} u.`}>
                <input type="range" min={10} max={500} step={10} value={budget} onChange={(e) => setBudget(+e.target.value)} className="range" />
                <Scale left="10" right="500" />
              </Field>
            )}

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Importancia de cada criterio
              </p>
              <Weight icon={<Activity className="h-4 w-4 text-brand-600" />} label="Presión de tráfico" v={wTraf} set={setWTraf} />
              <Weight icon={<Users className="h-4 w-4 text-teal-600" />} label="Población alcanzable" v={wPob} set={setWPob} />
              <Weight icon={<Layers className="h-4 w-4 text-amber-600" />} label="Déficit de cobertura" v={wDef} set={setWDef} />
            </div>

            <button className="btn-primary w-full" onClick={run} disabled={loading}>
              <Play className="h-4 w-4" />
              {loading ? "Optimizando…" : "Ejecutar optimización"}
            </button>
            <p className="text-center text-xs text-slate-400">
              {mode === "count" ? "Restricción: Σ xᵢ = N" : "Restricción: Σ costeᵢ·xᵢ ≤ presupuesto"}
            </p>
          </div>
        </Card>

        {/* Resultados */}
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Ubicaciones elegidas" value={result?.n_selected ?? "—"} tone="brand" icon={<MapPin className="h-4 w-4" />} />
            <Stat label="Impacto total" value={result ? result.total_score.toFixed(2) : "—"} tone="teal" hint="Suma de scores ponderados" />
            <Stat label="Coste total" value={result ? result.total_cost.toFixed(1) : "—"} hint={`Coste medio: ${avgCost}`} />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Mapa de la propuesta</h3>
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

      {/* Ranking */}
      {ran && result && result.selected.length > 0 && (
        <Card>
          <h3 className="text-base font-bold text-slate-900">Ubicaciones recomendadas</h3>
          <p className="mt-1 text-sm text-slate-500">
            Ordenadas por impacto. Estas son las ubicaciones que el ayuntamiento debería priorizar.
          </p>
          <div className="mt-4 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">Prioridad</th>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Zona</th>
                  <th className="py-2 pr-3">Coordenadas</th>
                  <th className="py-2 pr-3">Impacto</th>
                  <th className="py-2">Coste</th>
                </tr>
              </thead>
              <tbody>
                {result.selected.map((s, i) => (
                  <tr key={s.candidate_id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-700">#{s.candidate_id}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{s.zona ?? "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-teal-600">{s.score}</td>
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
          No se seleccionó ninguna ubicación. Prueba a aumentar el presupuesto o
          el número de equipamientos, o revisa que la API esté disponible.
        </Callout>
      )}

      {/* Explicación del modelo */}
      <Card>
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Cómo se calcula la propuesta</h3>
            <p className="mt-1 text-sm text-slate-600">
              Cada ubicación candidata <em>i</em> recibe una variable binaria{" "}
              <code className="rounded bg-slate-100 px-1">xᵢ ∈ &#123;0,1&#125;</code> (instalar o no).
              Su atractivo combina los tres criterios normalizados:
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100 sm:text-sm">
              scoreᵢ = w_tráfico·tráficoᵢ + w_población·poblaciónᵢ + w_déficit·déficitᵢ<br />
              max Σ scoreᵢ·xᵢ<br />
              s.a. {mode === "count" ? "Σ xᵢ = N" : "Σ costeᵢ·xᵢ ≤ presupuesto"}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              El solver <strong>CBC</strong> (vía PuLP) encuentra la combinación
              óptima global, no una heurística. La presión de tráfico procede del
              modelo CatBoost; la población alcanzable y el déficit, de las
              isócronas y los equipamientos existentes.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge color="blue">Programación lineal entera</Badge>
              <Badge color="green">Óptimo global</Badge>
              <Badge color="amber">Datos reales de Valencia</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
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
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>
        {icon}
      </span>
      <span>
        <span className={`block font-semibold ${active ? "text-brand-800" : "text-slate-900"}`}>{title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span>
      </span>
    </button>
  );
}

function Field({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">{value}</span>
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

function Weight({ icon, label, v, set }: { icon: React.ReactNode; label: string; v: number; set: (n: number) => void }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-slate-600">{icon}{label}</span>
        <span className="text-xs font-semibold text-slate-500">{v.toFixed(1)}</span>
      </div>
      <input type="range" min={0} max={3} step={0.1} value={v} onChange={(e) => set(+e.target.value)} className="range" />
    </div>
  );
}
