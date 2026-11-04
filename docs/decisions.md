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

## 2026-11-03: Three accent presets

Blue, violet and teal. More presets increase contrast testing without adding product value.

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

Sixteen rapid failures against staging never produced a `429`, and no rate-limit headers appeared. The form parses `Retry-After` (seconds or HTTP date), counts down live, and falls back to "Try again shortly." when the header is absent. Both paths are covered by MSW and e2e. This is recorded as an unverified contract, not a confirmed one.

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
