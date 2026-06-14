# Optimización urbana — UrbanFlow Valencia

Una sola sección con **dos modos** de programación lineal entera binaria (PuLP, solver CBC).
La presión de tráfico de cada candidato proviene de la predicción CatBoost agregada por zona.

## Modo A — Movilidad sostenible / Valenbisi

Pregunta: ¿dónde ubicar nuevas estaciones Valenbisi o puntos de movilidad sostenible?

- Variable: `x_i ∈ {0,1}` (selecciono el candidato i o no).
- Score: `score_i = α·tráfico_i + β·población_i + γ·déficit_i` (cada término normalizado 0–1).
- Objetivo: `max Σ score_i · x_i`.
- Restricción: `Σ x_i = N`.

Salidas: ranking, score total, tabla de candidatos y mapa de seleccionados.

## Modo B — Cobertura urbana general

Pregunta: ¿qué actuaciones priorizar bajo presupuesto limitado?

- Variable: `x_i ∈ {0,1}`.
- Score: `score_i = α·población_cubierta_i + β·presión_tráfico_i + γ·déficit_cobertura_i`.
- Objetivo: `max Σ score_i · x_i`.
- Restricción: `Σ coste_i · x_i ≤ presupuesto`.

Salidas: actuaciones seleccionadas, coste total, mapa, score total.

## Origen de los datos (trazabilidad)

| Señal | Origen | Tipo |
|---|---|---|
| `traffic_score` / `traffic_pressure` | Baseline CatBoost agregado por zona | REAL |
| `coverage_deficit` / `valenbisi_deficit_score` | Geometría: candidato NO cubierto por isócronas de instalaciones existentes (`centros-deportivo-valencia.csv`) | REAL (geométrico) |
| `population_score` / `population_covered` | Área alcanzable de la isócrona del candidato | **PROXY documentado** (no censo) |
| `cost` | `cost1` de `localizaciones2.csv` | REAL |

> El proxy de población se usa para ponderar; el notebook `04_prepare_optimization_data.ipynb`
> documenta la versión con la capa de población descargada de las fuentes citadas en los
> notebooks originales (gitlab/Drive). No se inventan cifras de censo.

## Conexión con CatBoost (narrativa única)

```
CatBoost predice tráfico por zona/hora
   → se agrega a cada candidato como presión de tráfico
      → el score urbano usa esa presión
         → PuLP selecciona los mejores puntos
```

## Solver
PuLP con CBC (`PULP_CBC_CMD`). Estable y rápido. El algoritmo genético / Voronoi de los
notebooks originales queda como análisis secundario, no como motor principal.
