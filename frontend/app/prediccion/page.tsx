"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Gauge, Layers, RefreshCw, Radio } from "lucide-react";
import Link from "next/link";
import { DynamicMap } from "@/components/DynamicMap";
import type { RoadColorMode } from "@/components/MapView";
import { api } from "@/lib/api";
import { DIAS_SEMANA, TRAFFIC_ESTADO_COLORS, TRAFFIC_ESTADO_LABELS } from "@/lib/constants";
import { Card, Badge } from "@/components/Card";
import { PageHeader, Callout } from "@/components/ui";
import type { CityEvent, HeatmapResponse, TrafficLiveResponse, WeatherCurrent } from "@/lib/types";

const TRAFFIC_REFRESH_MS = 180_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

function eventsForDay(events: CityEvent[], fecha: string): CityEvent[] {
  return events
    .filter((ev) => ev.inicio.slice(0, 10) === fecha)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function weatherSourceLabel(source?: string): string {
  if (source === "aemet") return "AEMET España";
  if (source === "open-meteo") return "Open-Meteo";
  return "Por defecto";
}

export default function PrediccionPage() {
  const [fecha, setFecha] = useState(todayIso);
  const [hora, setHora] = useState(new Date().getHours());
  const [diaSemana, setDiaSemana] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [roadColorMode, setRoadColorMode] = useState<RoadColorMode>("live");
  const [applyEvents, setApplyEvents] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [traffic, setTraffic] = useState<TrafficLiveResponse | null>(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trafficLoading, setTrafficLoading] = useState(false);

  const loadTraffic = useCallback(async () => {
    setTrafficLoading(true);
    const res = await api.trafficLive();
    if (res.ok) {
      setTraffic(res.data);
      setTrafficError(
        res.data.source === "unavailable" || res.data.n_tramos === 0
          ? "El Ayuntamiento no devolvió tramos"
          : null,
      );
    } else {
      setTraffic(null);
      setTrafficError(res.error);
    }
    setTrafficLoading(false);
  }, []);

  const loadModelData = useCallback(async () => {
    setLoading(true);
    const [w, hm, ev] = await Promise.all([
      api.weatherCurrent(),
      api.predictHeatmap({
        fecha,
        hora,
        dia_semana: diaSemana,
        use_live_weather: true,
        apply_events: applyEvents,
      }),
      api.events(fecha, addDaysIso(fecha, 31)),
    ]);
    setWeather(w);
    setHeatmap(hm);
    setEvents(ev.events);
    setLoading(false);
  }, [fecha, hora, diaSemana, applyEvents]);

  useEffect(() => {
    loadModelData();
  }, [loadModelData]);

  useEffect(() => {
    loadTraffic();
    const id = setInterval(loadTraffic, TRAFFIC_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadTraffic]);

  useEffect(() => {
    const d = new Date(fecha + "T12:00:00");
    const wd = d.getDay();
    setDiaSemana(wd === 0 ? 6 : wd - 1);
  }, [fecha]);

  const dayEvents = useMemo(() => eventsForDay(events, fecha), [events, fecha]);
  const activeEvents = useMemo(
    () => eventsForHour(events, fecha, hora),
    [events, fecha, hora],
  );

  const stats = useMemo(() => {
    if (!heatmap?.points.length) return null;
    const pts = heatmap.points;
    const avg = pts.reduce((s, p) => s + p.intensidad, 0) / pts.length;
    const alta = pts.filter((p) => p.nivel === "alta").length;
    return { avg: avg.toFixed(1), alta, total: pts.length };
  }, [heatmap]);

  const trafficStats = traffic?.stats ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Datos abiertos · Valencia"
        title="Tráfico en vivo y predicción horaria"
        description="Vías del Ayuntamiento de Valencia en tiempo real (geoportal.valencia.es). La predicción CatBoost se muestra en el panel; en el mapa, colores oficiales del estado del tráfico."
      >
        <Badge color="green">Tráfico Ayto. en vivo</Badge>
        {traffic?.n_tramos ? (
          <Badge color="blue">{traffic.n_tramos} tramos</Badge>
        ) : null}
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
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                loadModelData();
                loadTraffic();
              }}
              disabled={loading || trafficLoading}
            >
              <RefreshCw className={`h-4 w-4 ${loading || trafficLoading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </Card>

        <Card title="Meteo España" className="lg:col-span-1">
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
              <p className="pt-1 text-xs text-slate-400">Fuente: {weatherSourceLabel(weather.source)}</p>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Cargando…</p>
          )}
        </Card>

        <Card title="Mapa — capa de vías" className="lg:col-span-1">
          <div className="space-y-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2">
              <input
                type="radio"
                name="roadMode"
                checked={roadColorMode === "live"}
                onChange={() => setRoadColorMode("live")}
              />
              <Radio className="h-4 w-4 text-emerald-600" />
              <span>
                <strong>Tráfico Ayto.</strong> (tiempo real)
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2">
              <input
                type="radio"
                name="roadMode"
                checked={roadColorMode === "prediction"}
                onChange={() => setRoadColorMode("prediction")}
              />
              <Layers className="h-4 w-4 text-slate-400" />
              <span>Predicción CatBoost (futuro)</span>
            </label>
            <label className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={applyEvents}
                onChange={(e) => setApplyEvents(e.target.checked)}
              />
              <Gauge className="h-4 w-4 text-slate-400" />
              Impacto eventos en modelo
            </label>
          </div>
        </Card>

        <Card title="Tráfico Ayuntamiento" className="lg:col-span-1">
          {trafficError ? (
            <p className="text-sm text-red-600">{trafficError}</p>
          ) : traffic ? (
            <dl className="space-y-2 text-sm">
              {Object.entries(TRAFFIC_ESTADO_LABELS).map(([key, label]) => (
                <div key={key} className="flex justify-between">
                  <dt className="inline-flex items-center gap-2 text-slate-600">
                    <span
                      className="h-2.5 w-6 rounded-full"
                      style={{ backgroundColor: TRAFFIC_ESTADO_COLORS[key] }}
                    />
                    {label}
                  </dt>
                  <dd className="font-medium">{trafficStats[key] ?? 0}</dd>
                </div>
              ))}
              <p className="pt-2 text-[11px] text-slate-400">
                {traffic.source_label ?? "geoportal.valencia.es"}
                {traffic.fetched_at &&
                  ` · ${new Date(traffic.fetched_at).toLocaleTimeString("es-ES")}`}
              </p>
              <p className="text-[11px] text-slate-400">Auto-actualización cada 3 min</p>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Cargando tráfico del Ayuntamiento…</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card title="Mapa de vías — sin puntos superpuestos">
          {roadColorMode === "live" && (
            <div className="mb-3 flex flex-wrap gap-3 text-xs">
              {Object.entries(TRAFFIC_ESTADO_LABELS).map(([key, label]) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-8 rounded-full"
                    style={{ backgroundColor: TRAFFIC_ESTADO_COLORS[key] }}
                  />
                  {label}
                </span>
              ))}
            </div>
          )}
          <DynamicMap
            height={560}
            heatmapPoints={roadColorMode === "prediction" ? (heatmap?.points ?? []) : []}
            trafficGeoJson={traffic}
            showTraffic
            roadColorMode={roadColorMode}
          />
          {traffic?.n_tramos === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No hay geometrías de vía. Comprueba la conexión con geoportal.valencia.es.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Predicción (panel)">
            {stats ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Zonas modelo</dt>
                  <dd className="font-medium">{stats.total}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Media veh/h</dt>
                  <dd className="font-medium">{stats.avg}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Presión alta</dt>
                  <dd className="font-medium text-red-600">{stats.alta}</dd>
                </div>
                <p className="text-xs text-slate-400">
                  {activeEvents.length} eventos activos a las {hora}:00
                </p>
              </dl>
            ) : (
              <p className="text-sm text-slate-400">Sin predicción cargada.</p>
            )}
          </Card>

          <Card title="Eventos del día" className="xl:sticky xl:top-4">
            <p className="mb-1 inline-flex items-center gap-2 text-xs font-medium text-brand-700">
              <CalendarDays className="h-3.5 w-3.5" />
              Solo en lista (no en mapa)
            </p>
            <p className="mb-3 text-xs text-slate-500">
              {dayEvents.length} eventos · {activeEvents.length} activos ahora
            </p>
            <ul className="scroll-thin max-h-[380px] space-y-2 overflow-y-auto pr-1">
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
                      onClick={() => setSelectedEventId(isSelected ? null : ev.id)}
                      className={`flex w-full gap-3 rounded-xl border p-2.5 text-left transition ${
                        isSelected
                          ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                          : isActive
                            ? "border-violet-200 bg-violet-50/60"
                            : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                    >
                      {ev.imagen && (
                        <img
                          src={ev.imagen}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{ev.nombre}</p>
                        <p className="text-xs capitalize text-violet-600">{ev.tipo}</p>
                        <p className="text-xs text-slate-500">
                          {formatTime(ev.inicio)} – {formatTime(ev.fin)}
                        </p>
                        {isActive && (
                          <span className="mt-1 inline-block rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Activo ahora
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Callout tone="brand" title="Fuentes de datos oficiales">
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <strong>Tráfico:</strong> ArcGIS Open Data del Ayuntamiento de Valencia
            (geoportal.valencia.es) — colores fluido / denso / congestionado / cortado.
          </li>
          <li>
            <strong>Meteo:</strong> AEMET (España) u Open-Meteo como respaldo.
          </li>
          <li>
            <strong>Predicción:</strong> modelo CatBoost en panel; capa de mapa &quot;Predicción&quot;
            para colorear vías (cuando haya zonas enlazadas).
          </li>
          <li>
            <strong>Eventos:</strong> catálogo manual en panel lateral, sin marcadores en el mapa.
          </li>
        </ul>
        <Link
          href="/optimizacion"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
        >
          Ir al optimizador →
        </Link>
      </Callout>
    </div>
  );
}
