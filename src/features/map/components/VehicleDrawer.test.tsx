import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotVehicle, Vehicle, VehicleEvent } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { VehicleDrawer } from "./VehicleDrawer";

const mocks = vi.hoisted(() => ({
  vehicle: {
    data: undefined as Vehicle | undefined,
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  trips: {
    data: [] as unknown[],
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  events: {
    data: [] as VehicleEvent[],
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useVehicle: () => mocks.vehicle,
  useVehicleEvents: () => mocks.events,
}));

vi.mock("../../../api/hooks/trips", () => ({
  useTrips: () => mocks.trips,
}));

const now = Date.now();

const snapshot: SnapshotVehicle = {
  id: "vehicle-1",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  depot: "Lekki Depot",
  driver_name: "Adebayo Okafor",
  online: true,
  lat: 6.5,
  lon: 3.4,
  speed_kph: 62,
  heading_deg: 272,
  recorded_at: new Date(now - 10_000).toISOString(),
};

const vehicle: Vehicle = {
  ...snapshot,
  vehicle_type: "tanker",
  make: "MAN",
  model: "TGS",
  year: 2021,
  colour: "white",
  status: "active",
  department: "operations",
  driver_id: "driver-1",
  driver_phone: "08031000010",
};

const row = {
  id: "vehicle-1",
  key: "demo-imei-0001",
  plate: "LSD-100-AA",
  driverName: "Adebayo Okafor",
  depot: "Lekki Depot",
  online: true,
  lat: 6.5,
  lon: 3.4,
  recordedAt: snapshot.recorded_at ?? null,
  recordedAtMs: now - 10_000,
  speedKph: 62,
  speedReportedAtMs: now - 10_000,
  headingDeg: 272,
  status: "moving" as const,
  freshness: "fresh" as const,
  ageSeconds: 10,
  stale: false,
};

function renderDrawer(overrides: Partial<Parameters<typeof VehicleDrawer>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <ToastProvider>
        <VehicleDrawer
          vehicleId="vehicle-1"
          row={row}
          snapshotVehicle={snapshot}
          mapReady
          canMutate
          offline={false}
          onClose={vi.fn()}
          onCentre={vi.fn()}
          onPlayback={vi.fn()}
          {...overrides}
        />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("VehicleDrawer", () => {
  beforeEach(() => {
    mocks.vehicle = {
      data: vehicle,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.trips = {
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.events = {
      data: [
        { kind: "geofence", type: "enter", name: "Refinery Gate", at: "2026-11-02T14:31:00Z" },
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("composes the header and every section", () => {
    renderDrawer();

    expect(
      screen.getByRole("complementary", { name: "Vehicle details for LSD-100-AA" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Current state" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Trip" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Driver" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Vehicle details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Recent events" })).toBeVisible();
    expect(screen.getByText("Geofence entry")).toBeVisible();
  });

  it("shows the not-found state and keeps the close action", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isError: true,
      error: new ApiError(404, "not_found", "vehicle not found"),
    };
    renderDrawer();
    expect(screen.getByText("Vehicle not found")).toBeVisible();
    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
  });

  it("keeps live current state when the full record fails", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isError: true,
      error: new ApiError(500, "internal", "down"),
    };
    renderDrawer();
    expect(screen.getByText("62 km/h")).toBeVisible();
    expect(screen.getByText(/Live fields stay visible/)).toBeVisible();
  });

  it("delays the detail skeleton by 200ms", async () => {
    mocks.vehicle = { ...mocks.vehicle, data: undefined, isPending: true };
    renderDrawer();
    expect(screen.queryByLabelText("Loading vehicle details")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Loading vehicle details")).toBeVisible();
  });

  it("keeps the cached detail and offers a refresh when a refetch fails", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      isError: true,
      error: new ApiError(500, "internal", "down"),
    };
    renderDrawer();
    expect(screen.getByText("Couldn't refresh vehicle details.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByText("MAN")).toBeVisible();
  });

  it("marks a stale row and disables mutations offline", () => {
    renderDrawer({
      row: { ...row, stale: true, freshness: "stale" },
      offline: true,
    });
    expect(screen.getAllByText("Stale").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
