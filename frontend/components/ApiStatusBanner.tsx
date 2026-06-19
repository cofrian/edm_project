"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

export function ApiStatusBanner() {
  const [status, setStatus] = useState<"loading" | "ok" | "down">("loading");
  const [coverage, setCoverage] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([api.health(), api.metadata()]).then(([h, m]) => {
      setStatus(h.status === "ok" ? "ok" : "down");
      setCoverage(m.coverage_data ?? false);
    });
  }, []);

  if (status === "loading") return null;

  if (status === "down") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          La API de planificación no está disponible. Levanta el backend en{" "}
          <code className="rounded bg-red-100 px-1">localhost:8000</code> antes de optimizar.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>API conectada</span>
      {coverage === false && (
        <span className="text-amber-700">
          · ILP censal no cargado: deporte/salud usarán modo simplificado
        </span>
      )}
    </div>
  );
}
