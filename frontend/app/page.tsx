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
    href: "/prediccion",
    title: "Predicción de tráfico",
    text: "24 modelos CatBoost predicen la intensidad de tráfico en 1.158 zonas de Valencia, hora a hora, con datos meteorológicos y movilidad en tiempo real.",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    href: "/optimizacion",
    title: "Optimizador urbano",
    text: "Elige presupuesto y tipo de instalación. El solver ILP (PuLP + CBC) selecciona los candidatos que maximizan la cobertura de población.",
    icon: <Map className="h-5 w-5" />,
  },
  {
    href: "/evaluacion",
    title: "Evaluación del modelo",
    text: "MAE, RMSE, R² y sMAPE por hora y zona. Validación temporal sobre los días 25-31 de octubre 2023, nunca usados en el entrenamiento.",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    href: "/datos",
    title: "Datos urbanos",
    text: "Candidatos, población H3, tráfico histórico, meteorología AEMET y eventos urbanos. Todas las fuentes de Open Data Valencia y Ayuntamiento.",
    icon: <Database className="h-5 w-5" />,
  },
  {
    href: "/monitorizacion",
    title: "Monitorización",
    text: "Alertas de MAE por hora, zonas de baja fiabilidad, estado del modelo en producción y métricas del sistema en tiempo real.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const CAPABILITIES = [
  "24 modelos CatBoost — uno por cada hora del día",
  "1.158 zonas de tráfico de Valencia",
  "Optimización ILP con PuLP/CBC bajo presupuesto",
  "Cobertura deportiva, sanitaria y multiobjetivo",
  "Movilidad en tiempo real: Valenbisi, EMT y ArcGIS",
  "API REST en Hugging Face + frontend en Vercel",
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
              <p className="eyebrow">Herramienta de decisión urbana</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                UrbanFlow Valencia
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Plataforma con dos módulos independientes para operarios del
                Ayuntamiento: predicción horaria de tráfico en las 1.158 zonas
                de Valencia con CatBoost, y optimización de instalaciones
                urbanas bajo presupuesto con programación lineal entera.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge color="blue">GIS</Badge>
              <Badge color="green">Optimización</Badge>
              <Badge color="slate">Modelo</Badge>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/optimizacion" className="btn-primary">
              Abrir optimizador <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/metodologia" className="btn-secondary">
              Ver documentación <BookOpen className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm text-slate-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" />
                {item}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="eyebrow">Estado del sistema</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Modelo y datos
          </h2>
          <dl className="mt-5 space-y-3 text-sm">
            <StatusRow k="Modelo activo" v={meta.model} />
            <StatusRow k="Datos" v={meta.data_date} />
            <StatusRow k="Validación" v={meta.validation} />
            <StatusRow k="API/modelo" v={meta.model_loaded ? "Cargado" : "Alternativa disponible"} />
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="R²" value={metrics.R2} />
            <MiniMetric label="MAE" value={metrics.MAE} suffix="veh/h" />
            <MiniMetric label="RMSE" value={metrics.RMSE} />
            <MiniMetric label="sMAPE" value={`${metrics.sMAPE}%`} />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Candidatos" value={128} hint="Ubicaciones que se pueden elegir" tone="brand" icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Capas GIS" value="4" hint="Tráfico, cobertura y estaciones" tone="teal" icon={<Layers className="h-4 w-4" />} />
        <Stat label="Modos" value="4" hint="Deporte, salud, varios objetivos y movilidad" icon={<Target className="h-4 w-4" />} />
        <Stat label="Registros" value="~853k" hint="Tráfico horario de octubre" icon={<Users className="h-4 w-4" />} />
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Módulos de la app</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              Qué puedes hacer
            </h2>
          </div>
          <Link href="/metodologia" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-950">
            Ver metodología <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {MODULES.map((module) => (
            <Link key={module.href} href={module.href} className="card card-interactive block">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700">
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

      <section className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <p className="eyebrow">Dos módulos, una herramienta</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Planificación y optimización urbana
          </h2>
          <div className="mt-5 space-y-3">
            <FlowStep icon={<Database className="h-4 w-4" />} title="1. Datos de Valencia" text="Tráfico histórico oct. 2023, hexágonos H3 con censo, candidatos a instalaciones, meteorología AEMET y movilidad en tiempo real." />
            <FlowStep icon={<BarChart3 className="h-4 w-4" />} title="2. Módulo A — Predicción de tráfico" text="24 modelos CatBoost (uno por hora) predicen la intensidad de tráfico en 1.158 zonas. El operario consulta el heatmap por hora, zona y condición meteorológica." />
            <FlowStep icon={<Route className="h-4 w-4" />} title="3. Módulo B — Optimización de instalaciones" text="PuLP + CBC selecciona los candidatos de polideportivos, salud o Valenbisi que maximizan la cobertura de población bajo el presupuesto disponible." />
            <FlowStep icon={<GitBranch className="h-4 w-4" />} title="4. Decisión informada" text="Ambos módulos exponen sus resultados en mapa, tablas y alertas para que el técnico municipal tenga toda la información antes de actuar." />
          </div>
        </Card>

        <Card>
          <p className="eyebrow">Optimización ILP — PuLP + CBC</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            5 modos de optimización
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DecisionCard title="Polideportivos" text="Maximiza población cubierta por nuevos polideportivos sin superar el presupuesto. Variables binarias Xᵢ sobre candidatos reales." formula="/optimize/sports" />
            <DecisionCard title="Centros de salud" text="Igual que deportes pero sobre la red sanitaria actual. Detecta zonas sin centro de salud cercano y las prioriza." formula="/optimize/health" />
            <DecisionCard title="Multiobjetivo" text="Equilibra cobertura deportiva y sanitaria simultáneamente con un peso λ. Restricción: no se puede colocar ambos en el mismo punto." formula="/optimize/multi  λ ∈ [0,1]" />
            <DecisionCard title="Valenbisi" text="Selecciona N nuevas estaciones combinando tráfico predicho, densidad de población y déficit de servicio actual de Valenbisi." formula="/optimize/valenbisi" />
          </div>
          <p className="mt-3 text-xs text-slate-500">La cobertura se calcula sobre hexágonos H3 con datos censales reales. El solver CBC resuelve el problema ILP en 5-30 segundos.</p>
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
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold leading-none tracking-[-0.04em] text-slate-950">
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
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-700 shadow-sm">
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
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      <p className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100">
        {formula}
      </p>
    </div>
  );
}
