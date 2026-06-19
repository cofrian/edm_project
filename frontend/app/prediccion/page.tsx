"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, Layers, RefreshCw, Radio } from "lucide-react";
import Link from "next/link";
import { DynamicMap } from "@/components/DynamicMap";
import type { RoadColorMode } from "@/components/MapView";
import { api } from "@/lib/api";
import { computeAffectedTramoIds } from "@/lib/eventTramos";
import { buildEventImpactZones } from "@/lib/eventImpactZone";
import { DIAS_SEMANA, NIVEL_COLORS, TRAFFIC_ESTADO_COLORS, TRAFFIC_ESTADO_LABELS } from "@/lib/constants";
import { Card, Badge } from "@/components/Card";
import { PageHeader, Callout } from "@/components/ui";
import type { CityEvent, HeatmapResponse, TrafficLiveResponse, WeatherCurrent } from "@/lib/types";

const TRAFFIC_REFRESH_MS = 180_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentHour(): number {
  return new Date().getHours();
}

function isViewingNow(fecha: string, hora: number): boolean {
  return fecha === todayIso() && hora === currentHour();
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
  const [hora, setHora] = useState(currentHour);
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

  const viewingNow = useMemo(() => isViewingNow(fecha, hora), [fecha, hora]);

  const loadModelData = useCallback(async () => {
    setLoading(true);
    const now = isViewingNow(fecha, hora);
    const [w, ev] = await Promise.all([
      api.weatherCurrent(),
      api.events(fecha, addDaysIso(fecha, 31)),
    ]);
    let hm: HeatmapResponse | null = null;
    if (!now) {
      hm = await api.predictHeatmap({
        fecha,
        hora,
        dia_semana: diaSemana,
        use_live_weather: true,
        apply_events: applyEvents,
      });
    }
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

  useEffect(() => {
    if (viewingNow) setRoadColorMode("live");
  }, [viewingNow]);

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

  const mapEvents = useMemo(() => {
    if (selectedEventId) {
      const sel = dayEvents.find((e) => e.id === selectedEventId);
      if (sel) return [sel];
    }
    return activeEvents;
  }, [selectedEventId, dayEvents, activeEvents]);

  const eventImpactZones = useMemo(
    () =>
      buildEventImpactZones(
        traffic?.features as Parameters<typeof buildEventImpactZones>[0],
        mapEvents,
      ),
    [traffic?.features, mapEvents],
  );

  const affectedTramoIds = useMemo(() => {
    if (!traffic?.features?.length || !mapEvents.length) {
      return [] as string[];
    }
    return Array.from(
      computeAffectedTramoIds(
        traffic.features as Parameters<typeof computeAffectedTramoIds>[0],
        mapEvents,
      ),
    );
  }, [traffic?.features, mapEvents]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Datos abiertos · Valencia"
        title="Tráfico en vivo y predicción horaria"
        description="Vías del Ayuntamiento de Valencia en tiempo real (geoportal.valencia.es). La predicción CatBoost se muestra en el panel; en el mapa, colores oficiales del estado del tráfico."
      >
        <Badge color="green">Tráfico Ayto. en vivo</Badge>
        {viewingNow ? <Badge color="green">Ahora — datos reales</Badge> : null}
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="label mb-0">Hora: {hora}:00</label>
                <div className="flex items-center gap-2">
                  {!viewingNow && (
                    <button
                      type="button"
                      className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
                      onClick={() => {
                        setFecha(todayIso());
                        setHora(currentHour());
                      }}
                    >
                      Ahora
                    </button>
                  )}
                  <span className="text-xs text-slate-400">
                    {DIAS_SEMANA.find((d) => d.value === diaSemana)?.label}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={23}
                value={hora}
                onChange={(e) => setHora(+e.target.value)}
                className="w-full accent-brand-600"
              />
              {viewingNow && (
                <p className="mt-1 text-xs text-emerald-700">
                  Momento actual: mapa y panel muestran tráfico real del Ayuntamiento.
                </p>
              )}
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
            <label
              className={`flex items-center gap-2 rounded-lg border p-2 ${
                viewingNow
                  ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
                  : "cursor-pointer border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="roadMode"
                checked={roadColorMode === "prediction"}
                disabled={viewingNow}
                onChange={() => setRoadColorMode("prediction")}
              />
              <Layers className="h-4 w-4 text-slate-400" />
              <span>
                Predicción CatBoost
                {viewingNow ? " (solo futuro/pasado)" : " (futuro/pasado)"}
              </span>
            </label>
            {!viewingNow && (
              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={applyEvents}
                  onChange={(e) => setApplyEvents(e.target.checked)}
                />
                <Gauge className="h-4 w-4 text-slate-400" />
                Impacto eventos en modelo
              </label>
            )}
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
        <Card title="Mapa de vías">
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
              {mapEvents.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-violet-700">
                  <span className="h-2 w-5 rounded-sm bg-violet-400/70 ring-1 ring-violet-600" />
                  Corredor vial evento
                  {affectedTramoIds.length > 0 ? ` · ${affectedTramoIds.length} tramos` : ""}
                </span>
              )}
              <span className="text-slate-400">· Pasa el ratón para veh/h</span>
            </div>
          )}
          {roadColorMode === "prediction" && (
            <div className="mb-3 flex flex-wrap gap-3 text-xs">
              {(["baja", "media", "alta"] as const).map((n) => (
                <span key={n} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-8 rounded-full"
                    style={{ backgroundColor: NIVEL_COLORS[n] }}
                  />
                  {n}
                </span>
              ))}
              {mapEvents.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-violet-700">
                  <span className="h-2 w-5 rounded-sm bg-violet-400/70 ring-1 ring-violet-600" />
                  Corredor vial · {affectedTramoIds.length} tramos
                </span>
              )}
            </div>
          )}
          <DynamicMap
            height={560}
            heatmapPoints={roadColorMode === "prediction" ? (heatmap?.points ?? []) : []}
            trafficGeoJson={traffic}
            showTraffic
            roadColorMode={roadColorMode}
            affectedTramoIds={affectedTramoIds}
            eventMarkers={mapEvents}
            eventImpactZones={eventImpactZones}
            selectedEventId={selectedEventId}
          />
          {traffic?.n_tramos === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No hay geometrías de vía. Comprueba la conexión con geoportal.valencia.es.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={viewingNow ? "Tráfico en vivo (panel)" : "Predicción (panel)"}>
            {viewingNow ? (
              traffic && !trafficError ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Tramos monitorizados</dt>
                    <dd className="font-medium">{traffic.n_tramos ?? 0}</dd>
                  </div>
                  {traffic.n_with_intensidad_vh != null && (
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Con lectura veh/h</dt>
                      <dd className="font-medium">{traffic.n_with_intensidad_vh}</dd>
                    </div>
                  )}
                  {Object.entries(TRAFFIC_ESTADO_LABELS).map(([key, label]) => (
                    <div key={key} className="flex justify-between">
                      <dt className="inline-flex items-center gap-2 text-slate-500">
                        <span
                          className="h-2 w-4 rounded-full"
                          style={{ backgroundColor: TRAFFIC_ESTADO_COLORS[key] }}
                        />
                        {label}
                      </dt>
                      <dd className="font-medium">{trafficStats[key] ?? 0}</dd>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">
                    Datos oficiales Ayuntamiento · mueve fecha/hora para ver predicción
                  </p>
                </dl>
              ) : (
                <p className="text-sm text-slate-400">Cargando tráfico en vivo…</p>
              )
            ) : stats ? (
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
              <p className="text-sm text-slate-400">
                {loading ? "Calculando predicción…" : "Sin predicción cargada."}
              </p>
            )}
          </Card>

          <Card title="Eventos del día" className="xl:sticky xl:top-4">
            <p className="mb-3 text-xs text-slate-500">
              {dayEvents.length} eventos · {activeEvents.length} activos a las {hora}:00
              {mapEvents.length > 0 && affectedTramoIds.length > 0
                ? ` · ${affectedTramoIds.length} tramos en zona`
                : ""}
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
            <strong>En vivo:</strong> colores oficiales del Ayuntamiento; al pasar el ratón, veh/h
            (capa 188 opendata).
          </li>
          <li>
            <strong>Eventos:</strong> icono en el lugar y corredor violeta siguiendo las vías reales
            afectadas (geometría Ayuntamiento), no un círculo artificial.
          </li>
          <li>
            <strong>Predicción:</strong> color CatBoost por zona en cada vía cuando cambias
            fecha/hora.
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
