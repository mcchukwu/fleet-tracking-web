import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import { AppearanceControls } from "./AppearanceControls";
import { ThemeProvider } from "./ThemeProvider";

function renderPanel() {
  render(
    <ThemeProvider>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Open appearance</DropdownMenuTrigger>
        <DropdownMenuContent>
          <AppearanceControls />
        </DropdownMenuContent>
      </DropdownMenu>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.accent;
});

describe("AppearanceControls", () => {
  it("puts theme and accent in two labelled radio groups", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: "Appearance" });
    expect(within(group).getByText("Theme")).toBeVisible();
    expect(within(group).getByText("Accent")).toBeVisible();
    expect(within(group).getByRole("group", { name: "Theme" })).toBeVisible();
    expect(within(group).getByRole("group", { name: "Accent" })).toBeVisible();
    expect(within(group).getByRole("menuitemradio", { name: "Dark" })).toBeVisible();
    for (const name of ["Blue accent", "Violet accent", "Fuchsia accent", "Graphite accent"]) {
      expect(within(group).getByRole("menuitemradio", { name })).toBeVisible();
    }
  });

  it("marks the checked theme with a visible indicator", async () => {
    const user = userEvent.setup();
    renderPanel();

    const system = screen.getByRole("menuitemradio", { name: "System" });
    expect(within(system).getByTestId("menu-item-indicator")).toBeVisible();

    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    const dark = screen.getByRole("menuitemradio", { name: "Dark" });
    expect(within(dark).getByTestId("menu-item-indicator")).toBeVisible();
    expect(within(system).queryByTestId("menu-item-indicator")).not.toBeInTheDocument();
  });

  it("applies the theme without closing the menu", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("applies an accent without closing the menu", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("menuitemradio", { name: "Fuchsia accent" }));

    expect(document.documentElement.dataset.accent).toBe("fuchsia");
    expect(screen.getByRole("menu")).toBeVisible();
  });
});
