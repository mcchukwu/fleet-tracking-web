import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./Dialog";

function Harness({ variant }: { variant?: "default" | "confirm" | "blocking" }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Confirm the change"
        description="This applies to the selected vehicle."
        variant={variant}
        footer={<button type="button">Save</button>}
      >
        <input aria-label="Note" />
      </Dialog>
    </div>
  );
}

describe("Dialog", () => {
  it("renders its title, description and content", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("dialog", { name: "Confirm the change" })).toBeVisible();
    expect(screen.getByText("This applies to the selected vehicle.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Note" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
  });

  it("moves focus into the dialog and returns it to the opener on close", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open dialog" });

    await user.click(opener);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(opener).toHaveFocus();
  });

  it("does not close a blocking dialog on Escape and hides the close button", async () => {
    const user = userEvent.setup();
    render(<Harness variant="blocking" />);

    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("keeps focus inside the dialog while tabbing", async () => {
    const user = userEvent.setup();
    render(<Harness variant="blocking" />);

    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = screen.getByRole("dialog");

    for (let index = 0; index < 4; index += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });
});
