import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Driver } from "../../../api/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { DriversPage } from "./DriversPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  canMutate: true,
  network: "online",
  feed: {
    drivers: [] as Driver[],
    isLoading: false,
    isFetching: false,
    error: null as unknown,
    dataUpdatedAt: 0,
    cancelled: false,
    refetch: vi.fn(),
    cancel: vi.fn(),
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

vi.mock("../../../stores/connection", () => ({
  useConnection: () => ({ network: mocks.network }),
}));

vi.mock("../hooks/useDriverFeed", () => ({
  useDriverFeed: () => mocks.feed,
}));

vi.mock("./DriverTable", () => ({
  DriverTable: (props: {
    drivers: Driver[];
    state: string;
    disabledReason?: string;
    onOpen: (id: string) => void;
  }) => (
    <div
      data-testid="driver-table"
      data-state={props.state}
      data-disabled={props.disabledReason ?? ""}
    >
      <span data-testid="visible-count">{props.drivers.length}</span>
      {props.drivers[0] ? (
        <button type="button" onClick={() => props.onOpen(props.drivers[0]?.id ?? "")}>
          Open first driver
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("./DriverDrawer", () => ({
  DriverDrawer: (props: {
    driver: Driver | null;
    lookup: string;
    onEdit: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="driver-drawer" data-lookup={props.lookup}>
      {props.driver?.name ?? "none"}
      <button type="button" onClick={props.onEdit}>
        Edit first driver
      </button>
      <button type="button" onClick={props.onClose}>
        Close driver details
      </button>
    </div>
  ),
}));

vi.mock("./DriverCreateDialog", () => ({
  DriverCreateDialog: (props: { onCreated: () => void; onClose: () => void }) => (
    <div data-testid="create-dialog">
      <button type="button" onClick={props.onCreated}>
        Finish create
      </button>
      <button type="button" onClick={props.onClose}>
        Close create
      </button>
    </div>
  ),
}));

vi.mock("./DriverEditDialog", () => ({
  DriverEditDialog: (props: { open: boolean; driver: Driver | null; onRefresh: () => void }) =>
    props.open ? (
      <div data-testid="edit-dialog">
        {props.driver?.name}
        <button type="button" onClick={props.onRefresh}>
          Refresh driver list
        </button>
      </div>
    ) : null,
}));

const drivers: Driver[] = [
  {
    id: "driver-1",
    name: "Adebayo Okafor",
    phone: "08031000010",
    licence: "LIC-01010",
    status: "active",
    vehicles: 1,
  },
  {
    id: "driver-2",
    name: "Chinedu Musa",
    phone: "08031000001",
    licence: "LIC-01001",
    status: "inactive",
    vehicles: 0,
  },
];

function renderPage() {
  return render(
    <TooltipProvider>
      <DriversPage />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.search = {};
  mocks.canMutate = true;
  mocks.network = "online";
  mocks.feed = {
    drivers,
    isLoading: false,
    isFetching: false,
    error: null,
    dataUpdatedAt: 0,
    cancelled: false,
    refetch: vi.fn(),
    cancel: vi.fn(),
  };
  mocks.navigate.mockReset();
  vi.clearAllMocks();
});

describe("DriversPage", () => {
  it("shows the total or the filtered count and sets the document title", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Drivers" })).toBeVisible();
    expect(screen.getByTestId("drivers-page")).toHaveTextContent("2 drivers");
    expect(document.title).toBe("Drivers · Fleet Console");
  });

  it("shows the visible count when filters are active", () => {
    mocks.search = { q: "adebayo", status: "active" };
    renderPage();
    expect(screen.getByTestId("visible-count")).toHaveTextContent("1");
    expect(screen.getByTestId("drivers-page")).toHaveTextContent("1 of 2 drivers");
  });

  it("opens a driver with a push so the drawer can be closed with Back", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Open first driver" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/drivers",
      search: { driver: "driver-1" },
      replace: false,
    });
  });

  it("restores a deep-linked drawer from the full list", () => {
    mocks.search = { driver: "driver-2" };
    renderPage();
    expect(screen.getByTestId("driver-drawer")).toHaveAttribute("data-lookup", "ready");
    expect(screen.getByTestId("driver-drawer")).toHaveTextContent("Chinedu Musa");
  });

  it("shows a not-found drawer for an unknown deep link", () => {
    mocks.search = { driver: "does-not-exist" };
    renderPage();
    expect(screen.getByTestId("driver-drawer")).toHaveAttribute("data-lookup", "not-found");
  });

  it("closes a stale edit form when a refresh drops the driver", async () => {
    const user = userEvent.setup();
    mocks.search = { driver: "driver-1" };
    mocks.feed = {
      ...mocks.feed,
      refetch: vi.fn().mockResolvedValue(drivers.filter((driver) => driver.id !== "driver-1")),
    };
    renderPage();

    await user.click(screen.getByRole("button", { name: "Edit first driver" }));
    expect(screen.getByTestId("edit-dialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Refresh driver list" }));
    await waitFor(() => expect(screen.queryByTestId("edit-dialog")).not.toBeInTheDocument());
  });

  it("keeps an unresolved deep link neutral while offline", () => {
    mocks.network = "offline";
    mocks.search = { driver: "does-not-exist" };
    mocks.feed = {
      ...mocks.feed,
      drivers: [],
      error: {
        kind: "network",
        retryable: false,
        outcome: "failed",
        context: { route: "/drivers" },
        at: 0,
      },
    };
    renderPage();
    expect(screen.getByTestId("driver-drawer")).toHaveAttribute("data-lookup", "offline");
  });

  it("clears filters, resets the scroll and returns focus after a create", async () => {
    const user = userEvent.setup();
    mocks.search = { q: "ada", status: "inactive" };
    renderPage();

    await user.click(screen.getByRole("button", { name: "Finish create" }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/drivers",
      search: {},
      replace: true,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create driver" })).toHaveFocus(),
    );
  });

  it("passes the loading, error and forbidden states to the table", () => {
    mocks.feed = { ...mocks.feed, drivers: [], isLoading: true };
    const { rerender } = renderPage();
    expect(screen.getByTestId("driver-table")).toHaveAttribute("data-state", "loading");

    mocks.feed = {
      ...mocks.feed,
      isLoading: false,
      error: { kind: "network", retryable: true, outcome: "failed", context: { route: "/drivers" }, at: 0 },
    };
    rerender(
      <TooltipProvider>
        <DriversPage />
      </TooltipProvider>,
    );
    expect(screen.getByTestId("driver-table")).toHaveAttribute("data-state", "error");

    mocks.feed = {
      ...mocks.feed,
      error: { kind: "forbidden", retryable: false, outcome: "failed", context: { route: "/drivers" }, at: 0 },
    };
    rerender(
      <TooltipProvider>
        <DriversPage />
      </TooltipProvider>,
    );
    expect(screen.getByTestId("driver-table")).toHaveAttribute("data-state", "forbidden");
  });

  it("keeps create and edit visible but inert for a viewer", () => {
    mocks.canMutate = false;
    renderPage();
    expect(screen.getByRole("button", { name: "Create driver" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
