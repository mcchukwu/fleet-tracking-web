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

- Vite, React, TypeScript strict, Tailwind v4, React Router.
- Tokens: `src/styles/tokens.css`; base styles: `src/styles/base.css`.
- Theme and accent state: `src/theme`.
- Shared primitives: `src/ui`.
- Visual contract: `/styleguide`.
- Theme is `light`, `dark` or `system` under `fleet.theme`. Accent is `blue`, `violet` or `teal` under `fleet.accent`.
- `npm run dev`, `npm run check`, `npm run build`.

Use the provided API types/client or generate from `api/openapi.yaml`; do not hand-write request or response shapes.

## Known gaps

- No user administration.
- No alert close action, only acknowledge.
- No pagination totals or report CSV export.
- No WebSocket sequence number; resync with `/live/snapshot` on reconnect.
- `GET /live/snapshot` has no bbox filter.
- No CORS; use a same-origin SPA or the development proxy.
