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

The first attempt still put the driver line on the divider. The hidden cause was the plate copy button: its 44px touch height made the first line 44px, so the two-line group measured 62px inside the 56px row and overflowed 4px below the divider. The in-row copy action now has a 24px height and keeps its 44px width; the row's 56px selection button remains the primary touch target. `expectTouchTargets` applies the 24px floor only to elements marked `data-row-inline-action`, and the row guard asserts that the driver line keeps at least 6px above the divider.

The attribution was a 12px chip with `white-space: normal`, laid out beside the controls in a wrapping row. It is now an 11px `text-2xs` token (the one licence-text exception to the 12px caption floor) with `whitespace-nowrap`, and it is the second item in the mobile bottom-right column: controls first, credit 8px below, both right-aligned. It is a sibling of the controls, not a child, so it stays visible when the stack fades and goes inert above 60% sheet height, and it rides `--map-inset-bottom` to stay 12px above the sheet at every snap. The chip keeps the configured provider credit (`© OpenStreetMap · OpenFreeMap` in the current default). Changing the copy to Protomaps while OpenFreeMap tiles are served would misattribute the basemap; the 11px, single-line and placement guarantees are independent of the provider string.

Trade-off: the mobile stack is taller by the chip plus its 8px gap, so at 360x640 the controls start higher; the attribution is not part of the fading control stack, which is why it still occupies its row when the controls are transparent. The e2e guard is `e2e/sheet-rows.spec.ts`, which asserts the 56px row rhythm, measured virtual total, content centring, divider geometry, list fill, 12px plus safe-area footer and the attribution stack at every listed viewport, theme, snap, scroll and fleet size.
