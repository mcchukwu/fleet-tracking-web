import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../../ui/Tooltip";
import { VehicleActions } from "./VehicleActions";

function renderActions(overrides: Partial<ComponentProps<typeof VehicleActions>> = {}) {
  const onCentre = vi.fn();
  const onEdit = vi.fn();
  render(
    <TooltipProvider>
      <VehicleActions
        onCentre={onCentre}
        onPlayback={vi.fn()}
        onEdit={onEdit}
        onAssign={vi.fn()}
        mapReady
        hasPosition
        canMutate
        {...overrides}
      />
    </TooltipProvider>,
  );
  return { onCentre, onEdit };
}

describe("VehicleActions", () => {
  it("enables every action when the role, network, map and position allow it", async () => {
    const { onCentre } = renderActions();
    const centre = screen.getByRole("button", { name: "Centre on map" });
    expect(centre).not.toHaveAttribute("aria-disabled");
    await userEvent.click(centre);
    expect(onCentre).toHaveBeenCalledTimes(1);
  });

  it("keeps role-disabled actions focusable and does not click", async () => {
    const { onEdit } = renderActions({ canMutate: false });
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    edit.focus();
    expect(edit).toHaveFocus();
    await userEvent.click(edit);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("disables centre when the map failed or there is no position", () => {
    renderActions({ mapReady: false });
    expect(screen.getByRole("button", { name: "Centre on map" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables edit and assign until the detail record is available", async () => {
    const { onEdit } = renderActions({ canEdit: false });
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(edit);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("marks edits and assignments offline", () => {
    renderActions({ canMutate: false, mutateReason: "You're offline." });
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Assign driver" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("renders the icon variant with accessible names", () => {
    renderActions({ variant: "icons" });
    expect(screen.getByRole("button", { name: "Centre on map" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Play back" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Assign driver" })).toBeVisible();
  });
});
