import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackEventsMenu } from "./PlaybackEventsMenu";
import type { PlaybackEvent } from "../lib/events";

const events: PlaybackEvent[] = [
  {
    key: "geofence:enter:a",
    kind: "geofence",
    type: "enter",
    label: "Entered Lekki Depot",
    severity: null,
    status: null,
    at: "2026-11-08T14:30:00Z",
    atMs: Date.parse("2026-11-08T14:30:00Z"),
    percent: 25,
  },
  {
    key: "alert:speeding:b",
    kind: "alert",
    type: "speeding",
    label: "Speeding",
    severity: "critical",
    status: "open",
    at: "2026-11-08T15:00:00Z",
    atMs: Date.parse("2026-11-08T15:00:00Z"),
    percent: 50,
  },
];

describe("PlaybackEventsMenu", () => {
  it("lists events chronologically with severity and jumps on selection", async () => {
    const onJump = vi.fn();
    render(<PlaybackEventsMenu events={events} onJump={onJump} />);

    await userEvent.click(screen.getByRole("button", { name: "Events (2)" }));
    expect(screen.getByText("Entered Lekki Depot")).toBeVisible();
    expect(screen.getByText("Critical")).toBeVisible();

    await userEvent.click(screen.getByText("Speeding"));
    expect(onJump).toHaveBeenCalledWith(Date.parse("2026-11-08T15:00:00Z"));
  });

  it("disables the menu with the reason when there are no events", () => {
    render(
      <PlaybackEventsMenu
        events={[]}
        onJump={() => undefined}
        disabledReason="No events in this range."
      />,
    );
    expect(screen.getByRole("button", { name: "Events (0)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("No events in this range.")).toBeVisible();
  });
});
