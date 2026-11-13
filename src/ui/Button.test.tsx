import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { TooltipProvider } from "./Tooltip";

describe("Button disabledReason", () => {
  it("stays visible and focusable with an aria-disabled state and a reason", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Button disabledReason="Your role can't change trips." onClick={onClick}>
          Start
        </Button>
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Start" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button.className).toContain("opacity-60");

    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not use native disabled when a reason is present", () => {
    render(
      <TooltipProvider>
        <Button disabledReason="You're offline.">Cancel</Button>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveAttribute("disabled");
  });

  it("keeps native disabled semantics for loading and disabled", () => {
    const { rerender } = render(<Button loading>Saving</Button>);
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();

    rerender(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });
});
