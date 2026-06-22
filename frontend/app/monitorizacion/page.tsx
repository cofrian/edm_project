import { api } from "@/lib/api";
import { Card, Badge } from "@/components/Card";
import { PageHeader, Stat } from "@/components/ui";
import { BarMetric } from "@/components/charts/BarMetric";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitorización" };

export default async function MonitorizacionPage() {
  const m = await api.monitoring();
  const hasAlerts = m.alerts.some((a) => a.nivel !== "ok");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Monitorización"
        title="Monitorización y fiabilidad"
        description="Seguimiento del error del modelo por hora y zona. La app avisa cuando el error es alto para saber si las predicciones siguen siendo fiables."
      >
        <Badge color={hasAlerts ? "amber" : "green"}>
          {hasAlerts ? "Con avisos" : "Estable"}
        </Badge>
      </PageHeader>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Modelo activo" value={m.model_active.split("(")[0]} tone="brand" />
        <Stat label="Fecha de datos" value={m.data_date} />
        <Stat label="MAE global" value={m.mae_global ?? "—"} unit="veh/h" />
        <Stat label="Umbral de alerta" value={m.mae_threshold} unit="veh/h" tone="amber" />
      </section>

      <Card title="Alertas de fiabilidad">
        <div className="space-y-2">
          {m.alerts.length === 0 && (
            <p className="text-sm text-slate-400">No hay alertas registradas.</p>
          )}
          {m.alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-2xl p-4 text-sm ${
                a.nivel === "ok"
                  ? "bg-green-50 text-green-800"
                  : a.nivel === "alta"
                  ? "bg-red-50 text-red-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {a.nivel === "ok" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{a.mensaje}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-7 lg:grid-cols-2">
        <Card title="MAE por hora" description="Horas en las que el modelo se equivoca más. Si el error sube, la confianza baja.">
          {m.mae_by_hour.length ? (
            <BarMetric
              data={m.mae_by_hour as unknown as Record<string, number>[]}
              xKey="Hora"
              yKey="MAE"
              color={hasAlerts ? "#dc2626" : "#0f172a"}
            />
          ) : (
            <p className="text-sm text-slate-400">Sin datos de métricas por hora.</p>
          )}
        </Card>
        <Card title="Zonas con más error">
          {m.top_error_zones.length ? (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Zona</th>
                    <th className="py-2 pr-3">Calle / sensor</th>
                    <th className="py-2 text-right">MAE</th>
                  </tr>
                </thead>
                <tbody>
                  {m.top_error_zones.map((z) => (
                    <tr key={z.Zona} className="border-b border-slate-100/80 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-700">{z.Zona}</td>
                      <td className="max-w-[220px] truncate py-2 pr-3 text-slate-600" title={z.descripcion ?? z.calle}>
                        {z.descripcion ?? z.calle ?? "—"}
                      </td>
                      <td className="py-2 text-right text-slate-600">{z.mae}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Falta generar validation_predictions.csv para ver errores por zona.</p>
          )}
        </Card>
      </div>

      <Card title="Limitaciones a tener en cuenta">
        <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li className="rounded-2xl bg-slate-50 p-4">El modelo usa datos de octubre de 2023. Si cambian los sensores o la movilidad de la ciudad, puede perder precisión.</li>
          <li className="rounded-2xl bg-slate-50 p-4">En horas con poco tráfico y zonas periféricas el error puede ser mayor. Conviene interpretar esos casos con cuidado.</li>
          <li className="rounded-2xl bg-slate-50 p-4">En un uso real habría que reentrenar el modelo cada cierto tiempo y comparar si el error mejora o empeora.</li>
          <li className="rounded-2xl bg-slate-50 p-4">La cobertura se calcula con zonas de población e isócronas. Antes de decidir de verdad, habría que revisarlo con criterio urbanístico.</li>
        </ul>
        <div className="mt-3"><Badge color="blue">Seguimiento del modelo</Badge></div>
      </Card>
    </div>
  );
}
