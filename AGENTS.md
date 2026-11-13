# Fleet Console Frontend

Dispatcher and security console. The map is the produc.

## Context

Start with `docs/README.md`. Read only task-relevant sections:

- API contract: `docs/api/openapi.yaml`
- Integration: `docs/api/frontend-integration.md`
- Behaviour: `docs/ui-brief.md`
- Design: `docs/design-system.md`
- Decisions: `docs/decisions.md`
- Errors: `docs/error-handling.md`
- Workflow: `docs/workflow.md`
- Dependencies: `docs/approved-dependencies.md` (before adding dependencies)
- Agent procedures: `agent-playbook.md` (Part C for implementation).

Frontend handoff only. Never copy backend source.

## Architecture and Rules

- Work only on the requested slice. No scope expansion.
- Use generated or approved API types. Validate WebSocket messages at boundaries using discriminated unions. Avoid `any` and TypeScript non-null assertions.
- TanStack Query owns server state; Zustand owns live positions keyed by `vehicle_id`.
- Panels never branch on a query's isPending; use useQueryView.
- Follow the vehicle-key decision in `docs/decisions.md`. Never mix `id` and `external_id`.
- Features use `<FleetMap>` and MapAdapter. Only `src/map/providers/*` imports map SDKs (A8).
- Features live in `src/features/<name>/{api,components,hooks}`; shared UI in `src/ui`. No cross-feature imports.
- Use design tokens, `src/lib/format.ts` and `useCan()`. No arbitrary Tailwind values.
- Layering uses only the named utilities in `src/ui/layers.css`; numeric or arbitrary z-index is forbidden. Overlays render through `LayerPortal`, and the map shell is positioned against the isolated content area, never the viewport.
- Data-backed panels handle loading, empty, error (with retry) and stale states.
- Status = colour + icon + label. Numbers use tabular figures. All interactions must be keyboard accessible with visible focus.
- Mutations are pessimistic, show pending state, prevent double submissions, invalidate affected queries and follow `docs/error-handling.md`. Never auto-retry mutations.
- Follow `docs/error-handling.md`: no raw server errors, `error.message` in UI, ad-hoc UI-rendering try/catch, empty catches, unawaited promises or `console.*` outside `src/errors/report.ts`.
- Never edit generated files. No unapproved dependencies. No comments that restate code.

## Workflow

Never guess API behaviour. Verify against staging and record findings in `docs/decisions.md` (what, why, date). Implement in checkpoints: run `npm run check`, commit, continue. Never proceed on red. Stop and report when a contract fact is unverifiable, the design system has a gap, an unapproved dependency is needed, or a check still fails after three attempts.

## Verification

- `npm run check` and the slice's Playwright tests must pass.
- `/styleguide` is the visual contract. Review light, dark and all accents.
- `npm run e2e:review` generates screenshots for human review at 1440px and 390px.
- Use `e2e/helpers` for layout/accessibility assertions and `window.__FLEET_DEBUG__` for map facts.
- Report pending human visual review. Never claim visual approval from images you cannot inspect.
- No TODOs at completion.

## Test tiers (agent-playbook.md A9)

- T0 `npm run check` at every checkpoint and after every fix.
- T1 `npm run e2e:fast -- <spec paths>` while building: desktop-light plus mobile-dark, only the specs the change touches. The tag split means a purely functional spec runs on desktop-light; T2 adds mobile.
- T2 `npm run e2e:slice -- <spec paths>` at the end of a slice: the slice's specs on all four projects.
- T3 `npm run e2e` is the full gate for merges and shared-code changes. Agent sessions do not run it unless a prompt asks.
- Functional tests are untagged and run on the light projects only. Tests whose purpose is screenshots, contrast, accents or axe carry `{ tag: "@theme" }` and run in both themes: the light projects run the whole suite, the dark projects run only the tagged set. Never delete a test to make the suite faster; put it in the correct tier.
- `npm run e2e:review` follows the same split: functional specs supply light screenshots, `@theme` specs supply dark screenshots.
- Locally Playwright uses `workers = CPU cores - 1` and `retries: 0`; CI uses one retry. On a memory-constrained machine override with `PLAYWRIGHT_WORKERS=<n>`.
