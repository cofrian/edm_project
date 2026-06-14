import Link from "next/link";
import { ArrowRight, Brain, Map, Activity, GitBranch } from "lucide-react";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";
import { Card } from "@/components/Card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [meta, metrics] = await Promise.all([api.metadata(), api.metricsGlobal()]);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-8 text-white md:p-12">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-100">
          Smart City · EDM
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          UrbanFlow Valencia
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-brand-50">
          Predicción de la presión de tráfico urbano en Valencia con <strong>CatBoost</strong> y
          optimización de ubicaciones de movilidad sostenible con <strong>programación lineal
          entera</strong>. Evaluación rigurosa, despliegue y monitorización.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/prediccion" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-brand-700">
            Probar predicción <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/evaluacion" className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white">
            Ver evaluación del modelo
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MAE (holdout)" value={metrics.MAE} unit="veh/h" hint="Error absoluto medio" />
        <MetricCard label="RMSE" value={metrics.RMSE} />
        <MetricCard label="R²" value={metrics.R2} hint="Ajuste global" />
        <MetricCard label="sMAPE" value={metrics.sMAPE} unit="%" />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card title="La narrativa del proyecto">
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3"><Brain className="h-5 w-5 shrink-0 text-brand-600" /> CatBoost predice el tráfico por zona y hora.</li>
            <li className="flex gap-3"><Activity className="h-5 w-5 shrink-0 text-brand-600" /> Esa predicción se convierte en una señal de presión urbana.</li>
            <li className="flex gap-3"><Map className="h-5 w-5 shrink-0 text-brand-600" /> La optimización elige ubicaciones/actuaciones prioritarias.</li>
            <li className="flex gap-3"><GitBranch className="h-5 w-5 shrink-0 text-brand-600" /> Se despliega y monitoriza siguiendo el ciclo EDM.</li>
          </ol>
        </Card>
        <Card title="Modelo activo">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Modelo</dt><dd className="font-medium">{meta.model}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Validación</dt><dd className="font-medium">{meta.validation}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Datos</dt><dd className="font-medium">{meta.data_date}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Versión API</dt><dd className="font-medium">{meta.version}</dd></div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Modelo cargado</dt>
              <dd className="font-medium">{meta.model_loaded ? "sí" : "modo demo"}</dd>
            </div>
          </dl>
        </Card>
      </section>
    </div>
  );
}
