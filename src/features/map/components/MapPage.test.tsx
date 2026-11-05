import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Alert, SnapshotVehicle } from "../../../api/types";
import { useAuthStore } from "../../../auth/store";
import { useConnectionStore } from "../../../stores/connection";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { MapPage } from "./MapPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  desktop: true,
  snapshot: {
    data: [] as SnapshotVehicle[],
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  alerts: {
    data: [] as Alert[],
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  geofences: {
    data: [],
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  mapProps: [] as Array<{
    vehicles: readonly unknown[];
    dimmed: boolean;
    error: unknown;
    showErrorOverlay?: boolean;
  }>,
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
}));

vi.mock("../../../lib/useMediaQuery", () => ({
  useMediaQuery: () => mocks.desktop,
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useLiveSnapshot: () => mocks.snapshot,
}));

vi.mock("../../../api/hooks/alerts", () => ({
  OPEN_ALERT_LIMIT: 500,
  useOpenAlerts: () => mocks.alerts,
}));

vi.mock("../../../api/hooks/geofences", () => ({
  useGeofences: () => mocks.geofences,
}));

vi.mock("./MapView", () => ({
  MapView: (props: {
    vehicles: readonly unknown[];
    dimmed: boolean;
    error: unknown;
    showErrorOverlay?: boolean;
  }) => {
    mocks.mapProps.push(props);
    return <div data-testid="fleet-map" />;
  },
}));

const user = {
  id: "user-1",
  tenant_id: "tenant-demo",
  email: "dispatcher@demo.ftb",
  name: "Demo Dispatcher",
  role: "dispatcher" as const,
};

const now = new Date().toISOString();

function vehicle(
  id: string,
  externalId: string,
  plate: string,
  overrides: Partial<SnapshotVehicle> = {},
): SnapshotVehicle {
  return {
    id,
    external_id: externalId,
    plate,
    depot: "Lekki Depot",
    online: true,
    lat: 6.5,
    lon: 3.4,
    speed_kph: 40,
    recorded_at: now,
    ...overrides,
  };
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastProvider>
          <MapPage />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.search = {};
  mocks.desktop = true;
  mocks.mapProps = [];
  mocks.navigate.mockReset();
  mocks.alerts.data = [];
  mocks.snapshot.error = null;
  mocks.snapshot.isPending = false;
  mocks.snapshot.data = [
    vehicle("uuid-1", "demo-imei-0001", "AAA-100", { speed_kph: 50 }),
    vehicle("uuid-2", "demo-imei-0002", "BBB-200", { speed_kph: 0 }),
    vehicle("uuid-3", "demo-imei-0003", "CCC-300", { online: false }),
  ];
  useAuthStore.getState().setSession(user, "csrf");
});

describe("MapPage", () => {
  it("shows the open alert count in the document title", async () => {
    mocks.alerts.data = [
      { id: "a1", status: "open", occurred_at: now },
      { id: "a2", status: "open", occurred_at: now },
      { id: "a3", status: "open", occurred_at: now },
    ] as Alert[];

    renderPage();
    await waitFor(() => expect(document.title).toBe("(3) Map · Fleet Console"));
  });

  it("returns focus to the panel toggle after closing the panel", async () => {
    renderPage();

    await userEvent.click(
      screen.getAllByRole("button", { name: "Hide the vehicle panel" })[0]!,
    );

    const toggle = await screen.findByRole("button", { name: "Show the vehicle panel" });
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });

  it("filters the map target with the panel filters", async () => {
    mocks.search = { status: "offline" };
    renderPage();

    await waitFor(() => expect(mocks.mapProps.at(-1)?.vehicles).toHaveLength(1));
    expect(mocks.mapProps.at(-1)?.vehicles).toHaveLength(1);
  });

  it("pushes selection and replaces filter changes in the URL", async () => {
    renderPage();

    fireEvent.keyDown(window, { key: "j" });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ replace: false, to: "/map" }),
      ),
    );

    mocks.navigate.mockReset();
    await userEvent.click(screen.getByRole("button", { name: "Offline" }));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ replace: true, to: "/map" }),
      ),
    );
  });

  it("uses the bottom sheet below the desktop breakpoint", async () => {
    mocks.desktop = false;
    renderPage();

    expect(screen.getByRole("button", { name: /Showing 3 of 3/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vehicles" })).not.toBeInTheDocument();
  });

  it("does not present zero KPIs or hide the map error when the snapshot fails", async () => {
    mocks.snapshot.data = [];
    mocks.snapshot.error = new Error("server down");
    renderPage();

    await waitFor(() => expect(mocks.mapProps.at(-1)?.error).not.toBeNull());
    expect(mocks.mapProps.at(-1)?.showErrorOverlay).toBe(true);
    expect(screen.queryByText("0 of 0")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("keeps cached vehicles and drops the region error while offline", async () => {
    useConnectionStore.getState().setNetwork("offline");
    mocks.search = {};
    mocks.snapshot.error = new Error("network down");
    renderPage();

    await waitFor(() => expect(mocks.mapProps.at(-1)?.dimmed).toBe(true));
    expect(mocks.mapProps.at(-1)?.error).toBeNull();
    useConnectionStore.getState().setNetwork("online");
  });
});
