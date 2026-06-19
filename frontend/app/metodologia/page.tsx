import { Card, Badge } from "@/components/Card";
import { PageHeader, Callout } from "@/components/ui";
import {
  Target,
  Cpu,
  Cloud,
  GitBranch,
  Database,
  Activity,
  ShieldCheck,
  Boxes,
  BookOpen,
} from "lucide-react";

export const metadata = { title: "Documentación" };

const TOC = [
  ["resumen", "Resumen del proyecto"],
  ["crisp", "Metodología CRISP-DM"],
  ["arquitectura", "Arquitectura de la solución"],
  ["despliegue", "Arquitectura de despliegue"],
  ["optimizacion", "Motor de optimización"],
  ["pipeline", "Pipeline UrbanFlow"],
  ["modelo", "Modelo de demanda"],
  ["monitor", "Evaluación y monitorización"],
  ["stack", "Stack y reproducibilidad"],
];

const CRISP: [string, string][] = [
  ["Business Understanding", "Apoyar al ayuntamiento en la localización óptima de equipamientos urbanos para maximizar la cobertura ciudadana con recursos limitados."],
  ["Data Understanding", "Análisis de candidatos (isócronas, coste), equipamientos existentes, población y tráfico horario de Valencia (octubre 2023)."],
  ["Data Preparation", "Limpieza, imputación, parseo de isócronas WKT, cálculo de áreas y déficit, baseline suavizado y features de calendario; corrección del tipo de Zona."],
  ["Modeling", "Optimización con programación lineal entera (PuLP/CBC) + modelo de demanda CatBoost por hora (baseline + residuo log-ratio + shrink + embeddings)."],
  ["Evaluation", "Métricas reales MAE, RMSE, R², sMAPE en validación temporal; análisis de error por hora/zona; verificación de restricciones del optimizador."],
  ["Deployment", "Frontend en Vercel + backend FastAPI en Docker (Hugging Face Spaces), con CI/CD en GitHub Actions."],
  ["Monitoring", "Alertas de MAE por hora/zona, control de fecha de datos, modelo activo y nota de drift."],
];

export default function DocumentacionPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Documentación técnica"
        title="Documentación del proyecto"
        description="Guía completa de UrbanFlow Valencia: metodología CRISP-DM, arquitectura, despliegue, motor de optimización, modelo de demanda y monitorización."
      />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* TOC */}
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contenido</p>
            <nav className="mt-3 space-y-1">
              {TOC.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block rounded-md px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
                  {label}
                </a>
              ))}
            </nav>
          </Card>
        </aside>

        <div className="space-y-10">
          {/* RESUMEN */}
          <Section id="resumen" icon={<Target className="h-5 w-5" />} title="Resumen del proyecto">
            <p>
              UrbanFlow Valencia es una <strong>plataforma de apoyo a la decisión municipal</strong>.
              Responde a una pregunta concreta de un técnico del ayuntamiento:{" "}
              <em>“con un presupuesto limitado, ¿dónde instalo nuevos equipamientos
              para que el máximo de ciudadanos quede cubierto?”</em>
            </p>
            <p className="mt-3">
              El núcleo es un <strong>motor de optimización</strong> (programación lineal
              entera) que selecciona la mejor combinación de ubicaciones. Para medir
              la demanda, se integra un <strong>modelo de aprendizaje automático</strong>{" "}
              que predice la presión de tráfico, validado y monitorizado siguiendo el
              ciclo EDM.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge color="blue">Optimización (protagonista)</Badge>
              <Badge color="green">Machine Learning (demanda)</Badge>
              <Badge color="amber">Datos reales de Valencia</Badge>
            </div>
          </Section>

          {/* CRISP */}
          <Section id="crisp" icon={<Boxes className="h-5 w-5" />} title="Metodología CRISP-DM">
            <p>
              El proyecto sigue las fases de CRISP-DM e integra evaluación,
              despliegue y monitorización para que la solución sea reproducible
              y operable.
            </p>
            <div className="mt-4 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Fase</th>
                    <th className="py-2">Implementación</th>
                  </tr>
                </thead>
                <tbody>
                  {CRISP.map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-semibold text-slate-800">{k}</td>
                      <td className="py-2.5 text-slate-600">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ARQUITECTURA */}
          <Section id="arquitectura" icon={<Cpu className="h-5 w-5" />} title="Arquitectura de la solución">
            <p>
              Tres capas desacopladas: una interfaz web, una API de cálculo y los
              artefactos de datos y modelos.
            </p>
            <Diagram>
{`Usuario (técnico municipal)
        │  navegador
        ▼
Frontend Next.js  ──────────  Vercel
        │  HTTP/JSON (NEXT_PUBLIC_API_URL)
        ▼
Backend FastAPI  ───────────  Hugging Face Spaces (Docker)
        │
        ├─ Optimización PuLP/CBC   → /optimize/*
        ├─ Modelo CatBoost (.cbm)  → /predict
        └─ Artefactos (CSV/GeoJSON)→ /metrics, /map, /candidates`}
            </Diagram>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <MiniCard icon={<Activity className="h-5 w-5" />} title="Frontend" text="Next.js 14, App Router, TypeScript, Tailwind, Leaflet y Recharts. Centraliza las llamadas en lib/api.ts con fallback." />
              <MiniCard icon={<Cpu className="h-5 w-5" />} title="Backend" text="FastAPI + Pydantic. Carga artefactos; no entrena en producción. Resuelve la optimización con PuLP." />
              <MiniCard icon={<Database className="h-5 w-5" />} title="Datos / modelos" text="24 modelos .cbm (Git LFS), CSV/GeoJSON de candidatos, isócronas y métricas." />
            </div>
          </Section>

          {/* DESPLIEGUE */}
          <Section id="despliegue" icon={<Cloud className="h-5 w-5" />} title="Arquitectura de despliegue">
            <p>
              El despliegue separa responsabilidades: <strong>Vercel</strong> sirve el
              frontend, <strong>Hugging Face Spaces</strong> ejecuta el backend en un
              contenedor Docker, y <strong>GitHub Actions</strong> valida la calidad
              en cada cambio.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">1 · Frontend en Vercel</h4>
            <p className="mt-1">
              Conectado al repositorio con <em>root directory</em> <code>frontend/</code>.
              En cada push a <code>production</code>, Vercel construye y publica
              automáticamente. La URL de la API se inyecta como variable de entorno:
            </p>
            <Diagram>{`NEXT_PUBLIC_API_URL = https://cofrian-edm-proyect.hf.space`}</Diagram>

            <h4 className="mt-5 font-semibold text-slate-900">2 · Backend en Hugging Face Spaces (Docker)</h4>
            <p className="mt-1">
              El <code>Dockerfile</code> parte de <code>python:3.11-slim</code>, instala el
              solver <strong>CBC</strong> (para PuLP) y las dependencias, copia el código
              y arranca Uvicorn en el puerto 7860 (requerido por HF):
            </p>
            <Diagram>
{`FROM python:3.11-slim
RUN apt-get install -y coinor-cbc          # solver de optimización
RUN pip install -r requirements.txt        # FastAPI, CatBoost, PuLP...
COPY . .
CMD uvicorn main:app --host 0.0.0.0 --port 7860`}
            </Diagram>
            <p className="mt-2">
              Los 24 modelos <code>.cbm</code> (~160 MB) se versionan con{" "}
              <strong>Git LFS</strong>. El CORS se controla con la variable{" "}
              <code>ALLOW_ORIGINS</code> (lista separada por comas con las URLs de Vercel).
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">3 · CI/CD en GitHub Actions</h4>
            <p className="mt-1">Flujo de ramas y validación automática:</p>
            <Diagram>{`feature/*  →  develop  →  main  →  production`}</Diagram>
            <div className="mt-3 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Workflow</th>
                    <th className="py-2 pr-4">Disparador</th>
                    <th className="py-2">Qué valida</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["backend-ci", "push/PR en backend/", "Ruff, pytest (9 tests), import de la app, CBC + Git LFS"],
                    ["frontend-ci", "push/PR en frontend/", "ESLint, TypeScript, build de Next.js"],
                    ["docker-build", "push en main", "Construcción de la imagen Docker"],
                    ["deploy-hf", "push a production con backend/", "Sincronización del backend al Space de Hugging Face"],
                    ["deploy-check", "push a production", "curl al /health de la API desplegada"],
                  ].map(([w, t, q]) => (
                    <tr key={w} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-mono text-xs text-slate-700">{w}</td>
                      <td className="py-2.5 pr-4 align-top text-slate-500">{t}</td>
                      <td className="py-2.5 text-slate-600">{q}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout tone="brand" title="Quién despliega qué">
              GitHub Actions <strong>valida</strong> el código; el <strong>despliegue real</strong>{" "}
              lo ejecutan Vercel (frontend) y Hugging Face (backend). El workflow{" "}
              <code>deploy-check</code> comprueba que la API responde tras promover a <code>production</code>.
            </Callout>
          </Section>

          {/* OPTIMIZACIÓN */}
          <Section id="optimizacion" icon={<Target className="h-5 w-5" />} title="Motor de optimización">
            <p>
              Es el corazón del proyecto. Se modela como un problema de{" "}
              <strong>programación lineal entera binaria</strong> resuelto con el solver
              CBC a través de PuLP. Cada ubicación candidata tiene una variable
              binaria y la solución respeta la restricción de presupuesto o de
              número de ubicaciones elegida por el usuario.
            </p>
            <Diagram>
{`Modelo cobertura:
max  Σⱼ pⱼ Yⱼ
s.a. Yⱼ − Σᵢ αᵢⱼ Xᵢ ≤ 0
     Σᵢ costeᵢ Xᵢ ≤ presupuesto

Modelo multiobjetivo:
max  λ·cobertura_deporte + (1−λ)·cobertura_salud
s.a. Xᵢ + X'ᵢ ≤ 1

Modo Valenbisi:
max  Σ scoreᵢ·xᵢ, scoreᵢ = tráfico + población + déficit`}
            </Diagram>
            <ul className="mt-3 list-inside list-disc space-y-1 text-slate-600">
              <li><strong>Tráfico:</strong> presión predicha por CatBoost, agregada por zona.</li>
              <li><strong>Población cubierta:</strong> cruce de hexágonos de población con isócronas de candidatos.</li>
              <li><strong>Déficit:</strong> prioriza zonas no cubiertas por equipamientos existentes.</li>
            </ul>
            <p className="mt-3">
              El resultado es el <strong>óptimo global</strong> para los pesos y la
              restricción elegidos, no una aproximación heurística.
            </p>
          </Section>

          <Section id="pipeline" icon={<BookOpen className="h-5 w-5" />} title="Pipeline UrbanFlow">
            <p>
              La plataforma empaqueta la preparación de datos, el modelo de
              demanda y el optimizador en una versión desplegable, estable y
              explicable para el usuario final. La lógica que requiere respuesta
              determinista está en la API; los análisis exploratorios quedan
              fuera del cálculo público.
            </p>
            <div className="mt-4 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Módulo</th>
                    <th className="py-2 pr-4">Qué aporta</th>
                    <th className="py-2">Implementación</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Cobertura urbana", "Restricciones de cobertura, presupuesto y población alcanzada.", "PuLP/CBC en /optimize/sports y /optimize/health."],
                    ["Movilidad Valenbisi", "Score tráfico+población+déficit y comparación de ubicaciones.", "Modo Valenbisi en /optimize/valenbisi y /optimize/coverage."],
                    ["Multiobjetivo", "Comparación entre cobertura deportiva y sanitaria.", "Suma ponderada activa con λ en /optimize/multi."],
                    ["Señales urbanas", "Tráfico, población, costes, isócronas y cobertura existente.", "Datos curados en backend/data/processed."],
                    ["Análisis avanzado", "Heurísticas y áreas dinámicas de influencia para contraste técnico.", "Documentado, no ejecutado en producción por reproducibilidad y coste."],
                    ["Preparación de artefactos", "Conversión de datos crudos a candidatos y matrices de cobertura.", "Pipeline reproducible con scripts de validación."],
                  ].map(([n, a, d]) => (
                    <tr key={n} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-mono text-xs text-slate-700">{n}</td>
                      <td className="py-2.5 pr-4 align-top text-slate-600">{a}</td>
                      <td className="py-2.5 align-top text-slate-600">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* MODELO */}
          <Section id="modelo" icon={<Activity className="h-5 w-5" />} title="Modelo de demanda (CatBoost)">
            <p>
              La presión de tráfico se predice con un modelo híbrido por hora:
              baseline estructural suavizado + residuo aprendido por CatBoost en
              escala log-ratio + shrink sigmoidal + embeddings de zona.
            </p>
            <Diagram>{`Intensidad = baseline(zona,día,hora) + f_CatBoost(meteo, calendario, z_emb)`}</Diagram>
            <p className="mt-3">
              Validación <strong>temporal</strong> (train días 1–24, holdout 25–31 oct 2023).
              Resultados reales en holdout:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric k="MAE" v="≈ 44.4" />
              <Metric k="RMSE" v="≈ 87.8" />
              <Metric k="R²" v="≈ 0.92" />
              <Metric k="sMAPE" v="≈ 16.8 %" />
            </div>
            <Callout tone="amber" title="Honestidad metodológica">
              Las métricas de LightGBM (peores) no se mezclan con las de CatBoost.
              La cobertura usa población hexagonal filtrada a Valencia y se
              interpreta como apoyo a la decisión, no como sustituto de una
              evaluación urbanística completa.
            </Callout>
          </Section>

          {/* MONITOR */}
          <Section id="monitor" icon={<ShieldCheck className="h-5 w-5" />} title="Evaluación y monitorización">
            <p>
              La evaluación garantiza que la señal de demanda es fiable; la
              monitorización vigila su validez en el tiempo. Se generan alertas
              cuando el MAE por hora o zona supera un umbral, y se documentan los
              riesgos de drift (datos de un único mes, horas valle, zonas periféricas).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge color="blue">Validación temporal</Badge>
              <Badge color="green">Alertas de MAE</Badge>
              <Badge color="amber">Notas de drift</Badge>
            </div>
          </Section>

          {/* STACK */}
          <Section id="stack" icon={<GitBranch className="h-5 w-5" />} title="Stack y reproducibilidad">
            <div className="grid gap-4 sm:grid-cols-2">
              <MiniCard icon={<Activity className="h-5 w-5" />} title="Frontend" text="Next.js 14 · TypeScript · TailwindCSS · Recharts · Leaflet" />
              <MiniCard icon={<Cpu className="h-5 w-5" />} title="Backend" text="FastAPI · Pydantic · CatBoost · PuLP/CBC · Pandas · PyArrow" />
              <MiniCard icon={<Cloud className="h-5 w-5" />} title="Infraestructura" text="Vercel · Hugging Face Spaces (Docker) · GitHub Actions" />
              <MiniCard icon={<Database className="h-5 w-5" />} title="Datos / modelos" text="Git LFS (.cbm, .parquet) · scripts de validación de artefactos" />
            </div>
            <p className="mt-4 text-slate-600">
              El pipeline técnico documenta preparación, entrenamiento,
              evaluación y optimización. Los scripts regeneran los artefactos de
              forma reproducible y <code>validate_artifacts.py</code> verifica su integridad.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">{icon}</span>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-slate-600 sm:text-base">{children}</div>
    </section>
  );
}

function Diagram({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto scroll-thin rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
      {children}
    </pre>
  );
}

function MiniCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
      <p className="mt-2 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <p className="text-xs text-slate-500">{k}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{v}</p>
    </div>
  );
}
