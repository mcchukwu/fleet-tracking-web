import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaybackMap } from "./PlaybackMap";
import type { MapRoute } from "../../../map/types";

const received: Record<string, unknown> = {};

vi.mock("../../../map/FleetMap", () => ({
  FleetMap: (props: Record<string, unknown>) => {
    Object.assign(received, props);
    return <section aria-label={String(props.label)} />;
  },
}));

const route: MapRoute = {
  points: [
    [3.4, 6.5],
    [3.5, 6.6],
  ],
  gapAfterIndex: [0],
  cursorIndex: 1,
  cursorPosition: [3.45, 6.55],
  chevrons: true,
};

describe("PlaybackMap", () => {
  it("uses the shared map with the route and the standard basemap", () => {
    render(<PlaybackMap route={route} offline={false} onReady={() => undefined} />);
    expect(screen.getByRole("region", { name: "Playback map" })).toBeVisible();
    expect(received.route).toBe(route);
    expect(received.label).toBe("Playback map");
    expect(received.baseStyle).toBe("standard");
    expect(received.dimmed).toBe(false);
  });

  it("dims the map offline and reports the adapter", () => {
    const onReady = vi.fn();
    render(<PlaybackMap route={null} offline onReady={onReady} />);
    expect(received.dimmed).toBe(true);
    (received.onReady as (adapter: unknown) => void)(null);
    expect(onReady).toHaveBeenCalledWith(null);
  });
});
