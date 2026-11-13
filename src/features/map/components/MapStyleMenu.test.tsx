import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapStyleMenu } from "./MapStyleMenu";

function menu(overrides: Partial<Parameters<typeof MapStyleMenu>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <MapStyleMenu
      styles={["standard", "streets", "satellite"]}
      value="standard"
      offline={false}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("MapStyleMenu", () => {
  it("offers all styles and marks the current one", async () => {
    const user = userEvent.setup();
    menu();

    await user.click(screen.getByRole("button", { name: "Map style" }));
    const map = screen.getByRole("menuitemradio", { name: "Map" });
    const streets = screen.getByRole("menuitemradio", { name: "Streets" });
    const satellite = screen.getByRole("menuitemradio", { name: "Satellite" });
    expect(map).toHaveAttribute("aria-checked", "true");
    expect(streets).toHaveAttribute("aria-checked", "false");
    expect(satellite).toHaveAttribute("aria-checked", "false");
    expect(within(map).getByTestId("menu-item-indicator")).toBeVisible();
    expect(within(streets).queryByTestId("menu-item-indicator")).not.toBeInTheDocument();
  });

  it("changes the style without closing the menu", async () => {
    const user = userEvent.setup();
    const { onChange } = menu();

    await user.click(screen.getByRole("button", { name: "Map style" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Satellite" }));
    expect(onChange).toHaveBeenCalledWith("satellite");
  });

  it("disables both hosted styles offline with the reason", async () => {
    const user = userEvent.setup();
    menu({ value: "standard", offline: true });

    await user.click(screen.getByRole("button", { name: "Map style" }));
    for (const name of ["Streets", "Satellite"]) {
      const item = screen.getByRole("menuitemradio", { name: new RegExp(name) });
      expect(item).toHaveAttribute("data-disabled");
      expect(within(item).getByText("Needs a connection")).toBeVisible();
    }
    expect(screen.getByRole("menuitemradio", { name: "Map" })).not.toHaveAttribute("data-disabled");
  });

  it("shows only Map when the build has no MapTiler key", async () => {
    const user = userEvent.setup();
    menu({ styles: ["standard"] });

    await user.click(screen.getByRole("button", { name: "Map style" }));
    expect(screen.getByRole("menuitemradio", { name: "Map" })).toBeVisible();
    expect(screen.queryByRole("menuitemradio", { name: "Streets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "Satellite" })).not.toBeInTheDocument();
  });

  it("marks the picker busy while a style loads", () => {
    menu({ loadingStyle: "satellite" });
    expect(screen.getByRole("button", { name: "Map style" })).toHaveAttribute("aria-busy", "true");
  });
});
