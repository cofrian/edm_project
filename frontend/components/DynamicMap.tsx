"use client";

import dynamic from "next/dynamic";

// Leaflet solo funciona en cliente: se carga sin SSR.
export const DynamicMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] animate-pulse items-center justify-center rounded-[1.5rem] bg-white text-sm text-slate-400 shadow-map">
      Cargando mapa…
    </div>
  ),
});
