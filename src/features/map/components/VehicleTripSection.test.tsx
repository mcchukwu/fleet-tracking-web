import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { Trip } from "../../../api/types";
import { VehicleTripSection, type TripsResult } from "./VehicleTripSection";

const trip: Trip = {
  id: "trip-1",
  vehicle_id: "vehicle-1",
  plate: "LSD-100-AA",
  driver_id: "driver-1",
  driver_name: "Adebayo Okafor",
  origin: "Refinery Gate",
  destination: "Ibadan Customer",
  status: "active",
  distance_km: 0,
  started_at: "2026-11-07T10:00:00Z",
};

const query: TripsResult = {
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

function renderSection(ui: ReactElement) {
  return render(
    <TooltipProvider>
      <ToastProvider>{ui}</ToastProvider>
    </TooltipProvider>,
  );
}

describe("VehicleTripSection", () => {
  it("renders 'No active trip' without trip fields", () => {
    renderSection(<VehicleTripSection tripQuery={query} />);
    expect(screen.getByText("No active trip.")).toBeVisible();
  });

  it("resolves a trip from the list", () => {
    renderSection(
      <VehicleTripSection tripId="trip-1" trips={[trip]} tripQuery={query} />,
    );
    expect(screen.getByText("Refinery Gate")).toBeVisible();
    expect(screen.getByText("Ibadan Customer")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("—")).toBeVisible();
  });

  it("falls back to the snapshot when the trip id is not in the list", () => {
    renderSection(
      <VehicleTripSection
        tripId="trip-missing"
        trips={[]}
        tripQuery={query}
        snapshotVehicle={{
          id: "vehicle-1",
          external_id: "demo-imei-0001",
          plate: "LSD-100-AA",
          depot: "Lekki Depot",
          online: true,
          destination: "Ibadan Customer",
          trip_status: "active",
        }}
      />,
    );
    expect(screen.getByText("Ibadan Customer")).toBeVisible();
    expect(screen.getByText("Trip details unavailable.")).toBeVisible();
  });

  it("shows a compact error with retry", () => {
    const refetch = vi.fn();
    renderSection(
      <VehicleTripSection
        tripId="trip-1"
        tripQuery={{ ...query, isError: true, error: new ApiError(500, "internal", "down"), refetch }}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("keeps cached trip data and adds a refresh line when the refetch fails", () => {
    renderSection(
      <VehicleTripSection
        tripId="trip-1"
        trips={[trip]}
        tripQuery={{ ...query, isError: true, error: new ApiError(500, "internal", "down") }}
      />,
    );
    expect(screen.getByText("Refinery Gate")).toBeVisible();
    expect(screen.getByText("Couldn't refresh the trip.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("keeps cached trip data without a region error while offline", () => {
    renderSection(
      <VehicleTripSection
        tripId="trip-1"
        trips={[trip]}
        tripQuery={{ ...query, isError: true, error: new ApiError(500, "internal", "down") }}
        offline
      />,
    );
    expect(screen.getByText("Refinery Gate")).toBeVisible();
    expect(screen.queryByText("Couldn't refresh the trip.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("uses a neutral offline message instead of an error", () => {
    renderSection(
      <VehicleTripSection
        tripId="trip-1"
        tripQuery={{ ...query, isError: true, error: new ApiError(500, "internal", "down") }}
        offline
      />,
    );
    expect(screen.getByText("Trip details need a connection.")).toBeVisible();
  });
});
