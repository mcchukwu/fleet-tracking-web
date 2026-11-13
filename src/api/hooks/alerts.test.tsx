import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import { useAlertFeed, useAlertLookup } from "./alerts";
import type { Alert } from "../types";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function row(index: number): Alert {
  return {
    id: `alert-${index}`,
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    type: "idle",
    severity: "low",
    status: "open",
    occurred_at: new Date(2026, 10, 2, 12, 0, index).toISOString(),
    evidence: {},
  };
}

describe("alert feed query", () => {
  it("requests a full page, then stops because the next page is short", async () => {
    const alerts = vi.spyOn(api, "alerts").mockImplementation((filters = {}) => {
      const offset = filters.offset ?? 0;
      return Promise.resolve({
        data: Array.from({ length: offset === 0 ? 500 : 3 }, (_, index) => row(offset + index)),
      });
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAlertFeed({ status: "open" }), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(alerts).toHaveBeenCalledWith(
      { status: "open", limit: 500, offset: 0 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(alerts).toHaveBeenLastCalledWith(
      { status: "open", limit: 500, offset: 500 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("alert lookup query", () => {
  it("stays idle when there is no selected alert", () => {
    const alerts = vi.spyOn(api, "alerts");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAlertLookup(null), {
      wrapper: wrapperFor(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(alerts).not.toHaveBeenCalled();
  });

  it("finds an alert that is outside the current feed and returns null for a stranger", async () => {
    vi.spyOn(api, "alerts").mockResolvedValue({ data: [row(1), row(2)] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(({ id }: { id: string }) => useAlertLookup(id), {
      wrapper: wrapperFor(queryClient),
      initialProps: { id: "alert-2" },
    });

    await waitFor(() => expect(result.current.data?.id).toBe("alert-2"));

    rerender({ id: "missing" });
    await waitFor(() => expect(result.current.data).toBeNull());
  });
});
