import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Vehicle } from "../../../api/types";
import { ToastProvider } from "../../../ui/Toast";
import { VehicleEditDialog } from "./VehicleEditDialog";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  error: null as unknown,
  pending: false,
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
        name: "Chinedu Musa",
        phone: "08031000001",
        licence: "LIC-01001",
        status: "active",
        vehicles: 1,
      },
    ],
    isPending: false,
    error: null,
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

function renderDialog(readOnly = false, readOnlyReason?: string) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <ToastProvider>
      <VehicleEditDialog
        open
        vehicle={vehicle}
        onClose={onClose}
        onSaved={onSaved}
        onRefresh={vi.fn()}
        readOnly={readOnly}
        {...(readOnlyReason ? { readOnlyReason } : {})}
      />
    </ToastProvider>,
  );
  return { onClose, onSaved };
}

describe("VehicleEditDialog", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.error = null;
    mocks.pending = false;
  });

  it("starts with the current values and disables Save until something changes", () => {
    renderDialog();
    expect(screen.getByLabelText("Plate")).toHaveValue("LSD-100-AA");
    expect(screen.getByLabelText("Year")).toHaveValue("2021");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByText("No changes to save.")).toBeVisible();
  });

  it("sends only the changed field", async () => {
    const user = userEvent.setup();
    mocks.submit.mockResolvedValue({ status: "success" });
    const { onSaved, onClose } = renderDialog();

    const plate = screen.getByLabelText("Plate");
    await user.clear(plate);
    await user.type(plate, "LSD-100-AB");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith({ plate: "LSD-100-AB" }));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("adopts fresh server values when the vehicle prop changes", () => {
    const { rerender } = render(
      <ToastProvider>
        <VehicleEditDialog
          open
          vehicle={vehicle}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onRefresh={vi.fn()}
          readOnly={false}
        />
      </ToastProvider>,
    );
    expect(screen.getByLabelText("Plate")).toHaveValue("LSD-100-AA");

    rerender(
      <ToastProvider>
        <VehicleEditDialog
          open
          vehicle={{ ...vehicle, plate: "LSD-100-AC" }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
          onRefresh={vi.fn()}
          readOnly={false}
        />
      </ToastProvider>,
    );
    expect(screen.getByLabelText("Plate")).toHaveValue("LSD-100-AC");
  });

  it("does not offer a save when a text field is cleared", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Department"));

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByText("No changes to save.")).toBeVisible();
  });

  it("links the administrative status error to its select", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Plate"));
    await user.type(screen.getByLabelText("Plate"), "LSD-100-AB");
    await user.selectOptions(screen.getByLabelText("Administrative status"), "");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Choose an administrative status.");
    const select = screen.getByLabelText("Administrative status");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("rejects clearing the year without sending a request", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Year"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Year can't be cleared.")).toBeVisible();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("asks before discarding a dirty form", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.type(screen.getByLabelText("Plate"), "X");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("dialog", { name: "Discard changes?" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("read-only keeps fields visible and blocks saving", () => {
    renderDialog(true);
    expect(
      screen.getByText("Your role can't edit vehicles. The fields are shown for reference."),
    ).toBeVisible();
    expect(screen.getByLabelText("Plate")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("names the offline reason when the network blocks the write", () => {
    renderDialog(true, "You're offline.");
    expect(screen.getByText("You're offline. The fields are shown for reference.")).toBeVisible();
  });

  it("shows a server-error message and keeps the form", async () => {
    mocks.error = {
      kind: "validation",
      retryable: false,
      outcome: "failed",
      context: { route: "/map" },
      at: 0,
    };
    renderDialog();
    expect(await screen.findByText("Couldn't save the vehicle")).toBeVisible();
    expect(screen.getByText("Check the fields and try again.")).toBeVisible();
  });
});
