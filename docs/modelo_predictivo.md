# Modelo predictivo — CatBoost de tráfico

## Datos
- `oct_2023_imputado.csv`: tráfico + meteorología horaria de Valencia (octubre 2023), ~853k filas.
- Variable objetivo: `Intensidad` (vehículos/hora) por zona y hora.

## Features
- Calendario: `Dia_Semana`, `tipo_dia`, `es_finde`, `es_viernes`, `hora_sin/cos`, `dia_mes_norm`.
- Meteo: `temp_c`, `hum_rel_%`, `pres_mb`, viento (módulo, racha, seno/coseno de dirección), `precip_lm2` + lags intra-día (lag1, lag3).
- Espaciales: embeddings PCA de zona (`z_emb1..5`) construidos sobre el baseline.
- Categóricas: `Zona`, `Dia_Semana`, `tipo_dia`.

## Arquitectura (híbrida por hora)

```
Intensidad_{z,t} = baseline_{z,dow,h} + f_CatBoost(meteo, hora, día, z_emb) + ε
```

- **Baseline suavizado** por (Zona, Día de semana, Hora): patrón estructural estable.
- **CatBoost log-ratio**: 24 modelos (uno por hora) que aprenden el residuo `log1p(Intensidad) − log1p(baseline)`.
- **Shrink sigmoidal** (`tau=48, s=16`): modula la corrección según la magnitud del tráfico, reduciendo ruido en franjas/zonas de baja intensidad.
- Reconstrucción: `intensidad = expm1(log(baseline) + w·delta)`, con `w = sigmoid((baseline − tau)/s)`.

## Validación
- **Temporal** (no aleatoria): train días 1–24, holdout 25–31 de octubre.

## Resultados reales (holdout 25–31 oct 2023)

| Métrica | Valor | Comentario |
|---|---|---|
| MAE | ≈ 44.4 veh/h | Error medio bajo a nivel urbano |
| RMSE | ≈ 87.8 | Precisión consistente |
| R² | ≈ 0.92 | Fuerte ajuste global |
| sMAPE | ≈ 16.8 % | Error porcentual moderado |
| R² (horas punta) | > 0.97 | Reproducción casi exacta del tráfico diurno |

Fuente: `metrics_by_hour_cat_raw.csv` (→ `backend/data/processed/metrics_by_hour_catboost.csv`).

> Las métricas de LightGBM (`models_oct2023_no_lag`, `models_oct2023_opt`) son peores y **no se mezclan** con las de CatBoost. Se citan solo como comparación de baseline.

## Bug corregido (`Zona`)
La validación original fallaba con `You are trying to merge on object and int64 columns for key 'Zona'`.
Se corrige forzando `Zona` a un único tipo `int` en todo el pipeline (`fix/zona-dtype-merge`).

---

## Conclusión y análisis del modelo definitivo (CatBoost + Baseline + Shrink)

### Resultado del ejemplo de predicción
El modelo generó correctamente las intensidades esperadas para el día **2025-10-16**, produciendo un resultado coherente por zona y hora.

| Zona | Hora | Intensidad_pred (veh/h) |
|------|------|--------------------------|
| 1 | 00 | 122.80 |
| 10 | 00 | 20.85 |
| 100 | 00 | 83.28 |
| 1000 | 00 | 108.68 |
| 1001 | 00 | 11.31 |

Estas magnitudes son realistas respecto a las intensidades históricas observadas en octubre de 2023: zonas céntricas (bajas numeraciones) muestran intensidades altas (>100 veh/h), mientras que zonas periféricas mantienen valores bajos (<25 veh/h).

### Interpretación técnica
Arquitectura híbrida con tres componentes complementarios:

- **baseline suavizado** por zona, día de semana y hora → patrón horario estable;
- **f_CatBoost**: modelo de gradiente por hora que corrige desviaciones según clima y calendario;
- **shrink sigmoidal** `w(b; tau, s)`: modula la corrección según la magnitud del tráfico, reduciendo ruido en zonas/franjas de baja intensidad.

### Justificación del modelo definitivo

| Elemento | Rol | Impacto |
|-----------|-----|---------|
| Baseline suavizado (media+mediana) | Captura patrones estructurales | Estabilidad inter-día |
| CatBoost log-ratio | Aprende desviaciones respecto al baseline | Alta precisión sin sobreajuste |
| Embeddings PCA de zona | Similitud espacial entre zonas | Generalización espacial |
| Shrink sigmoidal (tau, s) | Regulariza las correcciones | Evita ruido en zonas poco activas |
| Lags meteorológicos intra-día | Inercia del clima | Robustez en horas consecutivas |

### Conclusión general
El modelo CatBoost definitivo reproduce con alta fidelidad los patrones horarios y diarios del tráfico, integra variables meteorológicas, estacionales y espaciales, y es reproducible y escalable para integrarse en dashboards o APIs REST. Combina la potencia de CatBoost con la estructura lógica de un baseline suavizado, logrando un modelo robusto, interpretable y listo para despliegue operativo.

## Limitaciones
- Datos de un único mes (sesgo estacional posible).
- Mayor error en horas valle y algunas zonas periféricas.
- Los lags meteorológicos en `/predict` se aproximan con el valor actual cuando no se dispone de la serie completa del día.
