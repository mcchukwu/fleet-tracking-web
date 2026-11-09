import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../../../errors/types";
import { TripCreateDialog } from "./TripCreateDialog";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  pending: false,
  error: null as AppError | null,
  reset: vi.fn(),
  snapshot: {
    data: [
      {
        id: "vehicle-1",
        external_id: "demo-imei-0001",
        plate: "LSD-100-AA",
        depot: "Lekki Depot",
        online: true,
      },
    ],
    isPending: false,
    error: null as unknown,
  },
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
    ],
    isPending: false,
    error: null as unknown,
  },
}));

vi.mock("../hooks/useTripWrite", () => ({
  useTripWrite: () => ({
    create: mocks.create,
    transition: vi.fn(),
    pending: mocks.pending,
    error: mocks.error,
    reset: mocks.reset,
  }),
  tripWriteCopy: () => ({
    title: "Couldn't create the trip",
    detail: "Check the fields and try again.",
  }),
}));

vi.mock("../../../api/hooks/vehicles", () => ({
  useLiveSnapshot: () => mocks.snapshot,
}));

vi.mock("../../../api/hooks/drivers", () => ({
  useDrivers: () => mocks.drivers,
}));

function renderDialog() {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(
    <TripCreateDialog
      open
      knownTripIds={new Set(["trip-old"])}
      onCreated={onCreated}
      onClose={onClose}
    />,
  );
  return { onCreated, onClose };
}

describe("TripCreateDialog", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.error = null;
    mocks.pending = false;
  });

  it("validates the required fields", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Create trip" }));
    expect(await screen.findByText("Choose a vehicle.")).toBeVisible();
    expect(screen.getByText("Enter an origin.")).toBeVisible();
    expect(screen.getByText("Enter a destination.")).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("submits the vehicle, driver and trimmed route without a status", async () => {
    const user = userEvent.setup();
    mocks.create.mockResolvedValue({ status: "created" });
    const { onCreated, onClose } = renderDialog();

    await user.click(screen.getByLabelText("Vehicle"));
    await user.click(screen.getByRole("option", { name: /LSD-100-AA/ }));
    await user.click(screen.getByLabelText("Driver (optional)"));
    await user.click(screen.getByRole("option", { name: /Adebayo Okafor/ }));
    await user.type(screen.getByLabelText("Origin"), "  Refinery Gate  ");
    await user.type(screen.getByLabelText("Destination"), "Ibadan Customer");
    await user.click(screen.getByRole("button", { name: "Create trip" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        {
          vehicle_id: "vehicle-1",
          driver_id: "driver-1",
          origin: "Refinery Gate",
          destination: "Ibadan Customer",
        },
        new Set(["trip-old"]),
      ),
    );
    const payload = mocks.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("distance_km");
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the form and shows a server error", async () => {
    const user = userEvent.setup();
    mocks.error = {
      kind: "validation",
      retryable: false,
      outcome: "failed",
      context: { route: "/trips" },
      at: 0,
    };
    mocks.create.mockResolvedValue({ status: "error", error: mocks.error });
    const { onClose } = renderDialog();

    await user.click(screen.getByLabelText("Vehicle"));
    await user.click(screen.getByRole("option", { name: /LSD-100-AA/ }));
    await user.type(screen.getByLabelText("Origin"), "Refinery Gate");
    await user.type(screen.getByLabelText("Destination"), "Ibadan Customer");
    await user.click(screen.getByRole("button", { name: "Create trip" }));

    expect(await screen.findByText("Couldn't create the trip")).toBeVisible();
    expect(screen.getByLabelText("Origin")).toHaveValue("Refinery Gate");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks before discarding a dirty form", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.type(screen.getByLabelText("Origin"), "Refinery Gate");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Discard this trip?")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });
});
