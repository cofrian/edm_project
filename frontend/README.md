# UrbanFlow Valencia — Frontend

Interfaz web de UrbanFlow Valencia. Permite consultar datos, tráfico y predicción,
revisar la evaluación del modelo, ejecutar optimizaciones sobre el mapa y ver
alertas de fiabilidad.

Está construida con **Next.js 14 (App Router), TypeScript, TailwindCSS, Recharts y Leaflet**.

## Desarrollo

```bash
npm install
cp .env.example .env.local
# Edita .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo (http://localhost:3000) |
| `npm run build` | Construcción de producción |
| `npm run lint` | ESLint (next lint) |
| `npm run typecheck` | Comprobación de tipos (tsc) |

## Páginas

| Ruta | Qué muestra |
|---|---|
| `/` | Presentación del proyecto y accesos principales |
| `/datos` | Datos usados por la app y preparación |
| `/prediccion` | Tráfico real, predicción por hora y movilidad en tiempo real |
| `/evaluacion` | Métricas del modelo y errores por hora o zona |
| `/optimizacion` | Elección de ubicaciones para deporte, salud, varios objetivos y Valenbisi |
| `/monitorizacion` | Alertas de fiabilidad y limitaciones |
| `/metodologia` | Explicación del método, arquitectura y despliegue |

## API

Todas las llamadas pasan por `lib/api.ts`, que usa `NEXT_PUBLIC_API_URL` y aplica
datos alternativos si la API no responde. Así la interfaz puede seguir funcionando
durante una demo aunque el backend no esté disponible.

## Despliegue

En Vercel, configura:

| Parámetro | Valor |
|---|---|
| Directorio raíz | `frontend/` |
| Variable de entorno | `NEXT_PUBLIC_API_URL=https://cofrian-edm-proyect.hf.space` |
