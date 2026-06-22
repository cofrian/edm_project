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
  ["Candidatos", "128 ubicaciones posibles con coordenadas, coste y área de alcance."],
  ["Cobertura actual", "Equipamientos existentes y zonas a las que ya dan servicio."],
  ["Población", "Zonas de población para calcular cuántas personas quedarían cubiertas."],
  ["Capas del mapa", "Tráfico, estaciones Valenbisi y cobertura existente en formato GeoJSON."],
];

const CONCEPTS = [
  {
    title: "Isócrona",
    text: "Zona a la que se puede llegar andando desde un punto en un tiempo concreto.",
    icon: <Route className="h-4 w-4" />,
  },
  {
    title: "Cobertura",
    text: "Personas que tienen un equipamiento suficientemente cerca.",
    icon: <Users className="h-4 w-4" />,
  },
  {
    title: "Déficit",
    text: "Población que no tiene buena cobertura y debería tener más prioridad.",
    icon: <Radar className="h-4 w-4" />,
  },
];

const TRAFFIC_VARS = [
  ["Zona", "Identificador de cada zona o sensor de tráfico (~1.158 zonas)"],
  ["Intensidad", "Vehículos por hora que el modelo intenta predecir"],
  ["Velocidad / Ocupación", "Estado del tráfico por zona"],
  ["Meteorología", "Temperatura, humedad, presión, viento, precipitación y radiación"],
  ["Calendario", "Año, mes, día, hora y día de la semana"],
];

const PREP_STEPS = [
  "Relleno de datos que faltan usando horas parecidas de la misma zona.",
  "Unificación del campo de zona para cruzar bien los datos.",
  "Cálculo de un patrón base por zona, día y hora.",
  "Lectura de isócronas, cálculo de áreas y detección de solapes.",
  "Preparación de calendario y meteorología para el modelo CatBoost.",
  "Validación temporal: entrenamiento con los días 1-24 y prueba con los días 25-31 de octubre.",
];

export default function DatosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Datos urbanos"
        title="Datos que usa la app"
        description="La app separa los datos de ubicaciones, demanda y monitorización para que cada resultado se pueda entender y comprobar."
      />

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Candidatos" value={128} tone="brand" icon={<MapPinned className="h-4 w-4" />} />
        <Stat label="Equipamientos" value="40+" tone="teal" icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Zonas tráfico" value="~1.158" icon={<Car className="h-4 w-4" />} />
        <Stat label="Registros" value="~853k" hint="Octubre 2023" icon={<Database className="h-4 w-4" />} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <p className="eyebrow">Datos de ubicaciones</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Qué datos usa el optimizador
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cada ubicación se compara por coste, población que puede cubrir y
            cobertura que ya existe cerca. Así se pueden comparar opciones de
            forma justa.
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
            Cómo entender la cobertura
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
            La cobertura se calcula cruzando zonas de población con áreas de
            alcance. Así la app distingue entre población ya cubierta y
            población que podría quedar cubierta con una nueva ubicación.
          </div>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <p className="eyebrow">Demanda</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Variables de tráfico y contexto
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El tráfico sirve como señal de actividad urbana. El modelo CatBoost
            estima el tráfico por zona y hora usando calendario, meteorología y
            estado del tráfico.
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
            Limpieza antes de usar los datos
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
            <Badge color="slate">Archivos validados</Badge>
          </div>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Trazabilidad</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">
              De los datos a la app
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Los datos preparados se usan en tres partes de la app: predicción
              de demanda, elección de ubicaciones y revisión de fiabilidad.
            </p>
          </div>
          <GitBranch className="h-6 w-6 text-slate-400" />
        </div>
      </Card>
    </div>
  );
}
