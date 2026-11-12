import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Stat } from "./Stat";
import { TooltipProvider } from "./Tooltip";

describe("Stat", () => {
  it("renders the label, value and hint", () => {
    render(<Stat label="Vehicles online" value="20 of 25" hint="80%" />);
    expect(screen.getByText("Vehicles online")).toBeVisible();
    expect(screen.getByText("20 of 25")).toBeVisible();
    expect(screen.getByText("80%")).toBeVisible();
  });

  it("renders a leading indicator before the label", () => {
    render(
      <Stat
        label="Postgres"
        value="Up"
        leading={<span data-testid="health-dot">dot</span>}
      />,
    );
    const dot = screen.getByTestId("health-dot");
    const label = screen.getByText("Postgres");
    expect(
      dot.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the value tabular for changing numbers", () => {
    render(<Stat label="Received" value="14,978,380" />);
    expect(screen.getByText("14,978,380")).toHaveClass("tabular-nums");
  });

  it("keeps the hint tabular for changing numbers", () => {
    render(<Stat label="Online" value="20 of 25" hint="80% of vehicles" />);
    expect(screen.getByText("80% of vehicles")).toHaveClass("tabular-nums");
  });

  it("shows the local and UTC tooltip for a relative hint", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Stat
          label="Last vehicle report"
          value="10s"
          hint="12:00"
          hintTooltip="12 Nov 2026, 12:00 · 12 Nov 2026, 12:00 UTC"
        />
      </TooltipProvider>,
    );

    await user.hover(screen.getByText("12:00"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("UTC");
  });
});
