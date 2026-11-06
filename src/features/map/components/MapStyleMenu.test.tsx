import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapStyleMenu } from "./MapStyleMenu";

function menu(overrides: Partial<Parameters<typeof MapStyleMenu>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <MapStyleMenu
      styles={["standard", "satellite"]}
      value="standard"
      offline={false}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("MapStyleMenu", () => {
  it("offers both styles and marks the current one", async () => {
    const user = userEvent.setup();
    menu();

    await user.click(screen.getByRole("button", { name: "Map style" }));
    const map = screen.getByRole("menuitemradio", { name: "Map" });
    const satellite = screen.getByRole("menuitemradio", { name: "Satellite" });
    expect(map).toHaveAttribute("aria-checked", "true");
    expect(satellite).toHaveAttribute("aria-checked", "false");
  });

  it("changes the style without closing the menu", async () => {
    const user = userEvent.setup();
    const { onChange } = menu();

    await user.click(screen.getByRole("button", { name: "Map style" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Satellite" }));
    expect(onChange).toHaveBeenCalledWith("satellite");
  });

  it("disables satellite offline and gives the reason", async () => {
    const user = userEvent.setup();
    menu({ value: "satellite", offline: true });

    await user.click(screen.getByRole("button", { name: "Map style" }));
    const satellite = screen.getByRole("menuitemradio", { name: /Satellite/ });
    expect(satellite).toHaveAttribute("data-disabled");
    expect(within(satellite).getByText("Needs a connection")).toBeVisible();
  });

  it("shows only Map when the build does not offer satellite", async () => {
    const user = userEvent.setup();
    menu({ styles: ["standard"] });

    await user.click(screen.getByRole("button", { name: "Map style" }));
    expect(screen.getByRole("menuitemradio", { name: "Map" })).toBeVisible();
    expect(screen.queryByRole("menuitemradio", { name: "Satellite" })).not.toBeInTheDocument();
  });
});
