import { describe, expect, it, vi } from "vitest";
import { TimeoutPromiseError, withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  it("passes a resolved value through", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("rejects a hung promise", async () => {
    vi.useFakeTimers();
    const request = withTimeout(new Promise<string>(() => undefined), 2_000);
    const assertion = expect(request).rejects.toBeInstanceOf(TimeoutPromiseError);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    vi.useRealTimers();
  });

  it("keeps the original rejection", async () => {
    const failure = new Error("blocked");
    await expect(withTimeout(Promise.reject(failure), 50)).rejects.toBe(failure);
  });
});
