import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LngLat, MapAdapter } from "../../../map/types";
import { contractTokens } from "../../../map/testing/adapter-contract";
import { FakeAdapter } from "../../../map/testing/FakeAdapter";
import { useGeofenceDrawing } from "./useGeofenceDrawing";

const ring: LngLat[] = [
  [3.4, 6.4],
  [3.5, 6.4],
  [3.5, 6.5],
];

async function mountAdapter() {
  const adapter = new FakeAdapter();
  await adapter.mount(document.createElement("div"), {
    theme: "light",
    tokens: contractTokens,
  });
  return adapter;
}

describe("useGeofenceDrawing", () => {
  it("starts a create session ready with no geometry", async () => {
    const adapter = await mountAdapter();
    const { result } = renderHook(() =>
      useGeofenceDrawing({ adapter, active: true, kind: "depot" }),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.geometry).toBeNull();
    expect(result.current.dirty).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("seeds an edit session with the baseline and reports changes as dirty", async () => {
    const adapter = await mountAdapter();
    const { result } = renderHook(() =>
      useGeofenceDrawing({ adapter, active: true, kind: "depot", initialRing: ring }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.getGeometry()?.coordinates[0]).toEqual([...ring, ring[0]]);
    expect(result.current.dirty).toBe(false);

    const moved = ring.map(([lon, lat]) => [lon + 0.001, lat] as LngLat);
    act(() => {
      (adapter.draw as unknown as { testSetRing: (value: LngLat[]) => void }).testSetRing(moved);
    });
    await waitFor(() => expect(result.current.dirty).toBe(true));
  });

  it("clears geometry and dirty state on cancel", async () => {
    const adapter = await mountAdapter();
    const { result } = renderHook(() =>
      useGeofenceDrawing({ adapter, active: true, kind: "depot", initialRing: ring }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.cancel());
    expect(result.current.getGeometry()).toBeNull();
    expect(result.current.geometry).toBeNull();
    expect(result.current.dirty).toBe(false);
    expect(result.current.status).toBe("idle");
  });

  it("reports an adapter without a draw controller as an error", async () => {
    const adapter = {
      id: "no-draw",
      capabilities: {
        offline: false,
        drawing: false,
        clustering: "emulated",
        comfortableVehicleCount: 1,
        styles: ["standard"],
      },
      draw: undefined,
    } as unknown as MapAdapter;
    const { result } = renderHook(() =>
      useGeofenceDrawing({ adapter, active: true, kind: "depot" }),
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).not.toBeNull();
  });

  it("retries after a failed start", async () => {
    const adapter = await mountAdapter();
    const { result } = renderHook(() =>
      useGeofenceDrawing({ adapter, active: true, kind: "depot" }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("cancels the session when it becomes inactive", async () => {
    const adapter = await mountAdapter();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useGeofenceDrawing({ adapter, active, kind: "depot", initialRing: ring }),
      { initialProps: { active: true } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    rerender({ active: false });
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(adapter.draw?.getGeometry()).toBeNull();
  });

  it("keeps the ring when the map is replaced and resumes it on retry", async () => {
    const first = await mountAdapter();
    const second = await mountAdapter();
    const { result, rerender } = renderHook(
      ({ adapter }: { adapter: MapAdapter }) =>
        useGeofenceDrawing({ adapter, active: true, kind: "depot", initialRing: ring }),
      { initialProps: { adapter: first } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const moved = ring.map(([lon, lat]) => [lon + 0.001, lat] as LngLat);
    act(() => {
      (first.draw as unknown as { testSetRing: (value: LngLat[]) => void }).testSetRing(moved);
    });
    await waitFor(() => expect(result.current.dirty).toBe(true));

    rerender({ adapter: second });
    await waitFor(() => expect(result.current.status).toBe("interrupted"));
    expect(result.current.notice).toBe("The map reloaded. Draw the polygon again.");
    expect(result.current.canResume).toBe(true);
    expect(result.current.getGeometry()?.coordinates[0]).toEqual([...moved, moved[0]]);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(second.draw?.getGeometry()?.coordinates[0]).toEqual([...moved, moved[0]]);
    expect(result.current.notice).toBeNull();
  });

  it("explains a cancelled draft after a style swap", async () => {
    const adapter = await mountAdapter();
    const { result } = renderHook(() =>
      useGeofenceDrawing({ adapter, active: true, kind: "depot" }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      adapter.setBaseStyle("standard");
    });

    await waitFor(() =>
      expect(result.current.notice).toBe("Drawing was cancelled. Draw the polygon again."),
    );
  });
});
