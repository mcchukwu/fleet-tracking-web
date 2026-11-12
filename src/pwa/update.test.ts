import { describe, expect, it, vi } from "vitest";
import { activateUpdate, clearUpdateHandler, hasUpdateHandler, setUpdateHandler } from "./update";

describe("update activation", () => {
  it("calls the registered service worker update function", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    setUpdateHandler(update);

    expect(hasUpdateHandler()).toBe(true);
    activateUpdate();

    expect(update).toHaveBeenCalledWith(true);
    clearUpdateHandler();
  });

  it("falls back to a plain reload when no worker is registered", () => {
    clearUpdateHandler();
    const reload = vi.fn();

    activateUpdate(reload);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(hasUpdateHandler()).toBe(false);
  });
});
