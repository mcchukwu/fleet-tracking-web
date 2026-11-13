import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../../../errors/types";
import { ErrorBoundary } from "../../../errors/ErrorBoundary";
import { recordRequestFailure, resetErrorStorm } from "../../../errors/global";
import { useConnectionStore } from "../../../stores/connection";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { PlaybackPage } from "./PlaybackPage";

const vehicleId = "4324a768-9b14-4223-a299-eb8da4d8d309";

const markerRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("./PlaybackEventMarkers", async () => {
  const { createElement, memo } = await import("react");
  return {
    PlaybackEventMarkers: memo(function MockEventMarkers() {
      markerRenders.count += 1;
      return createElement("div", { "data-testid": "event-marker-stub" });
    }),
  };
});

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  history: {
    data: { data: [], resolution: "30s" } as { data: unknown[]; resolution: string } | undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    cancel: vi.fn(),
  },
  events: {
    data: [] as unknown[] | undefined,
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ cancelQueries: vi.fn() }),
}));

vi.mock("./PlaybackMap", () => ({
  PlaybackMap: ({ onReady }: { onReady: (adapter: null) => void }) => (
    <section aria-label="Playback map">
      <button type="button" onClick={() => onReady(null)}>
        Map ready
      </button>
    </section>
  ),
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useLiveSnapshot: () => ({
    data: [
      {
        id: "4324a768-9b14-4223-a299-eb8da4d8d309",
        external_id: "demo-imei-0001",
        plate: "LSD-100-AA",
        depot: "Lekki Depot",
        online: true,
      },
    ],
  }),
  useVehicleHistory: () => mocks.history,
  useVehicleEvents: () => mocks.events,
}));

vi.mock("./VehiclePicker", () => ({
  VehiclePicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange("6c69032e-b802-447e-8f7a-ad8c0ddc2359")}>
      Pick LSD-101-AA
    </button>
  ),
}));

const points = [
  { t: "2026-11-08T14:00:00Z", lat: 6.5, lon: 3.4, speed_kph: 40, heading_deg: 90 },
  { t: "2026-11-08T14:00:30Z", lat: 6.6, lon: 3.5, speed_kph: 50, heading_deg: 95 },
];

const networkError: AppError = {
  kind: "network",
  retryable: true,
  outcome: "failed",
  context: { route: "/playback" },
  at: 0,
};

function renderPage() {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <ErrorBoundary level="panel">
          <PlaybackPage />
        </ErrorBoundary>
      </ToastProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.search = {
    from: "2026-11-08T14:00:00Z",
    to: "2026-11-08T16:00:00Z",
    resolution: "30s",
  };
  mocks.history.data = { data: [], resolution: "30s" };
  mocks.history.isPending = false;
  mocks.history.isFetching = false;
  mocks.history.isError = false;
  mocks.history.error = null;
  mocks.history.cancel.mockReset();
  mocks.events.data = [];
  mocks.events.isPending = false;
  mocks.events.isError = false;
  mocks.events.error = null;
  useConnectionStore.setState({ network: "online" });
  window.history.replaceState(null, "", "/playback");
});

describe("PlaybackPage", () => {
  it("shows the picker and the document title when no vehicle is chosen", async () => {
    mocks.search = {
      from: "2026-11-08T14:00:00Z",
      to: "2026-11-08T16:00:00Z",
      resolution: "30s",
    };
    renderPage();
    expect(screen.getByRole("heading", { name: "Choose a vehicle" })).toBeVisible();
    expect(document.title).toBe("Playback · Fleet Console");
  });

  it("writes the selected vehicle to the URL", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Pick LSD-101-AA" }));
    const call = mocks.navigate.mock.calls[0]?.[0] as { search: unknown };
    const search = (call.search as (previous: Record<string, unknown>) => Record<string, unknown>)(
      mocks.search,
    );
    expect(search.vehicle).toBe("6c69032e-b802-447e-8f7a-ad8c0ddc2359");
  });

  it("renders the header and the map region for a deep linked vehicle", async () => {
    mocks.search = {
      vehicle: vehicleId,
      from: "2026-11-08T14:00:00Z",
      to: "2026-11-08T16:00:00Z",
      resolution: "30s",
    };
    mocks.history.isPending = true;
    mocks.history.data = undefined;
    renderPage();
    expect(screen.getByRole("heading", { name: "Playback" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Playback map" })).toBeVisible();
    expect(screen.getByText("LSD-100-AA")).toBeVisible();
  });

  it("shows the empty state when the range has no positions", () => {
    mocks.search = {
      vehicle: vehicleId,
      from: "2026-11-08T14:00:00Z",
      to: "2026-11-08T16:00:00Z",
      resolution: "30s",
    };
    renderPage();
    expect(screen.getByText("No positions in this range")).toBeVisible();
  });

  it("shows a retryable error when history fails with nothing cached", async () => {
    mocks.search = {
      vehicle: vehicleId,
      from: "2026-11-08T14:00:00Z",
      to: "2026-11-08T16:00:00Z",
      resolution: "30s",
    };
    mocks.history.data = undefined;
    mocks.history.isError = true;
    mocks.history.error = networkError;
    renderPage();
    expect(screen.getByText("Can't reach the server")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.history.refetch).toHaveBeenCalled();
  });

  it("uses the compact error during an error storm", () => {
    mocks.search = {
      vehicle: vehicleId,
      from: "2026-11-08T14:00:00Z",
      to: "2026-11-08T16:00:00Z",
      resolution: "30s",
    };
    mocks.history.data = undefined;
    mocks.history.isError = true;
    mocks.history.error = networkError;
    recordRequestFailure("snapshot", "server");
    recordRequestFailure("alerts", "network");
    recordRequestFailure("trips", "unavailable");
    try {
      renderPage();
      expect(screen.getByText("Can't reach the server")).toBeVisible();
      expect(screen.queryByText(/Check your connection/)).not.toBeInTheDocument();
    } finally {
      resetErrorStorm();
    }
  });

  it("shows a validation card for an invalid range and offers the default", async () => {
    mocks.search = {
      vehicle: vehicleId,
      from: "2026-11-08T16:00:00Z",
      to: "2026-11-08T14:00:00Z",
      resolution: "30s",
    };
    renderPage();
    expect(screen.getByText("Choose a valid range")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Use the last 2 hours" }));
    expect(mocks.navigate).toHaveBeenCalled();
  });

  it("shows the cached route offline and an uncached range as unavailable", () => {
    mocks.search = {
      vehicle: vehicleId,
      from: "2026-11-08T14:00:00Z",
      to: "2026-11-08T16:00:00Z",
      resolution: "30s",
    };
    mocks.history.data = { data: points, resolution: "30s" };
    useConnectionStore.setState({ network: "offline" });
    const { rerender } = renderPage();
    expect(screen.getByText("Offline · showing saved data")).toBeVisible();
    expect(screen.queryByText("Not available offline")).not.toBeInTheDocument();

    mocks.history.data = undefined;
    rerender(
      <TooltipProvider>
        <ToastProvider>
          <ErrorBoundary level="panel">
            <PlaybackPage />
          </ErrorBoundary>
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("Not available offline")).toBeVisible();
  });

  it("contains an injected render crash in the panel boundary", () => {
    window.history.replaceState(null, "", "/playback?crash=playback");
    mocks.search = {
      vehicle: vehicleId,
      from: "2026-11-08T14:00:00Z",
      to: "2026-11-08T16:00:00Z",
      resolution: "30s",
    };
    renderPage();
    expect(screen.getByText("This part of the page stopped working")).toBeVisible();
  });

  it("does not re-render the memoised event list on clock ticks", async () => {
    const frames: FrameRequestCallback[] = [];
    const originalFrame = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    let clockMs = 0;
    const now = vi.spyOn(performance, "now").mockImplementation(() => clockMs);
    globalThis.requestAnimationFrame = (callback) => {
      frames.push(callback);
      return frames.length;
    };
    globalThis.cancelAnimationFrame = () => undefined;

    try {
      mocks.search = {
        vehicle: vehicleId,
        from: "2026-11-08T14:00:00Z",
        to: "2026-11-08T16:00:00Z",
        resolution: "30s",
      };
      mocks.history.data = { data: points, resolution: "30s" };
      mocks.events.data = [
        {
          kind: "alert",
          type: "speeding",
          severity: "high",
          status: "open",
          at: "2026-11-08T14:00:30Z",
        },
      ];
      markerRenders.count = 0;
      renderPage();

      const play = await screen.findByRole("button", { name: "Play" });
      expect(markerRenders.count).toBe(1);
      const slider = screen.getByRole("slider", { name: "Playback position" }) as HTMLInputElement;
      const startValue = slider.value;

      await userEvent.click(play);
      await act(async () => {
        for (let index = 0; index < 40; index += 1) {
          clockMs += 100;
          frames.shift()?.(clockMs);
        }
      });

      expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
      expect(slider.value).not.toBe(startValue);
      expect(markerRenders.count).toBe(1);
    } finally {
      now.mockRestore();
      globalThis.requestAnimationFrame = originalFrame;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});
