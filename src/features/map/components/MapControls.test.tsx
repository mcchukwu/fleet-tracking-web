import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../ui/Tooltip";
import { MapControls, type MapControlsProps } from "./MapControls";

function renderControls(overrides: Partial<MapControlsProps> = {}) {
  const props: MapControlsProps = {
    variant: "desktop",
    bearing: 0,
    zoom: 7,
    styles: ["standard", "satellite"],
    baseStyle: "standard",
    offline: false,
    panelOpen: true,
    geofencesVisible: true,
    fitDisabled: false,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onResetBearing: vi.fn(),
    onFit: vi.fn(),
    onTogglePanel: vi.fn(),
    onToggleGeofences: vi.fn(),
    onStyleChange: vi.fn(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <MapControls {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe("MapControls", () => {
  it("explains why fit is unavailable instead of only disabling it", () => {
    renderControls({ fitDisabled: true });

    expect(
      screen.getByRole("button", { name: "No vehicles are reporting a position" }),
    ).toBeDisabled();
  });

  it("zooms and resets the bearing through the contract", async () => {
    const user = userEvent.setup();
    const props = renderControls({ bearing: 90 });

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: /Reset bearing to north/ }));

    expect(props.onZoomIn).toHaveBeenCalledOnce();
    expect(props.onZoomOut).toHaveBeenCalledOnce();
    expect(props.onResetBearing).toHaveBeenCalledOnce();
  });

  it("announces the current bearing and dims the control at north", () => {
    const { rerender } = render(
      <TooltipProvider>
        <MapControls
          variant="desktop"
          bearing={90}
          zoom={7}
          styles={["standard"]}
          baseStyle="standard"
          offline={false}
          panelOpen
          geofencesVisible
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onResetBearing={vi.fn()}
          onFit={vi.fn()}
          onTogglePanel={vi.fn()}
          onToggleGeofences={vi.fn()}
          onStyleChange={vi.fn()}
        />
      </TooltipProvider>,
    );

    const east = screen.getByRole("button", { name: "Reset bearing to north (Facing 90° E)" });
    expect(east).not.toHaveClass("opacity-60");

    rerender(
      <TooltipProvider>
        <MapControls
          variant="desktop"
          bearing={0}
          zoom={7}
          styles={["standard"]}
          baseStyle="standard"
          offline={false}
          panelOpen
          geofencesVisible
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onResetBearing={vi.fn()}
          onFit={vi.fn()}
          onTogglePanel={vi.fn()}
          onToggleGeofences={vi.fn()}
          onStyleChange={vi.fn()}
        />
      </TooltipProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Reset bearing to north (Facing north)" }),
    ).toHaveClass("opacity-60");
  });

  it("disables zoom at the configured limits with a reason", () => {
    renderControls({ zoom: 18 });
    expect(screen.getByRole("button", { name: "Maximum zoom" })).toBeDisabled();
  });

  it("keeps the mobile stack to zoom, bearing and style", () => {
    renderControls({ variant: "mobile" });

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Reset bearing/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Map style" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Fit the fleet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /geofences/ })).not.toBeInTheDocument();
  });

  it("becomes inert and transparent when the sheet obscures it", async () => {
    const user = userEvent.setup();
    const { rerender, container } = render(
      <TooltipProvider>
        <MapControls
          variant="mobile"
          bearing={0}
          zoom={7}
          styles={["standard", "satellite"]}
          baseStyle="standard"
          offline={false}
          panelOpen
          geofencesVisible
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onResetBearing={vi.fn()}
          onFit={vi.fn()}
          onTogglePanel={vi.fn()}
          onToggleGeofences={vi.fn()}
          onStyleChange={vi.fn()}
        />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Map style" }));
    expect(screen.getByRole("menu")).toBeVisible();

    rerender(
      <TooltipProvider>
        <MapControls
          variant="mobile"
          bearing={0}
          zoom={7}
          styles={["standard", "satellite"]}
          baseStyle="standard"
          offline={false}
          obscured
          panelOpen
          geofencesVisible
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onResetBearing={vi.fn()}
          onFit={vi.fn()}
          onTogglePanel={vi.fn()}
          onToggleGeofences={vi.fn()}
          onStyleChange={vi.fn()}
        />
      </TooltipProvider>,
    );

    const stack = container.querySelector("fieldset");
    expect(stack).toHaveAttribute("inert");
    expect(stack).toHaveClass("opacity-0");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
