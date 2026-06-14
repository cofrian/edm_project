import { Card, Badge } from "@/components/Card";

export const metadata = { title: "Metodología EDM · UrbanFlow Valencia" };

const MAPPING: [string, string][] = [
  ["Business Understanding", "Reducir la presión de tráfico y mejorar la movilidad sostenible en Valencia."],
  ["Data Understanding", "EDA de tráfico, meteorología y geometría de zonas (octubre 2023)."],
  ["Data Preparation", "Limpieza, imputación, baseline suavizado, features de calendario y lags; fix de tipo de Zona."],
  ["Modeling", "CatBoost por hora (baseline + residuo log-ratio + shrink + embeddings de zona)."],
  ["Evaluation", "MAE, RMSE, R², sMAPE en validación temporal (holdout 25–31 oct); errores por hora/zona."],
  ["Deployment", "Frontend en Vercel + backend FastAPI en Docker (Hugging Face Spaces)."],
  ["Monitoring", "Alertas de MAE por hora/zona, fecha de datos, modelo activo, nota de drift."],
  ["ModelOps", "CI/CD con GitHub Actions, ramas feature→develop→main→production, Git LFS, validación de artefactos."],
  ["Aplicación", "Dashboard web con predicción, mapas y optimización bajo demanda."],
];

export default function MetodologiaPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Metodología EDM</h1>
        <p className="mt-2 text-slate-600">
          Cómo UrbanFlow Valencia cubre el ciclo CRISP-DM y el temario de
          Evaluación, Despliegue y Monitorización de modelos.
        </p>
      </div>

      <Card title="Bloque EDM → Implementación">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Bloque EDM</th>
                <th className="py-2">Implementación en UrbanFlow</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map(([k, v]) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-700">{k}</td>
                  <td className="py-2 text-slate-600">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Interpretabilidad y fiabilidad">
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>Baseline explicable + embeddings de zona como similitud espacial.</li>
            <li>Importancia de variables meteorológicas y de calendario.</li>
            <li>Validación de payloads con Pydantic y CORS controlado.</li>
          </ul>
        </Card>
        <Card title="Limitaciones y riesgos">
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>Datos de un único mes (octubre 2023): posible sesgo estacional.</li>
            <li>Cobertura de población en optimización mediante proxy geométrico documentado.</li>
            <li>Error elevado en horas valle y algunas zonas periféricas.</li>
          </ul>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge color="blue">CRISP-DM</Badge>
        <Badge color="green">CatBoost / Ensembles</Badge>
        <Badge color="amber">Optimización (PuLP)</Badge>
        <Badge color="slate">CI/CD · Docker · LFS</Badge>
      </div>
    </div>
  );
}
