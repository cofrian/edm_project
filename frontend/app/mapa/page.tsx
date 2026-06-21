"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Bike, HeartPulse, Route, Users } from "lucide-react";
import { CityMap } from "@/components/DynamicMap";
import { ApiStatusBanner } from "@/components/ApiStatusBanner";
import { Badge, Card } from "@/components/Card";
import { PageHeader, Stat } from "@/components/ui";
import { DEFAULT_LAYERS } from "@/lib/mapLayers";
import { api } from "@/lib/api";
import type { LayerKey } from "@/lib/types";

const PRESETS: {
  id: string;
  label: string;
  icon: React.ReactNode;
  layers: Partial<Record<LayerKey, boolean>>;
  sector: string;
  demandType?: "sports" | "health";
}[] = [
  {
    id: "all",
    label: "Vista general",
    icon: <Building2 className="h-3.5 w-3.5" />,
    layers: {
      valenbisi: true,
      sports: true,
      health: true,
      candidates: false,
      traffic: false,
      demand: false,
      proposed: false,
    },
    sector: "multi",
  },
  {
    id: "mobility",
    label: "Movilidad",
    icon: <Bike className="h-3.5 w-3.5" />,
    layers: {
      valenbisi: true,
      candidates: true,
      traffic: true,
      sports: false,
      health: false,
      proposed: false,
    },
    sector: "valenbisi",
  },
  {
    id: "facilities",
    label: "Equipamientos",
    icon: <HeartPulse className="h-3.5 w-3.5" />,
    layers: {
      sports: true,
      health: true,
      demand: true,
      candidates: true,
      valenbisi: false,
      proposed: false,
    },
    sector: "sports",
    demandType: "sports",
  },
  {
    id: "health",
    label: "Salud",
    icon: <Users className="h-3.5 w-3.5" />,
    layers: {
      health: true,
      demand: true,
      candidates: true,
      sports: false,
      valenbisi: false,
      proposed: false,
    },
    sector: "health",
    demandType: "health",
  },
  {
    id: "traffic",
    label: "Red viaria",
    icon: <Route className="h-3.5 w-3.5" />,
    layers: {
      traffic: true,
      valenbisi: true,
      sports: false,
      health: false,
      proposed: false,
    },
    sector: "valenbisi",
  },
];

function MapaContent() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [preset, setPreset] = useState("all");
  const [demandType, setDemandType] = useState<"sports" | "health">("sports");
  const [valenbisiCount, setValenbisiCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    n_candidates: number;
    n_hexes: number;
    hexes_need_sports: number;
    hexes_need_health: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.coverageSummary(), api.mapValenbisi()]).then(([coverage, valenbisi]) => {
      if (!active) return;
      setSummary(coverage.ok ? coverage.data : null);
      setValenbisiCount(valenbisi.ok ? valenbisi.data.features.length : null);
    });
    return () => {
      active = false;
    };
  }, []);

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setLayers({ ...DEFAULT_LAYERS, ...p.layers });
    if (p.demandType) setDemandType(p.demandType);
  }

  const activePreset = PRESETS.find((p) => p.id === preset);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Explorador urbano"
        title="Mapa de Valencia"
        description="Vista GIS para revisar capas de movilidad, equipamientos, demanda y candidatos antes de lanzar una optimización."
      >
        <Badge color="blue">GIS</Badge>
        {activePreset && <Badge color="green">{activePreset.label}</Badge>}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Valenbisi"
          value={valenbisiCount ?? "—"}
          hint="Estaciones actuales inventariadas"
          tone="amber"
          icon={<Bike className="h-4 w-4" />}
        />
        <Stat
          label="Candidatos"
          value={summary?.n_candidates ?? "—"}
          hint="Ubicaciones evaluables"
          tone="brand"
          icon={<Building2 className="h-4 w-4" />}
        />
        <Stat
          label="Demanda deporte"
          value={summary?.hexes_need_sports ?? "—"}
          hint="Hexágonos sin cobertura"
          tone="teal"
          icon={<HeartPulse className="h-4 w-4" />}
        />
        <Stat
          label="Demanda salud"
          value={summary?.hexes_need_health ?? "—"}
          hint="Hexágonos sin cobertura"
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="eyebrow">Vista de capas</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Observatorio GIS operativo
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Cambia de preset para activar capas relacionadas. Valenbisi muestra
              ubicación de estaciones actuales; la disponibilidad de bicis en vivo
              no está conectada todavía.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  preset === p.id
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-card"
                }`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
            {activePreset && (
              <Link
                href={`/optimizacion?sector=${activePreset.sector}`}
                className="btn-primary px-4 py-2 text-xs"
              >
                Optimizar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ApiStatusBanner compact />
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
            Valenbisi: inventario de estaciones, no disponibilidad en vivo
          </span>
        </div>

        <div className="relative min-h-0 overflow-hidden rounded-[1.75rem] shadow-map">
        <CityMap
          height={720}
          layers={layers}
          demandType={demandType}
          proposedMarkers={[]}
          showLayerControl
          showLegend
          basemap="light"
          fitToProposed={false}
        />
        </div>
      </Card>
    </div>
  );
}

export default function MapaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center text-slate-500">
          Cargando mapa…
        </div>
      }
    >
      <MapaContent />
    </Suspense>
  );
}
