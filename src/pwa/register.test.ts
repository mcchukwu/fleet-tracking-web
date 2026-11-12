import { describe, expect, it, vi } from "vitest";
import { registerSW } from "virtual:pwa-register";
import { startPwa } from "./register";
import { activateUpdate, clearUpdateHandler } from "./update";
import { readPwaDebug, resetPwaDebug } from "../dev/debug";

vi.mock("virtual:pwa-register", () => ({ registerSW: vi.fn() }));

const registerMock = vi.mocked(registerSW);

function optionsOf() {
  const call = registerMock.mock.calls[0];
  if (!call) throw new Error("registerSW was not called");
  return call[0]!;
}

describe("service worker registration", () => {
  it("stays silent in development unless VITE_SW_DEV is set", () => {
    registerMock.mockClear();
    startPwa({ env: { dev: true, swDev: false } });
    expect(registerMock).not.toHaveBeenCalled();

    startPwa({ env: { dev: true, swDev: true } });
    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it("registers with the prompt flow and exposes the update function", async () => {
    resetPwaDebug();
    const update = vi.fn().mockResolvedValue(undefined);
    registerMock.mockReturnValue(update);

    startPwa({ env: { dev: false, swDev: false } });

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(readPwaDebug().serviceWorker).toBe("registering");

    optionsOf().onRegisteredSW?.("sw.js", undefined);
    expect(readPwaDebug().serviceWorker).toBe("ready");
    activateUpdate();
    expect(update).toHaveBeenCalledWith(true);
    clearUpdateHandler();
  });

  it("announces an update instead of reloading", () => {
    resetPwaDebug();
    const listener = vi.fn();
    window.addEventListener("fleet:update-available", listener);
    registerMock.mockReturnValue(vi.fn().mockResolvedValue(undefined));

    startPwa({ env: { dev: false, swDev: false } });
    optionsOf().onNeedRefresh?.();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(readPwaDebug().updateAvailable).toBe(true);
    window.removeEventListener("fleet:update-available", listener);
  });

  it("reports a registration failure without blocking the app", () => {
    resetPwaDebug();
    registerMock.mockReturnValue(vi.fn().mockResolvedValue(undefined));

    startPwa({ env: { dev: false, swDev: false } });
    optionsOf().onRegisterError?.(new Error("blocked"));

    expect(readPwaDebug().serviceWorker).toBe("error");
  });
});
