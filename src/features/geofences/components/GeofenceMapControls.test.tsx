import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mapConfig } from "../../../map/config";
import type { MapAdapter, Viewport } from "../../../map/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { GeofenceMapControls } from "./GeofenceMapControls";

const zoomIn = vi.fn();
const zoomOut = vi.fn();
const viewport = (zoom: number): Viewport => ({
  center: [3.4, 6.5],
  zoom,
  bearing: 0,
  bounds: { south: 6, west: 3, north: 7, east: 4 },
});
const adapter = {
  zoomIn,
  zoomOut,
  getViewport: () => viewport(10),
  on: () => () => undefined,
} as unknown as MapAdapter;

function renderControls(overrides: { adapter?: MapAdapter | null; fitDisabled?: boolean } = {}) {
  const onFitAll = vi.fn();
  render(
    <TooltipProvider>
      <GeofenceMapControls
        adapter={overrides.adapter === undefined ? adapter : overrides.adapter}
        fitDisabled={overrides.fitDisabled ?? false}
        onFitAll={onFitAll}
      />
    </TooltipProvider>,
  );
  return onFitAll;
}

describe("GeofenceMapControls", () => {
  it("fits every geofence", async () => {
    const onFitAll = renderControls();
    await userEvent.click(screen.getByRole("button", { name: "Fit all geofences" }));
    expect(onFitAll).toHaveBeenCalledOnce();
  });

  it("zooms through the adapter", async () => {
    renderControls();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(zoomIn).toHaveBeenCalledOnce();
    expect(zoomOut).toHaveBeenCalledOnce();
  });

  it("explains why fit is unavailable instead of only disabling it", () => {
    renderControls({ fitDisabled: true });
    expect(screen.getByRole("button", { name: "No geofences to fit" })).toBeDisabled();
  });

  it("disables zoom until an adapter is ready", () => {
    renderControls({ adapter: null });
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  });

  it("names the zoom limit that disables the button", () => {
    const atMax = {
      ...adapter,
      getViewport: () => viewport(mapConfig.options.maxZoom),
    } as MapAdapter;
    const { unmount } = render(
      <TooltipProvider>
        <GeofenceMapControls adapter={atMax} onFitAll={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Maximum zoom" })).toBeDisabled();
    unmount();

    const atMin = {
      ...adapter,
      getViewport: () => viewport(mapConfig.options.minZoom),
    } as MapAdapter;
    render(
      <TooltipProvider>
        <GeofenceMapControls adapter={atMin} onFitAll={vi.fn()} />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Minimum zoom" })).toBeDisabled();
  });
});
