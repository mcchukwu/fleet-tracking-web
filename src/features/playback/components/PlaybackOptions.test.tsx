import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybackOptions } from "./PlaybackOptions";
import { TooltipProvider } from "../../../ui/Tooltip";
import type { Cursor } from "../lib/history";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: {
    to: string;
    search?: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a href={`${to}?${new URLSearchParams(search).toString()}`} {...props}>
      {children}
    </a>
  ),
}));

const cursor: Cursor = {
  index: 1,
  position: [3.5, 6.6],
  inGap: false,
  speedKph: 52,
  headingDeg: 95,
};

function renderOptions(overrides: Partial<Parameters<typeof PlaybackOptions>[0]> = {}) {
  const handlers = {
    onPreset: vi.fn(),
    onCustomRange: vi.fn(),
    onResolution: vi.fn(),
    onFit: vi.fn(),
    onJump: vi.fn(),
    onEventsRetry: vi.fn(),
    onChangeVehicle: vi.fn(),
  };
  render(
    <TooltipProvider>
      <PlaybackOptions
        vehicle={{ id: "4324a768-9b14-4223-a299-eb8da4d8d309", plate: "LSD-100-AA" }}
        offline={false}
        preset="2h"
        resolution="30s"
        responseResolution="30s"
        pointCount={240}
        cursor={cursor}
        events={[]}
        includeDate={false}
        onPreset={handlers.onPreset}
        onCustomRange={handlers.onCustomRange}
        onResolution={handlers.onResolution}
        onFit={handlers.onFit}
        onJump={handlers.onJump}
        onEventsRetry={handlers.onEventsRetry}
        onChangeVehicle={handlers.onChangeVehicle}
        {...overrides}
      />
    </TooltipProvider>,
  );
  return handlers;
}

describe("PlaybackOptions", () => {
  it("shows the vehicle and range triggers, the tools and the info line", () => {
    renderOptions();
    expect(screen.getByRole("heading", { name: "Playback" })).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: /^Change vehicle/ })).toHaveTextContent(
      "LSD-100-AA",
    );
    expect(screen.getByRole("button", { name: /^Range/ })).toHaveTextContent("2 h");
    expect(screen.getByRole("button", { name: "Events (0)" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fit route" })).toBeVisible();
    expect(screen.getByTestId("playback-options-info")).toHaveTextContent(
      "Resolution: 30s",
    );
    expect(screen.getByTestId("playback-options-info")).toHaveTextContent("240 points");
    expect(screen.getByTestId("playback-options-info")).toHaveTextContent("52 km/h");
    expect(screen.getByLabelText("Resolution")).toHaveDisplayValue("30s");
  });

  it("opens the change-vehicle dialog from the plate trigger", async () => {
    const handlers = renderOptions();
    await userEvent.click(screen.getByRole("button", { name: /^Change vehicle/ }));
    expect(handlers.onChangeVehicle).toHaveBeenCalled();
  });

  it("selects a preset and the custom range", async () => {
    const handlers = renderOptions();
    await userEvent.click(screen.getByRole("button", { name: /^Range/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Last 30 minutes" }));
    expect(handlers.onPreset).toHaveBeenCalledWith("30m");

    await userEvent.click(screen.getByRole("button", { name: /^Range/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Custom…" }));
    expect(handlers.onCustomRange).toHaveBeenCalled();
  });

  it("changes the resolution and fits the route", async () => {
    const handlers = renderOptions();
    await userEvent.selectOptions(screen.getByLabelText("Resolution"), "auto");
    expect(handlers.onResolution).toHaveBeenCalledWith("auto");
    await userEvent.click(screen.getByRole("button", { name: "Fit route" }));
    expect(handlers.onFit).toHaveBeenCalled();
  });

  it("truncates a long plate before the tools move", () => {
    renderOptions({
      vehicle: {
        id: "4324a768-9b14-4223-a299-eb8da4d8d309",
        plate: "LAGOS-DISTRICT-HEAVY-TANKER-0042",
      },
    });
    expect(screen.getByText("LAGOS-DISTRICT-HEAVY-TANKER-0042")).toHaveClass("truncate");
    expect(screen.getByTestId("playback-options-info-text")).toHaveClass("truncate");
  });

  it("shows the offline badge with the saved-data age", () => {
    renderOptions({ offline: true, savedAt: Date.parse("2026-11-08T14:02:00Z") });
    expect(screen.getByText(/^Offline · showing data from \d{2}:\d{2}$/)).toBeVisible();
  });

  it("disables fit route with no positions", () => {
    renderOptions({ pointCount: 0 });
    expect(screen.getByRole("button", { name: "Fit route" })).toBeDisabled();
  });
});
