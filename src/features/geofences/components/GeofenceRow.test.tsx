import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Geofence } from "../../../api/types";
import { GeofenceRow } from "./GeofenceRow";

const geofence: Geofence = {
  id: "gf-1",
  name: "Lekki Depot",
  kind: "depot",
  geometry: { type: "Polygon", coordinates: [] },
};

describe("GeofenceRow", () => {
  it("exposes the name and kind as the accessible name", () => {
    render(<GeofenceRow geofence={geofence} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Depot.*Lekki Depot/ })).toBeInTheDocument();
  });

  it("marks the selected row without hiding the name", () => {
    render(<GeofenceRow geofence={geofence} selected onSelect={vi.fn()} />);
    const button = screen.getByRole("button", { name: /Lekki Depot/ });
    expect(button).toHaveAttribute("aria-current", "true");
    expect(screen.getByTitle("Lekki Depot")).toBeInTheDocument();
  });

  it("selects on click", async () => {
    const onSelect = vi.fn();
    render(<GeofenceRow geofence={geofence} selected={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Lekki Depot/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
