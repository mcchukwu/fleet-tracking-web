import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Geofence } from "../../../api/types";
import type { MutatePermission } from "../../../auth/useCanMutate";
import { TooltipProvider } from "../../../ui/Tooltip";
import { GeofenceToolbar } from "./GeofenceToolbar";

const geofence: Geofence = {
  id: "gf-1",
  name: "Lekki Depot",
  kind: "depot",
  geometry: { type: "Polygon", coordinates: [] },
};

function permission(overrides: Partial<MutatePermission> = {}): MutatePermission {
  return {
    allowed: true,
    roleAllowed: true,
    blockedBy: null,
    reason: null,
    ...overrides,
  };
}

function renderToolbar(overrides: Partial<Parameters<typeof GeofenceToolbar>[0]> = {}) {
  return render(
    <TooltipProvider>
      <GeofenceToolbar
        selected={null}
        mutate={permission()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>,
  );
}

describe("GeofenceToolbar", () => {
  it("shows the selection hint when nothing is selected", () => {
    renderToolbar();
    expect(screen.getByText("Select a geofence to edit.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("shows the selected name, kind and both actions", () => {
    renderToolbar({ selected: geofence });
    expect(screen.getByText("Lekki Depot")).toBeInTheDocument();
    expect(screen.getByText("Depot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("keeps actions focusable with a role reason", async () => {
    renderToolbar({
      selected: geofence,
      mutate: permission({ allowed: false, roleAllowed: false, blockedBy: "role" }),
    });
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(edit);
    expect(edit).toHaveAttribute("aria-disabled", "true");
  });

  it("explains offline writes with the offline reason", async () => {
    renderToolbar({
      selected: geofence,
      mutate: permission({
        allowed: false,
        blockedBy: "offline",
        reason: "You're offline.",
      }),
    });
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-disabled", "true");
    await userEvent.hover(edit);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("You're offline.");
  });

  it("calls the handlers when enabled", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderToolbar({ selected: geofence, onEdit, onDelete });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
