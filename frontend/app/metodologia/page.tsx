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
  ["uso", "Guía rápida de uso"],
  ["crisp", "Metodología CRISP-DM"],
  ["arquitectura", "Cómo está montada la app"],
  ["despliegue", "Despliegue"],
  ["optimizacion", "Optimizador"],
  ["pipeline", "Flujo de trabajo"],
  ["modelo", "Modelo de demanda"],
  ["monitor", "Evaluación y monitorización"],
  ["stack", "Tecnología y reproducibilidad"],
];

const CRISP: [string, string][] = [
  ["Entender el problema", "Ayudar a decidir dónde instalar equipamientos urbanos para cubrir a más población con recursos limitados."],
  ["Entender los datos", "Revisión de ubicaciones posibles, equipamientos existentes, población y tráfico horario de Valencia en octubre de 2023."],
  ["Preparar los datos", "Limpieza de datos, relleno de huecos, cálculo de áreas de alcance, déficit de cobertura y variables de calendario."],
  ["Modelar", "Optimizador con PuLP/CBC y modelo CatBoost para estimar la demanda por hora."],
  ["Evaluar", "Métricas MAE, RMSE, R² y sMAPE, revisión de errores por hora y zona, y comprobación de restricciones."],
  ["Desplegar", "Frontend en Vercel y backend FastAPI en Docker, publicado en Hugging Face Spaces."],
  ["Monitorizar", "Alertas por errores altos, fecha de datos, modelo activo y posibles pérdidas de precisión con el tiempo."],
];

export default function DocumentacionPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Metodología"
        title="Documentación del proyecto"
        description="Explicación clara de cómo funciona UrbanFlow Valencia: datos, optimización, predicción, despliegue y seguimiento del modelo."
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
              UrbanFlow Valencia es una <strong>herramienta para apoyar decisiones urbanas</strong>.
              Responde a una pregunta concreta:{" "}
              <em>“si tengo un presupuesto limitado, ¿dónde debería instalar nuevos equipamientos
              para llegar a más ciudadanos?”</em>
            </p>
            <p className="mt-3">
              El núcleo es un <strong>optimizador</strong> que elige la mejor combinación
              de ubicaciones según el escenario. Para medir la demanda, la app usa
              un <strong>modelo de aprendizaje automático</strong> que estima la presión
              de tráfico y permite revisar su fiabilidad.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge color="blue">Optimización</Badge>
              <Badge color="green">Predicción de demanda</Badge>
              <Badge color="amber">Datos reales de Valencia</Badge>
            </div>
          </Section>

          <Section id="uso" icon={<BookOpen className="h-5 w-5" />} title="Guía rápida de uso">
            <p>
              La interfaz está pensada para trabajar en tres pasos: primero se
              revisa la ciudad, después se configura el escenario y por último
              se interpreta el resultado con mapa, métricas y ranking.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <MiniCard
                icon={<Database className="h-5 w-5" />}
                title="1. Revisar la ciudad"
                text="Usa el mapa para ver estaciones actuales, ubicaciones posibles, demanda, tráfico y cobertura."
              />
              <MiniCard
                icon={<Target className="h-5 w-5" />}
                title="2. Definir el escenario"
                text="Elige servicio, presupuesto, número de puntos o pesos de movilidad según lo que quieras decidir."
              />
              <MiniCard
                icon={<ShieldCheck className="h-5 w-5" />}
                title="3. Revisar la propuesta"
                text="Comprueba resultado, coste, población cubierta y zonas recomendadas antes de aceptar la propuesta."
              />
            </div>
            <Callout tone="brand" title="Idea de la interfaz">
              La app no muestra todos los detalles internos. Resume lo necesario
              para que una persona pueda usar la herramienta y entender por qué
              aparece una recomendación.
            </Callout>
          </Section>

          {/* CRISP */}
          <Section id="crisp" icon={<Boxes className="h-5 w-5" />} title="Metodología CRISP-DM">
            <p>
              El proyecto sigue CRISP-DM: entender el problema, preparar los
              datos, modelar, evaluar y dejar la solución lista para usarse.
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
          <Section id="arquitectura" icon={<Cpu className="h-5 w-5" />} title="Cómo está montada la app">
            <p>
              La app se divide en tres partes: la interfaz web, la API que hace
              los cálculos y los archivos de datos y modelos.
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
              <MiniCard icon={<Activity className="h-5 w-5" />} title="Frontend" text="Next.js, TypeScript, Tailwind, Leaflet y Recharts. Aquí está la interfaz que usa el usuario." />
              <MiniCard icon={<Cpu className="h-5 w-5" />} title="Backend" text="FastAPI. Carga datos y modelos ya preparados, y resuelve la optimización con PuLP." />
              <MiniCard icon={<Database className="h-5 w-5" />} title="Datos y modelos" text="Modelos CatBoost, CSV y GeoJSON con candidatos, áreas de alcance y métricas." />
            </div>
          </Section>

          {/* DESPLIEGUE */}
          <Section id="despliegue" icon={<Cloud className="h-5 w-5" />} title="Despliegue">
            <p>
              Cada parte se despliega donde encaja mejor: <strong>Vercel</strong> sirve
              la interfaz, <strong>Hugging Face Spaces</strong> ejecuta la API en Docker
              y <strong>GitHub Actions</strong> revisa que el código siga funcionando.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">1 · Frontend en Vercel</h4>
            <p className="mt-1">
              Vercel está conectado al repositorio y usa la carpeta <code>frontend/</code>.
              Cuando se actualiza la rama <code>production</code>, construye y publica
              la web. La URL de la API se configura con esta variable:
            </p>
            <Diagram>{`NEXT_PUBLIC_API_URL = https://cofrian-edm-proyect.hf.space`}</Diagram>

            <h4 className="mt-5 font-semibold text-slate-900">2 · Backend en Hugging Face Spaces (Docker)</h4>
            <p className="mt-1">
              El <code>Dockerfile</code> prepara Python, instala CBC para la optimización,
              instala las dependencias y arranca la API con Uvicorn en el puerto que
              usa Hugging Face Spaces:
            </p>
            <Diagram>
{`FROM python:3.11-slim
RUN apt-get install -y coinor-cbc          # optimizador
RUN pip install -r requirements.txt        # FastAPI, CatBoost, PuLP...
COPY . .
CMD uvicorn main:app --host 0.0.0.0 --port 7860`}
            </Diagram>
            <p className="mt-2">
              Los modelos <code>.cbm</code> se guardan con <strong>Git LFS</strong>.
              El acceso desde la web se controla con <code>ALLOW_ORIGINS</code>, donde
              se indican las URLs permitidas de Vercel.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">3 · CI/CD en GitHub Actions</h4>
            <p className="mt-1">Flujo de ramas y revisiones automáticas:</p>
            <Diagram>{`feature/*  →  develop  →  main  →  production`}</Diagram>
            <div className="mt-3 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Proceso</th>
                    <th className="py-2 pr-4">Cuándo se ejecuta</th>
                    <th className="py-2">Qué revisa</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["backend-ci", "push/PR en backend/", "Calidad del backend, tests, carga de la app, CBC y Git LFS"],
                    ["frontend-ci", "push/PR en frontend/", "ESLint, TypeScript y build de Next.js"],
                    ["docker-build", "push en main", "Construcción de la imagen Docker"],
                    ["deploy-hf", "push a production con backend/", "Publicación del backend en Hugging Face Spaces"],
                    ["deploy-check", "push a production", "Comprobación de que la API desplegada responde"],
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
            <Callout tone="brand" title="Quién publica cada parte">
              GitHub Actions <strong>revisa</strong> el código. Vercel publica el frontend
              y Hugging Face publica el backend. El proceso <code>deploy-check</code>
              comprueba que la API responde después del despliegue.
            </Callout>
          </Section>

          {/* OPTIMIZACIÓN */}
          <Section id="optimizacion" icon={<Target className="h-5 w-5" />} title="Optimizador">
            <p>
              Es la parte central del proyecto. El optimizador compara ubicaciones
              posibles y elige la mejor combinación respetando el presupuesto o el
              número de ubicaciones que indique el usuario.
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
              <li><strong>Tráfico:</strong> demanda estimada por el modelo en cada zona.</li>
              <li><strong>Población cubierta:</strong> personas que quedarían cerca de una nueva ubicación.</li>
              <li><strong>Déficit:</strong> zonas que ahora no tienen suficiente cobertura.</li>
            </ul>
            <p className="mt-3">
              El resultado busca la mejor solución para los pesos y restricciones
              elegidos, no solo una opción razonable.
            </p>
          </Section>

          <Section id="pipeline" icon={<BookOpen className="h-5 w-5" />} title="Flujo de trabajo UrbanFlow">
            <p>
              UrbanFlow une preparación de datos, predicción de demanda y
              optimización en una app que se puede usar y explicar. La API contiene
              los cálculos que deben ser estables; los análisis exploratorios quedan
              fuera de la parte pública.
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
                    ["Cobertura urbana", "Tiene en cuenta cobertura, presupuesto y población alcanzada.", "PuLP/CBC en /optimize/sports y /optimize/health."],
                    ["Movilidad Valenbisi", "Combina tráfico, población y falta de servicio para comparar ubicaciones.", "Modo Valenbisi en /optimize/valenbisi y /optimize/coverage."],
                    ["Varios objetivos", "Permite equilibrar cobertura deportiva y sanitaria.", "Suma ponderada con λ en /optimize/multi."],
                    ["Señales urbanas", "Usa tráfico, población, costes, áreas de alcance y cobertura existente.", "Datos preparados en backend/data/processed."],
                    ["Análisis avanzado", "Sirve para contrastar decisiones, pero no se ejecuta en producción.", "Documentado fuera del cálculo público por coste y reproducibilidad."],
                    ["Preparación de archivos", "Convierte datos originales en candidatos y matrices de cobertura.", "Flujo reproducible con scripts de validación."],
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
              La demanda se estima con un modelo CatBoost. Para cada hora, el
              modelo combina patrones habituales de tráfico con calendario,
              meteorología y zona.
            </p>
            <Diagram>{`Intensidad = patrón_base(zona,día,hora) + CatBoost(meteo, calendario, zona)`}</Diagram>
            <p className="mt-3">
              La validación es <strong>temporal</strong>: se entrena con los días 1-24
              de octubre de 2023 y se prueba con los días 25-31. Resultados:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric k="MAE" v="≈ 44.4" />
              <Metric k="RMSE" v="≈ 87.8" />
              <Metric k="R²" v="≈ 0.92" />
              <Metric k="sMAPE" v="≈ 16.8 %" />
            </div>
            <Callout tone="amber" title="Cómo interpretar estos resultados">
              Las métricas corresponden al modelo CatBoost. La cobertura sirve
              como apoyo a la decisión, pero no sustituye una revisión urbanística
              completa antes de actuar en la ciudad.
            </Callout>
          </Section>

          {/* MONITOR */}
          <Section id="monitor" icon={<ShieldCheck className="h-5 w-5" />} title="Evaluación y monitorización">
            <p>
              La evaluación comprueba si la predicción funciona bien. La
              monitorización revisa si sigue siendo fiable con el tiempo. La app
              genera avisos cuando el error por hora o zona es alto.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge color="blue">Validación temporal</Badge>
              <Badge color="green">Alertas de MAE</Badge>
              <Badge color="amber">Pérdida de precisión</Badge>
            </div>
          </Section>

          {/* STACK */}
          <Section id="stack" icon={<GitBranch className="h-5 w-5" />} title="Tecnología y reproducibilidad">
            <div className="grid gap-4 sm:grid-cols-2">
              <MiniCard icon={<Activity className="h-5 w-5" />} title="Frontend" text="Next.js 14 · TypeScript · TailwindCSS · Recharts · Leaflet" />
              <MiniCard icon={<Cpu className="h-5 w-5" />} title="Backend" text="FastAPI · Pydantic · CatBoost · PuLP/CBC · Pandas · PyArrow" />
              <MiniCard icon={<Cloud className="h-5 w-5" />} title="Infraestructura" text="Vercel · Hugging Face Spaces (Docker) · GitHub Actions" />
              <MiniCard icon={<Database className="h-5 w-5" />} title="Datos y modelos" text="Git LFS (.cbm, .parquet) y scripts para validar archivos" />
            </div>
            <p className="mt-4 text-slate-600">
              El flujo técnico documenta preparación, entrenamiento, evaluación
              y optimización. Los scripts permiten regenerar los archivos y
              <code>validate_artifacts.py</code> comprueba que estén bien.
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
    <pre className="mt-3 overflow-x-auto scroll-thin rounded-2xl bg-slate-950 p-5 text-xs leading-relaxed text-slate-100 shadow-card">
      {children}
    </pre>
  );
}

function MiniCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700">{icon}</span>
      <p className="mt-2 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-card">
      <p className="text-xs text-slate-500">{k}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{v}</p>
    </div>
  );
}
