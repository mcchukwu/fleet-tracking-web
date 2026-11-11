import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import { queryKeys } from "../keys";
import { useReportSummary } from "./reports";

const from = "2026-11-01T00:00:00Z";
const to = "2026-11-08T00:00:00Z";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const summary = {
  vehicles: 25,
  trips: 5,
  completed_trips: 1,
  active_trips: 4,
  alerts: 66,
  open_alerts: 45,
  distance_km: 10917.07,
  alerts_by_type: [{ key: "speeding", count: 4 }],
};

describe("report summary query", () => {
  it("requests the range with an abort signal under the report key", async () => {
    const request = vi.spyOn(api, "reportSummary").mockResolvedValue(summary);
    const queryClient = client();
    const { result } = renderHook(() => useReportSummary(from, to), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith(
      from,
      to,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(queryKeys.reports(from, to)).toEqual(["reports", from, to]);
    expect(result.current.data?.trips).toBe(5);
  });

  it("does not request while disabled", async () => {
    const request = vi.spyOn(api, "reportSummary").mockResolvedValue(summary);
    const { result } = renderHook(() => useReportSummary(from, to, false), {
      wrapper: wrapperFor(client()),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(request).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("refetches the same range when the report root is invalidated", async () => {
    const request = vi.spyOn(api, "reportSummary").mockResolvedValue(summary);
    const queryClient = client();
    renderHook(() => useReportSummary(from, to), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await queryClient.invalidateQueries({ queryKey: ["reports"] });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
});
