import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Alert, Point } from "../../../api/types";
import { useAlertPosition } from "./useAlertPosition";

const mocks = vi.hoisted(() => ({
  history: {
    data: undefined as { data: Point[]; resolution: string } | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useVehicleHistory: () => mocks.history,
}));

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  id: "alert-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  type: "idle",
  severity: "high",
  status: "open",
  occurred_at: "2026-11-02T20:07:00Z",
  evidence: {},
  ...overrides,
});

const point = (t: string, lat = 6.45, lon = 3.39): Point => ({
  t,
  lat,
  lon,
  speed_kph: 40,
  heading_deg: 90,
});

beforeEach(() => {
  mocks.history.data = undefined;
  mocks.history.isLoading = false;
  mocks.history.isError = false;
  mocks.history.error = null;
  mocks.history.refetch.mockReset();
});

describe("useAlertPosition", () => {
  it("prefers evidence coordinates", () => {
    const { result } = renderHook(() =>
      useAlertPosition(alert({ evidence: { lat: 6.5, lon: 3.4 } }), []),
    );
    expect(result.current.state).toMatchObject({
      status: "evidence",
      position: { lat: 6.5, lon: 3.4 },
    });
  });

  it("uses the nearest history point inside the window", () => {
    mocks.history.data = {
      data: [point("2026-11-02T20:06:30Z", 6.46, 3.41)],
      resolution: "30s",
    };
    const { result } = renderHook(() => useAlertPosition(alert(), []));
    expect(result.current.state).toMatchObject({
      status: "history",
      position: { lat: 6.46, lon: 3.41 },
    });
  });

  it("reports loading, unavailable and a retryable error", () => {
    mocks.history.isLoading = true;
    const pending = renderHook(() => useAlertPosition(alert(), []));
    expect(pending.result.current.state).toEqual({ status: "loading" });

    mocks.history.isLoading = false;
    mocks.history.data = { data: [], resolution: "30s" };
    const empty = renderHook(() => useAlertPosition(alert(), []));
    expect(empty.result.current.state).toEqual({ status: "unavailable" });
    empty.result.current.retry();
    expect(mocks.history.refetch).toHaveBeenCalled();

    mocks.history.isError = true;
    mocks.history.data = undefined;
    mocks.history.error = new TypeError("Failed to fetch");
    const failed = renderHook(() => useAlertPosition(alert(), []));
    expect(failed.result.current.state.status).toBe("error");
    failed.result.current.retry();
    expect(mocks.history.refetch).toHaveBeenCalledTimes(2);
  });

  it("does not pretend to know an invalid alert time", () => {
    const { result } = renderHook(() => useAlertPosition(alert({ occurred_at: "not-a-date" }), []));
    expect(result.current.state).toEqual({ status: "unavailable" });
  });
});
