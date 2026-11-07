import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";

function Harness() {
  const [choice, setChoice] = useState("none");
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Account</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setChoice("profile")}>Profile</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setChoice("signout")}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <output>{choice}</output>
    </div>
  );
}

describe("DropdownMenu", () => {
  it("opens, selects an item and closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("menu")).toBeVisible();

    await user.click(screen.getByRole("menuitem", { name: "Profile" }));
    expect(screen.getByText("profile")).toBeVisible();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("returns focus to the trigger when Escape closes the menu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Account" });

    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows an indicator only on checked radio and checkbox items", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Choices</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuCheckboxItem checked>Enabled</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false}>Disabled</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(
      within(screen.getByRole("menuitemradio", { name: "Option A" })).getByTestId(
        "menu-item-indicator",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("menuitemradio", { name: "Option B" })).queryByTestId(
        "menu-item-indicator",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("menuitemcheckbox", { name: "Enabled" })).getByTestId(
        "menu-item-indicator",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("menuitemcheckbox", { name: "Disabled" })).queryByTestId(
        "menu-item-indicator",
      ),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
  });
});
