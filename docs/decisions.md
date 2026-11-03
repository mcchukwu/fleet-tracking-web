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
- `Vehicle` responses do not contain `trip_id`, `destination` or `trip_status`. Trip detail comes from the trips list; there is no `GET /trips/{id}`.
- Geofence-exit alert evidence was only `{geofence_id}`. Position must come from other evidence, history, or an explicit unavailable state.
- A missing CSRF token produces `csrf_failed`; recovery is one `/me` refresh and one retry.
- `GET /vehicles?status=` filters administrative status: `active` returns rows, `moving` returns zero.
- The staging snapshot contains 25 vehicles, not the 20 in the brief. Do not hard-code 20 in copy.
- `last_seen_at` may be null; `recorded_at` is the reliable data-age field.

## 2026-11-03: One error model

Every failure normalizes to `AppError` and is handled by `src/errors/`; features render error states from the hook result and never branch on raw status codes or server messages. `docs/error-handling.md` is authoritative for classification, copy, surfaces, reconciliation and diagnostics.
