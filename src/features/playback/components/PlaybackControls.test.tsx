import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackControls } from "./PlaybackControls";
import type { Cursor } from "../lib/history";

vi.mock("./PlaybackScrubber", () => ({
  PlaybackScrubber: () => <div data-testid="scrubber" />,
}));

vi.mock("./PlaybackEventsMenu", () => ({
  PlaybackEventsMenu: () => <button type="button">Events (0)</button>,
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
    onPreset: vi.fn(),
    onCustomRange: vi.fn(),
    onResolution: vi.fn(),
    onFit: vi.fn(),
    onJump: vi.fn(),
    onRetry: vi.fn(),
    onCancel: vi.fn(),
    onEventsRetry: vi.fn(),
  };
  render(
    <PlaybackControls
      fromMs={fromMs}
      toMs={toMs}
      playheadMs={fromMs + 30_000}
      playing={false}
      speed={1}
      cursor={cursor}
      preset="2h"
      resolution="30s"
      responseResolution="30s"
      pointCount={240}
      gaps={[{ startIndex: 10, startMs: fromMs + 30 * 60_000, endMs: fromMs + 45 * 60_000 }]}
      events={[]}
      onToggle={handlers.onToggle}
      onStep={handlers.onStep}
      onSeek={handlers.onSeek}
      onSpeedChange={handlers.onSpeedChange}
      onPreset={handlers.onPreset}
      onCustomRange={handlers.onCustomRange}
      onResolution={handlers.onResolution}
      onFit={handlers.onFit}
      onJump={handlers.onJump}
      onRetry={handlers.onRetry}
      onCancel={handlers.onCancel}
      onEventsRetry={handlers.onEventsRetry}
      {...overrides}
    />,
  );
  return handlers;
}

describe("PlaybackControls", () => {
  it("drives transport, speed, range, resolution and fit", async () => {
    const handlers = renderControls();
    expect(screen.getByText("52 km/h")).toBeVisible();
    expect(screen.getByText("95° E")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(handlers.onToggle).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Step back one position" }));
    await userEvent.click(screen.getByRole("button", { name: "Step forward one position" }));
    expect(handlers.onStep.mock.calls).toEqual([[-1], [1]]);

    await userEvent.selectOptions(screen.getByLabelText("Playback speed"), "4");
    expect(handlers.onSpeedChange).toHaveBeenCalledWith(4);

    await userEvent.selectOptions(screen.getByLabelText("Range"), "30m");
    expect(handlers.onPreset).toHaveBeenCalledWith("30m");
    await userEvent.selectOptions(screen.getByLabelText("Range"), "custom");
    expect(handlers.onCustomRange).toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText("Resolution"), "auto");
    expect(handlers.onResolution).toHaveBeenCalledWith("auto");

    await userEvent.click(screen.getByRole("button", { name: "Fit route" }));
    expect(handlers.onFit).toHaveBeenCalled();
  });

  it("keeps the speed name inside the trigger, with no stacked label", () => {
    renderControls();
    const speed = screen.getByLabelText("Playback speed");
    expect(speed).toHaveDisplayValue("Speed 1×");
    expect(screen.getByText("Playback speed")).toHaveClass("sr-only");
  });

  it("shows the response resolution, point count and gap label", () => {
    renderControls({ responseResolution: "raw" });
    expect(screen.getByText("Resolution: raw")).toBeVisible();
    expect(screen.getByText("240 points")).toBeVisible();
    expect(screen.getByText(/No data .* to .*/)).toBeVisible();
  });

  it("does not claim a response resolution before one exists", () => {
    renderControls({ responseResolution: null });
    expect(screen.getByText("Resolution: —")).toBeVisible();
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
