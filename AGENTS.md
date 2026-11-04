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
- Follow the vehicle-key decision in `docs/decisions.md`. Never mix `id` and `external_id`.
- Features use `<FleetMap>` and MapAdapter. Only `src/map/providers/*` imports map SDKs (A8).
- Features live in `src/features/<name>/{api,components,hooks}`; shared UI in `src/ui`. No cross-feature imports.
- Use design tokens, `src/lib/format.ts` and `useCan()`. No arbitrary Tailwind values.
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
