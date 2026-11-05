import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Alert, SnapshotVehicle } from "../../../api/types";
import { useLiveStore } from "../../../stores/live";
import { useMapData } from "./useMapData";

const vehicles: SnapshotVehicle[] = [
  {
    id: "uuid-1",
    external_id: "demo-imei-0001",
    plate: "LSD-100-AA",
    depot: "Lekki Depot",
    driver_name: "Adebayo Okafor",
    online: true,
    lat: 6.5,
    lon: 3.4,
    speed_kph: 48,
    heading_deg: 90,
    recorded_at: "2026-11-04T10:00:00Z",
    trip_status: "active",
  },
  {
    id: "uuid-2",
    external_id: "demo-imei-0002",
    plate: "TEST-101-AA",
    depot: "Apapa Depot",
    online: false,
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T10:00:05Z"));
  useLiveStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useMapData", () => {
  it("joins snapshot metadata and positions into rows and counts", () => {
    const { result } = renderHook(() =>
      useMapData({ snapshot: vehicles, alerts: [], selectedId: "uuid-1", hoveredKey: null }),
    );

    expect(result.current.total).toBe(2);
    expect(result.current.positioned).toBe(1);
    expect(result.current.online).toBe(1);
    expect(result.current.activeTrips).toBe(1);
    expect(result.current.rows[0]?.status).toBe("moving");
    expect(result.current.rows[0]?.driverName).toBe("Adebayo Okafor");
    expect(result.current.rows[1]?.status).toBe("offline");
    expect(result.current.rows[1]?.ageSeconds).toBeNull();
    expect(result.current.mapVehicles).toHaveLength(1);
    expect(result.current.mapVehicles[0]?.selected).toBe(true);
  });

  it("moves the map target immediately and the list on the next second", () => {
    const noAlerts: Alert[] = [];
    const { result } = renderHook(() =>
      useMapData({ snapshot: vehicles, alerts: noAlerts, selectedId: null, hoveredKey: null }),
    );

    act(() => {
      useLiveStore.getState().applySnapshot(vehicles, Date.now());
      useLiveStore.getState().applyFrames(
        [
          {
            type: "position",
            tenant_id: "tenant-demo",
            vehicle_id: "demo-imei-0001",
            lat: 6.7,
            lon: 3.6,
            recorded_at: "2026-11-04T10:00:06Z",
          },
        ],
        Date.now(),
      );
    });

    expect(result.current.mapVehicles[0]?.position).toEqual([3.6, 6.7]);
    expect(result.current.rows[0]?.lat).toBe(6.5);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.rows[0]?.lat).toBe(6.7);
    expect(result.current.rows[0]?.lon).toBe(3.6);
  });

  it("uses a recent alert to raise the display status", () => {
    const { result } = renderHook(() =>
      useMapData({
        snapshot: vehicles,
        alerts: [
          {
            id: "alert-1",
            vehicle_id: "uuid-1",
            plate: "LSD-100-AA",
            type: "geofence_exit",
            severity: "high",
            status: "open",
            occurred_at: "2026-11-04T10:00:00Z",
            evidence: {},
          },
        ],
        selectedId: null,
        hoveredKey: null,
      }),
    );

    expect(result.current.rows[0]?.status).toBe("alert");
  });
});
