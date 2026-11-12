import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ComboboxItem } from "./Combobox";
import { PickerSheet } from "./PickerSheet";

const items: ComboboxItem[] = [
  { id: "d1", label: "Adebayo Okafor", description: "LIC-01010" },
  { id: "d2", label: "Chinedu Musa", description: "LIC-01001" },
];

function Harness({
  onSelect = () => undefined,
  onClear,
  error,
  onRetry,
}: {
  onSelect?: (item: ComboboxItem) => void;
  onClear?: () => void;
  error?: string;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open picker
      </button>
      <PickerSheet
        id="driver-sheet"
        open={open}
        label="Driver"
        placeholder="Search drivers"
        query=""
        onQuery={() => undefined}
        items={items}
        selectedId="d1"
        activeIndex={0}
        onActive={() => undefined}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
        {...(onClear ? { clearable: true, onClear } : {})}
        {...(error ? { error } : {})}
        {...(onRetry ? { onRetry } : {})}
      />
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
    </div>
  );
}

describe("PickerSheet", () => {
  it("opens as a named dialog with focus in the search field", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open picker" }));

    const dialog = screen.getByRole("dialog", { name: "Driver" });
    expect(dialog).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Driver" })).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("selects an option and tells the parent to close", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: "Open picker" }));

    await user.click(screen.getByRole("option", { name: /Chinedu Musa/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d2" }),
    );
  });

  it("closes from the close button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open picker" }));
    await user.click(screen.getByRole("button", { name: "Close picker" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open picker" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("offers a Clear row", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Harness onClear={onClear} />);
    await user.click(screen.getByRole("button", { name: "Open picker" }));

    await user.click(screen.getByRole("option", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows the error with Retry inside the dialog", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<Harness error="Couldn't load drivers." onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Open picker" }));

    const dialog = screen.getByRole("dialog", { name: "Driver" });
    expect(dialog).toHaveTextContent("Couldn't load drivers.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("caps the sheet at 85% of the visual viewport", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open picker" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.style.maxHeight).toBe(
      `${Math.round(window.innerHeight * 0.85)}px`,
    );
  });
});
