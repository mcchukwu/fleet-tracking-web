import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../../../api/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { TripAssignDriverDialog } from "./TripAssignDriverDialog";

const mocks = vi.hoisted(() => ({
  transition: vi.fn(),
  pending: false,
  error: null as unknown,
  reset: vi.fn(),
  drivers: {
    data: [
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
        name: "Retired Driver",
        phone: "08031000009",
        licence: "LIC-01009",
        status: "inactive",
        vehicles: 0,
      },
    ],
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("../hooks/useTripWrite", () => ({
  useTripWrite: () => ({
    create: vi.fn(),
    transition: mocks.transition,
    pending: mocks.pending,
    error: mocks.error,
    reset: mocks.reset,
  }),
  tripWriteCopy: () => ({ title: "It wasn't saved.", detail: "Try again." }),
}));

vi.mock("../../../api/hooks/drivers", () => ({
  useDrivers: () => mocks.drivers,
}));

const trip: Trip = {
  id: "trip-1",
  vehicle_id: "vehicle-1",
  plate: "LSD-100-AA",
  origin: "Refinery Gate",
  destination: "Ibadan Customer",
  status: "planned",
  distance_km: 0,
};

function renderDialog(disabledReason?: string) {
  const onClose = vi.fn();
  const onFinished = vi.fn();
  render(
    <TooltipProvider>
      <TripAssignDriverDialog
        open
        trip={trip}
        onClose={onClose}
        onFinished={onFinished}
        {...(disabledReason ? { disabledReason } : {})}
      />
    </TooltipProvider>,
  );
  return { onClose, onFinished };
}

describe("TripAssignDriverDialog", () => {
  beforeEach(() => {
    mocks.transition.mockReset();
    mocks.pending = false;
    mocks.error = null;
    mocks.reset.mockReset();
    mocks.drivers = {
      data: [
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
          name: "Retired Driver",
          phone: "08031000009",
          licence: "LIC-01009",
          status: "inactive",
          vehicles: 0,
        },
      ],
      isPending: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("lists active drivers only and enables submit after a choice", async () => {
    const user = userEvent.setup();
    const { onFinished, onClose } = renderDialog();
    mocks.transition.mockResolvedValue({ status: "done", reconciled: false });

    const submit = screen.getByRole("button", { name: "Assign driver" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByLabelText("Driver"));
    expect(screen.getByRole("option", { name: /Adebayo Okafor/ })).toBeVisible();
    expect(screen.queryByRole("option", { name: /Retired Driver/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Adebayo Okafor/ }));

    await user.click(submit);
    await waitFor(() =>
      expect(mocks.transition).toHaveBeenCalledWith(
        trip,
        { status: "assigned", driver_id: "driver-1" },
        "assign",
      ),
    );
    expect(onFinished).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the no-driver reason", () => {
    mocks.drivers = { data: [], isPending: false, error: null, refetch: vi.fn() };
    renderDialog();
    expect(
      screen.getByText("No active drivers are available. Add one before assigning this trip."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Assign driver" })).toBeDisabled();
  });

  it("keeps the dialog open on failure", async () => {
    const user = userEvent.setup();
    mocks.error = {
      kind: "network",
      retryable: true,
      outcome: "failed",
      context: { route: "/trips" },
      at: 0,
    };
    mocks.transition.mockResolvedValue({ status: "error", error: mocks.error });
    const { onClose } = renderDialog();

    await user.click(screen.getByLabelText("Driver"));
    await user.click(screen.getByRole("option", { name: /Adebayo Okafor/ }));
    await user.click(screen.getByRole("button", { name: "Assign driver" }));

    expect(screen.getByText("It wasn't saved.")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers a retry when the driver list fails", async () => {
    mocks.drivers = {
      data: [],
      isPending: false,
      error: {
        kind: "network",
        retryable: true,
        outcome: "failed",
        context: { route: "/trips" },
        at: 0,
      },
      refetch: vi.fn(),
    };
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Retry drivers" }));
    expect(mocks.drivers.refetch).toHaveBeenCalledTimes(1);
  });

  it("clears the selection and write error when reopened", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <TripAssignDriverDialog open trip={trip} onClose={onClose} />,
    );

    await user.click(screen.getByLabelText("Driver"));
    await user.click(screen.getByRole("option", { name: /Adebayo Okafor/ }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.reset).toHaveBeenCalled();

    rerender(<TripAssignDriverDialog open={false} trip={trip} onClose={onClose} />);
    rerender(<TripAssignDriverDialog open trip={trip} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Assign driver" })).toBeDisabled();
  });

  it("disables the assignment with the offline reason", async () => {
    const user = userEvent.setup();
    renderDialog("You're offline.");
    await user.click(screen.getByRole("combobox", { name: "Driver" }));
    await user.click(screen.getByRole("option", { name: /Adebayo Okafor/ }));

    const action = screen.getByRole("button", { name: "Assign driver" });
    expect(action).toHaveAttribute("aria-disabled", "true");
    await user.click(action);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
