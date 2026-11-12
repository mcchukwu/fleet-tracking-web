# Decisions

## 2026-11-03: Tailwind v4 with CSS-first tokens

Use `@tailwindcss/vite` and `@theme inline` in `src/styles/tokens.css`. No `tailwind.config.js`. This keeps the token source next to the light and dark values and avoids a second configuration surface.

Trade-off: Tailwind v4 is newer than the v3 examples in many tutorials. The team must use v4 syntax.

## 2026-11-03: Semantic tokens, not raw colours

Components use `bg-surface`, `text-muted`, `bg-moving-bg` and similar utilities. Raw hex values stay in `tokens.css`.

Trade-off: A new shade needs a token before it can be used. That is deliberate.

## 2026-11-03: Theme and accent are separate

Theme is `light`, `dark` or `system`. Accent is a separate persisted choice. The accent only changes chrome and focus. It never changes status colours.

Trade-off: The UI needs two controls. Keeping them separate avoids a combinatorial theme matrix.

## 2026-11-03: A small accent preset set

Three presets originally (blue, violet, teal); Slice 2b replaced teal with four tested presets (blue, violet, fuchsia, graphite) because teal collided with the customer geofence hue. More presets increase contrast testing without adding product value, so the set stays deliberately small.

## 2026-11-03: Self-hosted fonts

Use `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` instead of a third-party font CDN. This avoids a render dependency and keeps the console usable on a restricted network.

## 2026-11-03: Native dialog for the drawer

The drawer uses `<dialog>` with `showModal()`. The browser provides focus containment, Escape handling and top-layer rendering.

Trade-off: Styling `::backdrop` and dialog layout needs care, and the API is imperative.

## 2026-11-03: Local primitives first, shadcn later

The first pass builds `src/ui` primitives directly with Tailwind, `cva`, `clsx` and `tailwind-merge`. Radix and shadcn are deferred until a screen needs behaviour that is expensive to build correctly, such as a combobox or a menu.

Trade-off: Some primitives will be replaced when the project adopts shadcn. The component APIs are kept narrow to make that cheap.

## 2026-11-03: TanStack Router in the foundation

The styleguide currently uses React Router 8.5.1 as a placeholder. Slice 0 migrates to TanStack Router, which is on the approved dependency list and is required for typed search params, auth guards and route-level error boundaries. Do not add new React Router routes.

## 2026-11-03: npm in this repo

The repo uses npm and `package-lock.json`. Use npm and oxlint. Do not switch package managers for the foundation. The `check` and `build` scripts are package-manager neutral.

## 2026-11-03: `/styleguide` is the visual contract

Every new shared component and state is added to `/styleguide`. This replaces a separate Storybook setup for now.

Trade-off: The route grows over time. Keep sections small and link to them by anchor.

## 2026-11-03: Keep the 14px dense type scale

Body text is 14px, not the browser-default 16px. This is deliberate for a dense operator console: 16px would make tables, forms and control rows noticeably taller. On a small laptop, browser zoom is the expected adjustment. Revisit only if the product moves away from a dense console layout.

## 2026-11-03: Textareas use layout-owned height

The native resize handle is removed. Textareas keep a fixed minimum height so forms and drawers do not reflow while someone is typing. Auto-grow is a future option only for flows that genuinely need it.

## 2026-11-03: Native select stays native

The selected option is styled with the accent through `option:checked`. Native popup hover and focus are controlled by the browser and OS, so they cannot be styled consistently with Tailwind. A custom listbox would be needed for that; keep native select until that cost is justified.

## 2026-11-03: Pessimistic writes, non-shifting pending rows

Mutations use a pessimistic pending state. A pending row keeps its status content and replaces the existing action slot with a spinner. No extra text, columns or notes are inserted, so the table does not move between normal and pending states. The server result is applied only after success.

## 2026-11-03: Staging contract probe

Probed staging with the demo dispatcher and admin accounts.

- A real live position frame uses `vehicle_id: "demo-imei-0019"`, which is `Vehicle.external_id`, not the UUID `id`. All live and map code uses `vehicleKey()` based on `external_id`.
- Position frames contain `type`, `tenant_id`, `vehicle_id`, `lat`, `lon`, `recorded_at`; speed and heading are not included. Retain the last snapshot values.
- `Vehicle` responses are not consistent about trip fields: some rows omit `trip_id`, `destination` and `trip_status`, and later snapshot rows included them. Treat all three as optional; trip detail comes from the trips list because there is no `GET /trips/{id}`.
- Geofence-exit alert evidence was only `{geofence_id}`. Position must come from other evidence, history, or an explicit unavailable state.
- A missing CSRF token produces `csrf_failed`; recovery is one `/me` refresh and one retry.
- `GET /vehicles?status=` filters administrative status: `active` returns rows, `moving` returns zero.
- The staging snapshot contains 25 vehicles, not the 20 in the brief. Do not hard-code 20 in copy.
- `last_seen_at` may be null; `recorded_at` is the reliable data-age field.

## 2026-11-03: Type-aware oxlint and Vitest in the check gate

Use oxlint with `--type-aware --type-check` and `oxlint-tsgolint`, plus Vitest, the design guard and Playwright. `npm run check` runs typecheck, lint, guard and unit tests. Type-aware linting catches floating promises and unsafe casts that text-based rules miss.

Trade-off: the check gate is slower and needs a native lint helper. The repository avoids a second linter and keeps one configuration.

## 2026-11-03: Code-based TanStack Router

Routes are declared in `src/app/router.tsx` with `createRoute`, not generated from the filesystem. Search params are Zod-validated on each route. This keeps guards, placeholders and route-level boundaries in one readable tree and avoids a code-generation step.

Trade-off: adding a route means editing one file. That is acceptable at this screen count.

## 2026-11-03: Handoff types before generated types

`src/api/types.ts` copies the provided handoff types and reconciles them with observed staging payloads. `openapi-typescript` is approved but deferred: its current release peers on TypeScript 5 while the repo uses TypeScript 7, and the contract is stable enough for the handoff types plus Zod at the boundary.

Trade-off: a contract change needs a deliberate type edit. Zod schemas catch drift at runtime for untyped payloads.

## 2026-11-03: Session restore is a single-flight client call

Route guards call `ensureSession()` before rendering protected routes. It is a single-flight promise around `GET /me`, not a React Query read. This keeps the guard independent of StrictMode's mount/unmount cycle and of query cancellation, and it prevents duplicate `/me` calls when several guards run together.

Trade-off: the `me` query used by `AuthProvider` can still fetch separately after the guard. The response is cheap, and the auth store is the single source of truth.

## 2026-11-03: Map contract is declarative

`src/map/types.ts` defines the only boundary between features and a map provider. Features pass full desired state and the adapter diffs it. Only `src/map/providers/*` may import a map SDK; the design guard enforces it. The Slice 0 MapLibre adapter is a lazy, honest skeleton that reports `drawing` and `offline` capabilities and fails with a map error until Slice 2 implements rendering.

Trade-off: every adapter must implement the whole contract even when a feature does not use it yet. That is what makes Slice 15 a folder-sized change.

## 2026-11-03: Timeout table and slow-request copy

Endpoint timeouts live in `src/api/timeouts.ts` (15s default, 30s history, 120s upload). Slow feedback is a pure `getSlowState()` helper at 3s and 10s so any screen can render the same copy without another timer convention.

Trade-off: the helper is not a UI component. Slice 1 wires it into the shell, where user-started actions first exist.

## 2026-11-03: One error model

Every failure normalizes to `AppError` and is handled by `src/errors/`; features render error states from the hook result and never branch on raw status codes or server messages. `docs/error-handling.md` is authoritative for classification, copy, surfaces, reconciliation and diagnostics.

## 2026-11-04: Route failures share the app error surface

Every route loader and `beforeLoad` failure is rendered by one `defaultErrorComponent` that normalizes the cause and renders `ErrorState` inside a `main` with a hidden level-one heading. Retry resets the boundary and invalidates the router. Before this, a failed `/me` fell through to the router's built-in panel.

Trade-off: the route error page has no shell, because the shell ships in Slice 1. When it lands, the error component moves inside it.

## 2026-11-04: Fault injection travels through the API client

In dev with `VITE_MOCK=1`, the client appends the page's `?fault=resource:kind` parameter to every API request. MSW handlers read it and return that fault. `malformed`, `unknown_enum` and `lost` reuse the §11 helpers. This keeps the switch out of production code paths and lets Playwright force faults without runtime handler injection.

Trade-off: the fault applies to all calls for one resource until the page URL changes. Tests clear it with `history.replaceState` when they need recovery.

## 2026-11-04: Four Playwright projects for the theme matrix

The suite runs desktop and mobile at 1440x900 and 390x844, each in light and dark (`desktop-light`, `desktop-dark`, `mobile-light`, `mobile-dark`). A fixture reads the project name and stores the theme before first paint; tests receive the same theme as a fixture and assert the resolved `data-theme`.

Trade-off: four projects multiply runtime. With one worker the suite stays fast enough for a per-slice gate.

## 2026-11-04: Offline defaults to the browser signal

`normalize` treats a fetch `TypeError` as `offline` when `navigator.onLine` is false and no explicit hint was passed. Callers can still override it. The connection store remains the UI source of truth; this only fixes classification at the error boundary.

Trade-off: a service-worker-served response can succeed while `navigator.onLine` is false; that is a connectivity state, not a failed request, so no error is produced.

## 2026-11-04: Slow-action states wait for the shell

`getSlowState()` and its copy exist and are unit-tested, but Slice 0 has no screen that starts a user action, so there is no 3s/10s surface to exercise in Playwright. The fault lab exposes a 12s `slow` kind; the e2e scenario lands with Slice 1, which owns "Still working…", Cancel and Retry. Recorded here so the §11 gap is explicit rather than forgotten.

## 2026-11-04: Session restore is a shared query, and expiry survives navigation

`ensureSession(queryClient)` resolves through `queryClient.ensureQueryData(meQueryOptions())`, so a route guard and any later reader share one `/me` response. An `expired` session is returned as-is and is never restored from the cached response: a router re-render or URL change while the expiry dialog is open must not silently sign the user back in. Only a successful `POST /auth/login` moves `expired` to `authenticated`.

Trade-off: an explicit logout or a different-user sign-in is the only path that clears the cached `/me` result. The auth store stays the single source of truth for the session state.

## 2026-11-04: The mock models the real session lifecycle

`/auth/login` sets a persisted mock session and returns the real `invalid_credentials` / `invalid_request` codes. `POST /auth/logout` requires the CSRF header and returns the real `csrf_failed` code, then marks the mock signed out so a reload stays anonymous. `fleet.mockRole` remains an explicit role switch for e2e, and login clears it. Wrong-password `401` is reported to the form but never raises the session-expiry event.

Trade-off: the mock has a default demo dispatcher session when nothing is stored, so existing foundation tests keep working. Tests that need an anonymous start clear it explicitly.

## 2026-11-04: Login 429 and Retry-After remain unverified

Sixteen rapid failures against staging never produced a `429`, and no rate-limit headers appeared. The form parses `Retry-After` (seconds or HTTP date), counts down live, and falls back to "Try again shortly." when the header is absent. The countdown path with the header is covered by MSW and e2e; the no-header path is covered by unit tests only, because the shared fault layer always sends the header. This is recorded as an unverified contract, not a confirmed one.

Trade-off: if staging later sends a different code or header name, the catalog needs one edit and the countdown keeps working without it.

## 2026-11-04: `Online` is honest before the live socket exists

Slice 1 has no WebSocket, so the top-bar indicator shows `Online` (green dot) while the browser is online rather than claiming `Live`. The shell computes `live` and `reconnecting` from the connection store and will use them automatically when Slice 2 opens the socket. The label collapses to a dot with the accessible name `Connection: Online` below `md`.

Trade-off: the state name is temporary; Slice 2 changes the derivation, not the component anatomy.

## 2026-11-04: Shell navigation is capability-driven

The rail and mobile menu render from `navForRole(role)` with `read`, `mutate` and `audit` capabilities. Hidden destinations are not disabled: a deep link to a hidden route reaches `/forbidden` inside the shell with a link back to the map. Active items use `aria-current="page"` and the accent-soft background.

Trade-off: adding a screen means adding one line to `src/features/shell/nav.ts`; the role matrix test fails if the capability is wrong.

## 2026-11-04: Shell-only tokens are added, not hard-coded

`--spacing-touch` (44px), `--spacing-rail-expanded` (200px), `--container-dialog` (480px) and `--container-content` (1440px) are design tokens, plus `--overlay` for dialog backdrops and small `z-menu`/`z-dialog`/`z-toast`/`z-banner` utilities for the stacking scale. The guard forbids arbitrary Tailwind values, so these values have to exist as tokens. The four z utilities were replaced by the single layer model on 2026-11-10.

Trade-off: four layout tokens and one overlay token now live in the design system; the alternative was arbitrary values in five components.

## 2026-11-04: Demo hints never enter the production bundle

`DemoHints` holds the staging demo accounts, so `LoginForm` loads it through a DEV-and-`VITE_DEMO_HINTS`-gated dynamic import instead of a static one. Vite removes the dead branch in a production build, and `npm run build` now runs `scripts/assert-bundle.sh`, which fails if `dist` contains the demo password or any `@demo.ftb` address.

Trade-off: the demo buttons appear one tick after first paint in dev; production ships no credentials and no extra chunk.

## 2026-11-04: Touch targets switch at the `md` breakpoint

Shared primitives use `h-touch`/`size-touch` below `md` and the existing control height at `md` and up, per design-system §5.1 (44px on touch breakpoints, 28px desktop). `expectTouchTargets(44)` now runs in the mobile projects for login and the shell.

Trade-off: mobile rows and inputs are taller than the desktop density; the two densities have to be designed, not interpolated.

## 2026-11-04: The account menu is non-modal and portals into the header

The user menu uses `modal={false}` so the rest of the app stays in the accessibility tree, and its content is portalled into a container inside the `<header>` landmark to clear axe's `region` rule. Both behaviours are asserted by an axe scan while the menu is open.

Trade-off: focus is not trapped while the menu is open; Escape and click-outside still close it.

## 2026-11-04: Session expiry cancels queries after the store flips

The API client calls `onSessionExpired` before it throws the `401`, so by the time `fleet:session-expired` fires the auth store is already `expired`. The listener now cancels active queries regardless of the status it finds, instead of returning early and leaving retry loops running behind the dialog.

Trade-off: the initial anonymous `/me` failure also cancels queries; nothing is in flight at that point, so it is harmless.

## 2026-11-04: Login copy owns its network and timeout wording

A failed login `POST` is an uncertain write, so the shared catalog would say "Check /auth/login before trying again". Login is the one screen where that is both wrong and an information leak, so `loginErrorCopy` handles `network` and `timeout` before falling through to the catalog.

Trade-off: two copy pairs are duplicated between the catalog and the login screen; they must stay aligned if the global wording changes.

## 2026-11-04: Sign out is one pessimistic helper that names the failure

The user menu and the session-expiry dialog now call `useSignOut`, which awaits `POST /auth/logout`, clears local state even on failure (the mutation's `onSettled` already did), and shows one persistent error toast. The toast separates an unreachable server (`network`, `offline`, `timeout`) from a rejected call (`403`, `5xx`), because only the first means the request never arrived. Both surfaces disable the control while the request is in flight.

Trade-off: the user reaches the login screen before knowing the server did not revoke the session; the toast is the only place that fact is stated. That matches the policy's "toast when the surface has already closed" rule.

## 2026-11-04: Escape clears the vehicle search

The advertised `Esc` shortcut now clears a non-empty global search (dialogs already close on Escape). Selection and drawers still belong to Slice 2/3.

Trade-off: the shortcut's behaviour grows per screen; the registry lists one label, so later slices extend the handler rather than the copy.

## 2026-11-04: Live positions key on `external_id`, alerts on the UUID

Staging's live frames carry `vehicle_id: "demo-imei-0019"`, which is `Vehicle.external_id`; `Alert.vehicle_id` is the UUID. The live store and map markers key on `external_id` through `vehicleKey()`, and the map builds a `uuid → external_id` map from the snapshot before it maps alerts. `?v=` stores the UUID (the approved selection decision), so Slice 3 can call `GET /vehicles/{id}` and a deep link survives a reload.

Trade-off: the URL is opaque and a link built from an IMEI does not select a vehicle; a mixed key would silently produce zero alerts per vehicle.

## 2026-11-04: Data age comes from `recorded_at`, not `last_seen_at`

Every staging snapshot row has `recorded_at`; none has `last_seen_at`, although the handoff type declares it. The snapshot schema treats position fields as optional, and a missing position means Offline with `—` for speed and age, not an error.

Trade-off: the five offline vehicles appear in the list without a position; `last_seen_at` stays in the wider `Vehicle` type until a slice needs it.

## 2026-11-04: Speed and heading freeze at the snapshot

Captured position frames contain only `lat`, `lon` and `recorded_at`; they never carry `speed_kph` or `heading_deg`. The live store keeps the last snapshot speed/heading and records when they were reported, and the snapshot refetches every 60 seconds so a moving vehicle does not stay "moving" after it stops.

Trade-off: speed can be up to 60 seconds old; the tooltip names the reported time, and the map status uses the snapshot-derived speed rather than inventing a live one.

## 2026-11-04: The alert mark window is 15 minutes

All 45 open staging alerts are about two days old and every online vehicle has at least one, so any-open-alert would paint the whole fleet red forever. The map shows alert status only for open alerts inside a 15-minute window; the KPI and the Alerts screen count every open alert.

Trade-off: an old unacknowledged alert does not redden its vehicle on the map; the window is one constant in `src/features/map/lib/constants.ts`.

## 2026-11-04: OpenFreeMap is the basemap and the adapter reports `offline: false`

The MapLibre adapter uses OpenFreeMap Positron/Dark style URLs, builds every data layer from `MapTokens`, and reports `offline: false` until the self-hosted PMTiles pack arrives in Slice 13. The MapLibre worker URL is imported with Vite's `?worker&url`; without it the dev server fails to load the worker.

Trade-off: the basemap needs the network and its style is not ours; the operational layers still render from tokens and the local token-built fallback style when the remote style fails within 3 seconds.

## 2026-11-04: The fallback style is built from tokens, not a JSON asset

The plan listed `public/map/fallback-*.json`. The adapter instead builds a background-only fallback from the current `MapTokens`, so it follows light/dark and accent changes without a second source of truth.

Trade-off: there is no static fallback file for CI to diff; the fallback stays in one place.

## 2026-11-04: Cached error states keep data legible, not dimmed

`StateBoundary` used `opacity-60` over cached children during a refresh error. Axe measured the blended status and secondary text below 4.5:1, so the map panel now keeps the rows at full contrast and relies on the explicit "Couldn't refresh · Retry" line to carry the state.

Trade-off: a deliberate deviation from design-system §11's "dimmed" treatment; accessibility wins and the error line remains visible.

## 2026-11-04: `view=1` is a numeric search value

TanStack Router re-serializes string values that begin with a digit as JSON (`view="1"`), so the map schema coerces `view` to `0 | 1` and the URL stays `view=1`.

Trade-off: the search param is a number rather than a string; `onlyInView` is `search.view === 1`.

## 2026-11-04: Live frames are parsed and coalesced inside the frame batch

The socket manager forwards raw payloads and buffers raw payloads during a resync. `LiveProvider` parses, validates and coalesces frames in the batched callback, keeping the newest position per vehicle, then writes the Zustand store once per animation frame. The list and map read a one-second view, so 500 messages per second never re-sort 5,000 rows or ping the adapter per message.

Trade-off: a vehicle's intermediate positions are not kept; the map shows the latest known position and the history belongs to playback.

## 2026-11-05: A 31-second live capture is committed as a fixture

A Playwright session logged into staging on 2026-11-04T23:21:59Z and recorded 606 `position` frames for 20 vehicles over 31 seconds (one frame per vehicle per second, 30–31 per vehicle, no per-vehicle out-of-order timestamps). Every frame has exactly `type, tenant_id, vehicle_id, lat, lon, recorded_at`; no `speed_kph` or `heading_deg`, and no alert frame was observed. The capture is sanitised (demo tenant only) and committed as `src/mocks/fixtures/liveCapture.ts`, and a schema test parses every frame.

Trade-off: the 117 KB fixture is real evidence, not hand-written; it must be recaptured when the feed shape changes, and it cannot prove alert-frame behaviour because staging still emits none.

## 2026-11-05: Reconnect backoff counts resync failures

The socket attempt counter resets only after a successful snapshot resync and `live` state, not when the socket opens. A socket that connects while `/live/snapshot` keeps failing now backs off (1s, 2s, 4s … 30s) instead of retrying roughly once a second forever.

Trade-off: a transient resync failure delays the next attempt by an extra backoff step; the alternative is a hot retry loop against a failing API.

## 2026-11-05: Alert bursts are coalesced over a 250 ms window

Alert frames are summarised 250 ms after the first alert in a window, not per animation frame. A burst split across frames therefore produces one toast and one assertion, and multi-alert toast keys include a window sequence so the 10s toast dedupe cannot swallow a later batch. Critical alerts use Radix Toast's assertive live region; there is no second app-level announcement for the same alert.

Trade-off: an alert toast can appear up to 250 ms after the frame; the window is one constant in `src/live/LiveProvider.tsx`.

## 2026-11-05: `renderedVehicleCount` is now `targetVehicleCount`

The debug field counted the array passed to the adapter, before clustering or layer installation. It is renamed to `targetVehicleCount` so the name matches the fact; a true rendered count would require the adapter to report marker and cluster counts after layout.

Trade-off: the perf test now proves the target size, not the number of visible glyphs; the adapter contract test still proves clustering behaviour.

## 2026-11-05: Offline is a state on the map, and filters filter the map

While offline, snapshot, geofence and alert query failures do not become region errors or error toasts. The cached rows, markers and KPIs stay visible, the map dims, and the panel shows its stale treatment; the global offline banner carries the cause. The map target is built from the filtered rows (plus the selected vehicle), so a status or depot filter changes the markers and `targetVehicleCount`, not just the list.

Trade-off: an offline visitor with no cached snapshot sees an empty panel rather than a retry surface; returning online clears the banner and the queries resume. Keeping the selected vehicle on the map means a selection can outlive the filter that excluded it.

## 2026-11-05: Slow map queries report progress after 3s and 10s

`SlowNotice` mounts while the snapshot is fetching, announces "Still working…" after three seconds and "Taking longer than usual" after ten, and unmounts when the request settles. Cancel aborts the snapshot query and clears its pending surface; the panel then offers Retry.

Trade-off: a slow query shows both the skeleton and the notice; the copy is shared with the login slow states through `src/errors/slow.ts`. A cancelled first load is an explicit empty state rather than a silent blank.

## 2026-11-05: The MapLibre comfort count is measured, not assumed

With a 5,000-vehicle target in Chromium at 1440×900, the real MapLibre adapter loaded in 154 ms of longest task, and a 20-step pan produced a 348 ms longest task. The adapter therefore declares `comfortableVehicleCount: 1_000`, well below the stress target, and the 5,000 case remains a stress test rather than a claim of 60 fps.

Trade-off: the declared budget is conservative because the measurement only covers one desktop run; the UI does not yet cluster earlier from this value, so it is documentation and a contract fact until a slice consumes it.

## 2026-11-05: Slice 2 review fixes (map freshness, rendering budget, retry)

- The map target now subscribes to the live-store version and updates once per frame; above 1,000 vehicles it is throttled to 20 fps. Rows and KPIs stay on the shared one-second view. This keeps 500 messages per second off the 1 Hz path without re-sorting the list per frame.
- The MapLibre adapter reuses unchanged GeoJSON features by key, snaps instead of gliding above `comfortableVehicleCount`, updates the source at most 20 times per second in that range, and raises `clusterMaxZoom` by two levels with `setClusterOptions` when crowded. The comfort count is now consumed rather than documented.
- Staleness is derived from the frame-fed `lastDataAt` in the connection store, with a 10-second socket-silence grace and the 5-minute data-age limit. A live socket whose frames stop is therefore marked stale even though `socket` is still `live`.
- `SlowNotice` grows Cancel and Retry actions once the 10-second state is reached; Cancel calls `cancelQueries` for the snapshot. The map snapshot error overlay is always rendered, including with the desktop panel open, and unavailable KPI cells show `—` instead of invented zeroes.
- `FleetMap` clears the failed loaded adapter before a retry so the stale adapter cannot remount behind the cleared error. Unknown alert severities parse as strings and degrade to no severity rather than dropping the frame.
- The 5,000-vehicle Playwright case is recorded as a stress test, not a pan measurement: the deterministic fake adapter has no pan gesture, so the browser cannot exercise map panning in that suite. The 348 ms real-adapter pan above remains the only pan evidence and is the recorded limitation for this slice.
- The map's open-alert query now parses `/alerts` through a tolerant entity schema and salvages valid rows instead of casting the response. Malformed rows are dropped and counted, while unknown alert types, severities and statuses are kept as strings so the UI can render the neutral fallback rather than blanking the screen.

Trade-off: the 20 fps cap and earlier clustering trade animation smoothness for main-thread headroom above the comfort budget; the timestamp trigger is now a 44px button on touch so keyboard and touch users can reach the local/UTC detail.

## 2026-11-05: The dev proxy rewrites the WebSocket Origin, and the banner has an honest end state

Staging rejected the live WebSocket through the Vite dev proxy with a 403 because `WS_ALLOWED_ORIGINS` compares the request `Origin`. Vite's `changeOrigin` rewrites only the `Host` header, so the proxy forwarded `Origin: http://localhost:5173`. `vite.config.ts` now sets `Origin` to the proxy target's origin on `proxyReqWs`; production is same-origin and does not use this proxy.

Verified through a dev server on `:5174`: login returned 200, the upgrade with a localhost origin returned 101, and 334 real position frames arrived in 20 seconds with exactly `type, tenant_id, vehicle_id, lat, lon, recorded_at`; no alert frame arrived. The committed 31-second capture was already real evidence with the same field set, so no fixture was recaptured. The proxy must target the staging site (or an origin listed in `WS_ALLOWED_ORIGINS`).

The reconnect banner now moves to a terminal state after 60 seconds: `Live updates are unavailable. Showing data from hh:mm.` with `Retry now`, while automatic attempts continue at the 30-second backoff cap. The banner sat at z-index 35 at the time; from 2026-11-10 it is in normal flow and has no z-index. In development, three failed handshakes after a successful `/me` log one console hint pointing at `WS_ALLOWED_ORIGINS` and the proxy `Origin` header.

Trade-off: the terminal copy admits that live updates have stopped instead of pretending every retry will work; the data already on screen remains the source of truth until a retry succeeds.

## 2026-11-06: App-level map controls, contained sheet, four accents and env-gated satellite

The map's zoom, bearing, fit, geofence, style and panel controls are now an app overlay that calls the extended `MapAdapter` contract (`zoomIn`, `zoomOut`, `resetBearing`, `setBaseStyle`, `bearing` in every viewport). Native MapLibre controls are removed because they cannot follow the theme, avoid the sheet and KPI strip, or honour the `--map-inset-right` contract Slice 3 will publish. Attribution moved out of the control stack into its own token-styled chip: it is a licence requirement and must never fade with the controls.

The mobile sheet now has a fixed header (originally 96px: 4px drag band, 44px title/filters row, 44px search/fit/geofences row; the separator correction below supersedes the height and row split), only the vehicle list scrolls, and the sheet is `min(100dvh - top bar - 80px, 100% - 80px)` translated by `100% - var(--sheet-visible)`. Dragging publishes `--sheet-visible` and `--map-inset-bottom` per animation frame; React state changes only on release. At full the compact KPI is not rendered so the remaining 80px strip is map plus attribution, and that strip is a button back to half. This resolves the conflict between the 80px map strip and the 128px compact KPI without hiding attribution.

Appearance moved into the user menu so the top bar holds only the logo, connection indicator and user menu. Four accents (Blue, Violet, Fuchsia, Graphite) each define the full accent set per theme plus `--accent-contrast`; teal was removed because it collided with the customer geofence hue. `src/theme/accents.test.ts` parses `tokens.css` and enforces the contrast thresholds. Unknown stored values fall back to Blue, and the pre-paint bootstrap validates both preferences plus `viewport-fit=cover`.

Satellite is a `MapStyleId` with an env-gated raster source. It is online-only: while offline the effective style is standard, `fleet.map.style` keeps the chosen satellite value, one info notice explains the fallback, and the menu disables the option with `Needs a connection`. Theme changes repaint only the data layers on imagery. The tile provider is not yet approved, so the build offers only the standard map until `VITE_SATELLITE_TILES_URL` and `VITE_SATELLITE_ATTRIBUTION` are supplied; the e2e suite uses a test-only URL to prove the UI and fallback.

Trade-off: the sheet is transformed rather than resized during drag, so the header can never leave the viewport, but the list is briefly offscreen at peek and is therefore marked `inert` instead of being focusable. Satellite adds a glyph URL dependency for labels; without it MapLibre still renders markers and geometry but not text.

## 2026-11-06: The sheet header owns its separator, and peek is 113px

Measured at 390x844, 360x640 and 412x915 in both themes and at every snap and scroll position, the sheet header failed every alignment invariant. The sheet drew `border-x` and `border-t` inside its own width, so the header and its 1px separator sat 1px inside the sheet on each side, and the 1px top border consumed one pixel of the 96px peek: the separator fell 1px below the viewport and the search field ended flush against the screen edge. The header itself had no background (it relied on the sheet), no positioning layer, and its fixed 96px height included the 1px bottom border, so its 96px of content overflowed the 95px content box. The search field shared a 44px row with fit and geofences, leaving no vertical gap, and its own bottom border ran into the header separator while its right inset was 116px instead of 12px.

The header is now the single owner of the header separator: an opaque `surface` layer, `relative z-10`, with a 1px `border` bottom border spanning the full sheet width. The sheet's own edge is a non-layout `ring`, so no border steals width from the header or the rows. The header anatomy is 8px drag band + 44px title/count/fit/geofences/filters row + 60px search row (44px field with 8px above and below) + 1px separator = 113px, and the peek token is 113px so the visible peek is exactly the header. Fit and geofences moved into the title row; the search field is now full width with 12px insets and no longer shares a row with buttons. The sheet reserves `env(safe-area-inset-bottom)` as padding so the last row can scroll clear of an iOS home indicator.

Trade-off: the peek state is 13px taller than before, so 13px less map is visible at peek. The alternative — keeping 96px — cannot give a 44px field 8px above and below while keeping a 44px title row, which is why the design-system sheet anatomy was updated with this decision.

## 2026-11-06: Vehicle rows are measured, content-centred and clear the sheet footer

Measured at 390x844, 360x640 and 412x915, in both themes, at every snap and scroll position, with 1, 3, 25 and 5,000 mock vehicles, three row defects appeared. With one vehicle the list region collapsed to its content: the `VehiclePanel` inside `#mobile-vehicle-panel` had no `flex-1`, so the scroller measured 56px instead of the sheet's 602px content height, leaving the sheet's footer empty and the list stopping 342px above the sheet bottom. The row used a layout `border-b` inside its fixed 56px height, so the `h-full` content box measured 55px and its centre sat 0.5px high. No bottom padding existed on the scroller, so at the end the last row finished 0–3px above the list edge instead of the required 12px.

The sheet now gives `VehiclePanel` `min-h-0 flex-1`, so the list always fills `sheet height - header - safe area`. Each row divider is an absolutely positioned 1px `border` line on the row's bottom edge instead of a layout border, which gives the content the full 56px and an exact centre while keeping the divider at the header separator's full width. The scroller owns one 12px bottom inset (`pb-3`); the sheet keeps owning the safe-area inset, so the last row clears 12px plus the safe area. `VehicleList` now renders `data-index` and a `measureElement` ref, so the virtual total is the sum of measured rows rather than an estimate that happens to match.

The first attempt still put the driver line on the divider. The hidden cause was the plate copy button: its 44px touch height made the first line 44px, so the two-line group measured 62px inside the 56px row and overflowed 4px below the divider. The in-row copy action was then given a 24px height and kept its 44px width; the row's 56px selection button remains the primary touch target. That 24px target is superseded by the review-round-two entry below. `expectTouchTargets` applied the 24px floor only to elements marked `data-row-inline-action`, and the row guard asserts that the driver line keeps at least 6px above the divider.

The attribution was a 12px chip with `white-space: normal`, laid out beside the controls in a wrapping row. It is now an 11px `text-2xs` token (the one licence-text exception to the 12px caption floor) with `whitespace-nowrap`, and it is the second item in the mobile bottom-right column: controls first, credit 8px below, both right-aligned. It is a sibling of the controls, not a child, so it stays visible when the stack fades and goes inert above 60% sheet height, and it rides `--map-inset-bottom` to stay 12px above the sheet at every snap. The chip keeps the configured provider credit (`© OpenStreetMap · OpenFreeMap` in the current default). Changing the copy to Protomaps while OpenFreeMap tiles are served would misattribute the basemap; the 11px, single-line and placement guarantees are independent of the provider string.

Trade-off: the mobile stack is taller by the chip plus its 8px gap, so at 360x640 the controls start higher; the attribution is not part of the fading control stack, which is why it still occupies its row when the controls are transparent. The e2e guard is `e2e/sheet-rows.spec.ts`, which asserts the 56px row rhythm, measured virtual total, content centring, divider geometry, list fill, 12px plus safe-area footer and the attribution stack at every listed viewport, theme, snap, scroll and fleet size.

## 2026-11-06: The 113px peek is the approved contract, and row copy actions keep a 44px target

Review round two found two written-requirement deviations in the mobile sheet and its rows. The project owner reviewed the measurements and explicitly approved the 113px peek on 2026-11-06: the playbook Slice 2b spec and the approved plan now say 113px, so the spec, the design system and the code agree. The number is not free to drift: `e2e/sheet-rows.spec.ts` asserts that at peek the header and the visible sheet are both 113px.

The in-row plate copy action had a 24px height, which violated the 44px touch minimum in `agent-playbook.md` A3 and design-system §5.1. It now keeps its 24px visual line but grows to a 44px hit box on touch widths, with symmetric negative vertical margins so its layout contribution stays one text line and the two-line row still measures 56px. The `expectTouchTargets` exemption for `[data-row-inline-action]` is removed, and the row guard asserts a 44px height for the action. The trade-off is that the 44px box overhangs its 20px text line by 12px top and bottom, so it overlaps the row's second line by 10px on the left edge (and sits up to 3px above the row's top edge); a tap on the start of the driver line copies the plate. The alternative is a 24px target that fails the touch minimum.

## 2026-11-06: The mobile sheet is sized to its visible height, so the map page never scrolls

The drawer was reported as behaving like a continuation of the page: dragging anywhere below the top bar scrolled the map screen, and the end of the vehicle list could only be reached by scrolling the whole page. The new containment test failed at both mobile viewports: at peek the sheet's box ended at 1446px in an 844px viewport (390x844) and at 1038px in a 640px viewport (360x640). On an iPhone 13 profile (664px viewport) the half sheet ended at 931px and `main` reported a scroll height of 882px against a 615px client height. The cause was structural, not a missing overflow rule: `.mobile-sheet` kept its full maximum height and was moved down with `transform: translateY(100% - visible)`, so the invisible part still lived in the layout of the map page's scroll container, and the list's own client height was the full sheet height even though only the top of it was on screen. The list therefore had no reachable end at half.

The sheet now owns exactly the visible height (`height: var(--sheet-visible)`, pinned with `bottom: 0`); dragging still publishes `--sheet-visible` per frame, so the header tracks the finger and the list body is always the part that is on screen. A snap changes that height instantly rather than animating it: design-system §7 allows only `opacity` and `transform` on layout, and a transform cannot move a shrinking sheet's top edge down while keeping its bottom edge pinned. `--map-inset-bottom` follows the snapped height without its own transition so the map controls cannot slide out from under the sheet. The full snap is measured from the map surface (`ResizeObserver` on the sheet's container) rather than from `100dvh` minus a top-bar token, so banners that shrink the page cannot push the sheet's header above its container. The map root clips, the collapsed peek drops the list's 12px bottom inset, and `<main>` stays scrollable only for screens that actually have page content. The earlier "transformed rather than resized" trade-off is superseded.

Trade-off: snaps are instant instead of sliding, so the sheet loses the motion it had. The drag itself is still continuous, and the remaining motion (opacity and inset transforms) stays within §7. The alternative — keeping a full-height sheet and translating it — leaves the list's scroll viewport taller than the screen, which is exactly why the last rows were unreachable. `e2e/sheet-containment.spec.ts` now asserts at each snap that the sheet ends at the viewport, the map page and document do not scroll, the list viewport equals the visible sheet body, and the last row is reachable and visible after scrolling only the list.

## 2026-11-07: MapTiler Streets and Satellite styles, licence-gated

MapTiler is now the second provider of base styles, gated by `VITE_MAPTILER_API_KEY` in `.env.local`. Without the key the picker offers only `Map`; with it, `Streets` and `Satellite` are added. `Map` remains the default and keeps the OpenFreeMap style documented on 2026-11-04 — it is not yet the self-hosted Protomaps pack, so the package's offline claim remains a Slice 13 task, not a property added here. The key is never hard-coded, committed, rendered or logged; style URLs carry it only as query data, and diagnostics reduce every URL to its path (error-handling §8).

`streets-v4` and `streets-v4-dark` are used for Streets by theme, and `hybrid-v4` for Satellite (imagery with road and place labels). These are the current v4 families; the v2 families are deprecated. No dependency was added: the adapter fetches the style JSON, passes the object to MapLibre, and re-installs our vehicle, geofence and route sources/layers on `style.load`. Prefetching keeps the old map visible until the new style is ready, so a style change does not show an empty canvas. Camera, selection, hover and live data are restored from the adapter's existing state.

The attribution chip now uses the credit the style actually provides: direct source attributions, or the source TileJSON's attribution when the style omits it (`hybrid-v4` does). The style's HTML credit is reduced to the one-line text `© MapTiler © OpenStreetMap contributors`. A hosted style with no obtainable credit is refused and falls back to Map rather than shipping an uncredited map. The MapTiler logo is an opaque chip at the bottom-left of the map area, above the mobile sheet and shifted right of the desktop panel; both the chip and the logo appear only while a MapTiler style is active. The plan is not exposed at runtime, so the logo is shown for both hosted styles on every plan: it is mandatory on the free plan and permitted on paid plans.

Failure handling is one-shot. A style fetch failure, or a 403/429 from a tile after the style is active, emits an error, stores `Map` as the preference, and applies the standard style once. The page shows a single error toast with a manual `Retry`; nothing retries in a loop. While offline both hosted styles are disabled with `Needs a connection`, the map uses `Map`, and the stored hosted choice returns when the connection does. `VITE_MAP_GLYPHS_URL` is now an override for the standard style only; hosted styles bring their own glyphs and sprites.

Licence facts recorded for the next commercial decision (MapTiler Cloud terms and pricing, checked 2026-11-07):

- The free plan is limited to non-commercial use and research & development for commercial products. A commercial product needs a paid plan.
- The free plan requires the visible MapTiler logo; all plans require the MapTiler and OpenStreetMap attribution text while the map is displayed.
- When the free plan's quota is exhausted, the service pauses until the next month (it is not billed as overage). The fallback above is what the UI does during that pause.
- `hybrid-v4` supplies attribution through its source TileJSON but not in the style JSON itself, which is why attribution resolution follows source `url`s.

Trade-off: always showing the logo adds a small persistent element on paid plans, but the build cannot detect the plan and the free-plan terms are the strictest; hiding it would be a licence risk on free. The MapTiler logo is vendored unmodified from `https://api.maptiler.com/resources/logo.svg` as light and dark wordmarks so it remains legible in both themes without a runtime request. `VITE_` values are public in the client bundle by design, so the key must be a restricted MapTiler key; it is kept out of source, git and logs, but it is not a server secret once built.

## 2026-11-07: Vehicle drawer contract, modality and writes

The vehicle drawer is a **non-modal** `<aside>`, 420px wide, 12px from the map edge. Slice 2b's `--map-inset-right` exists so the map controls shift around the panel; trapping focus or adding a backdrop would contradict that contract and stop the map being the product. Escape is handled in a capture listener that stops before the global shortcut, and focus returns explicitly to the originating row (or the mobile sheet handle). Modal edit, assign and discard flows keep the Radix `Dialog` primitive, which traps focus and restores it itself. Trade-off: the drawer must manage focus, Escape and announcements by hand; the alternative is a modal drawer that hides the map the user is working on.

At `lg`–`xl` the open drawer hides the left vehicle panel without changing the saved preference; at `xl` both may be open. The panel toggle stays visible with `aria-disabled` and the reason "Close the vehicle drawer to show the list.", and the `[` shortcut shows the same reason as a toast. The KPI's right edge moves to 444px while the drawer is open, and fit/fly padding adds the drawer width (444px) so the selected marker is never hidden under it. The camera flies with padding whenever the drawer selection changes, even when the marker is already in view; without the drawer the old "only fly when off-screen" behaviour stays.

`PATCH /vehicles/{id}` accepts `sim_number`, `device_model` and `protocol`, but staging's `GET /vehicles/{id}` never returns them (and `last_seen_at` is absent too). The drawer shows `—` for the device fields with one explanatory line, and the edit form groups them as "Device (write-only)" and sends them only when the operator changes them. A reconciled read cannot confirm these three fields; `reconcileVehicle` returns `unknown` when they are the only changes. Trade-off: the operator cannot verify a device edit; omitting the fields from the form would fail the slice's "all `VehicleUpdate` fields" requirement, so the limitation is made explicit instead.

`driver_id: null` is dropped by staging and the server returns `400 invalid_request: no fields to update`; unassignment is impossible through this API. The assign dialog only offers active drivers, keeps the current driver selected, and has no "no driver" option. The edit form's driver combobox behaves the same way. Trade-off: operators cannot clear a driver; the alternative would be a control that always fails.

The edit form computes a **diff-only** payload against the captured original. The server rejects an empty object, so Save is disabled with "No changes to save." and no request is made. A changed `driver_id` also invalidates `["drivers"]`; every successful write invalidates the detail, the `["vehicles"]` root and `["live-snapshot"]`. The administrative status is a separate field labelled "Administrative status" and is never combined with `getVehicleStatus()`; an unknown server status appears raw in details and must be replaced with a known value before saving. Year cannot be cleared because the API drops nulls.

Write outcomes are uncertain, not failed, once the request may have been sent. `useVehicleWrite` marks network and timeout errors as unknown and calls `useActionError`'s `reconcile` hook, which refetches the vehicle and compares the intended readable fields: all match → treat as saved and invalidate; a mismatch → "It wasn't saved. Try again."; a failed reconcile → "We couldn't confirm that it saved. Check the vehicle before trying again." A CSRF failure is retried once by the API client before this layer sees it. Mutations are never auto-retried and the form is never optimistically updated.

Vehicle events have two real shapes: geofence events use `kind: "geofence"` with `type: "enter" | "exit"` and a `name`; alert events use `kind: "alert"` with an alert type plus `severity`, `status` and `evidence`. The parser branches on `kind`, keeps unknown kinds/types/enums for the neutral fallback, drops only rows without `at`, `kind` or `type`, and sorts newest first because the server order is not contractual. The detail requests the last 24 hours with `from` only, displays the 20 newest, and says "Showing the 20 most recent of the latest 500." when a page reaches staging's undocumented 500-row cap. There is no paging, total or range picker. Trade-off: a very busy vehicle shows only its newest 20 events from at most 500; the alternative would be inventing a paging contract the API does not have.

The searchable driver select is a local `Combobox` primitive (ARIA 1.2 combobox/listbox, 44px options on touch) rather than a native `<select>`, because staging has duplicate driver names and the option must carry phone and licence. It is added to `/styleguide` and §10.9; no dependency was added. The value flash is a 600ms `--animate-flash` remount (`LiveValue`) rather than a timer, so it cannot leak and disappears under reduced motion.

## 2026-11-07: Cloudflare Workers hosts the console and proxies the API

The frontend is a client-side Vite SPA. It is deployed to Cloudflare Workers with static assets, and a Worker proxies `/api/*` to the fleet API. The alternative was Vercel, which can rewrite the HTTP calls but cannot carry a long-lived WebSocket through a static rewrite; its Function WebSockets are in public beta and capped at 300 seconds on Hobby and 300–800 seconds on Pro. The console keeps the socket open for a whole shift, so Workers is the appropriate host.

The API contract drove this. It is same-origin only: `docs/api/frontend-integration.md` says there is no CORS, the session cookie is host-only, and `FleetApiClient.liveUrl()` builds the socket from `window.location.origin`. Serving the SPA and `/api/*` from one Worker origin preserves both without application changes.

On 2026-11-07 staging answered the WebSocket handshake with `403` for `Origin: https://console.example.com` and `Origin: http://localhost:5173`, and `101` for `Origin: https://fleet-demo.165-232-96-216.sslip.io` and for no `Origin`. The documented `WS_ALLOWED_ORIGINS=localhost:*,127.0.0.1:*` is therefore not what the running backend enforces; the local dev server works only because its proxy rewrites `Origin` to the staging origin. Until the deployed origin is added to the backend allowlist, the Worker rewrites `Origin` to `API_ORIGIN` (`WS_ORIGIN_REWRITE=true`). Once the backend allowlists the console origin, the flag goes to `false`. This is a deliberate, temporary bypass of the backend's browser-origin check; the `SameSite=Lax` session cookie limits, but does not remove, the cross-site socket risk.

The login response sets `ftb_session` and `ftb_csrf` with `Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax` and no `Domain` attribute, so proxied responses are stored for the console host without cookie rewriting.

Trade-off: the Worker adds one hop between the browser and the API, and the console depends on the staging API until a production origin exists. It avoids a second backend, CORS changes, cookie-domain changes and a separate socket gateway.

## 2026-11-08: Alerts contract, filtering, acknowledge and rules

`GET /alerts` is the row contract and `GET /alerts/{id}` does not exist: staging returns a plain-text 404. The list is therefore the only read, a deep link resolves against the loaded feed first and then a one-off `GET /alerts?limit=500` lookup, and the detail cannot refetch a single alert. The alert id is an opaque string in the URL, not UUID-validated, so mock and future ids keep working.

The server accepts only `status` and `type`; `severity` and `q` are silently ignored with `200`. Severity and plate search are client filters over loaded pages. The page size is the API maximum (500), `Load more` appears only when the last page is full, pages are deduplicated by id, and the header shows open count from the shared `status=open` query plus the loaded count. It never invents a total. The status filter defaults to “All statuses”; the map toast opens `?status=open`.

Acknowledge is only for open alerts. Staging returns `404 {"code":"not_found","message":"open alert not found"}` for an already-acked, closed or unknown id, so a 404 is not assumed to mean “gone”: the client refetches the type-filtered list and distinguishes “acknowledged elsewhere” (status `acked`), “still open” (status `open`) and “no longer exists” (absent). There is no `acked_by`; the UI shows the `acked_at` time and never an actor name. A lost network/timeout write is reconciled the same way before reporting “It wasn't saved.” or “We couldn't confirm that it was acknowledged.”

Alert evidence has no coordinates for the observed types: geofence alerts carry `geofence_id`, route deviations `distance_m`. Position resolution uses evidence coordinates when a future type supplies them, otherwise history in a ±2 minute window at `30s` and the nearest point inside the window. No point means “Position unavailable”, never the vehicle's current position. A stale `geofence_id` degrades to “Unknown zone” and keeps the evidence id visible.

Alert rules replace the **whole** `config` object on `PATCH`, and staging validates nothing (it accepted strings, nested objects and `null`). The editor sends every original key, validates primitive numbers (finite, non-negative) and strings (non-empty) locally, keeps nested objects, arrays and null read-only, and keeps an unknown rule type read-only except for the enabled toggle. Unknown types and configs degrade to neutral, not an error.

Live alert frames remain unobserved: a 35-second staging capture produced 700 position frames and zero alert frames, and the documented frame lacks id, severity and plate. A frame is an announcement that invalidates `["alerts"]` and toasts; it never synthesizes a row. The row comes from the refetched REST list. The global toast is the single live announcer; the in-page “N new alerts” pill is a labelled button, so a scrolled operator is not announced twice. The 600ms new-row highlight uses `--animate-flash` and disappears under reduced motion.

The alert detail reuses `Drawer` with `placement="page"`: a 420px right panel at `md+` and a top-quarter sheet below `md`, leaving the page title and tabs visible. It is non-modal, moves focus to the close button, returns focus to the originating row, and stops Escape before the global shortcut. The design system previously defined only the map drawer; §10.6/§15 now record this placement, and `/styleguide` renders it. The static alert map is the same `FleetMap` with `variant="static"` and `label="Alert position"`, plus the shared attribution chip.

`EvidenceList` and its formatting helpers moved to `src/ui`/`src/lib`, and `MapAttribution` and `toMapGeofences` moved to `src/map`, so the vehicle drawer and alert detail share one implementation without a feature importing another feature. `openAlertCountLabel` moved to `src/lib/alerts.ts` for the same reason. The document title now accepts `number | string`, so a full 500-row open-alert page keeps `(500+)` instead of dropping the cap.

Trade-off: client filtering only covers loaded pages. With more than 500 matching alerts, a plate or severity miss says “No alerts match in the loaded alerts” and offers `Load more` rather than claiming there are none. The mock history handler shifts its committed points into the requested `from`/`to` window so the detail can demonstrate a real history position; production still requests the exact alert range.

## 2026-11-08: Playback route contract

`MapRoute` gained `cursorPosition: LngLat | null`, and `MapTokens` gained a `route` group (3px line, 80px chevron spacing, 7px cursor, 5px pins, 2px pin ring, Start/End labels from zoom 12). The cursor is a prepared position, so an adapter renders a smooth playback cursor without knowing the playback clock. The route line source is rebuilt only when the `points`, `gapAfterIndex` or `chevrons` references change; the route-point source (start, end, cursor) is rewritten on every cursor tick. The page must therefore keep the points and gap arrays referentially stable.

The route line draws contiguous solid runs, one dashed connector per gap, chevrons along solid runs, a filled start pin, a ringed end pin and a separate cursor. The cursor stays above the pins, and the pins above the line, so a stopped vehicle never hides the start marker. Trade-off: every adapter must implement the new field and token group; the contract stays declarative and provider-neutral, and a provider that ignores the cursor still draws an honest route.

## 2026-11-08: Playback contract, defaults and gap honesty

`GET /vehicles/{id}/history` returns `{data: Point[] | null, resolution}`. Points are `{t, lat, lon, speed_kph, heading_deg}` and ascending. An empty or unknown-vehicle range is `200 {data:null}`, not a 404, so Playback shows "No positions in this range" rather than "vehicle not found". A reversed or longer-than-seven-day range is `400 invalid_range`, which is now an allowlisted safe code so its message can be a validation detail. `resolution` omitted is raw, not downsampled; the default is therefore `30s` (241 points for 2h), Auto omits the parameter and every response's actual resolution is labelled. Invalid resolutions are accepted by staging but the UI only ever sends documented values. The custom dialog accepts local `datetime-local` values and sends UTC RFC 3339; it validates order and the 7-day maximum before any request.

A gap exists after point `i` when `t[i+1] - t[i] >= max(3 × median interval, 60s)`. The line after `i` is dashed, the timeline marks the band, the cursor stays on the last known point and the readouts show `—`; a straight connector across missing data is never presented as a route. `MapRoute.cursorPosition` carries the prepared cursor so the adapter can move it at 20fps while the route line stays static; the page keeps `points` and `gapAfterIndex` referentially stable and the adapter rebuilds the line source only when those references or `chevrons` change. The clock advances by clamped wall deltas times 1x–16x, commits at most every 50ms, pauses when the tab is hidden, and restarts from the start when Play is pressed at the end. Scrubbing pauses; stepping pauses and seeks to the exact point time. Reduced motion snaps the cursor and disables camera animation.

Events have no id in the API, so timeline keys combine kind/type/time/index. Events are fetched for the same range, clipped and sorted ascending; positioned markers are the pointer path and the Events menu is the non-overlapping keyboard/touch path. An events failure never hides the route. Playback has no writes, no role-gated actions and no live-store subscription. It uses the standard basemap and does not duplicate the map screen's style preference. Only ranges already in the in-memory query cache are available offline; Slice 13 owns persisted ranges.

## 2026-11-09: Playback control bar geometry

The playback bar has one control line at `md+` and two at narrow widths: the scrubber spans row one, and transport, speed and events share row two. Every transport button, the speed trigger, the events trigger and the scrubber use the same height token (`32px`, `44px` on touch) and share a bottom edge. The speed label lives inside the trigger ("Speed 2×") rather than above it; `Select` gained `labelPlacement="inline"` for that, keeping `aria-label="Playback speed"`. The scrubber's start/current/end readouts are inline with fixed minimum widths and tabular figures, so a changing clock cannot resize the track.

At 390px the full labels do not fit beside three 44px transport targets and 16px group gaps with the default select chrome. The speed select therefore uses a compact chevron and 8px inner padding below `md`, and the Events button uses 8px horizontal padding below `md`; both keep their full accessible names and are asserted to be unclipped. Trade-off: mobile controls are visually tighter than desktop, but no touch target or label is shrunk or truncated.

The Events menu is `320px` wide, capped at `60vh` with scrolling, uses 4px menu padding and 2px between two-line items (8px 12px item padding, 56px tall). Menu items use a minimum height rather than a fixed height and never shrink inside a scrolling menu, so a two-line row cannot be compressed into its neighbour. These values are enforced by `e2e/playback-layout.spec.ts` at 1440x900, 1024x768, 768x1024 and 390x844 in both themes, with 1, 5 and 40 events.

## 2026-11-09: One fixed-layout DataTable for every table

All tables use `src/ui/DataTable.tsx`. Column definitions carry the id, header, width, alignment, cell renderer and sortable flag. The table is `table-layout: fixed`; `min-width` is the sum of the declared widths, so column geometry cannot depend on which virtualised rows happen to be mounted. The table's own scrollport supplies vertical and horizontal scrolling, which lets the header and first column be sticky while the virtualizer uses one fixed row height.

Trade-off: a table needs a bounded height (for example `flex-1 min-h-0`) to be a useful scrollport. On narrow screens the table scrolls horizontally inside its container instead of hiding columns; that keeps one table shape and one set of widths at every viewport.

Tables no longer collapse columns below breakpoints. Hidden columns made header and cell geometry depend on the viewport and produced zero-width cells that the virtualizer still had to map. Plates and trip IDs keep a full-value column width and never truncate; every other truncating cell carries a native `title` with its full value.

The 44px touch target of an inline row action is rendered with symmetric negative margins so it does not raise the 36px row height. The virtualizer's fixed estimate therefore matches the rendered row.

## 2026-11-09: Playback event lane is the pointer target

Per-marker 44px targets cannot fit 40–60 events into the roughly 148px timeline left between the time readouts, so the event lane above the track is the pointer target. The lane is full width, 44px tall at touch breakpoints and 28px on desktop, with 8px dots centred inside it. Pointer input on the lane uses nearest-neighbour hit testing against event x positions; an exact tie jumps to the earlier event by `atMs`. Each event remains a real labelled button with roving tabindex and Enter/Space activation for keyboard and assistive technology, but the buttons have `pointer-events: none` so the lane owns pointing; dense ranges are never collapsed into ticks. The chosen event's label replaces the current-time readout while hovering or pressing. Dots and their invisible buttons are clamped 4px inside the lane at 0% and 100% so they cannot protrude over the time readouts. The track below remains the only pointer-seek surface, and the lane's fixed height keeps the control bar from resizing while events load.

Trade-off: keyboard users tab to one marker and arrow between events instead of tabbing through every marker; the Events menu remains the collision-free chronological list. Per-marker 44px boxes still exist for the touch-target check, but they overlap in dense ranges, which is harmless because they are not pointer surfaces.

## 2026-11-09: Trips contract

Probed staging as dispatcher, security and viewer. `POST /trips` accepts `vehicle_id`, `origin` and `destination` (all required) plus an optional `driver_id`, and always creates a `planned` trip even when a driver is supplied. Select all driver detail stays available for the Assign step. The response is `201 {id}` only, so the page reconciles a create by refetching `GET /trips?limit=500` and matching the exact vehicle, trimmed route and optional driver against a row that was not in the pre-submit id set. A full 500-row list with no match is an unknown outcome, not a failure.

`PATCH /trips/{id}` takes `status` and/or `driver_id` and returns `204`; an empty body is a no-op. Staging does not enforce transitions: completed-to-active, completed-to-cancelled and planned-to-assigned without a driver all returned `204`. The client therefore owns the matrix in `src/lib/trips.ts` and never offers an invalid action; a backend guard is a backlog item. `started_at` is set on `active`, `ended_at` on `completed` and `cancelled`, and completion computes `distance_km`; the client never sends distance or timestamps.

`GET /trips/{id}` does not exist (`405`). The detail drawer resolves from the loaded feed first, then from `GET /trips?limit=500`; a trip older than that shows the not-found state. The list returns no total and no contractual order, so the page reports `N loaded`, applies a deterministic client sort and offers `Load more` only on a full 100-row page. `status` is the only server filter.

Nullable `driver_id`, `driver_name`, `started_at` and `ended_at` arrive as JSON `null`; `distance_km` is always a number and is `0` before completion. The parser normalises nulls to absent, keeps unknown statuses for the neutral badge, drops only structurally invalid rows and throws only when every row is unusable. `distance_km` is shown only for completed trips, so an active trip never claims `0.0 km`.

`GET /drivers` ignores `limit` and `offset`; the create and assign dialogs load the full list and filter active drivers client-side. Duplicate names are common, so every driver option carries phone and licence. The shared helpers moved to `src/lib/drivers.ts` because this is their second consumer.

The default sort is operational: Active, Assigned, Planned, Completed, Cancelled, then newest start and plate. `Button` gained `disabledReason` (aria-disabled, blocked activation, focus ring, tooltip) instead of a fourth feature-local disabled action, and the state is shown on `/styleguide`.

Trade-off: the trips sort URL key is `order`, not `sort`, because TanStack Router merges search types across routes and the map already owns a different `sort` enum. The URL contract stays explicit and the map route is untouched.

## 2026-11-09: Trips row geometry

Trips exposed a 1px row-height drift in the shared `DataTable`: the last data row dropped its bottom border while earlier rows kept it, so a measured column set saw both 36px and 37px rows. Every data row now keeps its `border-b`, which makes the fixed 36px height uniform and preserves the contiguous-divider rule. The action buttons in a trip row keep their 44px touch target with symmetric negative margins (`-my-1.5`), so the row stays 36px on mobile while every control remains reachable.

Trade-off: the last row now draws a divider above the table's rounded border; the alternative was a per-table geometry exception that would break as soon as the last virtual row mounted.

The row-open plate button and the copy control also keep a 44px mobile target with symmetric negative margins, so the vehicle cell and the actions cell share the same 36px row geometry.

## 2026-11-10: Test tiers split the theme matrix

Playwright keeps four projects. Functional tests are untagged and run on `desktop-light` and `mobile-light`, so they still run only in the light theme. Visual and theme tests carry the native `@theme` tag (`{ tag: "@theme" }`); the light projects run the whole suite, so those tests still run in light, and the dark projects (`desktop-dark`, `mobile-dark`) run only the tagged set. The tagged set is the A9 set: screenshots, contrast, accents and axe. Locally Playwright uses CPU cores minus one workers and zero retries; CI uses one retry. `PLAYWRIGHT_WORKERS` overrides the local count when memory, not CPU, is the limit. The full gate stays `npm run e2e` (T3), with `e2e:fast` (T1) and `e2e:slice` (T2) for the build loop.

Trade-off: a functional test no longer runs in dark, while every tagged visual test still runs in both themes because the light projects keep the full set. Dark visual coverage comes from the `@theme` set. The split removes 338 of 948 selections (948 to 610) without deleting a test.

## 2026-11-10: Playback options live above the map; the bar is a docked bar

Supersedes the control-bar geometry in the 2026-11-09 entry. Playback now separates options from transport. A floating panel under the top bar holds one row: back link, the vehicle trigger (plate, truncates), the range trigger (short preset label, truncates) and a right-aligned tools cluster of `Events` and `Fit route`. The tools are icon-only 44px targets below `md` and icon-plus-label targets from `md`; both carry tooltips, sit 8px apart and keep their right edge 12px from the viewport. A muted info line under them carries the resolution control, the response resolution, the point count, the live speed/heading on touch widths and the offline badge; the text truncates before the badge.

The bottom controls are a docked, full-width bar with a top border and 12px horizontal insets. Below `md` it is two rows: the events lane, scrubber and start/current/end readouts span row one, and a centred `nowrap` group of transport plus speed sits in row two (8px inside transport, 16px between transport and speed). From `md` it is one row: transport, the speed/heading readout, the flexible scrubber and speed, all sharing a bottom edge. The range trigger shows `30 min`/`2 h`/`6 h`/`24 h`/`Custom` while its menu keeps the full preset names. The resolution control intentionally stays at 44px on touch widths, which makes the info line taller there; the alternative was a sub-44px control or moving it out of the one info line.

The events menu is now `min(320px, 100vw - 24px)` wide with 12px collision padding, so it fits 320px viewports; at wider widths it keeps the previous 320px width. A long development-only snapshot label (`?labels=long`) exercises plate truncation. Trade-off: the top panel spans the content width rather than a compact card, which is what keeps the tools pinned to the viewport edge and prevents the triggers from pushing them out.

While offline, playback queries are disabled instead of attempted. Previously `networkMode: offlineFirst` still made the first request, so a mocked transport could answer a range the in-memory cache did not hold. Disabling the query makes "only ranges already in the cache are viewable offline" true for both real and mocked transports; the cached range stays on screen, and going back online re-enables the query.

## 2026-11-10: One layer scale, one overlay root, and a banner in flow

Layering was decided per component: four CSS utilities (`z-banner` 35, `z-menu` 50, `z-dialog` 60, `z-toast` 70), 26 numeric Tailwind classes from 0 to 40, and Radix portals that inherited whichever stacking context rendered them. The measured result was not one order. The user menu and its tooltip were portalled into the `<header>`, so both were trapped at the header's z-index 40 while the tooltip shared the menu's layer 50; a map tooltip at 50 in the root stacking context could paint over the user menu, and a toast at 70 over both. The dialog footer carried `relative z-menu` to beat the combobox list, and Radix's dialog transform kept the list inside the dialog's stacking context. The page drawer used `position: fixed` against the viewport, so a banner in flow above it was covered on the alerts and trips screens. The banner was already in flow on the map screen, which disproved the "banner is fixed" hypothesis there, but it still carried a meaningless z-index and had no single priority rule or collapse.

The shell is now `h-dvh` flex column: top bar, banner region, then a content area that is `relative isolate flex-1 min-h-0`. The banner region is a CSS grid whose track goes from `0fr` to `1fr` with `--motion-slow`, collapses to zero when no banner exists, and renders only the highest-priority banner in this order: session expired, offline, unavailable or storm, reconnecting, update. The session-expired banner is the message behind the blocking re-sign-in dialog, not a second action. The content area's isolation keeps map, controls, panels, drawer and sheet from ever painting above the top bar or an overlay.

`src/ui/layers.css` is the only source of z-index: map 0, map controls 10, panel 20, drawer 30, topbar 40, dialog 60, popover 70, toast 80, tooltip 90, exposed as `@utility z-*` and consumed only by name. `npm run guard` fails on a numeric or arbitrary z-index class or a `z-index` declaration anywhere else. Every Radix portal (dialog, dropdown menu, tooltip, toast) and the combobox list renders through `LayerPortal` into `#overlay-root`, one container per layer. The popover layer is deliberately above dialogs so a menu, select or combobox opened inside a dialog covers its content and footer. A combobox list is positioned in fixed coordinates from its input and flips above when there is not enough room below.

The page drawer now portals into a `#content-overlay-root` inside the content area and uses absolute positioning, so a banner pushes it down exactly as it pushes the map. The mobile sheet's maximum height and the 80px full-snap strip are percentages of the map surface, and `--map-inset-*` is published on that surface; no `100dvh` term remains.

Trade-offs: the banner region is the one intentional layout animation, which departs from the rule that layout is never animated; it exists because every content-anchored overlay must reflow with the banner, and reduced motion disables it. Overlay containers stay exposed to assistive technology while a modal dialog is open (Radix hides all siblings), because a portalled menu or listbox is part of the dialog; the dialog's focus trap, not the layer stack, owns modality. Page drawers are now inside the shell content area rather than the browser viewport, so a future full-screen or immersive page would need its own root. `e2e/measure/layers.ts` remains the diagnostic, and `e2e/layers.spec.ts` enforces the invariants at 1440x900, 1024x768, 390x844 and 360x640 in both themes.

## 2026-11-10: One search field, and every picker list is an overlay

The plate/IMEI search and the pickers had drifted: the vehicle list's icon sat at `left-4` with `pl-10` and a 56px trailing inset, while the combobox used `left-3`/`pl-9` and a 36px inset. They now share `src/ui/SearchField.tsx`: the icon and the optional trailing slot are flex-centred inside the same relatively positioned control as the input, which is why the icon can no longer be left behind when anything around it reflows. `SearchInput` (debounce, clear, `/` hint) and `Combobox` (chevron) are thin compositions of that field.

The combobox list is portalled into the popover layer and measured in fixed coordinates from the input. Opening it therefore cannot change the input's or the dialog's bounding box; the original defect was the list rendering in the flow of a vertically centred dialog, which grew the dialog and re-centred it. The available space comes from `visualViewport` when it exists, so the list stays inside the visible area while the software keyboard is open, and it listens to `visualViewport` resize and scroll, not just `window`. Width is the input's width with a 240px floor, clamped to the visual viewport; height is capped at 256px and at the space between the dialog's close button and its footer, so those controls stay hit-testable and are never covered.

The first `Escape` closes only the list. Radix listens for Escape with a capture listener on the document, so the combobox stops the event at the window in the capture phase while the list is open; the second Escape then reaches the dialog. Focus stays in the input throughout.

Trade-off: in a compact dialog the input sits between the title row and the footer, so the list can be short (about 40–60px on a 360px viewport) and scrolls. The alternative was to cover the close or footer buttons, which the invariant forbids. `e2e/measure/combobox.ts` is the diagnostic; `e2e/combobox-layout.spec.ts` enforces the geometry at 1440x900, 390x844 and 360x640 with the keyboard emulated, with 3, 25 and 500 options, and `e2e/combobox-pickers.spec.ts` proves the invariant for the Playback, assign-driver and edit-vehicle dialogs.

## 2026-11-11: Drivers are a client-filtered, client-sorted list

`GET /drivers` returns the whole tenant in `{ data: [] }` and ignores `status`, `q`, `limit` and `offset` (verified on staging with dispatcher, viewer and security roles). The page therefore fetches once, filters by name/phone/licence and administrative status in memory, and sorts by name, then phone, then licence with `localeCompare`. The server's duplicate-name tie order is unspecified, so the client sort is what stops rows swapping between refetches. Trade-off: a tenant with thousands of drivers needs a server filter and paging, which this slice does not build; the client filter keeps typing instant and works offline.

## 2026-11-11: Driver status is an open string, and empty contact fields are `""`

Staging returns only `active` and `inactive`, but the parser keeps any non-empty status so one future enum cannot blank the list; the badge and the drawer fall back to `Unknown status: {value}`, and the edit form keeps an unknown current status selectable so a phone change does not force a status change. `phone` and `licence` arrive as `""` when omitted, never `null`; the parser normalises missing/null to `""` and the UI renders `—`. `vehicles` is required by the parser because every staging row has it; a missing count rejects that row rather than rendering a false zero.

## 2026-11-11: The driver drawer joins assignments from the live snapshot

There is no `GET /drivers/{id}` and no driver detail endpoint, so `?driver=` resolves from the full list and an unknown id is a client-side not-found state. The table's "Vehicles" column uses the server's `Driver.vehicles`; the drawer lists snapshot vehicles by `driver_id` because that is the only source with plate and depot. `SnapshotVehicle` now carries `driver_id`, which staging already returns but the previous parser dropped. When the two counts differ, the drawer shows both and labels the list as the current snapshot instead of presenting a stale join as the server's count.

## 2026-11-11: Driver writes are pessimistic and diff-only; deactivation keeps assignments

Create sends only `{name, phone?, licence?}`, omitting blank optional fields; the server trims and defaults the omitted ones to `""`. Edit sends only changed fields, and a cleared phone or licence is sent as `""` because the server treats that as an explicit clear; an unchanged form never sends the empty body staging rejects with `no fields to update`. Deactivating a driver with assigned vehicles asks for confirmation and names the count, but the API allows the change and keeps the assignments, so the confirm is a client guard against accidental loss of availability, not a server rule. There is no delete endpoint; the UI offers no delete action.

An edit `404` keeps the form open with the error and a Refresh action while the list refetches, so the operator can see that the driver is gone; an unknown outcome reconciles against a fresh list before anything is reported. A rename or phone change is denormalised into snapshot vehicles immediately (verified on staging and restored afterwards), so an update invalidates `["drivers"]`, `["live-snapshot"]`, `["vehicle"]`, `["vehicles"]` and `["trips"]`. Create invalidates only `["drivers"]`. The list refetches on mount and window focus but does not poll: drivers are administrative state, and a background interval would add traffic without a live requirement.

## 2026-11-11: React Hook Form components opt out of the React Compiler

The Vite build compiles components with `babel-plugin-react-compiler`. In the browser, a form whose only reactive read of `formState`/`useWatch` came from the compiler-memoized render never re-rendered: the status select showed the new value while `isDirty` stayed false and Save remained disabled. The same component passed in Vitest because the test pipeline does not run the compiler. Both Driver dialogs now start with `"use no memo"`, which the compiler treats as an opt-out; other react-hook-form components should do the same until the upstream interaction is fixed. Trade-off: those components lose compiler memoisation, which is negligible for a dialog.

## 2026-11-11: The page drawer resolves its content root after commit

`ContentPortal` used to resolve `#content-overlay-root` in a `useState` initializer. A route that opened a page drawer on its first commit (a `?driver=` deep link) ran before the shell had committed its content area, so the portal fell back to a body-level container. The drawer then painted over the top bar and the close button was unreachable behind the account menu. The portal now looks the root up in a layout effect after commit and only uses a body fallback when no shell exists (component tests). The Drawer focuses its close button from a ref callback as well as the open effect, because the panel can now mount one commit later.

## 2026-11-11: A cancelled driver write is an uncertain outcome, and Retry waits for the reconcile

The write dialogs offer Cancel and Retry on the 10s slow notice, but a mutation cannot be "unsent". Cancel aborts the request and reconciles against a fresh `GET /drivers` before reporting anything, so an aborted create that did land shows "It was saved." instead of implying nothing changed. Retry aborts the current attempt, reconciles it, and re-sends only when the reconcile proves it did not land (`outcome: failed`); a reconcile that reports saved ends the operation, and one that cannot reach the server keeps the honest "We couldn't confirm that it saved." state rather than risking a duplicate. Trade-off: Retry adds a list refetch before the second attempt, which is the price of not double-creating a driver.

## 2026-11-11: Geofences are a full-tenant, client-filtered list

`GET /geofences` returns the whole tenant in `{ data: [] }` and ignores `q`, `limit` and `offset` (verified on staging with `dispatcher@demo.ftb`, `viewer@demo.ftb` and `security@demo.ftb`). There is no `GET /geofences/{id}` (`405`), so `?selected=` resolves from the loaded list and an unknown id is a client-side not-found notice. Search and sort are client-side; the client sorts by lowercased name then id so rows cannot swap between refetches. Trade-off: a tenant with thousands of geofences would need server search and paging, which the API does not offer today.

## 2026-11-11: Geometry is validated and ordered by the client

Staging accepts coordinates only as `[lon, lat]`, requires a closed ring with at least three distinct vertices, no self-intersection and non-zero area, and rejects those on `POST` as `400 invalid_geometry`. `PATCH` has a server quirk: an unclosed or two-vertex ring returns `404 not_found` even though the geofence exists, while a `LineString` returns `400 invalid_geometry`. `PATCH` also stores swapped `[lat, lon]` values without complaint. The client therefore closes the ring, checks distinct vertices, self-intersection, area and finite in-range coordinates, and always emits `[lon, lat]` before every create and update, so the operator gets a precise shape message instead of a misleading `404`. Trade-off: the same validation exists on both sides; the client copy is the one that can name the exact problem.

## 2026-11-11: Geofence names are trimmed, duplicates are allowed, and writes are diff-only

The server stores names verbatim (including surrounding spaces) and allows duplicate names. Create sends `{name: trimmed, kind, geometry}`; `kind` defaults to `other` when omitted, and an unknown kind returns `400 invalid_kind`. Edit sends only changed fields among trimmed name, kind and a geometry that differs within a small epsilon; an unchanged edit sends nothing, because an empty `PATCH` returns `400 invalid_request`. The form always offers the four real kinds. Trade-off: reconciliation cannot match a create by name alone; it requires a new id plus trimmed name, kind and geometry.

## 2026-11-11: Delete refusal is the real `in_use` code

`DELETE /geofences/{id}` returns `204` when no events exist and `409 {"error":{"code":"in_use","message":"geofence has events and cannot be deleted"}}` for `Refinery Gate`. The earlier mock and catalog used a fictional `geofence_has_events`; they now use `in_use`. The dialog owns the fixed headline “This geofence has recorded events and can't be deleted.” and shows the server wording only as the detail line. Trade-off: the server's lowercase wording is quoted as-is; the headline carries the user-facing sentence-case copy.

## 2026-11-11: Terra Draw sits behind the DrawController and is imported on first use

`DrawController` gained async `start(kind, ring?)` and `cancel()`. `stop()` commits and leaves draw mode; `cancel()` discards and emits `null`. The MapLibre adapter owns Terra Draw (`terra-draw@^1.39.0` plus `terra-draw-maplibre-gl-adapter@^1.5.0`, both approved), and the library is dynamically imported inside the first `start()`, so the map screen never downloads the draw chunk. Features see only the controller. A capture-phase keyboard guard stops draw keys when the event target is an input, select, textarea or contenteditable. Trade-off: the contract grows by one method and the first draw has a short preparing state; the alternative is a larger map bundle for every screen.

## 2026-11-11: The selected geofence gets an accent halo, not a replacement stroke

The selected polygon gets an accent halo under its normal kind stroke. Recolouring the whole polygon would destroy the kind's colour and pattern meaning. The halo uses `--accent` and leaves the `--gf-*` colours intact; the unsaved polygon is a separate adapter source with a 12% accent fill and a 2px dashed accent stroke. Trade-off: one extra line layer and a little more paint work, negligible for a tenant-sized geofence list.

## 2026-11-11: The geofence map is a stacked split on mobile

At `lg` and above the list is a fixed 360px panel beside the map. Below `lg` the same split reflows vertically: the map takes the upper flex region and the list takes a fixed `basis-2/5` lower region. This page's list is a page panel, not the map screen's floating vehicle panel, so the draggable bottom sheet is deliberately not reused. Trade-off: the mobile list shows fewer rows and the map is smaller than a full-bleed sheet, but there is no overlay, no new shared sheet primitive and the drawing surface stays visible.

## 2026-11-11: The geofence slice changes shared code, so T3 is a merge gate

This slice changes `src/map` (contract, MapLibre adapter, FakeAdapter, layers, tests) and `src/ui` (`SearchInput`), so the full `npm run e2e` (T3) must run before merging. The agent ran T2 for the four geofence specs; the human runs T3 in a second terminal or CI. Trade-off: the slice's own T2 is clean but cannot prove the map screen or other pages were unaffected.

## 2026-11-11: Terra Draw paints only handles; an interrupted session says so

The unsaved polygon has exactly one visual owner: the adapter's `draw` source and layers (12% accent fill, 2px dashed accent stroke). Terra Draw's polygon and select modes now use zero fill and outline opacity, so its solid outline can no longer paint over the dashed overlay or double the fill. Handles stay visible because they are the editing affordance.

A rejected draw-library import now clears the cached `ready` promise, so Retry performs a real second import instead of re-awaiting the same rejection. When the map adapter is replaced while a session holds geometry, `useGeofenceDrawing` keeps the last ring, marks the session `interrupted` and shows “The map reloaded. Draw the polygon again.” with Retry; if the map is simply unavailable (offline), the copy says to reconnect and the session resumes automatically when the adapter returns. A style or theme swap that cancels an incomplete draft shows “Drawing was cancelled. Draw the polygon again.” rather than silently dropping points. Trade-off: the hook grows a small interruption state machine; the alternative was silent geometry loss on a map retry or a theme change.

## 2026-11-11: Import results are honest about their server facts

Staging returns `200` with `{job_id, total, imported, failed, errors}`; a clean import sends `errors: null`, not `[]`. `row` is the 1-based CSV line number **including the header**, and `failed` can exceed the 100 entries in `errors`. The client therefore treats `errors` as nullable, says `Showing the first 100 of N row errors` when the cap applies, and keeps the row-number hint under the table. The server accepts any filename or MIME type and validates content, so the client owns the `.csv` contract. A row with driver columns creates a driver and links it to the vehicle, which is why a successful import invalidates `["drivers"]` as well as the fleet.

`invalid_csv` is a real `400` code with a display-safe message (`could not read the header row`, `the header must include imei`). It is now in the catalog's allowlist and has its own branch, because the generic `validation` headline ("Check the highlighted fields") is wrong for a whole file. `invalid_request` means the multipart field was missing, not that the user's file is bad, so the import screen keeps its own generic copy and never shows the multipart wording. Trade-off: the catalog grows one code-specific branch; the alternative was a misleading form-error headline or raw server text.

## 2026-11-11: Import preview is local, bounded and comma-only

The picker reads only a BOM probe plus Papa Parse's `preview: 6` window, so a 5,000-row file never parses in full before upload. The delimiter is forced to comma: guessing semicolons would hide a file the server cannot read. The first parsed row is the header; normalisation trims and lowercases it for checks but the preview displays the user's original names. A missing `imei`, an empty file, a header-only file and unreadable quoting block upload with an inline `role="alert"`; unknown and duplicate headers only warn, because the server ignores or resolves them. A stale parse result is discarded by a request id, so a fast second selection always wins. Trade-off: no total row count is shown, because counting the full file is neither cheap nor needed for a five-row preview.

## 2026-11-11: Import history is device-local and wiped with the session

There is no import job endpoint, so "Recent imports" is one IndexedDB entry through `idb-keyval`, newest first, capped at five, labelled `This device` and accompanied by the sentence that the server has no import history. Entries are Zod-validated on read and corrupt rows are dropped. A storage write after a successful import never fails the import: the result stays on screen and the list shows one notice with Retry, even when the device had no earlier entries, and Retry repeats only the local write. The store is bound to a user by a second `idb-keyval` entry, `fleet.import-history-owner`, claimed on the first authenticated user of every load; when the stored owner differs the store is cleared before the list renders, so a fresh tab after a session expired cannot show another operator's file names. `AuthProvider` additionally clears the store and the query cache on logout and on a same-mount user switch. Trade-off: history does not follow the user to another browser; that is the honest version of the brief's "keep previous jobs if cheap".

## 2026-11-11: An unanswered import is safe to upload again

The upload is one pessimistic multipart request with the approved 120 s timeout. A network failure or timeout after sending is reported as `We couldn't confirm the import. It's safe to upload again.` and is not reconciled against a server job list, because re-uploading the same file is idempotent by the probe. HTTP `4xx`/`5xx` responses are certain failures and are not labelled unknown. Cancel aborts and restores the valid preview with `Upload cancelled`; Retry aborts the settling attempt and the caller's original upload promise settles with the replacement attempt's outcome, so a retried success is shown, recorded and focused exactly once. A successful import invalidates exactly `["vehicles"]`, `["vehicle"]`, `["live-snapshot"]`, `["drivers"]`, `["reports"]` and `["system-health"]`; trips, alerts and geofences are untouched. Trade-off: a genuinely lost response that did land still asks the operator to upload again, which is safe but may update rows twice; the alternative was a nonexistent job probe.

## 2026-11-11: The import mock executes the CSV instead of returning a fixed fixture

The MSW handler parses the uploaded CSV with Papa Parse, enforces the `imei` header, validates years, counts rows including the header line, caps returned errors at 100, creates named drivers, and upserts vehicles by `external_id` so the onboarding hand-off to the map search is testable. The parsing/upsert body is exported as `applyMockImport` and unit-tested directly, because jsdom's `File` cannot satisfy Node's `Request.formData()` adapter; the HTTP wrapper is covered by Playwright in a real browser. `@types/papaparse` is a dev-only type package for the approved `papaparse` runtime dependency. Trade-off: the mock mirrors a small part of the backend's validation, which is acceptable because the Playwright specs need deterministic partial failures.

## 2026-11-11: The report summary contract is stricter than the API and more tolerant in one place

Probed against staging: `GET /reports/summary` returns the seven documented numbers plus an undocumented `from`/`to` echo, and `alerts_by_type` rows whose `key` is an open string (the demo tenant is already sending a value outside the client enum). It also answers `200` for date-only, reversed, equal and malformed ranges by silently substituting its own defaults, and enforces no maximum duration (365 days returned data). The client therefore always sends explicit `Z` instants, validates strict RFC 3339 and order before any request, caps nothing, and treats `from`/`to` as optional echo metadata. The seven core numbers are required and a mismatch is a `contract` error; a malformed `alerts_by_type` row is dropped and counted instead, because one bad chart row must not blank an otherwise usable report. Unknown keys render through `alertTypeLabel` as `Unknown type: <key>`. Trade-off: a malformed row is silently invisible after the diagnostics entry; the alternative was losing the whole report.

`vehicles` is the whole-tenant fleet total (it stayed 33 in a future range), so the cell says `Fleet total` and links to the map. Trips, completed, active, alerts and open alerts are range-scoped, but Alerts and Trips have no date filter, so the links open the full lists and the page states that in one line. No range-scoped vehicle count is invented.

## 2026-11-11: The report refetches on return, and a cached refresh failure stays readable

`useReportSummary` sets `staleTime: 0`. The global client uses 30 s, which is right for live rows but wrong for a historical aggregate: returning to Reports within 30 s showed figures the user might reasonably believe were recomputed. With zero, a remount refetches and a failed refresh renders `Couldn't refresh · Retry` above the cached numbers plus the stale badge, matching the error-handling rule that cached data beats an error. Trade-off: a remount always costs one request; the report has no polling, so this is the only refresh path.

## 2026-11-11: The custom-range dialog is shared, not duplicated

Playback already had the local-time-to-UTC dialog and Reports needs the same control, but features must not import each other. The control moved to `src/ui/DateRangeDialog.tsx` and `src/lib/datetime.ts`; the caller supplies the validation rule (playback keeps its seven-day cap, reports validates format and order only) and the dialog owns the fields, error-to-field mapping, focus and focus return. Playback's `CustomRangeDialog` is a thin wrapper with unchanged props and labels. The shared dialog is on `/styleguide`. Trade-off: one more shared primitive and one more touch point in shared code, which makes the full e2e suite a merge gate for this slice.

## 2026-11-11: Report mock scenarios are opt-in, range-echoing and dev-only

The MSW handler echoes the requested `from`/`to` and selects `zero`, `large`, `no-breakdown` or `bad-row` from the mock-only `fleet.mockReports` key. The key is read only inside the mock; production code has no scenario switch. The `large` fixture carries an unknown alert key and a zero-count row so the chart's fallback and zero filtering are exercised without a separate fault kind, and `bad-row` proves one malformed chart row degrades without losing the report.

## 2026-11-11: Reports keeps one-line stats, a re-armed default and a matching skeleton

The default-range guard re-arms whenever the URL has a range, so clearing the range in place (the active Reports nav link or `g r`) writes the seven-day default again instead of leaving the page on its skeleton with no request. The stat strip stays one line at every width: `formatDistanceCompact` switches to `128k km` / `1.3M km` at 100,000 km and above, because the exact `1,284,933 km` wraps at the 28px stat size on mobile; distances below that threshold keep `formatDistance` and its thousands separators. The chart's value column is `min-w-14`, so a seven-digit count widens the column and shrinks the bar instead of overflowing, and the chart card and its skeleton share `min-h-48` plus the same row and summary structure so the two heights agree. Trade-off: the compact distance is rounded, which is acceptable for a summary KPI but would not be for a trip row; trip and vehicle surfaces still use the exact formatter.

## 2026-11-12: The health contract is strict on core fields and tolerant of additions

Probed against staging as all four demo roles: `GET /system/health` returns `200` for each role, `401 unauthorized` without a session, and a fixed shape with six top-level fields and eleven numeric `ingest` counters. `dependencies` is an object of booleans keyed by service name. `openapi.yaml` declares only `type: object`, so `systemHealthSchema` is the executable contract: the six top-level fields and the known ingest numbers are required, `ingest` stays loose so a new counter cannot blank the screen, and `dependencies` stays `record<string, boolean>` so a new service is accepted. A missing or wrongly typed core field is a `contract` error, never an optimistic `—`. Unknown dependency keys are humanised (`postgres_replica` becomes `Postgres replica`); unknown ingest keys are ignored. Trade-off: a genuinely malformed core number takes the whole screen to an error, which is the correct choice for the screen that answers "is it healthy".

## 2026-11-12: Health rates use sample timestamps and deltas belong to this page visit

The payload has cumulative counters only, so `useHealthTrend` records the first sample at or after mount and the sample before the current one. A delta is `current - first` and a rate is `current - previous` divided by the elapsed time between those two samples' `dataUpdatedAt`, never the render clock or the shared 30-second display ticker. Using the ticker was a real defect caught by the rising-counter e2e: the ticker can be older than the previous sample, which made the interval negative and left the hint at "Measuring…". Cached data older than the mount is displayed but never becomes the baseline, and a decrease in `received` re-baselines and shows `Reset` for one sample. Trade-off: the first sample has no rate and honestly shows "Measuring…".

No thresholds are invented. A dependency reported down is critical; a failure counter (`dropped`, `stale`, `validation_errors`, `coldpath_failed_*`, `redis_errors`) is warning only while its delta since the page opened is positive, even if its historical total is nonzero; a queue is critical at or above capacity, warning while rising below it, and healthy while steady; the two cold-path queues warn while rising. Fleet counts and `received` are informational. `Last vehicle report` uses `getDataFreshness` from `src/lib/status.ts`, so the bands are the same ones the map uses.

## 2026-11-12: The fleet's last report replaces the missing health timestamp

The health payload has no `last_seen_at`, no timestamp and no device field, although the demo story asks for device last-seen. The Fleet group therefore shows `Last vehicle report` from `useConnection().lastDataAt`, which is seeded from the newest snapshot `recorded_at` and updated by live frames, and labels it as the fleet's newest report with a clock hint. It is never presented as a per-device value; the vehicle drawer remains the per-device source. Trade-off: the item is a fleet fact, not a health-payload fact, and the description says so. A separate per-device last-seen needs a backend field.

## 2026-11-12: Health status is a dot plus text, and Can't reach the API is a title override

Every item has a 16px status dot with an icon and an accessible name (`Healthy`, `Warning`, `Critical`) plus the label and value, so status is never colour alone. The dot composes the existing status tokens; no token was added. Non-healthy items sort first inside their group, and the page summary is the only live region (`All systems healthy` or `N issues need attention`). The Dependencies and Fleet strips use the default `Stat`; Ingest uses the compact `Stat` because eight-digit cumulative counters would wrap at 390px, and it includes the payload's undocumented `redis_errors` and two cold-path counters so the screen cannot report all-green while those are rising. `ErrorState` gained an optional `titleOverride` used only by this page for `Can't reach the API`; the catalog's detail, action and diagnostics still apply, and contract errors keep their own title. The screen is read-only for every role and has no stat links, because navigating away would imply thresholds the API does not define.

## 2026-11-12: Audit is an untyped endpoint, so the parser is the contract

Probed against staging on 2026-11-12: `GET /audit` returns `{ data: AuditEntry[] }` with `id` (number), `action`, `entity`, `entity_id`, `user_name`, `metadata` (object) and `created_at` (RFC 3339 UTC). `openapi.yaml` declares only `type: object`; there is no entry schema, no action or entity enum and no actor id. Admin and security get `200`; dispatcher and viewer get `403 forbidden`; no session gets `401 unauthorized`. The client therefore validates row by row through `parseAuditResponse`: `id`, `action`, `entity` and a valid `created_at` are required, `entity_id` and `user_name` normalise to `""`, and `metadata` normalises to `{}`. A malformed row is dropped and counted; a page where every non-empty row is malformed raises `contract`. The strict `auditResponseSchema` stays for the committed fixture and schema tests. Trade-off: a bad row can be invisible in the table, but the alternative was blanking a security log because one new action row changed shape.

## 2026-11-12: Audit filtering is client-side, paging is 100 rows and there is no total

Staging ignores `action`, `entity` and `q`, accepts `limit` and `offset`, defaults to 100 rows, caps customer use at 500 and returns no total or count header. It also silently falls back to 100 for `limit=501`, `limit=abc` and other overly large or malformed values. The page sends 100-row pages, offers `Load more` only when the last page was exactly full, never renders a total, and filters by action and text over the loaded pages. The action options are derived from the loaded rows and an active value stays in the list after a refresh removes it. The empty state distinguishes no data, no results across all loaded pages, and no matches with more pages available. Trade-off: a match older than the loaded pages requires `Load more`; that is the honest behaviour of an API with no filters and no total.

## 2026-11-12: Audit refreshes on open, focus and Refresh, never by polling

An audit log is a security record, not a live feed. `staleTime` is zero and the query refetches on mount, on window focus and on the Refresh button; there is no interval and no socket subscription. A page response is flattened by `String(id)`, preserving the newest copy, because a refresh shifts offsets and overlapping pages would otherwise duplicate rows. The screen is read-only, uses no CSRF and has no mutation or reconcile path. Trade-off: a brand-new entry waits for a focus or a click instead of appearing by itself.

## 2026-11-12: Audit deep links resolve from loaded rows, then one 500-row lookup

There is no `GET /audit/{id}`. `?entry=` first resolves from the loaded feed, then from a single `limit=500&offset=0` lookup. An id outside the newest 500 rows gets a not-found drawer with `It may be older than the 500 most recent entries.` rather than a route 404. The drawer is the shared page panel; it shows `user_name` exactly as returned and never invents an actor email or role because the entry has none. Trade-off: the oldest entries cannot be deep-linked until a single-entry endpoint exists; the limitation is in `docs/backlog.md`.

## 2026-11-12: Audit is deliberately absent from offline persistence

The audit screen is excluded from the Slice 13 persisted-query allowlist. In the same session, cached pages stay visible offline with the stale treatment; a cold offline load shows `Audit isn't available offline` and offers no failing Retry. Refresh and Load more stay visible but disabled with `You're offline.`. Trade-off: an operator cannot read the security log after a reload without a connection, which avoids persisting tenant-wide security records on a shared device.

## 2026-11-12: Audit colour carries no category

The table is neutral: text, muted secondary values, neutral copy affordances, and accent only for focus and selection. Action and entity types are not colour-coded because colour in this system means status or severity, and the audit log has neither. Unknown actions and entities are humanised from dots and underscores (`user.role_change` becomes `User role change`) while the raw token stays in the cell tooltip and the drawer. Trade-off: the screen reads as a dense log rather than a dashboard, which is its job.

## 2026-11-12: A drawer that mounts open defers its focus return

The audit page renders the shared page drawer only while `?entry=` resolves, so the drawer mounts already open. In development, StrictMode runs that open effect as setup → cleanup → setup; the cleanup's `returnFocus` handed focus back to the originating row and overrode the second setup's close-button focus. The shared `Drawer` now schedules the focus return on the next tick and cancels it when the open effect runs again, so a real close still restores focus and a mounted-open drawer keeps focus on its close button. Trade-off: focus return is one tick later, and the Drawer tests await it; this is a shared `src/ui` change, so the full e2e suite is a merge gate for this slice.
