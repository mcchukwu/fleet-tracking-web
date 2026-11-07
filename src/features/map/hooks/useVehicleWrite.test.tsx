import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Vehicle } from "../../../api/types";
import { api } from "../../../api/instance";
import { reconcileVehicle, useVehicleWrite } from "./useVehicleWrite";

const vehicle: Vehicle = {
  id: "vehicle-1",
  external_id: "demo-imei-0001",
  plate: "LSD-100-AA",
  vehicle_type: "tanker",
  make: "MAN",
  model: "TGS",
  year: 2021,
  colour: "white",
  status: "active",
  depot: "Lekki Depot",
  department: "operations",
  driver_id: "driver-1",
  driver_name: "Adebayo Okafor",
  driver_phone: "08031000010",
  online: true,
};

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("reconcileVehicle", () => {
  it("reports saved when every readable field matches", () => {
    expect(reconcileVehicle({ ...vehicle, plate: "LSD-100-AB" }, { plate: "LSD-100-AB" })).toBe(
      "saved",
    );
  });

  it("reports not_saved when a readable field differs", () => {
    expect(reconcileVehicle(vehicle, { plate: "LSD-100-AB" })).toBe("not_saved");
  });

  it("cannot confirm a write-only field", () => {
    expect(reconcileVehicle(vehicle, { sim_number: "892340000000001" })).toBe("unknown");
  });
});

describe("useVehicleWrite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the diff and reports success", async () => {
    const update = vi.spyOn(api, "updateVehicle").mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useVehicleWrite("vehicle-1"), {
      wrapper: wrapperFor(queryClient),
    });

    const outcome = await result.current.submit({ plate: "LSD-100-AB" });
    expect(outcome.status).toBe("success");
    expect(update).toHaveBeenCalledWith("vehicle-1", { plate: "LSD-100-AB" });
  });

  it("reconciles a network failure that actually saved", async () => {
    vi.spyOn(api, "updateVehicle").mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "vehicle").mockResolvedValue({ data: { ...vehicle, plate: "LSD-100-AB" } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useVehicleWrite("vehicle-1"), {
      wrapper: wrapperFor(queryClient),
    });

    const outcome = await result.current.submit({ plate: "LSD-100-AB" });
    expect(outcome.status).toBe("reconciled");
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["vehicle", "vehicle-1"]);
    expect(keys).toContainEqual(["live-snapshot"]);
  });

  it("keeps the form in error when the reconcile read shows no save", async () => {
    vi.spyOn(api, "updateVehicle").mockRejectedValue(new TypeError("Failed to fetch"));
    vi.spyOn(api, "vehicle").mockResolvedValue({ data: vehicle });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useVehicleWrite("vehicle-1"), {
      wrapper: wrapperFor(queryClient),
    });

    const outcome = await result.current.submit({ plate: "LSD-100-AB" });
    expect(outcome.status).toBe("error");
  });

  it("blocks a second submit while the first is in flight", async () => {
    let resolve: (() => void) | undefined;
    vi.spyOn(api, "updateVehicle").mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useVehicleWrite("vehicle-1"), {
      wrapper: wrapperFor(queryClient),
    });

    const first = result.current.submit({ plate: "LSD-100-AB" });
    const second = await result.current.submit({ plate: "LSD-100-AB" });
    expect(second.status).toBe("ignored");
    resolve?.();
    expect((await first).status).toBe("success");
  });
});
