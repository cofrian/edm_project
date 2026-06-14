import { Card, Badge } from "@/components/Card";

export const metadata = { title: "Datos · UrbanFlow Valencia" };

const VARIABLES = [
  ["Zona", "Identificador de zona/sensor de tráfico (~1.158 zonas)"],
  ["Intensidad", "Vehículos/hora (variable objetivo)"],
  ["Velocidad / Ocupación", "Estado del tráfico por zona"],
  ["temp_c, hum_rel_%, pres_mb", "Meteorología horaria"],
  ["vel_viento_ms, dir_viento_grados", "Viento (módulo y dirección)"],
  ["precip_lm2, rad_wm2", "Precipitación y radiación"],
  ["Año, Mes, Dia, Hora, Dia_Semana", "Calendario"],
];

export default function DatosPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Datos</h1>
        <p className="mt-2 text-slate-600">
          Fuente real: tráfico y meteorología de Valencia, octubre 2023 (~853.000 registros
          horarios por zona). Datos procesados de las carpetas del proyecto, sin datos inventados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Fuentes de datos">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• <strong>oct_2023_imputado.csv</strong> — tráfico + meteo horario (imputado).</li>
            <li>• <strong>zonas_coordenadas.csv</strong> — coordenadas por zona.</li>
            <li>• <strong>calles_valencia.geojson</strong> — geometría de calles.</li>
            <li>• <strong>localizaciones2.csv</strong> — candidatos de movilidad (isócronas + coste).</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge color="blue">CRISP-DM: Data Understanding</Badge>
            <Badge color="blue">Data Preparation</Badge>
          </div>
        </Card>

        <Card title="Variables principales">
          <table className="w-full text-sm">
            <tbody>
              {VARIABLES.map(([v, d]) => (
                <tr key={v} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-slate-700">{v}</td>
                  <td className="py-2 text-slate-500">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Limpieza y preparación">
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>Imputación de huecos por media de hora anterior/siguiente del mismo día y zona.</li>
          <li>Unificación del tipo de <code>Zona</code> (fix del bug de merge object/int64).</li>
          <li>Baseline suavizado por (Zona, Día de semana, Hora) como patrón estructural.</li>
          <li>Features de calendario (seno/coseno de hora, tipo de día) y lags meteorológicos.</li>
          <li>Validación temporal: entrenamiento días 1–24, holdout 25–31 de octubre.</li>
        </ul>
      </Card>
    </div>
  );
}
