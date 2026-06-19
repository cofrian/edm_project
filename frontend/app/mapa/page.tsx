"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Bike, HeartPulse, Route } from "lucide-react";
import { CityMap } from "@/components/DynamicMap";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/ui";
import { ApiStatusBanner } from "@/components/ApiStatusBanner";
import { DEFAULT_LAYERS, LAYER_META } from "@/lib/mapLayers";
import { api } from "@/lib/api";
import type { LayerKey } from "@/lib/types";

const PRESETS: {
  id: string;
  label: string;
  icon: React.ReactNode;
  layers: Partial<Record<LayerKey, boolean>>;
  sector: string;
}[] = [
  {
    id: "all",
    label: "Vista completa",
    icon: <Building2 className="h-4 w-4" />,
    layers: { valenbisi: true, sports: true, health: true, candidates: true, traffic: true, proposed: false },
    sector: "multi",
  },
  {
    id: "mobility",
    label: "Movilidad",
    icon: <Bike className="h-4 w-4" />,
    layers: { valenbisi: true, candidates: true, traffic: true, sports: false, health: false, proposed: false },
    sector: "valenbisi",
  },
  {
    id: "facilities",
    label: "Equipamientos",
    icon: <HeartPulse className="h-4 w-4" />,
    layers: { sports: true, health: true, demand: true, candidates: true, valenbisi: false, proposed: false },
    sector: "sports",
  },
  {
    id: "traffic",
    label: "Red viaria",
    icon: <Route className="h-4 w-4" />,
    layers: { traffic: true, valenbisi: true, sports: false, health: false, proposed: false },
    sector: "valenbisi",
  },
];

function MapaContent() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [preset, setPreset] = useState("all");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.coverageSummary>> | null>(null);
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.metadata>> | null>(null);

  useEffect(() => {
    Promise.all([api.coverageSummary(), api.metadata()]).then(([s, m]) => {
      setSummary(s);
      setMeta(m);
    });
  }, []);

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setLayers({ ...DEFAULT_LAYERS, ...p.layers });
  }

  const activePreset = PRESETS.find((p) => p.id === preset);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explorador urbano · Valencia"
        title="Mapa de la ciudad"
        description="Visualiza Valenbisi, equipamientos, demanda censal y candidatos antes de lanzar una optimización."
      />

      <ApiStatusBanner />

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="!p-4">
            <p className="text-xs text-slate-500">Candidatos</p>
            <p className="text-2xl font-bold text-slate-900">{summary.n_candidates}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs text-slate-500">Hexágonos con demanda deporte</p>
            <p className="text-2xl font-bold text-slate-900">{summary.hexes_need_sports}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs text-slate-500">Hexágonos con demanda salud</p>
            <p className="text-2xl font-bold text-slate-900">{summary.hexes_need_health}</p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs text-slate-500">Datos</p>
            <p className="text-sm font-semibold text-slate-900">{meta?.data_date ?? "—"}</p>
            <p className="text-xs text-slate-500">
              ILP censal: {meta?.coverage_data ? "activo" : "modo simplificado"}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
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
        {activePreset && (
          <Link
            href={`/optimizacion?sector=${activePreset.sector}`}
            className="btn-primary ml-auto"
          >
            Optimizar este ámbito <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <CityMap
        height="min(72vh, 720px)"
        layers={layers}
        demandType="sports"
        proposedMarkers={[]}
        showLayerControl
        fitToProposed={false}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(LAYER_META) as LayerKey[]).map((key) => (
          <Card key={key} className="!p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: LAYER_META[key].color }} />
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

export default function MapaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Cargando mapa…</div>}>
      <MapaContent />
    </Suspense>
  );
}
