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
    const marker = screen.getByRole("button", { name: /Speeding \(critical\) at/i });
    await userEvent.click(marker);
    expect(onSeek).toHaveBeenCalledWith(fromMs + 60 * 60_000);
  });

  it("keeps event buttons in the band above the track", () => {
    render(
      <PlaybackScrubber
        fromMs={fromMs}
        toMs={toMs}
        playheadMs={fromMs}
        gaps={gaps}
        events={events}
        onSeek={() => undefined}
      />,
    );
    const band = screen.getByTestId("playback-event-band");
    const track = screen.getByTestId("playback-scrubber-track");
    const marker = screen.getByTestId("playback-event-marker");
    expect(band).toContainElement(marker);
    expect(track).not.toContainElement(marker);
  });

  it("collapses dense events into non-interactive ticks", () => {
    const dense = Array.from({ length: 40 }, (_, index) => ({
      key: `dense:${index}`,
      kind: "alert",
      type: "speeding",
      label: "Speeding",
      severity: "critical" as const,
      status: "open",
      at: new Date(fromMs + index * 60_000).toISOString(),
      atMs: fromMs + index * 60_000,
      percent: (index / 39) * 100,
    }));
    render(
      <PlaybackScrubber
        fromMs={fromMs}
        toMs={toMs}
        playheadMs={fromMs}
        gaps={gaps}
        events={dense}
        onSeek={() => undefined}
      />,
    );
    expect(screen.queryAllByTestId("playback-event-marker")).toHaveLength(0);
    expect(screen.getAllByTestId("playback-event-tick")).toHaveLength(40);
  });

  it("adds the date to every time when the range spans local days", () => {
    render(
      <PlaybackScrubber
        fromMs={fromMs}
        toMs={fromMs + 24 * 60 * 60_000}
        playheadMs={fromMs}
        gaps={[]}
        events={events}
        onSeek={() => undefined}
        includeDate
      />,
    );
    const slider = screen.getByRole("slider", { name: "Playback position" });
    expect(slider.getAttribute("aria-valuetext")).toMatch(/\d{1,2} \w{3} \d{2}:\d{2}:\d{2}/);
    expect(screen.getByTestId("playback-current-time")).toHaveTextContent(/\d{1,2} \w{3}/);
  });
});
