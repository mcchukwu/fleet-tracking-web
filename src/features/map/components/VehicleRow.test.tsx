import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { VehicleRow as VehicleRowData } from "../lib/filter";
import { VehicleRow } from "./VehicleRow";

const row: VehicleRowData = {
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
  speedReportedAtMs: Date.now() - 1_000,
  headingDeg: 90,
  status: "moving",
  freshness: "fresh",
  ageSeconds: 1,
  stale: false,
};

describe("VehicleRow", () => {
  it("keeps the hover cue while the pointer crosses the inline copy control", async () => {
    const onHover = vi.fn();
    render(
      <TooltipProvider>
        <ToastProvider>
          <VehicleRow row={row} height={56} selected={false} onSelect={vi.fn()} onHover={onHover} />
        </ToastProvider>
      </TooltipProvider>,
    );

    const select = screen.getByRole("button", { name: "Select LSD-100-AA" });
    await userEvent.hover(select);
    expect(onHover).toHaveBeenLastCalledWith(row.key);

    await userEvent.hover(screen.getByRole("button", { name: "Copy plate LSD-100-AA" }));
    expect(onHover).toHaveBeenLastCalledWith(row.key);
  });
});
