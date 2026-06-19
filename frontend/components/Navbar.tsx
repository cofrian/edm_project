"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-[1000] bg-surface-app/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-900 text-white shadow-sm">
            <Network className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display font-bold tracking-[-0.03em] text-slate-950">UrbanFlow</span>
            <span className="block text-xs font-medium text-slate-500">
              Valencia · Optimización urbana
            </span>
          </span>
        </Link>

        {/* Desktop */}
        <ul className="hidden items-center gap-1 rounded-full bg-white p-1 shadow-card lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  isActive(l.href)
                    ? "bg-slate-900 font-semibold text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-card lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="bg-surface-app/95 px-4 pb-4 lg:hidden">
          <ul className="mx-auto flex max-w-[1440px] flex-col gap-1 rounded-2xl bg-white p-2 shadow-card sm:px-3">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-full px-4 py-2.5 text-sm transition ${
                    isActive(l.href)
                      ? "bg-slate-900 font-semibold text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
