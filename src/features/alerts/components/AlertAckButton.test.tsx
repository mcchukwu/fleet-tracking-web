import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Alert } from "../../../api/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { AlertAckButton } from "./AlertAckButton";

const alert: Alert = {
  id: "alert-1",
  vehicle_id: "v-1",
  plate: "LSD-101-AA",
  type: "idle",
  severity: "high",
  status: "open",
  occurred_at: "2026-11-02T12:00:00Z",
  evidence: {},
};

describe("AlertAckButton", () => {
  it("acknowledges when enabled", async () => {
    const onAck = vi.fn();
    render(<AlertAckButton alert={alert} pending={false} onAck={onAck} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
    );
    expect(onAck).toHaveBeenCalledTimes(1);
  });

  it("blocks a second submit while pending", async () => {
    const onAck = vi.fn();
    render(<AlertAckButton alert={alert} pending onAck={onAck} />);
    const button = screen.getByRole("button", {
      name: "Acknowledge alert for LSD-101-AA",
    });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onAck).not.toHaveBeenCalled();
  });

  it("stays visible and focusable with a disabled reason", async () => {
    const onAck = vi.fn();
    render(
      <TooltipProvider>
        <AlertAckButton
          alert={alert}
          pending={false}
          disabledReason="Viewers can't acknowledge alerts."
          onAck={onAck}
        />
      </TooltipProvider>,
    );
    const button = screen.getByRole("button", {
      name: "Acknowledge alert for LSD-101-AA",
    });
    expect(button).toHaveAttribute("aria-disabled", "true");
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onAck).not.toHaveBeenCalled();
  });

  it("carries an accessible name in the icon-only variant", () => {
    render(<AlertAckButton alert={alert} pending={false} onAck={() => undefined} iconOnly />);
    expect(
      screen.getByRole("button", { name: "Acknowledge alert for LSD-101-AA" }),
    ).toBeVisible();
  });
});
