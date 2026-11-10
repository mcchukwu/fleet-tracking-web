import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../../../api/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { TripsPage } from "./TripsPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  canMutate: true,
  feed: {
    trips: [] as Trip[],
    loadedCount: 0,
    hasMore: false,
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    error: null as unknown,
    dataUpdatedAt: 0,
    cancelled: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
    cancel: vi.fn(),
  },
  lookup: { data: [] as Trip[], isPending: false, error: null as unknown, refetch: vi.fn() },
  write: {
    create: vi.fn(),
    transition: vi.fn(),
    pending: false,
    error: null as unknown,
    reset: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("../../../auth/useCan", () => ({
  useCan: () => mocks.canMutate,
}));

vi.mock("../hooks/useTripFeed", () => ({
  useTripFeed: () => mocks.feed,
  visibleTrips: (trips: Trip[]) => trips,
}));

vi.mock("../../../api/hooks/trips", () => ({
  useTrips: () => mocks.lookup,
}));

vi.mock("../hooks/useTripWrite", () => ({
  useTripWrite: () => mocks.write,
  tripWriteCopy: () => ({ title: "It wasn't saved.", detail: "Try again." }),
}));

vi.mock("./TripTable", () => ({
  TripTable: (props: {
    trips: Trip[];
    state: string;
    disabledReason?: string;
    resetKey?: string;
    onOpen: (id: string) => void;
  }) => (
    <div
      data-testid="trip-table"
      data-state={props.state}
      data-disabled={props.disabledReason ?? ""}
      data-reset-key={props.resetKey ?? ""}
    >
      <span data-testid="loaded">{props.trips.length}</span>
      {props.trips[0] ? (
        <button type="button" onClick={() => props.onOpen(props.trips[0]?.id ?? "")}>
          Open first trip
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("./TripDetailPanel", () => ({
  TripDetailPanel: () => <div data-testid="trip-detail" />,
}));

vi.mock("./TripCreateDialog", () => ({
  TripCreateDialog: (props: { open: boolean; onCreated: () => void }) =>
    props.open ? (
      <button type="button" data-testid="trip-created" onClick={props.onCreated}>
        Trip created
      </button>
    ) : null,
}));

vi.mock("./TripAssignDriverDialog", () => ({
  TripAssignDriverDialog: () => null,
}));

vi.mock("./TripConfirmDialog", () => ({
  TripConfirmDialog: () => null,
}));

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    vehicle_id: "vehicle-1",
    plate: "LSD-100-AA",
    origin: "Refinery Gate",
    destination: "Ibadan Customer",
    status: "planned",
    distance_km: 0,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <TooltipProvider>
      <TripsPage />
    </TooltipProvider>,
  );
}

describe("TripsPage", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.search = {};
    mocks.canMutate = true;
    mocks.feed = {
      ...mocks.feed,
      trips: [trip()],
      loadedCount: 1,
      error: null,
      dataUpdatedAt: 0,
    };
    mocks.lookup = { data: [], isPending: false, error: null, refetch: vi.fn() };
  });

  it("renders the header, title and the loaded table", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Trips" })).toBeVisible();
    expect(screen.getByTestId("loaded")).toHaveTextContent("1");
    await waitFor(() => expect(document.title).toBe("Trips · Fleet Console"));
    expect(screen.getByTestId("trip-table")).toHaveAttribute("data-state", "ready");
  });

  it("writes the status and order to the URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText("Status"), "active");
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/trips",
      search: { status: "active" },
      replace: true,
    });

    await user.selectOptions(screen.getByLabelText("Sort"), "started");
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/trips",
      search: { order: "started" },
      replace: true,
    });
  });

  it("resets the status and search", async () => {
    const user = userEvent.setup();
    mocks.search = { status: "active", q: "lsd" };
    renderPage();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/trips",
      search: { status: undefined, q: undefined },
      replace: true,
    });
  });

  it("disables creating and changes for a viewer", () => {
    mocks.canMutate = false;
    renderPage();

    expect(screen.getByRole("button", { name: "Create trip" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByTestId("trip-table")).toHaveAttribute(
      "data-disabled",
      "Your role can't change trips.",
    );
  });

  it("clears filters and returns focus after a create", async () => {
    const user = userEvent.setup();
    mocks.search = { status: "planned", q: "lsd" };
    renderPage();
    const before = screen.getByTestId("trip-table").getAttribute("data-reset-key");

    await user.click(screen.getByRole("button", { name: "Create trip" }));
    await user.click(screen.getByTestId("trip-created"));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/trips",
      search: { status: undefined, q: undefined, trip: undefined },
      replace: true,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create trip" })).toHaveFocus(),
    );
    expect(screen.getByTestId("trip-table").getAttribute("data-reset-key")).not.toBe(before);
  });

  it("formats the loaded count", () => {
    mocks.feed = { ...mocks.feed, loadedCount: 1234 };
    renderPage();
    expect(screen.getByText("1,234")).toBeVisible();
  });

  it("opens a trip through the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Open first trip" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/trips",
      search: { trip: "trip-1" },
      replace: false,
    });
  });
});
