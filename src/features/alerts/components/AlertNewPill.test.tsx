import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertNewPill } from "./AlertNewPill";

describe("AlertNewPill", () => {
  it("renders nothing at zero", () => {
    const { container } = render(<AlertNewPill count={0} onReveal={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names singular and plural counts", () => {
    const { rerender } = render(<AlertNewPill count={1} onReveal={() => undefined} />);
    expect(screen.getByRole("button", { name: "1 new alert" })).toBeVisible();
    rerender(<AlertNewPill count={3} onReveal={() => undefined} />);
    expect(screen.getByRole("button", { name: "3 new alerts" })).toBeVisible();
  });

  it("reveals on click", async () => {
    const onReveal = vi.fn();
    render(<AlertNewPill count={2} onReveal={onReveal} />);
    await userEvent.click(screen.getByRole("button", { name: "2 new alerts" }));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});
