import { Badge, Card } from "@/components/Card";
import { PageHeader, Stat } from "@/components/ui";
import {
  Building2,
  Car,
  Database,
  GitBranch,
  MapPinned,
  Radar,
  Route,
  Users,
} from "lucide-react";

export const metadata = { title: "Datos" };

const OPT_DATA = [
  ["Candidatos", "128 ubicaciones evaluables con coordenadas, coste e isócrona."],
  ["Cobertura actual", "Equipamientos existentes y su área alcanzable para medir déficit."],
  ["Población", "Cuadrícula/hexágonos de población para cuantificar habitantes cubiertos."],
  ["Capas GIS", "Tráfico, estaciones Valenbisi y cobertura existente servidos como GeoJSON."],
];

const CONCEPTS = [
  {
    title: "Isócrona",
    text: "Área alcanzable a pie desde un punto en un tiempo dado. Define la zona de influencia.",
    icon: <Route className="h-4 w-4" />,
  },
  {
    title: "Cobertura",
    text: "Habitantes cuyo centroide cae dentro de una isócrona de servicio.",
    icon: <Users className="h-4 w-4" />,
  },
  {
    title: "Déficit",
    text: "Población no cubierta por la red existente y, por tanto, prioritaria.",
    icon: <Radar className="h-4 w-4" />,
  },
];

const TRAFFIC_VARS = [
  ["Zona", "Identificador de zona/sensor de tráfico (~1.158 zonas)"],
  ["Intensidad", "Vehículos/hora; objetivo del modelo de demanda"],
  ["Velocidad / Ocupación", "Estado del tráfico por zona"],
  ["Meteorología", "Temperatura, humedad, presión, viento, precipitación y radiación"],
  ["Calendario", "Año, mes, día, hora y día de la semana"],
];

const PREP_STEPS = [
  "Imputación de huecos por contexto horario de la misma zona.",
  "Unificación del tipo de Zona para evitar errores de merge.",
  "Baseline suavizado por zona, día y hora como patrón estructural.",
  "Parseo de isócronas, cálculo de áreas y detección de solape.",
  "Features de calendario y variables meteorológicas preparadas para CatBoost.",
  "Validación temporal: entrenamiento días 1-24 y holdout 25-31 de octubre.",
];

export default function DatosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Datos urbanos"
        title="Base de datos de la decisión"
        description="La app separa datos de optimización, demanda y monitorización para que cada resultado pueda explicarse desde su fuente."
      />

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Candidatos" value={128} tone="brand" icon={<MapPinned className="h-4 w-4" />} />
        <Stat label="Equipamientos" value="40+" tone="teal" icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Zonas tráfico" value="~1.158" icon={<Car className="h-4 w-4" />} />
        <Stat label="Registros" value="~853k" hint="Octubre 2023" icon={<Database className="h-4 w-4" />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <p className="eyebrow">Geometría de la optimización</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Qué datos usa el solver
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cada candidato se evalúa por coste, población que puede cubrir y
            solape con la cobertura existente. Esa combinación permite comparar
            ubicaciones de forma homogénea.
          </p>
          <div className="mt-5 grid gap-3">
            {OPT_DATA.map(([name, detail]) => (
              <div key={name} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">{name}</p>
                <p className="mt-1 text-sm text-slate-600">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge color="blue">Isócronas</Badge>
            <Badge color="green">Costes</Badge>
            <Badge color="slate">GeoJSON</Badge>
          </div>
        </Card>

        <Card>
          <p className="eyebrow">Conceptos clave</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Cómo se interpreta la cobertura
          </h3>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {CONCEPTS.map((concept) => (
              <div key={concept.title} className="rounded-2xl bg-slate-50 p-4">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm">
                  {concept.icon}
                </span>
                <p className="mt-3 font-semibold text-slate-950">{concept.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{concept.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-cyan-50 p-5 text-sm leading-6 text-slate-700">
            La cobertura se calcula cruzando centroides de población con
            isócronas. Así la app distingue entre habitantes ya cubiertos y
            nueva cobertura potencial.
          </div>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <p className="eyebrow">Señal de demanda</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Variables de tráfico y contexto
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El tráfico actúa como indicador de actividad urbana. El modelo
            CatBoost lo predice por zona y hora a partir de variables de
            calendario, meteorología y estado del tráfico.
          </p>
          <div className="mt-4 overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <tbody>
                {TRAFFIC_VARS.map(([v, d]) => (
                  <tr key={v} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{v}</td>
                    <td className="py-2.5 text-slate-600">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <p className="eyebrow">Preparación</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Limpieza antes de desplegar
          </h3>
          <div className="mt-4 space-y-2">
            {PREP_STEPS.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-sm">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge color="green">Sin datos inventados</Badge>
            <Badge color="slate">Artefactos validados</Badge>
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Trazabilidad</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              De preparación a aplicación
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Los datos preparados alimentan tres salidas de la app: predicción
              de demanda, optimización de ubicaciones y monitorización de
              fiabilidad.
            </p>
          </div>
          <GitBranch className="h-6 w-6 text-slate-400" />
        </div>
      </Card>
    </div>
  );
}
