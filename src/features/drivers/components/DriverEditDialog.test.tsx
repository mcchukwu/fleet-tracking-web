import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Driver } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { DriverEditDialog } from "./DriverEditDialog";

const mocks = vi.hoisted(() => ({
  write: {
    create: vi.fn(),
    update: vi.fn(),
    pending: false,
    error: null as AppError | null,
    reset: vi.fn(),
  },
}));

vi.mock("../hooks/useDriverWrite", () => ({
  useDriverWrite: () => mocks.write,
}));

const driver: Driver = {
  id: "driver-1",
  name: "Adebayo Okafor",
  phone: "08031000010",
  licence: "LIC-01010",
  status: "active",
  vehicles: 1,
};

function renderDialog(props: Partial<Parameters<typeof DriverEditDialog>[0]> = {}) {
  return render(
    <TooltipProvider>
      <DriverEditDialog
        open
        driver={driver}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.write = {
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ status: "done", reconciled: false }),
    pending: false,
    error: null,
    reset: vi.fn(),
  };
  vi.clearAllMocks();
});

describe("DriverEditDialog", () => {
  it("starts with the current values and nothing to save", () => {
    renderDialog();
    expect(screen.getByLabelText("Name")).toHaveValue("Adebayo Okafor");
    expect(screen.getByLabelText("Phone")).toHaveValue("08031000010");
    expect(screen.getByLabelText("Licence")).toHaveValue("LIC-01010");
    expect(screen.getByLabelText("Status")).toHaveValue("active");
    expect(screen.getByText("No changes to save.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("sends only the changed field", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onSaved, onClose });

    await user.clear(screen.getByLabelText("Phone"));
    await user.type(screen.getByLabelText("Phone"), "08031000011");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mocks.write.update).toHaveBeenCalledWith(driver, { phone: "08031000011" });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("clears a phone with an empty string", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.clear(screen.getByLabelText("Phone"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mocks.write.update).toHaveBeenCalledWith(driver, { phone: "" });
  });

  it("asks for confirmation before deactivating a driver with vehicles", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onSaved, onClose });

    await user.selectOptions(screen.getByLabelText("Status"), "inactive");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const confirm = screen.getByRole("dialog", { name: "Deactivate Adebayo Okafor?" });
    expect(confirm).toBeVisible();
    expect(
      screen.getByText(
        "Adebayo Okafor is assigned to 1 vehicle. Their vehicles stay assigned until you reassign them.",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Keep active" }));
    expect(mocks.write.update).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Status")).toHaveValue("inactive");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Deactivate driver" }));
    expect(mocks.write.update).toHaveBeenCalledWith(driver, { status: "inactive" });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("deactivates a zero-vehicle driver without a confirm", async () => {
    const user = userEvent.setup();
    renderDialog({ driver: { ...driver, vehicles: 0 } });
    await user.selectOptions(screen.getByLabelText("Status"), "inactive");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mocks.write.update).toHaveBeenCalledWith(
      { ...driver, vehicles: 0 },
      { status: "inactive" },
    );
    expect(
      screen.queryByRole("dialog", { name: "Deactivate Adebayo Okafor?" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the form and offers Refresh when the driver no longer exists", () => {
    mocks.write.error = {
      kind: "not_found",
      retryable: false,
      outcome: "failed",
      context: { route: "/drivers" },
      at: 0,
    };
    renderDialog();
    expect(screen.getByText("This driver no longer exists.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible();
    expect(screen.getByLabelText("Name")).toBeVisible();
  });

  it("does not force a status change on an unknown current status", async () => {
    const user = userEvent.setup();
    renderDialog({ driver: { ...driver, status: "suspended" } });
    expect(screen.getByLabelText("Status")).toHaveValue("suspended");
    await user.clear(screen.getByLabelText("Phone"));
    await user.type(screen.getByLabelText("Phone"), "08031000011");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mocks.write.update).toHaveBeenCalledWith(
      { ...driver, status: "suspended" },
      { phone: "08031000011" },
    );
  });

  it("keeps Save focusable but inert for a read-only role", async () => {
    const user = userEvent.setup();
    renderDialog({ disabledReason: "Your role can't edit drivers." });
    await user.type(screen.getByLabelText("Phone"), "9");
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
