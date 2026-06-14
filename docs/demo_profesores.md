# Guion de demo (5 minutos) — UrbanFlow Valencia

1. **Problema urbano** (30s): presión de tráfico en Valencia y movilidad sostenible.
2. **Arquitectura** (30s): Next.js (Vercel) → FastAPI (Docker/HF) → CatBoost + PuLP.
3. **Datos** (30s): página `/datos`, octubre 2023, ~853k registros, variables y limpieza.
4. **Predicción** (45s): página `/prediccion`, elegir zona/hora/meteo → intensidad + nivel.
5. **Evaluación** (60s): página `/evaluacion`, MAE/RMSE/R²/sMAPE reales, MAE por hora,
   real vs predicho, zonas con más error, validación temporal.
6. **Optimización Valenbisi** (45s): `/optimizacion` Modo A, ajustar pesos y N, ver mapa y ranking.
7. **Optimización cobertura** (30s): Modo B con presupuesto.
8. **Monitorización** (30s): `/monitorizacion`, alertas de MAE, drift y limitaciones.
9. **CI/CD y despliegue** (20s): GitHub Actions, ramas, Docker, Git LFS.
10. **Conclusión EDM** (20s): `/metodologia`, mapa Bloque EDM → implementación.

Mensaje final: *UrbanFlow Valencia combina predicción de tráfico con CatBoost, evaluación
rigurosa, optimización con programación lineal entera, monitorización de fiabilidad y
despliegue web profesional con CI/CD.*
