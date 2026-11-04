import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapTooltip, tooltipStyle } from "./MapTooltip";
import type { VehicleRow } from "../lib/filter";

const row: VehicleRow = {
  id: "uuid-1",
  key: "demo-imei-0001",
  plate: "LSD-100-AA",
  driverName: "Ada",
  depot: "Lekki Depot",
  online: true,
  lat: 6.5,
  lon: 3.4,
  recordedAt: new Date().toISOString(),
  recordedAtMs: Date.now(),
  speedKph: 62,
  speedReportedAtMs: Date.now() - 60_000,
  headingDeg: 90,
  status: "moving",
  freshness: "fresh",
  ageSeconds: 2,
  stale: false,
};

describe("MapTooltip", () => {
  it("discloses when the frozen speed was reported", () => {
    render(<MapTooltip row={row} point={{ x: 20, y: 20 }} />);
    expect(screen.getByText("62 km/h · reported 1m ago")).toBeInTheDocument();
    expect(screen.getByText("Position 2s ago")).toBeInTheDocument();
  });

  it("does not render a missing age as '— ago'", () => {
    render(
      <MapTooltip
        row={{ ...row, speedKph: null, speedReportedAtMs: null, ageSeconds: null }}
        point={{ x: 20, y: 20 }}
      />,
    );
    expect(screen.getByText("No speed reported")).toBeInTheDocument();
    expect(screen.getByText("No position reported")).toBeInTheDocument();
  });

  it("clamps the tooltip inside the map container", () => {
    expect(tooltipStyle({ x: 380, y: 900 }, { width: 390, height: 844 }, { width: 200, height: 60 })).toEqual({
      left: 182,
      top: 776,
    });
    expect(tooltipStyle({ x: 2, y: 4 }, { width: 390, height: 844 }, { width: 200, height: 60 })).toEqual({
      left: 16,
      top: 8,
    });
  });
});
