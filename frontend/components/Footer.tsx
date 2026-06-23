import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="font-bold text-slate-900">UrbanFlow Valencia</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Predicción de tráfico con CatBoost y optimización de equipamientos
            urbanos con ILP. Datos reales de Valencia — EDM · CUNEF Universidad.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Plataforma
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            <li><Link href="/optimizacion" className="hover:text-brand-700">Optimización</Link></li>
            <li><Link href="/datos" className="hover:text-brand-700">Datos</Link></li>
            <li><Link href="/evaluacion" className="hover:text-brand-700">Evaluación del modelo</Link></li>
            <li><Link href="/metodologia" className="hover:text-brand-700">Documentación</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Stack
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            <li>PuLP · CBC (optimización)</li>
            <li>CatBoost (demanda)</li>
            <li>FastAPI · Next.js</li>
            <li>Docker · CI/CD</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>UrbanFlow Valencia · Plataforma de decisión urbana.</p>
          <p>sortmon@etsinf.upv.es · ltriesp@etsinf.upv.es · fmargom1@etsinf.upv.es</p>
        </div>
      </div>
    </footer>
  );
}
