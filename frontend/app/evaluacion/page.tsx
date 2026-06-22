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
    <div className="space-y-10">
      <PageHeader
        eyebrow="CRISP-DM · Evaluation"
        title="Evaluación del modelo de demanda"
        description={`Resultados del modelo CatBoost al probarlo con datos que no usó para entrenar (25-31 octubre 2023).${g.validation ? ` ${g.validation}.` : ""}`}
      >
        <Badge color="blue">Validación temporal</Badge>
        <Badge color="green">CatBoost</Badge>
      </PageHeader>

      <Callout tone="teal" title="Por qué importa esta evaluación">
        El optimizador usa la demanda prevista para tomar decisiones. Por eso
        probamos el modelo con días posteriores a los de entrenamiento: así vemos
        si funciona bien con datos nuevos.
      </Callout>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MAE" value={g.MAE} unit="veh/h" hint="Error absoluto medio" tone="brand" />
        <Stat label="RMSE" value={g.RMSE} hint="Da más peso a errores grandes" />
        <Stat label="R²" value={g.R2} hint="Calidad general del ajuste" tone="teal" />
        <Stat label="sMAPE" value={g.sMAPE} unit="%" hint="Error porcentual" />
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <Card title="MAE por hora" description="Error medio del modelo en cada hora del día.">
          {byHour.length ? (
            <BarMetric data={byHour as unknown as Record<string, number>[]} xKey="Hora" yKey="MAE" />
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="R² por hora" description="Qué tal ajusta el modelo en cada hora. Cuanto más cerca de 1, mejor.">
          {byHour.length ? (
            <LineMetric data={byHour as unknown as Record<string, number>[]} xKey="Hora" yKey="R2" />
          ) : (
            <Empty />
          )}
        </Card>
      </div>

      <div className="grid gap-7 lg:grid-cols-2">
        <Card title="Real vs predicho" description="Comparación entre el tráfico real y el que predijo el modelo.">
          {scatter.length ? <ScatterRealPred data={scatter} /> : <Empty note="Falta generar validation_predictions.csv" />}
        </Card>
        <Card title="Zonas con más error" description="Zonas donde el modelo se equivoca más, según el MAE.">
          {zones.length ? (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2">Zona</th>
                    <th className="py-2">Calle / sensor</th>
                    <th className="py-2">MAE</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.Zona} className="border-b border-slate-100/80 last:border-0">
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
            <Empty note="Falta generar validation_predictions.csv" />
          )}
        </Card>
      </div>
    </div>
  );
}

function Empty({ note }: { note?: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
      <p>Sin datos disponibles.</p>
      {note && <p className="mt-1 text-xs">{note}</p>}
    </div>
  );
}
