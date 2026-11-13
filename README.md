# Fleet Tracking Web

A map-first control console for fleet dispatchers, security teams and whoever has access. Track vehicles, trips, alerts and geofences in real time.

This repository is the frontend web application. It talks to the fleet tracking API in `docs/api/openapi.yaml`.

## Status

The foundation is in place: design system and `/styleguide`, API runtime, error pipeline, TanStack Router guards, auth and role state, connection state, shared formatting, the map contract and the mock/e2e harness. Login and the app shell are next.

## Stack

- Vite and React
- TypeScript in strict mode
- Tailwind CSS v4 with semantic design tokens
- TanStack Router and TanStack Query
- Zustand for connection and live state
- Zod at the boundaries
- Lucide icons
- Self-hosted Inter and JetBrains Mono
- Vitest, Testing Library, MSW and Playwright

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The root route opens the styleguide at `/styleguide` until the app shell exists.

The dev server proxies `/api` to the staging API. To point it at a local backend:

```bash
VITE_PROXY_TARGET=http://localhost:8081 npm run dev
```

Set `VITE_MOCK=1` to run the app against MSW instead of staging.

The map uses MapLibre with OpenFreeMap's Positron (light) and Dark styles. Override the basemap with `VITE_MAP_STYLE_URL_LIGHT` and `VITE_MAP_STYLE_URL_DARK`, or switch providers with `VITE_MAP_PROVIDER`. In mock mode, `?map=fake` selects the deterministic fake adapter.

## Scripts

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                                      |
| `npm run check`      | Typecheck, type-aware lint, design guard and unit tests        |
| `npm run guard`      | Run only the design guard                                      |
| `npm run test`       | Run Vitest                                                     |
| `npm run e2e`        | Run Playwright in desktop and mobile projects, light and dark  |
| `npm run e2e:review` | Run Playwright and write screenshots to `test-results/review/` |
| `npm run build`      | Type-check and build for production                            |
| `npm run deploy`     | Deploy `dist` to Cloudflare Workers (run the build first)      |
| `npm run preview`    | Preview the production build                                   |

Install Playwright's browser once after `npm ci`: `npx playwright install --with-deps chromium`. CI needs the same step before `npm run e2e`. If the bundled Chromium is not installed, point it at a system browser instead: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run e2e`.

## Documentation

- [API contract](docs/api/openapi.yaml)
- [Auth, WebSocket and endpoint map](docs/api/frontend-integration.md)
- [UI brief and screens](docs/ui-brief.md)
- [Design system](docs/design-system.md)
- [Frontend workflow](docs/workflow.md)
- [Error handling](docs/error-handling.md)
- [Decisions](docs/decisions.md)

## Theme

The console supports light, dark and system themes. The accent colour is a separate persisted choice. Both are applied before first paint.
