"use client";

import dynamic from "next/dynamic";

// Leaflet solo funciona en cliente: se carga sin SSR.
export const DynamicMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] animate-pulse items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
      Cargando mapa…
    </div>
  ),
});
