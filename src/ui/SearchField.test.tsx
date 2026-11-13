import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SearchField } from "./SearchField";

describe("SearchField", () => {
  it("labels the input and renders one decorative search icon", () => {
    const { container } = render(
      <SearchField label="Vehicle search" placeholder="Plate or IMEI" />,
    );
    const input = screen.getByRole("textbox", { name: "Vehicle search" });
    expect(input).toHaveAttribute("placeholder", "Plate or IMEI");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the accessible name but hides the label when compact", () => {
    render(<SearchField label="Search vehicles" hideLabel />);
    const label = screen.getByText("Search vehicles");
    expect(label).toHaveClass("sr-only");
    expect(screen.getByRole("textbox", { name: "Search vehicles" })).toBeInTheDocument();
  });

  it("renders a trailing slot and clears space for it", () => {
    render(
      <SearchField label="Vehicle search" trailing={<button type="button">Clear search</button>} />,
    );
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Vehicle search" })).toHaveClass("pr-14");
  });

  it("links the hint and the error to the input", async () => {
    const user = userEvent.setup();
    render(
      <SearchField
        label="Vehicle search"
        hint="Matches plate or IMEI."
        error="Couldn't search vehicles."
      />,
    );
    const input = screen.getByRole("textbox", { name: "Vehicle search" });
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("hint");
    expect(describedBy).toContain("error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Matches plate or IMEI.")).toBeVisible();
    expect(screen.getByText("Couldn't search vehicles.")).toBeVisible();

    await user.clear(input);
    expect(input).toHaveValue("");
  });
});
