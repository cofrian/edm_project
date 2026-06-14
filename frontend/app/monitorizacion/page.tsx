import { api } from "@/lib/api";
import { Card, Badge } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { BarMetric } from "@/components/charts/BarMetric";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitorización · UrbanFlow Valencia" };

export default async function MonitorizacionPage() {
  const m = await api.monitoring();
  const hasAlerts = m.alerts.some((a) => a.nivel !== "ok");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Monitorización y fiabilidad</h1>
        <p className="mt-2 text-slate-600">
          Seguimiento del error del modelo por hora y zona, con alertas cuando el MAE supera el
          umbral. Cubre el bloque de monitorización del temario EDM.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Modelo activo" value={m.model_active.split("(")[0]} />
        <MetricCard label="Fecha de datos" value={m.data_date} />
        <MetricCard label="MAE global" value={m.mae_global ?? "—"} unit="veh/h" />
        <MetricCard label="Umbral de alerta" value={m.mae_threshold} unit="veh/h" />
      </section>

      <Card title="Alertas de fiabilidad">
        <div className="space-y-2">
          {m.alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
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
              color={hasAlerts ? "#dc2626" : "#2563eb"}
            />
          ) : (
            <p className="text-sm text-slate-400">Sin datos de métricas por hora.</p>
          )}
        </Card>
        <Card title="Top zonas con más error">
          {m.top_error_zones.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500"><th className="py-1">Zona</th><th className="py-1">MAE</th></tr>
              </thead>
              <tbody>
                {m.top_error_zones.map((z) => (
                  <tr key={z.Zona} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium">{z.Zona}</td>
                    <td className="py-1.5">{z.mae}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-400">Genera validation_predictions.csv para ver errores por zona.</p>
          )}
        </Card>
      </div>

      <Card title="Drift y limitaciones">
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>Los datos son de octubre 2023; un cambio estacional o de sensores puede degradar el modelo (drift).</li>
          <li>Las horas valle (madrugada) y algunas zonas periféricas tienen mayor sMAPE: interpretar con cautela.</li>
          <li>En producción se reentrenaría periódicamente y se compararía el error vivo contra este baseline.</li>
        </ul>
        <div className="mt-3"><Badge color="blue">EDM: Monitoring / ModelOps</Badge></div>
      </Card>
    </div>
  );
}
