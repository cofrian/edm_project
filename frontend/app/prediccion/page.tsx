"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Gauge, Layers, MapPin, RefreshCw } from "lucide-react";
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
  if (source === "aemet") return "AEMET (en vivo)";
  if (source === "open-meteo") return "Open-Meteo (en vivo)";
  return "Valores por defecto";
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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
      api.events(fecha, addDaysIso(fecha, 31)),
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

  const dayEvents = useMemo(() => eventsForDay(events, fecha), [events, fecha]);

  const activeEvents = useMemo(
    () => eventsForHour(events, fecha, hora),
    [events, fecha, hora],
  );

  const mapEvents = useMemo(
    () => (showEvents ? activeEvents : []),
    [activeEvents, showEvents],
  );

  const eventMarkers = useMemo(
    () =>
      mapEvents.map((ev) => ({
        id: ev.id,
        lat: ev.lat,
        lon: ev.lon,
        nombre: ev.nombre,
        radio_metros: ev.radio_metros,
        tipo: ev.tipo,
        imagen: ev.imagen,
        inicio: ev.inicio,
        fin: ev.fin,
        enlace: ev.enlace,
        direccion: ev.direccion,
      })),
    [mapEvents],
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
        description="Vías coloreadas por predicción, tráfico real del Ayuntamiento, meteo en vivo y eventos urbanos con impacto en la intensidad."
      >
        <Badge color="green">Vías + heatmap</Badge>
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

        <Card title="Meteo" className="lg:col-span-1">
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
                Fuente: {weatherSourceLabel(weather.source)}
                {weather.note && ` — ${weather.note}`}
              </p>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Cargando meteo…</p>
          )}
        </Card>

        <Card title="Capas" className="lg:col-span-1">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(e) => setShowTraffic(e.target.checked)}
              />
              <Layers className="h-4 w-4 text-slate-400" />
              Vías coloreadas (predicción)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={(e) => setShowEvents(e.target.checked)}
              />
              <MapPin className="h-4 w-4 text-slate-400" />
              Eventos con foto
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
              {activeEvents.length} activos a las {hora}:00 · {dayEvents.length} en el día
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

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card title="Mapa de predicción — vías coloreadas">
          <DynamicMap
            height={560}
            heatmapPoints={heatmap?.points ?? []}
            trafficGeoJson={showTraffic ? traffic : null}
            eventCircles={eventMarkers}
            showTraffic={showTraffic}
            showEvents={showEvents}
            showHeatmapPoints={false}
            colorRoadsByPrediction
          />
        </Card>

        <Card title="Eventos del día" className="xl:sticky xl:top-4 xl:self-start">
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-medium text-brand-700">
            <CalendarDays className="h-3.5 w-3.5" />
            Agenda urbana
          </p>
          <p className="mb-3 text-xs text-slate-500">
            {new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {" · "}
            {dayEvents.length} eventos
          </p>
          <ul className="scroll-thin max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {dayEvents.length === 0 && (
              <li className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
                No hay eventos catalogados para esta fecha.
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
                      {ev.direccion && (
                        <p className="truncate text-[11px] text-slate-400">{ev.direccion}</p>
                      )}
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

      <Callout tone="brand" title="Capas del mapa">
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <strong>Líneas de vía:</strong> color según predicción CatBoost de la zona más cercana
            (verde / ámbar / rojo).
          </li>
          <li>
            <strong>Marcadores con foto:</strong> eventos activos en la hora seleccionada, con radio
            de impacto violeta.
          </li>
          <li>
            <strong>Panel derecho:</strong> todos los eventos del día; los activos a la hora actual
            aparecen resaltados.
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
