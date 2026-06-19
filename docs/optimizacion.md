# Optimización urbana — UrbanFlow Valencia

La sección de optimización convierte los notebooks de `CURSO SMARTCITIES` en un
servicio desplegable con API FastAPI y solver **PuLP/CBC**. El objetivo no es
mostrar un experimento aislado, sino ofrecer una herramienta clara para decidir
dónde instalar equipamientos urbanos con recursos limitados.

## Qué resuelve la app

| Modo | Pregunta | Restricción | Endpoint |
|---|---|---|---|
| Polideportivo | ¿Dónde abrir nuevas instalaciones deportivas? | `Σ costeᵢ Xᵢ ≤ presupuesto` | `/optimize/sports` |
| Centro de salud | ¿Dónde reforzar cobertura sanitaria? | `Σ costeᵢ Xᵢ ≤ presupuesto` | `/optimize/health` |
| Multiobjetivo | ¿Cómo repartir presupuesto entre deporte y salud? | Presupuesto + `Xᵢ + X'ᵢ ≤ 1` | `/optimize/multi` |
| Valenbisi | ¿Qué puntos tienen más potencial de movilidad? | `Σ xᵢ = N` o presupuesto | `/optimize/valenbisi`, `/optimize/coverage` |

## Modelos activos

### Cobertura poblacional

Modelo usado para polideportivo y centro de salud:

```text
Xᵢ ∈ {0,1}   candidato i seleccionado
Yⱼ ∈ {0,1}   hexágono j cubierto

max  Σⱼ pⱼ Yⱼ
s.a. Yⱼ − Σᵢ αᵢⱼ Xᵢ ≤ 0
     Σᵢ costeᵢ Xᵢ ≤ presupuesto
```

`αᵢⱼ = 1` cuando el centroide del hexágono de población `j` cae dentro de la
isócrona del candidato `i`. Los pesos `pⱼ` proceden de la capa de población
filtrada a Valencia y se ajustan según cobertura existente.

### Multiobjetivo

```text
max  λ·cobertura_deporte + (1−λ)·cobertura_salud
s.a. Σ coste ≤ presupuesto
     Xᵢ + X'ᵢ ≤ 1
```

El parámetro `λ` permite explicar escenarios: `λ=1` prioriza deporte, `λ=0`
prioriza salud y `λ=0.5` reparte peso de forma equilibrada.

### Valenbisi / movilidad

```text
scoreᵢ = α·tráficoᵢ + β·poblaciónᵢ + γ·déficitᵢ
max  Σ scoreᵢ · xᵢ
```

Este modo conserva el planteamiento del taller SMARTCITIES: combina presión de
tráfico, población alcanzable y déficit de cobertura de estaciones existentes.

## Trazabilidad con los notebooks

| Notebook / bloque | Contenido original | Estado en UrbanFlow |
|---|---|---|
| `optimizacion (1).ipynb` | OR-Tools, ciudad de 15 minutos, restricciones de cobertura, suma ponderada multiobjetivo. | Reimplementado en PuLP/CBC para backend reproducible. |
| `OptimizaciónValenbisi_CátedraENIA2025.ipynb` | PuLP, candidatos Valenbisi, score compuesto, visualización y comparación. | Activo en la API como modo Valenbisi. |
| Weighted sum / `α`-lexicographic | Dos estrategias para combinar objetivos. | Suma ponderada activa con `λ`; lexicográfico documentado como variante futura. |
| Tweets y capas externas | Señales sociales/geográficas descargadas desde Drive. | No se despliegan si no están curadas; la demanda operativa se cubre con CatBoost y población. |
| Algoritmo genético (DEAP) | Heurística para comparar soluciones. | Documentado como análisis secundario; no se ejecuta en producción. |
| Voronoi dinámico | Áreas de influencia no lineales con solapes. | Documentado como mejora exploratoria futura. |
| Preparación de datos | Candidatos, población, isócronas, costes y equipamientos existentes. | Curado en `backend/data/processed/`. |

## Artefactos usados

| Archivo | Papel |
|---|---|
| `candidates_facilities.csv` | Candidatos, coordenadas, zona, costes y presión de tráfico. |
| `population_hexes.csv` | Hexágonos de población, necesidad deportiva/sanitaria y pesos. |
| `coverage_alpha.json` | Matriz dispersa candidato → hexágonos cubiertos. |
| `existing_sports.geojson` / `existing_health.geojson` | Cobertura existente para calcular déficit. |
| `candidate_points_valenbisi.csv` | Candidatos para el modo Valenbisi con score compuesto. |

## Conexión con CatBoost

```text
CatBoost predice tráfico por zona/hora
   → se agrega a cada candidato como presión de tráfico
      → el optimizador usa esa señal junto a población/cobertura
         → PuLP selecciona la combinación óptima
```

## Criterio de despliegue

El servicio desplegado usa PuLP/CBC porque produce soluciones deterministas,
testeables y rápidas en Hugging Face Spaces. Los bloques de algoritmo genético y
Voronoi quedan explicados como parte del aprendizaje del notebook, pero no son el
motor de decisión público.
