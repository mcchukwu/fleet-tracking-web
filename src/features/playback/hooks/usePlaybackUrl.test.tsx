import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaybackUrl } from "./usePlaybackUrl";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
}));

function runSearch(argument: { search?: unknown }): Record<string, unknown> {
  const search = argument.search;
  return typeof search === "function"
    ? (search as (previous: Record<string, unknown>) => Record<string, unknown>)(mocks.search)
    : (search as Record<string, unknown>);
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.search = {};
});

describe("usePlaybackUrl", () => {
  it("writes the default range and resolution once when the URL has neither", async () => {
    renderHook(() => usePlaybackUrl());
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    const call = mocks.navigate.mock.calls[0]?.[0] as {
      search: unknown;
      replace: boolean;
      to: string;
    };
    expect(call.to).toBe("/playback");
    expect(call.replace).toBe(true);
    const next = runSearch(call);
    expect(next.resolution).toBe("30s");
    expect(Date.parse(String(next.to)) - Date.parse(String(next.from))).toBe(2 * 60 * 60_000);
  });

  it("keeps a deep-linked range and adds only the default resolution", async () => {
    mocks.search = {
      vehicle: "4324a768-9b14-4223-a299-eb8da4d8d309",
      from: "2026-11-08T10:00:00Z",
      to: "2026-11-08T12:00:00Z",
    };
    renderHook(() => usePlaybackUrl());
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    const next = runSearch(mocks.navigate.mock.calls[0]?.[0] as { search: unknown });
    expect(next).toMatchObject({
      vehicle: "4324a768-9b14-4223-a299-eb8da4d8d309",
      from: "2026-11-08T10:00:00Z",
      to: "2026-11-08T12:00:00Z",
      resolution: "30s",
    });
  });

  it("does not rewrite a complete URL", async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 2 * 60 * 60_000);
    mocks.search = {
      vehicle: "4324a768-9b14-4223-a299-eb8da4d8d309",
      from: from.toISOString(),
      to: to.toISOString(),
      resolution: "auto",
    };
    const { result } = renderHook(() => usePlaybackUrl());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(result.current.vehicleId).toBe("4324a768-9b14-4223-a299-eb8da4d8d309");
    expect(result.current.resolution).toBe("auto");
    expect(result.current.range.valid).toBe(true);
    expect(result.current.preset).toBe("2h");
  });

  it("exposes the validation result for a bad range", () => {
    mocks.search = {
      from: "2026-11-08T12:00:00Z",
      to: "2026-11-08T10:00:00Z",
      resolution: "30s",
    };
    const { result } = renderHook(() => usePlaybackUrl());
    expect(result.current.range).toMatchObject({ valid: false, reason: "order" });
  });

  it("writes vehicle, range and resolution with replace", () => {
    mocks.search = {
      from: "2026-11-08T10:00:00Z",
      to: "2026-11-08T12:00:00Z",
      resolution: "30s",
    };
    const { result } = renderHook(() => usePlaybackUrl());

    result.current.setVehicle("4324a768-9b14-4223-a299-eb8da4d8d309");
    expect(runSearch(mocks.navigate.mock.calls[0]?.[0] as { search: unknown })).toMatchObject({
      vehicle: "4324a768-9b14-4223-a299-eb8da4d8d309",
    });
    expect(mocks.navigate.mock.calls[0]?.[0]).toMatchObject({ replace: true });

    result.current.setRange("2026-11-08T08:00:00Z", "2026-11-08T09:00:00Z");
    expect(runSearch(mocks.navigate.mock.calls[1]?.[0] as { search: unknown })).toMatchObject({
      from: "2026-11-08T08:00:00Z",
      to: "2026-11-08T09:00:00Z",
    });

    result.current.setResolution("auto");
    expect(runSearch(mocks.navigate.mock.calls[2]?.[0] as { search: unknown })).toMatchObject({
      resolution: "auto",
    });
  });
});
