"use client";

import dynamic from "next/dynamic";

const mapLoading = (h = 460) => (
  <div
    style={{ height: h }}
    className="flex animate-pulse items-center justify-center rounded-[1.5rem] bg-white text-sm text-slate-400 shadow-map"
  >
    Cargando mapa…
  </div>
);

// Leaflet solo funciona en cliente: se carga sin SSR.
export const DynamicMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => mapLoading(560),
});

export const CityMap = dynamic(() => import("./CityMap"), {
  ssr: false,
  loading: () => mapLoading(520),
});
