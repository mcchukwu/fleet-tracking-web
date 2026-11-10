import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackControls } from "./PlaybackControls";
import type { Cursor } from "../lib/history";

vi.mock("./PlaybackScrubber", () => ({
  PlaybackScrubber: () => <div data-testid="scrubber" />,
}));

const fromMs = Date.parse("2026-11-08T14:00:00Z");
const toMs = Date.parse("2026-11-08T16:00:00Z");
const cursor: Cursor = {
  index: 1,
  position: [3.5, 6.6],
  inGap: false,
  speedKph: 52,
  headingDeg: 95,
};

function renderControls(overrides: Record<string, unknown> = {}) {
  const handlers = {
    onToggle: vi.fn(),
    onStep: vi.fn(),
    onSeek: vi.fn(),
    onSpeedChange: vi.fn(),
    onRetry: vi.fn(),
    onCancel: vi.fn(),
  };
  render(
    <PlaybackControls
      fromMs={fromMs}
      toMs={toMs}
      playheadMs={fromMs + 30_000}
      playing={false}
      speed={1}
      cursor={cursor}
      pointCount={240}
      gaps={[{ startIndex: 10, startMs: fromMs + 30 * 60_000, endMs: fromMs + 45 * 60_000 }]}
      events={[]}
      onToggle={handlers.onToggle}
      onStep={handlers.onStep}
      onSeek={handlers.onSeek}
      onSpeedChange={handlers.onSpeedChange}
      onRetry={handlers.onRetry}
      onCancel={handlers.onCancel}
      {...overrides}
    />,
  );
  return handlers;
}

describe("PlaybackControls", () => {
  it("drives transport and speed", async () => {
    const handlers = renderControls();
    expect(screen.getByRole("group", { name: "Transport" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(handlers.onToggle).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Step back one position" }));
    await userEvent.click(screen.getByRole("button", { name: "Step forward one position" }));
    expect(handlers.onStep.mock.calls).toEqual([[-1], [1]]);

    await userEvent.selectOptions(screen.getByLabelText("Playback speed"), "4");
    expect(handlers.onSpeedChange).toHaveBeenCalledWith(4);
  });

  it("shows the current readout with fixed widths", () => {
    renderControls();
    const readout = screen.getByTestId("playback-readout");
    expect(readout).toHaveTextContent("52 km/h");
    expect(readout).toHaveTextContent("95° E");
    expect(screen.getByText("52 km/h")).toHaveClass("min-w-16");
    expect(screen.getByText("95° E")).toHaveClass("min-w-14");
  });

  it("keeps the speed name inside the trigger, with no stacked label", () => {
    renderControls();
    const speed = screen.getByLabelText("Playback speed");
    expect(speed).toHaveDisplayValue("Speed 1×");
    expect(screen.getByText("Playback speed")).toHaveClass("sr-only");
  });

  it("shows the gap label", () => {
    renderControls({ responseResolution: "raw" });
    expect(screen.getByText(/No data .* to .*/)).toBeVisible();
  });

  it("delays the control skeleton for 200ms while loading", async () => {
    renderControls({ loading: true, pointCount: 0 });
    const skeleton = screen.getByTestId("playback-controls-skeleton");
    expect(skeleton.parentElement).toHaveClass("invisible");
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();

    await waitFor(() => expect(skeleton.parentElement).not.toHaveClass("invisible"), {
      timeout: 1_000,
    });
  });

  it("shows the slow state for a refresh with cached data", () => {
    vi.useFakeTimers();
    try {
      renderControls({ refreshing: true });
      expect(screen.queryByText("Still working…")).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3_100);
      });
      expect(screen.getByText("Still working…")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a paused label and disables transport without points", () => {
    renderControls({ playing: true, pointCount: 0, disabled: true });
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });
});
