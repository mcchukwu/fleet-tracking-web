import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Geofence } from "../../../api/types";
import type { AppError } from "../../../errors/types";
import type { GeofenceDrawingController } from "../hooks/useGeofenceDrawing";
import type { GeofenceWriteController } from "../hooks/useGeofenceWrite";
import { GeofenceEditor } from "./GeofenceEditor";

const blocker = {
  status: "idle" as "idle" | "blocked",
  proceed: vi.fn(),
  reset: vi.fn(),
};

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => blocker,
}));

const geofence: Geofence = {
  id: "gf-1",
  name: "Lekki Depot",
  kind: "depot",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [3.47, 6.43],
        [3.49, 6.43],
        [3.49, 6.445],
        [3.47, 6.43],
      ],
    ],
  },
};

const validPolygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [3.4, 6.4],
      [3.5, 6.4],
      [3.5, 6.5],
      [3.4, 6.4],
    ],
  ],
};

function makeDrawing(
  overrides: Partial<GeofenceDrawingController> = {},
): GeofenceDrawingController {
  return {
    status: "ready",
    geometry: validPolygon,
    dirty: false,
    error: null,
    getGeometry: () => validPolygon,
    retry: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function makeWrite(overrides: Partial<GeofenceWriteController> = {}): GeofenceWriteController {
  return {
    create: vi.fn().mockResolvedValue({ status: "created", id: "gf-2" }),
    update: vi.fn().mockResolvedValue({ status: "done", reconciled: false }),
    cancel: vi.fn(),
    retry: vi.fn(),
    pending: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  };
}

interface RenderOptions {
  mode?: "create" | "edit";
  drawing?: GeofenceDrawingController;
  write?: GeofenceWriteController;
  geometryEditable?: boolean;
  disabledReason?: string;
}

function renderEditor(options: RenderOptions = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const isEdit = options.mode === "edit";
  const drawing =
    options.drawing ??
    (isEdit
      ? makeDrawing({
          geometry: geofence.geometry,
          getGeometry: () => geofence.geometry,
        })
      : makeDrawing());
  const write = options.write ?? makeWrite();
  const view = render(
    <GeofenceEditor
      mode={options.mode ?? "create"}
      geofence={options.mode === "edit" ? geofence : null}
      drawing={drawing}
      write={write}
      knownIds={new Set(["gf-1"])}
      geometryEditable={options.geometryEditable ?? true}
      {...(options.disabledReason ? { disabledReason: options.disabledReason } : {})}
      onClose={onClose}
      onSaved={onSaved}
      onRefresh={vi.fn()}
    />,
  );
  return { ...view, drawing, write, onSaved, onClose };
}

beforeEach(() => {
  blocker.status = "idle";
  blocker.proceed.mockClear();
  blocker.reset.mockClear();
});

describe("GeofenceEditor", () => {
  it("requires a name", async () => {
    const { write } = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Create geofence" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(write.create).not.toHaveBeenCalled();
  });

  it("does not save without a complete polygon", async () => {
    const drawing = makeDrawing({ geometry: null, getGeometry: () => null });
    const { write } = renderEditor({ drawing });
    await userEvent.type(screen.getByLabelText("Name"), "New Gate");
    await userEvent.click(screen.getByRole("button", { name: "Create geofence" }));
    expect(await screen.findByText("Draw and close a polygon before saving.")).toBeInTheDocument();
    expect(write.create).not.toHaveBeenCalled();
  });

  it("rejects a self-intersecting polygon before writing", async () => {
    const bowTie = {
      type: "Polygon" as const,
      coordinates: [
        [
          [3.4, 6.4],
          [3.5, 6.5],
          [3.5, 6.4],
          [3.4, 6.5],
        ],
      ],
    };
    const drawing = makeDrawing({ geometry: bowTie, getGeometry: () => bowTie });
    const { write } = renderEditor({ drawing });
    await userEvent.type(screen.getByLabelText("Name"), "Bow tie");
    await userEvent.click(screen.getByRole("button", { name: "Create geofence" }));
    expect(await screen.findByText("The polygon crosses itself. Adjust the points.")).toBeInTheDocument();
    expect(write.create).not.toHaveBeenCalled();
  });

  it("creates with a trimmed name and the chosen kind", async () => {
    const { write, onSaved } = renderEditor();
    await userEvent.type(screen.getByLabelText("Name"), "  New Gate ");
    await userEvent.selectOptions(screen.getByLabelText("Kind"), "customer");
    await userEvent.click(screen.getByRole("button", { name: "Create geofence" }));

    await waitFor(() =>
      expect(write.create).toHaveBeenCalledWith(
        {
          name: "New Gate",
          kind: "customer",
          geometry: validPolygon,
        },
        new Set(["gf-1"]),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith("gf-2");
  });

  it("sends a name-only diff when editing", async () => {
    const { write, onSaved } = renderEditor({ mode: "edit" });
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Lekki Gate");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(write.update).toHaveBeenCalledWith(geofence, { name: "Lekki Gate" }),
    );
    expect(onSaved).toHaveBeenCalledWith("gf-1");
  });

  it("closes without a write when nothing changed", async () => {
    const { write, onSaved } = renderEditor({ mode: "edit" });
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("gf-1"));
    expect(write.update).not.toHaveBeenCalled();
  });

  it("explains a multi-ring geofence and keeps geometry out of the patch", async () => {
    const twice: Geofence = {
      ...geofence,
      geometry: { type: "Polygon", coordinates: [...geofence.geometry.coordinates, geofence.geometry.coordinates[0] ?? []] },
    };
    render(
      <GeofenceEditor
        mode="edit"
        geofence={twice}
        drawing={makeDrawing({ status: "idle", geometry: null, getGeometry: () => null })}
        write={makeWrite()}
        knownIds={new Set(["gf-1"])}
        geometryEditable={false}
        geometryNote="This geofence has more than one ring. Its shape can't be edited here."
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(
      screen.getByText("This geofence has more than one ring. Its shape can't be edited here."),
    ).toBeInTheDocument();
  });

  it("saves name and kind without geometry when the stored shape is invalid", async () => {
    const broken: Geofence = {
      ...geofence,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [3.4, 6.4],
            [3.5, 6.4],
          ],
        ],
      },
    };
    const write = makeWrite();
    const onSaved = vi.fn();
    render(
      <GeofenceEditor
        mode="edit"
        geofence={broken}
        drawing={makeDrawing({ status: "idle", geometry: null, getGeometry: () => null })}
        write={write}
        knownIds={new Set(["gf-1"])}
        geometryEditable={false}
        geometryNote="This geofence's shape isn't valid. Its name and kind can still be edited."
        onClose={vi.fn()}
        onSaved={onSaved}
        onRefresh={vi.fn()}
      />,
    );
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Lekki Gate");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(write.update).toHaveBeenCalledWith(broken, { name: "Lekki Gate" }));
    expect(onSaved).toHaveBeenCalledWith("gf-1");
  });

  it("offers Retry when the drawing tool fails", async () => {
    const error: AppError = {
      kind: "chunk",
      retryable: false,
      outcome: "failed",
      context: { route: "/geofences" },
      at: 0,
    };
    const retry = vi.fn();
    renderEditor({ drawing: makeDrawing({ status: "error", geometry: null, error, retry }) });
    expect(screen.getByText("The drawing tool couldn't load.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps the form and explains a gone geofence after an edit", async () => {
    const write = makeWrite({
      update: vi.fn().mockResolvedValue({ status: "gone" }),
    });
    renderEditor({ mode: "edit", write });
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Lekki Gate");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("This geofence no longer exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Lekki Gate");
  });

  it("shows the server validation copy on a failed create", () => {
    const error: AppError = {
      kind: "validation",
      code: "invalid_geometry",
      serverMessage: "geometry must be a valid polygon",
      retryable: false,
      outcome: "failed",
      context: { route: "/geofences" },
      at: 0,
    };
    renderEditor({ write: makeWrite({ error }) });
    expect(screen.getByText("The polygon isn't valid.")).toBeInTheDocument();
    expect(screen.getByText("geometry must be a valid polygon")).toBeInTheDocument();
  });

  it("asks before discarding a dirty form", async () => {
    const { onClose } = renderEditor();
    await userEvent.type(screen.getByLabelText("Name"), "Draft");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Draft");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the save button disabled while preparing", () => {
    renderEditor({ drawing: makeDrawing({ status: "preparing", geometry: null }) });
    expect(screen.getByRole("button", { name: "Create geofence" })).toBeDisabled();
    expect(screen.getByText("Preparing the drawing tool…")).toBeInTheDocument();
  });
});
