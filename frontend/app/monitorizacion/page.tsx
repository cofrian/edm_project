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
    <div className="space-y-8">
      <PageHeader
        eyebrow="EDM · Monitoring & ModelOps"
        title="Monitorización y fiabilidad"
        description="Seguimiento del error del modelo por hora y zona, con alertas cuando el MAE supera el umbral. Garantiza que la señal de demanda sigue siendo válida en el tiempo."
      >
        <Badge color={hasAlerts ? "amber" : "green"}>
          {hasAlerts ? "Con avisos" : "Estable"}
        </Badge>
      </PageHeader>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Modelo activo" value={m.model_active.split("(")[0]} tone="brand" />
        <Stat label="Fecha de datos" value={m.data_date} />
        <Stat label="MAE global" value={m.mae_global ?? "—"} unit="veh/h" />
        <Stat label="Umbral de alerta" value={m.mae_threshold} unit="veh/h" tone="amber" />
      </section>

      <Card title="Alertas de fiabilidad">
        <div className="space-y-2">
          {m.alerts.length === 0 && (
            <p className="text-sm text-slate-400">Sin alertas registradas.</p>
          )}
          {m.alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="MAE por hora" description="Franjas con mayor error → menor confianza.">
          {m.mae_by_hour.length ? (
            <BarMetric
              data={m.mae_by_hour as unknown as Record<string, number>[]}
              xKey="Hora"
              yKey="MAE"
              color={hasAlerts ? "#dc2626" : "#1d4ed8"}
            />
          ) : (
            <p className="text-sm text-slate-400">Sin datos de métricas por hora.</p>
          )}
        </Card>
        <Card title="Top zonas con más error">
          {m.top_error_zones.length ? (
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
                  {m.top_error_zones.map((z) => (
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
            <p className="text-sm text-slate-400">Genera validation_predictions.csv para ver errores por zona.</p>
          )}
        </Card>
      </div>

      <Card title="Drift y limitaciones">
        <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li className="rounded-lg bg-slate-50 p-3">Datos de octubre 2023; un cambio estacional o de sensores puede degradar el modelo (drift).</li>
          <li className="rounded-lg bg-slate-50 p-3">Horas valle y zonas periféricas tienen mayor sMAPE: interpretar con cautela.</li>
          <li className="rounded-lg bg-slate-50 p-3">En producción se reentrenaría periódicamente comparando el error vivo contra este baseline.</li>
          <li className="rounded-lg bg-slate-50 p-3">La cobertura de población usa un proxy geométrico documentado en la optimización.</li>
        </ul>
        <div className="mt-3"><Badge color="blue">EDM: Monitoring / ModelOps</Badge></div>
      </Card>
    </div>
  );
}
