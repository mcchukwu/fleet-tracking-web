# Fleet console frontend

Control console for dispatchers and security. The map is the product.

## Context

Start with `docs/README.md`.

- API contract: `docs/api/openapi.yaml` (source of truth).
- Auth, CSRF, WebSocket and endpoints: `docs/api/frontend-integration.md`.
- Behaviour: `docs/ui-brief.md`.
- Design: `docs/design-system.md`.
- Workflow and quality gates: `docs/workflow.md`.
- Settled choices: `docs/decisions.md`.

Do not copy backend source into this repo. The handoff is frontend-facing only.

## Current stack

Vite, React, TypeScript strict, Tailwind v4, React Router, lucide-react, cva, clsx and tailwind-merge.
Self-hosted Inter Variable and JetBrains Mono Variable.

Planned for the feature slices: TanStack Query, Zustand (live positions only), MapLibre,
vite-plugin-pwa, Vitest, Playwright and MSW. Ask before adding any of them.

## Commands

`npm run dev` | `npm run check` (TypeScript + oxlint) | `npm run build`

The repo uses npm and `package-lock.json`.

## Routes

- `/styleguide` is the visual contract. Add new shared components and states here.
- `/` currently redirects to `/styleguide` until the app shell exists.

## Theme

`ThemeProvider` stores `light`, `dark` or `system` under `fleet.theme` and the accent under
`fleet.accent`. The inline script in `index.html` applies the saved theme before first paint.
The accent is `data-accent` on `<html>`: `blue`, `violet` or `teal`. Accent is chrome only;
it never replaces a status colour.

## Rules

- API types come from generated files. Never hand-write them. No `any`, no `!`.
- WS messages are a discriminated union, validated at the boundary.
- Server state lives in TanStack Query only. Live positions in Zustand keyed by `vehicle_id`.
- Structure: `src/features/<name>/{api,components,hooks}`; shared UI in `src/ui`; no cross-feature imports.
- Style only with tokens from `docs/design-system.md` and `src/styles/tokens.css`. No arbitrary Tailwind values.
- Every list and panel implements loading, empty, error with retry, and stale states.
- Status = colour + icon + label. Numbers use tabular figures. Everything keyboard accessible with visible focus.
- Use `/styleguide` to review components in light, dark and each accent.
- No new dependencies without asking. Don't edit generated files. No comments that restate code.

## Done means

`npm run check` passes, the slice's Playwright test passes, screenshots reviewed at 1440px and 390px, no TODOs.
