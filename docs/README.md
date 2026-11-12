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
| Production hosting and release | `deployment.md` |

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
- The vehicle drawer opens from `?v=<uuid>` (non-modal right panel on desktop, bottom sheet on mobile). It shows the full vehicle record, the last 24 hours of events (20 newest) and the edit/assign writes. `sim_number`, `device_model` and `protocol` are write-only: the API accepts them but never returns them, so the drawer shows `—` and the form labels the group write-only.
- Alerts lives at `/alerts` with `Alerts` and `Alert rules` tabs. The server filters `status` and `type`; severity and plate search are client-side over loaded pages (`limit` 500, `Load more` only on a full page, no total). The detail is the shared page drawer and resolves position from evidence or history; acknowledge reconciles the staging `404 open alert not found` before reporting. Rules replace the whole config and are validated client-side. URL state: `status`, `type`, `severity`, `q`, `tab`, `alert`. Live alert frames only toast and invalidate; the row comes from the REST list.
- Playback lives at `/playback?vehicle&from&to&resolution`, fully URL-synced. `vehicle` is the UUID; `from`/`to` are UTC RFC 3339; `resolution` is `auto`, `raw`, `30s` or `5m`. The default is the last 2 hours at `30s`; Auto omits the parameter and the response's resolution is always labelled. Ranges over 7 days never reach the API. Gaps are drawn dashed and labelled from the median point interval; the cursor never interpolates across one. Events for the same range are markers on the timeline and a collision-free `Events` menu. Playback is read-only and uses the standard basemap. Offline, only ranges already in the query cache remain viewable.
- Trips lives at `/trips` with `status` (the only server filter), `q` and `order` (the sort key; `sort` belongs to the map route) in the URL, plus `trip` for the selected detail. The table uses the shared `DataTable` with 100-row pages and `Load more`. Create always produces a `planned` trip, even with a driver; the client owns the transition matrix (planned → assigned → active → completed, plus cancel). Status changes refetch and reconcile; completion never sends distance. The detail resolves from the loaded feed and falls back to `GET /trips?limit=500`.
- Geofences lives at `/geofences?q=&selected=`. `GET /geofences` returns the whole tenant and ignores every filter, so search and sort are client-side (name, then id) and `?selected=` resolves from the full list. The desktop split is a 360px list beside the map; below `lg` the map sits above the list. Selecting a row or polygon fits it and shows an accent halo; the toolbar owns Edit and Delete. Create and edit draw a polygon through the adapter's `DrawController` (Terra Draw, dynamically imported on the first draw; the map screen never downloads it), send only changed fields, and validate `[lon, lat]`, ring closure, distinct vertices, self-intersection and area before writing. Delete shows the real `in_use` refusal for geofences with events. Offline is read-only; the map is replaced with a neutral notice when the adapter cannot work offline. No new dependency beyond the two approved Terra Draw packages.
- Reports lives at `/reports?from=&to=`, both strict RFC 3339 UTC instants. The default is the last 7 days (written to the URL once); malformed, date-only, reversed and equal ranges never reach the API and show a reset action. Presets are 24 hours, 7 days and 30 days, matched by duration so a shared link keeps its label; Custom opens the shared local-time dialog and converts to UTC. Seven stat cells show the summary and link to the matching list or filter; `Vehicles` is the whole-tenant fleet total, while trip and alert counts are range-scoped and the links open the unscoped lists. Alerts by type is a single-colour SVG bar chart with an accessible description, direct value labels and a collapsible `DataTable` text alternative; zero-count types are omitted and unknown keys render neutrally. The response is Zod-validated: core numbers strictly, `alerts_by_type` rows tolerantly, so one bad row cannot blank the report. `staleTime` is zero so returning to the screen refetches; cached failures keep the numbers with `Couldn't refresh`.
- Drivers lives at `/drivers?q=&status=&driver=`; `q` and `status` are client-side over the full list because `GET /drivers` ignores every filter and paging parameter. Search matches name, phone and licence; the client sorts by name, phone, then licence. Create and edit are diff-only pessimistic writes; deactivating a driver with vehicles confirms the count and explains that assignments stay. The drawer lists the driver's vehicles from the live snapshot by `driver_id` and links each to `/map?v=<uuid>`; when the snapshot and server counts differ, both are shown. There is no delete endpoint and no server-side driver search.
- System health lives at `/system` with no URL state. It polls `GET /system/health` every 10 seconds while the tab is visible and online, pauses while hidden, and refetches once when the tab becomes visible. Dependencies, Fleet and Ingest are grouped stat strips; every item carries a status dot with an icon and accessible name, and non-healthy items sort first. The payload has no timestamps, so per-second rates and deltas are derived from consecutive polls since the page opened and `Last vehicle report` comes from the live connection clock (the fleet's newest report, not a per-device value). A failed first load shows the full-width `Can't reach the API` state with Retry; cached data survives failures with the stale treatment. The screen is read-only for every role.
- `npm run dev`, `npm run check`, `npm run test`, `npm run e2e`, `npm run e2e:review`, `npm run build`.
- `npm run e2e` mocks MapTiler style and tile responses with a test key; `npm run e2e:review` uses the local key so the review screenshots show real cartography.
- If Playwright's bundled Chromium is not installed, point it at a system browser: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run e2e`.
- Error policy: `docs/error-handling.md`.

Use the provided API types or generate from `api/openapi.yaml`; do not hand-write request or response shapes.

## Known gaps

- No user administration.
- No alert close action, only acknowledge.
- No driver unassignment: `PATCH /vehicles/{id}` drops `driver_id: null`, so the UI can change a driver but not clear one.
- Device fields (`sim_number`, `device_model`, `protocol`) are accepted by `PATCH` but never returned by `GET /vehicles/{id}`; they cannot be verified after a save.
- No pagination totals or report CSV export (out of scope for v0.1). No previous-period comparison on Reports; it is a backlog item.
- No server-side import job history: recent imports live in this browser only (IndexedDB, five entries) and are wiped on logout or user change.
- `GET /system/health` returns current cumulative counters only: no timestamps, history, per-dependency latency or device last-seen. System health derives rates and deltas from consecutive polls and labels the fleet's newest live report; it does not invent thresholds or a per-device value.
- No WebSocket sequence number; resync with `/live/snapshot` on reconnect.
- `GET /live/snapshot` has no bbox filter.
- No CORS; production is served from a Cloudflare Worker that proxies `/api` same-origin.
