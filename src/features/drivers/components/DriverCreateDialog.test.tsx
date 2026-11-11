import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../../../errors/types";
import { TooltipProvider } from "../../../ui/Tooltip";
import { DriverCreateDialog } from "./DriverCreateDialog";

const mocks = vi.hoisted(() => ({
  write: {
    create: vi.fn(),
    pending: false,
    error: null as AppError | null,
    reset: vi.fn(),
  },
}));

vi.mock("../hooks/useDriverWrite", () => ({
  useDriverWrite: () => mocks.write,
}));

function renderDialog(props: Partial<Parameters<typeof DriverCreateDialog>[0]> = {}) {
  return render(
    <TooltipProvider>
      <DriverCreateDialog
        open
        knownDriverIds={new Set(["driver-1"])}
        onCreated={vi.fn()}
        onClose={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  mocks.write = {
    create: vi.fn().mockResolvedValue({ status: "created" }),
    pending: false,
    error: null,
    reset: vi.fn(),
  };
  vi.clearAllMocks();
});

describe("DriverCreateDialog", () => {
  it("requires a name and validates the phone before submitting", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Create driver" }));
    expect(await screen.findByText("Enter a name.")).toBeVisible();
    expect(mocks.write.create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Name"), "Ada Obi");
    await user.type(screen.getByLabelText("Phone (optional)"), "0803");
    await user.click(screen.getByRole("button", { name: "Create driver" }));
    expect(
      await screen.findByText("Enter a phone number with at least seven digits."),
    ).toBeVisible();
    expect(mocks.write.create).not.toHaveBeenCalled();
  });

  it("sends only the fields the operator filled", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onCreated, onClose });

    await user.type(screen.getByLabelText("Name"), " Ada Obi ");
    await user.click(screen.getByRole("button", { name: "Create driver" }));

    expect(mocks.write.create).toHaveBeenCalledWith({ name: "Ada Obi" }, new Set(["driver-1"]));
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a form-level error and keeps the values", async () => {
    mocks.write.error = {
      kind: "validation",
      status: 400,
      code: "invalid_request",
      serverMessage: "name is required",
      retryable: false,
      outcome: "failed",
      context: { route: "/drivers" },
      at: 0,
    };
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Name"), "Ada Obi");
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields");
    expect(screen.getByText("name is required")).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Obi");
  });

  it("warns that the outcome is unknown instead of claiming failure", () => {
    mocks.write.error = {
      kind: "network",
      retryable: true,
      outcome: "unknown",
      context: { route: "/drivers" },
      at: 0,
    };
    renderDialog();
    expect(screen.getByText("We couldn't confirm that it saved.")).toBeVisible();
    expect(screen.getByText("Check the drivers list before trying again.")).toBeVisible();
  });

  it("asks before discarding a dirty form", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ onClose });

    await user.type(screen.getByLabelText("Name"), "Ada Obi");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const discard = screen.getByRole("dialog", { name: "Discard this driver?" });
    expect(discard).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog", { name: "Create driver" })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the submit focusable but inert for a read-only role", () => {
    renderDialog({ disabledReason: "Your role can't create drivers." });
    expect(screen.getByRole("button", { name: "Create driver" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
