"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";

export function ApiStatusBanner({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"loading" | "ok" | "down">("loading");
  const [coverage, setCoverage] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([api.health(), api.metadata()]).then(([h, m]) => {
      setStatus(h.status === "ok" ? "ok" : "down");
      setCoverage(m.coverage_data ?? false);
    });
  }, []);

  if (status === "loading") return null;

  if (compact) {
    if (status === "down") {
      return (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <WifiOff className="h-3.5 w-3.5" />
          API desconectada · levanta backend :8000
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Wifi className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-emerald-400/90">API conectada</span>
        {coverage === false && (
          <span className="text-amber-400/90">· ILP censal no cargado</span>
        )}
      </div>
    );
  }

  if (status === "down") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          La API de planificación no está disponible. Levanta el backend en{" "}
          <code className="rounded bg-red-500/20 px-1">localhost:8000</code> antes de optimizar.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>API conectada</span>
      {coverage === false && (
        <span className="text-amber-300">
          · ILP censal no cargado: deporte/salud usarán modo simplificado
        </span>
      )}
    </div>
  );
}
