"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const CityMapImpl = dynamic(() => import("./CityMap"), {
  ssr: false,
  loading: () => (
    <div className="flex animate-pulse items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-400" style={{ height: 520 }}>
      Cargando mapa urbano…
    </div>
  ),
});

export function CityMap(props: ComponentProps<typeof CityMapImpl>) {
  return <CityMapImpl {...props} />;
}

/** @deprecated Usar CityMap para mapas con capas */
export const DynamicMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] animate-pulse items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
      Cargando mapa…
    </div>
  ),
});
