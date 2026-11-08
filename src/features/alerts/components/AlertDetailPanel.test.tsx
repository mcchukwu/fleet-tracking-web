import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Alert } from "../../../api/types";
import { normalize } from "../../../errors/normalize";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { AlertDetailPanel, type AlertDetailPanelProps } from "./AlertDetailPanel";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  position: {
    state: {
      status: "evidence",
      position: { lat: 6.5, lon: 3.4 },
      geofence: null,
    } as unknown,
    retry: vi.fn(),
  },
  trips: {
    data: [
      {
        id: "trip-1",
        vehicle_id: "v-1",
        plate: "LSD-101-AA",
        driver_name: "Chinedu Musa",
        origin: "Refinery Gate",
        destination: "Ibadan Customer",
        status: "active",
        distance_km: 0,
      },
    ],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("../hooks/useAlertPosition", () => ({
  useAlertPosition: () => mocks.position,
}));

vi.mock("../../../api/hooks/trips", () => ({
  useTrips: () => mocks.trips,
}));

vi.mock("./AlertPositionMap", () => ({
  AlertPositionMap: () => <div>Position map</div>,
}));

const baseAlert: Alert = {
  id: "alert-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  trip_id: "trip-1",
  type: "geofence_exit",
  severity: "high",
  status: "open",
  occurred_at: "2026-11-02T20:07:00Z",
  evidence: { geofence_id: "gf-1" },
};

function renderPanel(overrides: Partial<AlertDetailPanelProps> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <AlertDetailPanel
          alert={baseAlert}
          lookup="ready"
          geofences={[]}
          pending={false}
          onClose={() => undefined}
          onAck={() => undefined}
          onRetryLookup={() => undefined}
          {...overrides}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.position.state = {
    status: "evidence",
    position: { lat: 6.5, lon: 3.4 },
    geofence: null,
  };
});

describe("AlertDetailPanel", () => {
  it("shows the alert, the resolved trip and the evidence controls", () => {
    renderPanel();
    expect(screen.getByRole("complementary", { name: "Alert details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Geofence exit" })).toBeVisible();
    expect(screen.getByText("From alert evidence")).toBeVisible();
    expect(screen.getByText("Refinery Gate → Ibadan Customer")).toBeVisible();
    expect(screen.getByRole("button", { name: "Raw JSON" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Acknowledge" })).toBeVisible();
  });

  it("moves focus to close, closes, and returns focus to the origin", async () => {
    const onClose = vi.fn();
    const returnFocus = vi.fn();
    const { unmount } = renderPanel({ onClose, returnFocus });
    expect(screen.getByRole("button", { name: "Close alert details" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Close alert details" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    await waitFor(() => expect(returnFocus).toHaveBeenCalled());
  });

  it("acknowledges from the detail action", async () => {
    const onAck = vi.fn();
    renderPanel({ onAck });
    await userEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(onAck).toHaveBeenCalledTimes(1);
  });

  it("shows the acknowledgement time without inventing an actor", () => {
    renderPanel({
      alert: {
        ...baseAlert,
        status: "acked",
        acked_at: "2026-11-02T20:09:00Z",
      },
    });
    expect(screen.getAllByText("Acknowledged")[0]).toBeVisible();
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo Dispatcher/)).not.toBeInTheDocument();
  });

  it("navigates to the vehicle and to the replay range", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Open on map" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/map", search: { v: "v-1" } });

    await userEvent.click(screen.getByRole("button", { name: "Replay last 30 minutes" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/playback",
      search: {
        vehicle: "v-1",
        from: "2026-11-02T19:37:00.000Z",
        to: "2026-11-02T20:09:00.000Z",
      },
    });
  });

  it("renders the not-found, loading and error lookup states", () => {
    const { rerender } = renderPanel({ alert: null, lookup: "not-found" });
    expect(screen.getByText("Alert not found")).toBeVisible();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AlertDetailPanel
            alert={null}
            lookup="loading"
            geofences={[]}
            pending={false}
            onClose={() => undefined}
            onAck={() => undefined}
            onRetryLookup={() => undefined}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByLabelText("Loading alert")).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <ToastProvider>
          <AlertDetailPanel
            alert={null}
            lookup="error"
            lookupError={normalize(new TypeError("Failed to fetch"))}
            geofences={[]}
            pending={false}
            onClose={() => undefined}
            onAck={() => undefined}
            onRetryLookup={() => undefined}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("Can't reach the server")).toBeVisible();
  });
});
