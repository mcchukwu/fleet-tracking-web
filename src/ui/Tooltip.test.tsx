import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tooltip, TooltipProvider } from "./Tooltip";

function renderTooltip() {
  return render(
    <TooltipProvider>
      <Tooltip label="Open the map">
        <button type="button">Map</button>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe("Tooltip", () => {
  it("shows its label on hover", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByRole("button", { name: "Map" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Open the map");
  });

  it("shows its label on keyboard focus and hides on Escape", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(screen.getByRole("button", { name: "Map" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Open the map");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});
