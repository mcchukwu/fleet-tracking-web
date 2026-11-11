import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../instance";
import { queryKeys } from "../keys";
import { useAckAlert } from "./alerts";
import { useCreateDriver, useUpdateDriver } from "./drivers";
import {
  useCreateGeofence,
  useDeleteGeofence,
  useUpdateGeofence,
} from "./geofences";
import { useCreateTrip, useUpdateTrip } from "./trips";
import { useUpdateVehicle } from "./vehicles";

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("mutation invalidation", () => {
  it("refreshes the snapshot and health after creating a trip", async () => {
    vi.spyOn(api, "createTrip").mockResolvedValue({ id: "trip-1" });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateTrip(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({
        vehicle_id: "vehicle-1",
        origin: "Depot",
        destination: "Customer",
      });
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["trips"]);
    expect(keys).toContainEqual(queryKeys.liveSnapshot);
    expect(keys).toContainEqual(queryKeys.systemHealth);
  });

  it("refreshes health after a trip transition", async () => {
    vi.spyOn(api, "updateTrip").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateTrip(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ id: "trip-1", update: { status: "completed" } });
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["trips"]);
    expect(keys).toContainEqual(queryKeys.liveSnapshot);
    expect(keys).toContainEqual(queryKeys.systemHealth);
  });

  it("refreshes health after acknowledging an alert", async () => {    vi.spyOn(api, "ackAlert").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAckAlert(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync("alert-1");
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["alerts"]);
    expect(keys).toContainEqual(queryKeys.systemHealth);
  });

  it("refreshes the vehicle, snapshot and vehicles root after an edit", async () => {
    vi.spyOn(api, "updateVehicle").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateVehicle("vehicle-1"), {
      wrapper: wrapperFor(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ plate: "LSD-100-AB" });
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(queryKeys.vehicle("vehicle-1"));
    expect(keys).toContainEqual(["vehicles"]);
    expect(keys).toContainEqual(queryKeys.liveSnapshot);
    expect(keys).not.toContainEqual(queryKeys.drivers);
  });

  it("also refreshes drivers when the edit changes the driver", async () => {
    vi.spyOn(api, "updateVehicle").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateVehicle("vehicle-1"), {
      wrapper: wrapperFor(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ driver_id: "driver-2" });
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(queryKeys.drivers);
  });

  it("refreshes only the driver list after creating one", async () => {
    vi.spyOn(api, "createDriver").mockResolvedValue({ id: "driver-1" });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateDriver(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ input: { name: "Ada Obi" } });
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([queryKeys.drivers]);
  });

  it("refreshes every denormalised driver field after an edit", async () => {
    vi.spyOn(api, "updateDriver").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateDriver(), { wrapper: wrapperFor(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ id: "driver-1", update: { phone: "" } });
    });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(queryKeys.drivers);
    expect(keys).toContainEqual(queryKeys.liveSnapshot);
    expect(keys).toContainEqual(["vehicle"]);
    expect(keys).toContainEqual(["vehicles"]);
    expect(keys).toContainEqual(["trips"]);
  });

  it("refreshes only geofences after creating one, with the caller's signal", async () => {
    const create = vi.spyOn(api, "createGeofence").mockResolvedValue({ id: "gf-2" });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const controller = new AbortController();

    const { result } = renderHook(() => useCreateGeofence(), {
      wrapper: wrapperFor(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({
        input: {
          name: "Gate",
          geometry: {
            type: "Polygon",
            coordinates: [[[3.4, 6.4], [3.5, 6.4], [3.5, 6.5], [3.4, 6.4]]],
          },
        },
        signal: controller.signal,
      });
    });

    expect(create.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([queryKeys.geofences]);
  });

  it("refreshes only geofences after an edit, with the caller's signal", async () => {
    const update = vi.spyOn(api, "updateGeofence").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const controller = new AbortController();

    const { result } = renderHook(() => useUpdateGeofence(), {
      wrapper: wrapperFor(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({
        id: "gf-1",
        update: { name: "Lekki Gate" },
        signal: controller.signal,
      });
    });

    expect(update.mock.calls[0]?.[2]).toMatchObject({ signal: controller.signal });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([queryKeys.geofences]);
  });

  it("refreshes only geofences after a delete, with the caller's signal", async () => {
    const remove = vi.spyOn(api, "deleteGeofence").mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const controller = new AbortController();

    const { result } = renderHook(() => useDeleteGeofence(), {
      wrapper: wrapperFor(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ id: "gf-1", signal: controller.signal });
    });

    expect(remove.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([queryKeys.geofences]);
  });
});
