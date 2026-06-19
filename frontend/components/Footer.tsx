import Link from "next/link";
import { DOC_LINKS } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="font-bold text-slate-900">UrbanFlow Valencia</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Herramienta de planificación para localizar equipamientos urbanos y
            estaciones Valenbisi maximizando cobertura bajo presupuesto.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Plataforma
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            <li><Link href="/mapa" className="hover:text-brand-700">Mapa urbano</Link></li>
            <li><Link href="/optimizacion" className="hover:text-brand-700">Optimización</Link></li>
            <li><Link href="/metodologia" className="hover:text-brand-700">Documentación</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Modelo de demanda
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {DOC_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-brand-700">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>UrbanFlow · Ayuntamiento de Valencia · datos octubre 2023</p>
          <p>Optimización PuLP · señal tráfico precalculada (CatBoost)</p>
        </div>
      </div>
    </footer>
  );
}
