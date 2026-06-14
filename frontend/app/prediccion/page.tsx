"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { DIAS_SEMANA, NIVEL_COLORS } from "@/lib/constants";
import { Card, Badge } from "@/components/Card";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Predicción de tráfico</h1>
        <p className="mt-2 text-slate-600">
          Introduce zona, hora, tipo de día y meteorología. El modelo CatBoost devuelve la
          intensidad estimada (veh/h) y el nivel de presión.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Parámetros">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Zona</label>
                <input className="input" type="number" min={0} value={form.zona}
                  onChange={(e) => update("zona", +e.target.value)} />
              </div>
              <div>
                <label className="label">Hora</label>
                <input className="input" type="number" min={0} max={23} value={form.hora}
                  onChange={(e) => update("hora", +e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Día de la semana</label>
              <select className="input" value={form.dia_semana}
                onChange={(e) => update("dia_semana", +e.target.value)}>
                {DIAS_SEMANA.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Temperatura (ºC)</label>
                <input className="input" type="number" value={form.temp_c}
                  onChange={(e) => update("temp_c", +e.target.value)} />
              </div>
              <div>
                <label className="label">Humedad (%)</label>
                <input className="input" type="number" value={form.hum_rel}
                  onChange={(e) => update("hum_rel", +e.target.value)} />
              </div>
              <div>
                <label className="label">Presión (mb)</label>
                <input className="input" type="number" value={form.pres_mb}
                  onChange={(e) => update("pres_mb", +e.target.value)} />
              </div>
              <div>
                <label className="label">Precipitación (l/m²)</label>
                <input className="input" type="number" value={form.precip_lm2}
                  onChange={(e) => update("precip_lm2", +e.target.value)} />
              </div>
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Calculando…" : "Predecir intensidad"}
            </button>
          </form>
        </Card>

        <Card title="Resultado">
          {!result ? (
            <p className="text-sm text-slate-400">Envía el formulario para ver la predicción.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Intensidad estimada</p>
                <p className="text-4xl font-bold text-slate-900">
                  {result.intensidad}
                  <span className="ml-1 text-lg font-normal text-slate-400">veh/h</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">Nivel de presión:</span>
                <span className="badge text-white" style={{ backgroundColor: NIVEL_COLORS[result.nivel] }}>
                  {result.nivel.toUpperCase()}
                </span>
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Baseline histórico</dt><dd>{result.baseline} veh/h</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Fiabilidad (por hora)</dt><dd>{result.fiabilidad}</dd></div>
                {result.mae_hora != null && (
                  <div className="flex justify-between"><dt className="text-slate-500">MAE histórico de esta hora</dt><dd>{result.mae_hora} veh/h</dd></div>
                )}
              </dl>
              <Badge color="blue">Modelo: CatBoost por hora</Badge>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
