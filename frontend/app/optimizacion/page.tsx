"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Card, Badge } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { DynamicMap } from "@/components/DynamicMap";
import type { OptimizeResponse } from "@/lib/types";

type Mode = "valenbisi" | "coverage";

export default function OptimizacionPage() {
  const [mode, setMode] = useState<Mode>("valenbisi");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Modo A
  const [n, setN] = useState(10);
  const [aTraf, setATraf] = useState(1);
  const [aPob, setAPob] = useState(1);
  const [aDef, setADef] = useState(1);
  // Modo B
  const [budget, setBudget] = useState(100);
  const [bPob, setBPob] = useState(1);
  const [bTraf, setBTraf] = useState(1);
  const [bDef, setBDef] = useState(1);

  async function run() {
    setLoading(true);
    const res =
      mode === "valenbisi"
        ? await api.optimizeValenbisi({
            n,
            alpha_trafico: aTraf,
            beta_poblacion: aPob,
            gamma_deficit: aDef,
          })
        : await api.optimizeCoverage({
            presupuesto: budget,
            alpha_poblacion: bPob,
            beta_trafico: bTraf,
            gamma_deficit: bDef,
          });
    setResult(res);
    setLoading(false);
  }

  const markers =
    result?.selected.map((s) => ({
      lat: s.lat,
      lon: s.lon,
      label: `#${s.candidate_id} · score ${s.score} · coste ${s.cost}`,
      color: "#dc2626",
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Optimización urbana</h1>
        <p className="mt-2 text-slate-600">
          Selección óptima de ubicaciones con <strong>programación lineal entera (PuLP)</strong>.
          La presión de tráfico proviene de las predicciones de CatBoost.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("valenbisi")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "valenbisi" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Modo A · Movilidad sostenible / Valenbisi
        </button>
        <button
          onClick={() => setMode("coverage")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "coverage" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Modo B · Cobertura urbana
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Parámetros" className="lg:col-span-1">
          {mode === "valenbisi" ? (
            <div className="space-y-4">
              <Field label={`Nº ubicaciones (N = ${n})`}>
                <input type="range" min={1} max={30} value={n} onChange={(e) => setN(+e.target.value)} className="w-full" />
              </Field>
              <Weight label="Peso tráfico" v={aTraf} set={setATraf} />
              <Weight label="Peso población" v={aPob} set={setAPob} />
              <Weight label="Peso déficit Valenbisi" v={aDef} set={setADef} />
              <p className="text-xs text-slate-400">Restricción: Σ xᵢ = N · xᵢ ∈ &#123;0,1&#125;</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label={`Presupuesto (${budget})`}>
                <input type="range" min={10} max={500} step={10} value={budget} onChange={(e) => setBudget(+e.target.value)} className="w-full" />
              </Field>
              <Weight label="Peso población cubierta" v={bPob} set={setBPob} />
              <Weight label="Peso presión de tráfico" v={bTraf} set={setBTraf} />
              <Weight label="Peso déficit de cobertura" v={bDef} set={setBDef} />
              <p className="text-xs text-slate-400">Restricción: Σ costeᵢ·xᵢ ≤ presupuesto</p>
            </div>
          )}
          <button className="btn-primary mt-5 w-full" onClick={run} disabled={loading}>
            {loading ? "Optimizando…" : "Ejecutar optimización"}
          </button>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Seleccionados" value={result?.n_selected ?? "—"} />
            <MetricCard label="Score total" value={result ? result.total_score.toFixed(2) : "—"} />
            <MetricCard label="Coste total" value={result ? result.total_cost.toFixed(2) : "—"} />
          </div>
          <Card title="Mapa de ubicaciones seleccionadas">
            <DynamicMap markers={markers} />
            {result && (
              <p className="mt-2 text-xs text-slate-400">Restricción aplicada: {result.constraint}</p>
            )}
          </Card>
        </div>
      </div>

      {result && result.selected.length > 0 && (
        <Card title="Ranking de candidatos seleccionados">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">#</th>
                  <th className="py-2">Zona</th>
                  <th className="py-2">Lat</th>
                  <th className="py-2">Lon</th>
                  <th className="py-2">Score</th>
                  <th className="py-2">Coste</th>
                </tr>
              </thead>
              <tbody>
                {result.selected.map((s) => (
                  <tr key={s.candidate_id} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium">{s.candidate_id}</td>
                    <td className="py-1.5">{s.zona ?? "—"}</td>
                    <td className="py-1.5">{s.lat.toFixed(4)}</td>
                    <td className="py-1.5">{s.lon.toFixed(4)}</td>
                    <td className="py-1.5">{s.score}</td>
                    <td className="py-1.5">{s.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge color="blue">Solver: PuLP (CBC)</Badge>
            <Badge color="green">Tráfico = predicción CatBoost</Badge>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Weight({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  return (
    <Field label={`${label} (${v.toFixed(1)})`}>
      <input type="range" min={0} max={3} step={0.1} value={v} onChange={(e) => set(+e.target.value)} className="w-full" />
    </Field>
  );
}
