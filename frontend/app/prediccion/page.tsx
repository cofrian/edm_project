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
import { Tabs } from "@/components/Tabs";
import {
  EvaluacionPanel,
  EventosPanel,
  MonitorizacionPanel,
  ResumenPanel,
  SistemaPanel,
} from "@/components/prediccion/PrediccionPanels";
import { PageHeader, Callout } from "@/components/ui";
import type {
  CityEvent,
  GlobalMetrics,
  HeatmapResponse,
  HourMetric,
  Monitoring,
  SystemMetrics,
  TrafficLiveResponse,
  WeatherCurrent,
  ZoneError,
  ZoneReviewResponse,
} from "@/lib/types";

const TRAFFIC_REFRESH_MS = 180_000;

function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function currentHour(): number {
  return new Date().getHours();
}

function weekdayIndex(iso: string): number {
  const wd = new Date(`${iso}T12:00:00`).getDay();
  return wd === 0 ? 6 : wd - 1;
}

function syncToNow(): { fecha: string; hora: number; diaSemana: number } {
  const fecha = todayIso();
  const hora = currentHour();
  return { fecha, hora, diaSemana: weekdayIndex(fecha) };
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

function weatherSourceLabel(source?: string): string {
  if (source === "aemet") return "AEMET España";
  if (source === "open-meteo") return "Open-Meteo";
  return "Por defecto";
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  ) || (
    error instanceof Error && error.name === "AbortError"
  );
}

function pageIsVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export default function PrediccionPage() {
  const [fecha, setFecha] = useState(() => syncToNow().fecha);
  const [hora, setHora] = useState(() => syncToNow().hora);
  const [diaSemana, setDiaSemana] = useState(() => syncToNow().diaSemana);
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
  const [activeTab, setActiveTab] = useState("resumen");
  const [evalGlobal, setEvalGlobal] = useState<GlobalMetrics | null>(null);
  const [evalHour, setEvalHour] = useState<HourMetric | null>(null);
  const [evalZoneErrors, setEvalZoneErrors] = useState<ZoneError[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [zoneReview, setZoneReview] = useState<ZoneReviewResponse | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(pageIsVisible());
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const loadTraffic = useCallback(async (signal?: AbortSignal) => {
    if (!pageIsVisible()) return;
    setTrafficLoading(true);
    try {
      const res = await api.trafficLive({ signal });
      if (signal?.aborted) return;
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
    } catch (error) {
      if (isAbortError(error)) return;
      setTraffic(null);
      setTrafficError(error instanceof Error ? error.message : "Error de red");
    } finally {
      if (!signal?.aborted) setTrafficLoading(false);
    }
  }, []);

  const viewingNow = useMemo(() => isViewingNow(fecha, hora), [fecha, hora]);

  const loadModelData = useCallback(async (signal?: AbortSignal) => {
    if (!pageIsVisible()) return;
    setLoading(true);
    try {
      const now = isViewingNow(fecha, hora);
      const [w, ev] = await Promise.all([
        api.weatherCurrent({ signal }),
        api.events(fecha, addDaysIso(fecha, 31), { signal }),
      ]);
      let hm: HeatmapResponse | null = null;
      if (!now) {
        hm = await api.predictHeatmap({
          fecha,
          hora,
          dia_semana: diaSemana,
          use_live_weather: true,
          apply_events: applyEvents,
        }, { signal });
      }
      if (signal?.aborted) return;
      setWeather(w);
      setHeatmap(hm);
      setEvents(ev.events);
    } catch (error) {
      if (!isAbortError(error)) {
        setHeatmap(null);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [fecha, hora, diaSemana, applyEvents]);

  useEffect(() => {
    if (!isPageVisible) return;
    const controller = new AbortController();
    void loadModelData(controller.signal);
    return () => controller.abort();
  }, [loadModelData, isPageVisible]);

  useEffect(() => {
    const now = syncToNow();
    setFecha(now.fecha);
    setHora(now.hora);
    setDiaSemana(now.diaSemana);
    setRoadColorMode("live");
    setSelectedEventId(null);
  }, []);

  useEffect(() => {
    if (!isPageVisible) return;
    let current: AbortController | null = null;
    const run = () => {
      current?.abort();
      current = new AbortController();
      void loadTraffic(current.signal);
    };
    run();
    const id = setInterval(run, TRAFFIC_REFRESH_MS);
    return () => {
      clearInterval(id);
      current?.abort();
    };
  }, [loadTraffic, isPageVisible]);

  useEffect(() => {
    setDiaSemana(weekdayIndex(fecha));
  }, [fecha]);

  useEffect(() => {
    if (viewingNow) setRoadColorMode("live");
  }, [viewingNow]);

  useEffect(() => {
    if (!isPageVisible) return;
    const controller = new AbortController();
    api
      .zonesToReview(hora, fecha, applyEvents, { signal: controller.signal })
      .then(setZoneReview)
      .catch((error) => {
        if (!isAbortError(error)) setZoneReview(null);
      });
    return () => controller.abort();
  }, [hora, fecha, applyEvents, isPageVisible]);

  useEffect(() => {
    if (activeTab !== "evaluacion" || !isPageVisible) return;
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      if (activeTab === "evaluacion") {
        setEvalLoading(true);
        try {
          const [ev, errs] = await Promise.all([
            api.metricsHourEval(hora, { signal: controller.signal }),
            api.errorsByZone(12, hora, { signal: controller.signal }),
          ]);
          if (!cancelled && !controller.signal.aborted) {
            setEvalGlobal(ev.global);
            setEvalHour(ev.hour);
            setEvalZoneErrors(errs);
          }
        } catch (error) {
          if (!isAbortError(error)) setEvalZoneErrors([]);
        } finally {
          if (!cancelled && !controller.signal.aborted) {
            setEvalLoading(false);
          }
        }
      }
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, hora, isPageVisible]);

  useEffect(() => {
    if (activeTab !== "monitorizacion" || !isPageVisible) return;
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setMonitorLoading(true);
      try {
        const mon = await api.monitoring({ signal: controller.signal });
        if (!cancelled && !controller.signal.aborted) {
          setMonitoring(mon);
        }
      } catch (error) {
        if (!isAbortError(error)) setMonitoring(null);
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setMonitorLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, isPageVisible]);

  useEffect(() => {
    if (activeTab !== "sistema" || !isPageVisible) return;
    const controller = new AbortController();
    api
      .systemMetrics({ signal: controller.signal })
      .then(setSystemMetrics)
      .catch((error) => {
        if (!isAbortError(error)) setSystemMetrics({ available: false });
      });
    return () => controller.abort();
  }, [activeTab, isPageVisible]);

  const highPressureZones = useMemo(
    () => (heatmap?.points ?? []).filter((p) => p.nivel === "alta").sort((a, b) => b.intensidad - a.intensidad),
    [heatmap],
  );

  const reviewBadge = (zoneReview?.zones_high_pressure.length ?? 0) + (zoneReview?.zones_low_confidence.length ?? 0);

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
        {!isPageVisible ? <Badge color="amber">Pausado en segundo plano</Badge> : null}
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
                        const now = syncToNow();
                        setFecha(now.fecha);
                        setHora(now.hora);
                        setRoadColorMode("live");
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

      <div className="space-y-4">
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

        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "resumen", label: "Resumen" },
            { id: "eventos", label: "Eventos", badge: activeEvents.length },
            { id: "evaluacion", label: "Evaluación" },
            { id: "monitorizacion", label: "Monitorización", badge: reviewBadge },
            { id: "sistema", label: "Sistema" },
          ]}
        />

        {activeTab === "resumen" && (
          <ResumenPanel
            viewingNow={viewingNow}
            traffic={traffic}
            trafficError={trafficError}
            trafficStats={trafficStats}
            stats={stats}
            loading={loading}
            activeEventsCount={activeEvents.length}
            hora={hora}
          />
        )}
        {activeTab === "eventos" && (
          <EventosPanel
            dayEvents={dayEvents}
            activeEvents={activeEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            hora={hora}
            affectedCount={affectedTramoIds.length}
          />
        )}
        {activeTab === "evaluacion" && (
          <EvaluacionPanel
            hora={hora}
            global={evalGlobal}
            hourMetrics={evalHour}
            zoneErrors={evalZoneErrors}
            highPressureZones={highPressureZones}
            loading={evalLoading}
          />
        )}
        {activeTab === "monitorizacion" && (
          <MonitorizacionPanel
            hora={hora}
            monitoring={monitoring}
            zoneReview={zoneReview}
            loading={monitorLoading}
          />
        )}
        {activeTab === "sistema" && <SistemaPanel system={systemMetrics} />}
      </div>

      <Callout tone="brand" title="EDM · Evaluación y monitorización integradas">
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <strong>Resumen / Eventos / Evaluación / Monitorización / Sistema</strong> en pestañas
            (no ocupan espacio hasta que las abres).
          </li>
          <li>
            <strong>Evaluación:</strong> métricas globales y de la hora seleccionada; cada zona
            muestra la calle del sensor.
          </li>
          <li>
            <strong>Monitorización:</strong> zonas a revisar ahora (presión alta + baja fiabilidad
            histórica).
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
