"use client";

import Link from "next/link";
import { AlertTriangle, Cpu, HardDrive } from "lucide-react";
import { Card } from "@/components/Card";
import type {
  CityEvent,
  GlobalMetrics,
  HeatmapResponse,
  HourMetric,
  Monitoring,
  SystemMetrics,
  TrafficLiveResponse,
  ZoneReviewResponse,
  ZoneError,
} from "@/lib/types";
import { TRAFFIC_ESTADO_COLORS, TRAFFIC_ESTADO_LABELS } from "@/lib/constants";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function ResumenPanel({
  viewingNow,
  traffic,
  trafficError,
  trafficStats,
  stats,
  loading,
  activeEventsCount,
  hora,
}: {
  viewingNow: boolean;
  traffic: TrafficLiveResponse | null;
  trafficError: string | null;
  trafficStats: Record<string, number>;
  stats: { avg: string; alta: number; total: number } | null;
  loading: boolean;
  activeEventsCount: number;
  hora: number;
}) {
  return (
    <Card title={viewingNow ? "Tráfico en vivo" : "Predicción CatBoost"}>
      {viewingNow ? (
        traffic && !trafficError ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-slate-500">Tramos</dt>
              <dd className="text-lg font-semibold">{traffic.n_tramos ?? 0}</dd>
            </div>
            {traffic.n_with_intensidad_vh != null && (
              <div>
                <dt className="text-slate-500">Con veh/h</dt>
                <dd className="text-lg font-semibold">{traffic.n_with_intensidad_vh}</dd>
              </div>
            )}
            {Object.entries(TRAFFIC_ESTADO_LABELS).slice(0, 2).map(([key, label]) => (
              <div key={key}>
                <dt className="inline-flex items-center gap-1 text-slate-500">
                  <span className="h-2 w-3 rounded-full" style={{ backgroundColor: TRAFFIC_ESTADO_COLORS[key] }} />
                  {label}
                </dt>
                <dd className="text-lg font-semibold">{trafficStats[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">Cargando tráfico en vivo…</p>
        )
      ) : stats ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-slate-500">Zonas modelo</dt>
            <dd className="text-lg font-semibold">{stats.total}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Media veh/h</dt>
            <dd className="text-lg font-semibold">{stats.avg}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Presión alta</dt>
            <dd className="text-lg font-semibold text-red-600">{stats.alta}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Eventos activos</dt>
            <dd className="text-lg font-semibold">{activeEventsCount} a las {hora}:00</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-slate-400">{loading ? "Calculando…" : "Sin predicción."}</p>
      )}
    </Card>
  );
}

export function EventosPanel({
  dayEvents,
  activeEvents,
  selectedEventId,
  onSelectEvent,
  hora,
  affectedCount,
}: {
  dayEvents: CityEvent[];
  activeEvents: CityEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  hora: number;
  affectedCount: number;
}) {
  return (
    <Card title="Eventos del día">
      <p className="mb-3 text-xs text-slate-500">
        {dayEvents.length} eventos · {activeEvents.length} activos a las {hora}:00
        {affectedCount > 0 ? ` · ${affectedCount} tramos afectados` : ""}
      </p>
      <ul className="scroll-thin max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {dayEvents.length === 0 && (
          <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
            Sin eventos este día.
          </li>
        )}
        {dayEvents.map((ev) => {
          const isActive = activeEvents.some((a) => a.id === ev.id);
          const isSelected = selectedEventId === ev.id;
          return (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => onSelectEvent(isSelected ? null : ev.id)}
                className={`flex w-full rounded-xl border p-2.5 text-left transition ${
                  isSelected
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                    : isActive
                      ? "border-violet-200 bg-violet-50/60"
                      : "border-slate-100 bg-white hover:border-slate-200"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{ev.nombre}</p>
                  <p className="text-xs capitalize text-violet-600">{ev.tipo}</p>
                  <p className="text-xs text-slate-500">
                    {formatTime(ev.inicio)} – {formatTime(ev.fin)}
                  </p>
                  {ev.direccion && (
                    <p className="truncate text-[11px] text-slate-400">{ev.direccion}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function EvaluacionPanel({
  hora,
  global,
  hourMetrics,
  zoneErrors,
  highPressureZones,
  loading,
}: {
  hora: number;
  global: GlobalMetrics | null;
  hourMetrics: HourMetric | null;
  zoneErrors: ZoneError[];
  highPressureZones: HeatmapResponse["points"];
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card title={`Evaluación · ${hora}:00 (EDM T1)`}>
        <p className="mb-3 text-xs text-slate-500">
          CRISP-DM · fase Evaluation. Métricas holdout oct-2023: global + franja horaria seleccionada.
        </p>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando métricas…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {global && (
              <>
                <MetricBox label="MAE global" value={global.MAE} unit="veh/h" />
                <MetricBox label="R² global" value={global.R2} />
                <MetricBox label="sMAPE global" value={global.sMAPE} unit="%" />
              </>
            )}
            {hourMetrics ? (
              <>
                <MetricBox label={`MAE h${hora}`} value={hourMetrics.MAE} unit="veh/h" tone="brand" />
                <MetricBox label={`R² h${hora}`} value={hourMetrics.R2} tone="brand" />
              </>
            ) : (
              <p className="col-span-2 text-sm text-slate-400">Sin métricas para esta hora.</p>
            )}
          </div>
        )}
        <Link href="/evaluacion" className="mt-3 inline-block text-xs font-semibold text-brand-700">
          Ver evaluación completa →
        </Link>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Zonas con más error (esta hora)" description="Validación · calle indicada">
          <ZoneTable
            rows={zoneErrors.map((z) => ({
              zona: z.Zona,
              calle: z.descripcion ?? z.calle ?? `Zona ${z.Zona}`,
              value: z.mae,
              unit: "MAE",
            }))}
            empty="Sin datos de validación para esta hora."
          />
        </Card>
        <Card title="Predicción presión alta (esta hora)" description="CatBoost · calles a vigilar">
          <ZoneTable
            rows={highPressureZones.slice(0, 12).map((p) => ({
              zona: p.zona,
              calle: p.descripcion ?? `Zona ${p.zona}`,
              value: p.intensidad,
              unit: "veh/h",
            }))}
            empty="Sin zonas en nivel alto a esta hora."
          />
        </Card>
      </div>
    </div>
  );
}

export function MonitorizacionPanel({
  hora,
  monitoring,
  zoneReview,
  loading,
}: {
  hora: number;
  monitoring: Monitoring | null;
  zoneReview: ZoneReviewResponse | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card title={`Monitorización · ${hora}:00 (EDM T6 / ModelOps)`}>
        <p className="mb-3 text-xs text-slate-500">
          Zonas a revisar ahora: superan umbral de presión o tienen error histórico elevado en esta franja.
        </p>
        {loading ? (
          <p className="text-sm text-slate-400">Analizando modelo…</p>
        ) : (
          <>
            {monitoring?.alerts.slice(0, 3).map((a, i) => (
              <div
                key={i}
                className={`mb-2 flex items-start gap-2 rounded-lg p-2 text-xs ${
                  a.nivel === "ok" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"
                }`}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {a.mensaje}
              </div>
            ))}
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Umbral MAE alerta</dt>
                <dd className="font-semibold">{zoneReview?.mae_threshold ?? monitoring?.mae_threshold ?? "—"} veh/h</dd>
              </div>
              <div>
                <dt className="text-slate-500">Presión alta predicha</dt>
                <dd className="font-semibold">{zoneReview?.n_predicted_high ?? 0} zonas</dd>
              </div>
              <div>
                <dt className="text-slate-500">MAE histórico h{hora}</dt>
                <dd className="font-semibold">
                  {zoneReview?.hour_metrics?.MAE ?? "—"} veh/h
                </dd>
              </div>
            </dl>
          </>
        )}
        <Link href="/monitorizacion" className="mt-3 inline-block text-xs font-semibold text-brand-700">
          Monitorización completa →
        </Link>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revisar ahora — presión alta predicha">
          <ReviewZoneList items={zoneReview?.zones_high_pressure ?? []} valueKey="intensidad" unit="veh/h" />
        </Card>
        <Card title="Revisar ahora — baja fiabilidad histórica">
          <ReviewZoneList items={zoneReview?.zones_low_confidence ?? []} valueKey="mae" unit="MAE" />
        </Card>
      </div>
    </div>
  );
}

export function SistemaPanel({ system }: { system: SystemMetrics | null }) {
  return (
    <Card title="Recursos del servicio (ModelOps)">
      {!system?.available ? (
        <p className="text-sm text-slate-400">{system?.note ?? "Métricas de sistema no disponibles."}</p>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <Cpu className="h-5 w-5 text-brand-600" />
            <div>
              <dt className="text-xs text-slate-500">CPU</dt>
              <dd className="text-lg font-semibold">{system.cpu_percent}%</dd>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-slate-50 p-3">
            <HardDrive className="h-5 w-5 text-teal-600" />
            <div>
              <dt className="text-xs text-slate-500">RAM</dt>
              <dd className="text-lg font-semibold">
                {system.ram_used_mb}/{system.ram_total_mb} MB ({system.ram_percent}%)
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Disco (/)</dt>
            <dd className="text-lg font-semibold">{system.disk_percent}%</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">PID / uptime proc.</dt>
            <dd className="text-sm font-medium">
              {system.pid} · {system.uptime_seconds}s CPU
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

function MetricBox({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-xl font-bold ${tone === "brand" ? "text-brand-700" : "text-slate-900"}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
      </dd>
    </div>
  );
}

function ZoneTable({
  rows,
  empty,
}: {
  rows: { zona: number; calle: string; value: number; unit: string }[];
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-2">Zona</th>
            <th className="py-2 pr-2">Calle / sensor</th>
            <th className="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.zona} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-2 font-medium text-slate-600">{r.zona}</td>
              <td className="max-w-[220px] truncate py-2 pr-2 text-slate-800" title={r.calle}>
                {r.calle}
              </td>
              <td className="py-2 text-right text-slate-600">
                {r.value} <span className="text-xs text-slate-400">{r.unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewZoneList({
  items,
  valueKey,
  unit,
}: {
  items: Array<{ zona: number; calle?: string; descripcion?: string; intensidad?: number; mae?: number; motivo?: string }>;
  valueKey: "intensidad" | "mae";
  unit: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-400">Ninguna zona en esta categoría.</p>;
  }
  return (
    <ul className="scroll-thin max-h-[360px] space-y-2 overflow-y-auto">
      {items.map((z) => (
        <li key={`${z.zona}-${valueKey}`} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-sm">
          <p className="font-semibold text-slate-800">
            Zona {z.zona} · {z.calle ?? z.descripcion}
          </p>
          <p className="text-xs text-slate-500">{z.motivo}</p>
          <p className="mt-1 text-xs font-medium text-brand-700">
            {z[valueKey]} {unit}
          </p>
        </li>
      ))}
    </ul>
  );
}
