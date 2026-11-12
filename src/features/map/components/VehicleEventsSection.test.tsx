import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { VehicleEventsSection } from "./VehicleEventsSection";

const mocks = vi.hoisted(() => ({
  result: {
    data: [] as unknown[] | undefined,
    isPending: false,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useVehicleEvents: () => mocks.result,
}));

function renderSection(offline = false) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <VehicleEventsSection vehicleId="vehicle-1" offline={offline} />
      </ToastProvider>
    </TooltipProvider>,
  );
}

describe("VehicleEventsSection", () => {
  beforeEach(() => {
    mocks.result = {
      data: [],
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("renders both event shapes and expands evidence", async () => {
    const user = userEvent.setup();
    mocks.result.data = [
      {
        kind: "alert",
        type: "route_deviation",
        severity: "high",
        status: "open",
        at: "2026-11-02T20:07:43Z",
        evidence: { distance_m: 2091.58 },
      },
      { kind: "geofence", type: "enter", name: "Refinery Gate", at: "2026-11-02T14:31:00Z" },
      { kind: "geofence", type: "exit", name: "Lekki Depot", at: "2026-11-02T19:42:11Z" },
    ];
    renderSection();

    expect(screen.getByText("Route deviation")).toBeVisible();
    expect(screen.getByText("Geofence entry")).toBeVisible();
    expect(screen.getByText("Geofence exit")).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "Show evidence" })[0]!);
    expect(screen.getByText("2091.58 m")).toBeVisible();
    expect(screen.getByRole("button", { name: "Hide evidence" })).toBeVisible();
  });

  it("keeps an unknown kind, severity and status with neutral fallbacks", () => {
    mocks.result.data = [
      {
        kind: "solar_flare",
        type: "unmapped_event",
        severity: "extreme",
        status: "pending",
        at: "2026-11-02T21:00:00Z",
      },
    ];
    renderSection();
    expect(screen.getByText("Unknown event: solar_flare")).toBeVisible();
    expect(screen.getByText("Unknown severity: extreme")).toBeVisible();
    expect(screen.getByText("Unknown status: pending")).toBeVisible();
    expect(screen.queryByText("Extreme")).not.toBeInTheDocument();
  });

  it("gives events in the same second unique keys and evidence ids", async () => {
    const user = userEvent.setup();
    const event = {
      kind: "alert",
      type: "speeding",
      severity: "high",
      status: "open",
      at: "2026-11-02T20:07:43Z",
      evidence: { speed_kph: 90 },
    };
    mocks.result.data = [event, { ...event }];
    const { container } = renderSection();

    const buttons = screen.getAllByRole("button", { name: "Show evidence" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]!);
    await user.click(screen.getByRole("button", { name: "Show evidence" }));

    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps cached events and hides the refresh error while offline", () => {
    mocks.result.data = [
      { kind: "geofence", type: "enter", name: "Refinery Gate", at: "2026-11-02T14:31:00Z" },
    ];
    mocks.result.isError = true;
    mocks.result.error = new ApiError(500, "internal", "down");
    renderSection(true);

    expect(screen.getByText("Geofence entry")).toBeVisible();
    expect(screen.queryByText("Couldn't refresh events.")).not.toBeInTheDocument();
  });

  it("shows the empty state for a quiet day", () => {
    renderSection();
    expect(screen.getByText("No events in the last 24 hours.")).toBeVisible();
  });

  it("shows a compact error with retry", () => {
    mocks.result.data = undefined;
    mocks.result.isError = true;
    mocks.result.error = new ApiError(500, "internal", "down");
    renderSection();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("uses the neutral offline message with no cached data", () => {
    mocks.result.data = undefined;
    mocks.result.isError = true;
    mocks.result.error = new ApiError(500, "internal", "down");
    renderSection(true);
    expect(screen.getByText("Events need a connection.")).toBeVisible();
  });

  it("does not keep a skeleton for a paused offline query", () => {
    mocks.result.data = undefined;
    mocks.result.isPending = true;
    mocks.result.isLoading = false;
    const { container } = renderSection(true);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByText("Events need a connection.")).toBeVisible();
  });
});
