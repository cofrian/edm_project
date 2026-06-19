import Link from "next/link";
import {
  ArrowRight,
  MapPinned,
  Target,
  Coins,
  Users,
  Activity,
  GitBranch,
  Building2,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Steps } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [meta, metrics] = await Promise.all([
    api.metadata(),
    api.metricsGlobal(),
  ]);

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-brand-700/20 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-8 text-white shadow-card sm:p-12">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <Building2 className="h-3.5 w-3.5" /> Consola municipal · Valencia
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">
            Planifica la ciudad con mapas, datos y optimización
          </h1>
          <p className="mt-4 max-w-2xl text-base text-brand-50 sm:text-lg">
            UrbanFlow integra la red urbana real — Valenbisi, polideportivos,
            centros de salud y tráfico — con modelos de cobertura para proponer
            dónde invertir el próximo euro municipal con máximo impacto.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/mapa" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50">
              Explorar mapa urbano <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/optimizacion" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Abrir optimizador <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-50">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Optimización con PuLP (CBC)</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Demanda con CatBoost (R² {metrics.R2})</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Datos reales de Valencia</span>
          </div>
        </div>
      </section>

      {/* PROBLEMA → DECISIÓN */}
      <section>
        <div className="mb-5">
          <p className="eyebrow">El problema de decisión</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Recursos limitados, ciudad extensa
          </h2>
          <p className="mt-2 max-w-3xl text-slate-600">
            Un técnico municipal dispone de un presupuesto y una lista de
            ubicaciones candidatas. Elegir “a ojo” deja zonas sin cubrir y
            duplica servicio donde ya existe. UrbanFlow lo plantea como un
            problema de optimización matemática y propone la mejor combinación.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureTile icon={<MapPinned className="h-5 w-5" />} title="Ubicaciones candidatas" text="Cada candidato tiene una isócrona (área alcanzable a pie) y un coste de implantación." />
          <FeatureTile icon={<Users className="h-5 w-5" />} title="Demanda ciudadana" text="Población alcanzable y presión de tráfico como señal de actividad urbana." />
          <FeatureTile icon={<Layers className="h-5 w-5" />} title="Déficit de cobertura" text="Se penaliza solapar con equipamientos ya existentes; prioriza zonas sin servicio." />
          <FeatureTile icon={<Coins className="h-5 w-5" />} title="Restricción de presupuesto" text="La solución nunca supera el coste disponible o el número de plazas fijado." />
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section>
        <div className="mb-5">
          <p className="eyebrow">Flujo de la plataforma</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">De los datos a la decisión</h2>
        </div>
        <Steps
          steps={[
            { title: "Explorar", description: "Mapa con capas de Valenbisi, equipamientos, salud y red viaria de Valencia.", icon: <MapPinned className="h-5 w-5" /> },
            { title: "Simular", description: "Define presupuesto o número de plazas y genera una propuesta optimizada.", icon: <Target className="h-5 w-5" /> },
            { title: "Validar demanda", description: "CatBoost estima presión de tráfico como señal complementaria de actividad.", icon: <Activity className="h-5 w-5" /> },
            { title: "Decidir", description: "Ranking, métricas de cobertura y mapa listos para revisión del técnico municipal.", icon: <GitBranch className="h-5 w-5" /> },
          ]}
        />
      </section>

      {/* MODOS + MODELO */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="eyebrow">Dos formas de decidir</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Modos de optimización</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <Target className="h-6 w-6 text-brand-600" />
              <p className="mt-2 font-semibold text-slate-900">Nº fijo de ubicaciones</p>
              <p className="mt-1 text-sm text-slate-600">
                “Tengo presupuesto para N equipamientos: ¿cuáles dan más cobertura?”
              </p>
              <p className="mt-2 text-xs font-medium text-slate-400">Restricción: Σ xᵢ = N</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <Coins className="h-6 w-6 text-teal-600" />
              <p className="mt-2 font-semibold text-slate-900">Presupuesto máximo</p>
              <p className="mt-1 text-sm text-slate-600">
                “Tengo X € disponibles: ¿qué combinación maximiza el impacto?”
              </p>
              <p className="mt-2 text-xs font-medium text-slate-400">Restricción: Σ costeᵢ·xᵢ ≤ presupuesto</p>
            </div>
          </div>
          <Link href="/optimizacion" className="btn-primary mt-5">
            Ejecutar un escenario <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <p className="eyebrow">Modelo de demanda</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">CatBoost de tráfico</h3>
          <p className="mt-1 text-sm text-slate-500">
            Valida la calidad de la señal que alimenta al optimizador.
          </p>
          <dl className="mt-4 space-y-2.5 text-sm">
            <Row k="R² (holdout)" v={String(metrics.R2)} />
            <Row k="MAE" v={`${metrics.MAE} veh/h`} />
            <Row k="sMAPE" v={`${metrics.sMAPE} %`} />
            <Row k="Modelo" v={meta.model} />
            <Row k="Estado" v={meta.model_loaded ? "cargado" : "modo demo"} />
          </dl>
          <Link href="/evaluacion" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:gap-2.5">
            Ver evaluación completa <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </section>
    </div>
  );
}

function FeatureTile({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="card card-interactive">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-900">{v}</dd>
    </div>
  );
}
