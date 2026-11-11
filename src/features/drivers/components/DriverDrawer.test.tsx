import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Driver, SnapshotVehicle } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { ToastProvider } from "../../../ui/Toast";
import { TooltipProvider } from "../../../ui/Tooltip";
import { DriverDrawer } from "./DriverDrawer";

const mocks = vi.hoisted(() => ({
  snapshot: {
    data: undefined as SnapshotVehicle[] | undefined,
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useLiveSnapshot: () => mocks.snapshot,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: { v?: string };
    children: ReactNode;
  }) => <a href={`${to}?v=${search?.v ?? ""}`}>{children}</a>,
}));

const driver: Driver = {
  id: "driver-1",
  name: "Adebayo Okafor",
  phone: "0803 100 0010",
  licence: "LIC-01010",
  status: "active",
  vehicles: 1,
};

const vehicles: SnapshotVehicle[] = [
  {
    id: "vehicle-2",
    external_id: "demo-imei-0002",
    plate: "LSD-101-AA",
    depot: "Apapa Depot",
    driver_id: "driver-1",
    online: true,
  },
  {
    id: "vehicle-1",
    external_id: "demo-imei-0001",
    plate: "LSD-100-AA",
    depot: "Lekki Depot",
    driver_id: "driver-1",
    online: true,
  },
];

function renderDrawer(props: Partial<Parameters<typeof DriverDrawer>[0]> = {}) {
  return render(
    <TooltipProvider>
      <ToastProvider>
        <DriverDrawer
          driver={driver}
          lookup="ready"
          offline={false}
          onEdit={vi.fn()}
          onClose={vi.fn()}
          onRetryLookup={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.snapshot = {
    data: vehicles,
    isPending: false,
    error: null,
    refetch: vi.fn(),
  };
  vi.clearAllMocks();
});

describe("DriverDrawer", () => {
  it("shows contact details, copy actions and the assigned vehicles", () => {
    renderDrawer();
    const drawer = screen.getByRole("complementary", { name: "Driver details" });

    expect(within(drawer).getByRole("heading", { name: "Adebayo Okafor" })).toBeVisible();
    expect(within(drawer).getByRole("link", { name: "0803 100 0010" })).toHaveAttribute(
      "href",
      "tel:08031000010",
    );
    expect(within(drawer).getByRole("button", { name: "Copy licence LIC-01010" })).toBeVisible();
    expect(within(drawer).getByRole("button", { name: "Copy driver id driver-1" })).toBeVisible();
    expect(within(drawer).getByText("Server count")).toBeVisible();
    expect(within(drawer).getByRole("link", { name: "LSD-100-AA" })).toHaveAttribute(
      "href",
      "/map?v=vehicle-1",
    );
    expect(within(drawer).getByRole("link", { name: "LSD-101-AA" })).toHaveAttribute(
      "href",
      "/map?v=vehicle-2",
    );
  });

  it("shows both counts when the snapshot disagrees with the server", () => {
    renderDrawer({ driver: { ...driver, vehicles: 3 } });
    expect(
      screen.getByText(
        "The server counts 3; this list shows the current snapshot (2).",
      ),
    ).toBeVisible();
  });

  it("explains that an inactive driver keeps the assignments", () => {
    renderDrawer({ driver: { ...driver, status: "inactive" } });
    expect(
      screen.getByText("Inactive drivers keep their current vehicle assignments."),
    ).toBeVisible();
    expect(screen.getAllByText("Inactive").length).toBeGreaterThanOrEqual(2);
  });

  it("shows an empty assignment list honestly", () => {
    mocks.snapshot = { ...mocks.snapshot, data: [] };
    renderDrawer({ driver: { ...driver, vehicles: 0 } });
    expect(screen.getByText("No vehicles assigned.")).toBeVisible();
    expect(screen.queryByText(/Server counts/)).not.toBeInTheDocument();
  });

  it("shows a driver not-found state with a way back", () => {
    const onClose = vi.fn();
    renderDrawer({ driver: null, lookup: "not-found", onClose });
    expect(screen.getByText("Driver not found")).toBeVisible();
    expect(screen.getByText("It may have been removed.")).toBeVisible();
    screen.getByRole("button", { name: "Back to drivers" }).click();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the loading and error states for the selected driver", () => {
    const { rerender } = renderDrawer({ driver: null, lookup: "loading" });
    expect(screen.getByLabelText("Loading driver")).toBeVisible();

    const error: AppError = {
      kind: "network",
      retryable: true,
      outcome: "failed",
      context: { route: "/drivers" },
      at: 0,
    };
    rerender(
      <TooltipProvider>
        <ToastProvider>
          <DriverDrawer
            driver={null}
            lookup="error"
            lookupError={error}
            offline={false}
            onEdit={vi.fn()}
            onClose={vi.fn()}
            onRetryLookup={vi.fn()}
          />
        </ToastProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("Can't reach the server")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("keeps the driver fields when the snapshot fails", () => {
    mocks.snapshot = {
      ...mocks.snapshot,
      data: undefined,
      error: {
        kind: "server",
        retryable: true,
        outcome: "failed",
        context: { route: "/drivers" },
        at: 0,
      } satisfies AppError,
    };
    renderDrawer();
    expect(screen.getByRole("heading", { name: "Adebayo Okafor" })).toBeVisible();
    expect(screen.getByText("Something went wrong on our side")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("marks cached vehicles while offline", () => {
    renderDrawer({ offline: true });
    expect(screen.getByText("Showing the last loaded vehicles.")).toBeVisible();
    expect(screen.getByRole("link", { name: "LSD-100-AA" })).toBeVisible();
  });
});
