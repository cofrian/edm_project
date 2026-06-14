import { Card, Badge } from "@/components/Card";
import { PageHeader, Stat, Callout } from "@/components/ui";
import { MapPinned, Building2, Users, Car } from "lucide-react";

export const metadata = { title: "Datos" };

const OPT_DATA = [
  ["localizaciones2.csv", "128 ubicaciones candidatas con isócrona (área alcanzable a pie) y dos costes de implantación."],
  ["centros-deportivo-valencia.csv", "Equipamientos existentes con su isócrona: definen la cobertura actual y el déficit."],
  ["population_spain.gpkg", "Capa de población (cuadrícula) para estimar la demanda alcanzable por cada candidato."],
];

const TRAFFIC_VARS = [
  ["Zona", "Identificador de zona/sensor de tráfico (~1.158 zonas)"],
  ["Intensidad", "Vehículos/hora — objetivo del modelo de demanda"],
  ["Velocidad / Ocupación", "Estado del tráfico por zona"],
  ["temp_c, hum_rel, pres_mb", "Meteorología horaria"],
  ["viento, precip_lm2, rad_wm2", "Viento, precipitación y radiación"],
  ["Año, Mes, Día, Hora, Día_Semana", "Calendario"],
];

export default function DatosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CRISP-DM · Data Understanding & Preparation"
        title="Datos urbanos de Valencia"
        description="La plataforma combina dos familias de datos reales: la geometría de la decisión (candidatos, equipamientos, población, costes) y la señal de demanda (tráfico y meteorología, octubre 2023)."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ubicaciones candidatas" value={128} tone="brand" icon={<MapPinned className="h-4 w-4" />} />
        <Stat label="Equipamientos existentes" value="40+" tone="teal" icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Zonas de tráfico" value="~1.158" icon={<Car className="h-4 w-4" />} />
        <Stat label="Registros horarios" value="~853k" hint="Octubre 2023" icon={<Users className="h-4 w-4" />} />
      </section>

      {/* Datos de optimización (protagonistas) */}
      <Card>
        <p className="eyebrow">Datos de la decisión</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">Geometría de la optimización</h3>
        <p className="mt-1 text-sm text-slate-500">
          Estos datos definen qué se puede instalar, dónde y a qué coste, y qué cobertura ya existe.
        </p>
        <div className="mt-4 space-y-3">
          {OPT_DATA.map(([f, d]) => (
            <div key={f} className="rounded-xl border border-slate-200 p-3">
              <code className="text-sm font-semibold text-brand-700">{f}</code>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge color="blue">Isócronas (polígonos)</Badge>
          <Badge color="green">Costes reales</Badge>
          <Badge color="amber">Cobertura existente</Badge>
        </div>
      </Card>

      {/* Concepto de isócrona */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="¿Qué es una isócrona?">
          <p className="text-sm text-slate-600">
            Es el área que se puede alcanzar a pie desde un punto en un tiempo
            dado (p. ej. 10 minutos). Define la <strong>zona de influencia</strong>{" "}
            de un equipamiento: cuanta más población cae dentro, mayor es su
            utilidad. Comparando isócronas de candidatos con las de equipamientos
            existentes se detecta el <strong>déficit de cobertura</strong>.
          </p>
          <Callout tone="teal" title="Transparencia metodológica">
            La población alcanzable se aproxima mediante el área de la isócrona
            cuando no se cruza con el censo; está documentado como proxy y no se
            presenta como dato censal exacto.
          </Callout>
        </Card>

        <Card title="Señal de demanda (tráfico)">
          <p className="text-sm text-slate-600">
            El tráfico actúa como indicador de actividad urbana: las zonas con
            mayor presión concentran más movimiento ciudadano. El modelo CatBoost
            lo predice por zona y hora a partir de estas variables.
          </p>
          <div className="mt-4 overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <tbody>
                {TRAFFIC_VARS.map(([v, d]) => (
                  <tr key={v} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-700">{v}</td>
                    <td className="py-2 text-slate-500">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Limpieza y preparación">
        <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li className="rounded-lg bg-slate-50 p-3">Imputación de huecos por media de hora anterior/siguiente del mismo día y zona.</li>
          <li className="rounded-lg bg-slate-50 p-3">Unificación del tipo de <code>Zona</code> (corrección del bug de merge object/int64).</li>
          <li className="rounded-lg bg-slate-50 p-3">Baseline suavizado por (Zona, Día, Hora) como patrón estructural del tráfico.</li>
          <li className="rounded-lg bg-slate-50 p-3">Parseo de isócronas WKT, cálculo de áreas y detección de solape con equipamientos.</li>
          <li className="rounded-lg bg-slate-50 p-3">Features de calendario (seno/coseno de hora, tipo de día) y lags meteorológicos.</li>
          <li className="rounded-lg bg-slate-50 p-3">Validación temporal: entrenamiento días 1–24, holdout 25–31 de octubre.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge color="blue">Sin datos inventados</Badge>
          <Badge color="slate">Secretos fuera del repositorio</Badge>
        </div>
      </Card>
    </div>
  );
}
