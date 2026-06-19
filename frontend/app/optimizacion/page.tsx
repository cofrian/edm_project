import { Suspense } from "react";
import OptimizacionPage from "./OptimizacionClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Cargando consola…</div>}>
      <OptimizacionPage />
    </Suspense>
  );
}
