"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, Layers, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { DynamicMap } from "@/components/DynamicMap";
import { api } from "@/lib/api";
import { DIAS_SEMANA, NIVEL_COLORS } from "@/lib/constants";
import { Card, Badge } from "@/components/Card";
import { PageHeader, Callout } from "@/components/ui";
import type { CityEvent, HeatmapResponse, WeatherCurrent } from "@/lib/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function eventsForHour(events: CityEvent[], fecha: string, hora: number): CityEvent[] {
  const at = new Date(`${fecha}T${String(hora).padStart(2, "0")}:00:00`);
  return events.filter((ev) => {
    const start = new Date(ev.inicio);
    const end = new Date(ev.fin);
    const ramp = new Date(start.getTime() - 2 * 3600_000);
    const decay = new Date(end.getTime() + 2 * 3600_000);
    return at >= ramp && at <= decay;
  });
}

export default function PrediccionPage() {
  const [fecha, setFecha] = useState(todayIso);
  const [hora, setHora] = useState(new Date().getHours());
  const [diaSemana, setDiaSemana] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [showTraffic, setShowTraffic] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [applyEvents, setApplyEvents] = useState(true);
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [traffic, setTraffic] = useState<{ type: string; features: unknown[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [w, hm, ev, tr] = await Promise.all([
      api.weatherCurrent(),
      api.predictHeatmap({
        fecha,
        hora,
        dia_semana: diaSemana,
        use_live_weather: true,
        apply_events: applyEvents,
      }),
      api.events("2026-06-14", "2026-07-15"),
      showTraffic ? api.trafficLive() : Promise.resolve(null),
    ]);
    setWeather(w);
    setHeatmap(hm);
    setEvents(ev.events);
    if (tr) setTraffic(tr);
    setLoading(false);
  }, [fecha, hora, diaSemana, applyEvents, showTraffic]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const d = new Date(fecha + "T12:00:00");
    const wd = d.getDay();
    setDiaSemana(wd === 0 ? 6 : wd - 1);
  }, [fecha]);

  const activeEvents = useMemo(
    () => eventsForHour(events, fecha, hora),
    [events, fecha, hora],
  );

  const eventCircles = useMemo(
    () =>
      activeEvents.map((ev) => ({
        lat: ev.lat,
        lon: ev.lon,
        nombre: ev.nombre,
        radio_metros: ev.radio_metros,
        tipo: ev.tipo,
      })),
    [activeEvents],
  );

  const stats = useMemo(() => {
    if (!heatmap?.points.length) return null;
    const pts = heatmap.points;
    const avg = pts.reduce((s, p) => s + p.intensidad, 0) / pts.length;
    const alta = pts.filter((p) => p.nivel === "alta").length;
    return { avg: avg.toFixed(1), alta, total: pts.length };
  }, [heatmap]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mapa en vivo · CatBoost"
        title="Presión de tráfico espacial por hora"
        description="Mapa de ~1.158 zonas con predicción horaria, meteo AEMET, tráfico real del Ayuntamiento y eventos urbanos que ajustan la intensidad."
      >
        <Badge color="green">Heatmap batch</Badge>
        {heatmap?.model_loaded && <Badge color="blue">Modelo cargado</Badge>}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Hora del día" className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label mb-0">Hora: {hora}:00</label>
                <span className="text-xs text-slate-400">
                  {DIAS_SEMANA.find((d) => d.value === diaSemana)?.label}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={23}
                value={hora}
                onChange={(e) => setHora(+e.target.value)}
                className="w-full accent-brand-600"
              />
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>0h</span>
                <span>12h</span>
                <span>23h</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => loadData()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Actualizando…" : "Actualizar mapa"}
            </button>
          </div>
        </Card>

        <Card title="Meteo (AEMET)" className="lg:col-span-1">
          {weather ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Temperatura</dt>
                <dd className="font-medium">{weather.temp_c} ºC</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Humedad</dt>
                <dd className="font-medium">{weather.hum_rel} %</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Viento</dt>
                <dd className="font-medium">{weather.vel_viento_ms} m/s</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Precipitación</dt>
                <dd className="font-medium">{weather.precip_lm2} l/m²</dd>
              </div>
              <p className="pt-1 text-xs text-slate-400">
                Fuente: {weather.source ?? "default"}
                {weather.note && ` — ${weather.note}`}
              </p>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Cargando meteo…</p>
          )}
        </Card>

        <Card title="Capas y eventos" className="lg:col-span-1">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(e) => setShowTraffic(e.target.checked)}
              />
              <Layers className="h-4 w-4 text-slate-400" />
              Tráfico vivo (Ayto.)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={(e) => setShowEvents(e.target.checked)}
              />
              <MapPin className="h-4 w-4 text-slate-400" />
              Radios de eventos
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyEvents}
                onChange={(e) => setApplyEvents(e.target.checked)}
              />
              <Gauge className="h-4 w-4 text-slate-400" />
              Aplicar impacto en predicción
            </label>
            <p className="text-xs text-slate-400">
              {activeEvents.length} eventos activos · {heatmap?.events_active ?? 0} en modelo
            </p>
          </div>
        </Card>

        <Card title="Resumen hora" className="lg:col-span-1">
          {stats ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Zonas</dt>
                <dd className="font-medium">{stats.total}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Media intensidad</dt>
                <dd className="font-medium">{stats.avg} veh/h</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Zonas presión alta</dt>
                <dd className="font-medium text-red-600">{stats.alta}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Sin datos de heatmap.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {(["baja", "media", "alta"] as const).map((n) => (
              <span key={n} className="inline-flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: NIVEL_COLORS[n] }}
                />
                {n}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Mapa de predicción">
        <DynamicMap
          height={520}
          heatmapPoints={heatmap?.points ?? []}
          trafficGeoJson={showTraffic ? traffic : null}
          eventCircles={showEvents ? eventCircles : []}
          showTraffic={showTraffic}
          showEvents={showEvents}
        />
      </Card>

      {activeEvents.length > 0 && (
        <Card title={`Eventos activos (${hora}:00)`}>
          <ul className="divide-y divide-slate-100 text-sm">
            {activeEvents.slice(0, 12).map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium text-slate-800">{ev.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {ev.tipo} · {ev.direccion ?? `${ev.lat.toFixed(4)}, ${ev.lon.toFixed(4)}`}
                  </p>
                </div>
                {ev.enlace && (
                  <a
                    href={ev.enlace}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand-700"
                  >
                    Más info
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Callout tone="brand" title="Capas del mapa">
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <strong>Puntos coloreados:</strong> intensidad CatBoost por zona (verde / ámbar / rojo).
          </li>
          <li>
            <strong>Líneas:</strong> estado de tráfico real por tramo (fluido → cortado).
          </li>
          <li>
            <strong>Círculos violetas:</strong> eventos con radio de impacto (conciertos, deporte, ocio).
          </li>
        </ul>
        <Link
          href="/optimizacion"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
        >
          Ir al optimizador con esta señal de demanda →
        </Link>
      </Callout>
    </div>
  );
}
