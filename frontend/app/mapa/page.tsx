"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Bike, HeartPulse, Route, Users } from "lucide-react";
import { CityMap } from "@/components/DynamicMap";
import { ApiStatusBanner } from "@/components/ApiStatusBanner";
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
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.coverageSummary>> | null>(
    null
  );

  useEffect(() => {
    api.coverageSummary().then(setSummary);
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
    <div className="flex h-[100dvh] min-h-0 flex-col">
      <header className="console-panel z-10 shrink-0 rounded-none border-x-0 border-t-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/80">
              Explorador urbano
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Mapa de Valencia
            </h1>
          </div>

          {summary && (
            <div className="hidden items-center gap-2 lg:flex">
              <div className="console-stat text-center">
                <p className="text-[10px] text-slate-500">Candidatos</p>
                <p className="text-sm font-bold text-white">{summary.n_candidates}</p>
              </div>
              <div className="console-stat text-center">
                <p className="text-[10px] text-slate-500">Demanda deporte</p>
                <p className="text-sm font-bold text-white">{summary.hexes_need_sports}</p>
              </div>
              <div className="console-stat text-center">
                <p className="text-[10px] text-slate-500">Demanda salud</p>
                <p className="text-sm font-bold text-white">{summary.hexes_need_health}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`console-chip ${preset === p.id ? "console-chip-active" : ""}`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </div>

          {activePreset && (
            <Link
              href={`/optimizacion?sector=${activePreset.sector}`}
              className="console-btn-primary shrink-0 text-xs"
            >
              Optimizar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="border-t border-white/[0.06] px-4 py-2">
          <ApiStatusBanner compact />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <CityMap
          height="100%"
          fullBleed
          layers={layers}
          demandType={demandType}
          proposedMarkers={[]}
          showLayerControl
          showLegend
          fitToProposed={false}
        />
      </div>
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
