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
- Errors: `docs/error-handling.md`.
- Playbook: ./agent-playbook.md. Open it by exact path. Read only the sections a prompt names.

Do not copy backend source into this repo. The handoff is frontend-facing only.

## Current stack
Vite, React, TypeScript strict, Tailwind v4, TanStack Router, TanStack Query, Zustand, Zod,
lucide-react, cva, clsx and tailwind-merge.
Self-hosted Inter Variable and JetBrains Mono Variable.
Vitest, Testing Library, MSW and Playwright.

## Commands
`npm run dev` | `npm run check` (typecheck + oxlint + guard + unit) | `npm run guard` | `npm run test` | `npm run e2e` | `npm run e2e:review` | `npm run build`

The repo uses npm and `package-lock.json`.

## Routes
- `/styleguide` is the visual contract. Add new shared components and states here.
- Placeholder routes exist for every screen until its slice ships. `/` redirects to `/styleguide`.

## Theme
`ThemeProvider` stores `light`, `dark` or `system` under `fleet.theme` and the accent under
`fleet.accent`. The inline script in `index.html` applies the saved theme before first paint.
The accent is `data-accent` on `<html>`: `blue`, `violet` or `teal`. Accent is chrome only;
it never replaces a status colour.

## Rules
- API types come from generated files or the provided handoff types. Never hand-write them. No `any`, no `!`.
- WS messages are a discriminated union, validated at the boundary.
- Server state lives in TanStack Query only. Live positions in Zustand keyed by `vehicle_id`.
- Structure: `src/features/<name>/{api,components,hooks}`; shared UI in `src/ui`; no cross-feature imports.
- Style only with tokens from `docs/design-system.md` and `src/styles/tokens.css`. No arbitrary Tailwind values.
- Every list and panel implements loading, empty, error with retry, and stale states.
- Status = colour + icon + label. Numbers use tabular figures. Everything keyboard accessible with visible focus.
- Use `/styleguide` to review components in light, dark and each accent.
- No new dependencies without asking. Don't edit generated files. No comments that restate code.
- The agent stops and reports (instead of improvising) in exactly these cases: a contract fact it cannot verify, a design-system gap, a needed dependency not on the approved list, a failing check it cannot fix in three attempts.

## Workflow
- Work only on the slice named in the prompt. Spec: agent-playbook.md Part C. Out-of-scope ideas: one line in docs/backlog.md.
- Never guess API behaviour. Probe staging, record findings in docs/decisions.md (what, why, date).
- Checkpoint loop: implement a checkpoint, run `npm run check`, commit, continue. Never proceed on red.
- Stop and report (do not improvise) if: a contract fact can't be verified; the design system has a gap; a dependency is needed that is not approved; a check still fails after 3 attempts.

## Verification (the model cannot see images)
- `npm run check` = typecheck + lint + guard + unit. `npm run e2e` = Playwright. `npm run e2e:review` writes screenshots for the human.
- Assert layout, a11y and state through helpers in e2e/helpers. Map facts come from window.__FLEET_DEBUG__.
- In the completion report, list what needs human visual review. Do not claim a screen "looks good".

## Approved dependencies
oxlint, oxlint-tsgolint, prettier, prettier-plugin-tailwindcss, react, @tanstack/react-query, @tanstack/react-router, @tanstack/react-virtual, zustand, zod, react-hook-form, @hookform/resolvers,
maplibre-gl, pmtiles, terra-draw (+ its MapLibre adapter; other adapters in Slice 15), @googlemaps/js-api-loader (Slice 15 only), papaparse, idb-keyval, vite-plugin-pwa (workbox),
lucide-react, class-variance-authority, clsx, tailwind-merge, @radix-ui/*, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono,
vitest, @testing-library/*, msw, @playwright/test, @axe-core/playwright, openapi-typescript, ripgrep (dev tool).
Anything else: ask.

## Conventions
- Live data is keyed exactly as docs/decisions.md says (vehicle key decision). Never mix id and external_id.
- Feature code never imports a map SDK. Only src/map/providers/* may (A8). Features use <FleetMap> and the MapAdapter contract.
- All formatting goes through src/lib/format.ts. All permission checks go through useCan().
- Every mutation: pessimistic, pending UI, double-submit blocked, invalidates affected queries, failure handled per docs/error-handling.md (never raw server text, never auto-retried).
- Errors: all error handling follows docs/error-handling.md. Use src/errors only. No ad-hoc try/catch that renders UI, no `error.message` shown to users, no empty catch, no unawaited promises, no console.* outside src/errors/report.ts.

## Done means
`npm run check` passes, the slice's Playwright test passes, screenshots reviewed at 1440px and 390px, no TODOs.
