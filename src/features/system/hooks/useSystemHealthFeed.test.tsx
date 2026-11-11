import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import { systemHealthFixture } from "../../../mocks/fixtures/untyped";
import { useConnectionStore } from "../../../stores/connection";
import { SYSTEM_HEALTH_POLL_MS } from "../lib/constants";
import { useSystemHealthFeed } from "./useSystemHealthFeed";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function setVisibility(value: "visible" | "hidden", notify = true): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
  if (notify) document.dispatchEvent(new Event("visibilitychange"));
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useConnectionStore.setState({ network: "online" });
  setVisibility("visible", false);
});

afterEach(() => {
  vi.useRealTimers();
  useConnectionStore.setState({ network: "online" });
  setVisibility("visible", false);
});

describe("useSystemHealthFeed", () => {
  it("polls every 10s while visible and pauses while hidden", async () => {
    const health = vi
      .spyOn(api, "systemHealth")
      .mockResolvedValue(systemHealthFixture);
    const { result } = renderHook(() => useSystemHealthFeed(), {
      wrapper: wrapperFor(client()),
    });

    await flush();
    expect(result.current.data).toBeDefined();
    expect(health).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYSTEM_HEALTH_POLL_MS);
    });
    expect(health).toHaveBeenCalledTimes(2);

    act(() => setVisibility("hidden"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(health).toHaveBeenCalledTimes(2);

    act(() => setVisibility("visible"));
    await flush();
    expect(health).toHaveBeenCalledTimes(3);
  });

  it("does not poll a document that was hidden before mount", async () => {
    setVisibility("hidden", false);
    const health = vi
      .spyOn(api, "systemHealth")
      .mockResolvedValue(systemHealthFixture);
    renderHook(() => useSystemHealthFeed(), { wrapper: wrapperFor(client()) });

    await flush();
    expect(health).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("disables the query while offline and fetches on reconnect", async () => {
    useConnectionStore.setState({ network: "offline" });
    const health = vi
      .spyOn(api, "systemHealth")
      .mockResolvedValue(systemHealthFixture);
    renderHook(() => useSystemHealthFeed(), { wrapper: wrapperFor(client()) });

    await flush();
    expect(health).not.toHaveBeenCalled();

    act(() => useConnectionStore.setState({ network: "online" }));
    await flush();
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("cancels the first load and a retry starts one request", async () => {
    const health = vi
      .spyOn(api, "systemHealth")
      .mockImplementation(
        (options = {}) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      );
    const { result } = renderHook(() => useSystemHealthFeed(), {
      wrapper: wrapperFor(client()),
    });

    await flush();
    expect(result.current.isFetching).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.cancelled).toBe(true);
    await flush();

    health.mockResolvedValue(systemHealthFixture);
    act(() => result.current.refetch());
    await flush();
    expect(result.current.cancelled).toBe(false);
    expect(result.current.data).toBeDefined();
  });
});
