import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "../../../api/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { TripConfirmDialog } from "./TripConfirmDialog";

const mocks = vi.hoisted(() => ({
  transition: vi.fn(),
  pending: false,
  error: null as unknown,
  reset: vi.fn(),
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

const trip: Trip = {
  id: "trip-1",
  vehicle_id: "vehicle-1",
  plate: "LSD-100-AA",
  origin: "Refinery Gate",
  destination: "Ibadan Customer",
  status: "active",
  distance_km: 0,
};

function renderDialog(action: "complete" | "cancel", disabledReason?: string) {
  const onClose = vi.fn();
  const onFinished = vi.fn();
  render(
    <TooltipProvider>
      <TripConfirmDialog
        open
        trip={trip}
        action={action}
        onClose={onClose}
        onFinished={onFinished}
        {...(disabledReason ? { disabledReason } : {})}
      />
    </TooltipProvider>,
  );
  return { onClose, onFinished };
}

describe("TripConfirmDialog", () => {
  beforeEach(() => {
    mocks.transition.mockReset();
    mocks.pending = false;
    mocks.error = null;
  });

  it("completes with a confirm and keeps Cancel focused by default", async () => {
    const user = userEvent.setup();
    mocks.transition.mockResolvedValue({ status: "done", reconciled: false });
    const { onFinished, onClose } = renderDialog("complete");

    expect(screen.getByRole("heading", { name: "Complete trip" })).toBeVisible();
    expect(screen.getByText(/The server stores the distance/)).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep trip" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Complete trip" }));
    await waitFor(() =>
      expect(mocks.transition).toHaveBeenCalledWith(trip, { status: "completed" }, "complete"),
    );
    expect(onFinished).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels with a destructive confirm", async () => {
    const user = userEvent.setup();
    mocks.transition.mockResolvedValue({ status: "done", reconciled: false });
    const { onFinished } = renderDialog("cancel");

    expect(screen.getByText(/This can't be undone/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel trip" }));
    await waitFor(() =>
      expect(mocks.transition).toHaveBeenCalledWith(trip, { status: "cancelled" }, "cancel"),
    );
    expect(onFinished).toHaveBeenCalled();
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
    const { onClose } = renderDialog("complete");

    expect(screen.getByText("It wasn't saved.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep trip" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("disables the confirming action with the offline reason", async () => {
    const user = userEvent.setup();
    renderDialog("complete", "You're offline.");
    const action = screen.getByRole("button", { name: "Complete trip" });

    expect(action).toHaveAttribute("aria-disabled", "true");
    await user.click(action);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
