import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SystemHealth } from "../../../api/schemas";
import { systemHealthFixture } from "../../../mocks/fixtures/untyped";
import { useHealthTrend } from "./useHealthTrend";

function data(received: number, dropped = 0): SystemHealth {
  return {
    ...systemHealthFixture,
    ingest: {
      ...systemHealthFixture.ingest,
      dropped,
      received,
    },
  };
}

function renderTrend(initial: {
  data: SystemHealth | undefined;
  dataUpdatedAt: number;
  mountedAt: number;
}) {
  return renderHook(
    (props: {
      data: SystemHealth | undefined;
      dataUpdatedAt: number;
      mountedAt: number;
    }) => useHealthTrend(props),
    { initialProps: initial },
  );
}

describe("useHealthTrend", () => {
  it("makes the first fresh sample the baseline", () => {
    const first = data(1_000);
    const { result } = renderTrend({
      data: first,
      dataUpdatedAt: 1_000,
      mountedAt: 1_000,
    });

    expect(result.current.first?.data).toBe(first);
    expect(result.current.previous).toBeNull();
    expect(result.current.reset).toBe(false);
  });

  it("keeps the baseline and exposes the previous sample", () => {
    const first = data(1_000);
    const second = data(1_100);
    const { result, rerender } = renderTrend({
      data: first,
      dataUpdatedAt: 1_000,
      mountedAt: 1_000,
    });

    rerender({ data: second, dataUpdatedAt: 11_000, mountedAt: 1_000 });

    expect(result.current.first?.data).toBe(first);
    expect(result.current.previous?.data).toBe(first);
  });

  it("ignores cached data older than the mount as a baseline", () => {
    const cached = data(900);
    const fresh = data(1_000);
    const { result, rerender } = renderTrend({
      data: cached,
      dataUpdatedAt: 500,
      mountedAt: 1_000,
    });

    expect(result.current.first).toBeNull();

    rerender({ data: fresh, dataUpdatedAt: 2_000, mountedAt: 1_000 });
    expect(result.current.first?.data).toBe(fresh);
    expect(result.current.previous).toBeNull();
  });

  it("re-baselines after the server resets the counters", () => {
    const first = data(500);
    const reset = data(50);
    const recovered = data(90);
    const { result, rerender } = renderTrend({
      data: first,
      dataUpdatedAt: 1_000,
      mountedAt: 1_000,
    });

    rerender({ data: reset, dataUpdatedAt: 2_000, mountedAt: 1_000 });
    expect(result.current.reset).toBe(true);
    expect(result.current.first?.data).toBe(reset);

    rerender({ data: recovered, dataUpdatedAt: 3_000, mountedAt: 1_000 });
    expect(result.current.reset).toBe(false);
    expect(result.current.first?.data).toBe(reset);
    expect(result.current.previous?.data).toBe(reset);
  });

  it("ignores a repeated sample timestamp", () => {
    const first = data(500);
    const sameTimestamp = data(900);
    const { result, rerender } = renderTrend({
      data: first,
      dataUpdatedAt: 1_000,
      mountedAt: 1_000,
    });

    rerender({ data: sameTimestamp, dataUpdatedAt: 1_000, mountedAt: 1_000 });
    expect(result.current.first?.data).toBe(first);
    expect(result.current.previous).toBeNull();
  });
});
