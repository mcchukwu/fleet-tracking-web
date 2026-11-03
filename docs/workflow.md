# Frontend workflow

## Slices

Build vertical slices, not a component pile:

1. Login and session restore.
2. App shell and navigation.
3. Map, filters and vehicle drawer.
4. Live socket with snapshot resync and stale indication.
5. Alerts and acknowledge.
6. Playback.
7. Trips.
8. Geofences.
9. Drivers and import.
10. Reports and system health.
11. Audit for admin and security.

Each slice ends with a working screen, its states, and a Playwright check.

## Contract

- Generate TypeScript request and response types from `api/openapi.yaml`.
- Use the reference client or a thin wrapper. Do not hand-write API shapes.
- Server state belongs in TanStack Query. Live positions belong in Zustand keyed by `vehicle_id`.
- Validate WebSocket messages at the boundary with a discriminated union.
- Define loading, empty, error and stale presentation with every query.
- Mutations are optimistic: keep the previous row visible, mark it pending, reconcile on success, roll back and announce on error.

## Design

- Read `design-system.md` §0 and §1 before touching UI.
- Start from `src/ui` primitives. Compose before creating.
- Add new shared components and states to `/styleguide`.
- Check 1440px and 390px. Use real content lengths.
- Status is colour, icon and label together. Numbers use tabular figures.
- Use tokens for colour, spacing, radius, shadow and duration. No arbitrary Tailwind values.
- Theme and accent are separate. Accent is chrome only and never replaces a status colour.
- Use the shared loading bar, skeletons and spinner. Keep motion short and respect reduced motion.

## Setup notes

- Tailwind v4 is CSS-first. `src/styles/tokens.css` declares light/dark values, accent presets and the `@theme inline` mapping. No `tailwind.config.js`.
- `ThemeProvider` persists the theme and accent. The inline script in `index.html` applies them before paint.
- The drawer uses native `<dialog>` for focus containment and Escape.
- Shared primitives are local for now. shadcn/Radix is deferred until a component needs it.
- The repo uses npm and `package-lock.json`.

## Quality gates

- `npm run check` passes: TypeScript strict and oxlint.
- The slice's Playwright test passes once the harness exists.
- Screenshots at 1440px and 390px are reviewed.
- Keyboard path works: tab order, Escape closes overlays, focus returns.
- No TODOs, no `any`, no non-null assertions, no comments that restate code.

## Working agreement

- No new dependency without asking.
- Do not edit generated API files.
- Do not import across features. Shared UI lives in `src/ui`.
- Do not put backend source in this repo.
- Stop and ask when a token or product decision is missing.
