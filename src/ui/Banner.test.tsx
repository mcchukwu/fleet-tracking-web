import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Banner } from "./Banner";

describe("Banner", () => {
  it("renders its message as a polite status", () => {
    render(<Banner tone="warning" message="Reconnecting to live updates…" />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Reconnecting to live updates…");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("offers an action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <Banner
        tone="info"
        message="A new version is available."
        action={{ label: "Reload", onClick: onAction }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("can be dismissed without removing the message from the live region", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Banner tone="neutral" message="You're offline." dismissible onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
