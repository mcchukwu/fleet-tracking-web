# Error Handling

Put this file at `docs/error-handling.md`. It is the single policy for how the console fails. If code handles an error in a way this file does not describe, the code is wrong or this file needs a change. Visual treatment lives in `design-system.md` §8 and §11; this file decides **which** treatment applies **when**.

Agents: read this file in full for any slice. It is short on purpose.

---

## 1. Principles (the reasons behind every rule)

The user is an operator who must keep working while parts of the system fail. That gives five rules:

1. **Every error has a way out.** An error surface without an action (retry, sign in, reload, go back) is a dead end. No exceptions.
2. **Never lose the user's work or context.** Failed refetches keep the old data (dimmed and labelled). Failed submissions keep the form, the dialog and the drawer open.
3. **Fail small.** Show the error at the smallest scope that contains it: field, row, panel, route, app. A broken drawer must not take the map down.
4. **Be honest about uncertainty.** "We couldn't confirm it saved" is a real state. Check, then say what happened. Never show success or failure the app does not actually know.
5. **Stay calm.** One clear message in plain words. No blame, no jargon, no stack traces, no raw server text, no wall of red when ten panels fail for one cause.

---

## 2. Taxonomy

Every failure is normalised into one `AppError` with a `kind`. Nothing else is shown to users or branched on in features.

```ts
export type AppErrorKind =
  | 'offline'        // browser or probe says no network
  | 'network'        // online, but the request never completed (DNS, TLS, reset)
  | 'timeout'        // exceeded the endpoint's timeout
  | 'unauthenticated'// 401 outside the login call
  | 'csrf'           // 403 with the CSRF error code: recovered silently
  | 'forbidden'      // 403 for role reasons
  | 'not_found'      // 404
  | 'conflict'       // 409
  | 'validation'     // 400 / 422
  | 'rate_limited'   // 429
  | 'server'         // 500
  | 'unavailable'    // 502 / 503 / 504
  | 'contract'       // response failed schema validation
  | 'client'         // exception in render or an event handler
  | 'chunk'          // a lazy-loaded bundle failed (usually a new deploy)
  | 'storage'        // IndexedDB unavailable or over quota
  | 'map'            // the map adapter failed (WebGL context lost, tiles missing)
  | 'clipboard'      // copy was denied
  | 'aborted';       // a cancelled request. Never shown, never logged as an error

export interface AppError {
  kind: AppErrorKind;
  status?: number;
  code?: string;              // server error.code
  serverMessage?: string;     // server error.message, for known-safe codes only
  retryable: boolean;
  outcome: 'failed' | 'unknown'; // 'unknown' = a write that may have succeeded (see §6)
  retryAfterSec?: number;
  requestId?: string;         // if the backend sends one (probe response headers)
  context: { action?: string; resource?: string; route: string };
  cause?: unknown;
  at: number;
}
```

Classification rules, in order: abort first; then offline (the connectivity store says so) before network; HTTP status next, using the server's `error.code` to split `403` into `csrf` and `forbidden`; Zod failure becomes `contract`. The real codes come from probing staging, then go into the catalog (§5). Unknown codes fall back to the kind.

---

## 3. Where an error appears (surface rules)

Decide by **scope**, then by **who started it**.

| Scope | Surface | Use for |
|---|---|---|
| Field | inline under the field | client validation, server messages tied to one field |
| Form | `InlineError` above the buttons, focus moves to it | server rejection of a submit, `conflict`, `forbidden` on an action |
| Row or item | inline in the row with a Retry | a row action failed (acknowledge, status change) |
| Region (panel, drawer, table, chart) | `ErrorState` in place of the content, old data kept dimmed underneath | a query failed |
| Route | route boundary page inside the shell | a route crashed, `not_found`, `forbidden` for a whole screen |
| Global state | banner under the top bar | offline, reconnecting, session expired, server trouble, update available |
| App | full-page last-resort boundary | the shell itself crashed |
| Toast | bottom-right, 4s (errors persist) | confirmations; background events the user did not trigger; clipboard failure; an action's failure **only if** its surface has already closed |

Rules:
- **An error from something the user just did appears where they are looking** (inline, in the dialog), not in a toast they may miss.
- **Blocking dialogs are only for session expiry.** Everything else leaves the user free to keep working.
- **Dedupe.** The same kind and key within 10s collapses into one surface. Announce once.
- **Error storm control.** If three or more distinct queries fail with `network`, `server` or `unavailable` within 30s, show one banner: "We're having trouble reaching the server. Retrying…" with a link to System. While it is up, region errors render **compact** (icon, "Couldn't load", Retry) instead of full text. When any request succeeds, the banner clears and regions refetch.
- **Cached data beats an error.** If a query has previous data, a failed refresh keeps showing it and adds a small `Couldn't refresh · Retry` line plus the stale treatment. Show a full `ErrorState` only when there is nothing to show.
- **Offline is not an error.** It is a state (design-system §14): banner, stale labels, mutations disabled with a reason. Region errors are never shown for failures caused by being offline.

---

## 4. Handling pipeline

```
fetch ─► api client ─► normalize() ─► AppError ─► catalog (copy) ─► surface
                │                         │
                │                         └─► diagnostics ring buffer (report.ts)
                └─► 401 / csrf handled globally
```

Module `src/errors/` (all error code lives here):

| File | Responsibility |
|---|---|
| `types.ts` | `AppError`, kinds |
| `normalize.ts` | any thrown value to `AppError`, with unit tests for every kind |
| `catalog.ts` | `code` and `kind` to copy (§5), one place, typed |
| `report.ts` | diagnostics ring buffer, reporter interface (§8) |
| `ErrorState.tsx` | region error: icon, title, detail, action, compact variant, optional `Copy diagnostics` |
| `InlineError.tsx` | form and row error: `role="alert"`, linked via `aria-describedby` |
| `ErrorBoundary.tsx` | app, route and panel boundaries, with `resetKeys` |
| `useActionError.ts` | mutation helper: pending, error, reconcile (§6), focus |
| `global.ts` | QueryCache and MutationCache handlers, `window` error handlers, `vite:preloadError` |

Wiring with TanStack Query:
- `QueryCache.onError` and `MutationCache.onError` handle **cross-cutting** concerns only: `unauthenticated`, `chunk`, error-storm counting, diagnostics. They never render screen-level UI.
- Screens render their own errors from the hook result through `ErrorState` or `InlineError`.
- Queries that a screen cannot show anything without use `throwOnError` so the nearest boundary catches them; everything else renders locally.
- Every query and mutation carries `meta: { scope, resource }` so handlers and diagnostics know where it came from.

---

## 5. Message catalog

Each message has a **title** (what happened), a **detail** (what to do or what is safe), and an **action**. Written once in `catalog.ts`; features pass `context.action` for the "Couldn't {action}" form.

| Kind | Title | Detail | Action |
|---|---|---|---|
| offline | You're offline | Changes are disabled until you're back online. | none (banner clears itself) |
| network | Can't reach the server | Check your connection. Your data is safe. | Retry |
| timeout | This is taking too long | The server didn't respond in time. | Retry |
| unauthenticated | Your session expired | Sign in to continue. You'll stay where you are. | Sign in |
| forbidden | You don't have access to this | Your role can't {action}. Ask an admin if you need it. | Go back |
| not_found | {Thing} not found | It may have been removed. | Back to {list} |
| conflict | Couldn't {action} | Use the server's message as the detail (safe codes only). | Refresh |
| validation | Check the highlighted fields | Per-field messages. If none map to a field, show the server message above the form. | none |
| rate_limited | Too many attempts | Try again in {n}s. (live countdown) | Retry when 0 |
| server | Something went wrong on our side | Try again in a moment. If it keeps happening, check System. | Retry |
| unavailable | The service is temporarily unavailable | We'll keep trying. | Retry now |
| contract | Unexpected response from the server | We're showing what we can. | Retry, Copy diagnostics |
| client | This part of the page stopped working | Your data is safe. | Reload this section, Copy diagnostics |
| chunk | A new version is available | Reload to continue. | Reload |
| storage | Offline storage isn't available | Offline mode is limited in this browser. | Dismiss |
| map | The map couldn't load | Vehicles are still listed on the left. | Retry |
| clipboard | Couldn't copy | Select the text and press Ctrl+C. | none |

Copy rules:
- Sentence case. Plain words. Say "Couldn't", never "Failed", "Invalid" or "Error".
- Never show raw server text for `server`, `unavailable` or `contract`. Show `serverMessage` only for codes the catalog marks safe (validation, conflict, rate limit).
- Never show status codes, stack traces or ids in the UI. They go in diagnostics (§8).
- Empty is not an error: "No alerts match" is an empty state, never a red box.

---

## 6. Retry, timeouts, and uncertain outcomes

### Queries
- Auto-retry `network`, `timeout`, `server`, `unavailable` at most 2 times, delays about 1s then 3s with jitter. Never retry `4xx`. Honour `Retry-After`.
- A first transient failure with cached data stays silent (the retry runs behind the stale label). With nothing cached, show the loading skeleton through retries, then the error.
- Slow requests: after 3s a user-started action shows "Still working…"; after 10s "Taking longer than usual" with Cancel and Retry; hard timeout 15s by default. Per-endpoint overrides in one table (import upload 120s, history 30s).

### Mutations
- **Never auto-retry a mutation.** Writes are not safe to replay blindly.
- Disable the control while pending (double-submit protection). Keep form values on failure.
- **Uncertain outcome.** If a write ends in `network` or `timeout` after the request was sent, the outcome is `unknown`. Do not say "failed". Reconcile first, per resource, then tell the user the truth:

| Write | Reconcile by | Messages |
|---|---|---|
| create trip | refetch trips, find a trip with the same vehicle, origin, destination created just now | "It was saved." or "It wasn't saved. Try again." |
| create driver, geofence | refetch list, match on name plus key fields | same |
| patch (vehicle, trip, driver, geofence, rule) | refetch the entity, compare the intended fields | same |
| acknowledge alert | refetch the alert, check `status` and `acked_at` | same |
| import vehicles | re-upload is safe (per the API docs), so offer "Try again" directly | "We couldn't confirm the import. It's safe to upload again." |

  If reconcile itself cannot reach the server: "We couldn't confirm that it saved. Check [list] before trying again."
- `409` and stale-state conflicts (for example a trip already completed elsewhere): refetch, update the UI, and explain in one line ("This trip was already completed. We've refreshed it.").

---

## 7. Specific mechanisms

- **Session expiry (401).** Single-flight. Show the expiry dialog once, cancel retry loops, keep the route and unsaved form state. After sign-in, refetch active queries and resume. A mutation that hit `401` shows inline "Your session expired. Sign in, then try again." and keeps its form data.
- **CSRF failure.** Recover silently once: call `/me` to refresh the token, replay the request one time. If it fails again, treat as `forbidden`.
- **Live socket.** Errors never toast. They drive the connection indicator and, after about 10s down, the "Reconnecting…" banner. The tooltip shows attempt count. Brief blips are invisible.
- **Contract drift.** Parse responses with `safeParse`. For non-critical fields, degrade and log. **Unknown enum values must render a neutral fallback** ("Unknown type: xyz", grey badge), never crash: a backend that adds an alert type must not blank the Alerts screen. For critical data, show `contract` with Copy diagnostics.
- **Chunk failure after deploy.** Listen for `vite:preloadError`. Show the "new version" banner and reload on the next navigation (never mid-live-view without the user's click). A one-time loop guard (via `lib/storage`) prevents repeated reloads.
- **Map failure.** The adapter emits `error`; `FleetMap` shows a map-level overlay with Retry while the vehicle list and drawer keep working. WebGL context loss shows "Map paused" with a Restore action that remounts the adapter.
- **Storage failure.** Offline caching degrades silently and shows the `storage` notice once per session. Never block the app.
- **Clipboard failure.** Toast with the fallback instruction.
- **Unhandled errors.** `window.onerror` and `unhandledrejection` go to diagnostics. If a boundary catches it, the boundary renders; otherwise no UI. Lint enforces no floating promises (`typescript/no-floating-promises`), because dropped async errors are the most common silent failure.
- **Boundary levels.** App (last resort: Reload and Copy diagnostics), route (keeps shell and navigation, resets on route change), panel (left panel, drawer, map, bottom bar each have their own). `resetKeys` clear a boundary when its inputs change.

---

## 8. Diagnostics (no third-party service yet)

- `report.ts` keeps a ring buffer of the last 50 `AppError`s in memory only: kind, status, code, endpoint path (no query values), route, online state, app version, time, request id if any.
- `Copy diagnostics` (on `server`, `contract`, `client` states) copies that buffer as redacted JSON. Never includes cookies, CSRF tokens, request or response bodies, emails or names.
- `reporter` is an interface with one in-memory implementation. A Sentry-style reporter can be added later by writing one file; features never call a vendor SDK.
- `console.*` is allowed only in `report.ts` (and dev-only), by an oxlint override.

---

## 9. Per-feature error matrix

Each slice's rows are acceptance criteria. "Keeps" means what must not disappear.

| Feature | Failure | User sees | Recovery |
|---|---|---|---|
| Login | `401` | inline "Email or password is incorrect." | fields kept, password cleared |
| Login | `429` | inline with live countdown | button re-enables at 0 |
| Login | network | inline `network` message | Retry |
| Session restore | `/me` network | shell skeleton then offline-unverified (Slice 13) or `network` page | Retry |
| Session restore | `401` | login, original route remembered | none |
| Snapshot load | network or `5xx`, nothing cached | `ErrorState` over the map area, list also empty | Retry |
| Snapshot refresh | any, cached data | data stays, `Couldn't refresh · Retry`, stale treatment | auto-retry, Retry |
| Live socket | drop | indicator, then banner after 10s | automatic, snapshot resync |
| Map | adapter or tiles fail | overlay "The map couldn't load" | Retry; list and drawer keep working |
| Vehicle drawer | `404` | drawer not-found state | Close |
| Vehicle drawer | detail or events `5xx` | section-level `ErrorState`; live fields from the store still show | Retry per section |
| Vehicle edit | `400` | form-level message, fields kept | fix and resubmit |
| Vehicle edit | `404`, `409` | form-level message, offer Refresh | Refresh |
| Vehicle edit | network (unknown outcome) | "We couldn't confirm it saved." then reconcile result | Try again / Close |
| Assign driver | `409`, `404` | inline in the dialog | choose another / Refresh |
| Alerts list | any | region `ErrorState`, old rows dimmed | Retry |
| Acknowledge | `404` (gone) | row refreshes, "This alert no longer exists." | none |
| Acknowledge | `403` | disabled with reason before the click; if it occurs, inline "Your role can't acknowledge alerts." | none |
| Acknowledge | network | reconcile, then "Acknowledged." or "Not acknowledged. Try again." | Retry |
| Alert rules | `PATCH` fails | inline on the rule, toggle reverts | Retry |
| Alert detail position | not derivable | "Position unavailable" (not an error) | none |
| Playback history | `5xx`, timeout | region error with Retry; range kept | Retry, narrow range |
| Playback history | empty | empty state "No positions in this range" | change range |
| Playback history | large and slow | 3s and 10s slow states; Cancel | Cancel, narrow range |
| Trip create | `400` | form-level message, form kept | fix and resubmit |
| Trip create | network | unknown outcome, reconcile | per §6 |
| Trip transition | `409` or stale | refetch, one-line explanation | none |
| Trip transition | `403` | disabled with reason | none |
| Driver create or edit | `400`, network | as trip create | as trip create |
| Geofence create or edit | invalid polygon | field-level message on the drawing, does not submit | fix polygon |
| Geofence delete | `409` | dialog stays open, "This geofence has recorded events and can't be deleted." | Cancel |
| Import | wrong type or missing `imei` | pre-upload message, upload disabled | choose another file |
| Import | `400` | server message in the result panel | fix file |
| Import | network mid-upload | "We couldn't confirm the import. It's safe to upload again." | Upload again |
| Import | partial failure | result summary with the first 100 row errors (this is a result, not an error state) | Download errors |
| Reports | any | region `ErrorState`, range kept | Retry |
| System | health call fails | full-width "Can't reach the API" (never a blank) | Retry |
| Audit | `403` | forbidden state | Go back |
| Audit | any other | region `ErrorState` | Retry |
| Copy to clipboard | denied | toast with fallback | none |
| Update available | n/a | banner with Reload | Reload when ready |

---

## 10. Accessibility of errors

- Inline and form errors use `role="alert"` once, link to fields with `aria-describedby`, and are not auto-dismissed.
- After a failed submit, focus moves to the form-level error (or the first invalid field if there are only field errors).
- Region `ErrorState` uses `role="status"` unless it blocks the whole screen. Banners use `aria-live="polite"`; the session expiry dialog is the only `assertive` case with focus capture.
- Dedupe announcements (one per 5s per kind). Never rely on colour: icon plus text plus the colour token.
- Retry buttons are real buttons with the same shortcut and focus rules as any action.

---

## 11. Testing errors

Build a fault layer in Slice 0 and use it everywhere:

- MSW helper `fault(kind, endpoint)` producing each taxonomy kind, plus `slow(ms)`, `malformed()` (schema-violating body), `unknownEnum()`, `lostResponse()` (request reaches the handler, the response never returns: the uncertain-outcome case).
- In mock mode a dev-only query string forces faults for manual testing: `?fault=alerts:server`.
- Unit tests: `normalize` for every kind, `catalog` completeness (every kind has copy), reconcile functions.
- Playwright, for **every screen the slice adds**, run these scenarios and assert them:

| Scenario | Must be true |
|---|---|
| server error, nothing cached | `ErrorState` shown with Retry; no blank area; Retry recovers |
| server error, cached data | old data still visible and labelled stale; no full error |
| offline | banner, stale labels, mutations disabled with reason, no region errors |
| slow (12s) | "Still working…" then "Taking longer…"; Cancel works |
| forbidden | forbidden state or disabled-with-reason; no crash |
| not found | not-found state with a way back |
| malformed body | `contract` state or graceful degradation; no crash |
| unknown enum | neutral fallback rendered |
| lost response on a write | "couldn't confirm", reconcile result shown, no duplicate created |
| render crash (injected) | panel boundary shows `client` state; the rest of the app still works |

Always also assert: no uncaught console errors, no raw server text for `5xx`, no stack traces in the DOM, focus lands correctly after a failed submit, and `axe` passes on the error states.

---

## 12. Definition of done for error handling

- [ ] All failures go through `normalize()`; no screen branches on raw status codes or `error.message`.
- [ ] Every query, mutation and boundary shows a surface from §3 with an action.
- [ ] Previous data and form input survive every failure.
- [ ] Writes with unknown outcomes reconcile before reporting.
- [ ] Copy comes from `catalog.ts`; no ad-hoc strings.
- [ ] Error storm control, dedupe and compact variant verified.
- [ ] Fault scenarios from §11 exist for every screen and pass.
- [ ] `no-floating-promises` clean; no empty `catch`; no swallowed errors.
