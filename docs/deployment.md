# Deployment

The console is a client-side Vite SPA. It is hosted on Cloudflare Workers with static assets and a small Worker that proxies `/api/*` to the fleet API.

## Why Workers

The API is same-origin only. It sets host-only session cookies and has no CORS, and the live socket connects to `window.location.origin`. The Worker keeps `/api/*` on the console's own origin, including the WebSocket upgrade, without changing any application code.

Vercel can proxy the HTTP calls with a rewrite, but a WebSocket must terminate in a Vercel Function, which is capped at 300 seconds on Hobby and 300–800 seconds on Pro. A dispatcher console holds the socket open, so Workers is the appropriate target.

## Files

| File              | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `wrangler.jsonc`  | Worker, assets directory, `API_ORIGIN` and `WS_ORIGIN_REWRITE` |
| `worker/index.js` | `/api/*` proxy and WebSocket bridge                            |
| `public/_headers` | Security headers and immutable caching for hashed assets       |
| `.nvmrc`          | Node 24, matching the Workers Builds default                   |

## Prerequisites

- Cloudflare account with Workers enabled.
- The repository connected to Cloudflare, or the `wrangler` CLI logged in locally.
- The API origin. The committed default is staging; replace it before a real production release.

## First deploy

```bash
npm ci
npm run check
npm run build
npx wrangler login
npx wrangler deploy
```

`wrangler deploy` prints the `https://fleet-console.<account>.workers.dev` URL and uploads `dist/` with the Worker.

Verify before connecting Git:

```bash
BASE=https://fleet-console.<account>.workers.dev
curl -sI "$BASE/" | head -5
curl -sI "$BASE/map" | head -5
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/v1/vehicles?limit=1"
```

The first two return `200 text/html`; the last returns `401`.

In a browser, log in and confirm `/api/v1/live/ws` returns `101` and position frames arrive.

## Workers Builds

Connect the repository in the Cloudflare dashboard with these settings:

| Setting           | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| Production branch | `main`                                                  |
| Root directory    | `/`                                                     |
| Build command     | `VITE_APP_VERSION=$WORKERS_CI_COMMIT_SHA npm run build` |
| Deploy command    | `npm run deploy`                                        |

Workers Builds installs dependencies from the lockfile before running the build command, then runs the deploy command. The build image defaults to Node 24.22.1 and does not include `ripgrep`, so `scripts/assert-bundle.sh` falls back to `grep`.

## Build variables

| Variable                | Required | Notes                                                                                                                          |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_MAPTILER_API_KEY` | No       | Enables Streets and Satellite. Restrict the key by domain in MapTiler. Without it the app uses the OpenFreeMap standard style. |
| `VITE_APP_VERSION`      | No       | Set from `WORKERS_CI_COMMIT_SHA` in the build command for error reports.                                                       |
| `VITE_API_BASE`         | No       | Must stay unset. Setting it moves the API to another origin and breaks cookies, CORS and the socket.                           |

`VITE_*` values are compiled into the bundle. Changing one requires a rebuild.

## Runtime variables

Defined in `wrangler.jsonc`:

- `API_ORIGIN` — the fleet API origin.
- `WS_ORIGIN_REWRITE` — `"true"` while the deployed origin is not in the backend's `WS_ALLOWED_ORIGINS`.

Staging currently rejects every browser origin except its own. The Worker therefore rewrites the WebSocket `Origin` to `API_ORIGIN`. Once the backend allowlists the console origin, set `WS_ORIGIN_REWRITE` to `"false"` and redeploy.

## Custom domain

The zone must be on Cloudflare. Add a custom domain in the Worker dashboard, or commit:

```jsonc
"routes": [{ "pattern": "console.example.com", "custom_domain": true }]
```

Then add `https://console.example.com` to the backend's `WS_ALLOWED_ORIGINS`, set `WS_ORIGIN_REWRITE` to `"false"`, and redeploy. Optionally set `"workers_dev": false` to remove the workers.dev hostname.

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback <deployment-id>
```

A deployment pins both the Worker and the asset upload. Reverting the commit and pushing to `main` also reverts the site.

## Caveats

- The committed `API_ORIGIN` is staging. It is shared, may restart during a deploy, and must not hold real customer data. A public console pointed at it is a demo, not a production service.
- Only login, the map and the vehicle drawer are implemented. The remaining screens are placeholders.
- `VITE_MAPTILER_API_KEY` is public in the bundle by design. Use a domain-restricted key.
- No Content-Security-Policy is set. The inline theme script in `index.html` needs a hash and MapLibre needs tile and worker sources; add a report-only policy as a separate change.
