import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../../../api/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { TripDetailPanel } from "./TripDetailPanel";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    driver_id: "driver-1",
    driver_name: "Adebayo Okafor",
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "active",
    distance_km: 0,
    started_at: "2026-11-09T08:00:00Z",
    ...overrides,
  };
}

function renderPanel(props: Partial<Parameters<typeof TripDetailPanel>[0]> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <TripDetailPanel
          trip={trip()}
          lookup="ready"
          pending={false}
          onAction={vi.fn()}
          onRetryLookup={vi.fn()}
          onClose={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("TripDetailPanel", () => {
  beforeEach(() => mocks.navigate.mockReset());

  it("shows every field, the two-event timeline and the missing values", () => {
    renderPanel();

    expect(screen.getByRole("complementary", { name: "Trip details" })).toBeVisible();
    expect(screen.getByText("Refinery Gate")).toBeVisible();
    expect(screen.getByText("Ibadan Customer")).toBeVisible();
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Started")).toBeVisible();
    expect(screen.getByText("Ended")).toBeVisible();
    expect(screen.getByText("Adebayo Okafor")).toBeVisible();
    expect(screen.getByText("The API records only the start and end times.")).toBeVisible();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("offers the next action and navigation to the map", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onAction });

    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(onAction).toHaveBeenCalledWith("complete");

    await user.click(screen.getByRole("button", { name: "View on map" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/map",
      search: { v: "vehicle-1" },
    });
  });

  it("renders an unknown status without offering actions", () => {
    renderPanel({ trip: trip({ status: "diverted" }) });
    expect(screen.getAllByText("Unknown status: diverted").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("shows a not-found state with a way back", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel({ trip: null, lookup: "not-found", onClose });

    expect(screen.getByText("Trip not found")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back to trips" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a loading state inside the drawer", () => {
    renderPanel({ trip: null, lookup: "loading" });
    expect(screen.getByLabelText("Loading trip")).toBeVisible();
  });
});
