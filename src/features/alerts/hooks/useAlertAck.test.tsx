import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import { queryKeys } from "../../../api/keys";
import { normalize } from "../../../errors/normalize";
import type { Alert } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { useAlertAck } from "./useAlertAck";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}

const alert: Alert = {
  id: "alert-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  type: "idle",
  severity: "high",
  status: "open",
  occurred_at: "2026-11-02T12:00:00Z",
  evidence: {},
};

describe("useAlertAck", () => {
  it("acknowledges and returns acked", async () => {
    vi.spyOn(api, "ackAlert").mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertAck({ canAck: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let outcome = "";
    await act(async () => {
      outcome = await result.current.acknowledge(alert);
    });
    expect(outcome).toBe("acked");
    expect(result.current.pendingId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("blocks a second submit while the first is in flight", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ack = vi.spyOn(api, "ackAlert").mockReturnValue(pending);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertAck({ canAck: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let first: Promise<string> | undefined;
    let second: Promise<string> | undefined;
    act(() => {
      first = result.current.acknowledge(alert);
      second = result.current.acknowledge(alert);
    });
    await expect(second).resolves.toBe("ignored");
    expect(ack).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.();
      await first;
    });
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it("distinguishes an alert still open after a 404", async () => {
    vi.spyOn(api, "ackAlert").mockRejectedValue(
      new ApiError(404, "not_found", "open alert not found"),
    );
    vi.spyOn(api, "alerts").mockResolvedValue({ data: [alert] });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertAck({ canAck: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let outcome = "";
    await act(async () => {
      outcome = await result.current.acknowledge(alert);
    });
    expect(outcome).toBe("still_open");
    expect(result.current.error?.detail).toBe("Try again.");
  });

  it("treats a 404 for an acked alert as acknowledged elsewhere", async () => {
    vi.spyOn(api, "ackAlert").mockRejectedValue(
      new ApiError(404, "not_found", "open alert not found"),
    );
    vi.spyOn(api, "alerts").mockResolvedValue({
      data: [{ ...alert, status: "acked", acked_at: "2026-11-02T12:01:00Z" }],
    });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertAck({ canAck: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let outcome = "";
    await act(async () => {
      outcome = await result.current.acknowledge(alert);
    });
    expect(outcome).toBe("already_acked");
  });

  it("treats a 404 for a missing alert as gone", async () => {
    vi.spyOn(api, "ackAlert").mockRejectedValue(
      new ApiError(404, "not_found", "open alert not found"),
    );
    vi.spyOn(api, "alerts").mockResolvedValue({ data: [] });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertAck({ canAck: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let outcome = "";
    await act(async () => {
      outcome = await result.current.acknowledge(alert);
    });
    expect(outcome).toBe("gone");
  });

  it("reports a lost response as not saved when the refetch shows it still open", async () => {
    vi.spyOn(api, "ackAlert").mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "alerts").mockResolvedValue({ data: [alert] });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertAck({ canAck: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let outcome = "";
    await act(async () => {
      outcome = await result.current.acknowledge(alert);
    });
    expect(outcome).toBe("unsaved");
    expect(result.current.error?.title).toBe("It wasn't saved.");
  });

  it("invalidates the alert caches when a lost response is reconciled as saved", async () => {
    vi.spyOn(api, "ackAlert").mockRejectedValue(
      normalize(new TypeError("Failed to fetch"), {}, { outcome: "unknown" }),
    );
    vi.spyOn(api, "alerts").mockResolvedValue({
      data: [{ ...alert, status: "acked", acked_at: "2026-11-02T12:01:00Z" }],
    });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAlertAck({ canAck: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let outcome = "";
    await act(async () => {
      outcome = await result.current.acknowledge(alert);
    });
    expect(outcome).toBe("acked");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["alerts"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.systemHealth });
  });

  it("refuses to send for a viewer or while offline", async () => {
    const ack = vi.spyOn(api, "ackAlert");
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertAck({ canAck: false }), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      expect(await result.current.acknowledge(alert)).toBe("forbidden");
    });
    expect(result.current.error?.detail).toBe("Your role can't acknowledge alerts.");
    expect(ack).not.toHaveBeenCalled();
  });
});
