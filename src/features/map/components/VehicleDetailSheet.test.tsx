import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotVehicle, Vehicle } from "../../../api/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { VehicleDetailSheet } from "./VehicleDetailSheet";

const mocks = vi.hoisted(() => ({
  vehicle: {
    data: undefined as Vehicle | undefined,
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  trips: { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() },
  events: { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() },
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useVehicle: () => mocks.vehicle,
  useVehicleEvents: () => mocks.events,
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

function renderSheet(
  overrides: Partial<Parameters<typeof VehicleDetailSheet>[0]> = {},
) {
  const onSnap = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <ToastProvider>
        <VehicleDetailSheet
          vehicleId="vehicle-1"
          row={row}
          snapshotVehicle={snapshot}
          snap="half"
          onSnap={onSnap}
          mapReady
          canMutate
          offline={false}
          onClose={onClose}
          onCentre={vi.fn()}
          onPlayback={vi.fn()}
          {...overrides}
        />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { onSnap, onClose };
}

describe("VehicleDetailSheet", () => {
  beforeEach(() => {
    mocks.vehicle = { ...mocks.vehicle, data: vehicle, isPending: false, isError: false, error: null };
    mocks.events = { ...mocks.events, data: [], isPending: false, isError: false, error: null };
  });

  it("shows the plate, status, actions and the same sections as the drawer", () => {
    renderSheet();
    expect(
      screen.getByRole("region", { name: "Vehicle details for LSD-100-AA" }),
    ).toBeVisible();
    expect(screen.getByText("62 km/h")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Trip" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Vehicle details" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Centre on map" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close vehicle details" })).toBeVisible();
  });

  it("makes the body inert at peek and interactive at half", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
        <ToastProvider>
          <VehicleDetailSheet
            vehicleId="vehicle-1"
            row={row}
            snapshotVehicle={snapshot}
            snap="peek"
            onSnap={vi.fn()}
            mapReady
            canMutate
            offline={false}
            onClose={vi.fn()}
            onCentre={vi.fn()}
            onPlayback={vi.fn()}
          />
        </ToastProvider>
      </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("detail-sheet-content")).toHaveAttribute("inert");

    rerender(
      <QueryClientProvider client={client}>
        <TooltipProvider>
        <ToastProvider>
          <VehicleDetailSheet
            vehicleId="vehicle-1"
            row={row}
            snapshotVehicle={snapshot}
            snap="half"
            onSnap={vi.fn()}
            mapReady
            canMutate
            offline={false}
            onClose={vi.fn()}
            onCentre={vi.fn()}
            onPlayback={vi.fn()}
          />
        </ToastProvider>
      </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("detail-sheet-content")).not.toHaveAttribute("inert");
  });

  it("supports keyboard snapping from the header", async () => {
    const user = userEvent.setup();
    const { onSnap } = renderSheet();
    const handle = screen.getByRole("button", { name: /^LSD-100-AA/ });
    handle.focus();
    await user.keyboard("{End}");
    expect(onSnap).toHaveBeenCalledWith("full");
    await user.keyboard("{Home}");
    expect(onSnap).toHaveBeenCalledWith("peek");
    await user.keyboard("{ArrowUp}");
    expect(onSnap).toHaveBeenCalledWith("full");
  });

  it("closes from the header", async () => {
    const { onClose } = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Close vehicle details" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the not-found state for a removed vehicle", () => {
    mocks.vehicle = {
      ...mocks.vehicle,
      data: undefined,
      isError: true,
      error: { kind: "not_found", retryable: false, outcome: "failed", context: { route: "/map" }, at: 0 },
    };
    renderSheet();
    expect(screen.getByText("Vehicle not found")).toBeVisible();
  });
});
