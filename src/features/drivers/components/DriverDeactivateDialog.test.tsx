import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Driver } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { DriverDeactivateDialog } from "./DriverDeactivateDialog";

const mocks = vi.hoisted(() => ({
  write: {
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
  vehicles: 2,
};

function renderDialog(props: Partial<Parameters<typeof DriverDeactivateDialog>[0]> = {}) {
  return render(
    <TooltipProvider>
      <DriverDeactivateDialog
        open
        driver={driver}
        update={{ status: "inactive" }}
        onCancel={vi.fn()}
        onFinished={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.write = {
    update: vi.fn().mockResolvedValue({ status: "done", reconciled: false }),
    pending: false,
    error: null,
    reset: vi.fn(),
  };
  vi.clearAllMocks();
});

describe("DriverDeactivateDialog", () => {
  it("names the driver and the count and explains that assignments stay", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Deactivate Adebayo Okafor?" })).toBeVisible();
    expect(
      screen.getByText(
        "Adebayo Okafor is assigned to 2 vehicles. Their vehicles stay assigned until you reassign them.",
      ),
    ).toBeVisible();
  });

  it("defaults focus to Keep active and never writes on cancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderDialog({ onCancel });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Keep active" })).toHaveFocus(),
    );
    await user.click(screen.getByRole("button", { name: "Keep active" }));
    expect(onCancel).toHaveBeenCalled();
    expect(mocks.write.update).not.toHaveBeenCalled();
  });

  it("sends only the status and finishes", async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    renderDialog({ onFinished });

    await user.click(screen.getByRole("button", { name: "Deactivate driver" }));
    expect(mocks.write.update).toHaveBeenCalledWith(driver, { status: "inactive" });
    expect(onFinished).toHaveBeenCalled();
  });

  it("shows a failed deactivation without closing", async () => {
    mocks.write.error = {
      kind: "network",
      retryable: true,
      outcome: "failed",
      context: { route: "/drivers" },
      at: 0,
    };
    renderDialog();
    expect(screen.getByText("It wasn't saved.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Deactivate driver" })).toBeVisible();
  });
});
