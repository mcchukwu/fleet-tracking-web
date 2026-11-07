import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "./Drawer";
/* oxlint-disable jsx-a11y/no-static-element-interactions -- test harness only; the outer listener proves Escape does not bubble. */

function Harness({ onReturn }: { onReturn?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open vehicle details
      </button>
      <Drawer
        open={open}
        label="Vehicle details for LSD-100-AA"
        title="LSD-100-AA"
        headerAside={<span>Moving</span>}
        actions={<button type="button">Edit</button>}
        onClose={() => setOpen(false)}
        returnFocus={onReturn}
      >
        <p>Body content</p>
      </Drawer>
    </div>
  );
}

describe("Drawer", () => {
  it("is a labelled non-modal panel with header, actions and body", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open vehicle details" }));

    const panel = screen.getByRole("complementary", {
      name: "Vehicle details for LSD-100-AA",
    });
    expect(panel).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "LSD-100-AA" })).toBeVisible();
    expect(screen.getByText("Moving")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.getByText("Body content")).toBeVisible();
  });

  it("moves focus to the close button and calls returnFocus when it leaves", async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    render(<Harness onReturn={onReturn} />);

    await user.click(screen.getByRole("button", { name: "Open vehicle details" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close vehicle details" })).toHaveFocus();
    });

    await user.click(screen.getByRole("button", { name: "Close vehicle details" }));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and stops the event before the global shortcut", async () => {
    const user = userEvent.setup();
    const onParentKeyDown = vi.fn();
    const onReturn = vi.fn();
    render(
      <div onKeyDown={onParentKeyDown}>
        <Harness onReturn={onReturn} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Open vehicle details" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("complementary", { name: "Vehicle details for LSD-100-AA" }),
      ).not.toBeInTheDocument();
    });
    expect(onParentKeyDown).not.toHaveBeenCalled();
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
