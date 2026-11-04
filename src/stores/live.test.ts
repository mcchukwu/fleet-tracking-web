import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotVehicle } from "../api/types";
import { useLiveStore } from "./live";

const NOW = Date.parse("2026-11-04T10:00:00Z");

function snapshotVehicle(overrides: Partial<SnapshotVehicle> = {}): SnapshotVehicle {
  return {
    id: "uuid-1",
    external_id: "demo-imei-0001",
    plate: "LSD-100-AA",
    depot: "Lekki Depot",
    online: true,
    lat: 6.5,
    lon: 3.4,
    speed_kph: 48,
    heading_deg: 90,
    recorded_at: "2026-11-04T09:59:30Z",
    ...overrides,
  };
}

function frame(recordedAt: string, lat = 6.6, lon = 3.5) {
  return {
    type: "position" as const,
    tenant_id: "tenant-demo",
    vehicle_id: "demo-imei-0001",
    lat,
    lon,
    recorded_at: recordedAt,
  };
}

beforeEach(() => {
  useLiveStore.getState().reset();
});

describe("live store", () => {
  it("seeds positions from the snapshot", () => {
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);
    const position = useLiveStore.getState().positions["demo-imei-0001"];
    expect(position?.lat).toBe(6.5);
    expect(position?.speedKph).toBe(48);
    expect(position?.headingDeg).toBe(90);
    expect(position?.positionAt).toBe(Date.parse("2026-11-04T09:59:30Z"));
  });

  it("applies a newer frame and ignores an older or equal one", () => {
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);

    useLiveStore
      .getState()
      .applyFrames([frame("2026-11-04T09:59:40Z", 6.6, 3.5)], NOW);
    expect(useLiveStore.getState().positions["demo-imei-0001"]?.lat).toBe(6.6);

    useLiveStore
      .getState()
      .applyFrames([frame("2026-11-04T09:59:35Z", 6.1, 3.1)], NOW);
    expect(useLiveStore.getState().positions["demo-imei-0001"]?.lat).toBe(6.6);

    useLiveStore
      .getState()
      .applyFrames([frame("2026-11-04T09:59:40Z", 6.2, 3.2)], NOW);
    expect(useLiveStore.getState().positions["demo-imei-0001"]?.lat).toBe(6.6);
  });

  it("keeps the last snapshot speed and heading after a frame without them", () => {
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);
    useLiveStore
      .getState()
      .applyFrames([frame("2026-11-04T09:59:40Z")], NOW);

    const position = useLiveStore.getState().positions["demo-imei-0001"];
    expect(position?.speedKph).toBe(48);
    expect(position?.headingDeg).toBe(90);
    expect(position?.speedAt).toBe(Date.parse("2026-11-04T09:59:30Z"));
  });

  it("does not overwrite a newer live position with an older snapshot", () => {
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);
    useLiveStore
      .getState()
      .applyFrames([frame("2026-11-04T09:59:50Z", 6.9, 3.9)], NOW);
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);

    expect(useLiveStore.getState().positions["demo-imei-0001"]?.lat).toBe(6.9);
  });

  it("ignores frames for unknown vehicles and counts them", () => {
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);
    useLiveStore
      .getState()
      .applyFrames(
        [{ ...frame("2026-11-04T09:59:40Z"), vehicle_id: "not-in-snapshot" }],
        NOW,
      );

    expect(useLiveStore.getState().positions["not-in-snapshot"]).toBeUndefined();
    expect(useLiveStore.getState().unknownKeys).toBe(1);
  });

  it("writes once per batch and counts frames", () => {
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);
    const listener = vi.fn();
    const unsubscribe = useLiveStore.subscribe(listener);

    useLiveStore
      .getState()
      .applyFrames(
        [
          frame("2026-11-04T09:59:40Z"),
          { ...frame("2026-11-04T09:59:41Z"), vehicle_id: "other" },
        ],
        NOW,
      );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(useLiveStore.getState().frameCount).toBe(2);
    expect(useLiveStore.getState().batchCount).toBe(1);
    unsubscribe();
  });

  it("marks an alert frame and resets everything", () => {
    useLiveStore.getState().applySnapshot([snapshotVehicle()], NOW);
    useLiveStore.getState().markAlert("demo-imei-0001", NOW);
    expect(useLiveStore.getState().positions["demo-imei-0001"]?.alertMarkedAt).toBe(NOW);

    useLiveStore.getState().reset();
    expect(useLiveStore.getState().positions).toEqual({});
    expect(useLiveStore.getState().frameCount).toBe(0);
  });

  it("applies 5,000 rows in one batch", () => {
    const rows = Array.from({ length: 5_000 }, (_, index) =>
      snapshotVehicle({
        id: `uuid-${index}`,
        external_id: `demo-imei-${index}`,
        plate: `LSD-${index}`,
      }),
    );
    useLiveStore.getState().applySnapshot(rows, NOW);
    expect(Object.keys(useLiveStore.getState().positions)).toHaveLength(5_000);
  });
});
