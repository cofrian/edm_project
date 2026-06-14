import { api } from "@/lib/api";
import { Card, Badge } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { BarMetric } from "@/components/charts/BarMetric";
import { LineMetric } from "@/components/charts/LineMetric";
import { ScatterRealPred } from "@/components/charts/ScatterRealPred";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evaluación · UrbanFlow Valencia" };

export default async function EvaluacionPage() {
  const [g, byHour, zones, scatter] = await Promise.all([
    api.metricsGlobal(),
    api.metricsByHour(),
    api.errorsByZone(12),
    api.scatter(500),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Evaluación del modelo</h1>
        <p className="mt-2 text-slate-600">
          Métricas reales de CatBoost en validación temporal (holdout 25–31 octubre 2023).
          {g.validation ? ` ${g.validation}.` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge color="blue">Validación temporal</Badge>
          <Badge color="green">CatBoost (modelo final)</Badge>
          <Badge color="slate">No mezclado con LightGBM</Badge>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MAE" value={g.MAE} unit="veh/h" />
        <MetricCard label="RMSE" value={g.RMSE} />
        <MetricCard label="R²" value={g.R2} />
        <MetricCard label="sMAPE" value={g.sMAPE} unit="%" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="MAE por hora" description="Error absoluto medio en cada franja horaria.">
          {byHour.length ? (
            <BarMetric data={byHour as unknown as Record<string, number>[]} xKey="Hora" yKey="MAE" />
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="R² por hora" description="Calidad de ajuste por hora (cuanto más cerca de 1, mejor).">
          {byHour.length ? (
            <LineMetric data={byHour as unknown as Record<string, number>[]} xKey="Hora" yKey="R2" />
          ) : (
            <Empty />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Real vs Predicho" description="Dispersión sobre el holdout (muestra).">
          {scatter.length ? <ScatterRealPred data={scatter} /> : <Empty note="Genera validation_predictions.csv" />}
        </Card>
        <Card title="Zonas con más error" description="Top zonas por MAE en validación.">
          {zones.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Zona</th>
                  <th className="py-1">MAE</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.Zona} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium">{z.Zona}</td>
                    <td className="py-1.5">{z.mae}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty note="Genera validation_predictions.csv" />
          )}
        </Card>
      </div>
    </div>
  );
}

function Empty({ note }: { note?: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
      <p>Sin datos disponibles.</p>
      {note && <p className="mt-1 text-xs">{note}</p>}
    </div>
  );
}
