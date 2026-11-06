import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  toast: vi.fn(),
  mapStyle: {
    chosenStyle: "standard" as string,
    effectiveStyle: "standard" as string,
    styles: ["standard", "satellite"] as readonly string[],
    offline: false,
    fallbackNotice: false,
    dismissFallbackNotice: vi.fn(),
    chooseStyle: vi.fn(),
  },
  mapProps: [] as Array<{
    vehicles: readonly unknown[];
    geofences: readonly unknown[];
    dimmed: boolean;
    error: unknown;
    baseStyle?: string;
    showErrorOverlay?: boolean;
    onSelect: (key: string) => void;
    onViewport: (viewport: {
      center: [number, number];
      zoom: number;
      bearing: number;
      bounds: { south: number; west: number; north: number; east: number };
    }) => void;
  }>,
}));

vi.mock("../../../ui/Toast", async () => {
  const actual = await vi.importActual<typeof import("../../../ui/Toast")>("../../../ui/Toast");
  return {
    ...actual,
    useToast: () => ({ toast: mocks.toast, dismiss: vi.fn() }),
  };
});

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

vi.mock("../hooks/useMapStyle", () => ({
  useMapStyle: () => mocks.mapStyle,
}));

vi.mock("./MapView", () => ({
  MapView: (props: {
    vehicles: readonly unknown[];
    geofences: readonly unknown[];
    dimmed: boolean;
    error: unknown;
    baseStyle?: string;
    showErrorOverlay?: boolean;
    onSelect: (key: string) => void;
    onViewport: (viewport: unknown) => void;
  }) => {
    mocks.mapProps.push(props as never);
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
  mocks.mapStyle.effectiveStyle = "standard";
  mocks.mapStyle.chosenStyle = "standard";
  mocks.mapStyle.styles = ["standard", "satellite"];
  mocks.mapStyle.fallbackNotice = false;
  window.history.replaceState({}, "", "/map");
  mocks.navigate.mockReset();
  mocks.toast.mockReset();
  mocks.alerts.data = [];
  mocks.geofences.data = [];
  mocks.geofences.isError = false;
  mocks.geofences.error = null;
  mocks.snapshot.error = null;
  mocks.snapshot.isPending = false;
  mocks.snapshot.data = [
    vehicle("uuid-1", "demo-imei-0001", "AAA-100", { speed_kph: 50 }),
    vehicle("uuid-2", "demo-imei-0002", "BBB-200", { speed_kph: 0 }),
    vehicle("uuid-3", "demo-imei-0003", "CCC-300", { online: false }),
  ];
  useAuthStore.getState().setSession(user, "csrf");
});

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("centres the KPI strip in the map area when the panel closes", async () => {
    const { container } = renderPage();
    const strip = container.querySelector(".pointer-events-none.absolute");
    expect(strip).toHaveClass("lg:left-93");

    await userEvent.click(
      screen.getAllByRole("button", { name: "Hide the vehicle panel" })[0]!,
    );

    await waitFor(() => expect(strip).toHaveClass("lg:left-3"));
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

  it("re-adds a persistent geofence error toast only once per failure", async () => {
    mocks.geofences.isError = true;
    mocks.geofences.error = new Error("geofences down");
    renderPage();

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("keeps the map selection callback stable across list ticks", async () => {
    renderPage();

    await waitFor(() => expect(mocks.mapProps.length).toBeGreaterThan(0));
    const first = mocks.mapProps.at(-1)?.onSelect;
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(mocks.mapProps.at(-1)?.onSelect).toBe(first);
  });

  it("passes the effective base style to the map", async () => {
    mocks.mapStyle.effectiveStyle = "satellite";
    renderPage();
    await waitFor(() => expect(mocks.mapProps.at(-1)?.baseStyle).toBe("satellite"));
  });

  it("reflects the map bearing in the controls", async () => {
    renderPage();
    const onViewport = mocks.mapProps.at(-1)?.onViewport;
    expect(onViewport).toBeDefined();

    act(() =>
      onViewport?.({
        center: [3.4, 6.5],
        zoom: 8,
        bearing: 90,
        bounds: { south: 4, west: 2, north: 8, east: 5 },
      }),
    );

    expect(
      screen.getByRole("button", { name: "Reset bearing to north (Facing 90° E)" }),
    ).toBeVisible();
  });

  it("renders the attribution in both layouts", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /OpenStreetMap/ })).toBeVisible();

    mocks.desktop = false;
    renderPage();
    expect(screen.getAllByRole("link", { name: /OpenStreetMap/ }).length).toBeGreaterThan(0);
  });

  it("hides the compact KPI when the sheet is full", async () => {
    mocks.desktop = false;
    renderPage();

    expect(screen.getByText("Active trips")).toBeVisible();
    const handle = screen.getByRole("button", { name: /Showing 3 of 3/ });
    handle.focus();
    await userEvent.keyboard("{End}");

    expect(screen.queryByText("Active trips")).not.toBeInTheDocument();
  });

  it("publishes the drawer inset through the dev harness", async () => {
    vi.stubEnv("VITE_MOCK", "1");
    window.history.replaceState({}, "", "/map?inset=1");
    const { container } = renderPage();

    const root = container.querySelector<HTMLElement>('[data-testid="map-root"]');
    expect(root).not.toBeNull();
    await waitFor(() =>
      expect(root?.style.getPropertyValue("--map-inset-right")).toBe("432px"),
    );
    expect(screen.getByTestId("map-inset-harness")).toBeVisible();
  });

  it("keeps the geofence target stable across list ticks", async () => {
    renderPage();

    await waitFor(() => expect(mocks.mapProps.length).toBeGreaterThan(0));
    const first = mocks.mapProps.at(-1)?.geofences;
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(mocks.mapProps.at(-1)?.geofences).toBe(first);
  });
});
