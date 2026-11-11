import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Geofence } from "../../../api/types";
import type { MapAdapter } from "../../../map/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { GeofencesPage } from "./GeofencesPage";

const holder = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  canMutate: true,
  network: "online",
  feed: {
    geofences: [] as Geofence[],
    isLoading: false,
    isFetching: false,
    error: null as unknown,
    dataUpdatedAt: 0,
    cancelled: false,
    refetch: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
  },
  listeners: new Map<string, (payload: never) => void>(),
  fitBounds: vi.fn(),
}));

const adapter = {
  id: "fake",
  capabilities: {
    offline: true,
    drawing: true,
    clustering: "emulated",
    comfortableVehicleCount: 1,
    styles: ["standard"],
  },
  on: (event: string, listener: (payload: never) => void) => {
    holder.listeners.set(event, listener);
    return () => holder.listeners.delete(event);
  },
  fitBounds: holder.fitBounds,
  getStyleState: () => ({ style: "standard", status: "ready", attribution: null }),
  getViewport: () => ({
    center: [3.4, 6.5],
    zoom: 10,
    bearing: 0,
    bounds: { south: 6, west: 3, north: 7, east: 4 },
  }),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
} as unknown as MapAdapter;

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => holder.search,
  useNavigate: () => holder.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("../../../auth/useCan", () => ({ useCan: () => holder.canMutate }));
vi.mock("../../../stores/connection", () => ({
  useConnection: () => ({ network: holder.network }),
}));
vi.mock("../../../lib/useMediaQuery", () => ({ useMediaQuery: () => true }));
vi.mock("../hooks/useGeofenceFeed", () => ({ useGeofenceFeed: () => holder.feed }));

vi.mock("./GeofenceList", () => ({
  GeofenceList: (props: {
    geofences: Geofence[];
    total: number;
    selected: Geofence | null;
    notFound: boolean;
    canMutate: boolean;
    offline: boolean;
    onSelect: (id: string) => void;
    onSearch: (value: string) => void;
    onClearSelection: () => void;
    onCreate: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) => (
    <div
      data-testid="list"
      data-total={props.total}
      data-visible={props.geofences.length}
      data-selected={props.selected?.id ?? ""}
      data-not-found={String(props.notFound)}
      data-can-mutate={String(props.canMutate)}
      data-offline={String(props.offline)}
    >
      <button type="button" onClick={() => props.onSelect(props.geofences[0]?.id ?? "")}>
        Select first
      </button>
      <button type="button" onClick={() => props.onSearch("lekki")}>
        Search lekki
      </button>
      <button type="button" onClick={props.onClearSelection}>
        Clear selection
      </button>
      <button type="button" onClick={props.onCreate}>
        Create from list
      </button>
    </div>
  ),
}));

vi.mock("./GeofenceMap", () => ({
  GeofenceMap: (props: {
    adapter: MapAdapter | null;
    hint?: string;
    onAdapter: (value: MapAdapter | null) => void;
    onFitAll: () => void;
  }) => (
    <div data-testid="map" data-hint={props.hint ?? ""}>
      <button type="button" onClick={() => props.onAdapter(adapter)}>
        Attach map
      </button>
      <button type="button" onClick={props.onFitAll}>
        Fit all from map
      </button>
    </div>
  ),
}));

const geofences: Geofence[] = [
  {
    id: "gf-1",
    name: "Border",
    kind: "depot",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [3.4, 6.4],
          [3.5, 6.4],
          [3.5, 6.5],
          [3.4, 6.4],
        ],
      ],
    },
  },
  {
    id: "gf-2",
    name: "Lekki Depot",
    kind: "depot",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [3.47, 6.43],
          [3.49, 6.43],
          [3.49, 6.445],
          [3.47, 6.43],
        ],
      ],
    },
  },
];

function load(search: Record<string, unknown> = {}, feed: Partial<typeof holder.feed> = {}) {
  holder.search = search;
  holder.feed = {
    ...holder.feed,
    geofences,
    dataUpdatedAt: 1,
    retry: vi.fn(),
    ...feed,
  };
  return render(
    <TooltipProvider>
      <GeofencesPage />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  holder.navigate.mockClear();
  holder.fitBounds.mockClear();
  holder.listeners.clear();
  holder.canMutate = true;
  holder.network = "online";
});

describe("GeofencesPage", () => {
  it("shows the count, split view and document title", async () => {
    load();
    expect(screen.getByRole("heading", { name: "Geofences" })).toBeInTheDocument();
    expect(screen.getByTestId("list")).toHaveAttribute("data-total", "2");
    expect(screen.getByTestId("map")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Geofences · Fleet Console"));
  });

  it("reports the filtered count", () => {
    load({ q: "lekki" });
    expect(screen.getByTestId("list")).toHaveAttribute("data-visible", "1");
  });

  it("selects a row with a push and clears with a replace", async () => {
    load();
    await userEvent.click(screen.getByRole("button", { name: "Select first" }));
    expect(holder.navigate).toHaveBeenLastCalledWith({
      to: "/geofences",
      search: { selected: "gf-1" },
      replace: false,
    });

    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(holder.navigate).toHaveBeenLastCalledWith({
      to: "/geofences",
      search: { selected: undefined },
      replace: true,
    });
  });

  it("writes the debounced search into the URL", async () => {
    load();
    await userEvent.click(screen.getByRole("button", { name: "Search lekki" }));
    expect(holder.navigate).toHaveBeenCalledWith({
      to: "/geofences",
      search: { q: "lekki" },
      replace: true,
    });
  });

  it("fits the selected geofence", async () => {
    load({ selected: "gf-1" });
    await userEvent.click(screen.getByRole("button", { name: "Attach map" }));
    await waitFor(() => expect(holder.fitBounds).toHaveBeenCalled());
  });

  it("fits every geofence from the map control", async () => {
    load();
    await userEvent.click(screen.getByRole("button", { name: "Attach map" }));
    holder.fitBounds.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Fit all from map" }));
    expect(holder.fitBounds).toHaveBeenCalledOnce();
  });

  it("selects a polygon clicked on the map and clears a hiding search", async () => {
    load({ q: "border" });
    await userEvent.click(screen.getByRole("button", { name: "Attach map" }));
    act(() => {
      holder.listeners.get("geofenceClick")?.({ id: "gf-2" } as never);
    });
    expect(holder.navigate).toHaveBeenCalledWith({
      to: "/geofences",
      search: { q: undefined, selected: "gf-2" },
      replace: false,
    });
  });

  it("clears the selection on an empty map click", async () => {
    load({ selected: "gf-1" });
    await userEvent.click(screen.getByRole("button", { name: "Attach map" }));
    act(() => {
      holder.listeners.get("mapClick")?.({ point: [3.4, 6.5] } as never);
    });
    expect(holder.navigate).toHaveBeenCalledWith({
      to: "/geofences",
      search: { selected: undefined },
      replace: true,
    });
  });

  it("flags a deep link that resolves to no geofence", () => {
    load({ selected: "gone" });
    expect(screen.getByTestId("list")).toHaveAttribute("data-not-found", "true");
  });

  it("passes role and offline gating to the list and create button", async () => {
    holder.canMutate = false;
    load();
    expect(screen.getByTestId("list")).toHaveAttribute("data-can-mutate", "false");
    expect(screen.getByRole("button", { name: "Create geofence" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("passes the offline flag to the list", () => {
    holder.network = "offline";
    load();
    expect(screen.getByTestId("list")).toHaveAttribute("data-offline", "true");
  });

  it("opens the create editor place", async () => {
    load();
    await userEvent.click(screen.getByRole("button", { name: "Create from list" }));
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-hint",
      "Click to add points. Click the first point or press Enter to close.",
    );
  });
});
