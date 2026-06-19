import type { OptimizeResponse } from "./types";

export function exportProposalCsv(result: OptimizeResponse, filename = "propuesta_urbana.csv") {
  const header = ["rank", "candidate_id", "facility_type", "zona", "lat", "lon", "score", "cost"];
  const rows = result.selected.map((s, i) =>
    [
      i + 1,
      s.candidate_id,
      s.facility_type ?? "",
      s.zona ?? "",
      s.lat,
      s.lon,
      s.score,
      s.cost,
    ].join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function exportProposalGeoJson(result: OptimizeResponse, filename = "propuesta_urbana.geojson") {
  const fc = {
    type: "FeatureCollection",
    features: result.selected.map((s, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        rank: i + 1,
        candidate_id: s.candidate_id,
        facility_type: s.facility_type,
        zona: s.zona,
        score: s.score,
        cost: s.cost,
      },
    })),
  };
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
  triggerDownload(blob, filename);
}

export function printProposalReport() {
  window.print();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
