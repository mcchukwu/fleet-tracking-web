/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { createPartialResponse } from "workbox-range-requests";
import type { WorkboxPlugin } from "workbox-core";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

const version = import.meta.env.VITE_APP_VERSION ?? "dev";
const packCache = `fleet-map-pack-${version}`;
const assetCache = `fleet-map-assets-${version}`;

self.addEventListener("message", (event) => {
  const data = (event as ExtendableMessageEvent).data as { type?: unknown } | null;
  if (data?.type === "SKIP_WAITING") void self.skipWaiting();
});

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//],
  }),
);

const rangePlugin: WorkboxPlugin = {
  async cachedResponseWillBeUsed({ request, cachedResponse }) {
    if (!cachedResponse || !request.headers.has("range")) return cachedResponse;
    return createPartialResponse(request, cachedResponse);
  },
};

registerRoute(
  ({ url }) => url.pathname.endsWith(".pmtiles"),
  new CacheFirst({
    cacheName: packCache,
    plugins: [
      new ExpirationPlugin({ maxEntries: 2 }),
      new CacheableResponsePlugin({ statuses: [200] }),
      rangePlugin,
    ],
  }),
  "GET",
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/map/"),
  new CacheFirst({
    cacheName: assetCache,
    plugins: [
      new ExpirationPlugin({ maxEntries: 64 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
  "GET",
);
