import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../ui/Tooltip";
import { MapControls } from "./MapControls";

function renderControls(fitDisabled: boolean) {
  return render(
    <TooltipProvider>
      <MapControls
        panelOpen
        geofencesVisible
        fitDisabled={fitDisabled}
        onFit={vi.fn()}
        onTogglePanel={vi.fn()}
        onToggleGeofences={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe("MapControls", () => {
  it("explains why fit is unavailable instead of only disabling it", () => {
    renderControls(true);

    expect(
      screen.getByRole("button", { name: "No vehicles are reporting a position" }),
    ).toBeDisabled();
  });

  it("offers fit when a vehicle has a position", () => {
    renderControls(false);

    expect(screen.getByRole("button", { name: "Fit the fleet" })).toBeEnabled();
  });
});
