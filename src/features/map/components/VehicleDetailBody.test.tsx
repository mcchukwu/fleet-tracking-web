import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotVehicle, Vehicle } from "../../../api/types";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { VehicleDetailBody } from "./VehicleDetailBody";

const mocks = vi.hoisted(() => ({
  vehicle: {
    data: undefined as Vehicle | undefined,
    isPending: false,
    isLoading: false,
    isFetching: false,
    fetchStatus: "idle" as "fetching" | "paused" | "idle",
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  trips: {
    data: [],
    isPending: false,
    isLoading: false,
    isFetching: false,
    fetchStatus: "idle" as "fetching" | "paused" | "idle",
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useVehicle: () => mocks.vehicle,
  useVehicleEvents: () => ({
    data: [],
    isPending: false,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("../../../api/hooks/trips", () => ({ useTrips: () => mocks.trips }));

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

function renderBody(overrides: Partial<Parameters<typeof VehicleDetailBody>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <ToastProvider>
          <VehicleDetailBody
            vehicleId="vehicle-1"
            row={null}
            snapshotVehicle={null}
            offline={false}
            onClose={onClose}
            {...overrides}
          />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("VehicleDetailBody", () => {
  beforeEach(() => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: vehicle,
      isPending: false,
      isLoading: false,
      fetchStatus: "idle",
      isError: false,
      error: null,
    };
    mocks.trips = { ...mocks.trips, data: [], isPending: false, isLoading: false, fetchStatus: "idle" };
  });

  it("renders the record, live state and the detail sections", () => {
    renderBody({ row, snapshotVehicle: snapshot });
    expect(screen.getByText("62 km/h")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Trip" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Driver" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Vehicle details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Recent events" })).toBeVisible();
  });

  it("shows the offline empty state for a paused query instead of a skeleton", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isPending: true,
      isLoading: false,
      fetchStatus: "paused",
    };
    renderBody({ offline: true });

    expect(screen.getByText("Vehicle details aren't available offline")).toBeVisible();
    expect(screen.queryByLabelText("Loading vehicle details")).not.toBeInTheDocument();
    expect(screen.queryByText("Still working…")).not.toBeInTheDocument();
  });

  it("keeps the live row visible beside the offline empty state", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isPending: true,
      isLoading: false,
      fetchStatus: "paused",
    };
    renderBody({ row, snapshotVehicle: snapshot, offline: true });

    expect(screen.getByText("62 km/h")).toBeVisible();
    expect(screen.getByText("Vehicle details aren't available offline")).toBeVisible();
  });

  it("shows the skeleton only while the query is actually loading", async () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isPending: true,
      isLoading: true,
      fetchStatus: "fetching",
    };
    renderBody();
    expect(screen.queryByLabelText("Loading vehicle details")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Loading vehicle details")).toBeVisible();
  });

  it("shows the not-found state for a removed vehicle", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isError: true,
      error: { kind: "not_found", retryable: false, outcome: "failed", context: { route: "/map" }, at: 0 },
    };
    renderBody();
    expect(screen.getByText("Vehicle not found")).toBeVisible();
  });

  it("keeps the live fields when the full record fails", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isError: true,
      error: new ApiError(500, "internal", "down"),
    };
    renderBody({ row, snapshotVehicle: snapshot });
    expect(screen.getByText("62 km/h")).toBeVisible();
    expect(screen.getByText(/Live fields stay visible/)).toBeVisible();
  });
});
