import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Geofence } from "../../../api/types";
import type { GeofenceDeleteController } from "../hooks/useGeofenceDelete";
import { GeofenceDeleteDialog } from "./GeofenceDeleteDialog";

const geofence: Geofence = {
  id: "gf-1",
  name: "Refinery Gate",
  kind: "restricted",
  geometry: { type: "Polygon", coordinates: [] },
};

function makeWrite(overrides: Partial<GeofenceDeleteController> = {}): GeofenceDeleteController {
  return {
    remove: vi.fn().mockResolvedValue({ status: "deleted" }),
    cancel: vi.fn(),
    retry: vi.fn(),
    pending: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  };
}

function renderDialog(write = makeWrite()) {
  const onDeleted = vi.fn();
  const onClose = vi.fn();
  const onRefresh = vi.fn();
  render(
    <GeofenceDeleteDialog
      geofence={geofence}
      open
      write={write}
      onClose={onClose}
      onDeleted={onDeleted}
      onRefresh={onRefresh}
    />,
  );
  return { write, onDeleted, onClose, onRefresh };
}

describe("GeofenceDeleteDialog", () => {
  it("names the geofence and defaults focus to Cancel", async () => {
    renderDialog();
    expect(
      screen.getByRole("heading", { name: 'Delete geofence "Refinery Gate"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("deletes and reports the result", async () => {
    const { write, onDeleted } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(write.remove).toHaveBeenCalledWith(geofence);
  });

  it("treats a reconciled delete as deleted", async () => {
    const write = makeWrite({ remove: vi.fn().mockResolvedValue({ status: "reconciled" }) });
    const { onDeleted } = renderDialog(write);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it("stays open and explains a 409 with the real server detail", async () => {
    const error = {
      kind: "conflict" as const,
      code: "in_use",
      serverMessage: "geofence has events and cannot be deleted",
      retryable: false,
      outcome: "failed" as const,
      context: { route: "/geofences" },
      at: 0,
    };
    const write = makeWrite({
      remove: vi.fn().mockResolvedValue({ status: "blocked", error }),
    });
    const { onDeleted } = renderDialog(write);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("This geofence has recorded events and can't be deleted."),
    ).toBeInTheDocument();
    expect(screen.getByText("geofence has events and cannot be deleted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("reports a geofence that disappeared and offers Refresh", async () => {
    const write = makeWrite({ remove: vi.fn().mockResolvedValue({ status: "gone" }) });
    const { onRefresh } = renderDialog(write);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("This geofence no longer exists.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows a network failure and keeps the destructive action available", () => {
    const error = {
      kind: "network" as const,
      retryable: true,
      outcome: "failed" as const,
      context: { route: "/geofences" },
      at: 0,
    };
    const write = makeWrite({ error });
    renderDialog(write);
    expect(screen.getByText("It wasn't deleted.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("disables both actions while pending", () => {
    const write = makeWrite({ pending: true });
    renderDialog(write);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
