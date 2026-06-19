"use client";

import { useState } from "react";
import { Building2, Bike, HeartPulse, Route } from "lucide-react";
import { CityMap } from "@/components/DynamicMap";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/ui";
import { DEFAULT_LAYERS, LAYER_META } from "@/lib/mapLayers";
import type { LayerKey } from "@/lib/types";

const PRESETS: { id: string; label: string; icon: React.ReactNode; layers: Partial<Record<LayerKey, boolean>> }[] = [
  {
    id: "all",
    label: "Vista completa",
    icon: <Building2 className="h-4 w-4" />,
    layers: { valenbisi: true, sports: true, health: true, traffic: true, proposed: false },
  },
  {
    id: "mobility",
    label: "Movilidad",
    icon: <Bike className="h-4 w-4" />,
    layers: { valenbisi: true, traffic: true, sports: false, health: false, proposed: false },
  },
  {
    id: "facilities",
    label: "Equipamientos",
    icon: <HeartPulse className="h-4 w-4" />,
    layers: { sports: true, health: true, valenbisi: false, traffic: false, proposed: false },
  },
  {
    id: "traffic",
    label: "Red viaria",
    icon: <Route className="h-4 w-4" />,
    layers: { traffic: true, valenbisi: true, sports: false, health: false, proposed: false },
  },
];

export default function MapaPage() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [preset, setPreset] = useState("all");

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setLayers({ ...DEFAULT_LAYERS, ...p.layers });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explorador urbano · Valencia"
        title="Mapa de la ciudad"
        description="Visualiza en capas la red Valenbisi, equipamientos deportivos y sanitarios, y la muestra de segmentos viarios. Base para decidir dónde actuar antes de lanzar una optimización."
      />

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              preset === p.id
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      <CityMap
        height="min(72vh, 720px)"
        layers={layers}
        proposedMarkers={[]}
        showLayerControl
        fitToProposed={false}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(LAYER_META) as LayerKey[])
          .filter((k) => k !== "proposed")
          .map((key) => (
            <Card key={key} className="!p-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: LAYER_META[key].color }}
                />
                <div>
                  <p className="font-semibold text-slate-900">{LAYER_META[key].label}</p>
                  <p className="mt-1 text-xs text-slate-500">{LAYER_META[key].description}</p>
                </div>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}
