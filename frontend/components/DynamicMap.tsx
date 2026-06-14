"use client";

import dynamic from "next/dynamic";

// Leaflet solo funciona en cliente: se carga sin SSR.
export const DynamicMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-xl bg-slate-100 text-slate-400">
      Cargando mapa…
    </div>
  ),
});
