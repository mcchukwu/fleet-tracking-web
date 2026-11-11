import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapAdapter } from "../../../map/types";
import { GeofenceMapControls } from "./GeofenceMapControls";

const zoomIn = vi.fn();
const zoomOut = vi.fn();
const adapter = {
  zoomIn,
  zoomOut,
} as unknown as MapAdapter;

describe("GeofenceMapControls", () => {
  it("fits every geofence", async () => {
    const onFitAll = vi.fn();
    render(<GeofenceMapControls adapter={adapter} onFitAll={onFitAll} />);
    await userEvent.click(screen.getByRole("button", { name: "Fit all geofences" }));
    expect(onFitAll).toHaveBeenCalledOnce();
  });

  it("zooms through the adapter", async () => {
    render(<GeofenceMapControls adapter={adapter} onFitAll={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(zoomIn).toHaveBeenCalledOnce();
    expect(zoomOut).toHaveBeenCalledOnce();
  });

  it("disables fit when there is nothing to fit", () => {
    render(<GeofenceMapControls adapter={adapter} fitDisabled onFitAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Fit all geofences" })).toBeDisabled();
  });

  it("disables zoom until an adapter is ready", () => {
    render(<GeofenceMapControls adapter={null} onFitAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  });
});
