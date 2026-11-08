import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalize } from "../../../errors/normalize";
import { AlertTripSection } from "./AlertTripSection";

const mocks = vi.hoisted(() => ({
  trips: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/trips", () => ({
  useTrips: () => mocks.trips,
}));

beforeEach(() => {
  mocks.trips.data = undefined;
  mocks.trips.isPending = false;
  mocks.trips.isError = false;
  mocks.trips.error = null;
  mocks.trips.refetch.mockReset();
});

const trip = {
  id: "trip-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  driver_name: "Chinedu Musa",
  origin: "Refinery Gate",
  destination: "Ibadan Customer",
  status: "active",
  distance_km: 0,
};

describe("AlertTripSection", () => {
  it("says no trip when the alert has none", () => {
    render(<AlertTripSection />);
    expect(screen.getByText("No trip linked.")).toBeVisible();
  });

  it("resolves the trip from the list", () => {
    mocks.trips.data = [trip];
    render(<AlertTripSection tripId="trip-1" />);
    expect(screen.getByText("Refinery Gate → Ibadan Customer")).toBeVisible();
    expect(screen.getByText("Chinedu Musa")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
  });

  it("does not invent a trip that is missing from the list", () => {
    mocks.trips.data = [trip];
    render(<AlertTripSection tripId="trip-2" />);
    expect(screen.getByText("Trip details unavailable.")).toBeVisible();
  });

  it("shows a retryable error", () => {
    mocks.trips.isError = true;
    mocks.trips.error = normalize(new TypeError("Failed to fetch"));
    render(<AlertTripSection tripId="trip-1" />);
    expect(screen.getByText("Can't reach the server")).toBeVisible();
  });

  it("shows a loading skeleton", () => {
    mocks.trips.isPending = true;
    render(<AlertTripSection tripId="trip-1" />);
    expect(screen.getByLabelText("Loading trip")).toBeInTheDocument();
  });
});
