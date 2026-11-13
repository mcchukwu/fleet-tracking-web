import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ComboboxItem } from "./Combobox";
import { PickerList } from "./PickerList";

const items: ComboboxItem[] = [
  { id: "d1", label: "Adebayo Okafor", description: "LIC-01010" },
  { id: "d2", label: "Chinedu Musa", description: "LIC-01001" },
];

function list(overrides: Partial<Parameters<typeof PickerList>[0]> = {}) {
  return (
    <PickerList
      items={items}
      selectedId="d2"
      activeIndex={1}
      rowHeight={44}
      listboxId="list"
      label="Drivers"
      onSelect={() => undefined}
      onActive={() => undefined}
      {...overrides}
    />
  );
}

describe("PickerList", () => {
  it("renders options with position, set size and fixed row height", () => {
    render(list());

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-posinset", "1");
    expect(options[0]).toHaveAttribute("aria-setsize", "2");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("data-active", "true");
    expect(options[0]?.style.height).toBe("44px");
  });

  it("selects an option and reports the active row on pointer movement", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActive = vi.fn();
    render(list({ onSelect, onActive }));

    await user.click(screen.getByRole("option", { name: /Chinedu Musa/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d2" }),
    );
  });

  it("puts the clear row first and selects nothing through it", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onSelect = vi.fn();
    render(
      list({
        clear: { label: "Clear selection", onClear },
        onSelect,
        selectedId: null,
        activeIndex: 0,
      }),
    );

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAccessibleName("Clear selection");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-setsize", "3");
    await user.click(options[0] as HTMLElement);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows loading, empty and an error with Retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(list({ items: [], loading: true }));
    expect(screen.getByText("Loading options…")).toBeVisible();

    rerender(list({ items: [] }));
    expect(screen.getByText("No matches")).toBeVisible();

    rerender(
      list({
        items: [],
        error: "Couldn't load drivers.",
        onRetry,
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load drivers.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps cached options visible beside the error", () => {
    render(
      list({ error: "Couldn't refresh drivers.", onRetry: () => undefined }),
    );
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't refresh drivers.",
    );
  });

  it("virtualises above 100 options", () => {
    const many = Array.from({ length: 500 }, (_, index) => ({
      id: `item-${index}`,
      label: `Option ${index}`,
    }));
    render(list({ items: many, activeIndex: 0 }));
    const root = document.querySelector("[data-picker-list]");
    expect(root).toHaveAttribute("data-virtualized", "true");
    expect(screen.queryAllByRole("option").length).toBeLessThan(500);
  });

  it("renders every option at or below the threshold", () => {
    const many = Array.from({ length: 100 }, (_, index) => ({
      id: `item-${index}`,
      label: `Option ${index}`,
    }));
    render(list({ items: many, activeIndex: 0 }));
    expect(screen.getAllByRole("option")).toHaveLength(100);
    expect(document.querySelector("[data-picker-list]")).not.toHaveAttribute(
      "data-virtualized",
    );
  });
});
