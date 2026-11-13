import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
import type { Alert } from "../../../api/types";
import { emptyAlertFilters, type AlertFilterValues } from "../lib/filter";
import { useAlertFeed } from "./useAlertFeed";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function row(id: string, occurred: string, severity = "high"): Alert {
  return {
    id,
    vehicle_id: "v-1",
    plate: "LSD-101-AA",
    type: "idle",
    severity,
    status: "open",
    occurred_at: occurred,
    evidence: {},
  };
}

function hydrate(queryClient: QueryClient, rows: Alert[]): void {
  queryClient.setQueryData(queryKeys.alertsFeed({}), {
    pages: [rows],
    pageParams: [0],
  });
}

describe("useAlertFeed", () => {
  it("freezes the list while scrolled and reveals pending rows on request", async () => {
    const first = [row("a", "2026-11-02T12:00:00Z"), row("b", "2026-11-02T11:00:00Z")];
    vi.spyOn(api, "alerts").mockResolvedValue({ data: first });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAlertFeed(emptyAlertFilters), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() =>
      expect(result.current.visible.map((alert) => alert.id)).toEqual(["a", "b"]),
    );

    act(() => result.current.setAtTop(false));
    hydrate(queryClient, [row("c", "2026-11-02T13:00:00Z"), ...first]);

    await waitFor(() => expect(result.current.newCount).toBe(1));
    expect(result.current.visible.map((alert) => alert.id)).toEqual(["a", "b"]);

    act(() => result.current.revealNew());
    await waitFor(() =>
      expect(result.current.visible.map((alert) => alert.id)).toEqual(["c", "a", "b"]),
    );
    expect(result.current.newCount).toBe(0);
    expect([...result.current.highlightIds]).toEqual(["c"]);
  });

  it("does not highlight the first load", async () => {
    vi.spyOn(api, "alerts").mockResolvedValue({
      data: [row("a", "2026-11-02T12:00:00Z")],
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAlertFeed(emptyAlertFilters), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.visible).toHaveLength(1));
    expect(result.current.highlightIds.size).toBe(0);
  });

  it("resets the freeze when a client filter changes", async () => {
    const rows = [row("a", "2026-11-02T12:00:00Z"), row("b", "2026-11-02T11:00:00Z", "low")];
    vi.spyOn(api, "alerts").mockResolvedValue({ data: rows });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      ({ filters }: { filters: AlertFilterValues }) => useAlertFeed(filters),
      { wrapper: wrapperFor(queryClient), initialProps: { filters: emptyAlertFilters } },
    );

    await waitFor(() => expect(result.current.visible).toHaveLength(2));
    act(() => result.current.setAtTop(false));

    rerender({ filters: { ...emptyAlertFilters, severity: "low" } });
    await waitFor(() =>
      expect(result.current.visible.map((alert) => alert.id)).toEqual(["a", "b"]),
    );
    expect(result.current.newCount).toBe(0);
  });
});
