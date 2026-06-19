import { api } from "@/lib/api";
import { Card, Badge } from "@/components/Card";
import { PageHeader, Stat, Callout } from "@/components/ui";
import { BarMetric } from "@/components/charts/BarMetric";
import { LineMetric } from "@/components/charts/LineMetric";
import { ScatterRealPred } from "@/components/charts/ScatterRealPred";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evaluación" };

export default async function EvaluacionPage() {
  const [g, byHour, zones, scatter] = await Promise.all([
    api.metricsGlobal(),
    api.metricsByHour(),
    api.errorsByZone(12),
    api.scatter(500),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CRISP-DM · Evaluation"
        title="Evaluación del modelo de demanda"
        description={`Métricas reales de CatBoost en validación temporal (holdout 25–31 octubre 2023).${g.validation ? ` ${g.validation}.` : ""}`}
      >
        <Badge color="blue">Validación temporal</Badge>
        <Badge color="green">CatBoost</Badge>
      </PageHeader>

      <Callout tone="teal" title="Por qué evaluamos con rigor">
        El optimizador es tan bueno como su señal de demanda. Una validación
        temporal honesta (entrenar con el pasado, evaluar con el futuro) garantiza
        que la presión de tráfico que entra en la optimización es fiable.
      </Callout>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MAE" value={g.MAE} unit="veh/h" hint="Error absoluto medio" tone="brand" />
        <Stat label="RMSE" value={g.RMSE} hint="Penaliza errores grandes" />
        <Stat label="R²" value={g.R2} hint="Ajuste global (→1 mejor)" tone="teal" />
        <Stat label="sMAPE" value={g.sMAPE} unit="%" hint="Error porcentual" />
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
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2">Zona</th>
                    <th className="py-2">Calle / sensor</th>
                    <th className="py-2">MAE</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.Zona} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 font-medium text-slate-700">{z.Zona}</td>
                      <td className="max-w-xs truncate py-2 text-slate-600" title={z.descripcion ?? z.calle}>
                        {z.descripcion ?? z.calle ?? "—"}
                      </td>
                      <td className="py-2 text-slate-600">{z.mae}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    <div className="flex h-[260px] flex-col items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
      <p>Sin datos disponibles.</p>
      {note && <p className="mt-1 text-xs">{note}</p>}
    </div>
  );
}
