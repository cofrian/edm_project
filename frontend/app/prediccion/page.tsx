"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bike, Bus, Clock, Gauge, Layers, Radio, RefreshCw, Route, Wifi } from "lucide-react";
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
  EmtArrivalsResponse,
  EmtRoute,
  EmtStop,
  GlobalMetrics,
  HeatmapResponse,
  HourMetric,
  Monitoring,
  MobilityAlert,
  SystemMetrics,
  TrafficLiveResponse,
  ValenbisiStationsResponse,
  WeatherCurrent,
  ZoneError,
  ZoneReviewResponse,
} from "@/lib/types";

const TRAFFIC_REFRESH_MS = 180_000;
const VALENBISI_REFRESH_MS = 180_000;
const EMT_ARRIVALS_REFRESH_MS = 45_000;

type MobilityLayerKey =
  | "valenbisi"
  | "emt"
  | "events"
  | "emtRoutes"
  | "estimatedBuses"
  | "onlyAlerts";

const DEFAULT_MOBILITY_LAYERS: Record<MobilityLayerKey, boolean> = {
  valenbisi: true,
  emt: true,
  events: true,
  emtRoutes: false,
  estimatedBuses: true,
  onlyAlerts: false,
};

const MOBILITY_LAYER_OPTIONS: Array<{ key: MobilityLayerKey; label: string; icon: JSX.Element }> = [
  { key: "valenbisi", label: "Valenbisi", icon: <Bike className="h-4 w-4" /> },
  { key: "emt", label: "EMT", icon: <Bus className="h-4 w-4" /> },
  { key: "events", label: "Eventos", icon: <AlertTriangle className="h-4 w-4" /> },
  { key: "emtRoutes", label: "Rutas EMT", icon: <Route className="h-4 w-4" /> },
  { key: "estimatedBuses", label: "Buses aproximados", icon: <Clock className="h-4 w-4" /> },
  { key: "onlyAlerts", label: "Solo alertas", icon: <AlertTriangle className="h-4 w-4" /> },
];

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

function formatRealtimeTime(value?: string | null): string {
  if (!value) return "Sin actualizar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actualizar";
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function uniqueStopLines(stop: EmtStop): string[] {
  return Array.from(new Set(stop.lines.map((line) => line.trim().toUpperCase()).filter(Boolean)));
}

function routeContainsStop(route: EmtRoute, stopId: number): boolean {
  return route.stops.some((stop) => stop.stopId === stopId);
}

function uniqueRoutes(routes: EmtRoute[]): EmtRoute[] {
  return routes.filter((route, index, all) => all.findIndex((candidate) => candidate.id === route.id) === index);
}

function mobilityAlertRank(alert: MobilityAlert): number {
  const severity = { critical: 0, warning: 1, info: 2 }[alert.severity] ?? 3;
  return severity;
}

function mobilityAlertTone(alert: MobilityAlert): string {
  if (alert.severity === "critical") return "border-red-200 bg-red-50 text-red-800";
  if (alert.severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function groupMobilityAlerts(alerts: MobilityAlert[]) {
  return [
    {
      id: "valenbisi",
      label: "Valenbisi",
      items: alerts.filter((alert) => alert.type.startsWith("VALENBISI") && alert.type !== "VALENBISI_NEAR_EVENT"),
    },
    {
      id: "events",
      label: "Eventos",
      items: alerts.filter((alert) => alert.type === "VALENBISI_NEAR_EVENT"),
    },
    {
      id: "emt",
      label: "EMT",
      items: alerts.filter((alert) => alert.type === "EMT_DELAY"),
    },
  ];
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
  const [mobilityRealtime, setMobilityRealtime] = useState(false);
  const [mobilityLayers, setMobilityLayers] =
    useState<Record<MobilityLayerKey, boolean>>(DEFAULT_MOBILITY_LAYERS);
  const [valenbisiRealtime, setValenbisiRealtime] = useState<ValenbisiStationsResponse | null>(null);
  const [valenbisiLoading, setValenbisiLoading] = useState(false);
  const [valenbisiError, setValenbisiError] = useState<string | null>(null);
  const [emtStopsRealtime, setEmtStopsRealtime] = useState<EmtStop[]>([]);
  const [emtStopsLoading, setEmtStopsLoading] = useState(false);
  const [emtStopsError, setEmtStopsError] = useState<string | null>(null);
  const [selectedEmtStop, setSelectedEmtStop] = useState<EmtStop | null>(null);
  const [emtArrivalsRealtime, setEmtArrivalsRealtime] = useState<EmtArrivalsResponse | null>(null);
  const [emtArrivalsLoading, setEmtArrivalsLoading] = useState(false);
  const [emtArrivalsError, setEmtArrivalsError] = useState<string | null>(null);
  const [emtRoutesForStop, setEmtRoutesForStop] = useState<EmtRoute[]>([]);
  const [emtRoutesLoading, setEmtRoutesLoading] = useState(false);
  const [emtRoutesError, setEmtRoutesError] = useState<string | null>(null);
  const [emtRoutesStopId, setEmtRoutesStopId] = useState<number | null>(null);

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

  const loadValenbisiRealtime = useCallback(async (signal?: AbortSignal) => {
    if (!pageIsVisible()) return;
    setValenbisiLoading(true);
    try {
      const res = await api.mobilityValenbisiStations({ signal });
      if (signal?.aborted) return;
      setValenbisiRealtime(res);
      setValenbisiError(res.error ?? (res.source === "unavailable" ? "Valenbisi no disponible" : null));
    } catch (error) {
      if (isAbortError(error)) return;
      setValenbisiError(error instanceof Error ? error.message : "Error de red");
    } finally {
      if (!signal?.aborted) setValenbisiLoading(false);
    }
  }, []);

  const loadEmtStopsRealtime = useCallback(async (signal?: AbortSignal) => {
    if (!pageIsVisible()) return;
    setEmtStopsLoading(true);
    try {
      const res = await api.mobilityEmtStops({ signal });
      if (signal?.aborted) return;
      setEmtStopsRealtime(res.stops);
      setEmtStopsError(res.error ?? (res.source === "unavailable" ? "Paradas EMT no disponibles" : null));
    } catch (error) {
      if (isAbortError(error)) return;
      setEmtStopsRealtime([]);
      setEmtStopsError(error instanceof Error ? error.message : "Error de red");
    } finally {
      if (!signal?.aborted) setEmtStopsLoading(false);
    }
  }, []);

  const loadEmtArrivalsRealtime = useCallback(async (stop: EmtStop, signal?: AbortSignal) => {
    if (!pageIsVisible()) return;
    setEmtArrivalsLoading(true);
    try {
      const res = await api.mobilityEmtArrivals(stop.stopId, undefined, { signal });
      if (signal?.aborted) return;
      setEmtArrivalsRealtime(res);
      setEmtArrivalsError(
        res.arrivals.length === 0 && res.source === "unavailable"
          ? "No se han podido cargar próximas llegadas"
          : null,
      );
    } catch (error) {
      if (isAbortError(error)) return;
      setEmtArrivalsRealtime(null);
      setEmtArrivalsError(error instanceof Error ? error.message : "Error de red");
    } finally {
      if (!signal?.aborted) setEmtArrivalsLoading(false);
    }
  }, []);

  const loadEmtRoutesForStop = useCallback(async (stop: EmtStop, signal?: AbortSignal) => {
    if (!pageIsVisible()) return;
    const lines = uniqueStopLines(stop);
    if (!lines.length) {
      setEmtRoutesForStop([]);
      setEmtRoutesStopId(stop.stopId);
      setEmtRoutesError("Esta parada no tiene líneas EMT asociadas.");
      return;
    }
    setEmtRoutesLoading(true);
    setEmtRoutesError(null);
    setEmtRoutesStopId(stop.stopId);
    try {
      const responses = await Promise.all(lines.map((line) => api.mobilityEmtRoutes(line, { signal })));
      if (signal?.aborted) return;
      const routes = uniqueRoutes(
        responses
          .flatMap((res) => res.routes)
          .filter((route) => routeContainsStop(route, stop.stopId)),
      );
      setEmtRoutesForStop(routes);
      setEmtRoutesError(routes.length ? null : "No se han encontrado rutas para esta parada.");
    } catch (error) {
      if (isAbortError(error)) return;
      setEmtRoutesForStop([]);
      setEmtRoutesError(error instanceof Error ? error.message : "Error de red");
    } finally {
      if (!signal?.aborted) setEmtRoutesLoading(false);
    }
  }, []);

  const toggleMobilityLayer = useCallback((key: MobilityLayerKey) => {
    setMobilityLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSelectEmtStop = useCallback((stop: EmtStop) => {
    setSelectedEmtStop(stop);
    setEmtRoutesForStop([]);
    setEmtRoutesStopId(null);
    setEmtRoutesError(null);
    setEmtArrivalsRealtime(null);
    setMobilityLayers((prev) => ({
      ...prev,
      emt: true,
      emtRoutes: true,
      estimatedBuses: true,
    }));
  }, []);

  const viewingNow = useMemo(() => isViewingNow(fecha, hora), [fecha, hora]);

  const loadModelData = useCallback(async (signal?: AbortSignal) => {
    if (!pageIsVisible()) return;
    setLoading(true);
    try {
      const now = isViewingNow(fecha, hora);
      const [wCurrent, forecast, ev] = await Promise.all([
        api.weatherCurrent({ signal }),
        now ? Promise.resolve([] as WeatherCurrent[]) : api.weatherForecast(fecha, { signal }),
        api.events(fecha, addDaysIso(fecha, 31), { signal }),
      ]);
      const wHour: WeatherCurrent = (!now && forecast.length > 0)
        ? (forecast.find((h) => (h as WeatherCurrent & { hora?: number }).hora === hora) ?? wCurrent)
        : wCurrent;
      let hm: HeatmapResponse | null = null;
      if (!now) {
        hm = await api.predictHeatmap({
          fecha,
          hora,
          dia_semana: diaSemana,
          use_live_weather: false,
          apply_events: applyEvents,
          temp_c: wHour.temp_c,
          hum_rel: wHour.hum_rel,
          pres_mb: wHour.pres_mb,
          vel_viento_ms: wHour.vel_viento_ms,
          precip_lm2: wHour.precip_lm2,
        }, { signal });
      }
      if (signal?.aborted) return;
      setWeather(wHour);
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
    if (!isPageVisible || !viewingNow) return;
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
  }, [loadTraffic, isPageVisible, viewingNow]);

  useEffect(() => {
    if (!mobilityRealtime || !isPageVisible) return;
    let current: AbortController | null = null;
    const run = () => {
      current?.abort();
      current = new AbortController();
      void loadValenbisiRealtime(current.signal);
    };
    run();
    const id = setInterval(run, VALENBISI_REFRESH_MS);
    return () => {
      clearInterval(id);
      current?.abort();
    };
  }, [mobilityRealtime, isPageVisible, loadValenbisiRealtime]);

  useEffect(() => {
    if (!mobilityRealtime || !isPageVisible) return;
    if (!mobilityLayers.emt && !mobilityLayers.emtRoutes) return;
    const controller = new AbortController();
    void loadEmtStopsRealtime(controller.signal);
    return () => controller.abort();
  }, [
    mobilityRealtime,
    isPageVisible,
    mobilityLayers.emt,
    mobilityLayers.emtRoutes,
    loadEmtStopsRealtime,
  ]);

  useEffect(() => {
    if (!mobilityRealtime || !selectedEmtStop || !isPageVisible) return;
    let current: AbortController | null = null;
    const run = () => {
      current?.abort();
      current = new AbortController();
      void loadEmtArrivalsRealtime(selectedEmtStop, current.signal);
    };
    run();
    const id = setInterval(run, EMT_ARRIVALS_REFRESH_MS);
    return () => {
      clearInterval(id);
      current?.abort();
    };
  }, [mobilityRealtime, selectedEmtStop, isPageVisible, loadEmtArrivalsRealtime]);

  useEffect(() => {
    if (!mobilityRealtime || !isPageVisible || !mobilityLayers.emtRoutes || !selectedEmtStop) {
      if (!mobilityLayers.emtRoutes) {
        setEmtRoutesLoading(false);
        setEmtRoutesForStop([]);
        setEmtRoutesStopId(null);
        setEmtRoutesError(null);
      }
      return;
    }
    const controller = new AbortController();
    void loadEmtRoutesForStop(selectedEmtStop, controller.signal);
    return () => controller.abort();
  }, [
    mobilityRealtime,
    isPageVisible,
    mobilityLayers.emtRoutes,
    selectedEmtStop,
    loadEmtRoutesForStop,
  ]);

  useEffect(() => {
    if (!mobilityRealtime) {
      setEmtArrivalsLoading(false);
      setValenbisiLoading(false);
      setEmtRoutesLoading(false);
    }
  }, [mobilityRealtime]);

  useEffect(() => {
    setDiaSemana(weekdayIndex(fecha));
  }, [fecha]);

  useEffect(() => {
    if (viewingNow) {
      setRoadColorMode("live");
    } else {
      setRoadColorMode("prediction");
      setMobilityRealtime(false);
    }
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

  const mobilityAlerts = useMemo(() => {
    const alerts = [
      ...(valenbisiRealtime?.alerts ?? []),
      ...(emtArrivalsRealtime?.alerts ?? []),
    ];
    return alerts
      .filter((alert, index, all) => all.findIndex((candidate) => candidate.id === alert.id) === index)
      .sort((a, b) => mobilityAlertRank(a) - mobilityAlertRank(b));
  }, [valenbisiRealtime?.alerts, emtArrivalsRealtime?.alerts]);

  const mobilityAlertGroups = useMemo(() => groupMobilityAlerts(mobilityAlerts), [mobilityAlerts]);
  const mobilityCriticalCount = mobilityAlerts.filter((alert) => alert.severity === "critical").length;
  const mobilityWarningCount = mobilityAlerts.filter((alert) => alert.severity === "warning").length;
  const visibleValenbisiStations =
    mobilityRealtime && mobilityLayers.valenbisi ? valenbisiRealtime?.stations ?? [] : [];
  const visibleEmtStops =
    mobilityRealtime && mobilityLayers.emt ? emtStopsRealtime : [];
  const visibleEmtRoutes =
    mobilityRealtime && mobilityLayers.emtRoutes && emtRoutesStopId === selectedEmtStop?.stopId
      ? emtRoutesForStop
      : [];
  const visibleEstimatedBuses =
    mobilityRealtime && mobilityLayers.estimatedBuses
      ? (emtArrivalsRealtime?.estimatedPositions ?? []).filter(
          (b) => b.minutesToTargetStop <= 30,
        )
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Movilidad en Valencia"
        title="Tráfico real y predicción por hora"
        description="Consulta el tráfico actual del Ayuntamiento y compara otros días u horas con la predicción del modelo."
      >
        <Badge color="green">Tráfico del Ayuntamiento</Badge>
        {viewingNow ? <Badge color="green">Ahora: datos reales</Badge> : null}
        {!isPageVisible ? <Badge color="amber">Pausado en segundo plano</Badge> : null}
        {traffic?.n_tramos ? (
          <Badge color="blue">{traffic.n_tramos} tramos</Badge>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Fecha y hora" className="lg:col-span-1">
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
                  Estás viendo el momento actual: el mapa usa tráfico real del Ayuntamiento.
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

        <Card title="Tiempo actual" className="lg:col-span-1">
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
            <p className="text-sm text-slate-400">Cargando...</p>
          )}
        </Card>

        <Card title="Color del mapa" className="lg:col-span-1">
          <div className="space-y-3 text-sm">
            <label
              className={`flex items-center gap-2 rounded-lg border p-2 ${
                !viewingNow
                  ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50"
                  : "cursor-pointer border-emerald-200 bg-emerald-50/80"
              }`}
            >
              <input
                type="radio"
                name="roadMode"
                checked={roadColorMode === "live"}
                disabled={!viewingNow}
                onChange={() => setRoadColorMode("live")}
              />
              <Radio className="h-4 w-4 text-emerald-600" />
              <span>
                <strong>Tráfico real</strong>
                {!viewingNow ? " (solo en hora actual)" : " (Ayuntamiento)"}
              </span>
            </label>
            <label
              className={`flex items-center gap-2 rounded-lg border p-2 ${
                viewingNow
                  ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50"
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
                <strong>Predicción del modelo</strong>
                {viewingNow ? " (cambia la hora)" : ""}
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
                Tener en cuenta eventos
              </label>
            )}
          </div>
        </Card>

        <Card title="Tráfico del Ayuntamiento" className="lg:col-span-1">
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
              <p className="text-[11px] text-slate-400">Se actualiza cada 3 min</p>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Cargando tráfico del Ayuntamiento...</p>
          )}
        </Card>

        <Card title="Movilidad en tiempo real" className="lg:col-span-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="space-y-3">
              <button
                type="button"
                disabled={!viewingNow}
                title={!viewingNow ? "Solo disponible en modo actual (hora = ahora)" : undefined}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  !viewingNow
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : mobilityRealtime
                      ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
                onClick={() => setMobilityRealtime((value) => !value)}
              >
                <Wifi className="h-4 w-4" />
                {!viewingNow ? "Tiempo real (solo en ahora)" : mobilityRealtime ? "Tiempo real activo" : "Activar tiempo real"}
              </button>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <span className="rounded-lg bg-slate-50 px-3 py-2">
                  Valenbisi: {valenbisiLoading ? "cargando" : formatRealtimeTime(valenbisiRealtime?.fetchedAt)}
                </span>
                <span className="rounded-lg bg-slate-50 px-3 py-2">
                  EMT: {emtStopsLoading ? "cargando" : `${emtStopsRealtime.length} paradas`}
                </span>
              </div>
              {(valenbisiError || emtStopsError) && (
                <p className="text-xs text-amber-700">
                  {[valenbisiError, emtStopsError].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MOBILITY_LAYER_OPTIONS.map(({ key, label, icon }) => {
                const optionLabel = key === "emtRoutes" && emtRoutesLoading ? "Rutas EMT: cargando" : label;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${
                      mobilityLayers[key]
                        ? "border-brand-200 bg-brand-50 text-brand-800"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={mobilityLayers[key]}
                      onChange={() => toggleMobilityLayer(key)}
                    />
                    {key === "emtRoutes" && emtRoutesLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      icon
                    )}
                    <span>{optionLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Mapa de tráfico">
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
                  Zona afectada por evento
                  {affectedTramoIds.length > 0 ? ` · ${affectedTramoIds.length} tramos` : ""}
                </span>
              )}
              <span className="text-slate-400">· Pasa el ratón para ver vehículos/hora</span>
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
                  Zona afectada · {affectedTramoIds.length} tramos
                </span>
              )}
            </div>
          )}
          {mobilityRealtime && (
            <div className="mb-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                Valenbisi disponible
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                Valenbisi alerta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
                Parada EMT
              </span>
              {mobilityLayers.emtRoutes && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-8 rounded-full border border-blue-500 border-dashed" />
                  {emtRoutesLoading ? "Cargando rutas EMT" : `${visibleEmtRoutes.length} rutas EMT`}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">
                BUS
                <span className="font-normal">posición aproximada</span>
              </span>
            </div>
          )}
          <DynamicMap
            height={560}
            heatmapPoints={roadColorMode === "prediction" ? (heatmap?.points ?? []) : []}
            trafficGeoJson={traffic}
            showTraffic
            roadColorMode={roadColorMode}
            affectedTramoIds={affectedTramoIds}
            eventMarkers={mobilityLayers.events ? mapEvents : []}
            eventImpactZones={mobilityLayers.events ? eventImpactZones : []}
            selectedEventId={selectedEventId}
            valenbisiStations={visibleValenbisiStations}
            emtStops={visibleEmtStops}
            emtRoutes={visibleEmtRoutes}
            estimatedBusPositions={visibleEstimatedBuses}
            selectedEmtStopId={selectedEmtStop?.stopId ?? null}
            onSelectEmtStop={handleSelectEmtStop}
            showOnlyMobilityAlerts={mobilityRealtime && mobilityLayers.onlyAlerts}
            flyTo={selectedEmtStop ? { lat: selectedEmtStop.lat, lon: selectedEmtStop.lon } : null}
          />
          {traffic?.n_tramos === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No hay datos de vías. Comprueba la conexión con geoportal.valencia.es.
            </p>
          )}
        </Card>

        {mobilityRealtime && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Parada EMT seleccionada">
              {selectedEmtStop ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{selectedEmtStop.name}</p>
                      <p className="text-sm text-slate-500">
                        Parada {selectedEmtStop.stopId} · líneas {selectedEmtStop.lines.join(", ") || "sin datos"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => loadEmtArrivalsRealtime(selectedEmtStop)}
                      disabled={emtArrivalsLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${emtArrivalsLoading ? "animate-spin" : ""}`} />
                      Actualizar llegadas
                    </button>
                  </div>

                  {mobilityLayers.emtRoutes && (
                    <p className={`rounded-lg px-3 py-2 text-sm ${
                      emtRoutesError && !emtRoutesLoading && emtRoutesStopId === selectedEmtStop?.stopId
                        ? "bg-amber-50 text-amber-800"
                        : "bg-slate-50 text-slate-600"
                    }`}>
                      {emtRoutesLoading || emtRoutesStopId !== selectedEmtStop?.stopId
                        ? "Calculando ruta..."
                        : emtRoutesError
                          ? emtRoutesError
                          : `${visibleEmtRoutes.length} rutas EMT de esta parada visibles en el mapa.`}
                    </p>
                  )}
                  {emtArrivalsRealtime?.arrivals.length ? (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {emtArrivalsRealtime.arrivals.slice(0, 8).map((arrival, index) => (
                        <div key={`${arrival.line}-${arrival.destination ?? "dest"}-${index}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <div>
                            <p className="font-semibold text-slate-900">Línea {arrival.line}</p>
                            <p className="text-xs text-slate-500">{arrival.destination ?? "Destino no informado"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-900">{arrival.minutes} min</p>
                            <p className="text-xs text-slate-400">
                              {formatRealtimeTime(arrival.expectedArrivalTime)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !emtArrivalsError ? (
                    <p className="text-sm text-slate-500">
                      {emtArrivalsLoading ? "Cargando próximas llegadas..." : "Sin llegadas disponibles para la parada."}
                    </p>
                  ) : null}
                  {visibleEstimatedBuses.length > 0 && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-900">
                      <p className="font-semibold">Buses aproximados en ruta</p>
                      <ul className="mt-2 space-y-1">
                        {visibleEstimatedBuses.slice(0, 4).map((bus) => (
                          <li key={bus.id}>
                            Línea {bus.line}: {bus.minutesToTargetStop} min · fiabilidad {bus.confidence}
                            {bus.delayed ? " · posible retraso" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Selecciona una parada EMT en el mapa para consultar llegadas y ver buses aproximados.
                </p>
              )}
            </Card>

            <Card title="Alertas de movilidad">
              <div className="mb-4 flex flex-wrap gap-2 text-sm">
                <Badge color={mobilityCriticalCount ? "red" : "slate"}>
                  {mobilityCriticalCount} críticas
                </Badge>
                <Badge color={mobilityWarningCount ? "amber" : "slate"}>
                  {mobilityWarningCount} avisos
                </Badge>
                {valenbisiRealtime?.stale && <Badge color="amber">Valenbisi sin datos recientes</Badge>}
              </div>
              {mobilityAlerts.length ? (
                <div className="space-y-3">
                  {mobilityAlertGroups.map((group) => (
                    <div key={group.id}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {group.label} · {group.items.length}
                      </p>
                      <div className="space-y-2">
                        {group.items.slice(0, 4).map((alert) => (
                          <div key={alert.id} className={`rounded-lg border px-3 py-2 text-sm ${mobilityAlertTone(alert)}`}>
                            <p className="font-semibold">{alert.title}</p>
                            <p className="mt-0.5 text-xs">{alert.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sin alertas activas con las capas actuales.</p>
              )}
              <p className="mt-4 text-xs leading-5 text-slate-500">
                La posición del bus se calcula con el tiempo de llegada y la ruta; no es GPS real.
                La precisión depende de las rutas disponibles, el orden de paradas y la respuesta de EMT.
              </p>
            </Card>
          </div>
        )}

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

      <Callout tone="brand" title="Qué incluye esta página">
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <strong>Resumen, eventos, evaluación, monitorización y sistema</strong> están separados en pestañas.
          </li>
          <li>
            <strong>Evaluación:</strong> muestra métricas generales y de la hora seleccionada.
          </li>
          <li>
            <strong>Monitorización:</strong> marca zonas con mucha presión o poca fiabilidad histórica.
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
