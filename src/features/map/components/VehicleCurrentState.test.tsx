import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { VehicleRow } from "../lib/filter";
import { VehicleCurrentState } from "./VehicleCurrentState";

const now = Date.now();

const row: VehicleRow = {
  id: "vehicle-1",
  key: "demo-imei-0001",
  plate: "LSD-100-AA",
  driverName: "Adebayo Okafor",
  depot: "Lekki Depot",
  online: true,
  lat: 6.5,
  lon: 3.4,
  recordedAt: new Date(now - 10_000).toISOString(),
  recordedAtMs: now - 10_000,
  speedKph: 62,
  speedReportedAtMs: now - 10_000,
  headingDeg: 272,
  status: "moving",
  freshness: "fresh",
  ageSeconds: 10,
  stale: false,
};

function renderState(value: VehicleRow) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <VehicleCurrentState row={value} />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("VehicleCurrentState", () => {
  it("shows status, speed, heading, last seen, online and coordinates", () => {
    renderState(row);

    expect(screen.getByText("Moving")).toBeVisible();
    expect(screen.getByText("62 km/h")).toBeVisible();
    expect(screen.getByText("272° W")).toBeVisible();
    expect(screen.getByText("Yes")).toBeVisible();
    expect(screen.getByText("6.50000, 3.40000")).toBeVisible();
    expect(screen.getByText(/1[01]s ago/)).toBeVisible();
  });

  it("shows a stale treatment and no position message", () => {
    renderState({
      ...row,
      status: "offline",
      online: false,
      freshness: "stale",
      stale: true,
      lat: null,
      lon: null,
      speedKph: null,
      headingDeg: null,
      recordedAt: null,
      recordedAtMs: null,
      ageSeconds: null,
    });

    expect(screen.getAllByText("Stale").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("No position reported.")).toBeVisible();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("restarts the flash when a live value changes without changing the values", () => {
    const { container, rerender } = renderState(row);
    expect(container.querySelector(".value-flash")).toBeNull();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <VehicleCurrentState row={{ ...row, speedKph: 64 }} />
        </ToastProvider>
      </TooltipProvider>,
    );

    expect(screen.getByText("64 km/h")).toBeVisible();
    expect(container.querySelector(".value-flash")).not.toBeNull();
  });
});
