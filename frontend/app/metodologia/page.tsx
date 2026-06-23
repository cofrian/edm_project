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
  ["optimizacion", "Optimización ILP"],
  ["pipeline", "Flujo completo de datos"],
  ["modelo", "Modelo de predicción de tráfico"],
  ["monitor", "Evaluación y monitorización"],
  ["stack", "Tecnología y reproducibilidad"],
];

const CRISP: [string, string][] = [
  ["Entender el problema", "Ayudar a planificadores urbanos a decidir dónde instalar nuevos equipamientos en Valencia maximizando la cobertura de población bajo un presupuesto real. La presión de tráfico por zona actúa como señal de demanda."],
  ["Entender los datos", "Datos de tráfico del Ayuntamiento de Valencia: ~853.000 registros horarios de octubre 2023 en más de 1.158 zonas. También: hexágonos H3 con censo, candidatos a instalaciones, estaciones Valenbisi, paradas EMT y datos meteorológicos AEMET."],
  ["Preparar los datos", "Limpieza y alineación temporal de los registros de tráfico. Construcción del baseline histórico por zona, día y hora. Generación de embeddings de zona (5 dimensiones). Cálculo de features cíclicas (hora_sin/cos) y retardos meteorológicos. Cálculo de matrices de cobertura H3."],
  ["Modelar", "24 modelos CatBoost independientes, uno por hora del día (hora 0 a hora 23). Cada modelo aprende el residuo respecto al baseline histórico en escala log-ratio. Un peso sigmoid (shrink weight) regresa la predicción al baseline cuando hay poca evidencia. Solver ILP PuLP/CBC para optimización de instalaciones."],
  ["Evaluar", "Validación temporal estricta: entrenamiento con días 1-24 de octubre 2023, prueba con días 25-31 (nunca vistos). Métricas globales: MAE ≈ 44,4 veh/h · RMSE ≈ 87,8 · R² ≈ 0,92 · sMAPE ≈ 16,8 %. Análisis por hora del día y por zona para detectar errores sistemáticos."],
  ["Desplegar", "Backend FastAPI dockerizado en Hugging Face Spaces. Frontend Next.js 14 en Vercel. CI/CD con GitHub Actions: lint, tests, build y publicación automática al hacer push a la rama production."],
  ["Monitorizar", "Alertas automáticas cuando el MAE de una hora supera el umbral (80 veh/h). Identificación de zonas con error sistemático. Exposición de métricas del sistema (CPU, memoria, uptime). Integración de datos en tiempo real con cache TTL para Valenbisi, EMT y tráfico ArcGIS."],
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
              UrbanFlow Valencia es una <strong>plataforma de predicción de tráfico y optimización urbana</strong> para la ciudad de Valencia. Responde dos preguntas que un planificador urbano necesita:
            </p>
            <p className="mt-3">
              <strong>¿Cuánto tráfico habrá en cada zona a una hora concreta?</strong> Un conjunto de <strong>24 modelos CatBoost</strong> (uno por hora del día) predicen la intensidad de tráfico en las 1.158 zonas de medición de Valencia. Cada modelo combina el patrón histórico de la zona con variables meteorológicas en tiempo real, codificación cíclica de la hora y embeddings de zona aprendidos durante el entrenamiento.
            </p>
            <p className="mt-3">
              <strong>¿Dónde instalar nuevas infraestructuras con el presupuesto disponible?</strong> Un <strong>optimizador ILP</strong> (PuLP + solver CBC) usa la señal de tráfico predicha junto con datos censales reales para seleccionar las ubicaciones de polideportivos, centros de salud o estaciones Valenbisi que maximizan la cobertura de población.
            </p>
            <p className="mt-3">
              Los datos de tráfico proceden del Ayuntamiento de Valencia: aproximadamente <strong>853.000 registros horarios</strong> de octubre de 2023. El modelo se valida de forma temporal — se entrena con los días 1-24 y se evalúa sobre los días 25-31, que no participan en ninguna fase de ajuste.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge color="blue">24 modelos CatBoost por hora</Badge>
              <Badge color="green">Optimización ILP PuLP + CBC</Badge>
              <Badge color="amber">853 k registros de tráfico de Valencia</Badge>
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
          <Section id="optimizacion" icon={<Target className="h-5 w-5" />} title="Optimización urbana (ILP — PuLP + CBC)">
            <p>
              El optimizador resuelve un <strong>problema de programación lineal entera (ILP)</strong> usando la librería PuLP con el solver de código abierto CBC (COIN-OR Branch-and-Cut). Dado un conjunto de candidatos reales de Valencia, selecciona la combinación que maximiza la cobertura de población bajo las restricciones definidas por el usuario.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">Formulación general del problema de cobertura</h4>
            <Diagram>
{`Variables:
  Xᵢ ∈ {0,1}  →  se construye el candidato i o no
  Yⱼ ∈ {0,1}  →  el hexágono H3 de población j queda cubierto

Objetivo:
  max  Σⱼ población_j × Yⱼ       (maximizar habitantes cubiertos)

Restricciones:
  Yⱼ ≤ Σᵢ αᵢⱼ × Xᵢ   ∀j         (cobertura según candidatos elegidos)
  Σᵢ coste_i × Xᵢ ≤ presupuesto  (restricción económica)
  Xᵢ, Yⱼ ∈ {0,1}                 (variables binarias)

αᵢⱼ = 1 si el candidato i cubre el hexágono j (radio de alcance)`}
            </Diagram>

            <h4 className="mt-5 font-semibold text-slate-900">Los 5 modos de optimización disponibles</h4>
            <div className="mt-2 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Modo</th>
                    <th className="py-2 pr-4">Objetivo</th>
                    <th className="py-2 pr-4">Restricción extra</th>
                    <th className="py-2">Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Polideportivos", "Máx. población con cobertura deportiva nueva", "Σ coste ≤ presupuesto", "/optimize/sports"],
                    ["Centros de salud", "Máx. población con cobertura sanitaria nueva", "Σ coste ≤ presupuesto", "/optimize/health"],
                    ["Multiobjetivo", "λ × cobertura_deportiva + (1−λ) × cobertura_sanitaria", "Xᵢ + X′ᵢ ≤ 1 (no solapamiento)", "/optimize/multi"],
                    ["Valenbisi", "Máx. score = tráfico + población + déficit_servicio", "Σ xᵢ = N (número fijo)", "/optimize/valenbisi"],
                    ["Cobertura general", "Máx. población cubierta por cualquier equipamiento", "Σ coste ≤ presupuesto", "/optimize/coverage"],
                  ].map(([modo, obj, rest, ep]) => (
                    <tr key={modo} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-semibold text-slate-800">{modo}</td>
                      <td className="py-2.5 pr-4 align-top text-slate-600">{obj}</td>
                      <td className="py-2.5 pr-4 align-top text-slate-500">{rest}</td>
                      <td className="py-2.5 align-top font-mono text-xs text-slate-700">{ep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mt-5 font-semibold text-slate-900">Cobertura sobre hexágonos H3</h4>
            <p className="mt-1">
              La ciudad de Valencia se divide en <strong>hexágonos H3</strong> con datos censales reales. Para cada candidato se precalcula qué hexágonos cubre en función de su radio de alcance, generando la <strong>matriz de cobertura α</strong> (candidato × hexágono). El optimizador usa esta matriz para determinar cuánta población nueva quedaría cubierta al seleccionar cada combinación de candidatos.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">Modo Valenbisi: score compuesto</h4>
            <Diagram>
{`score_i = w_tráfico  × tráfico_normalizado_i
         + w_población × población_normalizada_i
         + w_déficit   × déficit_servicio_i

Donde déficit_i mide la falta de estaciones Valenbisi
en el entorno de la ubicación candidata i.
Los pesos son configurables por el usuario en la interfaz.`}
            </Diagram>

            <Callout tone="brand" title="Garantía de optimalidad">
              A diferencia de una heurística, el solver CBC encuentra la <strong>solución óptima global</strong> para los parámetros indicados, no solo una buena aproximación. El tiempo de resolución típico es de 5 a 30 segundos para los conjuntos de candidatos de Valencia.
            </Callout>
          </Section>

          <Section id="pipeline" icon={<BookOpen className="h-5 w-5" />} title="Flujo completo de datos">
            <p>
              UrbanFlow encadena cuatro etapas: ingesta de datos reales de Valencia, predicción horaria de tráfico con CatBoost, optimización ILP de instalaciones y exposición de resultados vía API REST. Cada etapa está desacoplada y es reproducible de forma independiente.
            </p>
            <div className="mt-4 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Etapa</th>
                    <th className="py-2 pr-4">Qué hace</th>
                    <th className="py-2">Implementación</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Datos de tráfico", "853k registros horarios del Ayuntamiento de Valencia, octubre 2023. Limpieza, alineación temporal y construcción del baseline por zona/día/hora.", "backend/data/processed · baseline_oct2023_SMOO.csv"],
                    ["Predicción CatBoost", "24 modelos entrenados (uno por hora). Features: hora_sin/cos, embeddings de zona, variables meteo y retardos. Shrink weight sigmoid para gestionar incertidumbre.", "src/pipeline.py · models/catboost_hour_HH.cbm · /predict/heatmap"],
                    ["Matriz de cobertura H3", "Para cada candidato se precalcula qué hexágonos H3 de población cubre según su radio. Genera la matriz α usada por el solver.", "data/processed/coverage_alpha.json · population_hexes.csv"],
                    ["Optimización ILP", "PuLP formula el problema de cobertura máxima bajo presupuesto. CBC (Branch-and-Cut) resuelve en 5-30 s. 5 modos disponibles.", "src/optimize_facility.py · src/optimize_valenbisi.py · /optimize/*"],
                    ["Movilidad tiempo real", "Valenbisi, EMT y tráfico ArcGIS con cache TTL. AEMET con fallback a Open-Meteo. Alertas automáticas de estación vacía, retraso de bus y MAE alto.", "src/integrations/ · src/ttl_cache.py · /api/mobility/*"],
                    ["API REST + Frontend", "FastAPI expone 50+ endpoints JSON. Next.js renderiza mapas Leaflet, gráficos Recharts y el panel de alertas sin contener lógica de negocio.", "main.py · frontend/lib/api.ts"],
                  ].map(([n, a, d]) => (
                    <tr key={n} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-semibold text-slate-800">{n}</td>
                      <td className="py-2.5 pr-4 align-top text-slate-600">{a}</td>
                      <td className="py-2.5 align-top font-mono text-xs text-slate-500">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* MODELO */}
          <Section id="modelo" icon={<Activity className="h-5 w-5" />} title="Modelo de predicción de tráfico (CatBoost)">
            <p>
              El sistema entrena <strong>24 modelos CatBoost independientes</strong>, uno por cada hora del día (hora 0 a hora 23), sobre datos de tráfico de Valencia de octubre de 2023. Cada modelo aprende el residuo de su hora respecto a un baseline histórico suavizado por zona, día de la semana y hora.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">Fórmula de predicción (enfoque híbrido)</h4>
            <Diagram>{`intensidad = baseline(zona, día_semana, hora)
           × exp(shrink_weight × residual_CatBoost)

shrink_weight = sigmoid((baseline − τ) / s)

El peso sigmoid hace que la predicción regrese al baseline
cuando el tráfico histórico es bajo (horas nocturnas,
zonas poco representadas), evitando extrapolaciones erróneas.`}</Diagram>

            <h4 className="mt-5 font-semibold text-slate-900">Features del modelo</h4>
            <div className="mt-2 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Categoría</th>
                    <th className="py-2">Variables</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Temporales (cíclicas)", "hora_sin, hora_cos, dia_mes_norm, wind_sin, wind_cos"],
                    ["Embeddings de zona", "z_emb1 … z_emb5 (5 dimensiones aprendidas por zona)"],
                    ["Meteorológicas", "temp_c, hum_rel, pres_mb, vel_viento_ms, precip_lm2"],
                    ["Retardos meteorológicos", "temp_c_lag1, temp_c_lag3, pres_mb_lag1, pres_mb_lag3"],
                    ["Categoriales", "Zona (1.158 valores), Dia_Semana, tipo_dia (laboral / festivo / fin de semana)"],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-semibold text-slate-800">{k}</td>
                      <td className="py-2.5 font-mono text-xs text-slate-600">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mt-5 font-semibold text-slate-900">Validación temporal</h4>
            <p className="mt-1">
              Entrenamiento: <strong>días 1-24 de octubre 2023</strong>. Prueba: <strong>días 25-31</strong> (nunca usados en ninguna fase de ajuste ni selección de hiperparámetros). Resultados sobre el conjunto de prueba:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric k="MAE" v="≈ 44.4" />
              <Metric k="RMSE" v="≈ 87.8" />
              <Metric k="R²" v="≈ 0.92" />
              <Metric k="sMAPE" v="≈ 16.8 %" />
            </div>
            <Callout tone="amber" title="Cómo interpretar estas métricas">
              MAE de 44,4 veh/h sobre una intensidad media de varios cientos de vehículos por hora representa un error relativo bajo. R² = 0,92 indica que el modelo explica el 92 % de la varianza del tráfico en el conjunto de prueba. Las horas con mayor error (madrugada, eventos puntuales) se señalan en el módulo de monitorización.
            </Callout>
          </Section>

          {/* MONITOR */}
          <Section id="monitor" icon={<ShieldCheck className="h-5 w-5" />} title="Evaluación y monitorización">
            <p>
              EDM pone el foco en que un modelo no termina cuando se entrena: hay que evaluar su calidad, desplegarlo como servicio y vigilar que siga siendo fiable en producción. UrbanFlow implementa las tres capas.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">Evaluación del modelo</h4>
            <p className="mt-1">
              La validación es <strong>temporal estricta</strong>: los días 25-31 de octubre de 2023 nunca se usan en entrenamiento, ajuste de hiperparámetros ni selección de features. Las métricas globales son:
            </p>
            <div className="mt-3 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Métrica</th>
                    <th className="py-2 pr-4">Valor (prueba)</th>
                    <th className="py-2">Qué mide</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["MAE", "≈ 44,4 veh/h", "Error absoluto medio. Fácil de interpretar: en promedio el modelo se equivoca en 44 vehículos por hora."],
                    ["RMSE", "≈ 87,8", "Penaliza errores grandes. Indica que hay picos de error en horas o zonas concretas."],
                    ["R²", "≈ 0,92", "Varianza explicada. El modelo captura el 92 % del comportamiento del tráfico de Valencia."],
                    ["sMAPE", "≈ 16,8 %", "Error porcentual simétrico. Útil para comparar entre zonas con distinta escala de tráfico."],
                  ].map(([m, v, q]) => (
                    <tr key={m} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-mono font-semibold text-slate-800">{m}</td>
                      <td className="py-2.5 pr-4 align-top font-semibold text-slate-700">{v}</td>
                      <td className="py-2.5 align-top text-slate-600">{q}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              La app también calcula estas métricas <strong>por hora del día</strong> y <strong>por zona</strong>, exponiendo los resultados en <code>/metrics/by-hour</code> y <code>/metrics/errors-by-zone</code>. Esto permite identificar en qué franjas horarias o zonas el modelo tiene mayor incertidumbre.
            </p>

            <h4 className="mt-5 font-semibold text-slate-900">Sistema de alertas de monitorización</h4>
            <p className="mt-1">
              El módulo de monitorización compara el MAE de cada hora con un umbral configurable (por defecto <strong>80 veh/h</strong>). Cuando una hora lo supera, genera una alerta que aparece en el panel de monitorización y se expone en la API:
            </p>
            <div className="mt-2 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Tipo de alerta</th>
                    <th className="py-2 pr-4">Condición</th>
                    <th className="py-2">Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["MAE alto por hora", "MAE_hora > umbral (80 veh/h)", "/monitoring/alerts"],
                    ["Zona de error sistemático", "Top zonas con mayor error en validación", "/monitoring/zones-to-review"],
                    ["Zona de baja confianza", "Baseline bajo → shrink weight alto → predicción poco fiable", "/monitoring/zones-to-review"],
                    ["Valenbisi vacía / llena", "Estación sin bicicletas o sin anclajes libres", "/api/mobility/alerts"],
                    ["Valenbisi cerca de evento", "Estación a menos de 1 km de un evento activo", "/api/mobility/alerts"],
                    ["Bus EMT con retraso", "Retraso SAE superior a 3 minutos", "/api/mobility/alerts"],
                    ["Estado del sistema", "CPU, memoria, uptime del contenedor Docker", "/monitoring/system"],
                  ].map(([tipo, cond, ep]) => (
                    <tr key={tipo} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-4 align-top font-semibold text-slate-800">{tipo}</td>
                      <td className="py-2.5 pr-4 align-top text-slate-600">{cond}</td>
                      <td className="py-2.5 align-top font-mono text-xs text-slate-500">{ep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mt-5 font-semibold text-slate-900">Monitorización de datos en tiempo real</h4>
            <p className="mt-1">
              Además del modelo, la app monitoriza la frescura de los datos externos. Cada fuente tiene un TTL: si los datos superan ese tiempo sin actualizarse, la API devuelve un flag <code>stale: true</code> y puede activar el fallback. Esto garantiza que el usuario siempre sepa si está viendo datos actuales o una estimación.
            </p>
            <Callout tone="brand" title="Por qué la monitorización importa en EDM">
              Un modelo preciso en validación puede degradarse en producción si el tráfico cambia (obras, nuevas vías, cambios de comportamiento). El sistema de alertas permite detectar esta degradación automáticamente, sin esperar a que alguien note visualmente que algo falla.
            </Callout>
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
