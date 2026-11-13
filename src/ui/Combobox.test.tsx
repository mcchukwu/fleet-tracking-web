import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxItem } from "./Combobox";

const drivers: ComboboxItem[] = [
  {
    id: "d1",
    label: "Adebayo Okafor",
    description: "08031000010 · LIC-01010",
  },
  {
    id: "d2",
    label: "Adebayo Okafor",
    description: "08031000000 · LIC-01000",
  },
  { id: "d3", label: "Chinedu Musa", description: "08031000001 · LIC-01001" },
];

const originalMatchMedia = window.matchMedia;

function usePresentation(popover: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: popover,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function Harness({
  disabled = false,
  clearable = false,
  onClear,
}: {
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}) {
  const [value, setValue] = useState<string | null>("d1");
  return (
    <Combobox
      label="Driver"
      items={drivers}
      value={value}
      selectedLabel="Adebayo Okafor"
      onChange={setValue}
      disabled={disabled}
      disabledReason="Your role can't assign a driver."
      clearable={clearable}
      {...(onClear ? { onClear } : {})}
    />
  );
}

describe("Combobox popover", () => {
  it("wires the combobox, listbox and options with ARIA", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Driver" });
    expect(input).toHaveValue("Adebayo Okafor");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-haspopup", "listbox");

    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Driver" })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input.getAttribute("aria-activedescendant")).toContain("d1");
  });

  it("filters by name, phone and licence and selects with Enter", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    await user.click(input);
    await user.type(input, "01001");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("Chinedu Musa");

    await user.keyboard("{Enter}");
    expect(input).toHaveValue("Chinedu Musa");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("navigates with arrows, Home and End", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    await user.click(input);
    await user.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toContain("d2");
    await user.keyboard("{End}");
    expect(input.getAttribute("aria-activedescendant")).toContain("d3");
    await user.keyboard("{Home}");
    expect(input.getAttribute("aria-activedescendant")).toContain("d1");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("Adebayo Okafor");
  });

  it("closes the list on the first Escape and keeps focus in the input", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    await user.click(input);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue("Adebayo Okafor");
  });

  it("keeps focus in the input when an option is clicked", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    await user.click(input);
    await user.click(screen.getByRole("option", { name: /Chinedu Musa/ }));
    expect(input).toHaveValue("Chinedu Musa");
    expect(document.activeElement).toBe(input);
  });

  it("shows the empty message when nothing matches", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    await user.click(input);
    await user.type(input, "zzz");
    expect(screen.getByText("No matches")).toBeVisible();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("resets the query when focus leaves the combobox", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(
      <div>
        <Harness />
        <button type="button">Next field</button>
      </div>,
    );
    const input = screen.getByRole("combobox", { name: "Driver" });

    await user.click(input);
    await user.type(input, "Chin");
    await user.tab();

    expect(input).not.toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveValue("Adebayo Okafor");
  });

  it("is disabled with a reason and cannot open", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    render(<Harness disabled />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    expect(input).toBeDisabled();
    expect(screen.getByText("Your role can't assign a driver.")).toBeVisible();
    await user.click(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows loading and an error with Retry inside the list", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <Combobox
        label="Driver"
        items={[]}
        value={null}
        onChange={() => undefined}
        loading
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Driver" }));
    expect(screen.getByText("Loading options…")).toBeVisible();

    rerender(
      <Combobox
        label="Driver"
        items={[]}
        value={null}
        onChange={() => undefined}
        error="Couldn't load drivers."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load drivers.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps cached options when an error arrives and offers Retry", async () => {
    usePresentation(true);
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <Combobox
        label="Driver"
        items={drivers}
        value={null}
        onChange={() => undefined}
        error="Couldn't refresh drivers."
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Driver" }));
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't refresh drivers.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("Combobox sheet", () => {
  it("opens a dialog with a read-only trigger and a focused search", async () => {
    usePresentation(false);
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("combobox", { name: "Driver" });

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("readonly");
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Driver" });
    expect(dialog).toBeVisible();
    const search = within(dialog).getByRole("combobox", { name: "Driver" });
    expect(search).toHaveFocus();
    expect(within(dialog).getAllByRole("option")).toHaveLength(3);
    expect(search.getAttribute("aria-activedescendant")).toContain("d1");
  });

  it("filters and selects by keyboard, then returns focus to the trigger", async () => {
    usePresentation(false);
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("combobox", { name: "Driver" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Driver" });
    const search = within(dialog).getByRole("combobox", { name: "Driver" });
    await user.type(search, "01001");
    expect(within(dialog).getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveValue("Chinedu Musa");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("selects by pointer and closes the sheet", async () => {
    usePresentation(false);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("combobox", { name: "Driver" }));

    await user.click(screen.getByRole("option", { name: /Chinedu Musa/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Driver" })).toHaveValue(
      "Chinedu Musa",
    );
  });

  it("closes on the close button and on Escape", async () => {
    usePresentation(false);
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("combobox", { name: "Driver" });

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Close picker" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers a Clear row that calls onClear", async () => {
    usePresentation(false);
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Harness clearable onClear={onClear} />);
    await user.click(screen.getByRole("combobox", { name: "Driver" }));

    const dialog = screen.getByRole("dialog", { name: "Driver" });
    await user.click(
      within(dialog).getByRole("option", { name: "Clear selection" }),
    );
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the error and Retry inside the sheet", async () => {
    usePresentation(false);
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <Combobox
        label="Driver"
        items={[]}
        value={null}
        onChange={() => undefined}
        error="Couldn't load drivers."
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Driver" }));
    const dialog = screen.getByRole("dialog", { name: "Driver" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Couldn't load drivers.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("Combobox mono labels", () => {
  it("applies the per-item label class to the primary line", async () => {
    usePresentation(false);
    const user = userEvent.setup();
    render(
      <Combobox
        label="Vehicle"
        items={[{ id: "v1", label: "LSD-100-AA", labelClassName: "font-mono" }]}
        value={null}
        onChange={() => undefined}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Vehicle" }));
    const label = screen.getByRole("option").querySelector("span");
    expect(label).toHaveClass("font-mono");
  });
});
