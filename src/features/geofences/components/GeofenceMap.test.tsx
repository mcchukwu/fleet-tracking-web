import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapAdapter } from "../../../map/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { GeofenceMap } from "./GeofenceMap";

const holder = vi.hoisted(() => ({ adapter: null as unknown }));

const adapter = {
  id: "fake",
  capabilities: {
    offline: true,
    drawing: true,
    clustering: "emulated",
    comfortableVehicleCount: 1,
    styles: ["standard"],
  },
  getStyleState: () => ({ style: "standard", status: "ready", attribution: null }),
  getViewport: () => ({
    center: [3.4, 6.5],
    zoom: 10,
    bearing: 0,
    bounds: { south: 6, west: 3, north: 7, east: 4 },
  }),
  on: () => () => undefined,
} as unknown as MapAdapter;

holder.adapter = adapter;

vi.mock("../../../map/FleetMap", () => ({
  FleetMap: (props: {
    label: string;
    dimmed: boolean;
    geofences: readonly unknown[];
    onReady: (value: MapAdapter) => void;
  }) => (
    <section
      aria-label={props.label}
      data-testid="fleet-map"
      data-dimmed={String(props.dimmed)}
      data-count={props.geofences.length}
    >
      <button type="button" onClick={() => props.onReady(holder.adapter as MapAdapter)}>
        Map ready
      </button>
    </section>
  ),
}));

vi.mock("../../../map/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../map/config")>();
  return { ...actual, mapOfflineConfigured: () => true };
});

function renderMap(element: ReactElement) {
  return render(<TooltipProvider>{element}</TooltipProvider>);
}

describe("GeofenceMap", () => {
  it("renders the map, hint, controls and attribution", async () => {
    const onAdapter = vi.fn();
    renderMap(
      <GeofenceMap
        geofences={[]}
        adapter={adapter}
        offline={false}
        hint="Click to add points."
        onAdapter={onAdapter}
        onFitAll={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Geofence map" })).toBeInTheDocument();
    expect(screen.getByText("Click to add points.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit all geofences" })).toBeInTheDocument();
    expect(screen.getByTestId("map-attribution")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Map ready" }));
    expect(onAdapter).toHaveBeenCalledWith(adapter);
  });

  it("hides the geofence that is being edited from the normal layer", () => {
    renderMap(
      <GeofenceMap
        geofences={[
          { id: "gf-1", name: "Border", kind: "depot", rings: [], highlighted: true },
          { id: "gf-2", name: "Lekki", kind: "depot", rings: [], highlighted: false },
        ]}
        editingId="gf-1"
        adapter={adapter}
        offline={false}
        onAdapter={vi.fn()}
        onFitAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fleet-map")).toHaveAttribute("data-count", "1");
  });

  it("dims the map while offline when the adapter supports offline tiles", () => {
    renderMap(
      <GeofenceMap
        geofences={[]}
        adapter={adapter}
        offline
        onAdapter={vi.fn()}
        onFitAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fleet-map")).toHaveAttribute("data-dimmed", "true");
  });

  it("mounts the map offline before an adapter exists when a local pack is configured", () => {
    renderMap(
      <GeofenceMap geofences={[]} adapter={null} offline onAdapter={vi.fn()} onFitAll={vi.fn()} />,
    );
    expect(screen.getByTestId("fleet-map")).toHaveAttribute("data-dimmed", "true");
    expect(screen.queryByText("Map isn't available offline")).toBeNull();
  });

  it("replaces an offline-incapable map with a neutral notice", () => {
    const noOffline = {
      ...adapter,
      capabilities: { ...adapter.capabilities, offline: false },
    } as MapAdapter;
    renderMap(
      <GeofenceMap
        geofences={[]}
        adapter={noOffline}
        offline
        onAdapter={vi.fn()}
        onFitAll={vi.fn()}
      />,
    );
    expect(screen.getByText("Map isn't available offline")).toBeInTheDocument();
    expect(screen.queryByTestId("fleet-map")).toBeNull();
    expect(screen.queryByRole("button", { name: "Fit all geofences" })).toBeNull();
  });

  it("reports the adapter as gone when the map unmounts", () => {
    const onAdapter = vi.fn();
    const { unmount } = renderMap(
      <GeofenceMap
        geofences={[]}
        adapter={adapter}
        offline={false}
        onAdapter={onAdapter}
        onFitAll={vi.fn()}
      />,
    );
    unmount();
    expect(onAdapter).toHaveBeenCalledWith(null);
  });
});
