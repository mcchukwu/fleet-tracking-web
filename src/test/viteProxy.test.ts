import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createApiProxy } from "../../vite.config";

describe("dev API proxy", () => {
  it("rewrites the Origin header on WebSocket upgrades to the proxy target", () => {
    const options = createApiProxy("https://fleet-demo.example");
    const proxy = new EventEmitter();
    const setHeader = vi.fn();

    options.configure?.(proxy as never, options);
    proxy.emit("proxyReqWs", { setHeader }, {}, {}, {});

    expect(setHeader).toHaveBeenCalledWith("Origin", "https://fleet-demo.example");
  });
});
