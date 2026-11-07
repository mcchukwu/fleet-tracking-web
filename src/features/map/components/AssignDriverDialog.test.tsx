import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Vehicle } from "../../../api/types";
import { AssignDriverDialog } from "./AssignDriverDialog";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  error: null as unknown,
  pending: false,
  drivers: [
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
      name: "Adebayo Okafor",
      phone: "08031000000",
      licence: "LIC-01000",
      status: "active",
      vehicles: 1,
    },
    {
      id: "driver-3",
      name: "Retired Driver",
      phone: "08031000009",
      licence: "LIC-01009",
      status: "inactive",
      vehicles: 0,
    },
  ],
  driversPending: false,
  driversError: null as unknown,
}));

vi.mock("../hooks/useVehicleWrite", () => ({
  useVehicleWrite: () => ({
    submit: mocks.submit,
    pending: mocks.pending,
    error: mocks.error,
    reset: vi.fn(),
  }),
}));

vi.mock("../../../api/hooks/drivers", () => ({
  useDrivers: () => ({
    data: mocks.drivers,
    isPending: mocks.driversPending,
    error: mocks.driversError,
  }),
}));

const vehicle: Vehicle = {
  id: "vehicle-1",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  vehicle_type: "tanker",
  make: "MAN",
  model: "TGS",
  year: 2021,
  colour: "white",
  status: "active",
  depot: "Lekki Depot",
  department: "operations",
  driver_id: "driver-1",
  driver_name: "Adebayo Okafor",
  driver_phone: "08031000010",
  online: true,
};

function renderDialog(readOnly = false) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <AssignDriverDialog
      open
      vehicle={vehicle}
      onClose={onClose}
      onSaved={onSaved}
      onRefresh={vi.fn()}
      readOnly={readOnly}
    />,
  );
  return { onClose, onSaved };
}

describe("AssignDriverDialog", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.error = null;
    mocks.pending = false;
    mocks.driversPending = false;
    mocks.driversError = null;
  });

  it("lists active drivers with phone and licence and excludes inactive ones", async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByRole("combobox", { name: "Driver" });
    await user.click(input);

    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText("08031000000 · LIC-01000")).toBeVisible();
    expect(screen.queryByText(/Retired Driver/)).not.toBeInTheDocument();
  });

  it("sends only the chosen driver id", async () => {
    const user = userEvent.setup();
    mocks.submit.mockResolvedValue({ status: "success" });
    const { onSaved, onClose } = renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Driver" }));
    await user.type(screen.getByRole("combobox", { name: "Driver" }), "01000");
    await user.click(screen.getByText("08031000000 · LIC-01000"));
    await user.click(screen.getByRole("button", { name: "Assign driver" }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith({ driver_id: "driver-2" }));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("offers no way to unassign the current driver", async () => {
    const user = userEvent.setup();
    renderDialog();
    const assign = screen.getByRole("button", { name: "Assign driver" });
    expect(assign).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Driver" }));
    expect(screen.queryByText(/No driver|Unassign/)).not.toBeInTheDocument();
  });

  it("shows the empty state when no active drivers exist", () => {
    mocks.drivers = [];
    renderDialog();
    expect(screen.getByText("No active drivers are available.")).toBeVisible();
  });

  it("read-only blocks the action", () => {
    renderDialog(true);
    expect(screen.getAllByText("Your role can't assign drivers.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Assign driver" })).toBeDisabled();
  });

  it("explains a conflict and keeps the selection", () => {
    mocks.error = {
      kind: "conflict",
      retryable: false,
      outcome: "failed",
      context: { route: "/map" },
      at: 0,
    };
    const onRefresh = vi.fn();
    render(
      <AssignDriverDialog
        open
        vehicle={vehicle}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onRefresh={onRefresh}
        readOnly={false}
      />,
    );
    expect(screen.getByText("That driver is no longer available")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
});
