import { expect, test as base, type WebSocketRoute } from "@playwright/test";
import { setStoredTheme, type ReviewTheme } from "./helpers";

export interface LiveSocketHarness {
  sockets: WebSocketRoute[];
  wait: () => Promise<WebSocketRoute>;
  latest: () => WebSocketRoute | undefined;
  send: (message: unknown) => Promise<void>;
  close: () => Promise<void>;
}

export const test = base.extend<{ theme: ReviewTheme; liveSocket: LiveSocketHarness }>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern.
  theme: async ({}, use, testInfo) => {
    await use(testInfo.project.name.includes("dark") ? "dark" : "light");
  },
  liveSocket: [
    async ({ page }, use) => {
      const sockets: WebSocketRoute[] = [];
      await page.routeWebSocket(/\/api\/v1\/live\/ws$/, (socket) => {
        sockets.push(socket);
      });

      const wait = async (): Promise<WebSocketRoute> => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const socket = sockets[sockets.length - 1];
          if (socket) return socket;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("The live socket did not open");
      };

      await use({
        sockets,
        wait,
        latest: () => sockets[sockets.length - 1],
        send: async (message) => {
          const socket = await wait();
          socket.send(JSON.stringify(message));
        },
        close: async () => {
          const socket = await wait();
          await socket.close();
        },
      });
    },
    { auto: true },
  ],
  page: async ({ page, theme }, use, testInfo) => {
    await setStoredTheme(page, theme);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await use(page);
    if (!testInfo.tags.includes("@fault")) {
      expect(
        pageErrors,
        "unhandled page error or rejection; tag a deliberately failing test @fault",
      ).toEqual([]);
    }
  },
});

export { expect };
