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

`--spacing-touch` (44px), `--spacing-rail-expanded` (200px), `--container-dialog` (480px) and `--container-content` (1440px) are design tokens, plus `--overlay` for dialog backdrops and small `z-menu`/`z-dialog`/`z-toast`/`z-banner` utilities for the stacking scale. The guard forbids arbitrary Tailwind values, so these values have to exist as tokens.

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

The reconnect banner now moves to a terminal state after 60 seconds: `Live updates are unavailable. Showing data from hh:mm.` with `Retry now`, while automatic attempts continue at the 30-second backoff cap. The banner sits at z-index 35, below sticky headers, menus, popovers, dialogs and toasts, so it cannot cover the user menu. In development, three failed handshakes after a successful `/me` log one console hint pointing at `WS_ALLOWED_ORIGINS` and the proxy `Origin` header.

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
