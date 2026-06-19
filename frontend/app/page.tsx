import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Database,
  GitBranch,
  Layers,
  Map,
  Route,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge, Card } from "@/components/Card";
import { Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    href: "/optimizacion",
    title: "Optimizador GIS",
    text: "Selecciona equipamientos, presupuesto o N puntos y revisa la solución sobre mapa.",
    icon: <Map className="h-5 w-5" />,
  },
  {
    href: "/datos",
    title: "Datos urbanos",
    text: "Candidatos, isócronas, población, tráfico, meteorología y artefactos curados.",
    icon: <Database className="h-5 w-5" />,
  },
  {
    href: "/prediccion",
    title: "Demanda",
    text: "Consulta la presión de tráfico prevista por zona y hora con fiabilidad asociada.",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    href: "/monitorizacion",
    title: "Monitorización",
    text: "Comprueba alertas de error, fecha de datos, modelo activo y señales de drift.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const CAPABILITIES = [
  "Optimización exacta PuLP/CBC",
  "Cobertura deportiva, sanitaria y multiobjetivo",
  "Modo Valenbisi con pesos editables",
  "Mapa GIS con tráfico, cobertura y estaciones actuales",
  "Modelo CatBoost de demanda horaria",
  "Despliegue desacoplado con frontend y API",
];

export default async function Home() {
  const [meta, metrics] = await Promise.all([
    api.metadata(),
    api.metricsGlobal(),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-300">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Plataforma de decisión urbana</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                UrbanFlow Valencia
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                App para decidir dónde instalar nuevos equipamientos urbanos con
                criterios reproducibles: cobertura de población, isócronas,
                demanda, costes y restricciones de presupuesto.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge color="blue">GIS</Badge>
              <Badge color="green">Optimización</Badge>
              <Badge color="slate">ModelOps</Badge>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/optimizacion" className="btn-primary">
              Abrir optimizador <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/documentacion" className="btn-secondary">
              Ver documentación <BookOpen className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="eyebrow">Estado del sistema</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Modelo y validación
          </h2>
          <dl className="mt-5 space-y-3 text-sm">
            <StatusRow k="Modelo activo" v={meta.model} />
            <StatusRow k="Datos" v={meta.data_date} />
            <StatusRow k="Validación" v={meta.validation} />
            <StatusRow k="API/modelo" v={meta.model_loaded ? "Cargado" : "Fallback disponible"} />
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="R²" value={metrics.R2} />
            <MiniMetric label="MAE" value={metrics.MAE} suffix="veh/h" />
            <MiniMetric label="RMSE" value={metrics.RMSE} />
            <MiniMetric label="sMAPE" value={`${metrics.sMAPE}%`} />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Candidatos" value={128} hint="Ubicaciones evaluables" tone="brand" icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Capas GIS" value="4" hint="Tráfico, cobertura y estaciones" tone="teal" icon={<Layers className="h-4 w-4" />} />
        <Stat label="Modos" value="4" hint="Deporte, salud, multi y movilidad" icon={<Target className="h-4 w-4" />} />
        <Stat label="Registros" value="~853k" hint="Tráfico horario de octubre" icon={<Users className="h-4 w-4" />} />
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Módulos de la app</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              Flujo completo de decisión
            </h2>
          </div>
          <Link href="/documentacion" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-950">
            Ver detalle técnico <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((module) => (
            <Link key={module.href} href={module.href} className="card card-interactive block">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
                {module.icon}
              </span>
              <h3 className="mt-4 font-semibold text-slate-950">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{module.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                Abrir <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <p className="eyebrow">Cómo decide</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Del dato al candidato recomendado
          </h2>
          <div className="mt-5 space-y-3">
            <FlowStep icon={<Database className="h-4 w-4" />} title="1. Datos curados" text="Candidatos, costes, población, isócronas y equipamientos existentes." />
            <FlowStep icon={<BarChart3 className="h-4 w-4" />} title="2. Señal de demanda" text="CatBoost estima presión de tráfico por zona y hora." />
            <FlowStep icon={<Route className="h-4 w-4" />} title="3. Optimización" text="PuLP/CBC maximiza cobertura o score respetando la restricción." />
            <FlowStep icon={<GitBranch className="h-4 w-4" />} title="4. Resultado" text="Mapa GIS, métricas y ranking para interpretar la decisión." />
          </div>
        </Card>

        <Card>
          <p className="eyebrow">Motor de optimización</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Qué resuelve la herramienta
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DecisionCard title="Presupuesto máximo" text="Elige la combinación que más impacto aporta sin superar el coste disponible." formula="Σ costeᵢ·xᵢ ≤ presupuesto" />
            <DecisionCard title="N puntos" text="Selecciona exactamente las mejores ubicaciones cuando el número de actuaciones ya está fijado." formula="Σ xᵢ = N" />
            <DecisionCard title="Cobertura real" text="Mide habitantes en isócronas de candidatos descontando cobertura existente." formula="max Σ pⱼYⱼ" />
            <DecisionCard title="Movilidad" text="Pondera tráfico, población y déficit para priorizar estaciones Valenbisi." formula="max Σ scoreᵢxᵢ" />
          </div>
        </Card>
      </section>
    </div>
  );
}

function StatusRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-slate-500">{k}</dt>
      <dd className="max-w-[12rem] text-right font-semibold text-slate-900">{v}</dd>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">
        {value}
        {suffix && <span className="ml-1 text-xs font-medium text-slate-500">{suffix}</span>}
      </p>
    </div>
  );
}

function FlowStep({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-slate-700 shadow-sm">
        {icon}
      </span>
      <div>
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function DecisionCard({
  title,
  text,
  formula,
}: {
  title: string;
  text: string;
  formula: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      <p className="mt-3 rounded-md bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
        {formula}
      </p>
    </div>
  );
}
