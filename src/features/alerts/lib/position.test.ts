import { describe, expect, it } from "vitest";
import type { Geofence, Point } from "../../../api/types";
import { formatClockTime } from "../../../lib/format";
import {
  evidenceCoordinates,
  geofenceForAlert,
  nearestPoint,
  positionBounds,
  positionSourceLabel,
} from "./position";

const point = (t: string, lat = 6.45, lon = 3.39): Point => ({
  t,
  lat,
  lon,
  speed_kph: 40,
  heading_deg: 90,
});

const geofence: Geofence = {
  id: "gf-1",
  name: "Lekki Depot",
  kind: "depot",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [3.47, 6.43],
        [3.49, 6.43],
        [3.49, 6.445],
        [3.47, 6.43],
      ],
    ],
  },
};

describe("alert position", () => {
  it("reads lat/lon and latitude/longitude from evidence", () => {
    expect(evidenceCoordinates({ lat: 6.5, lon: 3.4 })).toEqual({ lat: 6.5, lon: 3.4 });
    expect(evidenceCoordinates({ latitude: 6.5, longitude: 3.4 })).toEqual({
      lat: 6.5,
      lon: 3.4,
    });
  });

  it("rejects missing and out-of-range evidence coordinates", () => {
    expect(evidenceCoordinates({})).toBeNull();
    expect(evidenceCoordinates({ lat: 91, lon: 3.4 })).toBeNull();
    expect(evidenceCoordinates({ lat: 6.5, lon: 181 })).toBeNull();
    expect(evidenceCoordinates({ lat: "6.5", lon: 3.4 })).toBeNull();
    expect(evidenceCoordinates({ lat: Number.NaN, lon: 3.4 })).toBeNull();
  });

  it("picks the nearest point inside the window", () => {
    const occurred = "2026-11-02T20:07:00Z";
    const points = [
      point("2026-11-02T20:04:00Z", 1, 1),
      point("2026-11-02T20:06:30Z", 2, 2),
      point("2026-11-02T20:08:00Z", 3, 3),
    ];
    expect(nearestPoint(points, occurred, 2 * 60_000)?.lat).toBe(2);
    expect(nearestPoint(points, occurred, 29_000)).toBeNull();
    expect(nearestPoint([], occurred, 2 * 60_000)).toBeNull();
    expect(nearestPoint(null, occurred, 2 * 60_000)).toBeNull();
  });

  it("breaks a tie towards the earlier point", () => {
    const occurred = "2026-11-02T20:07:00Z";
    const points = [point("2026-11-02T20:06:00Z", 1, 1), point("2026-11-02T20:08:00Z", 2, 2)];
    expect(nearestPoint(points, occurred, 2 * 60_000)?.lat).toBe(1);
  });

  it("finds the geofence behind the evidence id", () => {
    expect(geofenceForAlert({ geofence_id: "gf-1" }, [geofence])?.name).toBe("Lekki Depot");
    expect(geofenceForAlert({ geofence_id: "gone" }, [geofence])).toBeNull();
    expect(geofenceForAlert({}, [geofence])).toBeNull();
  });

  it("builds bounds around the position and the highlighted geofence", () => {
    const withoutFence = positionBounds({ lat: 6.45, lon: 3.39 }, null);
    expect(withoutFence).toEqual({ south: 6.45, west: 3.39, north: 6.45, east: 3.39 });

    const withFence = positionBounds({ lat: 6.45, lon: 3.39 }, geofence);
    expect(withFence).toEqual({ south: 6.43, west: 3.39, north: 6.45, east: 3.49 });
  });

  it("labels the position source honestly", () => {
    expect(positionSourceLabel("evidence")).toBe("From alert evidence");
    expect(positionSourceLabel("history", "2026-11-02T20:06:00Z")).toBe(
      `Nearest position at ${formatClockTime(Date.parse("2026-11-02T20:06:00Z"))}`,
    );
    expect(positionSourceLabel("history")).toBe("Nearest recorded position");
  });
});
