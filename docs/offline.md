# Offline and PWA

The console follows one rule: **read offline, write online**. Cached tenant data renders from IndexedDB, the shell and map assets come from the service worker, and every mutating control is disabled with a reason while the network is down. No write is queued, replayed or reconciled after the fact.

## What is cached

`src/api/persistedCache.ts` stores one IndexedDB entry, `fleet.query-cache`, with a version buster and a 24-hour maximum age. The allowlist is the existing `persistedQueryRoots`:

`live-snapshot`, `vehicles`, `vehicle`, `vehicle-events`, `alerts`, `alert-rules`, `trips`, `drivers`, `geofences`, `reports`, `system-health`.

`/me`, `/audit`, `vehicle-history` and mutations are never persisted. Only successful queries with defined data are written. Writes are debounced by 750 ms and flushed when the page is hidden. A corrupt payload, a different build buster or a payload older than 24 hours is deleted, not partially restored.

The minimal profile (`fleet.offline-profile`) stores `id`, `tenant_id`, `email`, `name` and `role`. It never contains the CSRF token.

## Connectivity truth

`navigator.onLine` is not trusted. `src/stores/connection.ts` combines browser events, failed fetches and a 15-second `GET /api/v1/me` probe while offline. A resolved response of any status proves the server is reachable; a transport error means offline. TanStack Query's `onlineManager`, the live socket and the offline banner all read that one state.

Queries use `networkMode: "online"`: offline they serve cached data and pause instead of firing a first request. Mutations use `networkMode: "always"` plus an API-client guard that rejects a write with the catalogued `offline` error before dispatch.

## Map pack

The offline basemap is a self-hosted Protomaps PMTiles file plus local glyphs and sprites. `VITE_MAP_PMTILES_URL` selects it. When it is empty the standard style stays the hosted OpenFreeMap style and the MapLibre adapter reports `capabilities.offline: false`.

### Generating the regional pack

Requires the Go CLI:

```bash
go install github.com/protomaps/go-pmtiles@latest
npm run map:pack            # public/map/fleet.pmtiles
npm run map:pack -- --test  # public/map/test.pmtiles
```

The committed files were extracted on 2026-11-12 from `https://build.protomaps.com/20261111.pmtiles`:

| File | Bounding box | Max zoom | Size |
|---|---|---|---|
| `public/map/fleet.pmtiles` | `2.4,4.2,5.2,8.6` | 12 | 11 MB |
| `public/map/test.pmtiles` | `2.4,4.2,5.2,8.6` | 6 | 512 KB |

`scripts/map-assets.sh` downloads the glyph ranges and sprites used by the local style:

- `Noto Sans Regular`, `Noto Sans Medium` and `Noto Sans Italic`, ranges `0-255` through `1792-2047` (2.1 MB). This covers Latin, Greek, Cyrillic, Hebrew and Arabic labels. Ranges above 2047 (for example Devanagari or CJK place names) are not shipped; those labels fall back to missing glyphs offline.
- Protomaps v4 light and dark sprites (108 KB).

A build with `VITE_MAP_PMTILES_URL` set runs `scripts/check-map-pack.sh`, which fails if the pack or the required assets are missing.

## Service worker

`vite-plugin-pwa` in `injectManifest` mode uses the custom `src/sw.ts`, which precaches the shell, JS/CSS, fonts, icons, manifest, glyph PBFs and sprites. Navigation falls back to `index.html` with `/api/` denylisted. The PMTiles file is a runtime `CacheFirst` route whose `cachedResponseWillBeUsed` calls `createPartialResponse` from `workbox-range-requests`; the first online map view calls `warmMap()`, which fetches the full pack once after the worker controls the page, and later range requests are served as 206 responses from that cached body. `generateSW` serialized the plugin without bundling `createPartialResponse`, so the slice switched to `injectManifest`. The cache name includes `VITE_APP_VERSION`.

Registration uses `registerType: 'prompt'`. A waiting worker raises the existing update banner; nothing reloads automatically. The Reload action calls `updateSW(true)`.

The worker is disabled in development unless `VITE_SW_DEV=1`. `VITE_MOCK=1` and `VITE_SW_DEV=1` are rejected together because MSW and the worker would share one scope. The PWA suite therefore runs against a production preview.

## Install

`beforeinstallprompt` is captured before React renders and exposed as `Install app` in the user menu while the app is not already standalone. Activation requests persistent storage. A declined prompt is silent and is never retried by the app.

## Tests

```bash
npm run e2e:fast -- e2e/offline-presentation.spec.ts   # dev + MSW, presentation only
npm run e2e:pwa                                        # production build + preview, Chromium desktop/mobile
npm run e2e:pwa:webkit                                 # WebKit desktop/iOS, for CI
npm run e2e:slice -- e2e/offline-presentation.spec.ts  # all four browser projects
```

The PWA config contains Chromium desktop/mobile and WebKit desktop/iOS projects. `e2e:pwa` runs Chromium locally because this machine lacks WebKit's system libraries (`libicu74`, `libxml2`, `libflite1`); CI runs `e2e:pwa:webkit` after `npx playwright install --with-deps webkit`. It covers: warm then offline reload, the shell, cached data, the offline banner, disabled mutations, reconnect and snapshot resync, the update prompt without an automatic reload, manifest/installability, sign-out wiping device data, audit exclusion, uncached playback, and the real PMTiles pack with service-worker range responses.

## Lighthouse

Command (production preview, avoid tenant data by using `/login`):

```bash
npx lighthouse http://127.0.0.1:4174/login --chrome-flags="--headless" --only-categories=pwa,performance --output=json --output-path=/tmp/fleet-lighthouse.json
```

Result recorded with the version used: see the completion report. Lighthouse removed the dedicated PWA category in v12; installability is asserted in the PWA suite through Chromium's `Page.getInstallabilityErrors`, which must be empty.

## Limitations

- No offline writes, background sync or replay.
- Audit is never stored. A cold offline load shows `Audit isn't available offline`.
- Playback works only for ranges already in the in-memory query cache. A cold offline load cannot fetch history.
- Signing out wipes the whole device store. A second tab open on the same device is expected to be reloaded or signed out by the operator.
- iOS can evict IndexedDB and Cache Storage. The next online load reports the storage notice and re-caches.
- Glyph coverage stops at U+07FF. Exotic place names may render without glyphs offline.
- WebKit coverage needs system libraries that a locked-down local host may not have. The projects exist and CI runs them; local Chromium covers the same assertions except WebGL, which is Chromium-only.
- `e2e:pwa:webkit` requires `sudo npx playwright install-deps` on Linux.
