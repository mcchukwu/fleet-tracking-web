import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapFilterValues } from "../lib/filter";
import { MobileFilterMenu } from "./MobileFilterMenu";

const baseFilters: MapFilterValues = {
  q: "",
  statuses: [],
  depot: null,
  sort: "plate",
  onlyInView: false,
};

function menu(overrides: Partial<MapFilterValues> = {}) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(
    <MobileFilterMenu
      filters={{ ...baseFilters, ...overrides }}
      depots={["Lekki Depot", "Ibadan Depot"]}
      onChange={onChange}
      onReset={onReset}
    />,
  );
  return { onChange, onReset };
}

describe("MobileFilterMenu", () => {
  it("keeps the menu open while statuses are toggled", async () => {
    const user = userEvent.setup();
    const { onChange } = menu();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Moving/ }));

    expect(onChange).toHaveBeenCalledWith({ statuses: ["moving"] });
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("removes a status that is already active", async () => {
    const user = userEvent.setup();
    const { onChange } = menu({ statuses: ["moving", "alert"] });

    await user.click(screen.getByRole("button", { name: "Filters (2)" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Moving/ }));

    expect(onChange).toHaveBeenCalledWith({ statuses: ["alert"] });
  });

  it("selects a depot and a sort order", async () => {
    const user = userEvent.setup();
    const { onChange } = menu();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Lekki Depot" }));
    expect(onChange).toHaveBeenCalledWith({ depot: "Lekki Depot" });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Last seen" }));
    expect(onChange).toHaveBeenCalledWith({ sort: "lastSeen" });
  });

  it("toggles the in-view filter and resets", async () => {
    const user = userEvent.setup();
    const { onChange, onReset } = menu({ statuses: ["moving"] });

    await user.click(screen.getByRole("button", { name: "Filters (1)" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Only in view" }));
    expect(onChange).toHaveBeenCalledWith({ onlyInView: true });

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Filters (1)" }));
    await user.click(screen.getByRole("menuitem", { name: "Reset filters" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    menu();

    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeVisible();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows the status legend inside the menu", async () => {
    const user = userEvent.setup();
    menu();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const menuBox = screen.getByRole("menu");
    expect(within(menuBox).getByText("Moving")).toBeVisible();
    expect(within(menuBox).getByText("Idle")).toBeVisible();
    expect(within(menuBox).getByText("Offline")).toBeVisible();
    expect(within(menuBox).getByText("Alert")).toBeVisible();
  });
});
