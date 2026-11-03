# Fleet Tracking Web

A map-first control console for fleet dispatchers, security teams and whoever has access. Track vehicles, trips, alerts and geofences in real time.

This repository is the frontend web application. It talks to the fleet tracking API in `docs/api/openapi.yaml`.

## Status

The design system and `/styleguide` are in place. Login, the app shell, live map, alerts, trips, geofences, import and reports are next.

## Stack

- Vite and React
- TypeScript in strict mode
- Tailwind CSS v4 with semantic design tokens
- React Router
- Lucide icons
- Self-hosted Inter and JetBrains Mono

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The root route currently opens the styleguide at `/styleguide`.

The dev server proxies `/api` to the staging API. To point it at a local backend:

```bash
VITE_PROXY_TARGET=http://localhost:8081 npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run check` | Run TypeScript and lint checks |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |

## Documentation

- [API contract](docs/api/openapi.yaml)
- [Auth, WebSocket and endpoint map](docs/api/frontend-integration.md)
- [UI brief and screens](docs/ui-brief.md)
- [Design system](docs/design-system.md)
- [Frontend workflow](docs/workflow.md)
- [Decisions](docs/decisions.md)

## Theme

The console supports light, dark and system themes. The accent colour is a separate persisted choice. Both are applied before first paint.
