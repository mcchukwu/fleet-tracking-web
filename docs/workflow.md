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

- Use the provided handoff types/client or generate TypeScript request and response types from `api/openapi.yaml`.
- Use the reference client or a thin wrapper. Do not hand-write API shapes.
- Server state belongs in TanStack Query. Live positions belong in Zustand keyed by `vehicle_id`.
- Validate WebSocket messages at the boundary with a discriminated union.
- Define loading, empty, error and stale presentation with every query.
- Follow `error-handling.md` for classification, surfaces, copy and reconciliation. Features never branch on raw status codes.
- Mutations are pessimistic: keep the previous row visible, mark it pending, apply the server result on success, restore it and announce the error on failure.

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
- The vehicle drawer is a non-modal right `<aside>` (420px, 12px inset, Escape and explicit focus return) so the map stays interactive. Modal edit, assign and confirm flows use the Radix `Dialog` primitive.
- Shared primitives are local and Radix-based where needed (dialog, menu, tabs, tooltip, toast). The searchable `Combobox` is local and follows the ARIA combobox/listbox pattern; native selects remain for short, fixed lists.
- TanStack Router uses code-based routes in `src/app/router.tsx`; search params are Zod-validated.
- TanStack Query owns server state. The key factory is `src/api/keys.ts`.
- The API client is `src/api/client.ts`. All failures normalize to `AppError` in `src/errors/`.
- The repo uses npm and `package-lock.json`.

## Quality gates

- `npm run check` passes: TypeScript strict, oxlint type-aware, the design guard, and Vitest.
- `npm run e2e` passes in both Playwright projects (desktop 1440x900, mobile 390x844).
- `npm run e2e:review` writes screenshots to `test-results/review/` for human review at 1440px and 390px.
- Keyboard path works: tab order, Escape closes overlays, focus returns.
- No TODOs, no `any`, no non-null assertions, no comments that restate code.

## Working agreement

- No new dependency without asking.
- Do not edit generated API files.
- Do not import across features. Shared UI lives in `src/ui`.
- Do not put backend source in this repo.
- Stop and ask when a token or product decision is missing.

## Commands

| Command              | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Development                                                     |
| `npm run check`      | Typecheck, oxlint, guard and unit tests                         |
| `npm run guard`      | Architectural guards                                            |
| `npm run test`       | Unit tests                                                      |
| `npm run e2e`        | Playwright                                                      |
| `npm run e2e:review` | Generate visual review screenshots                              |
| `npm run build`      | Production build                                                |
| `npm run deploy`     | Deploy `dist` to Cloudflare Workers (run `npm run build` first) |

Use npm and `package-lock.json`.

## Development Workflow

- Work only on the assigned slice.
- Implement in coherent checkpoints.
- Run `npm run check` at each checkpoint.
- Commit successful checkpoints before continuing.
- Never proceed on failing checks.
- Stop after three unsuccessful attempts to fix a check.
- Record out-of-scope ideas in one line in `docs/backlog.md`.
- Never guess API behaviour. Verify against staging and record findings in `docs/decisions.md`.

## Completion

A slice is agent-complete when:

- `npm run check` passes.
- Its Playwright tests pass.
- No TODOs remain.
- Review screenshots are generated at 1440px and 390px.

Human visual approval is separate from agent completion.
