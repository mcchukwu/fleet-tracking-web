import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackStates } from "./PlaybackStates";

describe("PlaybackStates", () => {
  it("shows a range validation card with one reset action", async () => {
    const onResetRange = vi.fn();
    render(
      <PlaybackStates
        variant="validation"
        message="The end time must be after the start time."
        onResetRange={onResetRange}
      />,
    );
    expect(screen.getByText("Choose a valid range")).toBeVisible();
    expect(screen.getByText("The end time must be after the start time.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Use the last 2 hours" }));
    expect(onResetRange).toHaveBeenCalled();
  });

  it("explains an empty range without calling it an error", () => {
    render(<PlaybackStates variant="empty" onResetRange={() => undefined} />);
    expect(screen.getByText("No positions in this range")).toBeVisible();
    expect(
      screen.getByText("Try a wider range or choose another vehicle."),
    ).toBeVisible();
  });

  it("shows the honest offline and cancelled states", () => {
    const { rerender } = render(
      <PlaybackStates variant="offline-uncached" onResetRange={() => undefined} />,
    );
    expect(screen.getByText("Not available offline")).toBeVisible();
    expect(
      screen.getByText("Reconnect to load this range. Ranges you've already viewed stay available."),
    ).toBeVisible();

    rerender(
      <PlaybackStates variant="cancelled" onRetry={() => undefined} onResetRange={() => undefined} />,
    );
    expect(screen.getByText("Playback cancelled")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
