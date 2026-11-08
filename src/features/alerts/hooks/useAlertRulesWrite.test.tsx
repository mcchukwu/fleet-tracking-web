import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/instance";
import type { AlertRule } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { useConnectionStore } from "../../../stores/connection";
import { ToastProvider } from "../../../ui/Toast";
import { useAlertRulesWrite } from "./useAlertRulesWrite";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}

const rule: AlertRule = {
  id: "rule-1",
  type: "speeding",
  enabled: true,
  config: { speed_kph: 80, duration_s: 120 },
};

beforeEach(() => {
  useConnectionStore.setState({ network: "online" });
});

describe("useAlertRulesWrite", () => {
  it("toggles and saves the full config", async () => {
    const update = vi.spyOn(api, "updateAlertRule").mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertRulesWrite({ canMutate: true }), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      expect(await result.current.toggle(rule, false)).toBe("saved");
    });
    expect(update).toHaveBeenCalledWith("rule-1", { enabled: false });

    await act(async () => {
      expect(
        await result.current.saveConfig(rule, { speed_kph: 81, duration_s: 120 }),
      ).toBe("saved");
    });
    expect(update).toHaveBeenLastCalledWith("rule-1", {
      config: { speed_kph: 81, duration_s: 120 },
    });
  });

  it("blocks a second write while one is in flight", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const update = vi.spyOn(api, "updateAlertRule").mockReturnValue(pending);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertRulesWrite({ canMutate: true }), {
      wrapper: wrapperFor(queryClient),
    });

    let first: Promise<string> | undefined;
    let second: Promise<string> | undefined;
    act(() => {
      first = result.current.toggle(rule, false);
      second = result.current.toggle(rule, true);
    });
    await expect(second).resolves.toBe("ignored");
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => {
      release?.();
      await first;
    });
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it("explains a forbidden write inline and sends nothing", async () => {
    const update = vi.spyOn(api, "updateAlertRule");
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertRulesWrite({ canMutate: false }), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      expect(await result.current.toggle(rule, false)).toBe("failed");
    });
    expect(result.current.error?.detail).toBe("Your role can't change alert rules.");
    expect(update).not.toHaveBeenCalled();
  });

  it("explains an offline write and refuses to send", async () => {
    useConnectionStore.setState({ network: "offline" });
    const update = vi.spyOn(api, "updateAlertRule");
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertRulesWrite({ canMutate: true }), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      expect(await result.current.toggle(rule, false)).toBe("failed");
    });
    expect(result.current.error?.detail).toBe("Changes are disabled until you're back online.");
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the server state and reports a server failure", async () => {
    vi.spyOn(api, "updateAlertRule").mockRejectedValue(
      new ApiError(500, "internal", "boom"),
    );
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useAlertRulesWrite({ canMutate: true }), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      expect(await result.current.toggle(rule, false)).toBe("failed");
    });
    expect(result.current.error?.ruleId).toBe("rule-1");
    expect(result.current.error?.detail).toBe("Try again in a moment. If it keeps happening, check System.");
  });
});
