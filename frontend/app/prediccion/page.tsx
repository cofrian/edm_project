"use client";

import { useState } from "react";
import { ArrowRight, Gauge } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { DIAS_SEMANA, NIVEL_COLORS } from "@/lib/constants";
import { Card, Badge } from "@/components/Card";
import { PageHeader, Callout } from "@/components/ui";
import type { PredictResponse } from "@/lib/types";

export default function PrediccionPage() {
  const [form, setForm] = useState({
    zona: 1,
    hora: 8,
    dia_semana: 1,
    temp_c: 20,
    hum_rel: 60,
    pres_mb: 1015,
    vel_viento_ms: 2,
    precip_lm2: 0,
  });
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: number) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await api.predict(form);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Modelo de demanda · CatBoost"
        title="Presión de tráfico por zona y hora"
        description="Esta es la señal de demanda que alimenta al optimizador. Estima la intensidad de tráfico (vehículos/hora) y su nivel de presión, un indicador de actividad urbana."
      >
        <Badge color="green">CatBoost por hora</Badge>
      </PageHeader>

      <Callout tone="brand" title="¿Por qué importa para la optimización?">
        Las zonas con mayor presión de tráfico concentran más actividad
        ciudadana. El optimizador usa esta estimación como uno de los criterios
        para priorizar dónde instalar nuevos equipamientos.
      </Callout>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Parámetros de consulta">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Zona</label>
                <input className="input" type="number" min={0} value={form.zona} onChange={(e) => update("zona", +e.target.value)} />
              </div>
              <div>
                <label className="label">Hora (0–23)</label>
                <input className="input" type="number" min={0} max={23} value={form.hora} onChange={(e) => update("hora", +e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Día de la semana</label>
              <select className="input" value={form.dia_semana} onChange={(e) => update("dia_semana", +e.target.value)}>
                {DIAS_SEMANA.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Temperatura (ºC)</label>
                <input className="input" type="number" value={form.temp_c} onChange={(e) => update("temp_c", +e.target.value)} />
              </div>
              <div>
                <label className="label">Humedad (%)</label>
                <input className="input" type="number" value={form.hum_rel} onChange={(e) => update("hum_rel", +e.target.value)} />
              </div>
              <div>
                <label className="label">Presión (mb)</label>
                <input className="input" type="number" value={form.pres_mb} onChange={(e) => update("pres_mb", +e.target.value)} />
              </div>
              <div>
                <label className="label">Precipitación (l/m²)</label>
                <input className="input" type="number" value={form.precip_lm2} onChange={(e) => update("precip_lm2", +e.target.value)} />
              </div>
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              <Gauge className="h-4 w-4" />
              {loading ? "Calculando…" : "Estimar presión de tráfico"}
            </button>
          </form>
        </Card>

        <Card title="Resultado">
          {!result ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center text-sm text-slate-400">
              <Gauge className="mb-2 h-8 w-8 text-slate-300" />
              <p>Envía el formulario para ver la estimación.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Intensidad estimada</p>
                <p className="mt-1 text-4xl font-bold text-slate-900">
                  {result.intensidad}
                  <span className="ml-1 text-lg font-medium text-slate-400">veh/h</span>
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-slate-500">Nivel de presión:</span>
                  <span className="badge text-white" style={{ backgroundColor: NIVEL_COLORS[result.nivel] }}>
                    {result.nivel.toUpperCase()}
                  </span>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2"><dt className="text-slate-500">Baseline histórico</dt><dd className="font-medium">{result.baseline} veh/h</dd></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><dt className="text-slate-500">Fiabilidad (por hora)</dt><dd className="font-medium">{result.fiabilidad}</dd></div>
                {result.mae_hora != null && (
                  <div className="flex justify-between"><dt className="text-slate-500">MAE histórico de esta hora</dt><dd className="font-medium">{result.mae_hora} veh/h</dd></div>
                )}
              </dl>
              <Link href="/optimizacion" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:gap-2.5">
                Usar esta señal en el optimizador <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
