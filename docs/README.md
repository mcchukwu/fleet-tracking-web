# Fleet Console frontend docs

Project context for the control console. Read only the file you need.

## Map

| Need | File |
|---|---|
| API contract | `api/openapi.yaml` |
| Auth, CSRF, WebSocket, endpoints, enums, gaps | `api/frontend-integration.md` |
| Reference types and client | `api/api-types.ts`, `api/api-client.ts` |
| Screens, flows, states | `ui-brief.md` |
| Visual rules and tokens | `design-system.md` |
| Working agreement and quality gates | `workflow.md` |
| Settled choices | `decisions.md` |
| Error policy and recovery | `error-handling.md` |

The Bruno collection is in `~/Projects/fleet-tracking-handoff/bruno`, outside this repo.

## Live staging

- API base: `https://fleet-demo.165-232-96-216.sslip.io/api/v1`
- WebSocket: `wss://fleet-demo.165-232-96-216.sslip.io/api/v1/live/ws`
- Demo password: `DemoPass123!`
- Users: `dispatcher@demo.ftb`, `security@demo.ftb`, `viewer@demo.ftb`, `admin@demo.ftb`

The current staging snapshot has 25 vehicles, geofences, trips and alerts. Product copy must not hard-code the count. Staging is shared, may restart during a deploy, and must not hold real customer data.

There is no CORS. Vite proxies `/api` to staging by default. Set `VITE_PROXY_TARGET=http://localhost:8081` to use a local backend.

## Frontend setup

- Vite, React, TypeScript strict, Tailwind v4, TanStack Router, TanStack Query, Zustand and Zod.
- Tokens: `src/styles/tokens.css`; base styles: `src/styles/base.css`.
- Theme and accent state: `src/theme`.
- Shared primitives: `src/ui`; error surfaces: `src/errors`.
- API runtime: `src/api`; mock handlers and fixtures: `src/mocks`.
- Visual contract: `/styleguide`.
- Theme is `light`, `dark` or `system` under `fleet.theme`. Accent is `blue`, `violet`, `fuchsia` or `graphite` under `fleet.accent`. Both live in the user menu's **Appearance** section; the top bar has no theme control.
- Map style is a device preference under `fleet.map.style` (`standard`, `streets` or `satellite`). `Map` is the default and works offline in the same sense as the rest of the app; `Streets` and `Satellite` need `VITE_MAPTILER_API_KEY` in `.env.local`. Without the key the picker offers only `Map`. Hosted styles are online-only, fall back to `Map` with a notice while offline, and disable with "Needs a connection". A failed style or a 403/429 quota response falls back to `Map` once without retrying. `VITE_MAP_GLYPHS_URL` overrides glyphs for the standard style only.
- Map controls (zoom, bearing, fit, geofences, style, panel) are an app-level overlay. The adapter's native controls are not used. Attribution is rendered by the app and is never hidden.
- `npm run dev`, `npm run check`, `npm run test`, `npm run e2e`, `npm run e2e:review`, `npm run build`.
- `npm run e2e` mocks MapTiler style and tile responses with a test key; `npm run e2e:review` uses the local key so the review screenshots show real cartography.
- If Playwright's bundled Chromium is not installed, point it at a system browser: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run e2e`.
- Error policy: `docs/error-handling.md`.

Use the provided API types or generate from `api/openapi.yaml`; do not hand-write request or response shapes.

## Known gaps

- No user administration.
- No alert close action, only acknowledge.
- No pagination totals or report CSV export.
- No WebSocket sequence number; resync with `/live/snapshot` on reconnect.
- `GET /live/snapshot` has no bbox filter.
- No CORS; use a same-origin SPA or the development proxy.
