"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers3,
  Map,
  Sparkles,
} from "lucide-react";
import { DOC_LINKS, WORKSPACE_LINKS } from "@/lib/constants";

const ICONS: Record<string, React.ReactNode> = {
  "/mapa": <Layers3 className="h-[18px] w-[18px]" />,
  "/optimizacion": <Sparkles className="h-[18px] w-[18px]" />,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isWorkspace =
    pathname.startsWith("/mapa") || pathname.startsWith("/optimizacion");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-surface-950 text-slate-100">
      <aside
        className={`console-sidebar shrink-0 transition-[width] duration-200 ${
          collapsed ? "w-[68px]" : "w-[220px]"
        }`}
      >
        <div className="flex h-full flex-col border-r border-white/[0.06] bg-surface-900/95 backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-glow-cyan">
              <Map className="h-5 w-5 text-white" />
            </span>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <p className="truncate font-semibold tracking-tight text-white">
                  UrbanFlow
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  Valencia · Planificación
                </p>
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1 px-2 py-4">
            <p
              className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${
                collapsed ? "sr-only" : ""
              }`}
            >
              Herramientas
            </p>
            {WORKSPACE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={`console-nav-item ${isActive(link.href) ? "console-nav-item-active" : ""}`}
              >
                {ICONS[link.href] ?? <Bike className="h-[18px] w-[18px]" />}
                {!collapsed && <span>{link.label}</span>}
              </Link>
            ))}

            <div className="my-4 border-t border-white/[0.06]" />

            <p
              className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 ${
                collapsed ? "sr-only" : ""
              }`}
            >
              Referencia
            </p>
            <Link
              href="/metodologia"
              title="Documentación"
              className={`console-nav-item ${isActive("/metodologia") || pathname.startsWith("/datos") || pathname.startsWith("/evaluacion") ? "console-nav-item-active" : ""}`}
            >
              <FileText className="h-[18px] w-[18px]" />
              {!collapsed && <span>Documentación</span>}
            </Link>
          </nav>

          {!collapsed && (
            <div className="border-t border-white/[0.06] px-4 py-3 text-[10px] text-slate-500">
              <p>Datos oct-2023 · PuLP/CBC</p>
              <p className="mt-0.5 text-slate-600">Pipeline urbano validado</p>
            </div>
          )}

          <button
            type="button"
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center justify-center border-t border-white/[0.06] py-3 text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isWorkspace ? (
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        ) : (
          <>
            <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
              {children}
            </main>
            {!collapsed && (
              <footer className="border-t border-white/[0.06] px-6 py-4 text-center text-[11px] text-slate-600">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                  {DOC_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="hover:text-slate-400"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </footer>
            )}
          </>
        )}
      </div>
    </div>
  );
}
