import { onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPwaDebug, resetPwaDebug } from "../dev/debug";
import { resetWarmMapForTests, warmMap } from "./warmMap";

function response(ok = true): Partial<Response> {
  return { ok, status: ok ? 200 : 404 };
}

beforeEach(() => {
  resetWarmMapForTests();
  resetPwaDebug();
  onlineManager.setOnline(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("map warm-up", () => {
  it("fetches the pack once and stamps the cache time", async () => {
    const fetcher = vi.fn().mockResolvedValue(response());

    await expect(
      warmMap("/map/fleet.pmtiles", {
        fetcher: fetcher as unknown as typeof fetch,
        waitForController: async () => true,
        now: () => 1234,
      }),
    ).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readPwaDebug().mapCachedAt).toBe(1234);
  });

  it("suppresses a duplicate warm-up while one is in flight", async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    const options = {
      fetcher: fetcher as unknown as typeof fetch,
      waitForController: async () => true,
      now: () => 1,
    };

    const first = warmMap("/map/fleet.pmtiles", options);
    const second = warmMap("/map/fleet.pmtiles", options);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-warms when the cached pack was evicted even though the flag is set", async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    const options = {
      fetcher: fetcher as unknown as typeof fetch,
      waitForController: async () => true,
      isCached: async () => false,
      now: () => 1,
    };
    await expect(warmMap("/map/fleet.pmtiles", options)).resolves.toBe(true);
    await expect(warmMap("/map/fleet.pmtiles", options)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does nothing without a controller", async () => {
    const fetcher = vi.fn();
    await expect(
      warmMap("/map/fleet.pmtiles", {
        fetcher: fetcher as unknown as typeof fetch,
        waitForController: async () => false,
      }),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not attempt a warm-up while offline", async () => {
    onlineManager.setOnline(false);
    const fetcher = vi.fn();
    const onFailure = vi.fn();

    await expect(
      warmMap("/map/fleet.pmtiles", {
        fetcher: fetcher as unknown as typeof fetch,
        waitForController: async () => true,
        onFailure,
      }),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports one failure and retries on the next call", async () => {
    const onFailure = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(false))
      .mockResolvedValueOnce(response(true));
    const options = {
      fetcher: fetcher as unknown as typeof fetch,
      waitForController: async () => true,
      onFailure,
      now: () => 99,
    };

    await expect(warmMap("/map/fleet.pmtiles", options)).resolves.toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(1);

    await expect(warmMap("/map/fleet.pmtiles", options)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps quiet when the caller aborts", async () => {
    const onFailure = vi.fn();
    const controller = new AbortController();
    controller.abort();

    await expect(
      warmMap("/map/fleet.pmtiles", {
        signal: controller.signal,
        onFailure,
        fetcher: vi.fn() as unknown as typeof fetch,
        waitForController: async () => true,
      }),
    ).resolves.toBe(false);
    expect(onFailure).not.toHaveBeenCalled();
  });
});
