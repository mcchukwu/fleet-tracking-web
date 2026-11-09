import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackScrubber } from "./PlaybackScrubber";
import type { PlaybackEvent } from "../lib/events";
import type { RouteGap } from "../lib/history";

const fromMs = Date.parse("2026-11-08T14:00:00Z");
const toMs = Date.parse("2026-11-08T16:00:00Z");

const gaps: RouteGap[] = [{ startIndex: 1, startMs: fromMs + 30 * 60_000, endMs: fromMs + 45 * 60_000 }];
const events: PlaybackEvent[] = [
  {
    key: "alert:speeding:t:0",
    kind: "alert",
    type: "speeding",
    label: "Speeding",
    severity: "critical",
    status: "open",
    at: "2026-11-08T15:00:00Z",
    atMs: fromMs + 60 * 60_000,
    percent: 50,
  },
];

describe("PlaybackScrubber", () => {
  it("seeks by pointer and keyboard", async () => {
    const onSeek = vi.fn();
    render(
      <PlaybackScrubber
        fromMs={fromMs}
        toMs={toMs}
        playheadMs={fromMs}
        gaps={gaps}
        events={events}
        onSeek={onSeek}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Playback position" });
    fireEvent.change(slider, { target: { value: String(fromMs + 60_000) } });
    expect(onSeek).toHaveBeenCalledWith(fromMs + 60_000);

    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onSeek).toHaveBeenCalled();
  });

  it("exposes the current time and a no-data value text", () => {
    render(
      <PlaybackScrubber
        fromMs={fromMs}
        toMs={toMs}
        playheadMs={fromMs + 35 * 60_000}
        gaps={gaps}
        events={events}
        onSeek={() => undefined}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Playback position" });
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("no data"));
  });

  it("renders gap bands and event markers that jump", async () => {
    const onSeek = vi.fn();
    render(
      <PlaybackScrubber
        fromMs={fromMs}
        toMs={toMs}
        playheadMs={fromMs}
        gaps={gaps}
        events={events}
        onSeek={onSeek}
      />,
    );
    expect(screen.getByTestId("gap-band")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Speeding at/i }));
    expect(onSeek).toHaveBeenCalledWith(fromMs + 60 * 60_000);
  });
});
