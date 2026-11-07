import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxItem } from "./Combobox";

const drivers: ComboboxItem[] = [
  { id: "d1", label: "Adebayo Okafor", description: "08031000010 · LIC-01010" },
  { id: "d2", label: "Adebayo Okafor", description: "08031000000 · LIC-01000" },
  { id: "d3", label: "Chinedu Musa", description: "08031000001 · LIC-01001" },
];

function Harness({ disabled = false }: { disabled?: boolean }) {
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
    />
  );
}

describe("Combobox", () => {
  it("wires the combobox, listbox and options with ARIA", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Driver" });
    expect(input).toHaveValue("Adebayo Okafor");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Driver" })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input.getAttribute("aria-activedescendant")).toContain("d1");
  });

  it("filters by name, phone and licence and selects with Enter", async () => {
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

  it("shows the empty message when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    await user.click(input);
    await user.type(input, "zzz");
    expect(screen.getByText("No matches")).toBeVisible();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("resets the query when focus leaves the combobox", async () => {
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
    const user = userEvent.setup();
    render(<Harness disabled />);
    const input = screen.getByRole("combobox", { name: "Driver" });

    expect(input).toBeDisabled();
    expect(screen.getByText("Your role can't assign a driver.")).toBeVisible();
    await user.click(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reports loading and an external error", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Combobox label="Driver" items={[]} value={null} onChange={onChange} loading />,
    );
    expect(screen.getByText("Loading options…")).toBeVisible();

    rerender(
      <Combobox label="Driver" items={[]} value={null} onChange={onChange} error="Couldn't load drivers." />,
    );
    expect(screen.getByText("Couldn't load drivers.")).toBeVisible();
  });
});
