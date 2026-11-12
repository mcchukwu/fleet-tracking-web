import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Alert, Geofence } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import { FakeAdapter } from "../../../map/testing/FakeAdapter";
import { ThemeProvider } from "../../../theme/ThemeProvider";
import { AlertPositionMap } from "./AlertPositionMap";

const alert: Alert = {
  id: "alert-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  type: "geofence_exit",
  severity: "high",
  status: "open",
  occurred_at: "2026-11-02T20:07:00Z",
  evidence: { geofence_id: "gf-1" },
};

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

function renderMap(state: Parameters<typeof AlertPositionMap>[0]["state"], adapter = new FakeAdapter()) {
  render(
    <ThemeProvider>
      <AlertPositionMap
        alert={alert}
        state={state}
        geofence={geofence}
        onRetry={() => undefined}
        adapter={adapter}
      />
    </ThemeProvider>,
  );
  return adapter;
}

describe("AlertPositionMap", () => {
  it("mounts the static map with the alert marker and geofence", async () => {
    const adapter = renderMap({
      status: "history",
      position: { lat: 6.45, lon: 3.39 },
      point: {
        t: "2026-11-02T20:06:30Z",
        lat: 6.45,
        lon: 3.39,
        speed_kph: 40,
        heading_deg: 90,
      },
      geofence,
    });

    expect(screen.getByRole("region", { name: "Alert position" })).toBeVisible();
    expect(screen.getAllByTestId("map-attribution")[0]).toBeVisible();
    await waitFor(() => expect(adapter.vehicles[0]?.label).toBe("LSD-101-AA"));
    await waitFor(() => expect(adapter.geofences[0]?.id).toBe("gf-1"));
    await waitFor(() => expect(adapter.getViewport().zoom).toBe(10));

    const viewport = adapter.getViewport();
    expect(viewport.bounds.south).toBeLessThanOrEqual(6.43);
    expect(viewport.bounds.north).toBeGreaterThanOrEqual(6.45);
    expect(viewport.bounds.west).toBeLessThanOrEqual(3.39);
    expect(viewport.bounds.east).toBeGreaterThanOrEqual(3.49);
  });

  it("shows loading and unavailable without mounting a map", () => {
    const { rerender } = render(
      <ThemeProvider>
        <AlertPositionMap
          alert={alert}
          state={{ status: "loading" }}
          geofence={null}
          onRetry={() => undefined}
        />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText("Loading position")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <AlertPositionMap
          alert={alert}
          state={{ status: "unavailable" }}
          geofence={null}
          onRetry={() => undefined}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText("Position unavailable")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Alert position" })).not.toBeInTheDocument();
  });

  it("shows a compact retryable error and the offline copy", () => {
    const { rerender } = render(
      <ThemeProvider>
        <AlertPositionMap
          alert={alert}
          state={{ status: "error", error: normalize(new TypeError("Failed to fetch")) }}
          geofence={null}
          onRetry={() => undefined}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText("Can't reach the server")).toBeVisible();

    rerender(
      <ThemeProvider>
        <AlertPositionMap
          alert={alert}
          state={{ status: "evidence", position: { lat: 6.5, lon: 3.4 }, geofence: null }}
          geofence={null}
          offline
          onRetry={() => undefined}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText("Map isn't available offline")).toBeVisible();
  });

  it("keeps the cached map when the adapter supports offline", () => {
    renderMap(
      { status: "evidence", position: { lat: 6.5, lon: 3.4 }, geofence: null },
      new FakeAdapter(),
    );
    expect(screen.queryByText("Map isn't available offline")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alert position" })).toBeVisible();
  });

  it("shows offline instead of a retryable position error", () => {
    render(
      <ThemeProvider>
        <AlertPositionMap
          alert={alert}
          state={{ status: "error", error: normalize(new TypeError("Failed to fetch")) }}
          geofence={null}
          offline
          onRetry={() => undefined}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText("Map isn't available offline")).toBeVisible();
    expect(screen.queryByText("Can't reach the server")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
