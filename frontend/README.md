# UrbanFlow Valencia — Frontend

Dashboard smart city en **Next.js 14 (App Router) + TypeScript + TailwindCSS + Recharts + Leaflet**.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo (http://localhost:3000) |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint (next lint) |
| `npm run typecheck` | Comprobación de tipos (tsc) |

## Páginas

`/` landing · `/datos` · `/prediccion` · `/evaluacion` · `/optimizacion` (Modo A/B) ·
`/monitorizacion` · `/metodologia`.

## API

Todas las llamadas pasan por `lib/api.ts`, que usa `NEXT_PUBLIC_API_URL` y aplica
**fallback** (datos demo) si la API no responde, para que la UI nunca se rompa.

## Despliegue

Vercel: directorio raíz `frontend/`, variable `NEXT_PUBLIC_API_URL` apuntando al backend.
